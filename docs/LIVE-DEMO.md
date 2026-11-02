# The genuine Twitch demonstration

Current evidence: the real account/app, OAuth, own-channel proposal/rejection/vote/merge, operator-controlled escape and exported replay passed on 30 October 2026. See evidence/twitch-live-validation.json. Actual OBS/livestream footage is still required. No simulation screenshot, provider fixture or fake message counts as that capture.

## One-account preflight

Use your own Twitch account as broadcaster and reader. Install OBS from its official site if needed, sign in through OBS's own Twitch workflow and complete any account/streaming requirements yourself. Do not put stream keys in this project. Add a Browser Source pointing to `/overlay` on the running game server, 1920×1080. Open the controller separately. Unlock the controls, choose **Start a new chamber**, then press **Start**; selection alone does not replace the current session. Reveal/export first if that attempt must be retained. Use window/browser capture for Twitch chat and Codex evidence in the recording; hide secrets and personal notifications.

Verify Twitch is subscribed, then send a harmless real chat message and check that “last real event” updates. Connection alone is insufficient. Start a fresh **Twitch** session; no simulation controls should be usable. If the provider disconnects during an election, wait for subscription readiness and open a new round. The canceled round must not be cut into the demo as a successful vote.

Reveal starts the witness automatically in the OBS overlay unless reduced motion is enabled. Play/Pause/Step, the Witness step slider and replay speed are local to each view: use OBS's Browser Source **Interact** control to pause or step that overlay. The controller's later playback buttons do not synchronize the overlay's timeline. Seeking pauses that view without changing the saved attempt. With reduced motion, use Step or the slider in the overlay's Interact window; autoplay and speed are disabled.

## Under-three-minute shot plan

| Time | On screen | Say / demonstrate |
| --- | --- | --- |
| 0:00–0:15 | Board, Twitch chat, clear Twitch provenance | “Chat changes the rules. The streamer has to escape. Every merged patch has a replayable escape witness.” |
| 0:15–0:35 | Open proposals; send real `!patch gravity down`, wait at least two seconds, send real `!patch walls A closed` | Fit both proposals inside the 25-second window. Show lockout rejection, unchanged world and the verified wall candidate. A rejected command does not consume the accepted-proposal quota. |
| 0:35–0:55 | Close proposals; wait for the two-second cooldown, send real `!vote 1`; close vote & merge | Fit the ballot inside the 20-second vote window. Show one actual ballot. “This is a one-account integration test.” Do not imply a crowd. |
| 0:55–1:10 | New wall law and fairness receipt | Show the closed gate, Twitch origin, revision and 24-move stored witness length. |
| 1:10–1:45 | Wall group changes; streamer plays a few moves | Show new law, frozen-window fairness and checkpoint reset. Witness length is a model result, not a human difficulty score. |
| 1:45–2:10 | End attempt / reveal; play witness | The ghost replays the stored route to key and exit. Display snapshot digest and export verification result. |
| 2:10–2:40 | Codex main chat, tests and source diff/files | Show actual Codex development and main session ID `01a1807d-e70b-7572-bc0d-a4f29b37d1b8`; explain shared player/solver transition and one-server design. |
| 2:40–2:55 | Crosswire portal pairing or Thin Ice preview | Close on the authored world mechanic and evidence. Do not claim untested novelty, scale or deployment. |

The strongest capture is continuous for chat → candidate → ballot → merge → replay. A broadcast and a local recording serve different evidence needs: verify actual Twitch functioning, retain the original recording, then edit the submission video under three minutes. Use only assets/music you own or may use; the project has original geometric visuals and no bundled music.

## Evidence to preserve

Record actual provider notification/message IDs from the revealed replay export, observed timestamps, account/channel pseudonym, session origin, round/receipt IDs and replay verifier output. Record where the Twitch chat and OBS browser source are visible. Keep the original capture local; redact tokens/client secret/host secret/stream key before sharing. Export after Reveal, then run `npm run replay -- path/to/export.json`.

Before publishing, confirm the video is publicly viewable on YouTube and the repository is judge-accessible. Official wording and all required fields are captured in evidence/official-hackathon.json; recheck the organizer site before submission. Upload, deployment and submission require the user's authorization. No actual livestream, upload or submission is claimed by this guide.
