"use client";

import { Minus, Square, Copy, X } from "lucide-react";
import { motion, useAnimationControls, useIsPresent, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode, RefObject } from "react";

export type Win = {
  id: string;
  title: string;
  kind: "editor" | "files" | "browser" | "game";
  file?: string;
  minimized?: boolean;
  maximized?: boolean;
  x: number;
  y: number;
};

type Props = {
  win: Win;
  z: number;
  taskRefs: RefObject<Map<string, HTMLButtonElement>>;
  onFocus: () => void;
  onClose: () => void;
  onMin: () => void;
  onMax: () => void;
  children: ReactNode;
};

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const resizeEdges: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ease = [0.22, 1, 0.36, 1] as const;

export default function AppWindow({ win, z, taskRefs, onFocus, onClose, onMin, onMax, children }: Props) {
  const [position, setPosition] = useState({ x: win.x, y: win.y });
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const resize = useRef<{ edge: ResizeEdge; pointerX: number; pointerY: number; left: number; top: number; right: number; bottom: number; minWidth: number; minHeight: number; boundRight: number; boundBottom: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const element = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  const present = useIsPresent();

  // Keep the window mounted while minimized so notes, scroll and position survive.
  // Cancel the prior animation before reversing, and never let its completion hide
  // a window that has already been restored.
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || !present) return;
    let cancelled = false;
    controls.set({ visibility: "visible" });

    let x = 0;
    let y = 0;
    let scaleX = 1;
    let scaleY = 1;
    if (win.minimized && !reduced) {
      const task = taskRefs.current.get(win.id);
      task?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const target = task?.getBoundingClientRect();
      const parent = node.offsetParent?.getBoundingClientRect();
      if (target && parent) {
        // offset measurements exclude the animation's in-flight transforms.
        x = target.left - parent.left - node.offsetLeft;
        y = target.top - parent.top - node.offsetTop;
        scaleX = target.width / Math.max(1, node.offsetWidth);
        scaleY = target.height / Math.max(1, node.offsetHeight);
      }
    }

    void controls.start({
      x, y, scaleX, scaleY,
      opacity: win.minimized ? 0 : 1,
      transition: { duration: reduced ? 0 : 0.24, ease },
    }).then(() => {
      if (!cancelled && win.minimized) controls.set({ visibility: "hidden" });
    });

    return () => { cancelled = true; controls.stop(); };
  }, [win.id, win.minimized, reduced, present, controls, taskRefs]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || win.maximized || (event.target as HTMLElement).closest("button")) return;
    controls.stop();
    controls.set({ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    const rect = element.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startResize(event: PointerEvent<HTMLDivElement>, edge: ResizeEdge) {
    if (event.button !== 0 || win.maximized) return;
    event.preventDefault();
    controls.stop();
    controls.set({ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    const node = element.current;
    if (!node) return;
    const parent = node.offsetParent as HTMLElement;
    const panel = parent.querySelector(".panel") as HTMLElement | null;
    const boundRight = parent.clientWidth - 8;
    const boundBottom = parent.clientHeight - (panel?.offsetHeight ?? 45) - 8;
    const width = Math.min(node.offsetWidth, boundRight - 8);
    const height = Math.min(node.offsetHeight, boundBottom - 8);
    const left = clamp(node.offsetLeft, 8, boundRight - width);
    const top = clamp(node.offsetTop, 8, boundBottom - height);
    resize.current = { edge, pointerX: event.clientX, pointerY: event.clientY, left, top, right: left + width, bottom: top + height, minWidth: Math.min(300, width), minHeight: Math.min(180, height), boundRight, boundBottom };
    setPosition({ x: left, y: top });
    setSize({ width, height });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const resizing = resize.current;
    if (resizing && !win.maximized) {
      const dx = event.clientX - resizing.pointerX;
      const dy = event.clientY - resizing.pointerY;
      let { left, right, top, bottom } = resizing;
      if (resizing.edge.includes("w")) left = clamp(left + dx, 8, right - resizing.minWidth);
      if (resizing.edge.includes("e")) right = clamp(right + dx, left + resizing.minWidth, resizing.boundRight);
      if (resizing.edge.includes("n")) top = clamp(top + dy, 8, bottom - resizing.minHeight);
      if (resizing.edge.includes("s")) bottom = clamp(bottom + dy, top + resizing.minHeight, resizing.boundBottom);
      setPosition({ x: left, y: top });
      setSize({ width: right - left, height: bottom - top });
      return;
    }
    if (!drag.current || win.maximized) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - rect.height - 55, event.clientY - drag.current.y)),
    });
  }

  function stopDrag() { resize.current = null; drag.current = null; setDragging(false); }

  return <motion.section
    ref={element}
    role="region"
    aria-label={win.title}
    aria-hidden={win.minimized || !present}
    inert={win.minimized || !present}
    data-sized={size ? true : undefined}
    data-minimized={win.minimized || undefined}
    data-dragging={dragging || undefined}
    className={`app-window ${win.file === "start-here.txt" ? "welcome-note" : ""} ${win.kind === "game" ? "game-window" : ""} ${win.maximized ? "maximized" : ""}`}
    layout={!reduced}
    layoutDependency={Boolean(win.maximized)}
    initial={reduced ? false : { opacity: 0, scaleX: 0.97, scaleY: 0.97, y: 6 }}
    animate={controls}
    exit={{ opacity: 0, scaleX: reduced ? 1 : 0.97, scaleY: reduced ? 1 : 0.97, transition: { duration: reduced ? 0 : 0.14, ease } }}
    transition={{ layout: { duration: reduced ? 0 : 0.24, ease } }}
    style={{ "--open-y": `${win.y}px`, "--window-x": `${position.x}px`, "--window-y": `${position.y}px`, "--window-width": size ? `${size.width}px` : undefined, left: win.maximized ? 0 : position.x, top: win.maximized ? 0 : position.y, width: !win.maximized && size ? size.width : undefined, height: !win.maximized && size ? size.height : undefined, maxHeight: !win.maximized && size ? "none" : undefined, zIndex: z, transformOrigin: "0 0" } as CSSProperties}
    onPointerDown={onFocus}
    onPointerMove={move}
    onPointerUp={stopDrag}
    onPointerCancel={stopDrag}
    onLostPointerCapture={stopDrag}
  >
    <div className="window-head" onPointerDown={startDrag}>
      <span className="window-title">{win.title}</span>
      <span className="window-controls">
        <button onClick={onMin} aria-label="Minimize"><Minus size={12} aria-hidden="true" /></button>
        <button onClick={onMax} aria-label={win.maximized ? "Restore size" : "Maximize"}>{win.maximized ? <Copy size={12} aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}</button>
        <button onClick={onClose} aria-label="Close"><X size={12} aria-hidden="true" /></button>
      </span>
    </div>
    {children}
    {!win.maximized && resizeEdges.map(edge => <div key={edge} className={`resize-handle resize-${edge}`} data-resize={edge} aria-hidden="true" onPointerDown={event => startResize(event, edge)} />)}
  </motion.section>;
}
