# WORLD//PATCH engineering contract

The user owns product scope and publishing decisions. This project was created during the hackathon from an empty folder on 28 October 2026. Preserve main Codex session `01a1807d-e70b-7572-bc0d-a4f29b37d1b8`. Read PRD.md, ARCHITECTURE.md, DESIGN.md and PLAN.md before changing contracts. Continue phases in order and update CHECKLIST.md with executed evidence.

## Repository conventions

- TypeScript strict, ESM; shared pure engine in src/shared, server in src/server, UI in src/client, tests in tests. Work artifacts outside source or under ignored work. Deliverable evidence under evidence with no secrets.
- Use React, Phaser, Fastify, WebSockets and SQLite. Pin versions/lockfile. Add dependencies only with a concrete reason. No network calls from the game engine, no eval/generated code, no runtime LLM.
- Export runtime schemas at trust boundaries and discriminated unions internally. Pure transition is shared by player, solver and replay without duplicate physics. No Date.now/random/DOM inside the engine. Server clocks and transports are injectable for tests.
- Keep provider secrets server-side; never print or export raw tokens/cookies/auth URLs. Keep .env, SQLite data, playwright profiles and recordings ignored. Inspect relevant changes and ignore rules before any authorized commit/publication.
- No commits/pushes/deployment/publication/payment/messaging absent applicable user authorization. Do not change this boundary because a guide suggests deploying. Local reversible build/tests are authorized.
- Author all assets locally as simple geometry/CSS; track third-party licenses. Preserve existing work and other agents' changes. Workers own assigned files; coordinate interfaces before edits.

## Verification rules

- Every accepted patch has a replayed witness bound to a frozen state and engine version. Timeouts/caps mean incomplete, never unsolvable proof. Every merge is persisted before broadcast.
- Test all patch families, movement edge cases, no-op/invalid/unsolvable/incomplete rejection, seed-repeatable properties, ballot dedupe/ties, auth/CSRF, provider failures, persistent replay/recovery, UI keyboard/mobile/reduced motion.
- Run real browser journeys. Do not assert live Twitch because fixtures passed. Use simulation/twitch provenance in every session and receipt; do not mix sources.
- Independent architecture, game-design/novelty, security and QA reviews are authorized; reviewers challenge weakest assumptions and write actionable findings. Integrate findings and rerun changed paths.
- Use evidence statuses PASS, FAIL, BLOCKED, UNVERIFIED, N/A (with reason). A document or code file existing is implementation evidence only; behavior needs executed tests or actual manual use.

## Definition of done

Task has a stated user outcome, scoped implementation, meaningful executed tests, rendered inspection where applicable, updated docs/checklist, inspected changes and an honest handoff. Report implemented vs verified vs deployed separately. Phase reports list implementation, verification/evidence, failures/risks and next priority. Submission readiness requires every mandatory live and delivery requirement, not a passing build or polished screenshot.

## Product craft

- Generated narration, voiceovers and text-to-speech for demos or deliverables must use Deepgram exclusively. If credentials, access or credits are missing, report the specific blocker and obtain explicit approval before using an alternative. Keep keys outside repositories/logs; do not enable billing or purchase credits without authorization. No generated narration is required by the game runtime.
Follow project tokens and semantic controls. Use motion-design context adaptation; transitions explain rule changes and do not obscure input. Respect reduced motion, keyboard, contrast and touch size. Keep simulation and connection state obvious. No fabricated users, votes, measurements, novelty, performance claims or screenshots presented as live provider evidence.
