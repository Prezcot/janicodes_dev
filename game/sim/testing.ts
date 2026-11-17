// Test helpers: a flat test map and an input builder. Not used by the game.
import type { GameMap, PlayerInput, Solid } from "./types";

export const box = (x: number, z: number, w: number, d: number, h: number, y0 = 0): Solid =>
  ({ min: [x - w / 2, y0, z - d / 2], max: [x + w / 2, y0 + h, z + d / 2], kind: "tall" });

/** A flat 60 by 60 m floor with the given solids. Spawn 0 is at the origin and faces -z. */
export const flatMap = (solids: Solid[] = [], spawns: GameMap["spawns"] = [{ pos: [0, 0, 0], yaw: 0 }]): GameMap =>
  ({ size: [60, 60], solids, spawns });

export const input = (over: Partial<PlayerInput> = {}): PlayerInput =>
  ({ moveX: 0, moveZ: 0, yaw: 0, pitch: 0, jump: false, crouch: false, fire: false, reload: false, ...over });

/** Yaw and pitch that point from an eye position at a target point. */
export const aim = (from: [number, number, number], to: [number, number, number]) => {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};
