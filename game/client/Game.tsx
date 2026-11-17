"use client";

import { useEffect, useRef, useState } from "react";
import { connectLocal } from "../net/local";
import { MAX_ROOMS, type RoomInfo } from "../net/protocol";
import { connectRoom, type CloseReason } from "../net/remote";
import { randomName, SPLIT_LEVEL, TUNING } from "../sim";
import { startGame, type Hud, type Options, type Score } from "./engine";
import { theme } from "../../theme/theme";
import "./game.css";

/** Address of the Cloudflare Worker. Without it, the game offers solo practice only. */
const SERVER = process.env.NEXT_PUBLIC_GAME_SERVER?.replace(/\/$/, "") ?? "";
const WHY: Record<CloseReason, string> = {
  full: "That room is full.",
  ending: "That room ends soon and takes no new players.",
  ended: "That room has ended.",
  "colour-taken": "Another player has that colour. Pick a different one.",
  "no-room": "That room is gone.",
  lost: "The connection to the room was lost.",
  over: "",
};

// Browser storage can be blocked. The game then works with defaults.
const load = (key: string) => { try { return localStorage.getItem(`paper-arena:${key}`) ?? ""; } catch { return ""; } };
const store = (key: string, value: string) => { try { localStorage.setItem(`paper-arena:${key}`, value); } catch { /* storage is blocked */ } };
const hex = (colour: number) => theme.players[colour].colour;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

type Play = { code: string; name: string; colour: number } | { code: ""; name: string; colour: number };

export default function Game() {
  const [play, setPlay] = useState<Play | null>(null);
  const [notice, setNotice] = useState("");
  // Esc frees the mouse. It must not also close the Workbench window.
  return <div className="fps-root" tabIndex={0} onKeyDown={e => { if (e.key === "Escape") e.stopPropagation(); }}>
    {play
      ? <Arena key={play.code} play={play} onExit={reason => { setNotice(WHY[reason]); setPlay(null); }} />
      : <Lobby notice={notice} onPlay={next => { setNotice(""); setPlay(next); }} />}
  </div>;
}

function Lobby({ notice, onPlay }: { notice: string; onPlay: (play: Play) => void }) {
  const [name, setName] = useState(() => load("name"));
  const [colour, setColour] = useState(() => Math.min(7, Math.max(0, Number(load("colour")) || 0)));
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!SERVER) return;
    let active = true;
    const refresh = () => fetch(`${SERVER}/rooms`).then(r => r.json()).then((list: RoomInfo[]) => { if (active) { setRooms(list); setNow(Date.now()); setError(""); } })
      .catch(() => { if (active) setError("The game server cannot be reached."); });
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const enter = (code: string) => {
    const chosen = name.trim().slice(0, TUNING.nameLength) || randomName();
    store("name", name.trim()); store("colour", String(colour));
    onPlay({ code, name: chosen, colour });
  };
  const create = async () => {
    setError("");
    try {
      const response = await fetch(`${SERVER}/rooms`, { method: "POST" });
      if (response.status === 409) { setError(`${MAX_ROOMS} rooms are open. Join one of them.`); return; }
      enter(((await response.json()) as { code: string }).code);
    } catch { setError("The game server cannot be reached."); }
  };

  return <div className="fps-lobby">
    <h2>Paper Arena</h2>
    <div className="fps-profile">
      <label>Name<input value={name} maxLength={TUNING.nameLength} placeholder="Leave empty for a random name" onChange={e => setName(e.target.value)} /></label>
      <div role="radiogroup" aria-label="Colour" className="fps-swatches">
        {theme.players.map((p, i) => <button key={i} role="radio" aria-checked={colour === i} aria-label={p.name} title={p.name} style={{ background: p.colour }} onClick={() => setColour(i)} />)}
      </div>
    </div>
    {(notice || error) && <p className="fps-notice" role="alert">{error || notice}</p>}
    {SERVER ? <>
      <div className="fps-rooms">
        {rooms === null ? <p>Loading rooms…</p> : rooms.length === 0 ? <p>No rooms are open. Create the first one.</p> : rooms.map(room => {
          const secondsLeft = room.endsAt === null ? null : Math.max(0, Math.round((room.endsAt - now) / 1000));
          const full = room.players >= TUNING.maxPlayers, ending = secondsLeft !== null && secondsLeft <= TUNING.joinCutoff, taken = room.colours.includes(colour);
          return <div key={room.code} className="fps-room">
            <strong>{room.name}</strong>
            <span>{room.players} of {TUNING.maxPlayers}</span>
            <span>{secondsLeft === null ? "not started" : `${clock(secondsLeft)} left`}</span>
            <button className="btn primary" disabled={full || ending || taken} onClick={() => enter(room.code)}>{full ? "Full" : ending ? "Ending" : taken ? "Colour taken" : "Join"}</button>
          </div>;
        })}
      </div>
      <div className="fps-actions">
        <button className="btn primary" disabled={(rooms?.length ?? 0) >= MAX_ROOMS} onClick={() => void create()}>Create room</button>
        <button className="btn" onClick={() => enter("")}>Practice alone</button>
      </div>
    </> : <div className="fps-actions">
      <button className="btn primary" onClick={() => enter("")}>Practice alone</button>
      <span>Multiplayer is not set up on this site yet.</span>
    </div>}
  </div>;
}

const START: Hud = { locked: false, alive: true, health: TUNING.maxHealth, ammo: TUNING.magSize, reloading: false, secondsLeft: 0, ended: false, showScores: false, scores: [], aim: "", killedBy: "", feed: [], hits: 0, headHit: false };
const ranked = (scores: Score[]) => [...scores].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

function Arena({ play, onExit }: { play: Play; onExit: (reason: CloseReason) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof startGame> | null>(null);
  const [hud, setHud] = useState(START);
  const [options, setOptions] = useState<Options>(() => ({ sensitivity: Number(load("sensitivity")) || 1, volume: load("volume") === "" ? 0.6 : Number(load("volume")) }));
  const exit = useRef(onExit);
  useEffect(() => { exit.current = onExit; });

  useEffect(() => {
    let id = load("id");
    if (!id) { id = crypto.randomUUID(); store("id", id); }
    const who = { id, name: play.name, colour: play.colour };
    const connection = play.code
      ? connectRoom({ ...who, url: `${SERVER.replace(/^http/, "ws")}/room/${play.code}/ws`, map: SPLIT_LEVEL, onClosed: reason => exit.current(reason) })
      : connectLocal(SPLIT_LEVEL, who);
    const started = startGame(canvas.current!, SPLIT_LEVEL, connection, play.colour, options, setHud);
    game.current = started;
    return () => { started.stop(); connection.close(); game.current = null; };
    // The options at start are enough: later changes go through setOptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const change = (next: Options) => {
    setOptions(next);
    game.current?.setOptions(next);
    store("sensitivity", String(next.sensitivity)); store("volume", String(next.volume));
  };
  const table = (scores: Score[]) => <table className="fps-table">
    <thead><tr><th>Player</th><th>Kills</th><th>Deaths</th></tr></thead>
    <tbody>{ranked(scores).map(s => <tr key={s.id} className={s.left ? "left" : ""}>
      <td><i style={{ background: hex(s.colour) }} />{s.name}{s.left && <em> left</em>}</td><td>{s.kills}</td><td>{s.deaths}</td>
    </tr>)}</tbody>
  </table>;

  return <>
    <canvas ref={canvas} className="fps-canvas" aria-label="Game view" />
    {hud.locked && <div key={hud.hits} className={`fps-crosshair ${hud.hits ? (hud.headHit ? "head" : "hit") : ""}`} aria-hidden="true" />}
    {hud.locked && hud.aim && <div className="fps-aim">{hud.aim}</div>}
    <div className="fps-top">{clock(hud.secondsLeft)}</div>
    <div className="fps-feed">{hud.feed.map(f => <div key={f.key}><b>{f.killer}</b> {f.head ? "headshot" : "shot"} <b>{f.target}</b></div>)}</div>
    <div className="fps-stat fps-health"><small>Health</small>{hud.alive ? hud.health : 0}</div>
    <div className="fps-stat fps-ammo"><small>{hud.reloading ? "Reloading" : "Ammo"}</small>{hud.ammo} / {TUNING.magSize}</div>
    {!hud.alive && !hud.ended && hud.killedBy && <div className="fps-killed">Killed by <b>{hud.killedBy}</b></div>}
    {hud.showScores && !hud.ended && <div className="fps-panel fps-scores">{table(hud.scores)}</div>}
    {hud.ended && <div className="fps-panel fps-final">
      <h3>Final kill count</h3>
      {ranked(hud.scores)[0] && <p>{ranked(hud.scores)[0].name} wins</p>}
      {table(hud.scores)}
      <button className="btn primary" onClick={() => onExit("over")}>Back to rooms</button>
    </div>}
    {!hud.locked && !hud.ended && <div className="fps-overlay">
      <strong>Click to play</strong>
      <span>WASD move · Space jump · Left Shift crouch</span>
      <span>Click fire · R reload · Tab scores · Esc menu</span>
      <div className="fps-panel fps-menu">
        <label><span>Mouse sensitivity <b>{options.sensitivity.toFixed(1)}</b></span><input type="range" min="0.3" max="3" step="0.1" value={options.sensitivity} onChange={e => change({ ...options, sensitivity: Number(e.target.value) })} /></label>
        <label>Volume<input type="range" min="0" max="1" step="0.05" value={options.volume} onChange={e => change({ ...options, volume: Number(e.target.value) })} /></label>
        <div className="fps-actions">
          <button className="btn" onClick={() => void canvas.current?.parentElement?.requestFullscreen()}>Full screen</button>
          <button className="btn" onClick={() => onExit("over")}>{play.code ? "Leave room" : "Stop"}</button>
        </div>
      </div>
    </div>}
  </>;
}
