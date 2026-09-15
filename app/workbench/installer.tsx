"use client";

import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Settings, Wallpaper } from "./types";

type InstallerProps = {
  initialSettings: Settings;
  onComplete: (settings: Settings) => Promise<void>;
  onLive: (settings: Settings) => void;
  onEnter: () => void;
};

type Step = "welcome" | "personalize" | "storage" | "install";

type InstallerStageProps = {
  step: Step;
  direction: number;
  reducedMotion: boolean | null;
  children: ReactNode;
};

function InstallerStage({ step, direction, reducedMotion, children }: InstallerStageProps) {
  const isPresent = useIsPresent();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPresent) return;
    const frame = requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>("h1, h2")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isPresent]);

  return (
    <motion.div
      ref={stageRef}
      key={step}
      className="installer-stage"
      custom={direction}
      inert={!isPresent ? true : undefined}
      aria-hidden={!isPresent}
      initial="enter"
      animate="center"
      exit="exit"
      variants={{
        enter: (travel: number) => reducedMotion ? { opacity: 0 } : { opacity: 0, x: travel * 18 },
        center: { opacity: 1, x: 0 },
        exit: (travel: number) => reducedMotion ? { opacity: 0 } : { opacity: 0, x: travel * -18 },
      }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: "100%" }}
    >
      {children}
    </motion.div>
  );
}

const wallpapers: Array<{ id: Wallpaper; label: string; swatch: string }> = [
  { id: "grid", label: "Graph paper", swatch: "grid" },
  { id: "work", label: "Rust & paper", swatch: "work" },
  { id: "clean", label: "Quiet olive", swatch: "clean" },
];

export default function Installer({
  initialSettings,
  onComplete,
  onLive,
  onEnter,
}: InstallerProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const reducedMotion = useReducedMotion();

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const navigate = (next: Step) => {
    setDirection(["welcome", "personalize", "storage", "install"].indexOf(next) >= stepIndex ? 1 : -1);
    setStep(next);
  };

  const goInstall = async () => {
    if (busy) return;
    setError(null);
    navigate("install");
    setBusy(true);
    setProgress(25);
    try {
      await onComplete(settings);
      setProgress(100);
    } catch (caught) {
      setProgress(0);
      setError(caught instanceof Error ? caught.message : "Could not save this workspace.");
    } finally {
      setBusy(false);
    }
  };

  const goLive = () => onLive(settings);
  const stepIndex = ["welcome", "personalize", "storage", "install"].indexOf(step);

  return (
    <section id="installer" aria-label="JANI OS setup">
      <aside className="rail">
        <div className="brand">JANI<span>{"//"}</span>OS</div>
        <div className="rail-rule" />
        <ol className="steps" aria-label="Setup steps">
          {(["welcome", "personalize", "storage", "install"] as Step[]).map((name, index) => (
            <li key={name} className={`${step === name ? "active" : ""} ${index < stepIndex ? "done" : ""}`}>
              <span className="num">0{index + 1}</span>
              <span className="step-name">{name === "personalize" ? "Personalize" : name[0].toUpperCase() + name.slice(1)}</span>
            </li>
          ))}
        </ol>
        <div className="rail-foot"><b>WORKBENCH / 0.2</b>Tools for thinking,<br />made local to the browser.</div>
      </aside>

      <main className="install-main">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <InstallerStage key={step} step={step} direction={direction} reducedMotion={reducedMotion}>
        {step === "welcome" && (
          <div className="install-panel">
            <div className="eyebrow">A small personal operating system</div>
            <h1 tabIndex={-1}>Make a little room<br />for <em>good work.</em></h1>
            <p className="lede">JANI//OS is a private corner for notes, experiments, and the projects that do not fit in a browser tab.</p>
            <div className="actions">
              <button className="btn primary" type="button" onClick={() => navigate("personalize")}>Install JANI//OS <ArrowRight size={16} aria-hidden="true" /></button>
              <button className="btn ghost" type="button" onClick={goLive}>Skip</button>
            </div>
            <p className="micro">Runs in this tab · no account required</p>
          </div>
        )}

        {step === "personalize" && (
          <div className="install-panel">
            <div className="eyebrow">02 / make it yours</div>
            <div className="form-card">
              <h2 tabIndex={-1}>Set up your bench.</h2>
              <p>Choose a surface for your work. A name is optional and stays in this workspace.</p>
              <div className="choice-grid" role="group" aria-label="Wallpaper choices">
                {wallpapers.map((wallpaper) => (
                  <button
                    className={`choice ${settings.wallpaper === wallpaper.id ? "selected" : ""}`}
                    type="button"
                    key={wallpaper.id}
                    aria-pressed={settings.wallpaper === wallpaper.id}
                    onClick={() => update("wallpaper", wallpaper.id)}
                  >
                    <span className={`swatch ${wallpaper.swatch}`} aria-hidden="true" />
                    <strong>{wallpaper.label}</strong>
                  </button>
                ))}
              </div>
              <label htmlFor="guest-name">Your name <span>(optional)</span></label>
              <input id="guest-name" type="text" maxLength={40} value={settings.name} placeholder="Guest operator" onChange={(event) => update("name", event.target.value)} />
              <div className="actions" style={{ marginTop: 22 }}>
                <button className="btn primary" type="button" onClick={() => navigate("storage")}>Continue <ArrowRight size={16} aria-hidden="true" /></button>
                <button className="btn ghost" type="button" onClick={() => navigate("welcome")}>Back</button>
              </div>
            </div>
          </div>
        )}

        {step === "storage" && (
          <div className="install-panel">
            <div className="eyebrow">03 / local footprint</div>
            <div className="form-card">
              <h2 tabIndex={-1}>How much bench space?</h2>
              <p>Set a limit for the notes and preferences you choose to save.</p>
              <div className="storage-row">
                <div className="range-head"><span>Saved workspace budget</span><span className="range-value"><output htmlFor="storage-range">{settings.storageMb}</output> MB</span></div>
                <input id="storage-range" type="range" min={10} max={100} step={5} value={settings.storageMb} aria-label="Saved workspace budget in megabytes" onChange={(event) => update("storageMb", Number(event.target.value))} />
                <div className="range-note">Saves only actual notes and preferences.<br />No disk space is reserved.</div>
              </div>
              <div className="actions" style={{ marginTop: 24 }}>
                <button className="btn primary" type="button" onClick={goInstall}>Save and prepare <ArrowRight size={16} aria-hidden="true" /></button>
                <button className="btn ghost" type="button" onClick={() => navigate("personalize")}>Back</button>
              </div>
            </div>
          </div>
        )}

        {step === "install" && (
          <div className="install-panel" aria-live="polite">
            <div className="eyebrow">04 / setting the tools out</div>
            <div className="form-card">
              <h2 tabIndex={-1}>{error ? "The bench needs another try." : progress === 100 ? "The bench is ready." : "Saving your workspace."}</h2>
              <p>{error ?? (progress === 100 ? "Your workspace is ready. Step in whenever you are ready." : "Saving your settings and preparing the local workspace.")}</p>
              {error && <p role="alert" className="error-message">{error}</p>}
              <div className="progress-wrap"><div className="progress-label"><span>{error ? "Save failed" : progress === 100 ? "Workspace ready" : "Saving settings"}</span><span>{progress}%</span></div><div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{ width: `${progress}%` }} /></div></div>
              <div className="actions">
                {error && <button className="btn primary" type="button" onClick={goInstall}>Retry save</button>}
                {error && <button className="btn ghost" type="button" onClick={goLive}>Try a live session</button>}
                {progress === 100 && !error && <button className="btn primary" type="button" onClick={onEnter}>Enter desktop <ArrowRight size={16} aria-hidden="true" /></button>}
                <button className="btn ghost" type="button" disabled={busy} onClick={() => navigate("storage")}>Back</button>
              </div>
            </div>
          </div>
        )}
          </InstallerStage>
        </AnimatePresence>
      </main>
    </section>
  );
}
