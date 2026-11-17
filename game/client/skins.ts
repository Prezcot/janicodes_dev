import * as THREE from "three";
import { theme, type Skin } from "../../theme/theme";

/** The colours of one pistol look for one player. An unknown skin number gives the first look. */
export function pistolLook(skin: number, playerColour: string): Skin {
  const look = theme.skins[skin] ?? theme.skins[0];
  if (!look.fromPlayer) return look;
  return { ...look, base: playerColour, panel: `#${new THREE.Color(playerColour).multiplyScalar(0.72).getHexString()}` };
}

type Draw = (g: CanvasRenderingContext2D) => void;
/** `detail` is pixels for each millimetre: 4 for the pistol in your hand, 2 for the small one other players hold. */
type Finish = { detail: number; transparent: boolean };

// The drawing code works in millimetres on the real model: the slide is 260 by 75 by 50, the grip is 65 by 130 by 45.
function face(w: number, h: number, draw: Draw, { detail, transparent }: Finish, mirror = false) {
  const canvas = document.createElement("canvas");
  canvas.width = w * detail; canvas.height = h * detail;
  const g = canvas.getContext("2d")!;
  g.scale(detail, detail);
  if (mirror) { g.translate(w, 0); g.scale(-1, 1); }
  draw(g);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return new THREE.MeshLambertMaterial({ map, transparent });
}
const stroke = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const fill = (colour: string, w: number, h: number): Draw => (g) => { g.fillStyle = colour; g.fillRect(0, 0, w, h); };

function pattern(g: CanvasRenderingContext2D, s: Skin, x: number, y: number, w: number, h: number) {
  if (!s.pattern || !s.patternInk) return;
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = g.fillStyle = s.patternInk;
  if (s.pattern === "hatch") { g.lineWidth = 1.3; for (let i = -h; i < w + h; i += 8) stroke(g, x + i, y + h, x + i + h, y); }
  if (s.pattern === "grid") { g.lineWidth = 0.7; for (let i = 5; i < w; i += 10) stroke(g, x + i, y, x + i, y + h); for (let j = 5; j < h; j += 10) stroke(g, x, y + j, x + w, y + j); }
  if (s.pattern === "dots") for (let j = 0; j * 6 < h + 6; j++) for (let i = 0; i * 7 < w + 7; i++) dot(g, x + i * 7 + (j % 2) * 3.5, y + j * 6, 1.15);
  g.restore();
}

/** The long side of the slide. x runs from the back (0) to the muzzle (260). Only the right side has the port. */
const slideSide = (s: Skin, port: boolean): Draw => (g) => {
  fill(s.base, 260, 75)(g);
  pattern(g, s, 0, 0, 240, 46);
  g.fillStyle = s.panel; g.fillRect(0, 46, 260, 29); g.fillRect(240, 0, 20, 46);
  g.strokeStyle = s.line; g.lineWidth = 2.4;
  if (port) { g.fillStyle = theme.game.hole; g.fillRect(118, 9, 46, 20); g.strokeRect(118, 9, 46, 20); }
  stroke(g, 0, 46, 260, 46); stroke(g, 240, 0, 240, 46);
  for (let i = 0; i < 6; i++) stroke(g, 14 + i * 8, 40, 22 + i * 8, 8);
  g.fillStyle = s.accent; g.fillRect(72, 8, 5, 32);
  g.fillStyle = s.line; dot(g, 96, 60.5, 3.2); dot(g, 204, 60.5, 3.2);
};
/** The top of the slide. y runs from the muzzle (0) to the back (260). */
const slideTop = (s: Skin): Draw => (g) => {
  fill(s.base, 50, 260)(g);
  pattern(g, s, 0, 20, 50, 240);
  g.fillStyle = s.panel; g.fillRect(0, 0, 50, 20);
  g.strokeStyle = s.line; g.lineWidth = 2.4;
  stroke(g, 0, 20, 50, 20); stroke(g, 17, 28, 17, 232); stroke(g, 33, 28, 33, 232);
  g.fillStyle = theme.game.hole; g.fillRect(33, 96, 17, 46); g.strokeRect(33, 96, 17, 46);
  g.fillStyle = s.accent; g.fillRect(20, 5, 10, 13);
  g.fillStyle = s.line; g.fillRect(6, 240, 13, 13); g.fillRect(31, 240, 13, 13);
};
const slideEnd = (s: Skin, muzzle: boolean): Draw => (g) => {
  fill(muzzle ? s.panel : s.base, 50, 75)(g);
  g.fillStyle = s.panel; g.fillRect(0, 46, 50, 29);
  g.strokeStyle = s.line; g.lineWidth = 2.4;
  stroke(g, 0, 46, 50, 46);
  if (muzzle) { g.fillStyle = theme.game.hole; dot(g, 25, 23, 10); g.beginPath(); g.arc(25, 23, 10, 0, Math.PI * 2); g.stroke(); dot(g, 25, 60, 4); }
  else { g.fillStyle = s.panel; g.fillRect(12, 12, 26, 24); g.strokeRect(12, 12, 26, 24); g.fillStyle = s.accent; dot(g, 25, 24, 3.4); }
};
const gripSide = (s: Skin): Draw => (g) => {
  fill(s.panel, 65, 130)(g);
  g.fillStyle = s.base; g.fillRect(9, 16, 47, 98);
  g.save();
  g.beginPath(); g.rect(9, 16, 47, 98); g.clip();
  g.strokeStyle = s.line; g.globalAlpha = 0.5; g.lineWidth = 1.2;
  for (let i = -100; i < 150; i += 7) { stroke(g, i, 16, i + 98, 114); stroke(g, i + 98, 16, i, 114); }
  g.restore();
  g.strokeStyle = s.line; g.lineWidth = 2.4; g.strokeRect(9, 16, 47, 98);
  g.fillStyle = s.accent; dot(g, 32.5, 65, 5); g.beginPath(); g.arc(32.5, 65, 5, 0, Math.PI * 2); g.stroke();
};
const gripStrap = (s: Skin): Draw => (g) => {
  fill(s.panel, 45, 130)(g);
  g.strokeStyle = s.line; g.globalAlpha = 0.6; g.lineWidth = 1.8;
  for (let y = 22; y < 112; y += 11) stroke(g, 7, y, 38, y);
};
const gripBase = (s: Skin): Draw => (g) => {
  fill(s.panel, 45, 65)(g);
  g.strokeStyle = s.line; g.lineWidth = 2.4; g.strokeRect(6, 6, 33, 53);
};

const plain = (s: Skin, f: Finish) => Array<THREE.Material>(6).fill(new THREE.MeshLambertMaterial({ color: s.base, transparent: f.transparent }));

/** Materials for the slide, in the face order of a three.js box: +x, -x, +y, -y, +z, -z. */
export function slideFaces(s: Skin, f: Finish): THREE.Material[] {
  if (s.plain) return plain(s, f);
  return [face(260, 75, slideSide(s, true), f), face(260, 75, slideSide(s, false), f, true), face(50, 260, slideTop(s), f), face(50, 260, fill(s.panel, 50, 260), f), face(50, 75, slideEnd(s, false), f), face(50, 75, slideEnd(s, true), f)];
}
/** Materials for the grip, in the same face order. */
export function gripFaces(s: Skin, f: Finish): THREE.Material[] {
  if (s.plain) return plain(s, f);
  return [face(65, 130, gripSide(s), f), face(65, 130, gripSide(s), f, true), face(45, 65, fill(s.panel, 45, 65), f), face(45, 65, gripBase(s), f), face(45, 130, gripStrap(s), f), face(45, 130, gripStrap(s), f)];
}
