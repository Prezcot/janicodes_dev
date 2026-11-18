import { TUNING as T } from "./tuning";
import type { GameMap, Solid, Vec3 } from "./types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Height of a solid's top surface at a point inside its footprint. */
function topAt(s: Solid, x: number, z: number): number {
  if (!s.ramp) return s.max[1];
  const a = s.ramp.axis;
  let t = clamp(((a === 0 ? x : z) - s.min[a]) / (s.max[a] - s.min[a]), 0, 1);
  if (s.ramp.dir < 0) t = 1 - t;
  return s.min[1] + (s.max[1] - s.min[1]) * t;
}

/** Highest surface under a point that feet at `feetY` can stand on. The floor is at 0. */
export function groundAt(map: GameMap, x: number, z: number, feetY: number, step: number): number {
  let ground = 0;
  for (const s of map.solids) {
    if (x < s.min[0] || x > s.max[0] || z < s.min[2] || z > s.max[2]) continue;
    const top = topAt(s, x, z);
    if (top <= feetY + step && top > ground) ground = top;
  }
  return ground;
}

/** Push a standing circle out of every solid it cannot step onto. Changes pos in place. */
export function pushOut(map: GameMap, pos: Vec3, height: number, step: number): void {
  const r = T.radius, feet = pos[1];
  for (let pass = 0; pass < 2; pass++) {
    for (const s of map.solids) {
      if (s.min[1] >= feet + height) continue;
      const cx = clamp(pos[0], s.min[0], s.max[0]), cz = clamp(pos[2], s.min[2], s.max[2]);
      if (topAt(s, cx, cz) <= feet + step) continue;
      const dx = pos[0] - cx, dz = pos[2] - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), push = (r - d) / d;
        pos[0] += dx * push; pos[2] += dz * push;
      } else {
        const left = pos[0] - s.min[0], right = s.max[0] - pos[0], near = pos[2] - s.min[2], far = s.max[2] - pos[2];
        const m = Math.min(left, right, near, far);
        if (m === left) pos[0] = s.min[0] - r; else if (m === right) pos[0] = s.max[0] + r;
        else if (m === near) pos[2] = s.min[2] - r; else pos[2] = s.max[2] + r;
      }
    }
  }
}

export type RayHit = { t: number; normal: Vec3 };

/** First solid a ray hits within maxT. The floor at y = 0 counts as a solid. */
export function castRay(map: GameMap, o: Vec3, d: Vec3, maxT: number): RayHit | null {
  let best: RayHit | null = null;
  if (d[1] < -1e-9) {
    const t = -o[1] / d[1];
    if (t >= 0 && t < maxT) best = { t, normal: [0, 1, 0] };
  }
  for (const s of map.solids) {
    let t0 = 0, t1 = best ? best.t : maxT, normal: Vec3 = [0, 0, 0], miss = false;
    for (let a = 0; a < 3 && !miss; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < s.min[a] || o[a] > s.max[a]) miss = true; continue; }
      let near = (s.min[a] - o[a]) / d[a], far = (s.max[a] - o[a]) / d[a], sign = -1;
      if (near > far) { [near, far] = [far, near]; sign = 1; }
      if (near > t0) { t0 = near; normal = [0, 0, 0]; normal[a] = sign; }
      if (far < t1) t1 = far;
      if (t0 > t1) miss = true;
    }
    if (miss) continue;
    if (s.ramp) {
      // Inside the wedge means below the sloped top: f(p) = p.y - k * p[axis] - c <= 0.
      const a = s.ramp.axis, k = ((s.max[1] - s.min[1]) / (s.max[a] - s.min[a])) * s.ramp.dir;
      const c = s.min[1] - k * (s.ramp.dir > 0 ? s.min[a] : s.max[a]);
      const f0 = o[1] - k * o[a] - c, df = d[1] - k * d[a];
      if (Math.abs(df) < 1e-9) { if (f0 > 0) continue; }
      else {
        const tp = -f0 / df;
        if (df < 0) { if (tp > t0) { t0 = tp; const n = Math.hypot(k, 1); normal = [0, 1 / n, 0]; normal[a] = -k / n; } }
        else if (tp < t1) t1 = tp;
        if (t0 > t1) continue;
      }
    }
    if (t0 <= 0) continue; // the ray starts inside this solid
    best = { t: t0, normal };
  }
  return best;
}

/** Distance along a ray to a sphere, or -1. */
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2], q = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - q;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : -1;
}

/** Distance along a ray to an upright cylinder from y0 to y1, or -1. */
export function rayCylinder(o: Vec3, d: Vec3, x: number, z: number, y0: number, y1: number, r: number): number {
  const ox = o[0] - x, oz = o[2] - z, a = d[0] * d[0] + d[2] * d[2];
  let best = -1;
  if (a > 1e-9) {
    const b = ox * d[0] + oz * d[2], disc = b * b - a * (ox * ox + oz * oz - r * r);
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a, y = o[1] + d[1] * t;
      if (t >= 0 && y >= y0 && y <= y1) best = t;
    }
  }
  if (Math.abs(d[1]) > 1e-9) {
    const t = ((d[1] < 0 ? y1 : y0) - o[1]) / d[1]; // the cap that faces the ray
    const px = ox + d[0] * t, pz = oz + d[2] * t;
    if (t >= 0 && px * px + pz * pz <= r * r && (best < 0 || t < best)) best = t;
  }
  return best;
}
