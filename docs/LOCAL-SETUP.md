# Run WORLD//PATCH locally

No Twitch account is needed for labeled simulation. Real Twitch verification requires the account and application setup below. Never paste client secrets in chat or commit `.env`.

## Install and play

Use Node.js 22.12 or newer (the verified runtime version is recorded in VERIFICATION.md), npm and a modern Chromium/Firefox/Safari browser. From the project folder:

```sh
npm ci
cp .env.example .env
# Replace HOST_SECRET with at least 24 random characters in your editor.
npm run build
npm start
```

Open http://localhost:3000 for the interactive introduction; enter the actual controller at http://localhost:3000/play and enter the host secret. Keep the server bound to 127.0.0.1 for a local show. The overlay is http://localhost:3000/overlay and has read-only controls. SQLite state lives in DATA_DIR (default ./data). Do not put this folder into source control or a publicly served directory.

For development, run `npm run dev` and `npm run dev:ui` in separate terminals; set PUBLIC_ORIGIN=http://localhost:5173 and the Twitch redirect URI to that same origin if testing through Vite. Register the exact callback URI you use. Production mode serves the built frontend and API from one origin and is the recommended demo path.

## Twitch setup for a new streamer

1. Create your Twitch account at https://www.twitch.tv/signup and complete account verification yourself. Enable two-factor authentication as required by Twitch's developer application registration.
2. Open https://dev.twitch.tv/console/apps . Register a new application with a unique name, category appropriate to a game integration, and OAuth redirect URL `http://localhost:3000/auth/twitch/callback`. If Twitch's current console imposes different loopback requirements, follow its current policy and use the same exact URL in configuration. Choose a confidential server application if offered.
3. Copy the client ID and generate a client secret. Store them only as TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in `.env`. Set TWITCH_REDIRECT_URI to the registered callback. Restart the server.
4. Sign into the WORLD//PATCH host controller, connect Twitch, inspect the consent prompt and authorize `user:read:chat`. The server reads your own channel using your same account; a second bot account is unnecessary.
5. Start a fresh Twitch session in Vector Foundry. Open your channel's chat in Twitch and start a proposal window. Send `!patch gravity down` to observe the deliberately rejected lockout. Wait at least two seconds, then send `!patch walls A closed` to create an accepted candidate. Close proposals, wait at least two seconds after your last command, and vote using the candidate's visible number (for example `!vote 1`). Close the vote and confirm the wall law changes, the real event indicator advances, and the receipt origin is Twitch. Do not use the simulation box for this step.

Registration, consent, own-channel chat delivery and console details must be checked live for each installation. This project's one-account flow was exercised on 30 October 2026; evidence/twitch-live-validation.json records the real round. Tokens are memory-only: after a server restart, unlock the controller and connect Twitch again. That reauthorization does not itself verify provider reconnect behavior.

## If setup fails

- Missing configuration: the UI lists required variable names, never their values.
- OAuth state rejected: return to the controller and start a new sign-in; do not reuse an old callback URL.
- Callback mismatch: use exactly the registered scheme, host, port and path.
- Reauthorization required: reconnect Twitch; tokens are memory-only and server restarts require a fresh sign-in.
- Disconnected during voting: that election is canceled because missed chat cannot be recovered; reconnect and open a new round.
- Simulation only: this is useful local testing, but is not evidence of a live Twitch integration.

Sources: https://dev.twitch.tv/docs/authentication/register-app/ ; https://dev.twitch.tv/docs/chat/authenticating/ ; https://dev.twitch.tv/docs/eventsub/handling-websocket-events/ .
