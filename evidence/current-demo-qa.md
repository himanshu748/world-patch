# Current demo gate QA — 30 October 2026

Scope: current WORLD//PATCH source and interrupted whole-product continuation, before OBS capture. The reviewer/worker owned only browser test fixtures and this evidence. No application, engine, provider, server-limit or dependency behavior was changed. No private environment/account/data was inspected.

## Executed verification

- Typecheck and ESLint passed after the final fixture repair.
- All 113 current unit/property/server/provider-fixture checks passed. The production build passed. Those commands preceded the browser-only fixture edits; all application, unit source and runtime/build configuration stayed byte-identical.
- All 22 production-browser journeys passed in 88.54 seconds, with zero failures, skips or flaky tests. Port3137 and temporary SQLite storage were isolated; Twitch was disabled.
- The46-file source/test/configuration fingerprint is unchanged across the final verification pass. Exact hashes, command sequence, final reports and failure history are in current-demo-checks.json, current-demo-unit.json and current-demo-browser.json.

## Reproduced failures and fixture repairs

The interrupted design continuation had already added per-file host-cookie reuse and recorded an earlier22/22 pass. However, playwright.config.ts changed during that run, so its fingerprint could not establish the exact current gate. A fresh full run reproduced a timing-dependent login-limit setup failure:20/22 passed, while the desktop host test encountered429 after six earlier login submissions. The replay keyboard test also pressed Enter while Reveal was still disabled after a pending movement.

The final test setup uses one worker-scoped, in-memory synthetic host session for non-auth journeys. All browser files share that fixture pool. Wrong-secret/recovery, desktop/mobile sign-in and delayed-bootstrap authentication still use real anonymous UI flows, totaling five additional login submissions. This fits the unchanged six-per-minute production limit without waiting for the machine to run slowly or bypassing authentication. No cookies are written to files. Keyboard Reveal waits for the real control to become enabled. Painted-board inspection waits for exactly one committed canvas before checking its pixels, allowing Phaser's old chamber canvas to finish destruction while still failing if duplicates persist.

A partial fixture-repair run was deliberately interrupted to finish consistent worker-pool imports; no pass is attributed to it. Its transient two-canvas failure and the full prior20/22 failure are retained as complete reports inside current-demo-checks.json. The final22/22 run supersedes them for this source.

## Scoped correctness review

No material remaining issue was found in the reviewed terminal-capacity reserve, delayed bootstrap/config/action guards, read-only spectator replay or local seek/speed controls. The actual20,000-event storage regression seeds a valid hash-linked prefix efficiently, then exercises real Room/SQLite recovery, terminal Reveal and archive export at the unchanged hard cap; it is not20,000 browser clicks. The browser capacity response is labeled an HTTP presentation fixture. Eight-choice ballot data remains a layout fixture.

The separate twitch-live-recovery.json was reviewed read-only: actual keepalive_timeout → reconnecting → ready under a controlled35-second local process stall, a changed TCP connection and preserved game/session/receipt/phase support actual cold-reconnect proof. The adapter publishes ready only after validating a202 subscription response. This does not establish a provider outage, requested migration, active-election cancellation or new chat-message delivery. Raw network addresses need not be retained in public evidence; tuple hashes or the comparison result suffice.

All local fixture/browser checks remain distinct from actual Twitch chat evidence, actual OBS/livestream capture, human usability, public access and submission readiness.
