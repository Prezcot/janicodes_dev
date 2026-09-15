"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import ScreenTransition from "./workbench/screen-transition";
import Installer from "./workbench/installer";
import Desktop from "./workbench/desktop";
import { loadWorkspace, saveWorkspace } from "./workbench/storage";
import { DEFAULT_SETTINGS, type Settings, type Workspace } from "./workbench/types";

const FIRST_NOTE = "A little space for your own thoughts.\n\nWrite something here and save it to your workspace.";

export default function Home() {
  const [screen, setScreen] = useState<"loading" | "setup" | "desktop">("loading");
  const [workspace, setWorkspace] = useState<Workspace>({ settings: DEFAULT_SETTINGS, note: FIRST_NOTE });
  const [isLive, setIsLive] = useState(true);
  const [notice, setNotice] = useState("");
  const current = useRef(workspace);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadWorkspace().then((saved) => {
      if (!active) return;
      if (saved) {
        current.current = saved;
        setWorkspace(saved);
        setIsLive(false);
        setScreen("desktop");
      } else setScreen("setup");
    }).catch(() => {
      if (!active) return;
      setNotice("Saved workspace data is unavailable in this browser. You can still try a live session.");
      setScreen("setup");
    });
    return () => { active = false; };
  }, []);

  function enqueue(update: () => Promise<void>) {
    const pending = queue.current.catch(() => undefined).then(update);
    queue.current = pending;
    return pending;
  }

  function install(settings: Settings) {
    return enqueue(async () => {
      const next = { ...current.current, settings };
      await saveWorkspace(next);
      current.current = next;
      setWorkspace(next);
      setIsLive(false);
      setNotice("");
    });
  }

  function saveNote(note: string) {
    return enqueue(async () => {
      const next = { ...current.current, note };
      if (!isLive) await saveWorkspace(next);
      current.current = next;
      setWorkspace(next);
    });
  }

  function renameFolder(folderName: string) {
    return enqueue(async () => {
      const next = { ...current.current, folderName };
      if (!isLive) await saveWorkspace(next);
      current.current = next;
      setWorkspace(next);
    });
  }

  function saveFile(name: string, content: string) {
    return enqueue(async () => {
      const next = { ...current.current, files: { ...current.current.files, [name]: content } };
      if (!isLive) await saveWorkspace(next);
      current.current = next;
      setWorkspace(next);
    });
  }

  if (screen === "loading") return <main className="app-loading" aria-busy="true"><div className="brand">JANI<span>{"//"}</span>OS</div><p>Opening your workbench…</p></main>;

  return <>
    <AnimatePresence mode="wait" initial={false}>
    <ScreenTransition key={screen}>
    {screen === "setup" ? <Installer initialSettings={workspace.settings} onComplete={install} onEnter={() => setScreen("desktop")} onLive={(settings) => {
      const next = { ...current.current, settings };
      current.current = next;
      setWorkspace(next);
      setIsLive(true);
      setNotice("");
      setScreen("desktop");
    }} /> : <Desktop files={workspace.files || {}} onSaveFile={saveFile} folderName={workspace.folderName || "Projects"} onRenameFolder={renameFolder} settings={workspace.settings} initialNote={workspace.note} isLive={isLive} storageNotice={notice} onSaveNote={saveNote} onSetup={() => setScreen("setup")} />}
    </ScreenTransition>
    </AnimatePresence>
    {notice && screen === "setup" && <div className="app-notice" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
  </>;
}
