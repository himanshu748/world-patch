# WORLD//PATCH architecture and security challenge

Reviewed 2026-10-28, before implementation. This review is design evidence, not live integration evidence. No Twitch account was authenticated and no production event was observed.

## Decision

Use one authoritative Fastify process, React/Phaser presentation, SQLite, and a server-owned outbound Twitch EventSub WebSocket. A static-only deployment cannot own Twitch credentials or authoritative rounds. A multi-process deployment needs a separate leader/coordination design and is outside this MVP.

The smallest credible slice is one fixed chamber, a parsed patch, a frozen snapshot, a deterministic search, a witness replay, and an append-only round receipt. Prove this before adding four patch families or presentation polish.

## P0 challenges to resolve in the architecture

1. **Snapshot race:** A witness for position A does not prove escapability from position B. Freeze movement from proposal-window opening through voting and merge. Show the freeze explicitly. Alternatively reverify the winning patch against the latest version and compare-and-swap at commit; this is more complex. Never silently reuse a proposal-time witness after the player moves.
2. **Simulation leakage:** A genuine Twitch connection indicator does not prove the deciding vote came from Twitch. Every normalized event must carry a server-assigned `source: twitch | simulation`; a session has one immutable mode. Reject simulation injection in live sessions. Never accept event provenance from browser JSON.
3. **False proof:** BFS finding a witness supports solvability. Exhausting the full finite state graph supports unsolvability. Hitting a node/time budget supports only `unknown`. The UI should say `not merged · verification budget reached`, never `impossible` for unknown. Reexecute every witness through the production transition before committing it.
4. **Overlay authority:** A public spectator/OBS page must never get host credentials, OAuth tokens, private session cookies, or write APIs. Hide controls AND reject writes server-side. Keep witness actions private until the round ends, or spectators can inspect network data to spoil the puzzle.
5. **Replay divergence:** Record rules version, engine version, chamber data/hash, initial snapshot, ordered accepted actions, accepted patch payload, witness, and source provenance. Replays must not depend on current wall-clock time, renderer physics, display names, random ID generation, or current chamber definitions.

## Twitch: minimal one-account path

Treat this as an installed broadcaster companion. Twitch documents a single broadcaster User Access Token and `user:read:chat` for installed chatbots. Use the validated token's user ID for both `condition.user_id` and `condition.broadcaster_user_id`, and `channel.chat.message` version `1`. The broadcaster can type a proposal and a vote in their own chat; do not filter all messages whose chatter ID equals the broadcaster. No second bot account, affiliate status, paid chat feature, or write-chat scope is necessary for this design. This is a documented design path; the single-account run remains mandatory live evidence. [Official chat authentication](https://dev.twitch.tv/docs/chat/authenticating), [subscription schema](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types#channelchatmessage).

Use server-side authorization-code OAuth with a random, short-lived, single-use `state`, bound to the requesting host session. Exchange the code server-to-server; keep client secret and tokens out of browser bundles, URLs after callback, screenshots, logs, and public receipts. Pin the registered redirect URI and return to a fixed local path. Use HttpOnly, SameSite=Lax cookies; Secure in HTTPS deployments. OAuth authorization must be completed by the user. [Official OAuth flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow).

Validate tokens on acquisition, process startup and hourly. Check client ID, user ID, scopes and expiry. Refresh once on 401 using a single-flight lock, persist the replacement refresh token atomically, then retry once. Terminal failure clears authorization and marks the connection disconnected. Encrypt persisted tokens with an environment-held key; do not retain them at all if an ephemeral OAuth session meets the local demo need. [Validation](https://dev.twitch.tv/docs/authentication/validate-tokens/), [refresh](https://dev.twitch.tv/docs/authentication/refresh-tokens/).

On a fresh WebSocket welcome, subscribe within the welcome deadline (default ten seconds), using its session ID and the user token. Reset the watchdog on notifications/keepalives. On a requested reconnect, use Twitch's provided URL, retain the old socket until the new welcome and preserve subscriptions. On an unexpected loss, reconnect with bounded exponential backoff/jitter and resubscribe. Twitch does not replay missing events; display the gap and pause/void any affected vote, rather than imply full vote capture. Deduplicate overlap using EventSub metadata message ID and chat message ID. Accept reconnect URLs only from the established Twitch connection and require `wss:` and the documented Twitch host. [WebSocket lifecycle](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/).

## Pure engine and proof contract

Keep the engine independent of Phaser, DOM, I/O and time. Phaser renders authoritative state; it does not compute physics. Suggested API:

```ts
type Verification =
  | { status: 'solvable'; witness: Action[]; visited: number }
  | { status: 'unsolvable'; visited: number }
  | { status: 'unknown'; reason: 'node-budget' | 'time-budget'; visited: number };

parsePatch(text: string): ParseResult<Patch>;
applyPatch(snapshot: GameState, patch: Patch): PatchApplication;
transition(state: GameState, action: Action): GameState;
verify(state: GameState, budget: SearchBudget): Verification;
replay(initial: GameState, actions: readonly Action[]): GameState[];
```

Define movement ordering in writing before coding: cardinal input, collision, ice travel, portal entry, gravity settlement, goal detection. Explicitly decide whether goal detection occurs during traversal or only at the settled endpoint. Detect internal movement cycles; do not let portals/gravity create an infinite transition. A cycle must have a deterministic outcome such as an invalid action that leaves state unchanged. Design portal swapping to change endpoint connectivity, not just cosmetic portal labels. Reject a wall activation that occupies the current player or removes the goal tile. Never auto-relocate the player to conceal an invalid patch.

Use BFS over canonical future-relevant state with fixed action order. Include position plus any changing collectibles/doors in the visited key; exclude counters that do not affect gameplay. Fixed rules per search mean their hash belongs to the search identity but need not inflate each node key. A finite board without dynamic inventory has a tiny state space; prefer this to complex physics and worker-thread infrastructure for MVP. Budget checks still belong in the API and must be tested.

The committed receipt binds `snapshotHash`, `patch`, `resultHash`, `engineVersion`, `witnessHash`, `visited`, and outcome. Hashes detect drift; they are not signatures or independently trusted cryptographic attestations. Phrase the claim as an executable witness for the finite deterministic model.

## Round and persistence contract

The single server owns ordering and clocks: `playing → proposing → voting → verifying → merged/declined → playing → reveal`. Every command is associated with session ID, round ID and expected state revision. Freeze the chamber during audience windows. Enforce the deadline on the server's receive time. A late packet cannot reopen voting.

Normalize patch text into a canonical patch key. Bound proposals, message length, votes and queue size. Deduplicate transport events independently from repeated identical proposals. One accepted proposal per viewer per window; one vote per viewer per round (or a documented replacement policy). Use cooldowns against repeated rejected attempts too. Stable tie-break: vote count descending, accepted proposal sequence ascending. Zero votes means no merge, not invented audience participation. Broadcaster veto/disable-family actions are explicit log entries and cannot silently alter the winning count.

Persist the event and resulting state/revision in one SQLite transaction before broadcasting it. A duplicate event's unique key must be checked in that same transaction. Store deadlines as timestamps for recovery but record timeout-resolution events so replay needs no clock. On restart, restore committed state, mark active windows interrupted, require host resume, and do not pretend Twitch messages during downtime were received. Maintain versioned migrations and a bounded retention/export policy.

## Security boundaries

- Browser/OBS: read-only public state except authenticated host commands. Same-origin checks, CSRF protection and message-size/rate limits apply to mutating endpoints and WebSocket upgrades.
- Twitch ingress: schema-validate every envelope and text; verify event broadcaster matches the owned channel and subscription identity. Render usernames/text as text, never HTML. Never evaluate chat strings, dynamic imports, shell commands or model outputs.
- Host operations: authenticated session required for moves, phase controls, simulation injection, vetoes, reset and Twitch disconnect. A public shared passphrase embedded in JavaScript is not authentication.
- Secrets: `.env`, SQLite database/token store, session exports containing identifiers and local evidence captures must be ignored by default. Sanitized public exports omit tokens, raw unrelated chat and identifying user IDs; use per-session actor aliases.
- Live integrity: simulation and live mode must have visibly different status labels, export metadata and session IDs. A disconnected live session stays live-but-disconnected; it must never silently switch to simulated chat.

## Evidence that should block completion

Unit/property tests must show no mutation, deterministic transitions, finite transitions under portal cycles, every returned witness reaching escape, and all accepted patches binding to the frozen state. Integration tests must show duplicate messages produce one effect, stale revisions fail, unauthorized overlay writes fail, reconnect overlap deduplicates, revocation disconnects, and timeouts never report unsolvable. Browser tests must exercise a full proposal/vote/merge/escape/reveal cycle. Finally capture a real own-channel chat proposal and vote, Twitch event IDs and replay evidence. Local mocks cannot satisfy that final requirement.
