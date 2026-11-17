"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { theme } from "../../theme/theme";
import { buildFigure, discard } from "./world";

const seconds = () => performance.now() / 1000;

/** The player's paper figure in the lobby. It sways, and now and then it does a short gag. */
export function FigurePreview({ colour, skin }: { colour: number; skin: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const show = useRef<(colour: number, skin: number) => void>(() => {});

  useEffect(() => {
    const view = canvas.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, alpha: true }); } catch { return; } // no WebGL: the lobby works without the figure
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20), light = theme.game.light;
    camera.position.set(0, 1.05, 6.2);
    camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight(light.sky, light.ground, 2.3));
    const sun = new THREE.DirectionalLight(light.sun, 1.4);
    sun.position.set(3, 6, 5);
    scene.add(sun);

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let figure: ReturnType<typeof buildFigure> | null = null;
    // Gags: 1 hop and spin, 2 crouch dance, 3 fall flat and pop up, 4 wobble.
    let gag = 0, gagAt = 0, nextGag = 0, width = 0, height = 0;
    const remove = () => {
      if (!figure) return;
      scene.remove(figure.root);
      discard(figure.root);
    };
    show.current = (next, nextSkin) => {
      remove();
      figure = buildFigure(theme.players[next].colour, nextSkin);
      figure.root.rotation.order = "YXZ";
      scene.add(figure.root);
      gag = 1; gagAt = seconds(); nextGag = gagAt + 3; // a new colour or pistol arrives with a hop and a spin
    };

    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (view.clientWidth !== width || view.clientHeight !== height) {
        width = view.clientWidth; height = view.clientHeight;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      }
      if (!figure) return;
      const now = seconds(), t = now - gagAt;
      let turn = Math.PI + 0.4, hop = 0, flat = 0, lean = 0, crouch = false;
      if (!still) {
        turn = Math.PI + 0.45 * Math.sin(now * 0.8);
        if (gag === 1 && t < 0.7) { hop = Math.sin((t / 0.7) * Math.PI) * 0.45; turn += (t / 0.7) * Math.PI * 2; }
        else if (gag === 2 && t < 1.6) crouch = Math.floor(t * 7) % 2 === 0;
        else if (gag === 3 && t < 1.8) flat = t < 0.35 ? t / 0.35 : t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / 0.25);
        else if (gag === 4 && t < 1.2) lean = 0.3 * Math.sin(t * 14) * (1 - t / 1.2);
        else if (now > nextGag) { gag = 1 + Math.floor(Math.random() * 4); gagAt = now; nextGag = now + 3.5 + Math.random() * 3; }
      }
      figure.pose(crouch);
      figure.root.position.y = hop;
      figure.root.rotation.set((-flat * Math.PI) / 2, turn, lean);
      renderer.render(scene, camera);
    });

    return () => { cancelAnimationFrame(raf); remove(); renderer.dispose(); show.current = () => {}; };
  }, []);

  useEffect(() => { show.current(colour, skin); }, [colour, skin]);

  return <canvas ref={canvas} className="fps-figure" role="img" aria-label={`Your player, in ${theme.players[colour].name}`} />;
}
