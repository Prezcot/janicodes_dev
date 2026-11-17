import { describe, expect, it } from "vitest";
import { applyInput, createMatch, join, snapshot, STEP } from "./index";
import { box, flatMap, input } from "./testing";
import type { GameMap, Match, PlayerInput } from "./types";

const start = (map: GameMap) => {
  const match = createMatch(map);
  join(match, { id: "a", name: "A", colour: 0 });
  return match;
};
const me = (match: Match) => snapshot(match).players[0];
/** Apply the same input for a number of seconds. */
const hold = (match: Match, seconds: number, over: Partial<PlayerInput>) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) applyInput(match, "a", input(over));
};

describe("movement", () => {
  it("runs forward at 6 metres per second", () => {
    const match = start(flatMap());
    hold(match, 2, { moveZ: 1 });
    expect(me(match).pos[2]).toBeCloseTo(-12, 1);
    expect(me(match).pos[0]).toBeCloseTo(0, 5);
  });

  it("does not run faster on a diagonal", () => {
    const match = start(flatMap());
    hold(match, 1, { moveZ: 1, moveX: 1 });
    const { pos } = me(match);
    expect(Math.hypot(pos[0], pos[2])).toBeCloseTo(6, 1);
  });

  it("moves at half speed while crouched", () => {
    const match = start(flatMap());
    hold(match, 2, { moveZ: 1, crouch: true });
    expect(me(match).pos[2]).toBeCloseTo(-6, 1);
    expect(me(match).crouched).toBe(true);
  });

  it("is stopped by a wall", () => {
    const match = start(flatMap([box(0, -5, 10, 1, 3)]));
    hold(match, 3, { moveZ: 1 });
    // wall face at z = -4.5, player radius 0.35
    expect(me(match).pos[2]).toBeCloseTo(-4.15, 2);
  });

  it("slides along a wall it hits at an angle", () => {
    const match = start(flatMap([box(0, -5, 40, 1, 3)]));
    hold(match, 3, { moveZ: 1, moveX: 1 });
    expect(me(match).pos[2]).toBeCloseTo(-4.15, 2);
    expect(me(match).pos[0]).toBeGreaterThan(8);
  });
});

describe("jumping and heights", () => {
  it("jumps 1.25 metres high and lands again", () => {
    const match = start(flatMap());
    applyInput(match, "a", input({ jump: true }));
    let peak = 0;
    for (let i = 0; i < 120; i++) { applyInput(match, "a", input()); peak = Math.max(peak, me(match).pos[1]); }
    expect(peak).toBeGreaterThan(1.2);
    expect(peak).toBeLessThan(1.3);
    expect(me(match).pos[1]).toBe(0);
  });

  it("does not bunny hop while jump is held", () => {
    const match = start(flatMap());
    hold(match, 0.9, { jump: true }); // one jump lasts about 0.67 s
    hold(match, 0.5, { jump: true });
    expect(me(match).pos[1]).toBe(0);
  });

  it("cannot walk onto a 1.2 metre crate", () => {
    const match = start(flatMap([box(0, -4, 1.2, 1.2, 1.2)]));
    hold(match, 2, { moveZ: 1 });
    expect(me(match).pos[1]).toBe(0);
    expect(me(match).pos[2]).toBeCloseTo(-3.05, 2);
  });

  it("can jump onto a 1.2 metre crate", () => {
    const match = start(flatMap([box(0, -3, 1.2, 1.2, 1.2)]));
    hold(match, 0.25, { moveZ: 1 });
    applyInput(match, "a", input({ moveZ: 1, jump: true }));
    hold(match, 0.45, { moveZ: 1 });
    hold(match, 0.5, {});
    expect(me(match).pos[1]).toBeCloseTo(1.2, 5);
  });

  it("cannot jump straight onto a 1.4 metre deck", () => {
    const match = start(flatMap([box(0, -10, 20, 14, 1.4)]));
    hold(match, 0.2, { moveZ: 1 });
    applyInput(match, "a", input({ moveZ: 1, jump: true }));
    hold(match, 1.5, { moveZ: 1 });
    expect(me(match).pos[1]).toBe(0);
  });

  it("walks up a ramp onto the deck and back down without leaving the ground", () => {
    const deck = box(0, -15, 20, 10, 1.4);
    const ramp = { ...box(0, -7.5, 4, 5, 1.4), ramp: { axis: 2 as const, dir: -1 as const } }; // rises toward -z
    const match = start(flatMap([deck, ramp]));
    hold(match, 2.5, { moveZ: 1 });
    expect(me(match).pos[1]).toBeCloseTo(1.4, 5);
    let airborne = 0;
    for (let i = 0; i < 120; i++) { applyInput(match, "a", input({ moveZ: -1 })); if (!me(match).onGround) airborne++; }
    expect(airborne).toBe(0);
    expect(me(match).pos[1]).toBe(0);
  });

  it("falls off a ledge", () => {
    const match = createMatch(flatMap([box(0, 0, 4, 4, 1.4)], [{ pos: [0, 1.4, 0], yaw: 0 }]));
    join(match, { id: "a", name: "A", colour: 0 });
    expect(me(match).pos[1]).toBe(1.4);
    hold(match, 1.5, { moveZ: 1 });
    expect(me(match).pos[1]).toBe(0);
  });
});
