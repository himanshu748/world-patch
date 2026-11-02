import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ReplayEvent, ReplayEventInput } from '../shared/protocol.js';
import { digest, eventDigest } from './replay.js';

export const STORAGE_LIMITS = { sessions: 20, eventsPerSession: 20_000 } as const;
export interface RoomStore {
  loadActive(): unknown | null;
  append(sessionId: string, state: unknown, event: ReplayEventInput): ReplayEvent;
  readEvents(sessionId: string): ReplayEvent[];
  close(): void;
}
interface StateRow { state: string; state_hash: string }
interface EventRow { json: string }

/** One atomic transaction appends evidence and replaces the active checkpoint. */
export class SQLiteStore implements RoomStore {
  private readonly db: Database.Database;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 3000');
    const version = this.db.pragma('user_version', { simple: true });
    if (version !== 0 && version !== 1) { this.db.close(); throw new Error('Unsupported WORLD//PATCH database schema.'); }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, state_hash TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_session ON sessions(active) WHERE active = 1;
      CREATE TABLE IF NOT EXISTS events (session_id TEXT NOT NULL REFERENCES sessions(id), seq INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(session_id, seq));
      PRAGMA user_version = 1;
    `);
  }
  loadActive(): unknown | null {
    const row = this.db.prepare('SELECT state, state_hash FROM sessions WHERE active = 1').get() as StateRow | undefined;
    if (!row) return null;
    const state: unknown = JSON.parse(row.state);
    if (digest(state) !== row.state_hash) throw new Error('Stored checkpoint integrity check failed.');
    return state;
  }
  append(sessionId: string, state: unknown, input: ReplayEventInput): ReplayEvent {
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
      if (!existing) {
        const total = this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number };
        if (total.count >= STORAGE_LIMITS.sessions) throw new Error('Session archive capacity reached. Export and archive the database before starting another session.');
      }
      const lastRow = this.db.prepare('SELECT json FROM events WHERE session_id = ? ORDER BY seq DESC LIMIT 1').get(sessionId) as EventRow | undefined;
      const last = lastRow ? JSON.parse(lastRow.json) as ReplayEvent : null;
      if ((last?.seq ?? 0) >= STORAGE_LIMITS.eventsPerSession) throw new Error('Session event capacity reached. Reveal/export and start a new session.');
      const body = { ...input, sessionId, seq: (last?.seq ?? 0) + 1, previousHash: last?.hash ?? '0'.repeat(64) };
      const event: ReplayEvent = { ...body, hash: eventDigest(body) };
      this.db.prepare('UPDATE sessions SET active = 0 WHERE active = 1 AND id != ?').run(sessionId);
      this.db.prepare('INSERT INTO sessions(id, active, state, state_hash) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET active = 1, state = excluded.state, state_hash = excluded.state_hash').run(sessionId, JSON.stringify(state), digest(state));
      this.db.prepare('INSERT INTO events(session_id, seq, json) VALUES (?, ?, ?)').run(sessionId, event.seq, JSON.stringify(event));
      return event;
    })();
  }
  readEvents(sessionId: string): ReplayEvent[] {
    return (this.db.prepare('SELECT json FROM events WHERE session_id = ? ORDER BY seq').all(sessionId) as EventRow[]).map(row => JSON.parse(row.json) as ReplayEvent);
  }
  close(): void { this.db.close(); }
}
