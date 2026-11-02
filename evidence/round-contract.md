# Phase 2 round/storage interface review

2026-10-28. Planning only; no features or tests are implemented by this document. Root owns HTTP/auth and provider identity pseudonymization. Room/storage worker owns `src/server/room.ts`, `src/server/storage.ts`, `src/shared/protocol.ts`, replay verification and their tests after the kernel exit.

## Proposed interface

`new Room({store?, origin?, chamberId?, now?})`; `new SQLiteStore(dbPath)`; all room mutations synchronous so one store transaction commits before listeners receive state.

- `snapshot(): PublicState` returns detached public data.
- `act(action: HostAction): ActionResult` applies a host action after the HTTP layer authenticates and validates origin. Room still validates discriminators and state guards.
- `ingest({origin, actorId, messageId, eventId, text, receivedAt}): ActionResult` accepts canonical provider/simulation input; root supplies a server-HMAC pseudonym, never a raw Twitch identifier.
- `tick(now?): void` expires windows; every action/ingestion runs the same expiry logic first. Server owns the clock.
- `sourceUnavailable(reason): void` cancels proposing/voting/paused elections while preserving the current game/checkpoint.
- `moderationState(): ModerationState` is host-only, returning pseudonymous actor identifiers and block status. Public state omits this data.
- `exportReplay(): ReplayExport` preserves one self-contained session with chamber and engine version, ordered events, integrity chain and witnesses permitted by reveal policy.
- `subscribe(listener): unsubscribe` runs only after durable commit. Listener failure does not roll back committed storage.
- `close(): void` closes owned storage resources.

`HostAction` discriminators: move (direction), startRound, closeWindow, pause, resume, cancel, removeCandidate (id), blockActor (actorId), reset, reveal, selectChamber (chamberId), newSession (origin, chamberId optional).

`PublicState` fields: schemaVersion, engineVersion, sessionId, origin, revision, gameRevision, chamber, game, checkpoint, phase, round, deadline, remainingMs, candidates, receipt, history, lastRejection. The checkpoint is already-public board state; witness/path remain private. UI may omit the checkpoint while playing.

Candidate: stable positive numeric id, canonical key, typed patch, label, votes. IDs never renumber on removal. Receipt: id, round, game revision, patch, origin, before/after digest, explored states, path length, digest; witness and start snapshot appear only after reveal. History is a bounded collection of public summaries, never full private events. Rejections use a bounded reason code/message and timestamp; no raw input echo.

## Required guard table

| Action | Permitted phase | Outcome |
|---|---|---|
| move | play | Shared transition; checkpoint unchanged; game revision increments only if game changes. |
| startRound | play, nonescaped game | Freeze current game and game revision, clear candidates/ballots/quotas, increment round, open 25-second proposals. |
| closeWindow | proposing/voting | Advance to vote if candidates exist; select/verify winner if nonzero votes; otherwise return to play without merge. |
| pause | proposing/voting | Preserve underlying phase and remaining milliseconds; freeze movement. |
| resume | paused | Restore underlying phase with fresh deadline from remaining duration. |
| cancel | proposing/voting/paused | Return to play, no patch or game mutation. |
| removeCandidate | proposing/voting/paused | Remove exactly one stable ID and its ballots; preserve other candidate numbers. |
| blockActor | any active phase | Add private block entry, remove that actor's ballots; proposal removal policy must be explicit. |
| reset | play | Restore complete current checkpoint; increment game revision; no past receipt changes. |
| reveal | play | End attempt, reveal stored checkpoint witness and receipt; do not move the actual game. |
| selectChamber | play/revealed | New session/checkpoint, baseline witness verified, prior session retained for export. |
| newSession | play/revealed | New origin/id, no mixing real and simulated sources; prior session retained. |

Proposal rules: accept only documented parser grammar; one accepted proposal per actor per round including canonical duplicates; eight unique candidates; two-second cooldown also bounds well-formed but unsolvable proposal attempts. Invalid text never expands actor state. One ballot per actor; later eligible ballot replaces it. Tie-break uses code-point canonical key order, not locale-sensitive sorting. Zero ballots never produce a patch.

## Decisions needing root confirmation

1. **Revision split:** public votes/phase changes must increment room revision without invalidating frozen game revision. Merge additionally compares the complete frozen snapshot digest.
2. **Reveal/export:** a self-contained full session log contains earlier merge witnesses. Export must not accidentally reveal these while a new attempt is in progress. Simplest policy: authenticated export is enabled only after reveal ends the session's attempt and explicitly unlocks its receipts. Public receipt UI can still show only the latest checkpoint.
3. **Blocking:** recommended actor block invalidates their ballot and proposals they uniquely authored; canonical duplicates with other eligible authors can remain. If the MVP simply removes all associated candidates, state that policy instead of implying anonymous coauthorship survives.
4. **Storage limits:** persist notification and chat-message dedupe for each retained session. At configured capacity, fail closed with actionable “start a new session/export” behavior; never silently evict IDs and permit old events to count again.

## Phase 2 test cases tied to the architecture

- Freeze invariant: movement/reset/chamber/source changes cannot race open or paused elections; merge rechecks frozen snapshot and game revision.
- Deterministic timeline: exact deadline events advance phase before admission; pause retains duration; restart cancels active elections.
- Author/voter accounting: canonical aliases, distinct voters, repeated ballots, vote replacement, cooldown boundaries, eight-candidate limit and removal with stable IDs.
- Provider dedupe: repeat event ID, repeat chat message ID under a fresh event ID, restart-and-repeat, mismatched origin, blocked actor and oversized IDs/input.
- Selection: count-descending then ASCII-key ordering; no candidates and no votes preserve game; removed candidates cannot win.
- Persistence: failed append leaves room and listeners unchanged; successful merge stores checkpoint/witness/receipt together; startup validates log/checkpoint rather than trusting a partial write.
- Replay: reconstruct every movement/reset/merge using the actual kernel; verify witness and hashes; reject altered order, action, map, engine version or digest.
- Privacy: stringify public snapshot during proposal/vote/merge/reveal; assert no actor identifiers or hidden witnesses in any public history or receipt branch. Host moderation endpoint retains pseudonyms only.
- Source gap: live connection loss cancels election and preserves playable game; simulation input in Twitch origin cannot affect log, tally or world.

## Documentation issues spotted

- `ARCHITECTURE.md` references `evidence/reviews`, while current review files live directly under `evidence/`; update links or folder location.
- The pause description applies naturally to elections; DESIGN's “pause/end attempt” wording could imply pausing ordinary play. Use the guard table to avoid a button that promises unsupported behavior.
- Baseline witness is needed for reveal before any winning patch. A null latest patch receipt must not make the core reveal action fail.
- “No escape found” is ambiguous if search was bounded. UI should use “No escape under these rules” only after exhaustive search and “Verification incomplete” for bounds/cancellation.
