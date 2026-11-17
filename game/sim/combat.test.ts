import { describe, expect, it } from "vitest";
import { advance, applyInput, createMatch, drainEvents, join, snapshot, STEP } from "./index";
import { aim, box, flatMap, input } from "./testing";
import type { GameMap, Match, PlayerInput, Solid } from "./types";

// "a" stands at the origin and looks toward -z. "b" joins at the spawn farthest from "a", 10 m in front.
const SPAWNS: GameMap["spawns"] = [{ pos: [0, 0, 0], yaw: 0 }, { pos: [0, 0, -10], yaw: Math.PI }, { pos: [6, 0, -2], yaw: 0 }];
const EYE = 1.65; // standing eye height
const CHEST = aim([0, EYE, 0], [0, 1.0, -10]);
const HEAD = aim([0, EYE, 0], [0, 1.58, -10]);

const wait = (match: Match, seconds: number) => { for (let i = 0; i < Math.round(seconds / STEP); i++) advance(match, STEP); };
const start = (solids: Solid[] = []) => {
  const match = createMatch(flatMap(solids, SPAWNS));
  join(match, { id: "a", name: "A", colour: 0 });
  join(match, { id: "b", name: "B", colour: 1 });
  wait(match, 2); // spawn protection is over
  drainEvents(match);
  return match;
};
const player = (match: Match, id: string) => snapshot(match).players.find((p) => p.id === id)!;
/** Press and release fire once, then let the fire interval pass. */
const shoot = (match: Match, id: string, over: Partial<PlayerInput>) => {
  applyInput(match, id, input({ ...over, fire: true }));
  applyInput(match, id, input(over));
  wait(match, 0.25);
};

describe("shooting", () => {
  it("does 34 damage to the body", () => {
    const match = start();
    shoot(match, "a", CHEST);
    expect(player(match, "b").health).toBe(66);
    expect(drainEvents(match)).toContainEqual(expect.objectContaining({ type: "shot", by: "a", hit: "body", target: "b" }));
  });

  it("kills with three body shots and counts the kill", () => {
    const match = start();
    shoot(match, "a", CHEST); shoot(match, "a", CHEST);
    expect(player(match, "b").alive).toBe(true);
    shoot(match, "a", CHEST);
    expect(player(match, "b").alive).toBe(false);
    expect(player(match, "a").kills).toBe(1);
    expect(player(match, "b").deaths).toBe(1);
    expect(drainEvents(match)).toContainEqual({ type: "kill", by: "a", target: "b", head: false });
  });

  it("kills with one headshot", () => {
    const match = start();
    shoot(match, "a", HEAD);
    expect(player(match, "b").alive).toBe(false);
    expect(drainEvents(match)).toContainEqual({ type: "kill", by: "a", target: "b", head: true });
  });

  it("misses when the aim is off the target", () => {
    const match = start();
    shoot(match, "a", aim([0, EYE, 0], [2, 1, -10]));
    expect(player(match, "b").health).toBe(100);
  });

  it("is blocked by a wall and reports where the bullet hole goes", () => {
    const match = start([box(0, -5, 4, 0.4, 3)]);
    shoot(match, "a", CHEST);
    expect(player(match, "b").health).toBe(100);
    const shot = drainEvents(match).find((e) => e.type === "shot");
    expect(shot).toMatchObject({ hit: "wall", normal: [0, 0, 1] });
    expect(shot && shot.type === "shot" && shot.to[2]).toBeCloseTo(-4.8, 5);
  });

  it("hits a standing player over a low wall but not a crouching one", () => {
    const lowWall = box(0, -8, 4, 0.4, 1.2);
    const standing = start([lowWall]);
    shoot(standing, "a", HEAD);
    expect(player(standing, "b").alive).toBe(false);

    const crouching = start([lowWall]);
    applyInput(crouching, "b", input({ yaw: Math.PI, crouch: true }));
    shoot(crouching, "a", HEAD); // passes over the crouched player
    shoot(crouching, "a", aim([0, EYE, 0], [0, 0.88, -10])); // aimed at the crouched head, hits the wall
    expect(player(crouching, "b").health).toBe(100);
  });
});

describe("the pistol", () => {
  it("fires one shot for each click, even when the button is held", () => {
    const match = start();
    for (let i = 0; i < 60; i++) { applyInput(match, "a", input({ fire: true })); advance(match, STEP); }
    expect(player(match, "a").ammo).toBe(11);
  });

  it("fires at most 5 shots per second", () => {
    const match = start();
    for (let i = 0; i < 60; i++) { applyInput(match, "a", input({ fire: i % 2 === 0 })); advance(match, STEP); }
    expect(player(match, "a").ammo).toBe(7);
  });

  it("holds 12 rounds, clicks when empty, and reloads in 1.5 seconds", () => {
    const match = start();
    for (let i = 0; i < 12; i++) shoot(match, "a", {});
    expect(player(match, "a").ammo).toBe(0);
    drainEvents(match);
    shoot(match, "a", {});
    expect(drainEvents(match)).toEqual([{ type: "empty", by: "a" }]);

    applyInput(match, "a", input({ reload: true }));
    expect(player(match, "a").reloading).toBe(true);
    wait(match, 1.2);
    shoot(match, "a", {}); // cannot fire while reloading; 1.45 s have passed after this
    expect(player(match, "a").ammo).toBe(0);
    wait(match, 0.1);
    expect(player(match, "a").ammo).toBe(12);
    expect(player(match, "a").reloading).toBe(false);
  });
});

describe("health", () => {
  it("regenerates 20 per second after 5 seconds without damage", () => {
    const match = start();
    shoot(match, "a", CHEST);
    wait(match, 4.5); // 4.75 s since the hit
    expect(player(match, "b").health).toBe(66);
    wait(match, 1.25); // 1 s of regeneration
    expect(player(match, "b").health).toBeCloseTo(86, 0);
    wait(match, 5);
    expect(player(match, "b").health).toBe(100);
  });

  it("respawns after 2 seconds at the spawn point farthest from other players", () => {
    const match = start();
    shoot(match, "a", HEAD);
    // "a" runs 9 m forward, so the third spawn is now the farthest from "a".
    for (let i = 0; i < 90; i++) { applyInput(match, "a", input({ moveZ: 1 })); advance(match, STEP); }
    expect(player(match, "b").alive).toBe(false); // 1.75 s since the kill
    wait(match, 0.5);
    const b = player(match, "b");
    expect(b).toMatchObject({ alive: true, health: 100, ammo: 12, pos: [6, 0, -2] });
  });

  it("protects a respawned player for 1.5 seconds", () => {
    const match = start();
    shoot(match, "a", HEAD);
    wait(match, 1.8); // respawned in the same place a moment ago
    expect(player(match, "b").protected).toBe(true);
    shoot(match, "a", CHEST);
    expect(player(match, "b").health).toBe(100);
    wait(match, 1.5);
    shoot(match, "a", CHEST);
    expect(player(match, "b").health).toBe(66);
  });

  it("ends spawn protection when the protected player fires", () => {
    const match = start();
    shoot(match, "a", HEAD);
    wait(match, 1.8);
    shoot(match, "b", {});
    shoot(match, "a", CHEST);
    expect(player(match, "b").health).toBe(66);
  });

  it("lets a dead player neither move nor shoot", () => {
    const match = start();
    shoot(match, "a", HEAD);
    const before = player(match, "b");
    applyInput(match, "b", input({ moveZ: 1, fire: true }));
    expect(player(match, "b").pos).toEqual(before.pos);
    expect(player(match, "b").ammo).toBe(12);
  });
});
