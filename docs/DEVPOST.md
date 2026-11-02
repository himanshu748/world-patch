# WORLD//PATCH — submission copy

[Public source](https://github.com/himanshu748/world-patch) · [96-second real Twitch + Codex demo](https://youtu.be/5pPTyIQZ7RY)

[Play the complete hosted application](https://worldpatch.13.204.212.172.sslip.io). The real hosted Twitch proposal/vote/merge, player escape, witness and persistent recovery passed. Repository access and unlisted-video metadata are verified; complete public video playback passed. Personal eligibility and full rules/terms were approved privately by the user. The [actual Devpost entry](https://devpost.com/software/world-patch) is submitted and independently verified. Fresh-profile cookie isolation is unverified and is not claimed. The browser-only sandbox is separate from the required hosted Twitch experience.

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

The real one-account demonstration rejected an impossible gravity patch, accepted a wall patch, counted a real ballot and merged the winner with a 24-input escape witness. The operator escaped through the browser controls, then revealed the route. Its 36-event export independently reconstructed the merge and escaped final state. The 96-second demo is published unlisted with English captions and preserved Codex development evidence.

The latest local hosting-preparation gate passed 127 tests, typecheck/lint/build; the normal browser journey and static sandbox have separate executed evidence. The full hosted application separately passed 78 HTTPS/WSS/security/recovery checks and an actual Twitch round: three approved messages, a 24-input witness, 24 actual UI moves to escape, then Reveal. Its 38-event export independently reconstructed the result. CI passed 39 Linux-image checks including native SQLite and restart/replay. Controlled local cold reconnect does not prove a provider outage or migration; no audience study or scale claim is made.

## What is next

Perform a human readability/playtest and explore more authored chambers and community-authored patch sets without expanding into arbitrary executable rules. Keep the small deterministic model and inspectable evidence as the core of the experience.

## Required field mapping

| Field | Prepared answer / action |
| --- | --- |
| Repository URL | https://github.com/himanshu748/world-patch — public anonymous source access verified |
| Codex session ID | `01a1807d-e70b-7572-bc0d-a4f29b37d1b8` |
| Main technology requirement | Codex built/reviewed the implementation; actual Twitch OAuth + EventSub proposal/vote/merge/replay verified; retain reviewed real Twitch/Codex video before submitting |
| How streamers/community use it | Streamer opens a round; viewers propose/vote on rules; verified winner transforms the chamber; streamer plays; audience sees a replayable solution afterward |
| Demo video | https://youtu.be/5pPTyIQZ7RY — 96 seconds, Unlisted, English captions; anonymous metadata PASS, complete public privacy-domain playback PASS; strict fresh-profile isolation not claimed |
| Hosted application | https://worldpatch.13.204.212.172.sslip.io — complete hosted app verified, including actual Twitch/game/replay and persistent recovery. |
| Submitter type/country | Entrant must provide; do not infer residence or team status |
| Learning/Codex survey answers | Entrant must choose personally |
| Personal eligibility and final terms | User-confirmed and explicitly approved before the verified submission. No private answer values are published. |
| Actual submission | https://devpost.com/software/world-patch — Submitted 2 November 2026 at 11:51:25.910 UTC; separate readback and public browser verification passed. |

Official event: https://twitchcon-codex.devpost.com . Deadline: 2 November 2026 14:00 Pacific / 22:00 UTC / 3 November 03:30 India. Fresh rules, requirements and announcements are preserved in evidence/official-hackathon-nov2.json. The organizer’s website field is optional; the agreed project delivery requires the complete hosted application. The full hosted app, repository and video are published; complete public privacy-domain video playback also passed. Full rules/terms and final submission were explicitly approved, and actual submission is verified in evidence/devpost-submission-verification.json. The approved published project story is preserved unchanged.
