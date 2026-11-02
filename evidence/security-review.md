# WORLD//PATCH independent security review

Date: 2026-10-28. Scope: `src/server/app.ts`, `index.ts`, `room.ts`, `storage.ts`, `replay.ts`, shared protocol, and relevant test cases. This reviewer implemented the Twitch adapter, so the findings below deliberately concern the independently owned HTTP, room and persistence layers. Adapter test results are reported separately as implementation verification, not an independent review of that module.

Result: the concrete high-priority findings identified during this review have been repaired and rechecked. This is a bounded code/fixture review, not a penetration-test certification or live Twitch verification. No production service, actual OAuth grant, livestream or third-party account was exercised.

## Findings and disposition

| ID | Severity | Finding | Resolution and evidence |
| --- | --- | --- | --- |
| SEC-01 | P1 | A failed SQLite write during `sourceUnavailable()` left the old voting state in memory. After storage recovered, the regular deadline tick could merge an election whose source had been interrupted. An exception from the HTTP callback could also interrupt transport cleanup. | **FIXED.** Room now latches `pendingSourceCancellation` before attempting persistence. `tick()` flushes it before any election transition; host actions and ingestion enter through `tick()`. HTTP callbacks catch storage errors and close peers. The transport separately protects cleanup from observer exceptions. Executed an injected failure/recovery scenario: cancellation initially threw, then recovery produced `phase: play`, unchanged `ice: false`, and a `cancel` event, not a merge. Room regression and adapter observer regression passed. |
| SEC-02 | P2 | Messages rejected for cooldown or a paused election still cloned/persisted the complete room and consumed retained dedupe capacity. Repeated rejected traffic could exhaust session storage capacity despite the intended cooldown. | **FIXED.** PAUSED and COOLDOWN now return before state cloning, event-ID retention and database writes. `tests/room.test.ts` includes a burst regression verifying stable revision and bounded round state. |
| SEC-03 | P1 | A provider message delayed from an earlier window could be applied to a later window that reused candidate IDs. Arrival time alone was insufficient. This issue was independently identified by the main agent while this review was in progress. | **FIXED.** Adapter preserves provider `sentAt` separately from `receivedAt`; HTTP forwards it; Room checks against `windowOpenedAt`, rejects missing live timestamps and unreasonable future timestamps, and resets the opening boundary on resume. Accepted proposal/vote/rejection records preserve provider event/message IDs and both timestamps. Delayed/missing/future/resumed-window tests passed. |

No unresolved P0/P1 finding was identified in this scoped review after those changes. This does not close the external live-evidence or deployment gates.

## Boundaries inspected

- Host commands, simulation injection, Twitch connect/disconnect and logout require an expiring server-side host session. Login compares SHA-256 digests using `timingSafeEqual`; the host secret never enters public state. Session IDs are random; cookies are HttpOnly and SameSite=Lax, and Secure for configured HTTPS origins.
- Mutations require an exact configured Origin; WebSocket upgrades also check Origin. Public WebSockets are read-only and close inbound command attempts. `/api/host` and replay download independently require host authentication.
- OAuth state is random, expires, is bound to the originating host session plus a separate HttpOnly cookie, and is consumed once, including failed authorization callbacks. Redirect destinations after callback are fixed local paths. The HTTP layer returns generic errors instead of upstream token/error bodies.
- Public snapshots omit witness actions and witness start state until reveal. Candidate author lists, ballots, raw Twitch identifiers and secret material are not returned. Revealing ends the attempt; replay export additionally requires the reveal and host authorization.
- The game parser and HTTP discriminated unions are allowlists. SQL uses prepared statements for values. Static serving is restricted to `dist/public`; CSP disallows arbitrary scripts, objects, external connections and embedding by other origins.
- Room input is bounded by length, actor, candidate, dedupe, session and event limits. SQLite state replacement and append-only event insertion occur in one transaction before in-memory publication. A failed append preserves the previous state. Restart compares the checkpoint to a verified replay and cancels interrupted elections.
- Replay verifies the event hash chain, action-derived game state, patch application and executable escape witnesses. A receipt cannot become valid merely by setting a success label.

## Executed verification

Command executed by this reviewer:

```text
npx vitest run tests/twitch.test.ts tests/room.test.ts tests/storage.test.ts
```

Result: **56 tests passed across 3 files** (31 adapter, 19 room, 6 storage), followed by a passing `npm run typecheck`. Targeted adapter ESLint also passed. These are local deterministic and transport-fixture tests. The HTTP/WebSocket suite is maintained and executed by the main agent; this review inspected its assertions but does not substitute that inspection for its execution evidence.

The injected persistence scenario used an in-memory SQLite store, threw on append during source-loss cancellation, restored writes, advanced beyond the vote deadline and called `tick()`. The observed final event was `cancel`, with the original rules preserved.

## Limits and operational notes

- Replay integrity is not a digital signature or independent proof that Twitch delivered an event. A server operator can rewrite and rehash records. Provider IDs and source labels support comparison with a real captured Twitch run; they do not replace it.
- Replay verifies game transitions and witness validity. It does not independently reconstruct unique-voter identity from public export data, which deliberately omits participant identifiers. Ballot uniqueness and tie resolution are server invariants covered by room tests.
- The service is one authoritative process with a finite spectator connection cap. A public production host still needs normal edge rate limiting and operational monitoring; no distributed denial-of-service or large-audience load test was performed.
- `/api/health` currently reports process liveness. It does not establish Twitch readiness, disk writability or a valid OAuth session. Use the separate connection state and actual journey verification for those claims.
- Session data contains pseudonymous participant identifiers and provider event IDs. Keep the database private, protect the persistent volume and follow the documented retention/export process.
- Live account consent, same-account chat delivery, reconnect behavior on Twitch's real service, public HTTPS configuration, OBS capture and final submission artifacts remain external acceptance gates.
