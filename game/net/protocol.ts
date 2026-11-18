import type { GameEvent, JoinResult, PlayerInput, PrivateState, Snapshot } from "../sim";

export type ClientMessage =
  | { t: "join"; id: string; name: string; colour: number; skin?: number }
  /** A batch of inputs, one for each fixed step. `seq` numbers the last one. */
  | { t: "in"; seq: number; inputs: PlayerInput[] }
  /** `at` is the client's own clock. The room sends it back, and the client measures the round trip. */
  | { t: "ping"; at: number }
  | { t: "leave" };

export type ServerMessage =
  | { t: "joined"; id: string }
  | { t: "refused"; reason: Extract<JoinResult, { ok: false }>["reason"] | "no-room" }
  | { t: "pong"; at: number }
  /** `ack` is the last input the room applied for this client. `me` is that client's own state after it. */
  | { t: "snap"; snap: Snapshot; events: GameEvent[]; ack: number; me?: PrivateState };

/** One row of the room list. `endsAt` is a wall-clock time in milliseconds, or null before the first join. */
export type RoomInfo = { code: string; name: string; players: number; colours: number[]; endsAt: number | null };

export const MAX_ROOMS = 4;
/** Inputs sent in one message. Three steps make 20 messages per second. */
export const BATCH = 3;
