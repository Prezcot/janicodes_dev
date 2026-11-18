import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMatch, join, snapshot } from "../sim";
import { flatMap, input } from "../sim/testing";
import type { ClientMessage, ServerMessage } from "./protocol";
import { connectRoom } from "./remote";

/** A socket that the test drives by hand. */
class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.OPEN;
  sent: ClientMessage[] = [];
  onopen = () => {};
  onmessage: (event: { data: string }) => void = () => {};
  onclose = () => {};
  constructor() { FakeSocket.all.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() {}
  receive(message: ServerMessage) { this.onmessage({ data: JSON.stringify(message) }); }
}

const map = flatMap([], [{ pos: [0, 0, 0], yaw: 0 }]);
const who = { id: "a", name: "A", colour: 0, skin: 0 };

beforeEach(() => { vi.useFakeTimers(); FakeSocket.all = []; vi.stubGlobal("WebSocket", FakeSocket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("the ping of a room connection", () => {
  it("is the time until the room answers, and is unknown again when the connection drops", () => {
    const server = createMatch(map);
    join(server, who);
    const room = connectRoom({ ...who, url: "ws://room", map, onClosed: () => {} });
    const socket = FakeSocket.all[0];
    socket.onopen();
    socket.receive({ t: "joined", id: "a" });
    socket.receive({ t: "snap", snap: snapshot(server), events: [], ack: 0 });
    expect(room.ping()).toBe(null);

    room.send(input()); // the step after a spawn sends nothing
    room.send(input());
    const ping = socket.sent.find((m) => m.t === "ping");
    if (ping?.t !== "ping") throw new Error("no ping sent");
    vi.advanceTimersByTime(40);
    socket.receive({ t: "pong", at: ping.at });
    expect(room.ping()).toBeCloseTo(40, 0);

    socket.onclose();
    expect(room.ping()).toBe(null);
    room.close();
  });
});
