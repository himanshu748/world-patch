# WORLD//PATCH

Chat rewrites the laws. The streamer escapes. Every merged patch has a replayable escape witness.

## Inspiration

A Twitch audience can invent a difficult challenge in seconds. Keeping that challenge fair is harder. WORLD//PATCH gives chat the power to change a puzzle's rules, while making the game show that an escape still exists.

The audience becomes the architect: redirect gravity, change portal pairings, turn the floor slippery, or close a group of walls. The streamer has to read the transformed world and find a way through.

## What it does

The streamer collects a key and reaches the exit across three authored chambers. During a patch round, movement freezes and viewers propose bounded commands through real Twitch chat. Each proposal is applied to the exact frozen checkpoint. A deterministic solver searches for an escape, then replays the route before admitting the patch to the ballot.

Viewers vote, and the winning law is checked again before it merges. No completed verification means no merge. A search that reaches its budget is explicitly incomplete; it is never called a proof of impossibility.

After the attempt, the audience can watch or step through the stored escape. A fairness receipt and an exportable event log make the result inspectable. The proof covers the merge checkpoint; reset restores that checkpoint if the player later traps themselves.

The host can pause, cancel, remove candidates and moderate participants. An empty audience leaves the chamber playable. The interactive landing page lets a visitor try the same puzzle engine without signing in, with its local sandbox clearly separated from Twitch sessions.

## How I built it

I used OpenAI Codex for architecture, implementation, tests, reviews and interface iteration. The main build session is `01a1807d-e70b-7572-bc0d-a4f29b37d1b8`; selected source-writing records are preserved with the project.

React and Phaser present the world. One pure TypeScript transition drives player movement, bounded breadth-first search and witness replay. Fastify owns the room and authenticated host controls. WebSockets distribute authoritative snapshots, and SQLite saves the checkpoint with an ordered event log.

Twitch OAuth and EventSub deliver real chat proposals and ballots. Chat is treated as untrusted input and parsed into a small typed rule language. Codex builds the game; no runtime model or chat-provided code executes inside it.

## Challenges

A proof becomes stale if the player moves while chat votes, so the world freezes throughout elections. A symmetric portal swap changes nothing, so Crosswire uses four endpoints with two distinct pairings. A missed-chat delivery gap cancels the election instead of guessing which votes were lost.

Recording also exposed a useful failure: a valid winning law hit the room's short verification deadline under load. The game declined the merge. I gave room checks a larger bounded budget, added a clock-controlled regression, and repeated the actual Twitch journey while OBS recorded.

## What I am proud of

The recorded demonstration uses one real Twitch account in its own channel: an impossible gravity law is rejected, a wall law is admitted, a real ballot selects it, and the operator escapes the changed chamber. The replay then shows the checked route. The exported event log independently reconstructs the result.

The audience can be adversarial without the host having to promise that every suggestion will work. The game earns that promise with an executable witness.

## What I learned and what comes next

The boundary between a found witness, an exhausted search and an incomplete search became a product decision as much as an algorithm decision. Connection indicators, vote states and replay controls need to make those distinctions understandable during a stream.

Next I want to test the pacing with streaming communities, build more authored chambers, and explore community-created patch sets while preserving the small, deterministic rule language.


## Try WORLD//PATCH

[Public source](https://github.com/himanshu748/world-patch) · [Real Twitch + Codex demo](https://youtu.be/5pPTyIQZ7RY)

[Play WORLD//PATCH](https://worldpatch.13.204.212.172.sslip.io). Try a chamber without signing in, or watch the read-only [OBS overlay](https://worldpatch.13.204.212.172.sslip.io/overlay). The complete hosted game has also completed a genuine Twitch patch round, player escape and witness replay. Private host access is required to run the shared room.
