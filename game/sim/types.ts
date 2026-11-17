export type Vec3 = [number, number, number];

/** An axis-aligned box. With `ramp`, it is a wedge whose top rises along one axis. */
export type Solid = {
  min: Vec3;
  max: Vec3;
  kind: "tall" | "low" | "crate" | "deck" | "edge";
  ramp?: { axis: 0 | 2; dir: 1 | -1 };
};
export type GameMap = { size: [number, number]; solids: Solid[]; spawns: { pos: Vec3; yaw: number }[] };

/** One fixed step of player input. Yaw 0 looks toward -z; positive pitch looks up. */
export type PlayerInput = {
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  crouch: boolean;
  fire: boolean;
  reload: boolean;
  /** Match time at which this player saw the others. The server rewinds them to it for a shot. */
  view?: number;
};

export type Player = {
  id: string;
  name: string;
  colour: number;
  /** Which pistol look the player chose. 0 is the first one. */
  skin: number;
  pos: Vec3; // feet
  vel: Vec3;
  yaw: number;
  pitch: number;
  crouched: boolean;
  onGround: boolean;
  jumpHeld: boolean;
  fireHeld: boolean;
  alive: boolean;
  health: number;
  ammo: number;
  reloadUntil: number; // 0 when not reloading
  nextFireAt: number;
  lastDamageAt: number;
  respawnAt: number;
  protectedUntil: number;
  lastActiveAt: number;
  lastInput: string;
  kills: number;
  deaths: number;
  left: boolean;
  leftAt: number;
  /** Recent positions, oldest first, for lag compensation. */
  trail: { time: number; pos: Vec3; crouched: boolean }[];
};

export type GameEvent =
  /** `echo` marks the server's result for a shot that the client already showed from its own prediction. */
  | { type: "shot"; by: string; from: Vec3; to: Vec3; hit: "none" | "wall" | "body" | "head"; target?: string; normal?: Vec3; echo?: boolean }
  | { type: "empty"; by: string }
  | { type: "reload"; by: string }
  | { type: "kill"; by: string; target: string; head: boolean }
  | { type: "respawn"; id: string }
  | { type: "idle"; id: string }
  | { type: "ended" };

export type Match = {
  map: GameMap;
  time: number;
  endsAt: number; // Infinity until the first join
  ended: boolean;
  players: Map<string, Player>;
  events: GameEvent[];
  joins: number;
};

export type PlayerView = Pick<Player, "id" | "name" | "colour" | "skin" | "pos" | "vel" | "yaw" | "pitch" | "crouched" | "onGround" | "alive" | "health" | "ammo" | "kills" | "deaths" | "left"> & {
  reloading: boolean;
  protected: boolean;
};
export type Snapshot = { time: number; endsAt: number; ended: boolean; players: PlayerView[] };

/** What a client needs to repair its own predicted movement. */
export type PrivateState = Pick<Player, "pos" | "vel" | "onGround" | "jumpHeld" | "crouched" | "alive" | "health" | "ammo">;
/** What a room saves so a restart keeps the scores and the time left. */
export type SavedRoom = { endsIn: number | null; players: Pick<Player, "id" | "name" | "colour" | "skin" | "kills" | "deaths">[] };

export type JoinResult = { ok: true } | { ok: false; reason: "full" | "ending" | "colour-taken" | "ended" };
