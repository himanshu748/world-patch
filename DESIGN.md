# WORLD//PATCH — broadcast design

## Art direction: an editable orbital test chamber

The world is a precision machine that chat can rewire. Black-blue laboratory surfaces, bone-white labels, electric amber patch highlights, glacial cyan ice, and violet paired portals form a coherent system. No borrowed Twitch branding, stock illustrations or generic SaaS dashboard. The hero is the puzzle board, surrounded by just enough instrumentation to explain who changed what and whether escape remains possible.

Brand lockup: `WORLD//PATCH`, compact uppercase with a double slash as the edit seam. Supporting sentence: “Chat changes the rules. You find the exit.” Status language stays concrete: “Proposals open,” “Vote now,” “Patch merged,” “No escape found,” “Verification incomplete,” “Twitch disconnected,” “Simulation.” Avoid “mathematically proven game” as a blanket claim. The proof applies to a named snapshot and engine version.

## Tokens

Canvas #090c12; panel #111722; elevated #1a2330; borders #334050; foreground #f3f0e7; muted #aab4c4; amber #ffc857; cyan #76e4f7; violet #bc9cff; error #ff8f89; success #b2f199. Use text and shapes alongside color. Standard UI uses system sans to avoid remote fonts; counters and rule text use ui-monospace. Headline 40–64px on wide displays, 30px mobile; section 18px; body 16px; utility labels at least 12px. Broadcast data uses at least 18px wherever practical. Spacing 4/8/12/16/24/32/48. Panels have 1px borders and modest 8–14px radii; key surfaces use square industrial corners. Focus ring 3px amber with 3px offset.

## Screen composition

Desktop controller: top brand + mode/connection; main 2:1 split with large board left and patch desk right; chamber name and phase above; current laws below; host dock at bottom; collapsible connection/setup and evidence details. The board should occupy at least half of the visible content, not become a thumbnail under control panels.

Spectator `/overlay`: same visual world with no host buttons, login, inputs or secrets; board, laws, candidates, countdown, connection/origin and latest receipt remain. It must be readable as a 1920×1080 OBS browser source and survive a 1280×720 capture. Keep important content 32px from edges. Reserve an optional lower-left camera space in OBS outside the browser region; do not cover board or commands. Instructions remain visible: `!patch gravity left` / `!vote 1`.

Mobile at 390px: board first, phase and controls next, candidates after; no page-wide horizontal scroll. D-pad buttons ≥44px. Every administrative control remains accessible without canvas interaction. Tablet stacks when the board would become too small.

## Board grammar

Square cells with restrained depth, inset tile outlines and coordinate ticks. Player = amber diamond with white core; exit = green outlined doorway labeled OUT; key = gold key/ring labeled K; normal wall = dark raised block; A/B switch walls = striped blocks with letter; ice = cyan diagonal hatching; portals = violet/cyan ring carrying endpoint number. Pair lines/legend explain normal 0↔1,2↔3 and crossed 0↔3,1↔2. No color-only identification. Start is a checkpoint marker. The canvas has an accessible name and a neighboring textual position/key/status description.

## Interaction and states

- Play: arrows/WASD when not typing; dedicated D-pad; reset checkpoint; pause/end attempt. Prevent browser scrolling only for handled game keys. Spectator has no movement handler.
- Proposal: freeze label on board; countdown; command examples; candidates show stable numbers, readable patch names and verification result. Empty state invites one proposal without invented users.
- Vote: clear ballot syntax, counts and deterministic tie rule. Rejected patches appear in a compact receipt/event feed, with no fake “vote” card.
- Merge: new law highlight travels from candidate to rule strip; board uses a short seam flash and player position remains unchanged until a move. Result conveys exact patch, witness length and snapshot digest.
- Reveal: explicit play/pause/step/reset replay controls; ghost player visually distinguished; actual game state remains separate. Automatic animation only after user activation, with instant/step alternative under reduced motion.
- Connection: separately show server connected, Twitch state, and last real chat event. Socket connection without subscription acknowledgement is “Connecting.” A cold reconnect gap cancels voting; never silently count partial audience input.
- Errors: actionable message remains readable; retry connection/login and local play available. Errors do not vanish solely on a timer. Buttons disabled with an explanation when a session is frozen or unauthenticated.

## Motion identity

Use motion-design skill and its context-adaptation guidance. Energetic but controlled: 120ms feedback, 220ms state transition, 650ms merge reveal. Signature easing cubic-bezier(.2,0,0,1). Player movement follows actual transition cells; no decorative physics that disagree with the solver. Animate transforms/opacity where possible, at most a few focal objects simultaneously. No persistent particle field, camera shake, large zoom, strobes or endless ambient motion. A merge may briefly emphasize the candidate, then the changed law, then the board. Reduced motion removes travel, scaling and automatic loops; use instant positions and clear text. Correctness never waits for an animation.

## Accessibility and verification

Semantic buttons/labels, visible keyboard focus, status announcements via polite live regions, skip link, dialog focus behavior if dialogs are used, readable contrast, touch targets, resilient long strings, and no timer announcements every frame. User can pause a round. The canvas is not the sole source of state. Verify desktop 1440×1000, broadcast 1920×1080, mobile 390×844, keyboard-only, reduced motion and loading/disconnected/empty/rejected/revealed states in an actual browser. Store screenshots and executed test evidence; do not equate screenshots with complete interaction proof.

## Motion refinement — 29 October 2026

The user's requested Open Design mode is Local Codex. Open Design 0.26.1 is now installed, its signature verified and its local MCP registration enabled. At this earlier checkpoint the new tool snapshot was unavailable; the user authorized a continuation. Later generated-source recovery and integration are recorded below. The independent motion-design pass preserves the existing visual system and engine contracts.

A merge identifies its exact law in the existing chamber status area and emphasizes only that law's cell. The authoritative receipt ID drives a900ms feedback lifetime; a session/phase change cancels it completely, and unrelated snapshots cannot restart it. The changed-law underline is the primary cue, the accepted-law label is secondary, and a650ms panel seam supports the moment. No new layout space is required, no control is covered, and movement never waits for the animation. Persistent rules and receipt retain the result after the emphasis ends.

Phase headings enter with6px travel over220ms. Escape confirmation settles over350ms without shake or particle loops. Portal laws show explicit numbered pairings (`0↔1 /2↔3` or `0↔3 /1↔2`) so viewers need not infer them from colors. During a ghost replay the status says WITNESS REPLAY even if the actual player already escaped. Reduced motion removes all new spatial animation; law text and the brief static highlight remain.

Verified in the 29 October browser run: canceled-merge cleanup and a second merge, one matching law highlight, unrelated snapshot stability, reduced-motion transform/animation removal, post-escape replay status, visible pairing text and existing mobile/OBS bounds. Open Design remains a separate pending tool requirement until its attributed Local Codex workflow completes in the newly authorized chat.

## Local Codex integration and interactive marketing — 29 October 2026

The existing project now serves the marketing introduction at `/`, the real controller at `/play`, and the read-only broadcast view at `/overlay`. The landing uses the same authored Vector Foundry chamber, shared transition/patch/solver/witness code and actual Phaser renderer. Its sandbox is isolated from the room: closing wall A retains a replay-checked 24-move escape; gravity down is rejected without changing the checkpoint or position. Visitors can step the route, reset and enter the controller. This is a local engine demonstration, not audience or live Twitch evidence.

The marketing composition uses a strong amber/bone-white headline, compact navigation, a real chamber, the propose/vote/escape loop, three authored maps and four law disclosures. Desktop copy aligns to the top, with CTA and try-law controls in the initial 1440×900 and 1280×720 viewport. The law controls and verdict precede the board so the result stays beside the action. On small screens the page stacks and offers a sandbox jump. System fonts, local geometry, focus rings and 44px controls preserve the existing visual system.

`src/client/refinement.css` adapts the actual generated chamber stylesheet: compact controller introduction, a segmented phase rail, larger viewport-aware board, separated law cells and full-width dense ballot rows. Eight bounded labels, vote commands/counts, receipt source and escape statistics remain visible at both broadcast sizes. The first integration check found the 720p receipt 19px below the frame; compact read-only row spacing repaired it without truncating labels or removing proof.

The existing receipt-ID lifecycle and motion.css remain authoritative. A merge never moves the player; unrelated snapshots cannot revive finished feedback; canceled feedback clears before the next receipt. Phase/escape transitions and numbered portal pairing remain. Local phase-button replacement now continues keyboard focus at the next primary action when its original trigger is removed. Reduced motion retains exact text and manual stepping.

Generation provenance is in `evidence/open-design-chamber-provenance.json`; the four recovered original files and hashes are retained under `evidence/open-design-chamber/`. The first Local Codex workflow was interrupted by a local service restart and did not settle as successful artifact delivery. Recovered generated styling was adapted and verified in the real game. The illustrative preview script, fabricated witness, and unsupported example law values are excluded from the runtime. The main build chat independently continued the additional landing design generation; this record does not claim its terminal outcome.

## Landing refinement — 30 October 2026

Recovered Local Codex landing CSS is imported after landing.css. The hero is top-aligned; the CTA and both law buttons fit the initial 1440×900 and 1280×720 viewport. Controls and the verification result precede the real Phaser board. Text is enlarged, framing is compact, and a visible Try a patch link jumps to the sandbox on smaller screens. Native law disclosures, 44px sandbox controls, visible focus and manual witness steps remain. Reduced motion removes spatial feedback. The retained preview HTML is a labeled design fixture and is not bundled into the game. The generation ended canceled; source recovery is documented separately from successful delivery. See evidence/open-design-landing/provenance.json and landing-refinement-verification.json.

## Final generated landing integration — 30 October 2026

The completed Local Codex continuation delivered landing-final.html, landing-final.css and integration notes. The real React landing now imports landing-final.css after landing.css, superseding the earlier landing-refinement.css import while retaining that file and all earlier artifacts. Commands and utilities use 12px text, verdict copy and witness controls use 14px text, and the verdict remains immediately beside the law controls above the board. The underlying shared-engine handlers, real Phaser board, chamber data and receipt-driven game motion are preserved. Preview-only scripts and geometry are excluded from the runtime.

Round controls now restore focus after the enabled controls have committed. If a user focuses another field while the response is pending, that choice is preserved. The browser regression delays the actual action response while its WebSocket state arrives, covering both outcomes. All nine production-browser journeys passed after the repair. See evidence/open-design-final-verification.json.

The generation reports succeeded and its strategy task reports a completed valid deliverable. Its separate top-level flag still names index.html and reports entry_not_touched. Both flags are retained in evidence/open-design-final-provenance.json; the three requested files were independently retrieved and the integrated product was verified. The final Studio web link timed out, so saved generated files are also retained for review.

## Playable marketing sandbox — 30 October 2026

Visitors can now choose Try the escape and move the actual Phaser player with focused arrows/WASD or touch controls, without host authentication. Movement uses transitionDetailed from the existing shared engine. See checked route returns to the verified checkpoint before manual witness stepping; switching back starts a fresh attempt. No attempted player path is presented as the stored witness. A blocked input leaves the move count unchanged. The key and exit are derived from engine state, and controls disable on escape.

Restart attempt retains the applied law. Reset sandbox restores the original laws and route. Rejected laws preserve the current attempt; accepted laws restart from the checked position, as explained beside the controls. The live text map removes a collected key. Keyboard input is restricted to the focused board and ignores repeated/modifier shortcuts. New controls have 44px targets, visible focus and no autoplay. The separate authored landing-play.css extends the generated visual system; landing-final.css is unchanged.

The complete production-browser suite passed 11/11. After adding accepted-law reset and collected-key text-map assertions, all five landing journeys passed again. Two scoped sandbox captures were then refreshed, with both journeys passing. 320px/390px touch layouts and reduced motion were exercised. The current full unit/property/server/provider-fixture suite passed 112/112. Evidence: landing-play-verification.json and its linked reports.

Final package verification refresh: typecheck, lint, production build, **112/112 unit checks and 11/11 production-browser journeys** passed against the same recorded source fingerprint. The final browser run took 45.7 seconds with no skips or flaky tests. The 41 captured runtime/test/configuration files were unchanged across verification. Reports: evidence/landing-play-unit-final.json, landing-play-browser-final.json and landing-play-tested-source.json. The owned localhost:3119 preview was refreshed to this build with its separate simulation storage.

## Visitor entry refinement — 30 October 2026

Play the demo is now the hero and final primary action. It activates the actual local play mode and focuses the board without a host login. A second activation while playing returns to the current attempt without resetting progress. Host a chamber remains a separate link to /play, whose host authentication is unchanged. The availability text explains access at the point of choice. Both actions retain the existing visual system; the mobile hosting arrow uses the compact text-arrow treatment.

The complete browser suite passed 12/12. After the decorative-arrow correction, all six landing journeys passed again. New visitor checks cover desktop Enter, mobile pointer entry, full board visibility/focus, actual movement, bottom-of-page return with preserved position/count, host login entry, no POST calls and unchanged room state. In-app keyboard entry also showed a solid 3px focus outline. See evidence/visitor-verification.json.

## Complete demo craft — 30 October 2026

The marketing story now reads as a clear audience/player exchange, while retaining the agreed headline and amber orbital visual language. Chamber previews are real launch actions, with an explicit selected state: Vector Foundry demonstrates a gate closure, Crosswire rewires portals, and Thin Ice enables slippery floor. Every example uses the existing engine and a replay-checked witness. All four rule values are visible; narrow layouts switch the law summary to two columns.

Manual escape completion has a concise finish state showing the actual chamber and move count, then offers the next chamber or host controls. Inspecting a stored route does not claim a personal win. Same-chamber entry preserves the attempt; changing chambers starts a fresh checked world; full reset retains the selected chamber and restores its initial laws.

Movement uses Board's existing validated frame animation instead of a second animation implementation. New checkpoint acceptance returns keyboard focus to the playable board. Reduced motion disables the completion fade and retains immediate movement. Portal/ice movement interruption by chamber switch, restart, mode change and reset was exercised, with actual pawn pixels and a single canvas checked afterward. Evidence: craft-verification.json and craft-review.md.

## Whole-product workflow refinement — 30 October 2026

The controller now starts with visible host access and a no-login demo link. Unlocking focuses the chamber selector. Chamber selection stages a choice; the adjacent Start button explicitly begins a new session. Source switches also explain their fresh-session effect. Phase guidance states why controls are waiting and links directly to the simulation panel when audience input is needed. Connection loss has a readable reconnect state and reload action.

Simulation suggestions follow the current chamber, phase and real candidate IDs, including gaps after moderation. Unrelated room snapshots preserve deliberate edits. Command results stay beside the form, while global notices use normal flow so feedback cannot cover the board. Escape completion offers direct witness inspection. Reveal focuses Play witness, or the enabled manual control under reduced motion.

Replay now has a labeled native timeline, exact step count, speed selector, manual step/reset and clear per-view scope. Seeking pauses playback, displays the corresponding ghost/key/text-map state and leaves the saved attempt unchanged. Reduced motion uses immediate manual inspection. The broadcast composition keeps its read-only layout, compacts the revealed replay card at 720p and retains the complete fairness receipt. No new assets, dependencies or generation were introduced.
