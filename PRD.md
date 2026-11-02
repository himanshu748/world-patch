# WORLD//PATCH — product requirements

Decision baseline: 28 October 2026. Main Codex session: `01a1807d-e70b-7572-bc0d-a4f29b37d1b8`.

## Promise and audience

Chat rewrites the laws. The streamer finds the way out. Every merged law comes with a reproducible escape witness, revealed after the attempt. The primary user is a solo streamer without an established audience or production crew. The secondary user is a viewer who can type one short command and see its consequence. The third user is a judge who must understand the mechanic in ten seconds and reproduce the evidence without trusting a success animation.

WORLD//PATCH is an audience-authored puzzle encounter, with deterministic verification as part of the spectacle. It does not claim to invent rule-changing puzzles, viewer voting, or solver-assisted design. Its differentiator is their specific combination: audience adversity, bounded world laws, a frozen snapshot, an accepted witness, and a post-round replay.

## Outcome and judging alignment

| Criterion (equal weight) | Product decision | Observable evidence |
| --- | --- | --- |
| Innovation / Idea | Viewers author rule changes rather than movement commands | A real chat patch changes the world; a harmful patch is refused |
| Potential Impact | One account can host, propose and vote; empty rooms remain playable | Broadcaster's own message enters the same pipeline |
| Technical implementation | Shared pure transition, bounded BFS, persistent receipts, EventSub | Replayed witness reaches escape; duplicate notification counts once |
| Design | Large board, legible vote cards, cinematic but short merge | 1080p OBS composition; keyboard and mobile usable |

## Primary journey

1. Host opens the local controller. Simulation is visibly labeled and usable without credentials. Live mode is a separate session and requires Twitch sign-in.
2. Host selects one of three chambers and learns arrows/WASD or touch controls. Find the key, then reach the exit. A move can also slide, teleport, and drift one cell under the current gravity law.
3. Host opens a patch round. Player movement freezes, preserving the exact current puzzle snapshot. Chat has 25 seconds to propose a command. Syntax, quotas and solvability checks gate proposals.
4. Voting lasts 20 seconds. A viewer casts one ballot for a numbered verified candidate. One account has one ballot; later ballots replace it. Ties use canonical patch key order, visibly stated.
5. The winner is verified again against the frozen revision and merged atomically with its receipt. No votes means no merge. Host can cancel, remove a proposal, block a participant, or pause/resume the round. A Twitch delivery gap cancels an active election.
6. The streamer escapes, or explicitly ends the attempt and reveals the witness. Reset returns to the current patch checkpoint. The witness describes that checkpoint, not every later player position.
7. The replay animates the stored witness using the same transition rules; a receipt shows origin, revision, rule change, explored states, path length, and digest. Next chamber starts a fresh attempt. Export supports independent replay verification.

## Bounded authoring vocabulary

- `!patch gravity up|down|left|right|off`
- `!patch portals normal|crossed` (four numbered endpoints, two pairings)
- `!patch ice on|off` (only designated ice tiles)
- `!patch walls A|B open|closed` (only designated wall groups)
- `!vote <candidate number>`

Unsupported text is ignored or rejected with an on-screen reason. No chat code, arbitrary coordinates, assets, freeform rules or AI-generated execution. Chat display names are treated as plain text. A patch setting an unchanged law is rejected. Blocking the player's current tile is rejected.

## MVP scope

React + TypeScript control/broadcast UI; Phaser board; Fastify server with WebSocket snapshots; SQLite session/event persistence; three authored chambers; typed patch parser; deterministic BFS; simulation harness; real OAuth authorization-code flow and EventSub WebSocket chat; bounded round state machine; host moderation; connection health; event/replay export; host-only controls and read-only spectator view; setup, deployment, demo and submission material.

Target deployment is one persistent Node process and one SQLite volume. No Redis, hosted database, model inference, paid service, extension review, audience dependency or bot account. Live integration reads chat and does not post messages. Codex is the build tool, not a runtime dependency.

## Non-goals and boundaries

No multiplayer physics, procedural infinite maps, monetization, Bits, subscriptions, extension marketplace, arbitrary mod code, Twitch chat moderation actions, cloud autoscaling, anti-cheat against a malicious server administrator, or claim of large-audience performance. No commit, push, deployment, publication, messaging, payment or competition submission without applicable explicit authorization.

## Operational requirements

- Source provenance is fixed when a session starts: `simulation` or `twitch`. A live session rejects simulated commands. Simulated actors have an explicit prefix.
- Proposal cap 8 unique candidates, one proposal per user per round, command cooldown 2 seconds, max message 200 characters. Event IDs and provider message IDs deduplicate ingestion. No paid or follower gate.
- Freeze input through proposal/vote/pause/verification. Deadline and tie ordering are server-authoritative; reconnect shows current snapshots rather than optimistic local votes.
- No audience: player can continue without a patch; host may run an explicit local demonstration. Never synthesize viewers in a live round.
- Unknown solver outcome is rejection with “verification incomplete,” not “impossible” or “proved.” Full state-space exhaustion may be called “no escape under these rules.”
- On restart, recover game/checkpoint/log; cancel in-flight election and require Twitch reconnection. Never resume a stale deadline as a fresh vote.
- Public spectator payload excludes tokens, participant identifiers, raw chat, moderation data and hidden witnesses. Reveal unlocks only the witness for the attempt.

## Acceptance criteria

Each item needs test/manual evidence in CHECKLIST.md: three baseline chambers escape; all four patch families change transitions; player and solver call the exact same function; every accepted witness replays from the receipt snapshot to an unlocked exit; rejected/unknown patches do not mutate state; movement cannot race merge; duplicate events/ballots do not inflate votes; deterministic ties; crash-recovered events replay; host auth and origin isolation; secure OAuth state and refresh/validation; reconnect/cold-start gap behavior; live same-account chat proposal and ballot; no secrets in public payload; desktop/mobile/keyboard/reduced-motion checks; OBS capture; clean install/build; judge setup; real Twitch demo video plus Codex evidence.

## Competition and release gate

Official submission period: 23 October 2026 10:00 Pacific to 2 November 2026 14:00 Pacific (22:00 UTC; 3 November 03:30 India). The FAQ's UTC conversion and structured judging dates conflict with formal copy; use the formal rules for submission timing and recheck later judging dates if relevant. Required: judge-accessible code repository URL, at-most-three-minute YouTube demo showing the project running on Twitch and Codex usage, description, and main Codex session ID. The 2 November announcement allows unlisted videos and excludes private videos; the organizer’s website field is optional. The agreed project delivery additionally requires the full hosted Fastify/WSS/Twitch/SQLite application; a browser-only GitHub Pages sandbox is insufficient. Personal eligibility/terms require the entrant, not the software. See evidence/official-hackathon-nov2.json (fresh deadline, requirements and announcements), the historical evidence/official-hackathon.json, and https://twitchcon-codex.devpost.com/rules .

External integration update,30 October2026: account/email/2FA and confidential app registration are complete. Actual OAuth and same-account EventSub chat rejection, accepted proposal, ballot and merge are verified. The operator exercised the patched chamber through the real controls, then revealed/exported/recomputed the solution; see evidence/twitch-live-validation.json. Actual provider reconnect and broadcast proof remain pending. Submission-ready may only be claimed when mandatory live and delivery checks are genuinely passed.

## Interactive marketing entry — 30 October 2026

The home page introduces the audience-authored rule mechanic and offers a clearly labeled local sandbox without host credentials. Visitors can accept a verified gate law, reject a lockout, step the checked escape and reset without mutating the server room. Primary links enter /play and the read-only /overlay. Acceptance includes visible initial desktop actions, mobile/keyboard/reduced-motion use, and truthful Twitch setup limits. This adds an introduction to the working product; no fake audience, testimonial or live claim is required.

## Current release acceptance — 2 November 2026

The latest local hosting-preparation gate passed 119 tests, including five startup/configuration regressions, plus typecheck/lint/build on Node 26.12.0 macOS. The recorded game revision’s 114-test/22-browser gate, corrected actual Twitch proposal/vote/merge/24-input escape/witness and 36-event replay remain separate evidence. A later normal-client regression run passed22 browser journeys, and the explicitly static variant passed3 browser journeys; neither runs the remote service.

The public repository and96-second unlisted YouTube demo are published. Anonymous repository/README and video metadata readbacks passed; complete anonymous YouTube playback is pending. Full hosted functionality is required by the user and awaiting provider provisioning. Acceptance requires the real HTTPS landing/controller/overlay, WSS, protected host actions, persistent SQLite restart recovery, exact OAuth callback and actual hosted Twitch/game/replay behavior. Node 26.13.0 Linux/native installation and every remote acceptance step remain unverified. Controlled local cold reconnect does not establish a provider outage, requested migration or live election cancellation. Entrant attestations and actual Devpost submission remain pending.
