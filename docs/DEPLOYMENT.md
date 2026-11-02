# Deploy the complete WORLD//PATCH application

The required hosted release is one Fastify service serving the React/Phaser interface, protected host actions, browser WebSockets, Twitch OAuth/EventSub and persistent SQLite. Deployment is authorized and awaiting provider provisioning; remote acceptance has not passed. A GitHub Pages sandbox serves browser-only play and does not meet this requirement.

The [Render configuration and rollout](RENDER-DEPLOYMENT.md) describe the selected path. `render.yaml` uses one Node 26.13.0 service, one 1 GB disk mounted at `/var/data`, `DATA_DIR=/var/data/world-patch`, normal `npm run build`, `npm start`, `/api/health` and disabled automatic deployments. Keep `VITE_STATIC_DEMO` unset. The latest local startup/configuration gate passed 119 tests, typecheck, lint and build on Node 26.12.0 macOS; Node 26.13.0 Linux/native SQLite execution remains a remote check.

## Configure one persistent process

Use an always-on Node process, outbound HTTPS/WSS to Twitch, HTTPS with browser WebSocket upgrades and a writable persistent filesystem. Do not run a cluster, multiple workers or replicas against the room’s SQLite database. Static-only and ephemeral serverless hosting cannot provide this server architecture.

```sh
npm ci --include=dev
npm run build
# Configure secrets through the host’s private environment manager.
NODE_ENV=production HOST=0.0.0.0 npm start
```

Install dependencies on the target Linux builder; do not copy macOS `node_modules` or its native SQLite binary. The normal build writes `dist/public` and `dist/server`; `dist/judge-demo` belongs to the separate browser-only variant.

Set `HOST_SECRET` to at least 24 cryptographically random characters, `DATA_DIR` to the persistent mount, and the Twitch application’s `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` privately. The public origin is selected from explicit `PUBLIC_ORIGIN`, then Render’s `RENDER_EXTERNAL_URL`, then the loopback default. Production requires an exact HTTPS origin without a trailing slash, path, query, credentials or fragment.

`TWITCH_REDIRECT_URI` defaults to `<selected-origin>/auth/twitch/callback`; an explicit configured callback takes precedence. Once the service origin is assigned, register that exact HTTPS callback in Twitch. Enter the host secret through `/play`, use Connect Twitch and authorize the broadcaster. Configuration alone does not prove OAuth or chat delivery. Never put secrets in URLs, source, browser storage, screenshots or the overlay.

## Alternate Docker path

Both Dockerfile stages pin Node 26.13.0. The runtime removes development packages, runs as an unprivileged user and mounts `/data`. This image recipe has not been executed in the hosting preparation.

```sh
docker build -t world-patch:local .
docker volume create world-patch-data
docker run --name world-patch --env-file .env \
  -p 127.0.0.1:3000:3000 \
  -v world-patch-data:/data world-patch:local
```

Put an HTTPS reverse proxy in front of port 3000. Forward `Upgrade` and `Connection` for `/ws`, preserve Origin and keep the proxy read timeout above 60 seconds. Secure cookies and mutation checks use the selected public origin. Do not enable permissive CORS. Application rate limits use the direct peer address because arbitrary forwarding headers are not trusted.

## Judge entry and remote acceptance

Record the actual HTTPS URL and deployed commit. `/` is the interactive introduction, `/play` is the protected controller and `/overlay` is read-only. Share host control privately when needed, alongside the public source and recorded demo. A spectator link alone does not establish an interactive judge journey.

Before marking full hosting PASS, execute and retain evidence for:

1. Fresh Linux install/build/start with native SQLite and `/api/health`.
2. The actual HTTPS landing, controller and overlay with correct assets.
3. Host login, Secure/HttpOnly cookie behavior and rejection of unauthorized or cross-origin mutations.
4. Browser `wss://<service-origin>/ws` snapshot updates.
5. A saved move and revealed/exported replay, followed by a controlled real service restart and intact recovery from the mounted disk.
6. Exact Twitch callback registration, hosted OAuth, actual EventSub readiness and an actual hosted chat/game/replay journey under separately authorized public-message scope.
7. Read-only overlay, keyboard/mobile/reduced-motion use and judge access from the real origin.

`/api/health` does not prove WSS, Twitch delivery or persistent recovery. Local 119-test proof, the recorded local Twitch round and the published video each remain separate from these hosted checks. Report individual failures in [VERIFICATION.md](../VERIFICATION.md); do not promote provider configuration to a working deployment.

## Operations and recovery

- Check HTTP health, browser WebSocket state and Twitch subscription state separately.
- OAuth tokens and host sessions are memory-only. After restart, sign in and reconnect Twitch; persisted game/log recovery cancels an interrupted election. Do not resume an electorate after a delivery gap.
- SQLite uses WAL and atomic event/checkpoint transactions. Stop the service before copying the complete data directory, or use SQLite’s online backup mechanism. Copying only the main database while WAL is active can lose committed data.
- Retention is bounded at 20 sessions and 20,000 events per session. Export revealed attempts and archive the entire stopped data directory before starting a fresh one. No automatic evidence deletion occurs.
- Host sessions expire after 12 hours. Rotate the private host secret and restart to invalidate sessions; this also changes participant pseudonyms for future events.
- Keep databases private. Do not store raw chat history or OAuth tokens in SQLite. Review exported game actions and revealed witnesses before sharing.
- Upgrade against a backed-up database copy and verify engine/schema compatibility. Restore source and data together for rollback. Never edit historical receipts to fit a changed engine.
