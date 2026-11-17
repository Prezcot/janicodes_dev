import { describe, expect, it } from "vitest";
import { advance, aimedAt, applyInput, createMatch, join, mirror, privateState, randomName, reconcile, restore, roomName, save, snapshot, STEP } from "./index";
import { aim, flatMap, input } from "./testing";
import type { GameMap, Match, PlayerInput } from "./types";

const SPAWNS: GameMap["spawns"] = [{ pos: [0, 0, 0], yaw: 0 }, { pos: [0, 0, -10], yaw: Math.PI }, { pos: [6, 0, -2], yaw: 0 }];
const EYE = 1.65;
const two = () => {
  const match = createMatch(flatMap([], SPAWNS));
  join(match, { id: "a", name: "A", colour: 0 });
  join(match, { id: "b", name: "B", colour: 1 });
  for (let i = 0; i < 120; i++) advance(match, STEP);
  return match;
};
const player = (match: Match, id: string) => snapshot(match).players.find((p) => p.id === id)!;
const fire = (match: Match, over: Partial<PlayerInput>) => { applyInput(match, "a", input({ ...over, fire: true })); applyInput(match, "a", input(over)); };

describe("lag compensation", () => {
  // "b" runs to its right (toward -x) at 6 m/s. "a" shoots at where "b" was 0.2 s ago, 1.2 m behind it.
  const runThenShoot = (withView: boolean) => {
    const match = two();
    for (let i = 0; i < 30; i++) { applyInput(match, "b", input({ yaw: Math.PI, moveX: 1 })); advance(match, STEP); }
    const seenAt = match.time - 0.2;
    const now = player(match, "b").pos;
    expect(now[0]).toBeCloseTo(-3, 1);
    const old = aim([0, EYE, 0], [now[0] + 1.2, 1.0, -10]);
    fire(match, withView ? { ...old, view: seenAt } : old);
    return player(match, "b").health;
  };

  it("hits a moving player where the shooter saw them", () => {
    expect(runThenShoot(true)).toBe(66);
  });

  it("misses that same shot without the view time", () => {
    expect(runThenShoot(false)).toBe(100);
  });

  it("does not rewind more than 0.4 seconds", () => {
    const match = two();
    for (let i = 0; i < 60; i++) { applyInput(match, "b", input({ yaw: Math.PI, moveX: 1 })); advance(match, STEP); }
    fire(match, { ...aim([0, EYE, 0], [0, 1.0, -10]), view: match.time - 1 }); // where "b" stood 1 s ago
    expect(player(match, "b").health).toBe(100);
  });
});

describe("aiming", () => {
  it("names the player under the crosshair, and nobody when looking away", () => {
    const match = two();
    applyInput(match, "a", input(aim([0, EYE, 0], [0, 1.0, -10])));
    expect(aimedAt(match, "a")).toBe("b");
    applyInput(match, "a", input({ yaw: 1 }));
    expect(aimedAt(match, "a")).toBe(null);
  });
});

describe("prediction", () => {
  it("replays unconfirmed inputs on top of the server state", () => {
    const server = two(), client = two();
    const inputs = Array.from({ length: 15 }, (_, i) => input({ moveZ: 1, jump: i === 3 }));
    for (const step of inputs) applyInput(client, "a", step); // the client predicts all 15
    for (const step of inputs.slice(0, 10)) applyInput(server, "a", step); // the server has seen 10
    const predicted = player(client, "a").pos;
    reconcile(client, "a", privateState(server, "a")!, inputs.slice(10));
    expect(player(client, "a").pos).toEqual(predicted);
  });

  it("follows the server when the server disagrees", () => {
    const server = two(), client = two();
    server.players.get("a")!.pos = [3, 0, 3]; // the server moved the player
    const pending = [input({ moveZ: 1 }), input({ moveZ: 1 })];
    reconcile(client, "a", privateState(server, "a")!, pending);
    const { pos } = player(client, "a");
    expect(pos[0]).toBe(3);
    expect(pos[2]).toBeCloseTo(3 - 2 * 6 * STEP, 6);
  });

  it("copies other players from a server snapshot", () => {
    const server = two(), client = createMatch(flatMap([], SPAWNS));
    join(client, { id: "a", name: "A", colour: 0 });
    applyInput(server, "b", input({ yaw: Math.PI, crouch: true }));
    mirror(client, snapshot(server), "a");
    expect(player(client, "b")).toMatchObject({ pos: [0, 0, -10], crouched: true, colour: 1, name: "B" });
    applyInput(client, "a", input(aim([0, EYE, 0], [0, 0.6, -10])));
    expect(aimedAt(client, "a")).toBe("b");
  });
});

describe("saving a room", () => {
  it("restores the scores and the time left after a restart", () => {
    const before = two();
    before.players.get("a")!.kills = 5;
    before.players.get("b")!.deaths = 5;
    for (let i = 0; i < 100; i++) advance(before, 1);
    const saved = JSON.parse(JSON.stringify(save(before)));

    const after = createMatch(flatMap([], SPAWNS));
    restore(after, saved);
    expect(snapshot(after).endsAt - snapshot(after).time).toBeCloseTo(1800 - 102, 5);
    expect(player(after, "a")).toMatchObject({ kills: 5, left: true, name: "A", colour: 0 });
    // a player who reconnects continues their score
    expect(join(after, { id: "a", name: "A", colour: 0 })).toEqual({ ok: true });
    expect(player(after, "a")).toMatchObject({ kills: 5, left: false, alive: true });
  });
});

describe("names", () => {
  it("makes two-word names that fit the name limit", () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      for (const name of [randomName(random), roomName(random)]) {
        expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
        expect(name.length).toBeLessThanOrEqual(16);
      }
    }
  });
});

describe("pistol skin across servers and restarts", () => {
  it("gives every other player the first skin when the server does not know skins", () => {
    const server = createMatch(flatMap()), client = createMatch(flatMap());
    join(server, { id: "a", name: "a", colour: 0 });
    join(server, { id: "b", name: "b", colour: 1, skin: 4 });
    join(client, { id: "a", name: "a", colour: 0 });
    const old = snapshot(server);
    for (const view of old.players) delete (view as { skin?: number }).skin;
    mirror(client, old, "a");
    expect(snapshot(client).players.find((view) => view.id === "b")!.skin).toBe(0);
  });

  it("keeps the skin across a room restart", () => {
    const before = createMatch(flatMap()), after = createMatch(flatMap());
    join(before, { id: "a", name: "a", colour: 0, skin: 2 });
    restore(after, save(before));
    expect(snapshot(after).players[0].skin).toBe(2);
  });
});
