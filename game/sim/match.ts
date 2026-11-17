import { castRay, groundAt, pushOut, rayCylinder, raySphere } from "./collide";
import { STEP, TUNING as T } from "./tuning";
import type { GameEvent, GameMap, JoinResult, Match, Player, PlayerInput, PrivateState, SavedRoom, Snapshot, Vec3 } from "./types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
// The half step of gravity makes the fixed-step jump peak at jumpHeight.
const JUMP_SPEED = Math.sqrt(2 * T.gravity * T.jumpHeight) + (T.gravity * STEP) / 2;
export const heightOf = (p: { crouched: boolean }) => (p.crouched ? T.crouchHeight : T.standHeight);

export function createMatch(map: GameMap): Match {
  return { map, time: 0, endsAt: Infinity, ended: false, players: new Map(), events: [], joins: 0 };
}

/** The spawn point farthest from every other living player. With nobody else, spawn points take turns. */
function pickSpawn(match: Match, p: Player) {
  const others = [...match.players.values()].filter((q) => q !== p && q.alive && !q.left);
  const spawns = match.map.spawns;
  if (!others.length) return spawns[match.joins++ % spawns.length];
  let best = spawns[0], bestDistance = -1;
  for (const s of spawns) {
    const nearest = Math.min(...others.map((q) => Math.hypot(q.pos[0] - s.pos[0], q.pos[2] - s.pos[2])));
    if (nearest > bestDistance) { best = s; bestDistance = nearest; }
  }
  return best;
}

const blank = (who: { id: string; name: string; colour: number }, now: number): Player => ({
  ...who, pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0, pitch: 0, crouched: false, onGround: true, jumpHeld: false, fireHeld: false,
  alive: true, health: T.maxHealth, ammo: T.magSize, reloadUntil: 0, nextFireAt: 0, lastDamageAt: 0, respawnAt: 0, protectedUntil: 0,
  lastActiveAt: now, lastInput: "", kills: 0, deaths: 0, left: false, leftAt: 0, trail: [],
});

function spawn(match: Match, p: Player) {
  const s = pickSpawn(match, p);
  p.trail = [];
  p.protectedUntil = match.time + T.spawnProtection;
  p.pos = [...s.pos]; p.vel = [0, 0, 0]; p.yaw = s.yaw; p.pitch = 0;
  p.crouched = false; p.onGround = true; p.alive = true;
  p.health = T.maxHealth; p.ammo = T.magSize; p.reloadUntil = 0; p.nextFireAt = 0;
}

/** Players in the room now. Players who left are not counted. */
export const activeCount = (match: Match) => [...match.players.values()].filter((p) => !p.left).length;

/**
 * Add a player, or bring back one who left. A returning player keeps their score.
 * A player who left keeps their slot and colour for the reconnect grace time.
 */
export function join(match: Match, who: { id: string; name: string; colour: number }): JoinResult {
  if (match.ended) return { ok: false, reason: "ended" };
  const now = match.time, back = match.players.get(who.id);
  if (back && !back.left) return { ok: true };
  if (match.endsAt - now <= T.joinCutoff) return { ok: false, reason: "ending" };
  const others = [...match.players.values()].filter((q) => q.id !== who.id);
  const holding = others.filter((q) => !q.left || now - q.leftAt < T.reconnectGrace);
  if (holding.length >= T.maxPlayers) return { ok: false, reason: "full" };
  if (holding.some((q) => q.colour === who.colour)) return { ok: false, reason: "colour-taken" };
  const base = who.name.trim().slice(0, T.nameLength) || "Player";
  let name = base;
  for (let n = 2; others.some((q) => q.name === name); n++) name = `${base} ${n}`;
  if (match.endsAt === Infinity) match.endsAt = now + T.roomSeconds;
  if (back) {
    Object.assign(back, { name, colour: who.colour, left: false, lastActiveAt: now });
    spawn(match, back);
    return { ok: true };
  }
  const p = blank({ ...who, name }, now);
  spawn(match, p);
  match.players.set(p.id, p);
  return { ok: true };
}

function move(map: GameMap, p: Player, input: PlayerInput) {
  p.yaw = input.yaw;
  p.pitch = clamp(input.pitch, -1.55, 1.55);
  p.crouched = input.crouch;
  let mx = clamp(input.moveX, -1, 1), mz = clamp(input.moveZ, -1, 1);
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const speed = p.crouched ? T.crouchSpeed : T.runSpeed, sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const wishX = (mx * cos - mz * sin) * speed, wishZ = (-mx * sin - mz * cos) * speed;
  if (p.onGround) {
    p.vel[0] = wishX; p.vel[2] = wishZ;
    if (input.jump && !p.jumpHeld) { p.vel[1] = JUMP_SPEED; p.onGround = false; }
  } else {
    const k = Math.min(1, T.airControl * STEP);
    p.vel[0] += (wishX - p.vel[0]) * k; p.vel[2] += (wishZ - p.vel[2]) * k;
  }
  p.jumpHeld = input.jump;
  p.vel[1] -= T.gravity * STEP;

  const step = p.onGround ? T.stepUp : T.airStepUp, before = p.pos[1];
  p.pos[0] += p.vel[0] * STEP; p.pos[2] += p.vel[2] * STEP;
  pushOut(map, p.pos, heightOf(p), step);
  p.pos[1] += p.vel[1] * STEP;
  const ground = groundAt(map, p.pos[0], p.pos[2], Math.max(before, p.pos[1]), step);
  if (p.pos[1] <= ground) { p.pos[1] = ground; p.vel[1] = 0; p.onGround = true; }
  else if (p.onGround && p.pos[1] - ground <= T.stepUp) { p.pos[1] = ground; p.vel[1] = 0; } // stay on ramps and small steps
  else p.onGround = false;
}

/**
 * Take a player out of the room. Their score stays for the final kill count.
 * A dropped player keeps their slot and colour for the reconnect grace time. With `release`, both are free at once.
 */
export function leave(match: Match, id: string, release = false): void {
  const p = match.players.get(id);
  if (!p || p.left) return;
  p.left = true; p.leftAt = release ? -Infinity : match.time; p.alive = false;
}

/** Slots in use: players in the room, plus dropped players who can still reconnect. */
export const occupied = (match: Match) =>
  [...match.players.values()].filter((p) => !p.left || match.time - p.leftAt < T.reconnectGrace).length;

/** Advance one player by one fixed step of input. */
export function applyInput(match: Match, id: string, input: PlayerInput): void {
  const p = match.players.get(id);
  if (!p || p.left || match.ended) return;
  const sig = `${input.moveX},${input.moveZ},${input.yaw},${input.pitch},${+input.jump}${+input.crouch}${+input.fire}${+input.reload}`;
  if (sig !== p.lastInput) { p.lastInput = sig; p.lastActiveAt = match.time; }
  if (!p.alive) return;
  move(match.map, p, input);
  const now = match.time;
  if (input.reload && p.reloadUntil === 0 && p.ammo < T.magSize) {
    p.reloadUntil = now + T.reloadTime;
    match.events.push({ type: "reload", by: id });
  }
  if (input.fire && !p.fireHeld && p.reloadUntil === 0 && now >= p.nextFireAt) {
    if (p.ammo === 0) match.events.push({ type: "empty", by: id });
    else { p.ammo--; p.nextFireAt = now + T.fireInterval; p.protectedUntil = 0; shoot(match, p, input.view); }
  }
  p.fireHeld = input.fire;
}

export const eyeOf = (p: { pos: Vec3; crouched: boolean }): Vec3 => [p.pos[0], p.pos[1] + heightOf(p) - T.eyeBelowTop, p.pos[2]];

const REWIND_LIMIT = 0.4, TRAIL_SECONDS = 0.5;

/** Where a player was at an earlier match time. */
function poseAt(q: Player, time: number): { pos: Vec3; crouched: boolean } {
  const trail = q.trail;
  if (!trail.length || time >= trail[trail.length - 1].time) return q;
  for (let i = trail.length - 2; i >= 0; i--) {
    const a = trail[i], b = trail[i + 1];
    if (time < a.time) continue;
    const k = (time - a.time) / (b.time - a.time);
    return { pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, a.pos[2] + (b.pos[2] - a.pos[2]) * k], crouched: a.crouched };
  }
  return trail[0];
}

/** Follow a player's line of sight to the first thing it meets. With a view time, other players are rewound to it. */
function trace(match: Match, p: Player, view?: number) {
  const o = eyeOf(p), cp = Math.cos(p.pitch);
  const d: Vec3 = [-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp];
  const wall = castRay(match.map, o, d, T.range);
  const seen = view === undefined ? undefined : clamp(view, match.time - REWIND_LIMIT, match.time);
  let t = wall ? wall.t : T.range, hit: "none" | "wall" | "body" | "head" = wall ? "wall" : "none", target: Player | undefined;
  for (const q of match.players.values()) {
    if (q === p || !q.alive || q.left) continue;
    const pose = seen === undefined ? q : poseAt(q, seen), top = pose.pos[1] + heightOf(pose);
    const head = raySphere(o, d, [pose.pos[0], top - T.headRadius, pose.pos[2]], T.headRadius);
    const body = rayCylinder(o, d, pose.pos[0], pose.pos[2], pose.pos[1], top - 2 * T.headRadius, T.radius);
    if (head >= 0 && head < t && (body < 0 || head <= body)) { t = head; hit = "head"; target = q; }
    else if (body >= 0 && body < t) { t = body; hit = "body"; target = q; }
  }
  return { o, d, t, hit, target, wall };
}

/** The player under this player's crosshair, or null. */
export function aimedAt(match: Match, id: string): string | null {
  const p = match.players.get(id);
  return (p && p.alive && trace(match, p).target?.id) || null;
}

function shoot(match: Match, p: Player, view?: number) {
  const found = trace(match, p, view), { o, d, t, wall } = found;
  let { hit, target } = found;
  if (target && match.time < target.protectedUntil) { hit = "none"; target = undefined; }
  const shot: GameEvent = { type: "shot", by: p.id, from: o, to: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], hit };
  if (hit === "wall" && wall) shot.normal = wall.normal;
  if (target) shot.target = target.id;
  match.events.push(shot);
  if (!target) return;
  target.health -= hit === "head" ? T.headDamage : T.bodyDamage;
  target.lastDamageAt = match.time;
  if (target.health > 0) return;
  target.health = 0; target.alive = false; target.deaths++; target.respawnAt = match.time + T.respawnTime;
  p.kills++;
  match.events.push({ type: "kill", by: p.id, target: target.id, head: hit === "head" });
}

/** Advance the match clock: reloads, regeneration, and respawns. */
export function advance(match: Match, dt: number): void {
  if (match.ended) return;
  match.time += dt;
  const now = match.time;
  for (const p of match.players.values()) {
    if (p.left) continue;
    if (now - p.lastActiveAt >= T.idleSeconds) { leave(match, p.id); match.events.push({ type: "idle", id: p.id }); continue; }
    if (p.reloadUntil > 0 && now >= p.reloadUntil) { p.ammo = T.magSize; p.reloadUntil = 0; }
    if (!p.alive) {
      if (now >= p.respawnAt) { spawn(match, p); match.events.push({ type: "respawn", id: p.id }); }
    } else {
      if (p.health < T.maxHealth && now - p.lastDamageAt >= T.regenDelay) p.health = Math.min(T.maxHealth, p.health + T.regenRate * dt);
      p.trail.push({ time: now, pos: [...p.pos], crouched: p.crouched });
      while (p.trail[0].time < now - TRAIL_SECONDS) p.trail.shift();
    }
  }
  if (now >= match.endsAt) { match.ended = true; match.events.push({ type: "ended" }); }
}

/** Take the events that happened since the last call. */
export function drainEvents(match: Match): GameEvent[] {
  const events = match.events;
  match.events = [];
  return events;
}

export function privateState(match: Match, id: string): PrivateState | undefined {
  const p = match.players.get(id);
  return p && { pos: [...p.pos], vel: [...p.vel], onGround: p.onGround, jumpHeld: p.jumpHeld, crouched: p.crouched, alive: p.alive, health: p.health, ammo: p.ammo };
}

/** Client prediction: take the server's state for a player, then replay the inputs the server has not confirmed. */
export function reconcile(match: Match, id: string, state: PrivateState, pending: PlayerInput[]): void {
  const p = match.players.get(id);
  if (!p) return;
  Object.assign(p, state, { pos: [...state.pos], vel: [...state.vel] });
  if (p.alive) for (const input of pending) move(match.map, p, input);
}

/** Client prediction: make every other player match a server snapshot. */
export function mirror(match: Match, snap: Snapshot, selfId: string): void {
  const seen = new Set([selfId]);
  for (const v of snap.players) {
    seen.add(v.id);
    if (v.id === selfId) continue;
    let p = match.players.get(v.id);
    if (!p) { p = blank(v, match.time); match.players.set(v.id, p); }
    Object.assign(p, { name: v.name, colour: v.colour, pos: [...v.pos], yaw: v.yaw, pitch: v.pitch, crouched: v.crouched, alive: v.alive, left: v.left, health: v.health, protectedUntil: v.protected ? Infinity : 0 });
  }
  for (const id of match.players.keys()) if (!seen.has(id)) match.players.delete(id);
}

export function save(match: Match): SavedRoom {
  return {
    endsIn: match.endsAt === Infinity ? null : match.endsAt - match.time,
    players: [...match.players.values()].map(({ id, name, colour, kills, deaths }) => ({ id, name, colour, kills, deaths })),
  };
}

/** Rebuild a room after a restart. Every player counts as having just left, so they can reconnect and continue. */
export function restore(match: Match, saved: SavedRoom): void {
  match.endsAt = saved.endsIn === null ? Infinity : match.time + saved.endsIn;
  for (const s of saved.players) {
    match.players.set(s.id, { ...blank(s, match.time), kills: s.kills, deaths: s.deaths, alive: false, left: true, leftAt: match.time });
  }
}

export function snapshot(match: Match): Snapshot {
  return {
    time: match.time, endsAt: match.endsAt, ended: match.ended,
    players: [...match.players.values()].map((p) => ({
      id: p.id, name: p.name, colour: p.colour, pos: [...p.pos], vel: [...p.vel], yaw: p.yaw, pitch: p.pitch, crouched: p.crouched, onGround: p.onGround,
      alive: p.alive, health: p.health, ammo: p.ammo, kills: p.kills, deaths: p.deaths, left: p.left,
      reloading: p.reloadUntil > 0, protected: match.time < p.protectedUntil,
    })),
  };
}
