# Independent motion review and adjudication

Source review by the read-only reviewer on 29 October 2026. The reviewer did not implement the changes and did not claim browser verification. Root executed the regressions afterward.

| Finding | Repair | Executed evidence |
| --- | --- | --- |
| P2: switching sessions during the 900 ms merge canceled its cleanup timer without clearing mergeFlash, preventing later CSS feedback from retriggering | Track active receipt separately; clear feedback before classifying every session/receipt/phase change | Browser main journey merges ice, immediately switches chamber, confirms cleanup, then merges walls and confirms fresh feedback |
| P2: actual game.escaped took precedence over ghost state in chamber heading | Prioritize WITNESS REPLAY while ghost is active | Browser actual escape then reveal asserts ghost heading and key state |
| P2: portal mode text did not show actual numbered pairs | Visible 0↔1/2↔3 or0↔3/1↔2 in law strip | Mobile and overlay assertions; full 8-ballot layout still fits 1080p/720p |

All6 browser journeys and110 engine/server/provider-fixture tests passed after these repairs. Typecheck/lint/build passed. Reduced-motion assertions verify animation-name:none and transform:none on the changed law. New visual emphasis does not move the player or gate controls. Open Design generation remains separately pending; no use of that runtime is claimed by this report.
