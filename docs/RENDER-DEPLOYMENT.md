# Full application on Render

`render.yaml` proposes one Node web service for the existing Fastify application, its React/Phaser interface, browser WebSockets, outbound Twitch EventSub connection and SQLite storage. The owner has authorized the full deployment. Provider provisioning and all remote acceptance checks remain pending; this file is not a deployment receipt.

The hosted entry is the service's HTTPS origin: `/` opens the playable introduction, `/play` opens the protected controller and `/overlay` is the read-only broadcast view. `/api/*` and `/ws` run on the same service. This is the normal application build; leave `VITE_STATIC_DEMO` unset and do not deploy `dist/judge-demo` for this service.

## Selected service configuration

| Setting | Proposal |
| --- | --- |
| Source | `https://github.com/himanshu748/world-patch`, `main` |
| Runtime | Node `26.13.0` |
| Region | Oregon |
| Compute | `0.5c-512mb`, one instance |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Automatic deploys | Disabled with `autoDeployTrigger: "off"` |
| Health check | `/api/health` |
| Listener | `HOST=0.0.0.0`, Render-provided `PORT` |
| Persistent disk | 1 GB at `/var/data` |
| SQLite directory | `DATA_DIR=/var/data/world-patch` |

SQLite and the room coordinator require one process and one instance. Do not add a process cluster, autoscaling or another replica against this disk. Render disks attach to paid services, are accessible only at runtime and prevent zero-downtime deploys. These requirements are why the proposal uses paid compute rather than a free service. Keep all database files, including SQLite's WAL, under the mounted directory. [Persistent disk requirements](https://render.com/docs/disks), [Blueprint fields](https://render.com/docs/blueprint-spec).

The exact Node version overrides Render's changing default. Node `26.13.0` is the LTS release dated 28 October 2026; its official release page publishes the Linux distributions and signed checksum list. Both Dockerfile stages use the matching `26.13.0-bookworm-slim` image. The Render proposal uses its native Node runtime; the separate Docker recipe has not been executed as part of this preparation. [Node release and checksums](https://nodejs.org/en/blog/release/v26.13.0), [Render Node version selection](https://render.com/docs/node-version), [official Node Docker source](https://github.com/nodejs/docker-node/blob/main/26/bookworm-slim/Dockerfile).

`npm ci --include=dev` installs the pinned lockfile, including TypeScript and Vite needed by the production build even when `NODE_ENV=production`. Run this installation on Render's Linux builder. Do not copy macOS `node_modules` or its `better-sqlite3` binary to the host. Native SQLite installation and startup on Node `26.13.0` remain remote acceptance checks. Node's Linux binaries from version 25 also require `libatomic`; verify the chosen native runtime includes it. A missing prebuilt SQLite binary may require a compatible native compiler toolchain, rather than disabling installation scripts. [Node Linux dependency note](https://nodejs.org/en/blog/release/v26.13.0), [SQLite installation guidance](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md).

## Origin and private configuration

The process chooses its public origin in this order:

1. Explicit `PUBLIC_ORIGIN`.
2. Render's documented `RENDER_EXTERNAL_URL`.
3. The existing local default, `http://localhost:3000`.

The selected value must still pass the application's exact-origin and HTTPS validation. Do not include a path, trailing slash, query, credentials or fragment. `TWITCH_REDIRECT_URI` defaults to `<selected-origin>/auth/twitch/callback`; an explicit value continues to take precedence. For a custom domain, set `PUBLIC_ORIGIN` to that domain's exact HTTPS origin before testing the browser and OAuth flow. Render injects its external URL and listening port; no Blueprint variable interpolation is needed. [Render environment variables](https://render.com/docs/environment-variables).

The Blueprint marks `HOST_SECRET`, `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` as `sync: false`. Supply actual values only through the authorized private deployment configuration. Use a new production host secret containing at least 24 random characters; never publish it, add it to a URL or give it to the overlay. No production secret value is included in source or documentation. Keep `.env` out of the repository. A connected Twitch app is configured separately from an authorized broadcaster session.

After the service URL is assigned, register the exact HTTPS callback in the Twitch application. Enter the host secret at `/play`, then use **Connect Twitch** and authorize the broadcaster account. The callback registration and consent are required; configuring two environment variables alone does not prove a live Twitch connection. Tokens and host sessions remain memory-only. After a restart, sign in again and reconnect Twitch; the persisted game/log recovers and an interrupted election is canceled. [Twitch authorization-code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow).

Render supports inbound browser WebSockets and outbound connections. The existing client uses `wss://<service-host>/ws` on HTTPS; Twitch EventSub remains a server-side outbound connection. Validate both separately. A health response does not establish either connection. [WebSockets on Render](https://render.com/docs/websocket).

## Validation and rollout

Before any resource creation:

```sh
render blueprints validate render.yaml --output json
npm run typecheck
npm run lint
npm test
npm run build
```

The initial authenticated CLI validation returned `valid:false` because the existing workspace had reached its 25-service/database limit, despite a zero command exit code. That is historical evidence in `evidence/render-deployment-verification.json`. A separate empty workspace resolves that capacity constraint without modifying existing projects. Deployment is authorized and awaiting provider provisioning. Check the validator’s JSON result and the actual service state; neither an exit code nor a prepared Blueprint proves deployment.

The local gate passed strict type checking, lint, all 119 tests and the normal production build. Five new tests launch the actual source entry point from fresh temporary directories with synthetic configuration and no inherited credentials. They exercise Render fallback, explicit origin precedence, the local default, secure cookies and CSRF behavior, derived/overridden OAuth callbacks and rejection of a malformed Render origin. They create authorization URLs only; they do not contact Twitch or establish a live provider session. These tests ran on the local Node `26.12.0`; the pinned `26.13.0` Linux runtime still needs its own build/start check. No browser rerun was needed for this server configuration change; the preceding default 22-browser result remains separate evidence for the unchanged client.

Deploy the reviewed hosting revision to only the selected service and disk, supply private variables through the provider configuration, and record the exact deployed commit. Public source publication is already verified for the earlier captured-game revision; the hosting preparation requires its own reviewed update. `autoDeployTrigger: "off"` prevents later pushes from automatically changing the hosted build; it does not prevent the initial deployment or deliberate manual deployments. Record the deployed commit and keep it fixed during judging unless a separately approved repair is needed.

Before calling the hosted product verified, exercise:

- Fresh Linux dependency installation and startup, `/api/health`, the actual landing, `/play` and `/overlay`.
- HTTPS host login, unauthorized mutation rejection, secure cookies and browser WebSocket updates.
- A persisted move and reveal/export, followed by a controlled restart and correct state recovery from `/var/data/world-patch`.
- Exact Twitch callback, real authorization, EventSub readiness and separately authorized actual chat/game/replay behavior.
- Read-only overlay, judge entry, keyboard/mobile behavior and source/asset paths on the real HTTPS origin.

Record local tests, Render build/start, disk persistence, browser behavior and live Twitch proof as separate results. Remote Linux/native compatibility, deployed access, TLS/WSS, restart persistence, public judge access and a new hosted Twitch session are all unverified at this preparation checkpoint. No remote capacity, performance or uptime claim follows from the local tests.
