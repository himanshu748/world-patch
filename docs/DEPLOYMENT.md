# Deploy the complete WORLD//PATCH application

The selected release reuses the existing Foley Lightsail host at `https://worldpatch.13.204.212.172.sslip.io`. It runs the complete Fastify application: React/Phaser, protected host/API routes, browser WebSockets, Twitch OAuth/EventSub and persistent SQLite. Deployment is executed and verified. Public TLS/WSS, saved-state recovery and the actual hosted Twitch election/player escape/replay passed; see [deployment evidence](../evidence/lightsail-deployment.json). A GitHub Pages sandbox cannot meet this requirement.

Use the [Lightsail deployment guide](LIGHTSAIL-DEPLOYMENT.md) for the exact approved commands, resource boundaries and rollback. The Render guide remains an unused alternative; no Render application service is part of this release.

## Build and transfer a verified artifact

The manual GitHub workflow builds Linux/amd64 off-host with pinned Node 26.13.0 and executes the isolated container smoke. It has no automatic production deployment, remote SSH or production credentials. Do not compile the application on the shared Foley host. Install native SQLite inside the Linux image; do not copy the Mac’s `node_modules`. Keep VITE_STATIC_DEMO unset so the image contains the normal server build.

The deployed artifact came from CI3 run 41426371617 at source 49555058b0e9ceb99060ce9dc3202d1ea4bd255c, which passed 39 Linux container checks including restart/replay. CI1’s native-build and CI2’s stale-port harness failures remain historical. For any future update, require another completely successful build and restart/replay smoke. Bind the successful run’s source commit, image tag/ID, artifact metadata and checksums before transfer. The detailed guide describes the artifact import checks.

## Isolate the runtime and proxy

Use one WORLD//PATCH container with 512 MiB RAM and 0.5 CPU limits, one dedicated Docker network and a named volume at `/data`. Run one Node process. Do not add replicas, share another application’s volume or publish a host port. Caddy reaches port 3000 on the dedicated network. Preserve the six existing containers, sites, networks and environment settings; record before/after health.

Configure private host/Twitch values outside the checkout, image and logs. Set PUBLIC_ORIGIN to the exact HTTPS hostname and TWITCH_REDIRECT_URI to `https://worldpatch.13.204.212.172.sslip.io/auth/twitch/callback`. Register that exact callback with Twitch. Never expose secrets in a URL, overlay, screenshot or source repository.

Set TRUSTED_PROXY_IP to Caddy’s exact address on the dedicated application network. Unset disables proxy trust. CIDRs, blanket true and malformed values are rejected. Do not trust the public host address or a supplied forwarded header. Recheck Caddy’s address after its container is recreated; preserve every existing network and gateway. Exact browser Origin checks remain enforced independently.

Add only this hostname’s Caddy reverse-proxy block, validate it and reload the existing Caddy process. Do not restart the shared proxy or replace another site. The [detailed guide](LIGHTSAIL-DEPLOYMENT.md) covers bind-mounted configuration handling and scoped rollback.

## Verify the public journey

Record the deployed source commit, workflow run, image ID/checksum, URL and runtime limits. The initial rollout exercised these acceptance checks. For each future runtime change, retain new results for:

1. Actual HTTPS landing, three playable chambers, `/play`, read-only `/overlay`, assets and `/api/health`.
2. Host login, Secure/HttpOnly cookies, unauthorized mutation rejection and exact Origin enforcement.
3. Browser WSS snapshots through the real Caddy path, including the exact trusted-proxy setting.
4. A saved move, revealed/exported replay and controlled application-only restart with correct SQLite recovery and invalidated old host session.
5. Exact Twitch callback, hosted authorization, real EventSub readiness and an actual hosted chat/game/replay journey under separately authorized public-message scope.
6. Preserved existing-app health, keyboard/mobile/reduced-motion behavior and the judge’s real hosted entry.

HTTP health, CI checks and a published recording do not prove this hosted journey. The 127-test local gate,39-check Linux CI,78-check hosted suite and actual hosted Twitch replay remain separate evidence in [VERIFICATION.md](../VERIFICATION.md).

## Operations and recovery

- Check HTTP health, browser WSS and Twitch subscription state separately.
- OAuth and host sessions are memory-only. After an application restart, sign in and reconnect Twitch. Persisted recovery cancels an interrupted election.
- SQLite uses WAL. Stop only WORLD//PATCH before a simple whole-volume backup, or use SQLite’s online backup mechanism. Copying only the main database while WAL is active can lose committed data.
- Export revealed attempts and archive the complete stopped data directory before resetting capacity. There is no automatic evidence deletion. Keep databases and production environment files private.
- Retain the previous image and compatible data backup before upgrades. Never run two versions against the same volume. Rollback only WORLD//PATCH and its own Caddy block; restoring an old complete shared proxy file could erase later changes by others.
- Do not run global Docker prune, unrelated container stops, daemon restarts, unbounded host builds or shared-stack shutdowns.
