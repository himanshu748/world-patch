# WORLD//PATCH — independent game design and novelty review

Reviewed 2026-10-28 before implementation. This is design guidance, not evidence that the proposed chambers or implementation pass. The agreed product concept remains fixed.

## Finding

The strongest pitch is **chat authors a constraint, the game produces an escape witness, the streamer plays the resulting challenge, and the audience can inspect the evidence afterward**. “Chat changes a game” and “a puzzle whose rules can change” are established ideas. The product must earn its differentiation through the complete, visible fairness loop rather than imply those ingredients are new.

### Primary-source comparison

| Existing mechanism | Evidence | Implication for WORLD//PATCH |
|---|---|---|
| Rules as manipulable puzzle objects | [Hempuli's official Baba Is You page](https://hempuli.com/baba/) describes rules represented by physical objects and altered through manipulation. | Do not claim invention of rule-changing puzzles. Here, the social authorship and executable witness are the product distinction. |
| Adversarial level construction | [Clever Endeavour's Ultimate Chicken Horse page](https://www.cleverendeavourgames.com/ultimate-chicken-horse) describes players adding traps between attempts and making a course difficult for opponents. | Do not claim invention of adversarial co-creation. WORLD//PATCH constrains authoring to bounded world laws and verifies an escape from the exact merge state. |
| Audience voting on game events | [Twitch's Fatshark interview](https://blog.twitch.tv/en/2019/03/08/a-twitch-integration-lets-the-viewers-call-the-shots-b5eae972d3ef/) documents timed votes in Vermintide 2. Its designers recommend visible effects and balanced choices. | A vote panel is not the innovation. Show exactly which rule changed and why it was allowed. Avoid consistently obvious helpful/harmful choices. |
| Viewers helping or hindering a streamer | [Twitch's Crowd Control article](https://blog.twitch.tv/en/2019/02/15/the-evolution-of-speedrunning-crowd-control-caf6e259e848/) documents audience-triggered in-game effects. | Do not pitch audience sabotage alone as unique. Make rejected lockouts and replayable fairness receipts central. |

This targeted comparison supports differentiation from these examples. It does **not** establish global novelty or prove no similar project exists.

## Decisions to challenge before building

1. **Two-portal swapping is often a no-op.** If there are only two undirected endpoints, exchanging their labels changes no movement. Use four fixed endpoints, with two explicit pairing modes: linked `A↔B, C↔D`, crossed `A↔D, B↔C`. The UI must draw the changed correspondence.
2. **Full-board falling prevents climbing.** A one-cell input followed by falling until blocked makes opposite-gravity progress impossible without special mechanics. For the MVP, use at most one gravity drift cell after a successful manual/slide/portal action. A blocked drift leaves the player still; collision is not death. Use an explicit neutral `off` initial law if needed for a clear tutorial. Even one-cell drift can prevent climbing, so every chamber/patch combination still needs solver evidence.
3. **Four generic directions can look like a maze rather than a puzzle.** Chambers need narrow ice braking positions, portal route choices, and a gate that trades a shortcut for a detour. Keep maps under 11×9, rather than compensate with size.
4. **Freeze while viewers author.** Capture the current state when a proposal window opens; block player movement until resolution. This makes the audience's target stable and avoids explaining stale proposal proofs. If movement is retained instead, revalidate every candidate on one final frozen snapshot and version-check the commit.
5. **No-op patches are not interesting proposals.** Reject patches equal to the current law. Distinguish changed rules from material effects: a valid rule change can still have the same shortest solution. That is allowed, but do not celebrate it as “harder.”
6. **Do not advertise perfect fairness.** A witness proves at least one escape under the deterministic model from the captured state. It does not prove enjoyment, difficulty, every future player move remains recoverable, or correctness of the software itself. Allow restart from the post-merge snapshot.
7. **Do not reveal the route during voting or play.** Display “escape witness stored,” visited-state count, revision and receipt ID. Reveal arrows and animated path only on escape, timeout/surrender, or a visibly recorded streamer action. Otherwise the verifier solves the puzzle for the player.

## Recommended bounded semantics

The architecture owner should adopt or explicitly replace these rules before level implementation. One pure transition must serve player, BFS and replay.

- Board: immutable rectangular grid with an impassable border, one player, one exit, fixed solid tiles, designated gate-group cells, optional ice cells and either zero or four portal endpoints. No hazards, enemies, physics clocks, crates or collectibles in the first release.
- State key: player cell plus all mutable law values; a transition never reads wall time, random values or rendering state. Victory is terminal.
- Input: one cardinal direction. If the first target is blocked, the action is a no-op and causes no drift. Otherwise enter the cell.
- Exit: entering the exit at any movement substep wins immediately. A player cannot slide or drift past a victory that was visually reached.
- Ice: when ice is enabled and a manual move enters marked ice, continue in the same direction while currently on ice and the next cell is walkable, stopping on the first non-ice cell or before a wall. Marked ice has direction-neutral hatching; a visible trace shows the displacement.
- Portals: on entering an endpoint, teleport once according to the selected pairing. Landing on a portal does not immediately teleport again. To prevent unseen composite loops, permit at most one teleport per input, across all substeps. A teleport stops ice continuation; gravity still occurs after the teleport.
- Gravity: after the manual/ice/portal sequence, drift at most one cell in the active direction, if walkable. Check exit and process at most the remaining one portal activation. Do not initiate another ice slide or gravity drift from that arrival. Neutral `off` causes no drift.
- Wall groups: `amber` and `cyan` are fixed sets of cells; a command sets a named group `open` or `closed`. Closing over the player's cell is invalid. Outer walls and the exit cannot be edited.
- Patch application is a pure law update on the captured player state; it does not itself move the player. Movement effects begin on the next input. This prevents confusing “merge teleported me” behavior.
- Commands use explicit assignments (`!patch gravity left`, `!patch portals crossed`, `!patch ice on`, `!patch wall amber closed`). Avoid `toggle`: repeated or duplicated events must not invert the intended law.
- Each patch changes exactly one law. Atomic bundles are outside the MVP.
- BFS uses a fixed neighbor order and a finite visited set. Result is `solved` with action witness, `unsolvable` only after exhaustive queue completion, or `inconclusive` for any resource limit. A replay of the witness must reach the exit before a merge is committed.

## Three chamber briefs

These are original layout targets to implement and validate, not pre-proven maps. Use coordinates with top-left `(0,0)` and an outer wall ring. Keep graphics original and geometric.

### 01 — Vector Foundry (9×9)

**Lesson:** one manual step, then the gravity vector. Start upper left and exit lower right. A central staggered wall spine creates two downward routes. Amber gate closes the short central crossing; the outer route remains visible. A three-cell horizontal ice lane crosses the lower route and changes the stopping position. No portals in this first chamber.

**Patch targets:** gravity down/right; amber closed; ice on. The level test must find at least one accepted patch that changes the witness and one rejected patch. A reset returns to the post-merge state and law, not silently to the original chamber.

**Visual hook:** the gravity arrow changes, then three floor tick marks point in the new direction. Show the avatar's manual step and subsequent drift as separate 90–140 ms segments.

### 02 — Crosswire (11×9)

**Lesson:** four endpoints create two readable portal routes. A wall divides left and right halves. Put A and B on the left, C and D on the right; default pairs keep travel local, crossed pairs cross the partition. One designated wall opening offers a longer backup path. Start left middle, exit right lower quadrant. Ensure all four endpoint landings remain walkable.

**Patch targets:** portals crossed/linked; cyan closed; gravity down. The crossing patch must visibly change a route, and a gate closure must either preserve a longer witness or be rejected with exhaustive evidence.

**Visual hook:** paired endpoint glyphs use matching shapes and text labels; do not encode connectivity by color alone. Brief connecting arcs show only on merge/replay, so they do not clutter ordinary movement.

### 03 — Thin Ice (11×9)

**Lesson:** forced movement, portal routing and gates interact. Two vertical lanes are joined by a middle ice strip; a gate acts as a braking surface when closed. The exit sits beside the strip rather than at its end. Four portals offer a route around a sealed passage. Start bottom left, exit upper right, neutral initial gravity preferred until a verified directional variant exists.

**Patch targets:** ice on; amber closed; portals crossed. A pre-merge state is chosen so one patch raises the shortest path length, another changes the path without increasing length, and one is rejected. Do not require every command to be valid in every chamber.

**Visual hook:** show the previous path length only after the round, alongside the resulting verified path length. Label this “shortest path in this model,” not a human difficulty score.

## Audience loop and empty-room behavior

- Onboarding line: “You move. Chat rewrites the rules. Every merged patch keeps an escape.”
- A round opens with a frozen board and one visible command example for each available family. Proposed choices get stable numbered IDs and plain-language previews.
- Show proposal, vote and play phases as one persistent timeline. Display server-derived seconds remaining; do not animate a timer after the server has paused.
- One vote per Twitch user, changeable until close; repeated same vote has no effect. No subscriber/Bits weighting. Resolve ties by a documented stable key, not invisible randomness.
- Streamer can remove a proposal, pause, resolve, restart post-merge, surrender/reveal and move to the next chamber. Every administrative change is recorded.
- With no proposals, preserve the world and say “No patches this round.” With no votes, use the documented deterministic tie-break over valid proposals and label “0 votes”; do not invent audience activity.
- For a one-account live demo, the broadcaster types their own proposal and vote into Twitch chat. Show “1 participant” and retain real Twitch provenance. This is a functional integration demonstration, not audience-scale validation.
- Simulation has a persistent contrasting label and separate event provenance. Simulated users may exercise vote ties but never count as live evidence.

## Concrete demo acceptance

1. In one continuous capture, a real Twitch chat message becomes a matching proposal with source `twitch` and the correct round ID.
2. A real vote changes the tally exactly once; delivery duplication does not add votes.
3. A candidate visibly changes gravity, ice, portal routing or a wall; accepted witness is replay-validated from the exact frozen revision before merge.
4. A deliberately blocking candidate is rejected without moving or modifying the live world. The UI distinguishes exhaustive failure from a bounded search that did not finish.
5. The streamer completes or surrenders the round; the stored witness plays from its captured starting state, reaches the exit and shows matching receipt metadata.
6. Replay pauses/steps and respects reduced motion; animated frames and instantaneous stepping produce the same terminal state.
7. Each shipped chamber has at least one baseline escape, two meaningful accepted patches, one invalid/no-op example and one proof rejection fixture. These are executed acceptance tests, not design assertions.
8. At 1920×1080 OBS composition and a 1280×720 preview, the board, changed law, phase, vote result and Twitch source are legible without reading developer logs.
9. Keyboard focus never disappears into the canvas. Arrow/WASD play is active only when the play region has focus; text inputs remain usable. An accessible state summary reports player coordinates, active laws and round status.
10. User testing checks whether one first-time viewer can explain the accepted-versus-rejected difference and identify the new law. Until a real person performs this, comprehension and entertainment claims remain unverified.

## Priority order

P0: agree transition order, portal pairing and frozen-snapshot invariant. P0: validate three chamber baseline paths and meaningful changed paths. P1: make rejection and replay part of the main show. P1: real Twitch one-account proof. P2: polish the patch moment after those mechanisms work. Avoid runtime generative AI, paid audience mechanics, procedural level generation and a general rule language in this deadline.
