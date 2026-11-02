# WORLD//PATCH

**Chat changes the rules. You find the exit.**

A browser puzzle show where Twitch viewers propose bounded changes to gravity, portal pairing, ice and wall groups. The streamer plays the transformed chamber. A deterministic verifier accepts a patch only after finding and replaying an escape witness from the exact frozen world snapshot. End the attempt to reveal the route and inspect its receipt.

Built with OpenAI Codex during the Codex × TwitchCon Hackathon. Main session: **`01a1807d-e70b-7572-bc0d-a4f29b37d1b8`**.

> Release status: **114 tests and 22 production-browser journeys passed on 2 November 2026**, plus typecheck, lint and build. The repaired source then completed a recorded real Twitch proposal/vote/merge, a 24-move player escape and the revealed witness. Its 36-event replay independently verified. OBS captured the actual game and chat at 1080p30. The 96-second Twitch/Codex edit passed local metadata, cadence and selected-frame review; judge repository access, video publication and submission remain pending. [Verification and limits](VERIFICATION.md). **Not submission-ready.**

## Run the game

Requirements: Node.js ≥22.12, npm, a modern browser and a writable local data directory. Exact tested runtime and commands are in the verification report. No paid service or API model is required. A Twitch account is needed only for live mode.

```sh
npm ci
cp .env.example .env
# Edit .env: set HOST_SECRET to at least 24 random characters.
npm run build
npm start
```

Open **http://localhost:3000** and choose **Play the demo** to try the local sandbox without signing in. Choose **Host a chamber**, or open **http://localhost:3000/play** directly, for host controls. Enter HOST_SECRET to use the controller. The read-only OBS/spectator view is **http://localhost:3000/overlay**. If Twitch configuration is absent, the app stays in clearly labeled simulation. It never invents a live connection.

Detailed instructions: [local setup and one-account Twitch](docs/LOCAL-SETUP.md), [live demonstration](docs/LIVE-DEMO.md), [persistent deployment](docs/DEPLOYMENT.md).

## Try the homepage sandbox

Choose **Play the demo** on the home page to focus the playable board without signing in. You can change laws in the sandbox. Use arrows/WASD, or use the touch buttons. Collect K and reach OUT. **Restart attempt** keeps the applied law; **Reset sandbox** restores the original world. **See checked route** starts from the verified checkpoint so you can inspect the stored route one move at a time. The text map is available during play. Choosing Play the demo again returns to your current attempt. This browser-only sandbox needs no host login and does not change the room, chat or votes.

## Play one round

1. Unlock the host controls. Choose a chamber under **Start a new chamber**, then press **Start**. Selection alone preserves the current attempt; Start creates a fresh session. Reveal and export first if you need its replay. Focus the board and use arrows/WASD, or the on-screen D-pad. Collect the key, then enter OUT.
2. Open a patch round. Movement freezes while chat proposes for 25 seconds, then votes for 20 seconds. The host can close a window early or pause it.
3. Propose one of the commands below. Only validated, solvable candidates enter the ballot. Each participant has one accepted proposal per round and a two-second command cooldown.
4. Vote by the candidate's visible number. One ballot per participant; later votes replace earlier votes. Ties use canonical patch-key order. No votes means no merge.
5. The winning patch is checked again, saved with its witness, then applied. Escape, or end the attempt with Reveal to inspect the witness. Reset returns to the verified checkpoint if subsequent moves trap you.

In simulation, **Try the audience side** sends local commands through the real checks without posting to Twitch. Its suggestions follow the phase and actual candidate numbers; editing a command preserves your text through unrelated room updates. Cooldowns still apply.

Reveal moves keyboard focus to witness inspection. Use **Witness step** to seek, **Step** for one move, or Play/Pause and 0.5×/1×/2× speed. Seeking pauses playback and leaves the saved player attempt unchanged. Reduced motion uses manual steps or seeking. Each controller/overlay has its own timeline; use OBS Browser Source Interact to control that overlay.

| Chat command | Bounded effect |
| --- | --- |
| `!patch gravity up` (also down/left/right/off) | One drift cell after a legal movement |
| `!patch portals crossed` (or normal) | Re-pairs four fixed numbered endpoints |
| `!patch ice on` (or off) | Slides across marked ice until floor or obstruction |
| `!patch walls A closed` (A/B, open/closed) | Changes only the designated wall group |
| `!vote 1` | Casts or changes your ballot for a verified candidate |

For a useful local demonstration in Vector Foundry, propose `!patch walls A closed`. Its initial shortest route changes from 18 inputs to 24. `!patch gravity down` has no escape from that initial state and is rejected. These numbers are executed engine results, not human difficulty ratings. Commands can be invalid or unsolvable from other checkpoints; the solver checks the actual state.

The three chamber cards on the homepage also launch their actual maps locally. Vector Foundry offers a gate change, Crosswire offers crossed portal pairs, and Thin Ice offers slippery floor. Each accepted law is checked and replayed before use. Finish an attempt to continue to the next chamber, or choose Host a chamber for the protected controller. Reset sandbox restores the selected chamber's initial laws; selecting its card again returns to an active attempt.

## Three chambers

- **Vector Foundry:** readable gates, drift and an ice crossing. Learn how one changed law alters a route.
- **Crosswire:** four numbered portals and two pairings change the route across a partition.
- **Thin Ice:** sliding, braking walls and portal choices interact in a compact escape.

The player, solver, animation frames and witness replay all use the same transition implementation. Phaser draws the result; it does not run a separate physics simulation.

## What the fairness receipt proves

It shows an executable route from a named checkpoint, under a named engine/chamber version and the accepted rules. BFS reports `solved`, `unsolvable` only after frontier exhaustion, or `incomplete` after its resource budget. Only `solved` can be accepted. The stored witness is replayed before acceptance and hidden from spectator payloads until Reveal.

It does not prove every later player move is safe, that a puzzle is fun, or that the server administrator cannot forge history. Reset recovers the committed solvable checkpoint. SHA-256 digests detect changed evidence under the verifier; they are not external signatures. Ballot uniqueness relies on trusted Twitch identities and the server, not a public cryptographic voting system.

## Verify and inspect evidence

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke:production
npx playwright install chromium   # once, if the browser is absent
npm run test:browser
npm run replay -- path/to/world-patch-replay.json
```

Browser tests launch the production build on loopback port 3107 with isolated temporary storage. They require permission to start local listeners and launch Chromium. Unit/property/room/storage/HTTP tests and Twitch lifecycle fixtures are distinct from actual Twitch integration. Reports live under `evidence/`; the complete status ledger is [CHECKLIST.md](CHECKLIST.md).

Export a replay from the authenticated controller after revealing the attempt. The CLI reconstructs game state from ordered actions, checks the event hash chain and replays every accepted witness. It rejects invalid engine versions, changed receipts and mismatched final states.

## Twitch and security

The server uses authorization-code OAuth and EventSub WebSockets. One broadcaster account authorizes `user:read:chat`; the subscription uses that same account as broadcaster and reader, and accepts its own chat messages. No separate bot, Bits purchase, audience, extension review or outbound chat posting is required.

OAuth state is short-lived, browser-bound and single-use. Tokens are kept in server memory, validated on acquisition/hourly and refreshed as needed. Restart requires Twitch sign-in again. A requested EventSub migration preserves the subscription; a dropped connection has an unrecoverable gap and cancels any election. If storage is unavailable during cancellation, the room cannot later merge that interrupted vote.

Chat is untrusted. Commands have a strict typed grammar; raw JavaScript, arbitrary coordinates and generated code are never executed. Host HTTP actions require an HttpOnly session cookie and exact Origin; the WebSocket stream is read-only. Provider input is bounded, channel-checked, deduplicated and timestamp-checked. The public overlay receives neither tokens, raw participant identifiers nor unrevealed witnesses.

## Configuration and operations

| Variable | Purpose |
| --- | --- |
| `HOST_SECRET` | Required host login secret, ≥24 random characters |
| `PUBLIC_ORIGIN` | Exact browser origin; default `http://localhost:3000`; remote requires HTTPS |
| `HOST`, `PORT` | Listen address/port; defaults 127.0.0.1 / 3000 |
| `DATA_DIR` | Persistent SQLite directory; default `./data` |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Own registered application credentials |
| `TWITCH_REDIRECT_URI` | Exact registered OAuth callback |

Run a single process with persistent storage. Defaults: 8 candidate slots, 1,000 participants/round, 10,000 retained command identities/session, 20,000 events/session, 20 archived sessions and 32 spectator sockets. Ordinary actions stop at 19,997 events, retaining three slots within the 20,000-event hard cap for election progress/cancellation, startup recovery and Reveal. A capacity error preserves the last committed state: cancel any open election, Reveal, export, then start a new session. Cooldown/paused spam does not append evidence rows. Source mode is fixed per session; switching starts a new one. To clear capacity, export/review evidence, stop the app, and archive the entire data directory before using a new one. There is no automatic evidence deletion. This reservation prevents new ordinary-action saturation; it cannot add space to a legacy session already at the hard cap. Preserve/back up that original data directory and use a fresh DATA_DIR if a pre-fix session cannot Reveal. Do not edit its event history or raise the cap to manufacture evidence. See deployment guide for backups, proxy/TLS, rollback and limitations.

## Source map

`src/shared/engine.ts` and `chambers.ts` define the model; `commands.ts` parses chat; `protocol.ts` defines API state. `src/server/room.ts` owns rounds; `storage.ts` and `replay.ts` own durable evidence; `twitch.ts` owns provider lifecycle; `app.ts` owns HTTP/auth/streaming. `src/client/` is the controller and OBS presentation. `tests/` contains the executable acceptance checks.

The [offline Codex development evidence viewer](docs/codex-evidence/index.html) preserves a selected source-writing record, current shared-rule excerpts and executed verification summaries without exporting the raw session. Open the local HTML file; it makes no network requests. This is a curated evidence viewer, not a recreation of the native Codex interface.

The six first-action documents are [PRD](PRD.md), [design](DESIGN.md), [architecture](ARCHITECTURE.md), [plan](PLAN.md), [checklist](CHECKLIST.md) and [coding contract](AGENTS.md). [Devpost copy](docs/DEVPOST.md) and [phase evidence](evidence/phase-log.md) preserve scope and provenance.

Original source/assets were authored for this project. Third-party runtime libraries retain their MIT licenses; see [THIRD_PARTY.md](THIRD_PARTY.md). No third-party game art, music or branding is bundled. No project-wide open-source license has been selected by the owner.

## Submission boundary — checked 2 November 2026

The organizer requires a judge-accessible code repository, a YouTube video of at most three minutes with real Twitch functionality and Codex usage, a description and the main Codex session ID. The latest announcement permits unlisted YouTube videos; private videos do not qualify. A private GitHub/GitLab repository must be shared with the organizer's testing account. A website is optional. The deadline is **2 November 2026 at 14:00 Pacific / 22:00 UTC / 3 November 03:30 India**. Exact official evidence is retained in evidence/official-hackathon-nov2.json.

Eleven specifically authorized public Twitch test messages were posted: five on 30 October, three during the failed first 2 November recording and three during the corrected successful recording. The failed merge remains in its own replay. In the corrected run, gravity down was rejected, wall A closed won one real ballot, the verified law merged and the player escaped in 24 inputs before witness playback. No further messages are authorized. A local staged release checkout is preparation only: no public repository, video upload or competition submission is claimed.
