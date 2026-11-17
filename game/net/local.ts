import { advance, aimedAt, applyInput, createMatch, drainEvents, join, snapshot, STEP } from "../sim";
import type { GameEvent, GameMap, Snapshot } from "../sim";
import type { MatchConnection } from "./connection";

/** Run a match in this tab, for one player. When the match ends or removes the player, a new one starts. */
export function connectLocal(map: GameMap, who: { id: string; name: string; colour: number }): MatchConnection {
  let match = createMatch(map);
  join(match, who);
  let listener: (snapshot: Snapshot, events: GameEvent[]) => void = () => {};
  return {
    playerId: who.id,
    send(input) {
      applyInput(match, who.id, input);
      advance(match, STEP);
      const events = drainEvents(match);
      if (events.some((e) => e.type === "ended" || e.type === "idle")) { match = createMatch(map); join(match, who); }
      listener(snapshot(match), events);
    },
    // The first update gives the client its spawn position and direction before it sends any input.
    onUpdate(next) { listener = next; next(snapshot(match), []); },
    aimedAt: () => aimedAt(match, who.id),
    close() {},
  };
}
