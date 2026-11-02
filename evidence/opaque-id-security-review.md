# Opaque provider ID security review — 30 October 2026

Independent read-only reviewer: /root/opaque_id_security_review. No remaining findings in the final scoped change. The reviewer inspected source/tests; the parent executed verification and the actual Twitch run separately. No secrets/private data were inspected by the reviewer.

The initial repair retained a 128-character room limit while the adapter accepted 256. The reviewer caught that mismatch; protocol.ts, twitch.ts and room.ts now share MAX_PROVIDER_ID_LENGTH=256. Actor/session validation remains strict.

Opaque IDs retain exact identity in separate notification/chat dedupe namespaces. SQLite writes use bound parameters; JSON serialization and canonical hashing escape string values. No path, header, selector or executable interpretation was identified. Tests accept 129/256 and reject 257/empty/non-string IDs, retain strict actors, and check independent exact deduplication. The adapter-to-room regression checks rejection, acceptance, ballot, merge, witness reveal and verified replay with long punctuation IDs. Temporary diagnostic logging was removed.

Parent execution: typecheck, lint and build passed; all 112 tests and 12 browser journeys passed. The fresh actual Twitch round then passed; evidence/twitch-live-validation.json records its separate live scope.
