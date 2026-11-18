import type { GameEvent, PlayerInput, Snapshot } from "../sim";

/** How the client talks to a match. It does not know where the match runs. */
export type MatchConnection = {
  playerId: string;
  /** Send one fixed step of input. */
  send(input: PlayerInput): void;
  /** Called with the newest state and the events since the last call. The first call comes at once, with the state at join. */
  onUpdate(listener: (snapshot: Snapshot, events: GameEvent[]) => void): void;
  /** The player under this player's crosshair, or null. */
  aimedAt(): string | null;
  /** The time for a message to reach the server and come back, in milliseconds. Null when there is no server or no measurement yet. */
  ping(): number | null;
  /** Leave the match. */
  close(): void;
};
