import type { GameMap, Solid, Vec3 } from "./types";

const LOW = 1.2, TALL = 3.2, DECK = 1.4;
const box = (kind: Solid["kind"], x: number, z: number, w: number, d: number, h: number, y0 = 0): Solid =>
  ({ kind, min: [x - w / 2, y0, z - d / 2], max: [x + w / 2, y0 + h, z + d / 2] });
const crate = (x: number, z: number, y0 = 0) => box("crate", x, z, 1.2, 1.2, 1.2, y0);
/** Two low walls that meet at a corner and reach toward sx and sz. */
const corner = (x: number, z: number, sx: number, sz: number, len = 5): Solid[] =>
  [box("low", x + (sx * len) / 2, z, len, 0.4, LOW), box("low", x, z + (sz * len) / 2, 0.4, len, LOW)];
const spawn = (x: number, z: number, y = 0): { pos: Vec3; yaw: number } => ({ pos: [x, y, z], yaw: Math.atan2(x, z) }); // faces the centre

const W = 34, D = 28;

/** Split level: a lower yard on the -x side and a 1.4 m upper deck on the +x side. */
export const SPLIT_LEVEL: GameMap = {
  size: [W, D],
  solids: [
    // outer walls
    box("edge", 0, -D / 2 - 0.5, W + 2, 1, TALL), box("edge", 0, D / 2 + 0.5, W + 2, 1, TALL),
    box("edge", -W / 2 - 0.5, 0, 1, D, TALL), box("edge", W / 2 + 0.5, 0, 1, D, TALL),
    // upper deck, the step crate, and the two ramps that rise toward +x
    box("deck", 10, 0, 14, D, DECK), box("deck", 2.2, 0, 1.6, 1.6, 0.7),
    { ...box("deck", 0.5, -10, 5, 4, DECK), ramp: { axis: 0, dir: 1 } }, { ...box("deck", 0.5, 10, 5, 4, DECK), ramp: { axis: 0, dir: 1 } },
    // cover on the deck
    box("low", 9, -5.5, 0.4, 5, LOW, DECK), box("low", 9, 5.5, 0.4, 5, LOW, DECK), crate(13, 0, DECK), crate(13.4, 1.3, DECK),
    box("tall", 14, -9.5, 1.2, 1.2, TALL, DECK), box("tall", 14, 9.5, 1.2, 1.2, TALL, DECK),
    // cover in the yard
    ...corner(-8, -5, 1, -1), ...corner(-8, 6, -1, 1),
    box("tall", -2.5, 3.5, 0.5, 6, TALL), box("tall", -12.5, 0, 0.5, 5, TALL),
    crate(-4, -10.5), crate(-5.3, -10.9), crate(-13.2, 9.5), crate(-3.5, 11.5),
  ],
  spawns: [
    spawn(-15.5, -12.5), spawn(-15.5, 12.5), spawn(-15.5, 0), spawn(-7, -12.5), spawn(-7, 12.5),
    spawn(15.5, -12.5, DECK), spawn(15.5, 12.5, DECK), spawn(15.5, 0, DECK),
  ],
};
