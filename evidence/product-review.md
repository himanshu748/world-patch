# Whole-product review and repair record — 30 October 2026

Scope: existing local WORLD//PATCH product, from visitor entry through host setup, simulated audience, player, replay/export and read-only broadcast. The requested outcome is a coherent working journey. No new game engine, dependency, cloud service, live-provider traffic or publishing was introduced.

## Independent findings and disposition

- Host-flow audit: sign-in appeared below the board; chamber selection silently replaced the attempt; simulation kept proposal syntax in voting and hardcoded candidate 1; Reveal focused the next chamber instead of witness inspection. Repaired through visible host access, staged choice plus Start, phase-aware real-candidate presets and committed-state focus handoff. Setup instructions now include both a genuine rejected and accepted proposal with the cooldown.
- Core integrity audit: ordinary host actions could exhaust all 20,000 events, preventing Reveal/export. Repaired by retaining three terminal/progress/recovery slots at revision 19,997. Storage regression seeds a valid hash-linked prefix, then executes actual close/restart/reveal/export at the unchanged hard cap; denied actions preserve state and broadcasts. A legacy saturated log is not rewritten or claimed repaired.
- Final client ordering review: delayed HTTP bootstrap could restore an old streamed chamber; bootstrap config could undo newer host authentication; a delayed action response could replace a later session selected from another controller. Bootstrap state now yields to the stream, config uses request generations, and mutation snapshots yield to newer stream snapshots. Delayed real-response regressions reproduce the old chamber and action failures, and the strengthened anonymous-config regression reproduces stale login UI.
- Final static review of those ordering guards found no remaining material issue. No further material replay, deliberate-setup, focus or reduced-motion defect was found. Static review is separate from browser execution.

## Executed failure history

- Initial full browser run: 18 passed, one failed because the 720p replay receipt extended 6.34px past the viewport. The overlay replay card now uses compact padding and omits its decorative icon; subsequent full 19-test run passed.
- Pre-fix delayed bootstrap regression: one failure, old Vector Foundry replaced streamed Crosswire.
- An initial held-config regression passed without exposing the late overwrite. It was strengthened to hold the complete bootstrap and wait for fulfillment settlement; the later two-test pre-fix run reproduced stale host access and archived-session rollback. Both reports remain historical evidence.
- A full-check attempt was deliberately stopped before completion to incorporate the final ordering review. No pass is attributed to that attempt. One later pre-fix run could not start because an interrupted owned fixture server still occupied its port; it was rerun on a separate isolated port.

## Proof limits

The 20,000-event regression uses valid deterministic history to reach the boundary efficiently, not 20,000 browser clicks. The UI capacity message is an explicitly labeled HTTP presentation fixture; actual SQLite capacity behavior is covered separately. Eight-choice ballots are labeled layout fixtures. All new browser journeys use real local Fastify/SQLite/WebSocket and synthetic host/simulation identities with Twitch disabled. These checks do not add actual provider reconnect, OBS footage, human usability or public-release proof.
