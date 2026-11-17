"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Crosshair, FileText, Folder, Globe, NotebookPen } from "lucide-react";
import AppWindow, { type Win } from "./app-window";
import "./desktop.css";

type Props = { files: Record<string, string>; onSaveFile: (name: string, content: string) => Promise<void>; folderName: string; onRenameFolder: (name: string) => Promise<void>; initialNote: string; isLive: boolean; onSaveNote: (note: string) => Promise<void> };
type SaveState = "idle" | "saving" | "saved" | "error";
// The game loads only when its window opens, so the desktop does not carry its code.
const Game = dynamic(() => import("@/game/client/Game"), { ssr: false, loading: () => <div className="window-body">Loading the game…</div> });
type ContentProps = { files: Record<string, string>; onSaveFile: (name: string, content: string) => Promise<void>; folderName: string; win: Win; folder: "Home" | "Projects"; setFolder: (folder: "Home" | "Projects") => void; open: (kind: Win["kind"], file?: string) => void; note: string; setNote: (note: string) => void; save: () => Promise<void>; saveState: SaveState; saveError: string; isLive: boolean; fileText: (file: string) => string };

const docs: Record<string, string> = {
  "start-here.txt": "I'm Jani.\n\nI'm a software engineer. I build web and mobile products for startups and clients.",
  "experience.txt": "Experience\n\nNot A Number Labs (Vibecode)\nForward Deployed Engineer, Sep 2026 to present\nA platform for building apps with AI agents. I find the root cause of problems in live customer projects and ship the fixes. I built a Chrome extension that links the support tools, a Start/Stop control for idle billing, and a repeatable test for AI agent instructions.\n\nAterra Travel\nFreelance Software Engineer\nAterra Studio turns supplier documents into branded itineraries, PDF proposals, and signable booking contracts. I built the AI document extraction, the background processing, the pricing and currency handling, and the electronic-signature backend.\n\nSansatech\nSoftware Engineer, Mar 2025 to Aug 2026\nA US-based startup. I built web and mobile products, AI integrations, and backend services, and I managed App Store submissions. I led KishCoach and Frenzz, and I was the sole developer of AI Ad Manager.\n\nBizzman360\nSoftware Engineering Intern, then Full Stack Engineer, Jun 2024 to Mar 2025\nI developed a custom CRM system with API security and data validation, and I worked with clients in meetings and onboarding.\n\nEducation\nBSc (Hons) in Software Engineering, First Class Honours\nUniversity of Plymouth, United Kingdom. Graduated Dec 2024.",
  "skills.txt": "Skills\n\nLanguages\nTypeScript, JavaScript, Python, SQL, Swift, Java, Kotlin\n\nWeb and mobile\nReact, Next.js, React Native, Expo, SwiftUI, Tailwind CSS\n\nBackend and databases\nNode.js, Express, FastAPI, PostgreSQL, Prisma, Supabase, Firebase, Redis, Stripe, RevenueCat\n\nAI\nOpenAI and Anthropic APIs, prompt engineering, retrieval-augmented generation (RAG), vector search, agent skill evaluation\n\nTesting and delivery\nPlaywright, Git, GitHub Actions, CI/CD, Docker, Railway, Vercel",
  "contact.txt": "Contact\n\nJanindu Mapa, software engineer\n\nEmail: janindumapa100@gmail.com\nGitHub: https://github.com/Prezcot\nLinkedIn: https://www.linkedin.com/in/janindu-mapa",
  "notes.txt": "Notes\n\nWrite a thought here, then save it to this local session.",
  "paper-arena.txt": "Paper Arena\n\nA multiplayer pistol game with paper players, made for this site. Up to 8 players share a room in a free-for-all.\n\nStack: three.js, TypeScript, Cloudflare Workers, Durable Objects\n\nTo play, open the Paper Arena icon on the desktop.",
  "kishcoach.txt": "KishCoach\nLead engineer, at Sansatech\n\nA coaching marketplace with Cal.com session booking, Stripe payments, push notifications, and real-time chat. I led the web, mobile, and backend API development.\n\nStack: React Native / Expo, TypeScript, Vite, Node.js / Express, Supabase, Stripe, CometChat\n\nhttps://www.kishcoach.com/",
  "frenzz.txt": "Frenzz\nLead engineer, at Sansatech\n\nA published iOS app with 100+ users that generates AI photos of friends. I built the multi-model image-generation backend, the content moderation, and native Swift modules for on-device face clustering.\n\nStack: React Native / Expo, Firebase Functions, Cloud Tasks, Swift, Gemini, OpenAI\n\nhttps://apps.apple.com/us/app/frenzz/id6762831131",
  "ai-ad-manager.txt": "AI Ad Manager (Otto)\nSole developer, at Sansatech\n\nAn AI advertising platform for business research, ad generation, and Meta campaign management, with background jobs, performance reporting, and user approvals.\n\nStack: Next.js, TypeScript, Supabase / PostgreSQL, Drizzle ORM, Redis / BullMQ, Vercel AI SDK, OpenAI, Meta Marketing API",
  "aterra-studio.txt": "Aterra Studio\nFreelance software engineer, for Aterra Travel\n\nA travel platform that turns supplier documents into branded itineraries, PDF proposals, and signable booking contracts. I built the AI document extraction, the background processing, the pricing and currency handling, and the electronic-signature backend.\n\nStack: Next.js, React, TypeScript, Supabase / PostgreSQL, Redis / BullMQ, Anthropic and OpenAI APIs, Railway",
};
const projectFiles = ["paper-arena.txt", "kishcoach.txt", "frenzz.txt", "ai-ad-manager.txt", "aterra-studio.txt"];
// Web addresses and email addresses in a text file become links.
const linked = (text: string) => text.split(/(https?:\/\/\S+|\S+@\S+\.\S+)/).map((part, i) => i % 2 ? <a key={i} href={part.includes("://") ? part : `mailto:${part}`} target="_blank" rel="noopener">{part}</a> : part);

export default function Desktop({ files, onSaveFile, folderName, onRenameFolder, initialNote, isLive, onSaveNote }: Props) {
  const [selected, setSelected] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folderName);
  const [renameError, setRenameError] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; target?: string } | null>(null);
  const menuOpener = useRef<HTMLElement | null>(null);
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
  const taskRefs = useRef(new Map<string, HTMLButtonElement>());
  const reduced = useReducedMotion();
  const [windows, setWindows] = useState<Win[]>([{ id: "editor:start-here.txt", title: "start-here.txt — Text editor", kind: "editor", file: "start-here.txt", x: 160, y: 60 }]);
  const [active, setActive] = useState("editor:start-here.txt");
  const [focusOrder, setFocusOrder] = useState(["editor:start-here.txt"]);
  const [folder, setFolder] = useState<"Home" | "Projects">("Home");
  const [note, setNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const raise = (id: string) => {
    setActive(id);
    setFocusOrder(order => [...order.filter(key => key !== id), id]);
  };
  const focusNext = (excluded: string) => {
    const next = [...focusOrder].reverse().find(id => id !== excluded && windows.some(w => w.id === id && !w.minimized));
    setActive(next || "");
    return next;
  };
  // Keyboard focus must not fall to the page when the window that holds it goes away.
  const refocus = (id?: string) => { if (document.activeElement?.closest(".app-window")) ((id && taskRefs.current.get(id)) || document.querySelector<HTMLElement>(".desktop-icon"))?.focus(); };
  const open = (kind: Win["kind"], file?: string) => {
    const id = kind === "editor" ? `editor:${file}` : kind;
    setWindows(ws => { const found = ws.find(w => w.id === id); if (found) return ws.map(w => w.id === id ? { ...w, minimized: false } : w); const step = kind === "game" ? 0 : (ws.length % 6) * 24; return [...ws, { id, kind, file, title: kind === "editor" ? `${file} — Text editor` : kind === "files" ? "Files — File manager" : kind === "game" ? "Paper Arena — Game" : "Web search — Browser", x: (kind === "editor" ? 160 : kind === "game" ? 120 : 230) + step, y: (kind === "editor" ? 58 : kind === "game" ? 28 : 88) + step }]; }); raise(id);
  };
  const close = (id: string) => {
    setWindows(ws => ws.filter(w => w.id !== id));
    setFocusOrder(order => order.filter(key => key !== id));
    refocus(active === id ? focusNext(id) : active);
  };
  const minimize = (id: string) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, minimized: true } : w));
    if (active === id) focusNext(id);
    refocus(id);
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
  const fileText = (file: string) => docs[file] ?? "";

  return <motion.main onContextMenu={e => { if ((e.target as HTMLElement).closest(".app-window, .panel, input, textarea, .desktop-menu")) return; e.preventDefault(); menuOpener.current = null; setMenu({ x: Math.min(e.clientX, window.innerWidth - 205), y: Math.min(e.clientY, window.innerHeight - 180) }); }} className="wb-root" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.25 }}>

    <div className="desktop-icons">
      {[
        { id: "start-here.txt", label: "start-here.txt", Icon: FileText, launch: () => open("editor", "start-here.txt") },
        { id: "experience.txt", label: "experience.txt", Icon: FileText, launch: () => open("editor", "experience.txt") },
        { id: "skills.txt", label: "skills.txt", Icon: FileText, launch: () => open("editor", "skills.txt") },
        { id: "projects", label: folderName, Icon: Folder, launch: () => { setFolder("Projects"); open("files"); } },
        { id: "browser", label: "Web search", Icon: Globe, launch: () => open("browser") },
        { id: "game", label: "Paper Arena", Icon: Crosshair, launch: () => open("game") },
        ...Object.keys(files).map(file => ({ id: file, label: file, Icon: FileText, launch: () => open("editor", file) })),
      ].map(({ id, label, Icon, launch }) => <div key={id} className="desktop-item">
        <button className={`desktop-icon ${selected === id ? "selected" : ""}`} aria-label={label} title={label} aria-pressed={selected === id}
          onClick={() => { setSelected(""); setMenu(null); launch(); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); launch(); } if (e.key === "F2" && id === "projects") { e.preventDefault(); beginRename(); } }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelected(id); menuOpener.current = e.currentTarget; setMenu({ x: Math.min(e.clientX, window.innerWidth - 205), y: Math.min(e.clientY, window.innerHeight - 180), target: id }); }}>
          <span className="icon-art"><Icon size={28} strokeWidth={1.75} aria-hidden="true" /></span>
          {!(renaming && id === "projects") && <span className="icon-label">{label}</span>}
        </button>
        {renaming && id === "projects" && <form onSubmit={e => { e.preventDefault(); void commitRename(); }}>
          <input ref={renameInput} className="rename-input" aria-label="Folder name" maxLength={80} value={draftName} disabled={renameBusy} onChange={e => setDraftName(e.target.value)} onBlur={() => { if (!renameBusy) void commitRename(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setRenaming(false); setRenameError(""); e.currentTarget.closest(".desktop-item")?.querySelector("button")?.focus(); } }} />
          {renameError && <span className="rename-error" role="alert">{renameError}</span>}
        </form>}
      </div>)}
    </div>
    {menu && <><div className="menu-dismiss" onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null); }} /><div className="desktop-menu" role="menu" style={{ left: menu.x, top: menu.y }} onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); setMenu(null); menuOpener.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const items = [...e.currentTarget.querySelectorAll("button")]; items[(items.indexOf(document.activeElement as HTMLButtonElement) + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
    }}>
      {menu.target && <button role="menuitem" autoFocus onClick={() => { const target = menu.target; setMenu(null); if (target === "projects") { setFolder("Projects"); open("files"); } else if (target === "browser") open("browser"); else if (target === "game") open("game"); else open("editor", target); }}>Open</button>}
      {menu.target === "projects" && <button role="menuitem" onClick={beginRename}>Rename <span>F2</span></button>}
      <button role="menuitem" autoFocus={!menu.target} onClick={() => { setMenu(null); setNewName("Untitled.txt"); setCreateError(""); setCreating(true); }}>New text file</button>
      <button role="menuitem" onClick={() => { setMenu(null); setFolder("Home"); open("files"); }}>Open file manager</button>
    </div></>}

    {creating && <div className="create-overlay"><form className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" onSubmit={e => { e.preventDefault(); void createFile(); }} onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); if (!createBusy) { setCreating(false); menuOpener.current?.focus(); } }
      if (e.key === "Tab") { const items = [...e.currentTarget.querySelectorAll<HTMLElement>("input, button")], edge = items[e.shiftKey ? 0 : items.length - 1]; if (document.activeElement === edge) { e.preventDefault(); items[e.shiftKey ? items.length - 1 : 0].focus(); } }
    }}>
      <h2 id="create-title">New text file</h2>
      <label>File name<input autoFocus aria-label="File name" value={newName} maxLength={80} disabled={createBusy} onFocus={e => e.target.select()} onChange={e => setNewName(e.target.value)} /></label>
      <p>{isLive ? "Temporary session — files will be lost when you reload." : "Saved in this browser. Changes to your text save automatically."}</p>
      {createError && <p className="create-error" role="alert">{createError}</p>}
      <div className="actions"><button className="btn primary" disabled={createBusy}>Create</button><button type="button" className="btn" disabled={createBusy} onClick={() => { setCreating(false); menuOpener.current?.focus(); }}>Cancel</button></div>
    </form></div>}

    <AnimatePresence>
    {windows.map(w => <AppWindow taskRefs={taskRefs} key={w.id} win={w} z={10 + focusOrder.indexOf(w.id)} onFocus={() => raise(w.id)} onClose={() => close(w.id)} onMin={() => minimize(w.id)} onMax={() => toggleMax(w.id)}><WindowContent files={files} onSaveFile={onSaveFile} folderName={folderName} win={w} folder={folder} setFolder={setFolder} open={open} note={note} setNote={value => { setNote(value); setSaveState("idle"); setSaveError(""); }} save={save} saveState={saveState} saveError={saveError} isLive={isLive} fileText={fileText} /></AppWindow>)}
    </AnimatePresence>
    <motion.footer className="panel" initial={{ y: reduced ? 0 : 14, opacity: reduced ? 1 : 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reduced ? 0 : 0.25 }}>
      <span className="panel-brand">JANI//OS</span>
      <nav className="panel-launchers" aria-label="App launchers">
        <button onClick={() => open("files")} title="Open Files" aria-label="Open Files"><Folder size={18} aria-hidden="true" /></button>
        <button onClick={() => open("browser")} title="Open Web search" aria-label="Open Web search"><Globe size={18} aria-hidden="true" /></button>
        <button onClick={() => open("editor", "notes.txt")} title="Open Notes" aria-label="Open Notes"><NotebookPen size={18} aria-hidden="true" /></button>
        <button onClick={() => open("game")} title="Open Paper Arena" aria-label="Open Paper Arena"><Crosshair size={18} aria-hidden="true" /></button>
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
          <span className="task-icon" aria-hidden="true">{w.kind === "files" ? <Folder size={16} /> : w.kind === "browser" ? <Globe size={16} /> : w.kind === "game" ? <Crosshair size={16} /> : w.file === "notes.txt" ? <NotebookPen size={16} /> : <FileText size={16} />}</span>
          <span className="task-label">{w.file || (w.kind === "files" ? "Files" : w.kind === "game" ? "Paper Arena" : "Web search")}</span>
        </motion.button>)}
      </nav>
      {isLive && <span className="panel-status">TEMPORARY SESSION</span>}
      <Clock />
    </motion.footer>
  </motion.main>;
}

// The time and the date at the right end of the taskbar, in the visitor's own format.
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // The next change is at the start of the next minute.
    const timer = setTimeout(() => setNow(new Date()), 60000 - (Date.now() % 60000));
    return () => clearTimeout(timer);
  }, [now]);
  return <time className="panel-clock" dateTime={now.toISOString()}><strong>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>{now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</time>;
}

function WindowContent({ files, onSaveFile, folderName, win, folder, setFolder, open, note, setNote, save, saveState, saveError, isLive, fileText }: ContentProps) {
  if (win.file && Object.hasOwn(files, win.file)) return <SavedFileEditor name={win.file} initialText={files[win.file]} onSave={onSaveFile} isLive={isLive} />;
  if (win.file === "start-here.txt") return <div className="window-body"><h1>I&apos;m <span>Jani.</span></h1><p>I&apos;m a software engineer. I build web and mobile products for startups and clients.</p><div className="welcome-actions"><button className="btn primary" onClick={() => open("game")}>Play Paper Arena</button><button className="btn" onClick={() => open("editor", "experience.txt")}>Experience</button><button className="btn" onClick={() => { setFolder("Projects"); open("files"); }}>Projects</button><button className="btn" onClick={() => open("editor", "contact.txt")}>Contact</button></div><div className="rule" /><p className="welcome-hint">This site works like a desktop. Click an icon to open it. Paper Arena is a multiplayer pistol game that runs in a window here.</p></div>;
  if (win.kind === "game") return <Game />;
  if (win.kind === "browser") return <div className="window-body"><form className="browser-form" onSubmit={e => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim(); if (q) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`, "_blank", "noopener"); }}><input name="q" aria-label="Search the web" placeholder="Search the web…" /><button>Search</button></form><div className="browser-hint">Search opens a real browser tab.</div><div className="bookmarks"><a className="bookmark" href="https://www.kishcoach.com/" target="_blank" rel="noopener"><strong>KishCoach</strong><small>Coaching marketplace · opens externally</small></a><a className="bookmark" href="https://apps.apple.com/us/app/frenzz/id6762831131" target="_blank" rel="noopener"><strong>Frenzz</strong><small>iOS app on the App Store · opens externally</small></a><a className="bookmark" href="https://github.com/Prezcot" target="_blank" rel="noopener"><strong>GitHub</strong><small>github.com/Prezcot · opens externally</small></a><a className="bookmark" href="https://www.linkedin.com/in/janindu-mapa" target="_blank" rel="noopener"><strong>LinkedIn</strong><small>linkedin.com/in/janindu-mapa · opens externally</small></a></div></div>;
  if (win.kind === "files") return <div className="file-layout"><nav className="file-tree"><button className={folder === "Home" ? "active" : ""} onClick={() => setFolder("Home")}>Home</button><button className={folder === "Projects" ? "active" : ""} onClick={() => setFolder("Projects")}>{folderName}</button></nav><div className="file-content"><h3>{folder === "Projects" ? folderName : folder}</h3><p>{folder === "Projects" ? "Things I have built. Click a file to read about it." : "Files on this desk. Click a file to open it."}</p><div className="file-list">{(folder === "Home" ? ["start-here.txt", "experience.txt", "skills.txt", "contact.txt", "notes.txt", ...Object.keys(files)] : projectFiles).map(f => <button key={f} onClick={() => open("editor", f)}><FileText size={16} aria-hidden="true" />{f}</button>)}</div></div></div>;
  const editable = win.file === "notes.txt"; return <div className="window-body"><div className="editor-meta">plain text · {editable ? "editable" : "read only"}</div>{editable ? <><textarea value={note} onChange={e => setNote(e.target.value)} disabled={saveState === "saving"} aria-label="Notes" /><div className="editor-actions"><button className="btn primary" onClick={save} disabled={saveState === "saving"}>Save</button><span>{saveState === "saving" ? "Saving…" : saveState === "saved" ? (isLive ? "Saved for live session." : "Saved in this browser.") : saveState === "error" ? `Could not save: ${saveError}` : ""}</span></div></> : <><pre className="editor-copy">{linked(fileText(win.file || "start-here.txt"))}</pre><button className="download" onClick={() => { const url = URL.createObjectURL(new Blob([fileText(win.file || "start-here.txt")], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = win.file || "note.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download</button></>}</div>;
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
