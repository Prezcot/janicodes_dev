import * as THREE from "three";
import { STEP, TUNING } from "../sim";
import type { GameEvent, GameMap, PlayerInput, PlayerView, Snapshot, Vec3 } from "../sim";
import type { MatchConnection } from "../net/connection";
import { createAudio } from "./audio";
import { theme } from "../../theme/theme";
import { buildFigure, buildViewModel, buildWorld, bulletHoleTexture } from "./world";

export type Score = Pick<PlayerView, "id" | "name" | "colour" | "kills" | "deaths" | "left">;
export type Hud = {
  locked: boolean;
  alive: boolean;
  health: number;
  ammo: number;
  reloading: boolean;
  secondsLeft: number;
  ended: boolean;
  showScores: boolean;
  scores: Score[];
  /** Name of the player under the crosshair. */
  aim: string;
  killedBy: string;
  feed: { key: number; killer: string; target: string; head: boolean }[];
  /** Counts hits on other players, so the crosshair can flash again for each one. */
  hits: number;
  headHit: boolean;
  /** Frames drawn per second, measured over the last second. Null until one second is counted. */
  fps: number | null;
  /** Milliseconds to the server and back. Null in practice, and before the first measurement. */
  ping: number | null;
};
export type Options = { sensitivity: number; volume: number };

const BASE_SENSITIVITY = 0.0022; // radians per pixel at sensitivity 1
const MAX_HOLES = 64, HOLE_SECONDS = 20, TRACER_SECONDS = 0.07, FEED_SECONDS = 5;
const HEARING = 15, STRIDE = 2.2; // metres
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Run the game on a canvas. */
export function startGame(canvas: HTMLCanvasElement, map: GameMap, conn: MatchConnection, colour: number, skin: number, options: Options, onHud: (hud: Hud) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.game.sky);
  scene.add(buildWorld(map));
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 200);
  camera.rotation.order = "YXZ";
  // The pistol is drawn in its own pass, so it never pokes through a wall.
  const viewScene = new THREE.Scene(), viewCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
  const gun = buildViewModel(theme.players[colour].colour, skin);
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.07, 7), new THREE.MeshBasicMaterial({ color: theme.game.flash }));
  flash.position.set(0, 0.04, -0.22);
  gun.add(flash);
  viewScene.add(gun);
  const audio = createAudio();
  audio.setVolume(options.volume);
  let sensitivity = options.sensitivity;

  const holeGeometry = new THREE.PlaneGeometry(0.22, 0.22);
  const holeMaterial = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const holes: { mesh: THREE.Mesh; until: number }[] = [];
  let nextHole = 0;
  const tracerMaterial = new THREE.LineBasicMaterial({ color: theme.game.edge, transparent: true, opacity: 0.55 });
  const tracers = Array.from({ length: 8 }, () => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), tracerMaterial);
    line.visible = false; line.frustumCulled = false;
    scene.add(line);
    return { line, until: 0 };
  });
  let nextTracer = 0;
  const figures = new Map<string, { figure: ReturnType<typeof buildFigure>; colour: number; skin: number; deadFor: number; walked: number }>();

  const keys = new Set<string>();
  // A tap shorter than one step still counts: taps hold a press until the next input is sent.
  const taps = new Set<string>();
  let fire = false, fireTap = false, locked = false, yaw = 0, pitch = 0;
  let latest: Snapshot | null = null, me: PlayerView | undefined;
  const before = new THREE.Vector3(), after = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, 1);
  let eye = TUNING.standHeight - TUNING.eyeBelowTop, kick = 0, reloadDip = 0, clock = 0, shownHud = "", frames = 0, framesAt = 0, fps: number | null = null;
  let feed: (Hud["feed"][number] & { until: number })[] = [], feedKey = 0, hits = 0, headHit = false, killedBy = "";

  const nameOf = (id: string) => latest?.players.find((p) => p.id === id)?.name ?? "?";
  const pushHud = () => {
    const aimed = me?.alive && locked ? conn.aimedAt() : null, ping = conn.ping();
    const hud: Hud = {
      locked, alive: me?.alive ?? true, health: Math.ceil(me?.health ?? TUNING.maxHealth), ammo: me?.ammo ?? TUNING.magSize,
      reloading: me?.reloading ?? false, secondsLeft: latest ? Math.max(0, Math.ceil(latest.endsAt - latest.time)) : 0,
      ended: latest?.ended ?? false, showScores: keys.has("Tab"),
      scores: (latest?.players ?? []).map(({ id, name, colour, kills, deaths, left }) => ({ id, name, colour, kills, deaths, left })),
      aim: aimed ? nameOf(aimed) : "", killedBy: me?.alive ? "" : killedBy,
      feed: feed.map(({ key, killer, target, head }) => ({ key, killer, target, head })), hits, headHit,
      fps, ping: ping === null ? null : Math.round(ping),
    };
    const key = JSON.stringify(hud);
    if (key !== shownHud) { shownHud = key; onHud(hud); }
  };

  /** Play a sound from a place in the world: quieter with distance, and panned left or right. */
  const playAt = (sound: Parameters<typeof audio.play>[0], at: Vec3, reach = 60) => {
    const dx = at[0] - camera.position.x, dz = at[2] - camera.position.z, distance = Math.hypot(dx, dz);
    if (distance > reach) return;
    const right = distance > 0.01 ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance : 0;
    audio.play(sound, right, 1 / (1 + distance / 8));
  };

  const placeHole = (at: Vec3, normal: Vec3) => {
    let hole = holes[nextHole];
    if (!hole) { hole = { mesh: new THREE.Mesh(holeGeometry, holeMaterial), until: 0 }; holes.push(hole); scene.add(hole.mesh); }
    nextHole = (nextHole + 1) % MAX_HOLES;
    hole.mesh.position.set(at[0] + normal[0] * 0.01, at[1] + normal[1] * 0.01, at[2] + normal[2] * 0.01);
    hole.mesh.quaternion.setFromUnitVectors(forward, new THREE.Vector3(...normal));
    hole.mesh.visible = true;
    hole.until = clock + HOLE_SECONDS;
  };
  const onShot = (shot: Extract<GameEvent, { type: "shot" }>) => {
    const mine = shot.by === conn.playerId;
    if (mine && shot.target) { hits++; headHit = shot.hit === "head"; audio.play(headHit ? "headshot" : "hit"); }
    if (shot.echo) return; // the tracer and the sound were shown when the shot was predicted
    if (mine) { kick = 1; audio.play("shot"); } else playAt("shot", shot.from);
    const from = mine ? new THREE.Vector3(0.2, -0.13, -0.7).applyMatrix4(camera.matrixWorld) : new THREE.Vector3(...shot.from);
    const tracer = tracers[nextTracer];
    nextTracer = (nextTracer + 1) % tracers.length;
    tracer.line.geometry.setFromPoints([from, new THREE.Vector3(...shot.to)]);
    tracer.line.visible = true;
    tracer.until = clock + TRACER_SECONDS;
    if (shot.hit === "wall" && shot.normal) placeHole(shot.to, shot.normal);
  };
  const onEvent = (e: GameEvent) => {
    if (e.type === "shot") onShot(e);
    else if (e.type === "empty" && e.by === conn.playerId) audio.play("empty");
    else if (e.type === "reload" && e.by === conn.playerId) audio.play("reload");
    else if (e.type === "kill") {
      feed.push({ key: ++feedKey, killer: nameOf(e.by), target: nameOf(e.target), head: e.head, until: clock + FEED_SECONDS });
      if (feed.length > 4) feed.shift();
      if (e.target === conn.playerId) { killedBy = nameOf(e.by); audio.play("death"); }
      else { const victim = latest?.players.find((p) => p.id === e.target); if (victim) playAt("death", victim.pos); }
    }
  };

  conn.onUpdate((snapshot, events) => {
    latest = snapshot;
    const player = snapshot.players.find((p) => p.id === conn.playerId);
    if (!player) return;
    before.copy(after);
    after.set(...player.pos);
    if (!me || events.some((e) => e.type === "respawn" && e.id === conn.playerId)) { before.copy(after); yaw = player.yaw; pitch = 0; }
    me = player;
    for (const e of events) onEvent(e);
    pushHud();
  });

  const input = (): PlayerInput => ({
    moveX: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    moveZ: (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
    yaw, pitch, jump: keys.has("Space") || taps.has("Space"), crouch: keys.has("ShiftLeft"), fire: fire || fireTap, reload: keys.has("KeyR") || taps.has("KeyR"),
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!locked) return;
    yaw -= e.movementX * BASE_SENSITIVITY * sensitivity;
    pitch = clamp(pitch - e.movementY * BASE_SENSITIVITY * sensitivity, -1.5, 1.5);
  };
  // Start or continue play from a click: sound may start, and the mouse is locked to the game.
  // A browser can refuse the lock shortly after Esc. The player then clicks again.
  const enter = () => {
    audio.unlock();
    if (!latest?.ended) (canvas.requestPointerLock() as Promise<void> | undefined)?.catch(() => {});
  };
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (locked) { audio.unlock(); fire = fireTap = true; } else enter();
  };
  const onMouseUp = (e: MouseEvent) => { if (e.button === 0) fire = false; };
  const onKeyDown = (e: KeyboardEvent) => { if (!locked) return; keys.add(e.code); taps.add(e.code); if (e.code === "Space" || e.code === "Tab") e.preventDefault(); };
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
  const onLockChange = () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) { keys.clear(); taps.clear(); fire = fireTap = false; }
    pushHud();
  };
  // A hidden tab or a minimized window is not a slow frame. The frame rate is blank until one new second is counted.
  const restartRate = () => { framesAt = 0; fps = null; };
  document.addEventListener("visibilitychange", restartRate);
  canvas.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("pointerlockchange", onLockChange);

  /** Move, pose, fold, and remove the figures of the other players. */
  const drawOthers = (dt: number) => {
    const present = new Set<string>();
    for (const p of latest?.players ?? []) {
      if (p.id === conn.playerId || p.left) continue;
      present.add(p.id);
      let entry = figures.get(p.id);
      if (!entry || entry.colour !== p.colour || entry.skin !== p.skin) {
        if (entry) scene.remove(entry.figure.root);
        entry = { figure: buildFigure(theme.players[p.colour].colour, p.skin), colour: p.colour, skin: p.skin, deadFor: 0, walked: 0 };
        figures.set(p.id, entry);
        scene.add(entry.figure.root);
      }
      const { figure } = entry;
      if (p.alive) {
        entry.deadFor = 0;
        figure.root.position.set(...p.pos);
        figure.root.rotation.y = p.yaw;
        figure.root.scale.y = 1;
        figure.root.visible = true;
        figure.pose(p.crouched);
        figure.opacity(p.protected ? 0.5 : 1);
        const speed = Math.hypot(p.vel[0], p.vel[2]);
        if (p.onGround && !p.crouched && speed > 1) {
          entry.walked += speed * dt;
          if (entry.walked >= STRIDE) { entry.walked = 0; playAt("step", p.pos, HEARING); }
        }
      } else {
        // The body folds flat, then fades.
        entry.deadFor += dt;
        figure.root.scale.y = Math.max(0.04, 1 - entry.deadFor / 0.35);
        figure.opacity(Math.max(0, 1 - entry.deadFor / TUNING.respawnTime));
        figure.root.visible = entry.deadFor < TUNING.respawnTime;
      }
    }
    for (const [id, entry] of figures) if (!present.has(id)) { scene.remove(entry.figure.root); figures.delete(id); }
  };

  let width = 0, height = 0;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = viewCamera.aspect = w / h;
    camera.updateProjectionMatrix(); viewCamera.updateProjectionMatrix();
  };

  let last = performance.now(), pending = 0, raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden || canvas.closest("[data-minimized]")) { restartRate(); return; }
    resize();
    clock += dt;
    pending += dt;
    while (pending >= STEP) { conn.send(input()); taps.clear(); fireTap = false; pending -= STEP; }
    if (feed.length && clock > feed[0].until) feed = feed.filter((entry) => clock <= entry.until);
    pushHud();
    if (!me) return;
    if (latest?.ended && locked) document.exitPointerLock();

    const eyeTarget = (me.crouched ? TUNING.crouchHeight : TUNING.standHeight) - TUNING.eyeBelowTop;
    eye += (eyeTarget - eye) * Math.min(1, dt * 14);
    camera.position.lerpVectors(before, after, pending / STEP);
    camera.position.y += me.alive ? eye : 0.3;
    kick = Math.max(0, kick - dt * 7);
    camera.rotation.set(pitch + kick * 0.02, yaw, 0);
    camera.updateMatrixWorld();

    reloadDip += ((me.reloading ? 1 : 0) - reloadDip) * Math.min(1, dt * 10);
    gun.position.set(0.2, -0.17 - reloadDip * 0.22, -0.42 + kick * 0.05);
    gun.rotation.x = kick * 0.25 - reloadDip * 0.6;
    gun.visible = me.alive;
    flash.visible = kick > 0.7;
    flash.rotation.z = clock * 40;
    drawOthers(dt);
    for (const hole of holes) if (hole.mesh.visible && clock > hole.until) hole.mesh.visible = false;
    for (const tracer of tracers) if (tracer.line.visible && clock > tracer.until) tracer.line.visible = false;

    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(viewScene, viewCamera);

    if (!framesAt) { framesAt = now; frames = 0; return; }
    frames++;
    if (now - framesAt >= 1000) { fps = Math.round(frames * 1000 / (now - framesAt)); frames = 0; framesAt = now; }
  };
  raf = requestAnimationFrame(frame);

  return {
    enter,
    setOptions(next: Options) { sensitivity = next.sensitivity; audio.setVolume(next.volume); },
    /** Stop the game and free its resources. */
    stop() {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", restartRate);
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      audio.close();
      renderer.dispose();
    },
  };
}
