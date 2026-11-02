# WORLD//PATCH development evidence

## Phase 0 — 28 October 2026

Implemented: PRD, DESIGN, ARCHITECTURE, PLAN, CHECKLIST and AGENTS before any feature code. Captured main session ID from runtime. Retrieved official rules/dates/submission fields through Devpost connector. Three independent agents covered architecture/security, game/novelty and QA.

Verified: empty starting folder; source planning precedes features; checklist contains more than 55 independently verifiable checks; docs incorporate frozen snapshots, four-endpoint portals, incomplete-search outcome, hidden witness and checkpoint reset. Reviews are preserved alongside primary-source links. No runtime functionality exists yet.

Risks: real Twitch verification requires account/app setup by user. Public hosting/video/repository/submission remain unauthorized and unverified. Official FAQ UTC and structured judging date inconsistencies recorded; formal submission deadline is authoritative.

Next: implement and execute deterministic kernel tests before rounds/server work.

## Phase 1 — 28 October 2026

Implemented: immutable pure transition and detailed movement frames; strict patch parser; gravity, four-endpoint portals, ice and wall groups; key/exit; bounded BFS and witness replay; three authored chambers.

Verified: `npm test -- --reporter=json --outputFile=evidence/kernel-tests.json` passed 42 tests including 600 seeded property trials; typecheck and lint passed at the kernel exit. All baselines solve: Vector Foundry 18 inputs, Crosswire 18, Thin Ice 12. Vector Foundry wall A closure increases shortest witness to 24; Crosswire crossed portals changes it to 14; ice changes actual movement/path. Gravity down exhausts search without an escape in all three initial states. These are local engine results, not human playtesting or Twitch evidence.

Risks: future moves can trap the player, so checkpoint reset remains required; solver proof is model-relative. Final integration/browser behavior not yet executed.

Next: trusted room state machine, atomic storage/replay and HTTP control plane. Twitch adapter can be implemented independently against the reviewed interface; live integration exit awaits account.

## Phase 2 — 28 October 2026

Implemented: host login and same-origin control APIs, public read-only WebSocket snapshots, bounded proposal/vote state machine, one ballot per participant, deterministic ties, moderation, immutable source provenance, SQLite atomic state/events, versioned replay verifier and private reveal-gated export. Public snapshots hide witness and participant identity. Provider timestamps bind live commands to their actual window.

Verified: broad suite passed 105 tests at the phase exit, including real loopback HTTP/WebSocket behavior and SQLite restart/tamper/failure tests. Reports: evidence/server-tests.json and tests/http.test.ts, room.test.ts, storage.test.ts. Independent review found and repaired disk-failed disconnect cancellation and paused/cooldown write amplification; tests show recovered storage cancels rather than merges the interrupted election. Root added further capacity checks afterward; final count is in the final report.

Risks: trusted server still owns ballot identity; hash links are integrity checks, not signatures. Public production limits and hosted recovery remain unverified. No deployment occurred.

Next: integrate the completed Twitch adapter and presentation, then run the full real-browser loop.

## Phase 3 — 28 October 2026 (local exit; live exit BLOCKED)

Implemented: server-side authorization-code flow, browser-bound one-time OAuth state, memory-only token lifecycle, identity/scope validation, same-account chat subscription, reconnect migration/cold retry, gaps, dedupe, revocation and sanitized health.

Verified: 31 adapter fixture tests passed at the adapter exit. HTTP tests verify host/state/origin boundaries and refuse a live session without a ready subscription. Independent security review is evidence/security-review.md. Provider event timestamps are preserved separately from arrival time so the room can reject earlier-window input.

Not verified: actual account registration, OAuth grant, real chat events, real provider reconnect, broadcast or OBS capture. User has no Twitch account. These remain BLOCKED. The local adapter tests cannot satisfy those checks.

Next: proceed to Phase 4 against the tested transport contract under PLAN's explicit blocked-live-proof exception; account setup can occur independently.

## Phase 4 — 28 October 2026

Implemented: React/Phaser controller and OBS overlay; geometric board; keyboard/touch play; patch desk, timers, laws, rejection/empty/paused states; authenticated host controls; connection/setup/simulation/moderation; fairness tallies and receipts; exact-frame ghost replay; accessible text map and reduced motion.

Verified: final Chromium production-browser suite passed 6/6. It exercises a rejected lockout, proposal/ballot/merge, replay under frequent snapshots, actual player escape in a patched chamber, ghost key reset, replay export/reverification, keyboard/typing, mobile touch/reduced motion, overlay read-only/chamber updates, mobile socket outage/recovery and empty/pause/cancel. Pixel tests verify the board is actually painted. The explicit maximum-ballot presentation fixture fits board/laws and all eight choices in both 1080p and 720p.

Repairs: visual inspection caught the blank initial canvas missed by DOM checks. Independent review caught replay timers resetting on unchanged snapshots, incorrect ghost key/exit presentation, clipped full ballots, hidden mobile health and a floating host toolbar covering controls. All were repaired and relevant browser tests passed. Historical failing reports are retained.

Risks: no physical OBS capture, real Twitch audience, human comprehension/entertainment test, Firefox/Safari or Linux browser pass. Later replay controls remain local to each view, documented in live runbook.

Next: final hardening and source packaging; live gates remain blocked.

## Phase 5 — 28 October 2026

Implemented: focused review repairs, resource limits, archived replay export, production restart harness, replay CLI and release evidence.

Verified: 110/110 tests (42 engine, 31 Twitch fixtures, 19 room, 6 SQLite/replay, 10 HTTP/WebSocket, 2 capacity), typecheck, ESLint, production build, clean npm install in an isolated directory, native SQLite query, clean build and seven production restart checks. Dependency audit reports zero known vulnerabilities. The browser-generated simulation export also passed the CLI replay verifier. Source inspection found no eval/new Function/dangerous HTML/browser token storage in application source. Runtime tested: Node26.12.0, npm11.20.0, macOS arm64, Chromium156.0.8078.4.

Risks: package minimum Node22.12 was not separately executed; Docker/remote TLS/hosted volume behavior unverified; audit is a point-in-time known-vulnerability check, not complete security proof. Current independent scoped security review has no unresolved P0/P1 finding after repairs.

Next: complete local delivery documents/source archive, then user account/app creation and genuine live validation.

## Phase 6 — local delivery; external release BLOCKED

Implemented: README, local and one-account Twitch setup, deployment recipe, live shot plan, Devpost draft, verification report, 88-check evidence ledger, session provenance and source packaging.

Verified: setup commands were exercised through clean install/build and production entry point; docs reference actual APIs and limitations; final reports distinguish simulation, injected provider fixtures and unexecuted live gates. Source package includes code/assets/config/tests/docs and evidence, excluding dependencies, build output, private environment and databases. Packaging inspection and manifest are recorded in evidence/package-verification.json and evidence/source-manifest.json.

Remaining: Twitch account/app/consent, real chat and reconnect, actual livestream/OBS evidence, chosen remote deployment, judge repository access, publicly viewable under-three-minute video, personal attestations and actual submission. No publication or spending occurred. The result is a verified local build, not a submission-ready claim.

## 29 October — requested design-tool refinement

Implemented with motion-design: exact changed-law feedback from authoritative receipts, focused law highlight, phase/escape transitions, explicit portal pairs and correct ghost replay heading. Independent source review identified the merge cleanup and replay-heading defects; both were repaired. Verified:110/110 tests,6/6 browser journeys with added motion lifecycle/reduced-motion assertions, typecheck, lint and build. Open Design generation is separate and has not yet run.

Open Design setup: official download page opened with explicit user permission; user chose Local Codex. App 0.26.1 was detected afterward, its signature verified and its local MCP registration confirmed enabled. Current chat has no callable Open Design tools. User explicitly authorized a new Open Design chat using the existing brief and skipping repeated questions. The next highest-priority design work is that attributed workflow and integrating its actual output into the working game, then rerunning affected checks. No Cloud/BYOK switch or spending is authorized.

## 30 October — interactive marketing landing verification

Implemented: recovered Local Codex landing stylesheet, compact top-aligned hero, enlarged typography, above-board patch controls, nearby verdict, visible sandbox jump and preserved real game/overlay paths. Original shared engine/solver/Phaser and server contracts retained.

Verified: typecheck/lint/build PASS; full9-browser suite PASS (57.4s); after final copy correction, build and3 landing journeys PASS (9.6s). Desktop initial actions1440×900/1280×720, mobile390×844, keyboard/reduced motion/touch bounds, accepted/rejected laws, keyed exit witness/reset, room isolation and local OAuth-result routing passed. See landing-refinement-verification.json and landing-refinement-final-tests.json.

Remaining: design generation terminal status canceled, with partial source recovered and accurately attributed. Genuine Twitch account/app/OAuth/chat/reconnect and OBS evidence are blocked; public hosting/repo/video/eligibility/submission remain unresolved. No external action or spend performed. Next highest-priority work is actual one-account Twitch setup and live verification.

## 30 October — real Twitch setup

Implemented/configured: verified account security, confidential Game Integration app, exact local callback, private credentials and server restart. Verified: actual OAuth grant and real EventSub subscription ready; secret excluded from public APIs/frontend/source archive. Evidence: twitch-live-connection.json and twitch-connected.png. Remaining: public test-message approval, actual chat proposal/vote/merge, provider reconnect and broadcast evidence. Next priority: execute the approved three-message own-channel test. No source-level integration change was needed.

## 30 October — actual Twitch chat/game/replay exit

Implemented: repaired opaque provider event/message ID ingestion with the shared 256-character limit, preserved strict actor/session validation and exact independent dedupe. Added meaningful room and adapter→room→merge→replay regressions. Updated the live shot plan to fit the real 25-second proposal and 20-second voting windows.

Verified: typecheck/lint/build, all 112 tests, all 12 production-browser journeys and independent scoped security review. Actual Twitch commands rejected gravity down, accepted wall A closed, counted one ballot and merged revision 1 with a 24-input witness. The operator escaped through 24 real movement-control clicks, then revealed and played the witness to its exit. The actual browser-exported 36-event Twitch replay independently reconstructed one merge and the escaped final game. Evidence: twitch-live-validation.json and linked reports/captures.

Remaining: actual provider reconnect and OBS/livestream capture; authorized public judge demo/repository/video; entrant attestations and actual submission. No new audience, remote provider outage, deployment or submission was invented. Next highest priority is continuous Twitch/OBS/Codex demo capture and provider recovery evidence, followed by authorized external delivery.
