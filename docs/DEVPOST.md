# WORLD//PATCH — submission copy

Draft prepared from implemented and verified features. **Do not submit as complete yet:** judge repository access, YouTube visibility and eligibility still need evidence. The96-second local Twitch/Codex edit passed scoped metadata/cadence and selected-frame review. The corrected Nov2 real Twitch round and actual OBS game/chat capture passed. Controlled cold reconnect is verified; provider-requested migration and live election cancellation remain unobserved. Do not invent URLs or personal survey answers.

## Name and tagline

**WORLD//PATCH**

Chat rewrites the laws. The streamer escapes. Every merged patch has a replayable escape witness.

## Inspiration

What if chat could make the puzzle harder without making it impossible? WORLD//PATCH turns the audience into authors of the world's constraints. Viewers change how movement works, the streamer adapts, and the game can show exactly why the challenge remained escapable.

Rule-changing puzzles, audience votes and adversarial level construction have established precedents. Our distinctive workflow combines them with verification against the exact current state and a visible, replayable receipt after the attempt.

## What it does

The streamer navigates three compact chambers, collects a key and reaches the exit. Viewers propose a small, typed patch through Twitch chat: change gravity, re-pair portals, enable ice, or open/close a designated wall group. The world freezes during the proposal and vote windows. Before a proposal reaches the ballot—and again before the winner merges—the solver searches the same state machine the player uses.

A found route is replayed before acceptance. A complete search without a route rejects the patch. A search that hits its limit is labeled incomplete, never presented as proof. After the streamer escapes or ends the attempt, the stored solution can be stepped or replayed. Reset returns to the verified checkpoint, because a player can still make a trapping move afterward.

The host has moderation and pause controls. Empty chat remains playable. One Twitch account is sufficient for testing: the broadcaster can propose and vote in their own real channel chat. Simulation is separately labeled and cannot feed a Twitch session.

## How we built it

OpenAI Codex was used to turn the product direction into architecture, implementation, authored chambers, tests, independent reviews and interface work. The main development session is `01a1807d-e70b-7572-bc0d-a4f29b37d1b8`.

React and Phaser present the game; TypeScript defines one pure transition shared by player, BFS solver, movement animation and witness replay. Fastify owns the room, authenticated host actions and public WebSocket snapshots. SQLite saves game state and an ordered hash-linked event log atomically. Twitch OAuth and EventSub provide real chat input. No model executes chat-generated code; Codex is the build tool, not a runtime requirement.

## Challenges and decisions

We froze movement during elections to prevent a proof from becoming stale before its patch merged. We used four portal endpoints because swapping one symmetric pair changes nothing. We distinguished a requested Twitch reconnect from an unexpected delivery gap; missed messages cancel the election. Security review also caught a subtler case where a storage failure could prevent that cancellation from being saved, so the room now blocks further resolution until cancellation is durable.

## Validation status

The repaired source passed 114 unit/property/server/provider-fixture tests and 22 production-browser journeys, plus typecheck/lint/build. The corrected real one-account Twitch round rejected an unsolvable gravity patch, accepted a wall patch, counted one ballot and merged the winner with a 24-input witness. The operator escaped through the browser controls, then revealed the route. Its exported 36-event session independently reconstructed the merge and escaped final state. Actual OBS game/chat footage was captured at 1080p30 and numerically inspected. The first Nov2 attempt remains a recorded incomplete-verification failure, which prompted the bounded room-budget repair; it is not relabeled as success. Controlled actual cold reconnect also preserved the game and receipt after a local process stall; it does not establish a provider outage, requested migration or live election cancellation. The96-second local Twitch/Codex edit passed metadata/cadence and selected-frame review; external delivery remains pending. These checks do not establish audience enjoyment, scalability or submission readiness.

## What is next

Finish authorized repository/YouTube delivery, retain the continuous original, and perform a human readability/playtest, then explore more authored chambers and community-authored patch sets without expanding into arbitrary executable rules. Keep the small deterministic model and inspectable evidence as the core of the experience.

## Required field mapping

| Field | Prepared answer / action |
| --- | --- |
| Repository URL | Not published; supply an authorized judge-accessible repository URL |
| Codex session ID | `01a1807d-e70b-7572-bc0d-a4f29b37d1b8` |
| Main technology requirement | Codex built/reviewed the implementation; actual Twitch OAuth + EventSub proposal/vote/merge/replay verified; retain reviewed real Twitch/Codex video before submitting |
| How streamers/community use it | Streamer opens a round; viewers propose/vote on rules; verified winner transforms the chamber; streamer plays; audience sees a replayable solution afterward |
| Demo video | At most three minutes of actual running Twitch functionality and Codex usage; YouTube unlisted/public is permitted by the latest announcement, private is not; upload only with authorization |
| Submitter type/country | Entrant must provide; do not infer residence or team status |
| Learning/Codex survey answers | Entrant must choose personally |
| Age/jurisdiction/employment attestations | Entrant must review official rules and attest personally |

Official event: https://twitchcon-codex.devpost.com . Deadline: 2 November 2026 14:00 Pacific / 22:00 UTC / 3 November 03:30 India. Fresh rules, requirements and announcements are preserved in evidence/official-hackathon-nov2.json. A website is optional; repository and video are mandatory. No public URLs or personal attestations are invented. Saving a draft is not submission.
