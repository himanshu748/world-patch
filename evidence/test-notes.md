# Executed validation notes

28 October 2026: first broad server suite contained 77 tests. 76 passed; the loopback WebSocket test failed before listening with `listen EPERM: operation not permitted 127.0.0.1` under the restricted sandbox. No application assertion failed in that test. Reran the same suite with approved loopback access; all 77 passed. The successful JSON report is evidence/server-tests.json. This note preserves the original environment failure; it is not a claim that the first run passed.

Kernel exit: 42 tests, including 600 seeded property trials. Subsequent suites include kernel plus new modules and may increase test counts. Use the final report for release status.

Twitch tests use injected HTTP and WebSocket fixtures, not real Twitch credentials or traffic. User reported no Twitch account on this date.
