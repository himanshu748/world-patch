# WORLD//PATCH — evidence checklist

Statuses: PASS = executed evidence; FAIL = observed failure; BLOCKED = dependency unavailable; UNVERIFIED = not run; N/A requires reason. Source code alone never means PASS. Mandatory submission checks cannot be waived by local tests.

## Phase 0 Contract

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W001 | Official rules and required submission fields retrieved from organizer source | PASS | evidence/official-hackathon.json; formal deadline 22:00 UTC |
| W002 | Submission date interpreted correctly across Pacific/UTC/India | PASS | evidence/official-hackathon.json; formal deadline 22:00 UTC |
| W003 | Six project-specific first-action documents inspected before feature code | PASS | Docs and evidence inspected in Phase 0 |
| W004 | Main Codex session ID captured from runtime environment | PASS | CODEX_THREAD_ID runtime: 01a1807d-e70b-7572-bc0d-a4f29b37d1b8 |
| W005 | Independent architecture and security review incorporated | PASS | Docs and evidence inspected in Phase 0 |
| W006 | Independent game design and novelty review incorporated | PASS | Docs and evidence inspected in Phase 0 |
| W007 | Independent QA preflight incorporated | PASS | Docs and evidence inspected in Phase 0 |

## Phase 1 Kernel

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W008 | Three authored baseline chambers solve and witnesses replay | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W009 | All transition inputs preserve input immutability | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W010 | Blocked manual movement does not trigger gravity | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W011 | Gravity directions/off alter reachable movement as specified | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W012 | Four portal endpoints use two behaviorally distinct pairings | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W013 | Ice stops at non-ice or obstruction without infinite loops | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W014 | Key is required for escape and collected during movement | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W015 | Wall groups only affect designated cells; occupied closure rejected | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W016 | Strict parser rejects unknown, oversized and trailing input | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W017 | No-op patches are rejected without state mutation | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W018 | Unsolvable patch exhausts finite search and is rejected | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W019 | Node/time limits return incomplete, never proof | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W020 | Every accepted generated patch witness reaches escape | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W021 | Same transition function used in player, solver and replay | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W022 | Seeded property tests cover state bounds/determinism | PASS | evidence/kernel-tests.json; 42 tests including 600 seeded property trials |
| W023 | Checkpoint reset restores solvable committed state | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |

## Phase 2 Rounds and persistence

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W024 | Host login required for every state mutation | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W025 | Cross-origin mutation/WebSocket attempts rejected | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W026 | Read-only spectator cannot send player/host commands | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W027 | Proposal and vote deadlines enforced by server | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W028 | Player movement frozen through proposal/vote/pause | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W029 | Per-user proposal quota/cooldown and candidate cap enforced | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W030 | Duplicate canonical patches do not create duplicate candidates | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W031 | Duplicate provider notification and chat message count once | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W032 | One ballot/user with replacement and deterministic ties | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W033 | Zero-audience/no-vote round ends without invented patch | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W034 | Moderation cancel/remove/block controls enforce permissions | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W035 | Stale snapshot/revision cannot merge | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W036 | Merge persists receipt/state atomically before broadcast | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W037 | SQLite restart restores checkpoint and cancels stale election | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W038 | Exported event sequence deterministically reconstructs final state | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W039 | Tampered/reordered/unsupported-version replay fails closed | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W040 | Unrevealed witness and private identity absent from public payload | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W041 | Public snapshot reconnect recovers server state | PASS | tests/browser/connectivity.spec.ts; actual local socket loss/new committed state/reconnect PASS |
| W042 | Storage/session/connection/input limits documented and enforced | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |

## Phase 3 Twitch

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W043 | OAuth authorization URL requests only required read scope | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W044 | OAuth state browser-bound, expiring and single-use | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W045 | Token client/user/scope validated before connection | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W046 | Secrets excluded from frontend/events/logs/errors | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W047 | Token refresh and validation lifecycle tested with failures | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W048 | Welcome subscription uses validated broadcaster as reader | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W049 | Single broadcaster's own messages not filtered | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W050 | Malformed/wrong-channel/stale provider events rejected | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W051 | Requested reconnect preserves subscription and migrates safely | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W052 | Cold loss retries with backoff and cancels election gap | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W053 | Revocation/stop cancels retries and disconnects visibly | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W054 | Twitch session rejects all simulation input | PASS | evidence/release-final-unit.json; 114 executed tests; fixture/live scope in VERIFICATION.md |
| W055 | Live OAuth grant using actual Twitch account | PASS | evidence/twitch-live-connection.json; actual OAuth grant and EventSub ready; no injected provider |
| W056 | Actual same-account chat proposal and vote recorded | PASS | twitch-live-validation.json; real rejection/proposal/ballot/merge, 24-control escape and 36-event replay verified |
| W057 | Actual cold reconnect observed under a controlled local stall | PASS | twitch-live-recovery.json; real keepalive timeout → reconnecting → ready and preserved state; no requested-migration/outage/live-election claim |
| W058 | Actual real Twitch/OBS game-and-chat recording captured and reviewed | PASS | obs-final-live-media.json; corrected36-event round/merge/escape/witness,1080p30 frames and full digital-silence audio inspected;2/5086 encode skips; final Twitch/Codex edit/public broadcast remain separate |

## Phase 4 Interface

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W059 | Real browser renders Phaser board and all three chambers | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W060 | Real browser full proposal/vote/merge/play/reveal journey | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W061 | Replay controls use recorded path without changing actual game | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W062 | Host and spectator composition show accurate provenance | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W063 | Connection distinguishes server/subscription/last-event health | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W064 | Keyboard movement works; text inputs retain typing behavior | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W065 | Keyboard focus and semantic controls verified | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W066 | Mobile 390px layout and touch controls verified | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W067 | Reduced-motion changes verified in browser | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W068 | Empty/error/rejection/frozen/reveal states inspected | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W069 | 1920x1080 overlay legible without host controls | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |
| W070 | Canvas state has accessible textual equivalent | PASS | evidence/design-browser-tests.json; 9 Chromium journeys; screenshot inspection; simulation/local only |

## Phase 5 Hardening

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W071 | Independent implementation security review adjudicated | PASS | evidence/security-review.md; scoped findings repaired and regression-tested |
| W072 | Independent QA/code review adjudicated | PASS | evidence/qa-implementation-review.md and qa-ui-review.md; adjudicated with tests |
| W073 | Current local typecheck/lint/unit/property/integration/runtime suite executed | PASS | 119 tests plus typecheck/lint/normalbuild PASS; render-deployment-verification.json; local Node 26.12.0, targetLinux not run |
| W074 | Normal and separately labeled static browser regressions executed | PASS | static-demo-verification.json;22 normal / 3 static journeys passed; predates startup-only hosting change; captured 114/22 gate retained |
| W075 | Clean dependency install and production build/start executed | PASS | evidence/clean-install.json and clean-install-smoke.json; cold build/native SQLite/restart PASS |
| W076 | Dependency/security and secret exposure checks executed | PASS | evidence/dependency-audit.json: 0 known vulnerabilities; source and package ignore rules inspected |
| W077 | Provider outage/storage failure recovery verified | PASS | Injected-provider outage and actual SQLite failure/recovery regressions PASS; no live-provider claim |

## Phase 6 Delivery

| ID | Independently verifiable check | Status | Evidence / next action |
| --- | --- | --- | --- |
| W078 | README and setup guide verified against executable commands | PASS | evidence/clean-install.json; production-smoke.json; replay-cli-output.txt |
| W079 | Deployment recipe reproducible with persistent volume | UNVERIFIED | Local Node restart/persistence PASS; Docker image and remote persistent-volume recipe not executed. |
| W080 | Verification report separates local/fixture/live evidence | PASS | VERIFICATION.md inspected against machine-readable reports |
| W081 | Live demo runbook includes one-account setup and recording | PASS | docs/LIVE-DEMO.md; one-account/OBS/recording steps and real-evidence limits inspected |
| W082 | Devpost description and required fields prepared | PASS | docs/DEVPOST.md includes actual publicrepo/unlistedvideo; official websitefield optional, userfullhost required; personal fields/submission pending |
| W083 | Current source archive contains code/assets/lockfile without secrets | PASS | Current package CRC and all-byte checks, exact actual private-value/encoding scans including production host secret; adjacent package summary. |
| W084 | Required full hosted Fastify/WSS/Twitch/SQLite application verified | BLOCKED | Authorized provisioning pending; must exercise HTTPS host/overlay, WSS, real hosted OAuth/EventSub/game/replay and SQLite recovery after service restart; Pages cannot satisfy |
| W085 | Repository published and anonymous judge source access verified | PASS | public-repository-verification.json; public GitHub metadata and README anonymous readback at 5468d89; new hosting revision release pending |
| W086 | Under-three-minute Twitch/Codex video published with anonymous metadata | PASS | youtube-publication-verification.json; 96-second source, Unlisted, English captions, Studio No Issues, oEmbed PASS; full anonymous playback pending R016 |
| W087 | Entrant eligibility/terms confirmed by user | BLOCKED | Entrant must personally review/confirm eligibility and terms. |
| W088 | Actual Devpost submission receipt captured | BLOCKED | Requires live/video/judge-access/attestation gates and authorized submission. |

## 29 October design continuation

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| D001 | Local Codex attribution, skipped brief and dedicated project | PASS | evidence/open-design-chamber-provenance.json; actual local tools and authenticated CLI |
| D002 | Initial workflow successful terminal artifact delivery | FAIL | Service restarted; initial production run failed. Recovered files do not change that terminal result. |
| D003 | Generated chamber styling integrated into the real game | PASS | src/client/refinement.css; recovered originals and hashes; design-browser-tests.json |
| D004 | Marketing sandbox uses shared engine with accepted/rejected laws and witness/reset | PASS | design-browser-tests.json; local browser engine, no room mutation |
| D005 | Complete desktop/mobile/controller/overlay journeys | PASS | design-browser-tests.json: 9 passed, no failed/skipped/flaky |
| D006 | Full eight-choice ballot, readable full labels, displayed canvas bounds and receipt statistics | PASS | 1080p/720p presentation fixture; not solver acceptance or live audience proof |
| D007 | Keyboard navigation, phase focus, reduced motion and feedback stability | PASS | Real Tab/Enter, scoped movement, manual replay, repeated-snapshot checks |
| D008 | Shared engine, round, storage and Twitch implementation preserved | PASS | protected-source comparison; server change only adds /play static route; 110 design-unit-tests.json tests passed |

Source packaging status is recorded in evidence/package-verification.json after the final manifest/archive refresh. No external release gate is satisfied by these local design checks.

## 30 October interactive landing refinement

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| L001 | Hero CTA and two law actions visible in initial desktop view | PASS |1440×900 and1280×720; landing-refinement-final-tests.json |
| L002 | Accepted/rejected sandbox laws preserve the verified checkpoint contract | PASS |Actual shared engine;24-move accepted wall route; rejected gravity retains state |
| L003 | Witness reaches keyed exit, reset works and server room remains unchanged | PASS |Executed landing journey; exact room state/revision equality |
| L004 | Mobile keyboard, law disclosure, touch targets and reduced motion work | PASS |390×844, Tab/Enter, 44px targets, no page overflow |
| L005 | Game/overlay entry and local OAuth-result routing remain functional | PASS |Full9-browser run and final3 landing run; provider grant not exercised |
| L006 | Recovered landing stylesheet integrated and inspected in real browser | PASS |src/client/landing-refinement.css; screenshot marketing-landing-hero.png; provenance hashes |
| L007 | Landing generation successful canonical terminal delivery | FAIL |Run ended canceled; recovered files do not change that outcome |

## Final landing continuation — 30 October 2026

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| F001 | Requested final design files retrieved from the completed Local Codex run | PASS | Three exact artifacts retained in evidence/open-design-final/; complete bundle, matched origin, syntax pass |
| F002 | All design service validation flags agree | UNVERIFIED | Top-level index.html flag says entry_not_touched; strategy task says completed/valid. Both retained in provenance |
| F003 | Final stylesheet takes precedence in the actual React landing | PASS | landing.css then landing-final.css; earlier stylesheet retained; runtime imports no illustrative script |
| F004 | Shared-engine sandbox, desktop/mobile and reduced-motion journey | PASS | design-browser-oct30-final.json; accepted/rejected, checked escape, reset, room isolation, focus and links |
| F005 | Round-action focus survives asynchronous phase updates without stealing chosen focus | PASS | Controlled real HTTP-response delay with WebSocket update; enabled next action focused; chosen input preserved |
| F006 | Final typecheck, lint, build and production-browser suite | PASS | 9 passed, 0 failed/skipped/flaky; 58.6 seconds |
| F007 | Shared engine/server source preserved | PASS | All 10 protected source hashes match the pre-integration manifest; prior 110-test report retained |
| F008 | Studio web page reachable during final delivery check | UNVERIFIED | Exact returned URL timed out; generated originals and verified local product remain available |

## Playable landing continuation — 30 October 2026

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| P001 | Visitor can complete the real local escape by keyboard without host login | PASS | landing-play-browser-tests.json; patched 24-input route reaches keyed exit |
| P002 | Touch movement, scoped shortcuts and narrow layouts work | PASS | 390px/320px; 44px controls; no overflow; reduced motion |
| P003 | Play and checked-route states remain separate | PASS | Mode changes restart at checkpoint; witness step count is not the attempted path |
| P004 | Restart, accepted/rejected laws and full reset preserve their contracts | PASS | Final five landing journeys; accepted-law restart and rejected-law state retention exercised |
| P005 | Text map reflects key collection and current player | PASS | Key removed after escape; map and legend available during play |
| P006 | Manual sandbox leaves server room game and revision unchanged | PASS | Exact before/after room equality in production browser |
| P007 | Current complete local tests, types, lint and build | PASS | 112 unit/property/server/provider-fixture checks; full 11-browser run; final five landing and two capture checks |

## Visitor entry continuation — 30 October 2026

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| V001 | Primary action starts playable demo without host login | PASS | Desktop Enter and mobile click; board focused and fully visible; actual move exercised |
| V002 | Return CTA preserves an active attempt | PASS | Exact position and move count retained after returning from the final page section |
| V003 | Hosting entry retains its authentication boundary | PASS | Host a chamber navigates to /play and shows the host-secret form |
| V004 | Visitor flow does not mutate the room or issue POST actions | PASS | Room game/revision equality, zero POST requests and zero browser errors |
| V005 | Final local checks and responsive inspection | PASS | Full 12-browser run, final six landing journeys, typecheck/lint/build, desktop/mobile renders and keyboard focus |

## Actual Twitch validation — 30 October 2026

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| T001 | Opaque provider identifiers survive adapter/room boundaries | PASS | Reproduced before-fix failure; shared 256 limit; 129/256 acceptance and 257 rejection |
| T002 | Exact provider dedupe and strict actor checks survive the repair | PASS | room.test.ts and twitch.test.ts; all 112 tests; independent scoped security review |
| T003 | Real one-account rejection, proposal, ballot and merge reach the game | PASS | twitch-live-validation.json; real EventSub, one ballot, wall A closed, no simulation |
| T004 | Patched real room escapes and reveal/export replay recomputes | PASS | 24 actual movement-control clicks; UI witness 24/24; CLI verifies 36 events, one merge, escaped final game |
| T005 | Current packaged credentials excluded from public/source artifacts | PASS | Actual private-value scan of source/evidence/frontend/public APIs and archive; .env excluded and mode 0600 |

Earlier design generation failures and fixture-only checks remain historical evidence, not live broadcast or audience proof.

## Complete demo craft continuation — 30 October 2026

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| Q001 | All three chamber cards launch their actual local map | PASS | Correct header/selected card, one canvas, room unchanged |
| Q002 | Chamber-specific gate/portal/ice laws retain real escape routes | PASS | Actual 24/14/11-input patched escapes; current-law display and replay checks |
| Q003 | Manual completion has a meaningful next step | PASS | Actual move count, next-chamber cycle and protected host link; no personal win from route inspection |
| Q004 | Movement interruption cannot resurrect old pawn state | PASS | Portal/ice interruption, chamber switch/restart/mode/reset; rendered pawn pixels checked after superseded animation time |
| Q005 | Responsive controls, reduced motion and keyboard continuation work | PASS | 320px/390px, 44px targets, no overflow, next-chamber and accepted-law focus, reduced-motion completion |
| Q006 | Scoped review and applicable checks are complete | PASS | 112 unit checks, full 14 browser run, final 9 landing journeys, type/lint/build; craft-review.md |

## Nov2 release checkpoint

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| R001 | Official deadline/required deliverables refreshed from organizer | PASS | official-hackathon-nov2.json; 22:00 UTC deadline, repository and YouTube/Codex/real-footage requirements; website optional |
| R002 | Prior Nov2 local acceptance rerun without source drift | PASS | release-nov2-checks.json; 113 unit checks, 22 browser journeys, type/lint/build; unchanged 46-file fingerprint |
| R003 | Original 60fps OBS smoke meets recording quality and silence | FAIL | obs-smoke-media.json; known 8.5% render / 2% encode lag and nonzero decoded AAC; raw clip private |
| R004 | Silent fallback retains the original encoded video | PASS | obs-smoke-silent-media.json; zero audio tracks, same 2,681 compressed samples/payload hash and sampled frame hashes; +0.333ms container end rounding |
| R005 | Local final1080p30 real Twitch/chat/Codex edit inspected | PASS | final-demo-video-verification.json/capture-manifest/frame-review;96s,2880frames,zeroaudio; metadata/cadence and selected decoded-frame review; realtime playback/publication separate |
| R006 | Captured-revision release source excludes private/runtime/media files | PASS | Historical prepared inventory and package-verification.json exclude private/runtime/media files; source was subsequently published; new hosting package refresh remains W083 |

Dated design failures remain historical failures. Current local tests, controlled cold recovery and silent fallback do not satisfy public video/repository access, entrant attestations or actual submission.

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| R007 | Bounded room verification repair passes current full gate | PASS | release-final-checks.json; 114 checks and 22 browser journeys, explicit250ms baseline/proposal/merge budget and over-budget refusal |
| R008 | New recorded clip audio content numerically inspected | PASS | obs-nov2-failed-media.json; full AAC decode is digital silence; merge failure and encoding lag remain separate |
| R009 | Published captured-revision source secret audit executed | PASS | package-verification.json; root actual-private-value/staged/binary checks and sensitive-image review; known-pattern/OCR/unknown-secret limitations retained; new hostingarchive refresh is W083 |
| R010 | Corrected real Twitch round independently replayed | PASS | twitch-final-live-replay.json;36events,1merge,24-input escape and revealed witness; sourceTwitch,no injection |
| R011 | Successful OBS game/chat clip numerically inspected | PASS | obs-final-live-media.json;169.266s,1920×1080,30fps,5077retained video samples,full AAC digital silence;2/5086encoding skips |
| R012 | Complete final edit plays through in an actual browser | PASS | final-demo-browser-playback.json;currentTime96/duration96,endedtrue,errornull,readyState4;local playback only |


## Full hosted delivery

| ID | Check | Status | Evidence / limit |
| --- | --- | --- | --- |
| R013 | Real entry-point hosting configuration regressions pass locally | PASS | render-deployment-verification.json; 119 total, 5 new runtime tests, types/lint/normal build; synthetic configuration, no provider calls |
| R014 | Target Linux runtime and native SQLite execute on selected host | UNVERIFIED | Node 26.13.0 pinned; local checks ran 26.12.0 macOS; remote build/start not executed |
| R015 | Hosted state survives a real persistent-disk service restart | UNVERIFIED | Must save, restart, recover and independently replay at actual HTTPS origin |
| R016 | Complete anonymous YouTube watch playback succeeds | UNVERIFIED | Published Unlisted and oEmbed metadata PASS; 96-second local playback PASS; complete remote watch result pending |
| R017 | Hosted Twitch callback, grant and actual game/replay journey pass | UNVERIFIED | Existing local live proof cannot satisfy hosted origin; additional public posts require authorization |
