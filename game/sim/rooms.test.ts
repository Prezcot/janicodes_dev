import { describe, expect, it } from "vitest";
import { activeCount, advance, applyInput, createMatch, drainEvents, join, leave, snapshot } from "./index";
import { groundAt, pushOut } from "./collide";
import { SPLIT_LEVEL } from "./map";
import { flatMap, input } from "./testing";
import type { GameMap, Match } from "./types";

const SPAWNS: GameMap["spawns"] = Array.from({ length: 10 }, (_, i) => ({ pos: [i * 5 - 20, 0, 0], yaw: 0 }));
const room = () => createMatch(flatMap([], SPAWNS));
const add = (match: Match, id: string, colour: number, name = id) => join(match, { id, name, colour });
const wait = (match: Match, seconds: number) => { for (let i = 0; i < seconds; i++) advance(match, 1); };
const player = (match: Match, id: string) => snapshot(match).players.find((p) => p.id === id)!;

describe("room timer", () => {
  it("starts at the first join and ends the match after 30 minutes", () => {
    const match = room();
    expect(snapshot(match).endsAt).toBe(Infinity);
    wait(match, 50);
    add(match, "a", 0);
    expect(snapshot(match).endsAt).toBe(50 + 1800);
    wait(match, 1799);
    expect(snapshot(match).ended).toBe(false);
    wait(match, 1);
    expect(snapshot(match).ended).toBe(true);
    expect(drainEvents(match)).toContainEqual({ type: "ended" });
  });

  it("refuses new players in the last 2 minutes", () => {
    const match = room();
    add(match, "a", 0);
    wait(match, 1679);
    expect(add(match, "b", 1)).toEqual({ ok: true });
    wait(match, 2);
    expect(add(match, "c", 2)).toEqual({ ok: false, reason: "ending" });
  });

  it("ignores input after the match ends", () => {
    const match = room();
    add(match, "a", 0);
    wait(match, 1800);
    const before = player(match, "a").pos;
    applyInput(match, "a", input({ moveZ: 1 }));
    expect(player(match, "a").pos).toEqual(before);
    expect(add(match, "b", 1)).toEqual({ ok: false, reason: "ended" });
  });
});

describe("joining", () => {
  it("holds 8 players and refuses a ninth", () => {
    const match = room();
    for (let i = 0; i < 8; i++) expect(add(match, `p${i}`, i)).toEqual({ ok: true });
    expect(add(match, "p8", 0)).toEqual({ ok: false, reason: "full" });
    expect(activeCount(match)).toBe(8);
  });

  it("refuses a colour that another player has", () => {
    const match = room();
    add(match, "a", 3);
    expect(add(match, "b", 3)).toEqual({ ok: false, reason: "colour-taken" });
    expect(add(match, "b", 4)).toEqual({ ok: true });
  });

  it("numbers a duplicate name and cuts a long name to 16 characters", () => {
    const match = room();
    add(match, "a", 0, "Ann");
    add(match, "b", 1, "  Ann ");
    add(match, "c", 2, "Ann");
    add(match, "d", 3, "A name that is far too long");
    expect(snapshot(match).players.map((p) => p.name)).toEqual(["Ann", "Ann 2", "Ann 3", "A name that is f"]);
  });

  it("spawns a late joiner at once with no kills", () => {
    const match = room();
    add(match, "a", 0);
    wait(match, 600);
    add(match, "b", 1);
    expect(player(match, "b")).toMatchObject({ alive: true, kills: 0, deaths: 0, health: 100 });
  });
});

describe("leaving", () => {
  it("marks a leaver as left, keeps the score, and continues it on return", () => {
    const match = room();
    add(match, "a", 0); add(match, "b", 1);
    match.players.get("a")!.kills = 4; // a score earned earlier
    leave(match, "a");
    expect(player(match, "a")).toMatchObject({ left: true, kills: 4 });
    expect(activeCount(match)).toBe(1);
    wait(match, 300);
    expect(add(match, "a", 5, "Back")).toEqual({ ok: true });
    expect(player(match, "a")).toMatchObject({ left: false, kills: 4, colour: 5, name: "Back", alive: true });
  });

  it("keeps a leaver's colour and slot for 20 seconds", () => {
    const match = room();
    add(match, "a", 0);
    for (let i = 1; i < 8; i++) add(match, `p${i}`, i);
    leave(match, "a");
    wait(match, 19);
    expect(add(match, "new", 0)).toEqual({ ok: false, reason: "full" });
    wait(match, 1);
    expect(add(match, "new", 0)).toEqual({ ok: true });
  });

  it("removes a player after 2 minutes without input, but not an active one", () => {
    const match = room();
    add(match, "still", 0); add(match, "busy", 1);
    for (let second = 0; second < 121; second++) {
      applyInput(match, "still", input());
      applyInput(match, "busy", input({ yaw: second }));
      advance(match, 1);
    }
    expect(player(match, "still").left).toBe(true);
    expect(player(match, "busy").left).toBe(false);
    expect(drainEvents(match)).toContainEqual({ type: "idle", id: "still" });
  });
});

describe("the Split level map", () => {
  it("has 8 spawn points that stand on free ground", () => {
    expect(SPLIT_LEVEL.spawns).toHaveLength(8);
    for (const s of SPLIT_LEVEL.spawns) {
      const pos: [number, number, number] = [...s.pos];
      pushOut(SPLIT_LEVEL, pos, 1.8, 0.3);
      expect(pos).toEqual(s.pos);
      expect(groundAt(SPLIT_LEVEL, s.pos[0], s.pos[2], s.pos[1], 0.3)).toBe(s.pos[1]);
    }
  });

  it("keeps players inside the outer walls", () => {
    const match = createMatch(SPLIT_LEVEL);
    add(match, "a", 0);
    for (let i = 0; i < 600; i++) applyInput(match, "a", input({ moveZ: 1, yaw: Math.PI / 2 })); // run toward -x for 10 s
    const { pos } = player(match, "a");
    expect(pos[0]).toBeGreaterThan(-17);
    expect(pos[0]).toBeLessThan(-16.5);
  });
});
