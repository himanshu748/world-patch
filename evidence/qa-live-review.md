# Actual Twitch evidence QA — 30 October 2026

Independent read-only reviewer: /root/live_evidence_review. The reviewer inspected scoped provider-ID code, the actual replay, screenshots and current test reports without accessing private configuration or changing files.

The replay independently recomputed 36 events, one merge, 24 player moves and an escaped final state. It retains two canceled earlier rounds, one NO_ESCAPE rejection, one wall proposal and one ballot. Actual notification IDs are 44-character opaque strings with punctuation; the live failure was a format restriction. The separate 128/256 length mismatch was found by security review and repaired before the successful retry.

The current reports show 112/112 unit/property/server/provider-fixture tests and 12/12 browser journeys, with no failures/skips/flaky tests. A 41-file fingerprint matches the tested source with zero drift. The chat screenshot contains five authorized posts. The final witness screenshot shows Twitch ready, Twitch origin and 24/24 EXIT REACHED.

The reviewer found two minor delivery issues during preparation: the evidence-recording script still expected 11 browser tests, and README/Devpost copy briefly retained that count. The parent repaired those before final recording and packaging, inspected the current counts, and successfully ran the recording script. No remaining material code/evidence issue was reported.

Package private-value scanning is performed by the parent separately and recorded in package-verification.json. Actual provider reconnect, OBS/livestream capture, judge/public delivery and submission remain unverified or blocked. This review is not an audience study, provider outage test or broadcast proof.
