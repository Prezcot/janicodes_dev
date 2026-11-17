import { DurableObject } from "cloudflare:workers";
import { MAX_ROOMS, type RoomInfo } from "../../game/net/protocol";
import { createRoom } from "../../game/server/room";
import { roomName, SPLIT_LEVEL, type SavedRoom } from "../../game/sim";

type Env = { ROOM: DurableObjectNamespace<GameRoom>; LOBBY: DurableObjectNamespace<Lobby> };

const TICK_MS = 1000 / 30;
const UNUSED_ROOM_MS = 60_000; // a created room that nobody joins is removed after this
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const lobbyOf = (env: Env) => env.LOBBY.get(env.LOBBY.idFromName("lobby"));

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (pathname === "/rooms" && request.method === "GET") return json(await lobbyOf(env).list());
    if (pathname === "/rooms" && request.method === "POST") {
      const room = await lobbyOf(env).create();
      return room ? json(room) : json({ error: "limit" }, 409);
    }
    const code = pathname.match(/^\/room\/([a-z0-9]{6})\/ws$/)?.[1];
    if (code) return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    return json({ error: "not found" }, 404);
  },
};
export default worker;

type Listed = Omit<RoomInfo, "code"> & { createdAt: number };

/** The room list. One object, named "lobby". */
export class Lobby extends DurableObject<Env> {
  rooms = new Map<string, Listed>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.rooms = new Map(Object.entries((await ctx.storage.get<Record<string, Listed>>("rooms")) ?? {}));
    });
  }

  private store() { void this.ctx.storage.put("rooms", Object.fromEntries(this.rooms)); }
  /** Drop rooms whose time is over, and rooms that were created but never joined. */
  private prune() {
    const now = Date.now();
    let changed = false;
    for (const [code, room] of this.rooms) {
      const over = room.endsAt !== null && room.endsAt < now, unused = room.endsAt === null && room.createdAt < now - UNUSED_ROOM_MS;
      if (over || unused) { this.rooms.delete(code); changed = true; }
    }
    if (changed) this.store();
  }

  list(): RoomInfo[] {
    this.prune();
    return [...this.rooms].map(([code, { name, players, colours, endsAt }]) => ({ code, name, players, colours, endsAt }));
  }

  create(): { code: string; name: string } | null {
    this.prune();
    if (this.rooms.size >= MAX_ROOMS) return null;
    const taken = new Set([...this.rooms.values()].map((room) => room.name));
    let name = roomName();
    while (taken.has(name)) name = roomName();
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => "abcdefghjkmnpqrstuvwxyz23456789"[byte % 31]).join("");
    this.rooms.set(code, { name, players: 0, colours: [], endsAt: null, createdAt: Date.now() });
    this.store();
    return { code, name };
  }

  has(code: string): boolean {
    this.prune();
    return this.rooms.has(code);
  }

  update(code: string, info: Pick<RoomInfo, "players" | "colours" | "endsAt">) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.set(code, { ...room, ...info });
    this.store();
  }

  remove(code: string) {
    if (this.rooms.delete(code)) this.store();
  }
}

type Saved = { code: string; room: SavedRoom; savedAt: number };

/** One game room. The game rules are in game/server/room.ts. This class adds sockets, a timer, and storage. */
export class GameRoom extends DurableObject<Env> {
  private room?: ReturnType<typeof createRoom>;
  private code = "";
  private timer?: ReturnType<typeof setInterval>;
  private lastTick = 0;
  private listed = "";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // After a restart, bring the room back with its scores and the time it has left.
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Saved>("room");
      if (!saved) return;
      if (saved.room.endsIn !== null) saved.room.endsIn -= (Date.now() - saved.savedAt) / 1000;
      this.code = saved.code;
      if (saved.room.endsIn !== null && saved.room.endsIn <= 0) await this.shutdown();
      else this.start(saved.room);
    });
  }

  private start(saved?: SavedRoom) {
    this.room = createRoom(SPLIT_LEVEL, {
      send: (client, message) => { for (const ws of this.ctx.getWebSockets(client)) try { ws.send(JSON.stringify(message)); } catch { /* the socket is closing */ } },
      close: (client) => { for (const ws of this.ctx.getWebSockets(client)) try { ws.close(1000, "closed by room"); } catch { /* already closed */ } },
      changed: () => this.report(),
    }, saved);
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Save the room, and tell the room list when the list would show something new. */
  private report() {
    if (!this.room) return;
    void this.ctx.storage.put<Saved>("room", { code: this.code, room: this.room.save(), savedAt: Date.now() });
    const { players, colours, endsIn } = this.room.info();
    const key = JSON.stringify([players, colours, endsIn === null]);
    if (key === this.listed) return;
    this.listed = key;
    this.ctx.waitUntil(lobbyOf(this.env).update(this.code, { players, colours, endsAt: endsIn === null ? null : Date.now() + endsIn * 1000 }));
  }

  private tick() {
    if (!this.room) return;
    const now = Date.now(), dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.room.tick(dt);
    if (this.room.closed) this.ctx.waitUntil(this.shutdown());
  }

  private async shutdown() {
    if (this.timer) clearInterval(this.timer);
    this.room = undefined;
    for (const ws of this.ctx.getWebSockets()) try { ws.close(1000, "room closed"); } catch { /* already closed */ }
    await this.ctx.storage.deleteAll();
    await lobbyOf(this.env).remove(this.code);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return json({ error: "expected a websocket" }, 426);
    if (!this.room) {
      // Rooms exist only through the room list, which enforces the room limit.
      const code = new URL(request.url).pathname.split("/")[2];
      if (!(await lobbyOf(this.env).has(code))) return json({ error: "no room" }, 404);
      this.code = code;
      this.start();
    }
    const [client, server] = Object.values(new WebSocketPair());
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment(id);
    this.room!.connect(id);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (!this.room) { ws.close(1000, "room closed"); return; }
    try { this.room.receive(ws.deserializeAttachment(), JSON.parse(data as string)); } catch { /* not a valid message */ }
    if (this.room.closed) this.ctx.waitUntil(this.shutdown());
  }

  webSocketClose(ws: WebSocket) {
    if (!this.room) return;
    this.room.disconnect(ws.deserializeAttachment());
    if (this.room.closed) this.ctx.waitUntil(this.shutdown());
  }
}
