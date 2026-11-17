"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { theme } from "../../theme/theme";
import { buildViewModel, discard } from "./world";

/** The pistol alone, turning slowly. Drag it to turn it by hand. */
function PistolPreview({ colour, skin }: { colour: number; skin: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const show = useRef<(colour: number, skin: number) => void>(() => {});

  useEffect(() => {
    const view = canvas.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, alpha: true }); } catch { return; } // no WebGL: the list works without the picture
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10), turn = new THREE.Group();
    camera.position.set(0, 0.04, 0.66);
    camera.lookAt(0, 0, 0);
    scene.add(turn);

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let spin = 0.9, tilt = 0.25, held = false, touched = still, width = 0, height = 0, last = performance.now();
    show.current = (nextColour, nextSkin) => {
      for (const old of [...turn.children]) { turn.remove(old); discard(old); }
      const pistol = buildViewModel(theme.players[nextColour].colour, nextSkin);
      const hand = pistol.children[2];
      pistol.remove(hand); discard(hand); // the menu shows the pistol with no hand
      pistol.position.set(0, 0.03, 0.05);
      turn.add(pistol);
    };

    let raf = requestAnimationFrame(function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (view.clientWidth !== width || view.clientHeight !== height) {
        width = view.clientWidth; height = view.clientHeight;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      }
      if (!touched) spin += dt * 0.5;
      turn.rotation.set(tilt, spin, 0);
      renderer.render(scene, camera);
    });
    const down = (e: PointerEvent) => { held = true; touched = true; view.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (held) { spin += e.movementX * 0.01; tilt = Math.max(-1.3, Math.min(1.3, tilt + e.movementY * 0.01)); } };
    const up = () => { held = false; };
    view.addEventListener("pointerdown", down); view.addEventListener("pointermove", move); view.addEventListener("pointerup", up); view.addEventListener("pointercancel", up);

    return () => {
      cancelAnimationFrame(raf);
      view.removeEventListener("pointerdown", down); view.removeEventListener("pointermove", move); view.removeEventListener("pointerup", up); view.removeEventListener("pointercancel", up);
      discard(turn); renderer.dispose(); show.current = () => {};
    };
  }, []);

  useEffect(() => { show.current(colour, skin); }, [colour, skin]);

  return <canvas ref={canvas} className="fps-pistol-view" role="img" aria-label={`Your pistol, in ${theme.skins[skin].name}`} />;
}

/** The pistol menu: a picture of the pistol and the list of looks. It opens from the lobby. */
export function PistolMenu({ colour, skin, onPick, onDone }: { colour: number; skin: number; onPick: (skin: number) => void; onDone: () => void }) {
  const chip = (i: number) => theme.skins[i].fromPlayer ? theme.players[colour].colour : theme.skins[i].base;
  return <div className="fps-lobby" onKeyDown={e => { if (e.key === "Escape") onDone(); }}>
    <header>
      <h2>Pistol</h2>
      <p>Pick the look of your pistol. Other players see it too.</p>
    </header>
    <div className="fps-lobby-grid">
      <section className="fps-sheet fps-pistol">
        <PistolPreview colour={colour} skin={skin} />
        <p>Drag to turn the pistol.</p>
      </section>
      <section className="fps-sheet">
        <h3 id="fps-looks">Look</h3>
        <div role="radiogroup" aria-labelledby="fps-looks" className="fps-looks" onKeyDown={e => {
          const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const next = (skin + step + theme.skins.length) % theme.skins.length;
          onPick(next);
          (e.currentTarget.children[next] as HTMLElement).focus();
        }}>
          {theme.skins.map((look, i) => <button key={look.name} role="radio" aria-checked={skin === i} tabIndex={skin === i ? 0 : -1} autoFocus={skin === i} onClick={() => onPick(i)}>
            <i style={{ background: chip(i) }} />
            <strong>{look.name}</strong>
            <span>{look.note}</span>
          </button>)}
        </div>
        <div className="fps-actions"><button className="btn primary" onClick={onDone}>Done</button></div>
      </section>
    </div>
  </div>;
}
