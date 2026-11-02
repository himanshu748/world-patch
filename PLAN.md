# WORLD//PATCH — dependency-ordered execution

All phases update CHECKLIST.md and evidence/phase-log.md. Status means executed verification, not code presence. A blocked external integration does not block independent implementation/tests, but blocks release.

| Phase | Work and dependencies | Exit evidence | Current evidence status |
| --- | --- | --- | --- |
| 0 — Contract | Official rules, six documents, session ID; independent architecture/security/game/novelty/QA challenge | Documents inspected; ≥55 traceable checks; decisions resolved | PASS — evidence/phase-log.md |
| 1 — Puzzle kernel | Typed chamber/rules/parser, transition, BFS, witnesses, authored chambers; depends on 0 | Unit/property tests; all chambers solve; each family changes behavior; unknown distinct | PASS — evidence/kernel-tests.json |
| 2 — Trusted round loop | Server, SQLite log, replay, auth, proposals/votes/moderation, snapshot stream; depends on 1 | HTTP/WS integration tests, deterministic ties/restart, unauthorized rejection | PASS local — evidence/server-tests.json |
| 3 — Twitch | OAuth, validation/refresh, EventSub, dedupe/reconnect/gaps, source isolation; depends on 2 | Fixture failures/recovery plus actual one-account OAuth/chat evidence | PASS recorded actual OAuth/chat/game/replay, controlled cold reconnect and published demo; hosted Twitch acceptance pending |
| 4 — Broadcast product | React/Phaser, all host/overlay states, receipts/replay, motion/a11y; depends on 1–3 interfaces | Browser journey + keyboard/mobile/reduced motion/overlay screenshots | PASS local — 22 normal browser journeys; evidence/static-demo-verification.json; recorded game gate retained |
| 5 — Hardening | Independent security/QA review, regression repairs, dependency scan, cold install/build/start, recovery | Required suite passes; significant findings resolved or accurately blocked | PASS local —119 hosting-preparation tests/types/lint/build; prior 114/22 captured game gate retained |
| 6 — Delivery | README, local/deploy/live demo guides, verification report, Devpost copy, source archive, evidence | Judge journey tested; actual deployment/video/repository/eligibility proof | Repository and unlisted video published; full hosted application BLOCKED pending provisioning/remote acceptance; submission pending |

## Current delivery work

The required release is one hosted Fastify service with HTTPS, browser WSS, real Twitch OAuth/EventSub and persistent SQLite. Provider provisioning is pending. GitHub Pages is a browser-only sandbox and does not satisfy this exit criterion. The repository is publicly readable and the 96-second YouTube demo is published unlisted; anonymous full-video playback still needs its own result.

Next: provision the authorized service and 1 GB disk; build the normal application on Node 26.13.0 Linux; verify landing/controller/overlay, host authorization, TLS/WSS and SQLite recovery after a real restart; register the exact HTTPS Twitch callback and exercise a hosted provider session under the existing message-approval boundary. Record deployed commit, URL and evidence, then refresh the source package and complete entrant/submission gates. All 119 local tests, typecheck/lint/build passed on Node 26.12.0 macOS; that does not establish the remote runtime.

Dated sections below retain earlier decisions and failures. This current delivery work supersedes their older publication/provisioning statuses.

## Working order and decision gates

Do not implement a phase before its interface decisions and preceding local test exits. Independent bounded tasks may run in parallel within a phase, with explicit file ownership. Phase 3 live proof may remain blocked while phase 4 proceeds against the implemented transport contract. Revisit architecture only for evidence-backed problems, record the change and rerun affected tests. No new broad feature after phase 4 unless required to repair the acceptance journey.

## Highest-risk experiment

Before broadcast polish, prove a useful patch on a real discrete chamber and replay the witness; then prove single-account own-chat ingestion without a second bot account. The latter requires user account creation and consent. Never substitute simulator events in the live evidence slot.

## Release stop conditions

Unverified eligibility, missing required full hosted functionality, missing judge/video/repository access, stale snapshot acceptance, solver/player divergence, public token exposure, broken restart/replay, or unreproducible build all prevent a submission-ready claim. The demo can be delivered locally while these remain explicitly blocked.

## 29 October design follow-up

Independent motion-design refinement: PASS (110 tests +6 browser journeys, type/lint/build). Open Design: user chose Local Codex and authorized a new chat using the prepared brief with repeated questions skipped. At that earlier checkpoint native app/registration were verified; the tool snapshot was unavailable. The new chat owns actual attributed generation and integration; do not claim Open Design completion based on the independent motion pass. Existing core/live-release gates remain in force.

## Secondary design integration handoff — 29 October 2026

Implemented in the existing project: recovered Local Codex-generated chamber styling; interactive marketing home; `/play` controller route; preserved `/overlay`; shared-engine sandbox with accept/reject/manual witness/reset; phase-focus continuity and stronger broadcast/keyboard regressions. No replacement engine, new dependency or source/database migration was introduced. Only the `/play` static entry route changed on the server.

The attributed initial design workflow ended failed after a service restart. Its generated source was recovered and integrated; successful canonical delivery remains a separate, unmet outcome for that first workflow. See `evidence/open-design-chamber-provenance.json`. The main build chat owns its independently started additional landing-generation continuation.

Final executed local results and evidence are recorded in VERIFICATION.md and the design-specific test reports. Existing live Twitch, physical OBS/broadcast, public access, repository/video publication, eligibility and submission gates remain blocked or unverified as previously documented.

## Marketing refinement local exit — 30 October 2026

Implemented and verified: recovered generated landing CSS integrated into the shared-engine sandbox, enlarged text, first-viewport desktop actions, visible sandbox jump, mobile/keyboard/reduced-motion behavior and intact /play and /overlay journeys. Full production-browser suite passed9/9; final copy adjustment was followed by build and all3 landing journeys passing. Typecheck/lint/build passed. Local Codex generation terminal status is canceled; recovered source does not satisfy a successful artifact-delivery gate. Next highest priority remains genuine one-account Twitch setup and live proof, then authorized external delivery.

## Final landing continuation exit — 30 October 2026

Completed: retrieve the terminal Local Codex design bundle, integrate its scoped styles into the existing landing, resolve the old stylesheet override, exercise the production-browser journey, and repair the exposed round-control focus race. The final nine-browser run, typecheck, lint and build pass. Preserve the earlier failed run and generation flag discrepancy as history. The latest local evidence is evidence/open-design-final-verification.json. Refresh the source archive and manifest for this exact result. External Twitch, OBS and release gates remain open; no deployment or publication was performed.

## 30 October — real Twitch setup

Implemented/configured: verified account security, confidential Game Integration app, exact local callback, private credentials and server restart. Verified: actual OAuth grant and real EventSub subscription ready; secret excluded from public APIs/frontend/source archive. Evidence: twitch-live-connection.json and twitch-connected.png. Remaining: public test-message approval, actual chat proposal/vote/merge, provider reconnect and broadcast evidence. Next priority: execute the approved three-message own-channel test. No source-level integration change was needed.

## Playable landing continuation exit — 30 October 2026

The homepage interaction now includes a full local escape attempt, scoped keyboard/touch controls, independent checked-route stepping, restart/reset and an accessible text map. This is a frontend extension of the existing sandbox; it does not create a host session or change the room. Completed verification: full 11-browser run, final five landing journeys, two targeted capture journeys, 112 unit/property/server/provider-fixture checks, typecheck, lint and build. Preserve existing provider-ID validation/test work in the shared project. The latest evidence is evidence/landing-play-verification.json. Live Twitch, actual OBS and public-release gates remain open.

Final package verification refresh: typecheck, lint, production build, **112/112 unit checks and 11/11 production-browser journeys** passed against the same recorded source fingerprint. The final browser run took 45.7 seconds with no skips or flaky tests. The 41 captured runtime/test/configuration files were unchanged across verification. Reports: evidence/landing-play-unit-final.json, landing-play-browser-final.json and landing-play-tested-source.json. The owned localhost:3119 preview was refreshed to this build with its separate simulation storage.

## Visitor entry local exit — 30 October 2026

Completed the visitor activation path: Play the demo starts local play immediately; Host a chamber opens the existing protected controller; return entry preserves an active attempt. Typecheck/lint/build passed, the full 12-browser suite passed, and all six landing journeys passed after the final mobile arrow polish. Server/shared/dependency files match the previous verified archive; the existing 112-test unit report is retained, not rerun for this UI-only change. Latest evidence: evidence/visitor-verification.json. No provider messages, deployment or publication were performed.

## 30 October — actual Twitch chat/game/replay exit

Implemented: repaired opaque provider event/message ID ingestion with the shared 256-character limit, preserved strict actor/session validation and exact independent dedupe. Added meaningful room and adapter→room→merge→replay regressions. Updated the live shot plan to fit the real 25-second proposal and 20-second voting windows.

Verified: typecheck/lint/build, all 112 tests, all 12 production-browser journeys and independent scoped security review. Actual Twitch commands rejected gravity down, accepted wall A closed, counted one ballot and merged revision 1 with a 24-input witness. The operator escaped through 24 real movement-control clicks, then revealed and played the witness to its exit. The actual browser-exported 36-event Twitch replay independently reconstructed one merge and the escaped final game. Evidence: twitch-live-validation.json and linked reports/captures.

Remaining: actual provider reconnect and OBS/livestream capture; authorized public judge demo/repository/video; entrant attestations and actual submission. No new audience, remote provider outage, deployment or submission was invented. Next highest priority is continuous Twitch/OBS/Codex demo capture and provider recovery evidence, followed by authorized external delivery.

## Complete demo craft local exit — 30 October 2026

Implemented and verified the full visitor loop: launch any of three authored chambers, test its mechanic-specific law, complete a real escape, then continue to the next chamber or protected host entry. Preserved the shared engine, server, dependency versions and generated stylesheet. The complete unit suite passed 112/112 and the full browser suite passed 14/14. After accepted-law focus refinement and an additional interruption regression, typecheck/lint/build and all nine landing journeys passed again. Exact source fingerprints, screenshot captures and scoped independent review are retained. No live-provider/public-release work was performed by this continuation.

## Whole-product continuation — 30 October 2026

Outcome: a usable end-to-end visitor, host, audience simulation, player and replay journey in the existing product. Scope includes host entry/setup, phase guidance, actual candidate commands, local replay transport, responsive/read-only broadcast and recovery integrity. Existing engine rules, private data and live-provider/release gates are preserved; publication, deployment and messaging are outside this continuation.

Acceptance: stage a chamber without changing the room, explicitly start it, propose and vote using actual candidate IDs, merge, inspect/seek a revealed witness without mutating the attempt, export verified history, recover the latest streamed chamber after delayed bootstrap, and retain terminal capacity at the real event cap. Exercise desktop/mobile/keyboard/reduced motion and 720p/1080p broadcast. Read-only host/core audits informed the implementation; final source checks and exact evidence are recorded in evidence/product-verification.json and VERIFICATION.md.

## Nov2 release preparation

Fresh typecheck/lint/unit/build/full-browser verification passed: 113 checks, 22 browser journeys and no drift across 46 source/configuration files. Real one-account chat proof and controlled cold reconnection are retained as distinct evidence. The original OBS 60fps smoke is a failed quality test with non-silent audio; a verified audio-free passthrough copy is fallback game footage only. Main is recording a dedicated 1080p30 game/chat scene and still needs real Codex footage and the final at-most-three-minute YouTube edit. The three newly approved Twitch messages have not yet been posted at this checkpoint.

Next dependency order: finish and inspect the actual recording/audio; assemble the Twitch/Codex video; refresh the sanitized local release candidate and secret audit; request concrete repository/video publication approval; verify judge access and YouTube visibility; obtain entrant attestations and explicit submission approval. A hosted website is optional under the fresh official requirements and does not substitute for repository/video access. Local Git initialization/staging is authorized as release preparation; no commit, remote, push, deployment, upload or submission is authorized by that preparation. Keep previous failed checks and dated source-package evidence as history.

## Nov2 live recording interrupted release preparation

The three newly approved Twitch posts were sent. Proposal acceptance and the real ballot worked, but merge was declined as VERIFICATION_INCOMPLETE at the 50ms recheck deadline. Main owns the focused 250ms bounded-budget repair and fresh regression/full checks. Freeze final source staging until that verified source is signaled; retain 113/22 as prior-revision evidence. New recording has reported 1.1% encoding lag and an AAC track needing review; raw media stays private. No additional chat posts or external publication are authorized.

## Repaired source ready for local release staging — 2 November 2026

The explicit 250ms room budget and clock regression passed the fresh complete gate: 114 unit/property/server/provider-fixture checks, 22 browser journeys, typecheck/lint/build. Source staging may resume for that verified revision. The new recording remains a failed complete-merge demonstration despite its AAC decoding to exact digital silence. Eight messages have actually been posted; any additional round needs new authorization. Finish that capture/Codex video and actual-secret/binary review before publication. The inherited-environment leak in a historical report was sanitized without changing test outcomes or printing values; local Git metadata was recreated before restaging. No commit, remote, push or public release is claimed.


## 2 November — corrected real round and release preparation

Implemented: explicit 250ms room verification budget; current source and meaningful clock regressions are retained without changing the shared physics. Verified: typecheck/lint/build, 114 checks and 22 browser journeys; then a new separately approved real Twitch rejection/proposal/ballot/merge, 24-control escape, reveal and overlay witness playback. Its 36-event replay independently reconstructs the escaped final state. The actual 169.266-second 1080p30 OBS game/chat capture was decoded; its AAC track is exact digital silence. OBS reported 2/5,086 encoding skips (0.0393%, rounded0.0%); rendering lag was not separately reported. Eleven authorized public posts have now been sent in total; no more are authorized.

Remaining: finish/review the combined Twitch/Codex video, refresh final staged-source secret/binary review, obtain concrete repository/video publication approval, verify judge access and video visibility, then entrant attestations and explicit submission approval. The offline Codex evidence viewer is included as selected public evidence; raw sessions, private environment/data and recordings remain excluded. Local staging is release preparation, not a commit, public release or submission.


## 2 November — local video export verified

The 96-second1080p30 final edit passed metadata,2,880-frame cadence and selected decoded frame review, with zero audio tracks. It combines chronological normal-speed real Twitch footage and truthful selected Codex evidence-viewer footage; no generated narration or native-interface reconstruction. Reports and caption sidecars are included; MP4/rawmedia are excluded from the staged source. Remaining priority: final source secret/binary audit, concrete publication approval, judge/video access checks and entrant/submission gates. Actual browser playback also completed96/96seconds without a media error; evidence/final-demo-browser-playback.json. Public visibility remains unverified.
