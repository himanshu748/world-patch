# Full application on the existing Lightsail host

Target: `https://worldpatch.13.204.212.172.sslip.io` on the existing Foley host in Mumbai. This procedure adds one isolated WORLD//PATCH container, persistent data volume, Docker network and Caddy site. It does not replace the Foley stack or change another application's data, image, ports or environment.

At preparation, the host is x86_64 Ubuntu 24 with Docker 29.1.3, 2 GB RAM, approximately 915 MiB available, no swap and six existing containers. Those readings are a snapshot; repeat them before the actual rollout. This guide does not establish that the application has been deployed or that Twitch is connected. Record CI and remote verification separately.

## Build on GitHub, not the shared host

The checked-in manual workflow is `.github/workflows/linux-image.yml`. It builds the existing Dockerfile on a GitHub-hosted Ubuntu 24.04 runner for `linux/amd64`, tags the image `world-patch:<source-commit>`, loads it on that runner and executes `scripts/container-host-smoke.mjs`. It has only `workflow_dispatch`, read-only repository permission and no registry publishing, remote SSH or production credentials. The application build runs in Linux; do not copy the Mac's native SQLite module to the host.

The workflow pins each action to the commit returned by its official repository's Git tag API. Checkout does not persist repository credentials. Node `26.13.0` is pinned for the smoke runner and both Docker stages. The official Node Bookworm slim image includes the Linux `libatomic` dependency; actual image build/start and native SQLite compatibility are proved only by successful CI execution, not by the tag or this guide. [Node release](https://nodejs.org/en/blog/release/v26.13.0), [official Docker source](https://github.com/nodejs/docker-node/blob/main/26/bookworm-slim/Dockerfile).

After publishing the reviewed source, dispatch the workflow deliberately:

```sh
gh workflow run linux-image.yml --repo himanshu748/world-patch --ref main
gh run list --repo himanshu748/world-patch --workflow linux-image.yml --limit 3
gh run watch RUN_ID --repo himanshu748/world-patch --exit-status
gh run download RUN_ID --repo himanshu748/world-patch \
  --name world-patch-linux-amd64-SOURCE_COMMIT --dir world-patch-artifact
```

Replace the run ID and source commit with the reviewed run's actual values. Confirm that the run's `headSha`, image tag and `metadata.json` `sourceSha` all match the approved commit. Do not accept a newer branch head merely because the workflow passed.

The success artifact contains `world-patch-image.tar.gz`, `metadata.json`, `container-smoke.json` and `SHA256SUMS`. It expires after three days. The smoke check covers native SQLite, actual frontend/assets, health, host authentication, wrong-origin rejection, Secure cookies, both accepted/rejected browser WebSocket Origins, a real move, active-election restart, persisted game recovery, invalidated old host session and independent verification of a fetched replay. It uses a disposable volume, a randomly named container and a generated synthetic host secret. Its cleanup targets only those owned resources. It does not claim public TLS, remote WSS or live Twitch proof. A failed smoke can retain its diagnostic JSON without publishing an image artifact. [Docker image artifacts](https://docs.docker.com/build/ci/github-actions/share-image-jobs/).

## Inspect and import before starting the application

Root performs the remote operations through the existing approved access path. Before mutation, record container names/states, existing network membership, free memory, disk space and the Caddy configuration mount. Keep existing applications running. Do not run a shared-stack `compose down`, Docker prune, unrelated container stop, daemon restart or unbounded build.

Transfer only the verified image artifact and metadata through the approved SSH channel. On the host, verify the checksums in the artifact directory, load the image and compare its ID to `metadata.json`:

```sh
sha256sum --check SHA256SUMS
gzip --decompress --stdout world-patch-image.tar.gz | docker load
docker image inspect world-patch:SOURCE_COMMIT \
  --format '{{.Id}} {{.Os}} {{.Architecture}}'
```

The expected platform is `linux amd64`. Do not build while loading the image, and do not start the application until import finishes. Image import is Docker-daemon work; limiting a client shell does not cap the daemon. Watch host memory and the existing applications during import, then recheck available memory before reserving the new runtime's 512 MiB limit. A configured limit is a ceiling, not proof that the host has enough current headroom.

## Separate network, storage and private configuration

First ensure the proposed names are absent or already belong to this application. Inspect any existing name collision instead of reusing or replacing it blindly. Create only the WORLD//PATCH network and volume:

```sh
docker network create --label app=world-patch world-patch-net
docker volume create --label app=world-patch world-patch-data
docker network connect --gw-priority -1 world-patch-net foley-caddy-1
docker inspect foley-caddy-1 \
  --format '{{(index .NetworkSettings.Networks "world-patch-net").IPAddress}}'
```

The negative gateway priority keeps the new bridge from replacing Caddy's existing default gateway when existing networks have their normal priority. Verify actual network membership and routes after attachment. Do not detach any existing network. Docker selects the highest gateway priority. [Docker network connections](https://docs.docker.com/reference/cli/docker/network/connect/).

Store the production environment file outside the checkout, for example `/opt/world-patch/production.env`, owned by root with mode `0600`. Root supplies new private production values for `HOST_SECRET`, `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`; do not print them or put them in shell arguments, logs, artifacts or documentation. Keep the file out of the image and repository. Configure these non-secret settings:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DATA_DIR=/data
PUBLIC_ORIGIN=https://worldpatch.13.204.212.172.sslip.io
TWITCH_REDIRECT_URI=https://worldpatch.13.204.212.172.sslip.io/auth/twitch/callback
```

Set `TRUSTED_PROXY_IP` to Caddy's exact address on `world-patch-net`, obtained above. Do not use a CIDR, `true`, the public host address or an untrusted forwarded header. The application remains fail-closed for invalid values and compares browser Origin to the exact public origin. Leave `VITE_STATIC_DEMO` unset.

The named volume mounts at `/data`; a fresh volume inherits the image's writable directory ownership for the unprivileged `node` user. SQLite, including its WAL and shared-memory files, stays there. Do not mount another project's volume or private environment. Caddy's manual network attachment survives a container restart but must be re-established after its container is recreated; recheck the proxy IP then and update only this application's configuration if it changed.

## Start one limited runtime

The following is a first-deployment command after checking that the name is free. Use the exact verified image tag:

```sh
docker run --detach --name world-patch \
  --label app=world-patch \
  --restart unless-stopped \
  --network world-patch-net \
  --memory 512m --memory-swap 512m --cpus 0.5 \
  --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --log-driver local --log-opt max-size=5m --log-opt max-file=2 \
  --mount type=volume,source=world-patch-data,target=/data \
  --env-file /opt/world-patch/production.env \
  world-patch:SOURCE_COMMIT
```

No host port is published. Caddy reaches port 3000 on the dedicated network. Keep a single Node process and one application instance for SQLite and the room coordinator. Equal memory and memory-swap limits prohibit container swap; do not disable the OOM killer or raise limits in response to a failed test on the shared host. [Docker resource limits](https://docs.docker.com/engine/containers/resource_constraints/).

Check the container's health, memory/CPU configuration, read-only root, volume, restart count and OOM state without dumping its environment. For example:

```sh
docker inspect world-patch --format \
  '{{.State.Health.Status}} memory={{.HostConfig.Memory}} cpu={{.HostConfig.NanoCpus}} readonly={{.HostConfig.ReadonlyRootfs}} oom={{.State.OOMKilled}} restarts={{.RestartCount}}'
docker stats --no-stream world-patch
docker exec world-patch node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))"
```

Do not call the deployment healthy from an image import or a started-container flag alone.

## Add one Caddy site and reload

The host source file is `/opt/foley/deploy/Caddyfile`; the existing Caddy container is `foley-caddy-1`. Confirm its actual bind mount and in-container configuration path before editing. Save a restricted backup and a before/after diff. Preserve every existing site and global setting. Add only:

```caddyfile
worldpatch.13.204.212.172.sslip.io {
    reverse_proxy world-patch:3000
}
```

If the file is individually bind-mounted, an atomic replacement can leave Caddy reading the old inode. Apply the reviewed change in place and confirm that the container sees it. Assuming inspection confirmed `/etc/caddy/Caddyfile`, validate and live-reload through the existing process:

```sh
docker exec foley-caddy-1 caddy validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec foley-caddy-1 caddy reload \
  --config /etc/caddy/Caddyfile --adapter caddyfile
```

Do not restart or recreate the shared Caddy container. Its reverse proxy supports WebSockets and normally passes Origin and Host through; it sets forwarded headers itself. Do not add permissive CORS or overwrite browser Origin. Validate certificate issuance and DNS for the actual hostname, then compare the existing applications' health with the pre-change snapshot. A reload is not proof that every existing long-lived stream remained connected. [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy reload](https://caddyserver.com/docs/command-line#caddy-reload).

## Verify the real hosted journey

Record the approved source commit, workflow run, image ID, artifact checksum, container settings and actual HTTPS URL. Through the real public origin, verify the landing, its three playable chambers, `/play`, read-only `/overlay`, assets, `/api/health`, host login, unauthorized mutations, origin checks and WSS snapshot updates. Test trusted-proxy handling through Caddy; a direct CI WebSocket test does not establish this proxy path.

Before an active Twitch session, use controlled simulation data to verify move/reveal/export and one planned application-only restart. Confirm saved game recovery, canceled interrupted elections and invalidated old host cookies. Do not restart another application, replace the volume or expose private host access to complete the check.

Register the exact HTTPS Twitch callback, then authorize the broadcaster through the hosted controller. Verify subscription readiness and actual separately authorized chat/game/replay behavior. Configuration, a connected browser socket, a simulated replay and CI success do not establish live Twitch delivery. Tokens and host sessions are memory-only, so application restarts require sign-in and Twitch reauthorization.

Keep observed CI/Linux behavior, hosted HTTPS/WSS, durable-volume recovery, existing-app preservation and Twitch proof distinct. At this guide's preparation checkpoint, workflow/source checks are implemented; actual image execution and remote-host behavior remain pending the root task's recorded results.

## Updates and recovery

Deploy manually from a reviewed successful artifact; there is no automatic production update in the workflow. Retain the previous image ID and a consistent backup of the application's data before upgrading. Stop only WORLD//PATCH before taking a simple whole-volume backup, or use SQLite's online backup mechanism. Copying its main database alone while WAL is active can lose data. Never run two application versions against the volume at once.

Rollback changes only the WORLD//PATCH container/image and, if appropriate, its compatible saved data. For Caddy rollback, remove or repair only this site's block in the latest file, then validate and reload. Restoring an entire old shared Caddyfile can erase somebody else's later changes. Preserve the application volume and recorded evidence; do not run global image, volume or builder cleanup.

### Why an on-host build is not selected

The approximately 915 MiB available/no-swap snapshot leaves too little demonstrated build headroom for npm, TypeScript, Vite/Phaser and possible native SQLite compilation alongside the six existing containers. An unbounded `docker build` is inappropriate here. The selected path moves all compilation to the isolated GitHub runner.

If a separately approved future fallback becomes necessary, Docker's `docker-container` Buildx driver supports a dedicated builder with `memory=512m`, `memory-swap=512m`, `cpu-period=100000` and `cpu-quota=50000`, plus BuildKit `[worker.oci] max-parallelism = 1`. Verify the builder's actual cgroup limits before use and do not overlap it with the new runtime. These limits do not bound all Docker-daemon image-import/cache activity or prove this build fits 512 MiB. Stop on failure rather than raising the cap, adding swap or disabling OOM protection without a separate decision. No on-host builder was created by this preparation. [Builder limits](https://docs.docker.com/build/builders/drivers/docker-container/), [BuildKit parallelism](https://docs.docker.com/build/buildkit/configure/#max-parallelism).
