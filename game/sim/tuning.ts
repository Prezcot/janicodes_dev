/** Every number a player can feel. Change values here to tune the game. */
export const TUNING = {
  runSpeed: 6,
  crouchSpeed: 3,
  gravity: 22,
  jumpHeight: 1.25,
  airControl: 2, // how fast air velocity follows the keys, per second
  standHeight: 1.8,
  crouchHeight: 1.1,
  eyeBelowTop: 0.15,
  radius: 0.35,
  stepUp: 0.3, // highest ledge walked onto without a jump
  airStepUp: 0.05, // how far below a ledge the feet may be when landing on it
  headRadius: 0.22,
  maxHealth: 100,
  bodyDamage: 34,
  headDamage: 100,
  magSize: 12,
  reloadTime: 1.5,
  fireInterval: 0.2,
  range: 120,
  regenDelay: 5,
  regenRate: 20,
  respawnTime: 2,
  spawnProtection: 1.5,
  maxPlayers: 8,
  roomSeconds: 30 * 60,
  joinCutoff: 2 * 60,
  idleSeconds: 2 * 60,
  reconnectGrace: 20,
  nameLength: 16,
};

/** Movement runs in fixed steps of this many seconds, in the browser and on the server. */
export const STEP = 1 / 60;
