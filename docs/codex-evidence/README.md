# Codex development evidence viewer

This self-contained local HTML viewer is an original presentation for a short OBS capture. Open index.html as an OBS Browser Source local file at 1920×1080, or serve this directory on loopback. It uses no external fonts, assets, network requests or runtime model.

Use buttons or keys1/2/3 to switch between Codex build, Shared rules and Executed verification. Arrow keys, Home and End work within the tab list. No fake typing, generated tool output, timed auto-advance or decorative animation is used.

The build panel contains an exact selected source excerpt from the actual main Codex session's source-writing call for src/server/app.ts. Its call ID, recorded timestamp and input hash are retained. The original tool result says Script completed. The current shared-engine panel is explicitly separate: the main log's engine hits were reads/tests, so this viewer does not claim that its displayed main record created engine.ts. The selected historical server excerpt predates later hardening.

The current verification panel reads the executed November2 reports:114 passed unit/property/server/provider-fixture tests,22 passed production-browser journeys, TypeScript/ESLint/build success and zero drift across45 project files from the final report manifest (dependencies excluded). These local results are not live Twitch, OBS, broadcast or hosted-delivery proof.

The raw Codex transcript is not exported. evidence.json contains only the whitelisted source excerpt, metadata, current source snippets and report summaries/hashes. It contains no OAuth/browser/authentication records or personal answers. Source snippets are assigned with textContent; no untrusted text is inserted as HTML.

This is an evidence viewer, not a recording or reconstruction of the native Codex interface. The parent still needs to inspect its actual1920×1080 browser rendering before the final capture. Suggested capture: build panel10s, shared rules12s, executed verification10s. The displayed dates are source-record and verification dates, not simulated live execution.
