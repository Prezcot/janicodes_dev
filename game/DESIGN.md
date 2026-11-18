# Paper Arena: design record

The single record of what the game is, what is built, and what is verified. Update it when a decision or the build state changes. "Paper Arena" is a working title.

## Design, confirmed by Jani on 2026-11-17

**Game**
- Free-for-all pistol shooter for desktop, with mouse and keyboard.
- It opens as an app window in the Workbench desktop, with a full-screen button.
- Look: Workbench paper style (paper surfaces, ink edges, hatched crates and low walls), Folded paper bodies, eight player colours.
- Colours: the "Sea glass" theme, picked by Jani on 2026-11-17. Cream paper, an aqua desk, deep teal ink, coral accents, and sand. The desktop and the game share it.

**Rooms**
- The room list shows each room's random two-word name, player count out of 8, and time left. The lobby calculates the time left from the room's end time and the clock of the visitor's computer. If that clock is wrong, the time left is wrong, and the lobby can show "Ending" too early or too late. The room itself decides if a join is allowed.
- A player can join any open room or create one. At most 4 rooms exist at once. A created room that nobody joins leaves the list after 60 seconds.
- Join screen: a name and a free colour. The browser remembers both.
- Names: at most 16 characters, no word filter, a random funny name if left empty, a number added to a duplicate. The number comes after the 16 characters, so a duplicate name can be 18 characters or more.
- A room lives 30 minutes from the first join. The timer also runs for a player who is alone.
- Alone, a player can roam and shoot.
- A late joiner spawns at once with 0 kills. Nobody can join in the last 2 minutes. This includes a dropped player who tries to return.
- At 0:00 play stops and the final kill count shows for 15 seconds. Players who left are listed and marked "left". Most kills wins, and fewer deaths breaks a tie. Then everyone returns to the room list.
- A room closes at once when its last player leaves.
- A player with no input for 2 minutes is removed. Known limit: the browser of the removed player treats this as a dropped connection and joins again after 2 seconds. So an idle player with an open tab keeps the slot, and the room removes them again each 2 minutes.
- A dropped player has 20 seconds to reconnect and keep score, colour, and name. In the last 2 minutes of a room, a dropped player cannot return. A player who returns later continues their old score line.
- There is no chat.

**Combat**
- One pistol. Shots hit instantly and always go to the crosshair. Recoil is a camera kick only.
- 100 health. A body hit does 34 and a head hit does 100.
- 12 rounds, unlimited spare ammo, 1.5 second reload, one shot per click, at most 5 shots per second.
- After 5 seconds without damage, health returns at 20 per second.
- On death the body folds flat and fades in 2 seconds, and the dead player sees "Killed by" and the name.
- Respawn takes 2 seconds, at the spawn point farthest from other players, with 1.5 seconds of protection that ends early if you fire.
- Effects: muzzle flash, tracer, a bullet hole that everyone sees for 20 seconds, and a crosshair flash for a hit and for a headshot. At most 64 holes show at once, and hole 65 replaces the oldest one.

**Movement**
- Run at 6 metres per second. No sprint, slight air steering, no bunny hopping, no fall damage.
- A player is 1.8 metres tall. The jump reaches 1.25 metres.
- Crouch: hold Left Shift. 1.1 metres tall, half speed, silent footsteps, no slide.

**Map: Split level**
- 34 by 28 metres: a lower yard and an upper deck 1.4 metres high.
- Two ramps and one step crate lead up. Low walls and crates are 1.2 metres high.
- Eight spawn points, five in the yard and three on the deck.

**Screen, sound, and controls**
- On screen: crosshair, health, ammo, kill feed, time left. Tab shows kills and deaths. The top right corner shows the frame rate, and in a room the ping. The kill feed is under them. The frame rate is the count of frames that the game rendered in the last second of real time. After a hidden tab or a minimized window shows again, the frame rate is blank until one new second is counted. The game does not handle a lost graphics context, and the frame rate is not correct in that state. Known limit: the screen shows a new frame rate or ping only when the game draws a frame. So after a connection drop, or after a minimized window shows again, the old value stays for one frame, about 16 ms at 60 fps. Known limit: the counters add one row above the kill feed, 18 px, or 32 px when they wrap in a narrow game. So in a small game window a kill feed with three or four rows reaches "Killed by" sooner than before. With four one-line rows, in a game narrower than about 540 px, this now happens under about 410 px of height. Before, it happened under about 355 px. Rows with long names that wrap make it happen in larger windows.
- A name shows when your crosshair is on that player. No name tags float above heads.
- Sounds made in the browser: shot, empty click, reload, hit, death, and other players' footsteps within about 15 metres.
- Keys: WASD, Space, Left Shift, R, left click, Tab, and Esc for the game menu.
- Settings: mouse sensitivity and volume. They are in the lobby, and in the game menu that shows when the mouse is free after play has started. The first screen of a match shows "Click to play", the key hints, the "Full screen" button, and the "Leave room" or "Leave practice" button. The settings and "Resume" show only after play has started. The match does not pause while the menu is open.
- Lobby: "Your player" on the left, with a preview of the paper figure in the chosen colour, the name, the colour, and the settings. Rooms and the key hints are on the right. In a narrow window the lobby is one column. The figure sways, and at random times it hops and spins, dances in a crouch, falls flat, or wobbles. A new colour arrives with a hop and a spin. The figure stays still when the system asks for reduced motion.
- Keyboard in the lobby: the arrow keys change the colour. The game shows a focus ring while the mouse is free. No label in the game is smaller than 12 pixels.
- Pistol looks: seven looks for the pistol, chosen in the pistol menu that opens from "Change pistol" in the lobby. "Ink steel" is the default. The others are "Hatched steel", "Paper cutout", "Blueprint", "Sand card", "Player colour", and "Flat grey". Every player in a room sees every other player's look. The choice is saved in the browser. The pistol keeps its shape of two boxes: each look is drawn in code onto the faces, so the site loads no image files for it.
- Esc inside the game window never closes the window. In the pistol menu it closes the menu.

**Hosting and cost**
- The site stays on Vercel. Multiplayer runs on Cloudflare Durable Objects on the Workers Free plan: one object per room, plus one for the room list.
- The Worker is named `paper-arena`. Its public address is `https://arena.janicodes.dev`. The site reads that address from `NEXT_PUBLIC_GAME_SERVER`, which is set on Vercel for production.
- The game must stay free. Durable Object classes must use SQLite storage (`new_sqlite_classes`).
- The game server answers only pages from the sites listed in `ALLOWED_ORIGINS` in `worker/wrangler.jsonc`: the production domains. It refuses every other request and socket with 403. An entry can have a star, which stands for one part of a host name. No entry has a star now. A page on the developer's own computer is always allowed. This stops other websites from using the server. It does not stop a script that sends a false origin.
- Storage: live match state in room memory; end time, players, and scores in the room's SQLite storage; name, colour, settings, and a player ID in the browser. Known limit: the room sends the ID of each player to all players in the room, so the ID is not secret. A player in a room can use the ID of another player to take that player's place.

## Code layout

- `game/sim/`: the simulation. All game rules, with no rendering, network, or browser code. It runs in the browser, on the server, and in tests. Tune numbers in `tuning.ts`.
- `game/net/`: `MatchConnection`, the seam between the client and wherever the match runs. `local.ts` runs a match in the tab. `remote.ts` plays in a room on the server, with prediction. `protocol.ts` holds the message types.
- `game/server/room.ts`: one room's logic, with no Cloudflare code, so it is tested in Node.
- `worker/`: the Cloudflare Worker. `GameRoom` adds sockets, a timer, and storage around `room.ts`. `Lobby` is the room list.
- `game/client/`: the three.js view, input, sound, room list, and screen display. `FigurePreview.tsx` draws the lobby figure with its own small renderer. `skins.ts` draws the pistol looks, and `PistolMenu.tsx` is the pistol menu. The colours and names of the looks are in `theme/theme.ts`, and `TUNING.skins` is how many the room accepts.
- `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`: the site icon, a paper pointer. The source drawing is `mockups/icons/pointer.svg`. The phone icon has a cream background.
- `app/workbench/`: the game is the `game` window kind.
- `theme/theme.ts`: the colour system. Every colour of the desktop and the game is defined there, with the eight player colours and their names. `app/layout.tsx` turns the desktop colours into CSS variables. The style files use only those variables. The one exception is `#000` in the mask of the crosshair in `game/client/game.css`. A mask shows no colour. `pnpm lint` refuses any other colour value outside `theme/theme.ts`, in code and in the style files.

Decisions made while building:
- No physics library. The map is only boxes and ramps, so `game/sim/collide.ts` does collision and ray tests. The Worker is 29 KiB. With the physics library it was 3.6 MB.
- Plain three.js, without React Three Fiber. The game is one imperative loop. React draws only the screen display.
- Movement runs in fixed steps of 1/60 second, one step for each input. The server applies the same steps, so the client predicts its own movement exactly.
- The client sends 3 inputs in one message, 20 messages per second. The room sends state 30 times per second.
- Ping: each 2 seconds of play, the client sends a `ping` message with its own clock time, and the room sends the time back in a `pong` message. The ping on screen is the time between the two. This adds 1 message to each 40 that a player sends. A hidden tab or a minimized game window sends no ping. An older room ignores `ping`, and the client then shows only the frame rate. The ping includes the time that the browser waits before it reads the answer. A browser that is busy with drawing reads it late, so the ping then reads too high. The ping is unknown again when the connection drops.
- Other players are shown 0.1 seconds in the past. For a shot, the server moves them back to where the shooter saw them, by at most 0.4 seconds.
- A deliberate "Leave room" frees the slot at once. A dropped connection holds the slot and colour for 20 seconds.

## Run it

- Solo: `pnpm dev --hostname 127.0.0.1`, then open the "Paper Arena" icon.
- Multiplayer on one machine: run `pnpm worker:dev` in one terminal. In another, run `NEXT_PUBLIC_GAME_SERVER=http://127.0.0.1:8787 pnpm dev --hostname 127.0.0.1`.
- Without `NEXT_PUBLIC_GAME_SERVER`, the game offers "Practice alone" only.

## Build state

Done:
- Simulation: movement, collision, jump, crouch, shooting, damage, reload, regeneration, respawn, spawn protection, room timer, join limits, colours, names, leaving, returning, idle removal, lag compensation, saving and restoring a room.
- Split level map.
- Room and room list on a local Cloudflare Worker.
- Client: room list, name and colour choice, prediction, other players' bodies, tracers, bullet holes, muzzle flash, hit flash, name under the crosshair, kill feed, scoreboard, "Killed by", final kill count, Esc menu with sensitivity and volume, sounds, footsteps.

Not done:
- Player bodies have no number plate and no walk animation.

## Verification

- Automated: `pnpm test` runs 73 tests of the simulation, the room logic, the room connection, and the origin check through their public functions.
- Live on one machine, 2026-11-17, with the Worker under `wrangler dev` and one browser player plus two scripted players:
  - Room list, create, join, and a refused colour worked. The fifth room was refused. An empty room left the list.
  - The browser player ran 6.00 m in 1 second in a room, so prediction and the server agree.
  - A headshot from the browser killed a scripted player: hit flash, kill feed, and scoreboard were right.
  - Three body shots killed the browser player: health went 66, 32, 0, "Killed by" showed, and the respawn worked.
- Colours, live on one machine, 2026-11-17, after the move to Sea glass: desktop, text editor, file manager, browser window, new file dialog, game lobby, room list, pause menu, scoreboard with four players, kill feed, and "Killed by" drew in the theme colours with no page error. A script read the colour of every text and control in nine screens and found none outside the theme.
- Live on Cloudflare and the production site, 2026-11-17: the Worker refused requests with no origin and from another site with 403, for the room list, room creation, and the socket. From `www.janicodes.dev`, two browser players created and joined a room, each received 30 updates per second, the scoreboard listed both, and the room left the list after both left.
- Lobby and site icon, live on one machine, 2026-11-17, in a browser with no window: the lobby drew with no page error, the figure changed colour with the swatch, and 40 pictures over 9 seconds showed the hop and spin, the crouch dance, and the wobble. The page served the three icon links, and each one loaded.
- Pistol looks, live on one machine, 2026-11-18, with the Worker under `wrangler dev`, in a browser with no window: the pistol menu opened, the arrow keys and a click changed the look, Esc closed the menu and left the game window open, and the choice was saved. Each of the seven looks drew on the pistol in a practice match with no page error. In a room with one browser player and two scripted players, each player received the others' looks, and a scripted player that sent no look got "Ink steel".
- Frame rate and ping, live on one machine, 2026-11-18, with the Worker under `wrangler dev`, in a browser with no window: in a room, the corner showed "60 fps" and "1 ms", and the browser sent 3 pings and got 3 answers in 5 seconds. A scripted player measured 1.4 to 3.4 ms for the same round trip. With drawing in software, the same room showed "16 ms". In practice the corner showed only "60 fps". With the frame callback slowed by a script, one frame each 200 ms read "5 fps", each 1200 ms "1 fps", and each 2500 ms "0 fps". After a minimize and restore, the frame rate was blank and then read "60 fps". In a game 298 px wide the counters wrapped and stayed 7 px clear of the timer. The place of the kill feed under the counters was checked with sample rows put into the page, not with real kills. Not checked: a second player, and a real change of tab.
- Review of the whole repository at `05b2718`, 2026-11-19: the review compared this record and `README.md` with the code. Where they did not agree, the record was changed to describe the code. No behaviour was changed. Each corrected line was read against the code. The same change added three checks to `pnpm lint` and removed the word `export` from 4 values that only their own file uses. The idle player who joins again was also seen in a scratch test by the reviewer.
- Not verified:
  - The fall flat gag, the lobby in a narrow window, and the site icon in a real browser tab and on a phone.
  - Another player's pistol look as drawn on their figure in a match. The room sends the right look to every player, and the lobby figure draws it, but nobody has looked at it in a match.
  - The final kill count screen in Sea glass, hover states, and narrow screens.
  - Mouse lock with a real mouse. The automated browser cannot lock the mouse, so the lock was simulated.
  - Sound. The automated browser has no audio output.
  - The final kill count screen, the reconnect after a dropped connection, and a room restart. Their logic is tested, but nobody has seen them run.
  - Lag between real players in different places.
