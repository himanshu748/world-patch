# Independent UI behavior review

Date: 2026-10-28. Read-only source review of `src/client/App.tsx`, `Board.tsx`, and `api.ts` during interface implementation. The reviewer did not author these files. Findings below describe concrete code paths; browser reproduction remains required. Styles were not yet present when the initial review began.

## UI01 — P1: incoming chat snapshots can indefinitely postpone witness autoplay

`App.tsx:86–99` builds `replay` with dependencies on `state.receipt` and `state.chamber` object identity. Snapshot schema parsing recreates both objects for each WebSocket message. The autoplay effect depends on `replay` and clears its timer on each such change. The server broadcasts a new snapshot for each real chat event, including events outside election windows. If events arrive more frequently than the 550ms-or-longer replay delay, the timer continually resets and the witness never advances.

`Board.tsx:150` likewise repaints for these recreated object references, and `paint` restarts ghost-frame animation even when the ghost index has not advanced. This can repeatedly animate the last transition during unrelated chat updates.

Recommended fix: compute the witness timeline from stable session/receipt identity or digest, and animate/redraw only when the actual game/replay/render state changes. Verify in a browser while delivering equivalent snapshots or real chat status updates every 100ms: autoplay must still reach the exit and each transition should animate once.

## UI02 — P2: replay key and exit visuals reflect the actual attempt rather than the ghost

`Board.tsx:96–105` controls exit unlocked styling and key visibility using `state.hasKey`, even while `props.ghost` is active. After the streamer collects the key and escapes, a replay from a checkpoint without the key therefore starts with the key already absent and the exit visually unlocked. `App.tsx` also continues to show the actual attempt's key/escape header state while the replay runs.

Recommended fix: when replay is active, derive world key/exit/status presentation from the ghost's replay state, retaining the real pawn only as a dim separate marker. Verify a completed actual attempt followed by replay from a checkpoint lacking the key; the key must be visible until the ghost actually collects it, then disappear, with the exit updating at that point.

## UI03 — P2: full candidate ballots exceed the intended OBS frame

Subsequent `styles.css` inspection found that `.candidates` vertically stacks full cards with no broadcast height constraint, compact ballot mode, or pagination. With the permitted eight candidate slots, the card list alone exceeds a 1080px frame; the phase heading, command reference and fairness receipt add further height. A static OBS browser source cannot scroll to off-screen candidates.

Recommended fix: provide a compact broadcast ballot layout and verify the largest supported ballot at both 1920×1080 and 1280×720, with all candidate identifiers, vote counts and phase status inside the capture. Exact rendered dimensions still require browser evidence.

## UI04 — P2: mobile styling hides the room connection indicator

The `max-width:900px` rule sets `.server-status { display:none }`. After the initial state has loaded, this removes the only room reconnect indicator on mobile while connection loss disables controls. The displayed board can therefore become stale without a visible room-health explanation.

Recommended fix: retain a compact visible connection status on small screens and exercise a connection loss/recovery in a 390px browser viewport.

## OBS behavior to resolve explicitly

Host replay controls mutate only local React state (`playing`, `replayIndex`, `showGhost`). A separate `/overlay` browser source receives the revealed witness but does not follow the host's Play/Step controls. This needs either a deliberate documented OBS-interaction workflow or a synchronized/opt-in replay behavior. Do not claim that clicking Play in the controller currently plays the OBS source.

No source edits were made by this review. Final adjudication requires the UI owner/root to make targeted repairs and execute the relevant browser checks.

## Repair status

Final root browser suite: 6/6 passed in evidence/browser-tests.json. UI01 is verified by replay completion during repeated real local server snapshots. UI02 is verified by actual player escape followed by the overlay showing KEY REQUIRED from the replay checkpoint, then completing the witness. UI03 is verified by all eight candidate boxes and the board/laws fitting 1920×1080 and 1280×720; this is explicitly a presentation fixture. UI04 is verified by visible mobile Room reconnecting status, disabled controls during a local socket outage and recovery to newly committed game state. The initial blank Phaser canvas was also fixed and guarded by pixel assertions. Host controls now occupy a normal-flow row above the board and do not cover movement controls.

OBS decision: Reveal starts the overlay witness except under reduced motion. Later Play/Pause/Step buttons act locally in each view; docs/LIVE-DEMO.md explains OBS Interact. No physical OBS or real Twitch broadcast verification is implied by the browser suite.
