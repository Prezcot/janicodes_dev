# JANI//OS — Workbench

A personal portfolio that starts with an OS-style installer and opens onto an olive-and-parchment desktop. Built with Next.js 16, React 19 and TypeScript, based on the approved Workbench study in `mockups/02-workbench.html`.

## Run locally

Requires Node.js 20.9+ and the pinned pnpm version.

```sh
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. Use Install to save a workspace, or Skip for temporary exploration. The package-manager pin was updated from the broken pnpm 11.13.0 release to 12.4.1; application dependencies remain locked.

## Included

- Four-step installer with wallpaper selection, optional name and 10–100 MB saved-workspace budget.
- Desktop text files, sample projects, and a Home/Projects file manager.
- Resizable windows with direct dragging, shadow lift, close, minimize, restore and maximize controls.
- Motion transitions and Lucide icons; desktop shortcuts open on double-click.
- Desktop context menus, folder renaming and new text files with automatic saving.
- Editable notes with explicit Save, plus text-file downloads.
- Browser-style search launcher that opens DuckDuckGo in a real tab.
- IndexedDB persistence for installed settings, notes, folder names and created text files; returning visitors resume their desktop.
- Temporary live sessions, storage failure feedback and mobile layouts.

The slider caps the UTF-8 serialized workspace data saved by this app. It does not reserve disk space or set the browser's quota, and does not include downloaded application assets. Storage is used only for actual workspace data. Browser storage can be cleared or evicted. Live sessions do not persist edits. Unsaved notes remain available while switching windows; save them before leaving the desktop.

Portfolio details are currently labeled sample content. Replace the text in `app/workbench/desktop.tsx` with verified resume and project information before publishing. Window positions are session-only. General websites open externally; this is not an embedded Firefox engine.

## Structure

- `app/page.tsx`: startup, saved/live session state, ordered writes.
- `app/workbench/installer.tsx`: installation and customization.
- `app/workbench/desktop.tsx` and `desktop.css`: desktop and applications.
- `app/workbench/app-window.tsx`: window movement, resizing and animation.
- `public/studies/window-motion.html`: standalone movement comparison.
- `app/workbench/storage.ts`: validated IndexedDB reads/writes and byte-budget checks.
- `app/workbench/types.ts`: shared settings and workspace types.
- `mockups/`: five standalone design explorations, comparison gallery and original brief.

## Validation

```sh
pnpm typecheck
pnpm lint
pnpm build
```

Verified in Chromium: installation, settings/note persistence after reload (including empty notes), file navigation, search URL generation, window dragging/minimize/restore/maximize, and 390px layout. Storage validation and multibyte UTF-8 budget rejection were checked with Node's assertions against compiled storage code. Search launch was intercepted during testing; external results were not inspected.
