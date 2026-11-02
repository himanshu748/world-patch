# Deploy one persistent WORLD//PATCH server

This is a reproducible deployment recipe, not a deployment receipt. No service has been provisioned or paid for. Publishing requires the user's authorization and a chosen host. The application is deliberately a single room, not a multi-tenant platform.

## Host requirements

Node 22.12+ (release checks report the exact tested version), an always-on process, outbound HTTPS and WSS access to Twitch, an HTTPS reverse proxy with WebSocket upgrades, and a persistent filesystem for SQLite. One process only: do not run multiple workers against the same database or scale replicas. Static-only and ephemeral serverless hosting cannot run this architecture correctly.

For a machine with Node installed:

```sh
npm ci
npm run build
# Configure secrets through the host's private environment manager.
NODE_ENV=production HOST=127.0.0.1 npm start
```

`npm run smoke:production` exercises the built server with isolated temporary SQLite storage, including a process restart, persistence and cancellation of an interrupted election. Its executed report is evidence/production-smoke.json. This verifies a local Node deployment path; the Docker image, external TLS proxy and chosen remote hosting must still be tested separately.

Set PUBLIC_ORIGIN to the exact HTTPS origin, HOST_SECRET to at least 24 cryptographically random characters, DATA_DIR to a writable persistent path, TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET from your own registered app, and TWITCH_REDIRECT_URI to `<PUBLIC_ORIGIN>/auth/twitch/callback`. Register that exact callback in Twitch. Never expose the host secret in a link, OBS source, browser storage or source repository.

The Dockerfile builds the client/server, removes development packages, runs as an unprivileged user and mounts /data. Example after configuring a local secrets file:

```sh
docker build -t world-patch:local .
docker volume create world-patch-data
docker run --name world-patch --env-file .env \
  -p 127.0.0.1:3000:3000 \
  -v world-patch-data:/data world-patch:local
```

Use an HTTPS proxy in front of port 3000. Forward `Upgrade` and `Connection` for `/ws`, preserve the Origin header, and set proxy read timeout above 60 seconds. The server compares browser Origin to PUBLIC_ORIGIN; cookie Secure flags follow this configured origin. Do not enable permissive CORS. Prefer a single reverse proxy and IP-level abuse limits if publicly exposed; application rate limits use the direct peer address because arbitrary forwarding headers are not trusted.

## Judge access

Give judges the HTTPS controller URL, read-only `/overlay`, repository access, setup instructions and the recorded demo. Share host access privately only if interactive control is needed; public users otherwise see the current room read-only. A public persistent simulation room must be clearly labeled Simulation. A public spectator link alone is not an interactive judge demo; explicitly explain how judges obtain control or run locally.

## Operations and recovery

- Check `/api/health`, application WebSocket status and Twitch subscription status separately. A 200 health response does not prove chat delivery.
- OAuth tokens are memory-only. Restart recovers game/log and cancels an active election; reconnect Twitch manually. Do not resume a partial electorate after a delivery gap.
- SQLite uses WAL and atomic event/checkpoint transactions. Stop the process before copying the data directory for a simple consistent backup, or use SQLite's online backup mechanism. Copying only the main database while WAL is active can lose data.
- Retention is bounded at 20 sessions and 20,000 events per session. Export revealed attempts and archive the entire stopped data directory before starting a fresh one. Do not delete active evidence to clear capacity. The UI/API reports capacity errors; there is no automatic evidence deletion.
- Host sessions expire in 12 hours and disappear on process restart. Rotate HOST_SECRET and restart to invalidate host sessions; it also changes participant pseudonyms for future events.
- Store no raw chat history or OAuth tokens in SQLite. Provider event/message IDs support provenance; participant identities are pseudonymized. Keep databases private. Exports contain game actions and revealed witnesses and should be reviewed before sharing.
- Before upgrading, stop/save the current build and data, run the required suite against a copy, and verify engine/schema compatibility. Unknown versions and corrupt receipts fail closed. Restore prior source and database together for rollback. Do not edit historical receipts to fit a changed engine.

## Deployment acceptance

Execute fresh install/build/start; host login; public unauthorized mutation rejection; WSS connection; persistence across restart; real OAuth and same-account chat; delivery-gap behavior; 1080p overlay; no secret exposure. Record the actual URL, source digest, timestamp and failures in VERIFICATION.md. Docker recipe execution, hosting persistence, TLS and judge accessibility remain UNVERIFIED until run on the chosen environment.
