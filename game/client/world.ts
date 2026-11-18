import * as THREE from "three";
import type { GameMap, Solid } from "../sim";
import { alpha, theme } from "../../theme/theme";
import { gripFaces, pistolLook, slideFaces } from "./skins";

const C = theme.game;
const TILE = 2; // metres covered by one texture tile

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
const grid = (base: string, ink: string) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(0, 0, s, s);
};
const hatch = (base: string, ink: string) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  g.strokeStyle = ink; g.lineWidth = 3;
  for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
};

/** A box whose texture repeats once every TILE metres on every face. */
function worldBox(w: number, h: number, d: number) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  const scale = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, (uv.getX(k) * scale[f][0]) / TILE, (uv.getY(k) * scale[f][1]) / TILE);
  }
  return geo;
}

/** A solid wedge for a ramp, in world coordinates. */
function wedge(s: Solid) {
  const { axis, dir } = s.ramp!, other = axis === 0 ? 2 : 0;
  const low = dir > 0 ? s.min[axis] : s.max[axis], high = dir > 0 ? s.max[axis] : s.min[axis];
  const point = (u: number, y: number, v: number) => (axis === 0 ? [u, y, v] : [v, y, u]);
  const [y0, y1, v0, v1] = [s.min[1], s.max[1], s.min[other], s.max[other]];
  const A = point(low, y0, v0), B = point(low, y0, v1), C = point(high, y0, v0), D = point(high, y0, v1), E = point(high, y1, v0), F = point(high, y1, v1);
  const triangles = [A, B, F, A, F, E, C, E, F, C, F, D, A, E, C, B, D, F];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(triangles.flat(), 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(triangles.flatMap((p) => [p[0] / TILE, p[2] / TILE]), 2));
  geo.computeVertexNormals();
  return geo;
}

/** Build the static map in the Workbench paper style. */
export function buildWorld(map: GameMap) {
  const world = new THREE.Group();
  const lambert = (texture: THREE.Texture) => new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide });
  const materials: Record<Solid["kind"] | "floor", THREE.Material> = {
    floor: lambert(canvasTexture(128, grid(C.floor, alpha(C.gridLine, 0.35)))),
    tall: lambert(canvasTexture(128, grid(C.wall, alpha(C.gridLine, 0.25)))),
    edge: lambert(canvasTexture(128, grid(C.boundary, alpha(C.gridLine, 0.25)))),
    deck: lambert(canvasTexture(128, grid(C.deck, alpha(C.gridLine, 0.35)))),
    low: lambert(canvasTexture(128, hatch(C.low, alpha(C.gridLine, 0.5)))),
    crate: lambert(canvasTexture(128, hatch(C.crate, C.crateLine))),
  };
  const ink = new THREE.LineBasicMaterial({ color: C.edge });
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), ink));
    world.add(mesh);
  };
  add(worldBox(map.size[0], 0.2, map.size[1]), materials.floor, 0, -0.1, 0);
  for (const s of map.solids) {
    if (s.ramp) { add(wedge(s), materials.deck); continue; }
    const [w, h, d] = [s.max[0] - s.min[0], s.max[1] - s.min[1], s.max[2] - s.min[2]];
    const geo = s.kind === "crate" ? new THREE.BoxGeometry(w, h, d) : worldBox(w, h, d);
    add(geo, materials[s.kind], (s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2);
  }
  world.add(new THREE.HemisphereLight(C.light.sky, C.light.ground, 2.3));
  const sun = new THREE.DirectionalLight(C.light.sun, 1.4);
  sun.position.set(12, 30, 18);
  world.add(sun);
  return world;
}

/** The pistol and a folded-paper hand, drawn in front of the camera. */
export function buildViewModel(colour: string, skin = 0) {
  const group = new THREE.Group();
  const look = pistolLook(skin, colour), finish = { detail: 4, transparent: false };
  const paper = new THREE.MeshLambertMaterial({ color: colour, flatShading: true });
  const ink = new THREE.LineBasicMaterial({ color: C.edge });
  const part = (geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z); mesh.rotation.x = rx;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), ink));
    group.add(mesh);
  };
  part(new THREE.BoxGeometry(0.05, 0.075, 0.26), slideFaces(look, finish), 0, 0.03, -0.06);
  part(new THREE.BoxGeometry(0.045, 0.13, 0.065), gripFaces(look, finish), 0, -0.06, 0.03, -0.25);
  part(new THREE.CylinderGeometry(0.05, 0.075, 0.5, 4), paper, 0.01, -0.13, 0.27, Math.PI / 2 - 0.25);
  group.add(new THREE.HemisphereLight(C.light.sky, C.light.hand, 2.2));
  return group;
}

/** A bullet hole: a dark centre with a torn paper ring. */
export function bulletHoleTexture() {
  const texture = canvasTexture(64, (g, s) => {
    const c = s / 2;
    g.fillStyle = C.wall;
    g.beginPath();
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2, r = 15 + ((i * 7) % 5) * 2; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
    g.fill();
    g.strokeStyle = C.edge; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = C.hole; g.beginPath(); g.arc(c, c, 9, 0, Math.PI * 2); g.fill();
  });
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** A Folded paper player. It faces the way the player looks, and its height matches the hit shape. */
export function buildFigure(colour: string, skin = 0) {
  const root = new THREE.Group(), body = new THREE.Group();
  body.rotation.y = Math.PI; // parts are built facing +z; yaw 0 looks toward -z
  body.scale.setScalar(0.96);
  root.add(body);
  const flat = new THREE.MeshLambertMaterial({ color: colour, flatShading: true, transparent: true });
  const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(colour).multiplyScalar(0.72), flatShading: true, transparent: true });
  const pistol = slideFaces(pistolLook(skin, colour), { detail: 2, transparent: true });
  const ink = new THREE.LineBasicMaterial({ color: C.edge, transparent: true });
  const solidInk = new THREE.MeshBasicMaterial({ color: C.edge, transparent: true });
  const piece = (geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), ink));
    body.add(mesh);
    return mesh;
  };
  const LEG = 0.42;
  const thigh = new THREE.CylinderGeometry(0.12, 0.085, LEG, 4), shin = new THREE.CylinderGeometry(0.085, 0.05, LEG, 4), arm = new THREE.CylinderGeometry(0.075, 0.04, 0.56, 4);
  const legs = [-0.13, 0.13].map((x) => ({ x, thigh: piece(thigh, dark), shin: piece(shin, dark) }));
  const torso = piece(new THREE.CylinderGeometry(0.33, 0.17, 0.62, 5), flat);
  torso.scale.z = 0.62;
  const head = piece(new THREE.IcosahedronGeometry(0.2, 0), flat);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.05), solidInk);
  body.add(visor);
  const leftArm = piece(arm, flat), rightArm = piece(arm, flat), gun = piece(new THREE.BoxGeometry(0.05, 0.075, 0.26), pistol);
  leftArm.rotation.z = -0.14; rightArm.rotation.x = -Math.PI / 2;

  let crouched: boolean | undefined;
  return {
    root,
    /** Standing is 1.8 m tall. Crouching is 1.1 m, so a low wall hides the whole figure. */
    pose(next: boolean) {
      if (next === crouched) return;
      crouched = next;
      const bend = next ? 1.35 : 0, lean = next ? 0.5 : 0;
      const hip = 2 * LEG * Math.cos(bend), knee = hip - LEG * Math.cos(bend), kneeZ = LEG * Math.sin(bend);
      const up = (d: number) => hip + d * Math.cos(lean), out = (d: number) => d * Math.sin(lean);
      for (const leg of legs) {
        leg.thigh.position.set(leg.x, (hip + knee) / 2, kneeZ / 2); leg.thigh.rotation.x = -bend;
        leg.shin.position.set(leg.x, knee / 2, kneeZ / 2); leg.shin.rotation.x = bend;
      }
      torso.position.set(0, up(0.31), out(0.31)); torso.rotation.set(lean, Math.PI, 0);
      head.position.set(0, up(0.84), out(0.84));
      visor.position.set(0, up(0.86), out(0.86) + 0.15);
      leftArm.position.set(-0.36, up(0.3), out(0.3));
      rightArm.position.set(0.33, up(0.52), out(0.52) + 0.3);
      gun.position.set(0.33, up(0.57), out(0.57) + 0.62);
    },
    opacity(value: number) { for (const m of [flat, dark, ink, solidInk, ...pistol]) m.opacity = value; },
  };
}

/** Free the shapes, materials, and textures of an object that is no longer shown. */
export function discard(root: THREE.Object3D) {
  root.traverse((part) => {
    const mesh = part as THREE.Mesh;
    mesh.geometry?.dispose();
    for (const material of [mesh.material ?? []].flat()) { (material as THREE.MeshLambertMaterial).map?.dispose(); material.dispose(); }
  });
}
