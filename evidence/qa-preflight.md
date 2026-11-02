# WORLD//PATCH independent QA preflight

Review date: 2026-10-28. Scope: acceptance and failure tests before implementation. No product implementation existed when this review began. Every test below is **NOT RUN**; this document is a plan, not evidence of readiness.

## Decisions to settle before code

1. **A witness belongs to a complete snapshot, not a patch name.** Include engine/schema version, chamber definition, position, dynamic objects, rules, and gameplay-relevant flags in a canonical digest. At merge, either movement has been frozen since the snapshot or the server compares revisions and solves again. A preview accepted several moves ago is not current proof.
2. **Choose a finite, discrete state model.** Gravity, sliding, and portal chains must terminate under specified semantics. Rendering cannot introduce a second physics engine. A per-move safety limit may make a move invalid or verification incomplete; it must never silently truncate motion into a plausible new state.
3. **Proof is conditional and narrowly stated.** “Escape witness verified from revision 14 under engine 1” is defensible. A shortest path from a fixed patch proves reachability, not enjoyable play, immunity to future patches, or escape from every possible player position. If the player may enter dead ends, distinguish patch fairness at merge from continuing player safety. Either design reversible movement or warn clearly; do not imply an invariant the implementation does not enforce.
4. **Separate health from provenance.** OAuth success, socket open, subscribed, last event received, and real completed game loop are different facts. The UI and evidence report must not collapse them into “LIVE.”
5. **Make zero audience a legitimate state.** A solo broadcaster can propose and vote through their own real Twitch chat. No proposal produces “No patch this round,” not fabricated votes. Simulated actors must retain simulation provenance all the way into logs, screenshots, receipts, and replays.
6. **Keep the control plane private.** The OBS/spectator route must never receive operator credentials, OAuth tokens, or mutation authority. Verify this by attempts, not by merely hiding controls.

## Adversarial acceptance matrix

| ID | Risk and executable test | Pass condition / evidence |
|---|---|---|
| Q01 | Run all defined player actions from each chamber's initial state through the pure transition function. | Fixed expected outcomes; legal bounds; no state mutation; deterministic repeats. |
| Q02 | Seed property tests across valid states, rules, and action sequences. | Input remains unchanged, output stays valid, identical input gives identical result; record seed and case count. |
| Q03 | Generate solver witnesses and replay every action with the production transition function. | Final state satisfies the actual escape predicate; every intermediate state valid. |
| Q04 | Return a witness containing an illegal action or altered terminal position. | Independent witness verifier rejects it; receipt does not display accepted. |
| Q05 | Use an unreachable chamber and exhaust the complete finite search. | Result explicitly exhausted/unsolvable, with visited-state count; no witness. |
| Q06 | Force tiny node/time budgets and cancel an active solve. | Result explicitly incomplete/cancelled, never “unsolvable” or accepted; last valid world preserved. |
| Q07 | Portal pairs/cycles, ice-to-portal, gravity-to-portal, edge collisions, closed wall under player, and exit crossed mid-slide. | Expected ordering is written and tested; no hang or accidental teleports; victory timing agrees with solver. |
| Q08 | Propose a patch, move/reset/change chamber before merge, then deliver old solver completion. | Stale completion discarded or re-solved against new revision; no stale receipt accepted. |
| Q09 | Simultaneous move and winning merge requests. | One serial order is committed and logged; witness and resulting revision match that order. |
| Q10 | Flip every patch family through all permitted values, including redundant/no-op patches. | Grammar is bounded; no-op policy explicit; invalid values reject without game mutation. |
| Q11 | Fuzz chat with scripts, JSON fragments, Unicode confusables, oversized text, HTML, signed numbers, extra arguments, and invalid whitespace. | Strict command parser accepts only documented grammar; no eval/HTML interpretation; bounded work. |
| Q12 | Submit the same Twitch notification twice and again after restart. | At-most-once command effect with a persistent event identity; duplicates get no extra vote. |
| Q13 | Deliver different notification IDs wrapping the same chat message ID. | Chat message dedupe also prevents repeat effects. |
| Q14 | Same user proposes aliases of one patch and floods different valid proposals. | Canonical patch identity, per-user cooldown, proposal cap, and total cap are enforced server-side. |
| Q15 | One user votes repeatedly and changes choice. | Exactly one effective vote per eligible user per round; chosen replacement policy visible and tested. |
| Q16 | Equal totals, zero votes, reordered network delivery, and removed leading candidate. | Documented stable tie-break and empty-round rules; no random or array-order winner. |
| Q17 | Commands at exact open/close timestamps and delayed arrival after reconnect. | Server admission rule is deterministic and recorded; late commands do not leak into a later round. |
| Q18 | Operator pause, reject, ban, reset, and replay during each round state. | Unauthorized callers rejected; state transitions valid; moderation/reset recorded; no hidden winner mutation. |
| Q19 | OAuth callback without state, wrong state, expired state, replayed state, denied consent, malformed code. | No connected session; state bound to browser and single-use; safe actionable error. |
| Q20 | Valid token for wrong client/user, insufficient scope, expired token, refresh failure, revoke event. | Connection rejected/terminated; tokens never exposed; UI prompts reauthorization where appropriate. |
| Q21 | Inspect JSON APIs, WebSocket frames, local storage, source maps, logs, errors, and spectator HTML. | No client secret, access/refresh token, session capability, or raw OAuth code leaks. |
| Q22 | Cross-origin HTTP mutation and WebSocket attempts; spectator tries operator APIs. | Origin/auth/CSRF policy blocks mutation; spectator receives public data only. |
| Q23 | Fake welcome, failed subscription creation, HTTP 401/403/429/5xx, and request timeout. | “Connected” requires successful subscription; bounded retries with jitter/rate-limit handling; errors remain visible. |
| Q24 | EventSub keepalive expires; new socket cold reconnects. | Timed health degrades, bounded reconnect occurs, subscription recreated once; gap explicitly recorded. |
| Q25 | EventSub session_reconnect starts replacement while old connection still receives events. | New welcome precedes old close; migrated subscription not recreated; overlaps deduped; reconnect URL validated. |
| Q26 | Invalid JSON, wrong event type/version, wrong broadcaster/subscription, unknown fields, old/out-of-order timestamps. | Input boundary validates/filters; no crash, user impersonation, or unintended command admission. |
| Q27 | SQLite restart after each accepted action and mid-round; inject write failure. | Recovery yields documented safe phase and exact latest committed world; no broadcast of uncommitted state. |
| Q28 | Export/import replay; alter one action, receipt, initial map, version, or state digest. | Exact deterministic state sequence verifies; corrupt/incompatible replay fails visibly. |
| Q29 | Rebuild replay after refresh and across Node/browser runtime. | Same canonical digest and final state; no dependence on object insertion order, locale, wall clock, or random source. |
| Q30 | Play keyboard-only, including focus into input, modal, and return to board. | Semantic controls and focus visible; arrows do not move while typing; no focus trap; all actions available without pointer. |
| Q31 | Desktop 1920×1080 and 1280×720 OBS crop; mobile 390×844; 200% browser zoom. | Board, phase, rule change, vote state, connection and provenance readable without overlapping/clipped primary controls. |
| Q32 | Enable reduced motion and replay/merge repeatedly. | Dramatic movement is reduced or removed; state change still understandable; no flashing or sound dependency. |
| Q33 | Slow/drop application WebSocket, reload player, reconnect spectator, open two player tabs. | UI signals stale state; authority remains server-side; client recovers revision; stale tab cannot silently overwrite. |
| Q34 | Real single Twitch account posts proposal and vote to its own channel chat. | Actual EventSub notification IDs and redacted channel/user identity produce one voted, verified patch in live mode. |
| Q35 | Real livestream/recording shows Twitch chat → game merge → streamer escape → witness replay. | Continuous capture connects the events; simulation stays off; video has required Codex usage and actual session ID. |
| Q36 | Fresh checkout, documented commands, empty SQLite store, production build, restart, and judge spectator link. | Another user can reproduce local setup; deployed link and persistence tested separately; no undocumented secret values. |

## Minimum evidence set

- Unit and property test reports with commands, timestamp, source revision/digest, seeds and failures.
- Integration reports distinguishing mocked provider lifecycle tests from actual Twitch events.
- Browser report listing viewport, keyboard sequence, reduced-motion result, console/network failures, and screenshots.
- Machine-readable round receipt containing initial snapshot digest, patch, winning rule, voter counts, result type, search budget/visited states, witness, post-merge digest, engine version, and source provenance. Keep sensitive user identifiers out of public exports.
- Replay verification report regenerated from persisted events after restarting the server.
- Live Twitch evidence log containing redacted notification identity and observed times, plus the continuous real demonstration recording. An offline CLI-generated EventSub event is transport test evidence, not live Twitch evidence.
- Session ID preserved from the actual primary Codex session. A guessed ID, folder identifier, or subagent session is insufficient.

## Phase exit advice

1. **Core exit:** Q01–Q11 pass and at least three actual chamber witness replays complete. Do not move visual physics ahead of this invariant.
2. **Round/replay exit:** Q08–Q18 and Q27–Q29 pass. Freeze or revision-check snapshots; settle admission/tie policies before UX copy.
3. **Twitch/security exit:** Q19–Q26 pass using fixtures, then Q34 separately passes with real Twitch. If credentials are missing, mark live integration **BLOCKED**, while local implementation remains independently testable.
4. **Presentation exit:** Q30–Q33 pass from the actual application entry point; only then record the demo.
5. **Submission exit:** Q35–Q36 and official mandatory checklist pass. Local correctness alone does not satisfy a real Twitch demo, public/judge access, or submission.

## Current primary-source checks

Twitch distinguishes a requested reconnect migration from a dropped connection. A dropped connection requires resubscription and does not replay events missed during the gap. The keepalive watchdog resets on notifications and keepalives; the new session welcome must precede closing the old socket during migration. These distinctions drive Q24–Q25. [Handling WebSocket Events](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/) (checked 2026-10-28).

OAuth sessions require access-token validation at startup and hourly; invalidation requires ending affected sessions. Test this with a controlled clock and mocked provider responses, then separately verify an actual revoked session. [Validating Tokens](https://dev.twitch.tv/docs/authentication/validate-tokens/) (checked 2026-10-28).

## Review conclusion

The highest-risk false success is an attractive “SOLVABLE” badge backed by a solver using an earlier state or different movement semantics. The next is a “LIVE” badge backed by a WebSocket connection without an enabled chat subscription or actual Twitch message. The implementation and verification report must make both mistakes structurally difficult.
