"use client";

import { useEffect, useRef, useState } from "react";
import Desktop from "./workbench/desktop";
import { loadWorkspace, saveWorkspace } from "./workbench/storage";
import type { Workspace } from "./workbench/types";

const FIRST_NOTE = "A little space for your own thoughts.\n\nWrite something here and save it to your workspace.";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>({ note: FIRST_NOTE });
  // True when this browser cannot save. The desktop still works, but changes last only until a reload.
  const [isLive, setIsLive] = useState(false);
  const current = useRef(workspace);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadWorkspace().then((saved) => {
      if (!active || !saved) return;
      current.current = saved;
      setWorkspace(saved);
    }).catch(() => {
      if (active) setIsLive(true);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  function enqueue(update: () => Promise<void>) {
    const pending = queue.current.catch(() => undefined).then(update);
    queue.current = pending;
    return pending;
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

  if (!ready) return <main className="app-loading" aria-busy="true"><div className="brand">JANI<span>{"//"}</span>OS</div><p>Opening your workbench…</p></main>;

  return <Desktop files={workspace.files || {}} onSaveFile={saveFile} folderName={workspace.folderName || "Projects"} onRenameFolder={renameFolder} initialNote={workspace.note} isLive={isLive} onSaveNote={saveNote} />;
}
