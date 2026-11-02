# Round and storage verification

Date: 2026-10-28. Scope: local Room controller, SQLite durability, evidence export and deterministic replay. These tests do not establish real Twitch operation, browser usability, deployment, or submission readiness.

Executed from the project root:

```text
npx vitest run tests/room.test.ts tests/storage.test.ts
Test Files: 2 passed (2)
Tests: 25 passed (25)

npm run typecheck
Exit status: 0

npx eslint src/server/room.ts src/server/storage.ts src/server/replay.ts src/shared/protocol.ts tests/room.test.ts tests/storage.test.ts --max-warnings=0
Exit status: 0
```

The 19 room tests cover server deadlines; proposal/vote/pause movement guards; canonical proposal deduplication; quota/cooldown; stable candidate numbers; notification and chat-message dedupe; replacement ballots; canonical tie-breaking; empty audiences; malformed/no-op/unsolvable/incomplete rejection; separate room/game revisions; injected stale-snapshot prevention; participant blocking; witness and identity privacy; baseline/merged checkpoint reveal; reset; source isolation; source-gap cancellation; timestamp admission; detached snapshots; bounded history; failed persistence rollback; and listener failures.

The six storage tests execute actual temporary SQLite databases, close and reopen stores, recover cancelled elections and dedupe, restore merged checkpoints, verify event replay, reject altered/reordered/version-incompatible records and invalid witnesses, reject corrupt checkpoint bytes, and preserve previous revealed-session exports.

Security review repairs were verified:

- A volatile pending cancellation is set before attempting to save a Twitch source-gap cancellation. When disk writes fail, subsequent `tick`, host action, or chat input must retry cancellation before a stale election can resolve. The failure/recovery test confirms an overdue voted patch never merges.
- Paused/cooldown command bursts do not append evidence, expand room state, or increase revision. Valid accepted/meaningful rejected commands remain deduplicated persistently. Provider-level bounded dedupe is still required for dropped traffic.
- Live commands require a provider timestamp belonging to the current proposal/vote/resume window. Old/missing/far-future messages produce no persistent state growth. Accepted event evidence contains notification/message IDs and timestamps without participant identity.

An initial parallel test run produced one legitimate `BASELINE_UNVERIFIED` result because CPU scheduling exhausted the original 50ms baseline budget. The room now gives its authored startup baseline 250ms; patch checks retain the 50ms/5000-node bounds. Tests inject a constant monotonic solver clock for repeatability, with separate forced deadline-exhaustion cases. The shared production engine still enforces its node and time limits.

Operational limits implemented: one active session, at most 20 archived SQLite sessions, 20,000 events per session, 10,000 processed chat identities per session, 1,000 participating identities per round, eight candidate slots, and 40 visible history entries. Chat stops at revision 19,000 to reserve space for ending/revealing/exporting the attempt. Full archive capacity fails closed; export and offline database archival are required before further sessions. No automatic destructive pruning occurs.

Full replay export requires explicit Reveal and is intended for authenticated host access. It contains baseline and merge witnesses. Public snapshots expose only the current checkpoint witness after reveal; private actor mappings never enter the event export. The hash chain detects alteration relative to the supplied evidence; it is not a signature and does not defend against an administrator rewriting the whole log.

Remaining verification outside this worker: HTTP authentication/origin isolation, provider connection lifecycle, actual single-account Twitch commands, UI/OBS interaction, production deployment, and load characterization.
