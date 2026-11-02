# Independent QA review of HTTP and Twitch boundaries

Date: 2026-10-28. Reviewer authored Room/storage and reviewed the independently authored `src/server/app.ts` and `src/server/twitch.ts` read-only. Scope included action authentication, origin checks, OAuth state binding, private/public payload separation, subscription readiness, token validation/refresh, migration/cold reconnect, dedupe, source-gap callbacks, replay access, and the related HTTP/provider tests.

## QA01: P2 — archived revealed sessions cannot be exported through HTTP — FIXED

At review time, `src/server/app.ts:130` always calls `room.exportReplay()` without forwarding a session selector. After the host reveals a chamber and selects the next chamber, `GET /api/replay?sessionId=<previous-id>` still tries to export the current unrevealed attempt and returns `409 REVEAL_REQUIRED`. The requested prior evidence remains stored and can be exported through the Room API, but the authenticated HTTP interface makes it inaccessible.

Executed a local Fastify injection reproduction with a temporary SQLite database:

1. Authenticate with a fixture host secret.
2. Capture the initial session ID and Reveal.
3. Export current session: HTTP 200.
4. Select Crosswire, creating a new active session.
5. Request `/api/replay?sessionId=<initial-id>`: HTTP 409, `REVEAL_REQUIRED`.
6. Call `room.exportReplay(initialId)`: succeeds and returns the requested archived session.

Recorded output:

```json
{"beforeStatus":200,"archivedRequestStatus":409,"archivedRequestError":"REVEAL_REQUIRED","storedArchiveExportWorks":true}
```

Recommended repair: accept an optional bounded sessionId query on the authenticated replay route, forward it to Room, preserve per-session reveal guards, and add an HTTP regression covering two sessions. Do not expose hidden witnesses or remove authentication to make archived export work.

Adjudication: root implemented an optional UUID-validated sessionId query and forwarded it to `room.exportReplay(sessionId)`. Independent targeted verification executed:

```text
npx vitest run tests/http.test.ts -t 'exports a revealed archived chamber'
Test Files: 1 passed (1)
Tests: 1 passed, 8 skipped
Exit status: 0
```

The regression confirms archived revealed-session export succeeds through authenticated HTTP while the current unrevealed session remains HTTP 409. QA01 is closed by executed regression evidence, not source inspection alone.

## Other inspected boundaries

No additional actionable correctness defect was found in the inspected current OAuth, HTTP authority, or EventSub reconnect code. This is a scoped review result, not a security certification. Existing storage-gap and stale-timestamp findings had already been repaired before this review; Room tests exercise their failure/recovery behavior.

The provider tests use injected HTTP/socket fixtures. This review did not authorize or execute a real Twitch login, live chat, network disconnect, broadcast, hosted deployment, or competition submission. Those evidence gates remain separate.
