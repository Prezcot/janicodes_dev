"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, Folder, Globe, NotebookPen } from "lucide-react";
import AppWindow, { type Win } from "./app-window";
import type { Settings } from "./types";
import "./desktop.css";

type Props = { files: Record<string, string>; onSaveFile: (name: string, content: string) => Promise<void>; folderName: string; onRenameFolder: (name: string) => Promise<void>; settings: Settings; initialNote: string; isLive: boolean; storageNotice: string; onSaveNote: (note: string) => Promise<void>; onSetup: () => void };
type SaveState = "idle" | "saving" | "saved" | "error";
type ContentProps = { files: Record<string, string>; onSaveFile: (name: string, content: string) => Promise<void>; folderName: string; win: Win; folder: "Home" | "Projects"; setFolder: (folder: "Home" | "Projects") => void; open: (kind: Win["kind"], file?: string) => void; note: string; setNote: (note: string) => void; save: () => Promise<void>; saveState: SaveState; saveError: string; isLive: boolean; fileText: (file: string) => string };

const docs: Record<string, string> = {
  "start-here.txt": "Welcome to your bench.\n\nA tidy place to think, make, and leave breadcrumbs for your future self.\n\nThis is sample content for the Workbench design study.",
  "experience.txt": "Experience\n\nJani builds software and explores the space where useful tools meet good questions.\n\nDetailed experience, employers, credentials, and metrics are placeholder content in this preview.",
  "skills.txt": "Skills\n\nWriting · product thinking · prototyping · software craft\n\nThis list is sample content. It does not claim resume credentials.",
  "notes.txt": "Notes\n\nWrite a thought here, then save it to this local session.",
};
const projectFiles = ["Project 01 — sample", "Project 02 — sample", "readme.txt"];

export default function Desktop({ files, onSaveFile, folderName, onRenameFolder, settings, initialNote, isLive, storageNotice, onSaveNote, onSetup }: Props) {
  const [selected, setSelected] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folderName);
  const [renameError, setRenameError] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; target?: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("Untitled.txt");
  const [createError, setCreateError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const createFile = async () => {
    if (createBusy) return;
    let name = newName.trim();
    if (!name.toLowerCase().endsWith(".txt")) name += ".txt";
    name = name.slice(0, -4) + ".txt";
    if (name.length <= 4 || name.length > 80 || /[\\/:*?"<>|]/.test(name)) { setCreateError("Use a valid file name, up to 80 characters."); return; }
    if ([...Object.keys(docs), ...projectFiles, ...Object.keys(files)].some(existing => existing.toLowerCase() === name.toLowerCase())) { setCreateError("A file with that name already exists."); return; }
    setCreateBusy(true);
    try { await onSaveFile(name, ""); setCreating(false); setSelected(name); open("editor", name); }
    catch (error) { setCreateError(error instanceof Error ? error.message : "Could not create the file."); }
    finally { setCreateBusy(false); }
  };
  const renameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) { renameInput.current?.focus(); renameInput.current?.select(); } }, [renaming]);
  const beginRename = () => { setMenu(null); setDraftName(folderName); setRenameError(""); setRenaming(true); };
  const commitRename = async () => {
    if (renameBusy) return;
    const name = draftName.trim();
    if (!name || name === "." || name === ".." || /[\\/:*?"<>|]/.test(name)) { setRenameError("Enter a name without \\ / : * ? \" < > |."); return; }
    setRenameBusy(true);
    try { await onRenameFolder(name); setRenaming(false); setRenameError(""); }
    catch { setRenameError("Could not save the folder name. Try again."); }
    finally { setRenameBusy(false); }
  };
  const [clock, setClock] = useState("");
  const taskRefs = useRef(new Map<string, HTMLButtonElement>());
  const reduced = useReducedMotion();
  const [windows, setWindows] = useState<Win[]>([{ id: "editor:start-here.txt", title: "start-here.txt — Text editor", kind: "editor", file: "start-here.txt", x: 160, y: 102 }]);
  const [active, setActive] = useState("editor:start-here.txt");
  const [focusOrder, setFocusOrder] = useState(["editor:start-here.txt"]);
  const [folder, setFolder] = useState<"Home" | "Projects">("Home");
  const [note, setNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  useEffect(() => { const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); tick(); const id = setInterval(tick, 30000); return () => clearInterval(id); }, []);
  const name = settings.name.trim() || "Guest";
  const wall = settings.wallpaper === "work" ? "wall-work" : settings.wallpaper === "clean" ? "wall-clean" : "";

  const raise = (id: string) => {
    setActive(id);
    setFocusOrder(order => [...order.filter(key => key !== id), id]);
  };
  const focusNext = (excluded: string) => {
    const next = [...focusOrder].reverse().find(id => id !== excluded && windows.some(w => w.id === id && !w.minimized));
    setActive(next || "");
  };
  const open = (kind: Win["kind"], file?: string) => {
    const id = kind === "editor" ? `editor:${file}` : kind;
    setWindows(ws => { const found = ws.find(w => w.id === id); if (found) return ws.map(w => w.id === id ? { ...w, minimized: false } : w); return [...ws, { id, kind, file, title: kind === "editor" ? `${file} — Text editor` : kind === "files" ? "Files — File manager" : "Web search — Browser", x: kind === "editor" ? 160 : 230, y: kind === "editor" ? 100 : 130 }]; }); raise(id);
  };
  const close = (id: string) => {
    setWindows(ws => ws.filter(w => w.id !== id));
    setFocusOrder(order => order.filter(key => key !== id));
    if (active === id) focusNext(id);
  };
  const minimize = (id: string) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, minimized: true } : w));
    if (active === id) focusNext(id);
  };
  const activateTask = (win: Win) => {
    if (active === win.id && !win.minimized) {
      minimize(win.id);
    } else {
      setWindows(ws => ws.map(w => w.id === win.id ? { ...w, minimized: false } : w));
      raise(win.id);
    }
  };
  const toggleMax = (id: string) => setWindows(ws => ws.map(w => w.id === id ? { ...w, maximized: !w.maximized } : w));
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return; if (e.key === "Escape" && active) close(active); }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  const save = async () => { const snapshot = note; setSaveState("saving"); setSaveError(""); try { await onSaveNote(snapshot); setSaveState("saved"); } catch (error) { const message = error instanceof Error ? error.message : "Unable to save this note."; setSaveError(message); setSaveState("error"); } };
  const fileText = (file: string) => docs[file] || `# ${file}\n\nSample project notes would live here. Project details and metrics are placeholders.`;

  return <motion.div onContextMenu={e => { if ((e.target as HTMLElement).closest(".app-window, .panel, .topbar, input, textarea, .desktop-menu")) return; e.preventDefault(); setMenu({ x: Math.min(e.clientX, window.innerWidth - 205), y: Math.min(e.clientY, window.innerHeight - 180) }); }} className={`wb-root ${wall}`} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.25 }}>

    <header className="topbar"><span className="mini-brand">JANI<span>{"//"}</span>OS</span><span className="crumb">WORKBENCH / {isLive ? "LIVE SESSION" : "LOCAL SESSION"}</span><span className="clock">{name} · {clock}</span><button className="setup-link" disabled={saveState === "saving"} onClick={() => { if (note === initialNote || window.confirm("Your note has unsaved changes. Open setup without saving them?")) onSetup(); }}>Setup</button></header>
    <div className="desktop-icons">
      {[
        { id: "start-here.txt", label: "start-here.txt", Icon: FileText, launch: () => open("editor", "start-here.txt") },
        { id: "experience.txt", label: "experience.txt", Icon: FileText, launch: () => open("editor", "experience.txt") },
        { id: "skills.txt", label: "skills.txt", Icon: FileText, launch: () => open("editor", "skills.txt") },
        { id: "projects", label: folderName, Icon: Folder, launch: () => { setFolder("Projects"); open("files"); } },
        { id: "browser", label: "Web search", Icon: Globe, launch: () => open("browser") },
        ...Object.keys(files).map(file => ({ id: file, label: file, Icon: FileText, launch: () => open("editor", file) })),
      ].map(({ id, label, Icon, launch }) => <div key={id} className="desktop-item">
        <button className={`desktop-icon ${selected === id ? "selected" : ""}`} aria-label={label} aria-pressed={selected === id}
          onClick={() => { setSelected(id); setMenu(null); }} onDoubleClick={launch}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); launch(); } if (e.key === "F2" && id === "projects") { e.preventDefault(); beginRename(); } }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelected(id); setMenu({ x: Math.min(e.clientX, window.innerWidth - 205), y: Math.min(e.clientY, window.innerHeight - 180), target: id }); }}>
          <span className="icon-art"><Icon size={28} strokeWidth={1.75} aria-hidden="true" /></span>
          {!(renaming && id === "projects") && label}
        </button>
        {renaming && id === "projects" && <form onSubmit={e => { e.preventDefault(); void commitRename(); }}>
          <input ref={renameInput} className="rename-input" aria-label="Folder name" maxLength={80} value={draftName} disabled={renameBusy} onChange={e => setDraftName(e.target.value)} onBlur={() => { if (!renameBusy) void commitRename(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setRenaming(false); setRenameError(""); } }} />
          {renameError && <span className="rename-error" role="alert">{renameError}</span>}
        </form>}
      </div>)}
    </div>
    {menu && <><div className="menu-dismiss" onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null); }} /><div className="desktop-menu" role="menu" style={{ left: menu.x, top: menu.y }} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setMenu(null); } }}>
      {menu.target && <button role="menuitem" autoFocus onClick={() => { const target = menu.target; setMenu(null); if (target === "projects") { setFolder("Projects"); open("files"); } else if (target === "browser") open("browser"); else open("editor", target); }}>Open</button>}
      {menu.target === "projects" && <button role="menuitem" onClick={beginRename}>Rename <span>F2</span></button>}
      <button role="menuitem" autoFocus={!menu.target} onClick={() => { setMenu(null); setNewName("Untitled.txt"); setCreateError(""); setCreating(true); }}>New text file</button>
      <button role="menuitem" onClick={() => { setMenu(null); setFolder("Home"); open("files"); }}>Open file manager</button>
    </div></>}

    {creating && <div className="create-overlay"><form className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" onSubmit={e => { e.preventDefault(); void createFile(); }} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); if (!createBusy) setCreating(false); } }}>
      <h2 id="create-title">New text file</h2>
      <label>File name<input autoFocus aria-label="File name" value={newName} maxLength={80} disabled={createBusy} onFocus={e => e.target.select()} onChange={e => setNewName(e.target.value)} /></label>
      <p>{isLive ? "Temporary session — files will be lost when you reload. Install through Setup to keep them." : "Saved in this browser. Changes to your text save automatically."}</p>
      {createError && <p role="alert">{createError}</p>}
      <div className="actions"><button className="btn primary" disabled={createBusy}>Create</button><button type="button" className="btn" disabled={createBusy} onClick={() => setCreating(false)}>Cancel</button></div>
    </form></div>}

    <AnimatePresence>
    {windows.map(w => <AppWindow taskRefs={taskRefs} key={w.id} win={w} z={10 + focusOrder.indexOf(w.id)} onFocus={() => raise(w.id)} onClose={() => close(w.id)} onMin={() => minimize(w.id)} onMax={() => toggleMax(w.id)}><WindowContent files={files} onSaveFile={onSaveFile} folderName={folderName} win={w} folder={folder} setFolder={setFolder} open={open} note={note} setNote={value => { setNote(value); setSaveState("idle"); setSaveError(""); }} save={save} saveState={saveState} saveError={saveError} isLive={isLive} fileText={fileText} /></AppWindow>)}
    </AnimatePresence>
    <motion.footer className="panel" initial={{ y: reduced ? 0 : 14, opacity: reduced ? 1 : 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reduced ? 0 : 0.25 }}>
      <span className="panel-brand">JANI//OS</span>
      <nav className="panel-launchers" aria-label="App launchers">
        <button onClick={() => open("files")} title="Open Files" aria-label="Open Files"><Folder size={18} aria-hidden="true" /></button>
        <button onClick={() => open("browser")} title="Open Browser" aria-label="Open Browser"><Globe size={18} aria-hidden="true" /></button>
        <button onClick={() => open("editor", "notes.txt")} title="Open Notes" aria-label="Open Notes"><NotebookPen size={18} aria-hidden="true" /></button>
      </nav>
      <nav className="panel-tasks" aria-label="Open windows">
        {windows.map(w => <motion.button key={w.id}
          ref={node => { if (node) taskRefs.current.set(w.id, node); else taskRefs.current.delete(w.id); }}
          layout={!reduced}
          initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.16 }}
          className={`task-button ${active === w.id && !w.minimized ? "is-active" : ""} ${w.minimized ? "is-minimized" : ""}`}
          aria-pressed={active === w.id && !w.minimized}
          title={`${w.title}${w.minimized ? " (minimized)" : ""}`}
          onClick={() => activateTask(w)}>
          <span className="task-icon" aria-hidden="true">{w.kind === "files" ? <Folder size={16} /> : w.kind === "browser" ? <Globe size={16} /> : w.file === "notes.txt" ? <NotebookPen size={16} /> : <FileText size={16} />}</span>
          <span className="task-label">{w.file || (w.kind === "files" ? "Files" : "Browser")}</span>
        </motion.button>)}
      </nav>
      <span className="panel-status">{storageNotice || (isLive ? "LIVE" : "SAVED")} · {settings.storageMb} MB LIMIT</span>
    </motion.footer>
  </motion.div>;
}

function WindowContent({ files, onSaveFile, folderName, win, folder, setFolder, open, note, setNote, save, saveState, saveError, isLive, fileText }: ContentProps) {
  if (win.file && Object.hasOwn(files, win.file)) return <SavedFileEditor name={win.file} initialText={files[win.file]} onSave={onSaveFile} isLive={isLive} />;
  if (win.file === "start-here.txt") return <div className="window-body"><h2>Welcome to your <span>bench.</span></h2><p>A tidy place to think, make, and leave breadcrumbs for your future self.</p><div className="rule" /><span className="sample">sample content / design study</span></div>;
  if (win.kind === "browser") return <div className="window-body"><form className="browser-form" onSubmit={e => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim(); if (q) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`, "_blank", "noopener"); }}><input name="q" aria-label="Search the web" placeholder="Search the web…" /><button>Search</button></form><div className="browser-hint">Search opens a real browser tab.</div><div className="bookmarks"><a className="bookmark" href="https://github.com" target="_blank" rel="noopener"><strong>Project 01 — sample</strong><small>Example link · opens externally</small></a><a className="bookmark" href="https://www.are.na" target="_blank" rel="noopener"><strong>Project 02 — sample</strong><small>Research board · opens externally</small></a></div></div>;
  if (win.kind === "files") return <div className="file-layout"><nav className="file-tree"><button className={folder === "Home" ? "active" : ""} onClick={() => setFolder("Home")}>Home</button><button className={folder === "Projects" ? "active" : ""} onClick={() => setFolder("Projects")}>{folderName}</button></nav><div className="file-content"><h3>{folder === "Projects" ? folderName : folder}</h3><p>Sample files in this local workspace.</p><div className="file-list">{(folder === "Home" ? ["start-here.txt", "experience.txt", "skills.txt", "notes.txt", ...Object.keys(files)] : projectFiles).map(f => <button key={f} onDoubleClick={() => open("editor", f)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); open("editor", f); } }}><FileText size={16} aria-hidden="true" />{f}</button>)}</div></div></div>;
  const editable = win.file === "notes.txt"; return <div className="window-body"><div className="editor-meta">plain text · {editable ? "editable" : "read only"} · sample content</div>{editable ? <><textarea value={note} onChange={e => setNote(e.target.value)} disabled={saveState === "saving"} aria-label="Notes" /><div className="editor-actions"><button className="btn primary" onClick={save} disabled={saveState === "saving"}>Save</button><span>{saveState === "saving" ? "Saving…" : saveState === "saved" ? (isLive ? "Saved for live session." : "Saved in this browser.") : saveState === "error" ? `Could not save: ${saveError}` : ""}</span></div></> : <><pre className="editor-copy">{fileText(win.file || "start-here.txt")}</pre><button className="download" onClick={() => { const url = URL.createObjectURL(new Blob([fileText(win.file || "start-here.txt")], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = win.file || "note.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download</button></>}</div>;
}


function SavedFileEditor({ name, initialText, onSave, isLive }: { name: string; initialText: string; onSave: (name: string, text: string) => Promise<void>; isLive: boolean }) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState("Saved");
  const revision = useRef(0);
  const persist = (value: string) => {
    const version = ++revision.current;
    setStatus("Saving…");
    void onSave(name, value).then(() => { if (version === revision.current) setStatus("Saved"); }).catch(error => { if (version === revision.current) setStatus(error instanceof Error ? error.message : "Save failed"); });
  };
  return <div className="window-body"><div className="editor-meta">plain text · autosave</div><textarea aria-label="File contents" value={text} onChange={e => { setText(e.target.value); persist(e.target.value); }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); persist(text); } }} /><div className="editor-actions"><button className="btn primary" onClick={() => persist(text)}>Save</button><span role="status">{status}{status === "Saved" ? (isLive ? " for this temporary session" : " in this browser") : ""}</span></div></div>;
}
