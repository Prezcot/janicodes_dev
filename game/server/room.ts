import type { ClientMessage, ServerMessage } from "../net/protocol";
import { activeCount, advance, applyInput, createMatch, drainEvents, join, leave, occupied, privateState, restore, save, snapshot, STEP, TUNING } from "../sim";
import type { GameMap, PlayerInput, SavedRoom } from "../sim";

export type RoomHooks = {
  send(client: string, message: ServerMessage): void;
  /** Close a client's connection. */
  close(client: string): void;
  /** The roster, a score, or the timer changed. The host saves the room and updates the room list. */
  changed(): void;
};

const FINAL_SECONDS = 15; // how long the final kill count shows
const MAX_BURST = 10; // inputs applied in one tick after a lag spike
const MAX_QUEUE = 30;
const MAX_BATCH = 12;

const number = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const clean = (raw: Partial<Record<keyof PlayerInput, unknown>>): PlayerInput => ({
  moveX: number(raw.moveX), moveZ: number(raw.moveZ), yaw: number(raw.yaw), pitch: number(raw.pitch),
  jump: raw.jump === true, crouch: raw.crouch === true, fire: raw.fire === true, reload: raw.reload === true,
  view: typeof raw.view === "number" && Number.isFinite(raw.view) ? raw.view : undefined,
});

/**
 * One game room, with no network or platform code. The host passes in messages and calls tick.
 * A client is one connection. A player can come back on a new connection.
 */
export function createRoom(map: GameMap, hooks: RoomHooks, saved?: SavedRoom) {
  const match = createMatch(map);
  if (saved) restore(match, saved);
  const clients = new Map<string, { player?: string; queue: { input: PlayerInput; seq: number }[]; ack: number; budget: number }>();
  let started = Boolean(saved), endedFor = 0;
  const clientOf = (player: string) => [...clients].find(([, c]) => c.player === player)?.[0];

  return {
    connect(client: string) {
      clients.set(client, { queue: [], ack: 0, budget: 0 });
    },

    receive(client: string, message: ClientMessage) {
      const c = clients.get(client);
      if (!c || !message || typeof message !== "object") return;
      if (message.t === "join" && !c.player) {
        const id = String(message.id).slice(0, 64), other = clientOf(id);
        if (other) { clients.delete(other); hooks.close(other); } // the same player opened a new connection
        const skin = number(message.skin);
        const result = join(match, { id, name: String(message.name), colour: Math.abs(Math.floor(number(message.colour))) % 8, skin: Number.isInteger(skin) && skin >= 0 && skin < TUNING.skins ? skin : 0 });
        if (!result.ok) { hooks.send(client, { t: "refused", reason: result.reason }); clients.delete(client); hooks.close(client); return; }
        c.player = id; started = true;
        hooks.send(client, { t: "joined", id });
        hooks.changed();
      } else if (message.t === "in" && c.player && Array.isArray(message.inputs)) {
        const inputs = message.inputs.slice(0, MAX_BATCH), seq = number(message.seq);
        inputs.forEach((raw, i) => { if (raw && typeof raw === "object") c.queue.push({ input: clean(raw), seq: seq - (inputs.length - 1 - i) }); });
        if (c.queue.length > MAX_QUEUE) c.queue.splice(0, c.queue.length - MAX_QUEUE);
      } else if (message.t === "leave" && c.player) {
        leave(match, c.player, true);
        c.player = undefined;
        hooks.changed();
      }
    },

    disconnect(client: string) {
      const c = clients.get(client);
      clients.delete(client);
      if (c?.player) { leave(match, c.player); hooks.changed(); }
    },

    /** Apply queued inputs, advance the clock, and send every client the new state. */
    tick(dt: number) {
      if (match.ended) endedFor += dt;
      for (const c of clients.values()) {
        if (!c.player) continue;
        // Each input is one fixed step, so a client gets only as many steps as real time allows.
        c.budget = Math.min(MAX_BURST, c.budget + dt / STEP);
        while (c.queue.length && c.budget >= 1) { const next = c.queue.shift()!; applyInput(match, c.player, next.input); c.ack = next.seq; c.budget -= 1; }
      }
      advance(match, dt);
      const events = drainEvents(match), snap = snapshot(match);
      for (const [client, c] of clients) if (c.player) hooks.send(client, { t: "snap", snap, events, ack: c.ack, me: privateState(match, c.player) });
      for (const e of events) {
        if (e.type !== "idle") continue;
        const client = clientOf(e.id);
        if (client) { clients.delete(client); hooks.close(client); }
      }
      if (events.some((e) => e.type === "kill" || e.type === "idle" || e.type === "ended")) hooks.changed();
    },

    /** True when the host must shut the room down. */
    get closed() {
      return (match.ended && endedFor >= FINAL_SECONDS) || (started && occupied(match) === 0);
    },
    clients: () => [...clients.keys()],
    /** For the room list: players in the room, colours in use or held, and seconds left (null before the first join). */
    info() {
      const held = [...match.players.values()].filter((p) => !p.left || match.time - p.leftAt < TUNING.reconnectGrace);
      return { players: activeCount(match), colours: held.map((p) => p.colour).sort((a, b) => a - b), endsIn: match.endsAt === Infinity ? null : Math.max(0, match.endsAt - match.time) };
    },
    save: () => save(match),
  };
}
