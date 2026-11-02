import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { Room, ROOM_LIMITS } from '../src/server/room.js';
import { SQLiteStore, STORAGE_LIMITS, type RoomStore } from '../src/server/storage.js';
import { digest, eventDigest, verifyReplay } from '../src/server/replay.js';
import type { ReplayEvent, ReplayExport } from '../src/shared/protocol.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const path = () => { const dir = mkdtempSync(join(tmpdir(), 'world-patch-test-')); dirs.push(dir); return join(dir, 'room.sqlite'); };

describe('SQLite recovery and deterministic replay', () => {
  it('recovers a nearly full voting session and retains capacity to Reveal at the hard event cap', () => {
    const file = path(); const at = 100_000;
    const durable = new SQLiteStore(file);
    type Checkpoint = { revision: number; history: { at: number; kind: string; message: string }[] };
    const retained: { checkpoint?: Checkpoint } = {};
    const storeWithCheckpoint: RoomStore = {
      loadActive: () => durable.loadActive(), readEvents: id => durable.readEvents(id), close: () => durable.close(),
      append: (id, state, event) => { const saved = durable.append(id, state, event); retained.checkpoint = state as Checkpoint; return saved; },
    };
    const first = new Room({ store: storeWithCheckpoint, now: () => at, solverNow: () => 0 });
    const ordinaryLimit = STORAGE_LIMITS.eventsPerSession - ROOM_LIMITS.eventReserve;
    let session: string;
    let saved: ReturnType<Room['snapshot']>;
    try {
      first.act({ type: 'startRound' });
      expect(first.ingest({ origin: 'simulation', actorId: 'one', text: '!patch ice on', eventId: 'proposal', messageId: 'proposal', receivedAt: at }).ok).toBe(true);
      // Seed valid retained pause/resume evidence in one transaction, avoiding 20k
      // checkpoint rewrites in the test. The real cap, hash chain and final state
      // match those host actions; admission/recovery below use the actual Room.
      const checkpoint = retained.checkpoint!;
      let previous = durable.readEvents(first.snapshot().sessionId).at(-1)!;
      const db = new Database(file);
      try {
        const insert = db.prepare('INSERT INTO events(session_id, seq, json) VALUES (?, ?, ?)');
        db.transaction(() => {
          for (let seq = previous.seq + 1; seq <= ordinaryLimit; seq++) {
            const kind = seq % 2 === 0 ? 'pause' : 'resume';
            const payload = kind === 'pause' ? { remainingMs: ROOM_LIMITS.proposalMs } : { deadline: at + ROOM_LIMITS.proposalMs };
            const body: Omit<ReplayEvent, 'hash'> = { sessionId: previous.sessionId, seq, previousHash: previous.hash, at, kind, payload, gameDigest: previous.gameDigest };
            const event = { ...body, hash: eventDigest(body) };
            insert.run(event.sessionId, seq, JSON.stringify(event)); previous = event;
            checkpoint.history = [...checkpoint.history, { at, kind, message: kind === 'pause' ? 'Election paused. The world remains frozen.' : 'Election resumed.' }].slice(-ROOM_LIMITS.history);
          }
          checkpoint.revision = ordinaryLimit;
          db.prepare('UPDATE sessions SET state = ?, state_hash = ? WHERE id = ?').run(JSON.stringify(checkpoint), digest(checkpoint), previous.sessionId);
        })();
      } finally { db.close(); }
      expect(first.snapshot().revision).toBe(ordinaryLimit);
      expect(() => first.act({ type: 'pause' })).toThrowError(expect.objectContaining({ code: 'CAPACITY' }));
      first.act({ type: 'closeWindow' });
      saved = first.snapshot(); session = saved.sessionId;
      expect(saved.phase).toBe('voting'); expect(saved.revision).toBe(ordinaryLimit + 1);
    } finally { first.close(); }
    const store = new SQLiteStore(file);
    const restored = new Room({ store, now: () => at + 100_000, solverNow: () => 0 });
    try {
      expect(restored.snapshot()).toMatchObject({ sessionId: session, phase: 'play', revision: STORAGE_LIMITS.eventsPerSession - 1, game: saved.game });
      expect(store.readEvents(session).at(-1)?.kind).toBe('recovered');
      const before = restored.snapshot(); const beforeCheckpoint = store.loadActive(); let emitted = 0;
      restored.subscribe(() => { emitted++; });
      for (const action of [{ type: 'reset' }, { type: 'move', direction: 'right' }, { type: 'startRound' }, { type: 'blockActor', actorId: 'extra' }] as const) {
        expect(() => restored.act(action)).toThrowError(expect.objectContaining({ code: 'CAPACITY', statusCode: 409 }));
      }
      expect(restored.snapshot()).toEqual(before); expect(store.loadActive()).toEqual(beforeCheckpoint); expect(emitted).toBe(0);
      expect(() => restored.exportReplay()).toThrow(/Reveal/);
      restored.act({ type: 'reveal' });
      expect(restored.snapshot()).toMatchObject({ phase: 'revealed', game: saved.game });
      const checkpoint = store.loadActive();
      const events = store.readEvents(session); const last = events.at(-1)!;
      expect(events).toHaveLength(STORAGE_LIMITS.eventsPerSession);
      expect(events.slice(-3).map(event => event.kind)).toEqual(['voting-open', 'recovered', 'reveal']);
      expect(() => store.append(session, { changed: true }, { at, kind: 'moderation', payload: {}, gameDigest: last.gameDigest })).toThrow(/event capacity/);
      const retainedEvents = store.readEvents(session);
      expect(store.loadActive()).toEqual(checkpoint); expect(retainedEvents).toHaveLength(STORAGE_LIMITS.eventsPerSession);
      expect(retainedEvents.at(-1)?.hash).toBe(last.hash);
      restored.act({ type: 'newSession', origin: 'simulation' });
      expect(restored.snapshot().sessionId).not.toBe(session);
      // Export performs full replay verification of the retained 20k-event archive.
      const exported = restored.exportReplay(session);
      expect(exported.events).toHaveLength(STORAGE_LIMITS.eventsPerSession); expect(exported.events.at(-1)?.hash).toBe(last.hash);
    } finally { restored.close(); }
  },90_000);
  it('restores committed game, preserves event dedupe and cancels the old election', () => {
    const file = path(); let at = 100_000;
    const first = new Room({ store: new SQLiteStore(file), now: () => at, solverNow: () => 0 });
    first.act({ type: 'move', direction: 'right' }); const saved = first.snapshot().game;
    first.act({ type: 'startRound' });
    first.ingest({ origin: 'simulation', actorId: 'one', text: '!patch ice on', eventId: 'notice1', messageId: 'message1', receivedAt: at });
    const session = first.snapshot().sessionId; first.close();
    at += 100_000;
    const restored = new Room({ store: new SQLiteStore(file), now: () => at, solverNow: () => 0 });
    expect(restored.snapshot().sessionId).toBe(session);
    expect(restored.snapshot().game).toEqual(saved); expect(restored.snapshot().phase).toBe('play');
    restored.act({ type: 'startRound' });
    expect(restored.ingest({ origin: 'simulation', actorId: 'one', text: '!patch ice on', eventId: 'fresh', messageId: 'message1', receivedAt: at }).code).toBe('DUPLICATE');
    restored.act({ type: 'cancel' }); restored.act({ type: 'reveal' });
    expect(verifyReplay(restored.exportReplay()).finalGame).toEqual(saved); restored.close();
  });
  it('restores and verifies an accepted patch after process restart', () => {
    const file = path(); let at = 100_000;
    const first = new Room({ store: new SQLiteStore(file), now: () => at, solverNow: () => 0 });
    first.act({ type: 'startRound' });
    first.ingest({ origin: 'simulation', actorId: 'one', text: '!patch ice on', eventId: 'p1', messageId: 'p1', receivedAt: at });
    first.act({ type: 'closeWindow' }); at += 2000;
    first.ingest({ origin: 'simulation', actorId: 'one', text: '!vote 1', eventId: 'v1', messageId: 'v1', receivedAt: at });
    first.act({ type: 'closeWindow' }); first.act({ type: 'move', direction: 'right' }); first.act({ type: 'reset' }); first.act({ type: 'reveal' });
    const exported = first.exportReplay(); first.close();
    const second = new Room({ store: new SQLiteStore(file), now: () => at, solverNow: () => 0 });
    expect(second.exportReplay()).toEqual(exported);
    const report = verifyReplay(second.exportReplay()); expect(report.mergeCount).toBe(1);
    expect(report.finalGame.rules.ice).toBe(true); expect(second.snapshot().receipt.witness).toBeDefined(); second.close();
  });
  it('rejects reordered, unsupported-version and modified exports', () => {
    const room = new Room(); room.act({ type: 'move', direction: 'right' }); room.act({ type: 'reveal' });
    const source = room.exportReplay(); room.close();
    const modified = structuredClone(source); modified.events[1]!.payload.direction = 'down';
    expect(() => verifyReplay(modified)).toThrow(/digest mismatch/);
    const reordered = structuredClone(source); [reordered.events[0], reordered.events[1]] = [reordered.events[1]!, reordered.events[0]!];
    expect(() => verifyReplay(reordered)).toThrow(/sequence mismatch/);
    expect(() => verifyReplay({ ...source, engineVersion: 'future-engine' })).toThrow(/unsupported/);
    // Even rehashing an altered action cannot make the stored outcome pass the engine.
    rehash(modified); expect(() => verifyReplay(modified)).toThrow(/game digest mismatch/);
  });
  it('rejects a tampered witness after event and receipt labels claim success', () => {
    const room = new Room(); room.act({ type: 'reveal' }); const source = room.exportReplay(); room.close();
    const modified = structuredClone(source);
    const receipt = modified.events[0]!.payload.receipt as { witness: string[]; pathLength: number };
    receipt.witness = ['up']; receipt.pathLength = 1;
    rehash(modified); expect(() => verifyReplay(modified)).toThrow(/witness does not escape/);
  });
  it('fails closed when persisted checkpoint bytes are corrupt', () => {
    const file = path(); const room = new Room({ store: new SQLiteStore(file) }); room.close();
    const db = new Database(file); db.prepare("UPDATE sessions SET state = '{\"modified\":true}' WHERE active=1").run(); db.close();
    const store = new SQLiteStore(file);
    expect(() => new Room({ store })).toThrow(/integrity/); store.close();
  });
  it('keeps previous revealed sessions exportable after a chamber change', () => {
    const room = new Room(); const priorId = room.snapshot().sessionId;
    room.act({ type: 'reveal' }); const prior = room.exportReplay();
    room.act({ type: 'selectChamber', chamberId: 'crosswire' });
    expect(room.snapshot().sessionId).not.toBe(priorId); expect(room.snapshot().chamber.id).toBe('crosswire');
    expect(room.exportReplay(priorId)).toEqual(prior); room.close();
  });
});
function rehash(exported: ReplayExport): void {
  let previousHash = '0'.repeat(64);
  for (const event of exported.events) {
    event.previousHash = previousHash;
    const { hash: _hash, ...body } = event;
    event.hash = eventDigest(body); previousHash = event.hash;
  }
}
