import { aimedAt, applyInput, createMatch, drainEvents, join, mirror, reconcile, snapshot, STEP } from "../sim";
import type { GameEvent, GameMap, PlayerInput, PlayerView, Snapshot } from "../sim";
import type { MatchConnection } from "./connection";
import { BATCH, type ClientMessage, type ServerMessage } from "./protocol";

/** Why a room connection ended without the player asking for it. */
export type CloseReason = Extract<ServerMessage, { t: "refused" }>["reason"] | "lost" | "over";

const INTERPOLATION = 0.1; // other players are shown this many seconds in the past, between two server updates
const RETRY_MS = 2000, RETRY_FOR_MS = 20_000; // matches the room's reconnect grace
const PING_STEPS = 120; // one ping each 2 seconds of play
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const turn = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

/**
 * Play in a room on the server. The player's own movement is predicted here, with the same
 * simulation the server runs, so it responds at once. Other players are shown slightly in the past.
 */
export function connectRoom(options: { url: string; map: GameMap; id: string; name: string; colour: number; skin: number; onClosed(reason: CloseReason): void }): MatchConnection {
  const { url, map, id, onClosed } = options;
  const replica = createMatch(map); // the local copy used for prediction
  let listener: (snapshot: Snapshot, events: GameEvent[]) => void = () => {};
  let ws: WebSocket, joined = false, done = false, lostAt = 0;
  let seq = 0, pending: { seq: number; input: PlayerInput }[] = [], outbox: PlayerInput[] = [];
  const updates: { at: number; snap: Snapshot }[] = [];
  let fromServer: GameEvent[] = [], clockOffset: number | null = null, ping: number | null = null;
  // After a spawn, the server chooses which way the player faces. Inputs made before that are stale.
  let spawned = false;

  const finish = (reason: CloseReason) => { if (done) return; done = true; onClosed(reason); };
  const send = (message: ClientMessage) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };

  const onMessage = (message: ServerMessage) => {
    if (message.t === "refused") { finish(message.reason); return; }
    if (message.t === "joined") {
      if (!replica.players.has(id)) join(replica, options);
      joined = true; lostAt = 0; spawned = true;
      return;
    }
    if (message.t === "pong") { ping = performance.now() - message.at; return; }
    const now = performance.now() / 1000, offset = message.snap.time - now;
    clockOffset = clockOffset === null ? offset : lerp(clockOffset, offset, 0.1);
    updates.push({ at: now, snap: message.snap });
    if (updates.length > 20) updates.shift();
    for (const e of message.events) {
      fromServer.push(e.type === "shot" && e.by === id ? { ...e, echo: true } : e);
      if (e.type === "respawn" && e.id === id) spawned = true;
    }
    pending = pending.filter((p) => p.seq > message.ack);
    const me = replica.players.get(id), mine = message.snap.players.find((p) => p.id === id);
    if (me && message.me) reconcile(replica, id, message.me, pending.map((p) => p.input));
    if (me && mine) me.reloadUntil = mine.reloading ? Infinity : 0;
    if (me && mine && spawned) { me.yaw = mine.yaw; me.pitch = 0; }
  };

  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => send({ t: "join", id, name: options.name, colour: options.colour, skin: options.skin });
    ws.onmessage = (e) => onMessage(JSON.parse(e.data as string));
    ws.onclose = () => {
      if (done) return;
      const latest = updates[updates.length - 1]?.snap;
      if (latest?.ended) { finish("over"); return; }
      if (!joined && !lostAt) { finish("no-room"); return; } // the room never accepted this connection
      // The connection dropped. Try again while the room still holds this player's slot.
      joined = false; pending = []; outbox = []; ping = null;
      lostAt ||= Date.now();
      if (Date.now() - lostAt > RETRY_FOR_MS) finish("lost"); else setTimeout(() => { if (!done) open(); }, RETRY_MS);
    };
  };
  open();

  /** Other players at a past server time, between the two updates around it. */
  const othersAt = (time: number): PlayerView[] => {
    const last = updates[updates.length - 1];
    let a = last, b = last;
    for (let i = updates.length - 2; i >= 0; i--) if (updates[i].snap.time <= time) { a = updates[i]; b = updates[i + 1]; break; }
    const k = b.snap.time > a.snap.time ? Math.min(1, Math.max(0, (time - a.snap.time) / (b.snap.time - a.snap.time))) : 1;
    return b.snap.players.filter((p) => p.id !== id).map((p) => {
      const from = a.snap.players.find((q) => q.id === p.id);
      if (!from || !from.alive || !p.alive || Math.hypot(p.pos[0] - from.pos[0], p.pos[2] - from.pos[2]) > 5) return p; // just spawned
      return { ...p, pos: [lerp(from.pos[0], p.pos[0], k), lerp(from.pos[1], p.pos[1], k), lerp(from.pos[2], p.pos[2], k)], yaw: turn(from.yaw, p.yaw, k), pitch: lerp(from.pitch, p.pitch, k) };
    });
  };

  return {
    playerId: id,
    send(input) {
      const latest = updates[updates.length - 1]?.snap, me = replica.players.get(id);
      if (!joined || !latest || !me || clockOffset === null) return;
      const view = performance.now() / 1000 + clockOffset - INTERPOLATION, others = othersAt(view);
      const mine = latest.players.find((p) => p.id === id);
      const step = { ...input, view };
      if (spawned) {
        // Tell the client where it faces. This step's input was made before the spawn, so it is dropped.
        spawned = false;
        fromServer.push({ type: "respawn", id });
      } else if (!latest.ended) {
        mirror(replica, { ...latest, players: others }, id);
        applyInput(replica, id, step);
        replica.time += STEP;
        pending.push({ seq: ++seq, input: step });
        outbox.push(step);
        if (outbox.length >= BATCH) { send({ t: "in", seq, inputs: outbox }); outbox = []; }
        if (seq % PING_STEPS === 1) send({ t: "ping", at: performance.now() });
      }
      // Show this player's own shots at once. Whether they hit a player comes from the server.
      const local = drainEvents(replica).flatMap((e): GameEvent[] =>
        e.type === "shot" && e.by === id ? [{ ...e, hit: e.target ? "none" : e.hit, target: undefined }] : e.type === "empty" || e.type === "reload" ? [e] : []);
      const self = snapshot(replica).players.find((p) => p.id === id)!;
      const merged: Snapshot = {
        ...latest,
        players: [{ ...self, name: mine?.name ?? self.name, kills: mine?.kills ?? 0, deaths: mine?.deaths ?? 0, protected: mine?.protected ?? false }, ...others],
      };
      const events = [...local, ...fromServer];
      fromServer = [];
      listener(merged, events);
    },
    onUpdate(next) { listener = next; },
    aimedAt: () => aimedAt(replica, id),
    ping: () => ping,
    close() {
      if (done) return;
      done = true;
      send({ t: "leave" });
      ws.close();
    },
  };
}
