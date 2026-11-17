import { describe, expect, it } from "vitest";
import type { ClientMessage, ServerMessage } from "../net/protocol";
import { STEP } from "../sim";
import { flatMap, input } from "../sim/testing";
import { createRoom } from "./room";

const TICK = 1 / 30;
const setup = () => {
  const sent: Record<string, ServerMessage[]> = {}, closed: string[] = [];
  let changes = 0;
  const room = createRoom(flatMap([], Array.from({ length: 8 }, (_, i) => ({ pos: [i * 6, 0, 0] as [number, number, number], yaw: 0 }))), {
    send: (client, message) => { (sent[client] ??= []).push(message); },
    close: (client) => { closed.push(client); },
    changed: () => { changes++; },
  });
  const enter = (client: string, colour: number, id = client) => { room.connect(client); room.receive(client, { t: "join", id, name: id, colour }); };
  const last = (client: string) => sent[client][sent[client].length - 1];
  const snap = (client: string) => { const m = last(client); if (m.t !== "snap") throw new Error("no snapshot"); return m; };
  const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds / TICK); i++) room.tick(TICK); };
  return { room, sent, closed, enter, last, snap, run, changes: () => changes };
};
const forward = (n: number, seq: number): ClientMessage => ({ t: "in", seq, inputs: Array.from({ length: n }, () => input({ moveZ: 1 })) });

describe("a room", () => {
  it("accepts a player and sends them a snapshot every tick", () => {
    const { room, sent, enter, snap } = setup();
    enter("c1", 0);
    expect(sent.c1[0]).toEqual({ t: "joined", id: "c1" });
    room.tick(TICK);
    expect(snap("c1").snap.players).toHaveLength(1);
    expect(snap("c1").me).toMatchObject({ alive: true, health: 100 });
  });

  it("refuses a taken colour and closes that connection", () => {
    const { sent, closed, enter } = setup();
    enter("c1", 2);
    enter("c2", 2);
    expect(sent.c2).toEqual([{ t: "refused", reason: "colour-taken" }]);
    expect(closed).toEqual(["c2"]);
  });

  it("applies inputs and confirms the last one it applied", () => {
    const { room, enter, snap } = setup();
    enter("c1", 0);
    room.receive("c1", forward(2, 2));
    room.tick(TICK);
    expect(snap("c1").ack).toBe(2);
    expect(snap("c1").me!.pos[2]).toBeCloseTo(-2 * 6 * STEP, 6);
  });

  it("does not let a client move faster by sending extra inputs", () => {
    const { room, enter, snap, run } = setup();
    enter("c1", 0);
    for (let i = 1; i <= 20; i++) room.receive("c1", forward(12, i * 12)); // 4 seconds of inputs at once
    run(1);
    expect(-snap("c1").me!.pos[2]).toBeLessThan(6 * 1.2); // about 1 second of running
  });

  it("ignores inputs that are not well formed", () => {
    const { room, enter, snap } = setup();
    enter("c1", 0);
    room.receive("c1", { t: "in", seq: 1, inputs: [{ moveZ: "fast", yaw: NaN } as never] });
    room.receive("c1", { t: "in", seq: 2, inputs: "many" as never });
    room.tick(TICK);
    expect(snap("c1").me!.pos).toEqual([0, 0, 0]);
  });

  it("lets a second connection take over the same player", () => {
    const { closed, enter, room, snap } = setup();
    enter("tab1", 0, "same-player");
    enter("tab2", 0, "same-player");
    expect(closed).toEqual(["tab1"]);
    room.tick(TICK);
    expect(snap("tab2").snap.players).toHaveLength(1);
  });

  it("closes at once when the last player chooses to leave", () => {
    const { room, enter } = setup();
    enter("c1", 0);
    expect(room.closed).toBe(false);
    room.receive("c1", { t: "leave" });
    room.disconnect("c1");
    expect(room.closed).toBe(true);
  });

  it("waits 20 seconds for a dropped player before it closes", () => {
    const { room, enter, run } = setup();
    enter("c1", 0);
    room.disconnect("c1");
    run(19);
    expect(room.closed).toBe(false);
    run(1.1);
    expect(room.closed).toBe(true);
  });

  it("shows the final kill count for 15 seconds after the match ends, then closes", () => {
    const { room, enter, run, snap } = setup();
    enter("c1", 0);
    for (let i = 0; i < 1800; i++) { room.receive("c1", { t: "in", seq: i + 1, inputs: [input({ yaw: i })] }); room.tick(1); }
    expect(snap("c1").snap.ended).toBe(true);
    run(14);
    expect(room.closed).toBe(false);
    run(1.1);
    expect(room.closed).toBe(true);
  });

  it("reports changes to the roster so they can be saved and listed", () => {
    const { room, enter, changes } = setup();
    enter("c1", 0);
    enter("c2", 1);
    expect(changes()).toBe(2);
    room.disconnect("c2");
    expect(changes()).toBe(3);
    expect(room.info()).toEqual({ players: 1, colours: [0, 1], endsIn: 1800 });
  });

  it("keeps a valid pistol skin and uses the first skin for a bad or missing one", () => {
    const { room, snap } = setup();
    const enter = (client: string, colour: number, skin?: unknown) => { room.connect(client); room.receive(client, { t: "join", id: client, name: client, colour, skin } as ClientMessage); };
    enter("c1", 0, 4);
    enter("c2", 1, "steel");
    enter("c3", 2);
    enter("c4", 3, -2.5);
    room.tick(TICK);
    const skins = Object.fromEntries(snap("c1").snap.players.map((view) => [view.id, view.skin]));
    expect(skins).toEqual({ c1: 4, c2: 0, c3: 0, c4: 0 });
  });
});
