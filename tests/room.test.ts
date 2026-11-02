import { afterEach, describe, expect, it } from 'vitest';
import { Room, RoomError, ROOM_LIMITS } from '../src/server/room.js';
import { SQLiteStore, type RoomStore } from '../src/server/storage.js';
import { verifyReplay } from '../src/server/replay.js';
import { replayWitness, type GameState } from '../src/shared/engine.js';
import type { ChatInput, Origin, ReplayEventInput } from '../src/shared/protocol.js';

const rooms: Room[] = [];
afterEach(() => { for (const room of rooms.splice(0)) room.close(); });
function harness(origin: Origin = 'simulation', store?: RoomStore) {
  let at = 100_000;
  let id = 0;
  const room = new Room({ origin, store, now: () => at, solverNow: () => 0 }); rooms.push(room);
  return {
    room, advance: (ms = 2000) => { at += ms; }, now: () => at,
    chat: (actorId: string, text: string, overrides: Partial<ChatInput> = {}) => {
      const unique = `event-${++id}`;
      return room.ingest({ origin, actorId, text, eventId: unique, messageId: unique, receivedAt: at, sentAt: at, ...overrides });
    },
  };
}
function mergeIce(h: ReturnType<typeof harness>) {
  h.room.act({ type: 'startRound' });
  expect(h.chat('viewer-a', '!patch ice on').ok).toBe(true);
  h.room.act({ type: 'closeWindow' }); h.advance();
  expect(h.chat('viewer-a', '!vote 1').ok).toBe(true);
  h.room.act({ type: 'closeWindow' });
}

describe('authoritative round loop', () => {
  it('freezes movement/reset/chamber changes throughout election and paused states', () => {
    const h = harness(); const before = h.room.snapshot().game;
    h.room.act({ type: 'startRound' });
    for (const action of [{ type: 'move', direction: 'right' }, { type: 'reset' }, { type: 'selectChamber', chamberId: 'crosswire' }] as const) expect(() => h.room.act(action)).toThrow(RoomError);
    h.advance(5000); h.room.act({ type: 'pause' });
    expect(h.room.snapshot().remainingMs).toBe(20_000);
    h.advance(90_000); h.room.tick();
    expect(h.room.snapshot().phase).toBe('paused');
    expect(() => h.room.act({ type: 'move', direction: 'right' })).toThrow(RoomError);
    h.room.act({ type: 'resume' });
    expect(h.room.snapshot().deadline).toBe(h.now() + 20_000);
    h.room.act({ type: 'cancel' }); expect(h.room.snapshot().game).toEqual(before);
  });
  it('uses server deadlines before admitting late commands and does not extend stalled windows', () => {
    const h = harness(); h.room.act({ type: 'startRound' });
    expect(h.chat('one', '!patch ice on').ok).toBe(true);
    h.advance(25_000);
    expect(h.chat('two', '!patch gravity right').code).toBe('WINDOW_CLOSED');
    expect(h.room.snapshot().phase).toBe('voting');
    h.advance(20_000);
    expect(h.chat('one', '!vote 1').code).toBe('WINDOW_CLOSED');
    expect(h.room.snapshot().phase).toBe('play');
    h.room.act({ type: 'startRound' }); h.chat('three', '!patch ice on');
    h.advance(100_000); h.room.tick();
    expect(h.room.snapshot().phase).toBe('play');
    expect(h.room.snapshot().game.rules.ice).toBe(false);
  });
  it('deduplicates canonical proposals, enforces quota and cooldown, and keeps stable candidate IDs', () => {
    const h = harness(); h.room.act({ type: 'startRound' });
    expect(h.chat('one', '!patch ice on').code).toBe('PROPOSAL_ACCEPTED');
    expect(h.chat('one', '!patch gravity right').code).toBe('COOLDOWN');
    h.advance(); expect(h.chat('one', '!patch gravity right').code).toBe('PROPOSAL_QUOTA');
    expect(h.chat('two', '!PATCH ICE ON').code).toBe('EXISTING_CANDIDATE');
    expect(h.room.snapshot().candidates).toHaveLength(1);
    expect(h.chat('three', '!patch gravity right').ok).toBe(true);
    h.room.act({ type: 'removeCandidate', candidateId: 1 });
    expect(h.room.snapshot().candidates.map(candidate => candidate.id)).toEqual([2]);
  });
  it('deduplicates both notification and chat message identities', () => {
    const h = harness(); h.room.act({ type: 'startRound' });
    expect(h.chat('one', '!patch ice on', { eventId: 'notice1', messageId: 'chat1' }).ok).toBe(true);
    h.advance();
    expect(h.chat('two', '!patch gravity right', { eventId: 'notice1', messageId: 'chat2' }).code).toBe('DUPLICATE');
    expect(h.chat('two', '!patch gravity right', { eventId: 'notice2', messageId: 'chat1' }).code).toBe('DUPLICATE');
    expect(h.room.snapshot().candidates).toHaveLength(1);
  });
  it('keeps one replacement ballot and selects canonical key on tied totals', () => {
    const h = harness(); h.room.act({ type: 'startRound' });
    h.chat('one', '!patch ice on'); h.chat('two', '!patch gravity right');
    h.room.act({ type: 'closeWindow' }); h.advance();
    h.chat('one', '!vote 1'); h.advance(); h.chat('one', '!vote 2');
    expect(h.room.snapshot().candidates.map(candidate => candidate.votes)).toEqual([0, 1]);
    h.chat('two', '!vote 1');
    expect(h.room.snapshot().candidates.map(candidate => candidate.votes)).toEqual([1, 1]);
    h.room.act({ type: 'closeWindow' });
    expect(h.room.snapshot().game.rules.gravity).toBe('right');
    expect(h.room.snapshot().game.rules.ice).toBe(false);
    expect(h.room.snapshot().receipt.patch).toEqual({ kind: 'gravity', value: 'right' });
    expect(h.room.snapshot().receipt.tally).toEqual([
      { candidateId: 2, key: 'gravity:right', votes: 1 },
      { candidateId: 1, key: 'ice:on', votes: 1 },
    ]);
    expect(h.room.snapshot().receipt.tieBreak).toBe('votes-descending-then-canonical-key-code-point-ascending');
    expect(h.room.snapshot().receipt.witness).toBeUndefined();
  });

  it('bounds opaque event IDs independently while retaining actor validation and exact deduplication', () => {
    const h = harness('twitch'); h.room.act({ type: 'startRound' });
    const before = h.room.snapshot();
    for (const invalid of ['', 'x'.repeat(257), null, 42]) {
      expect(h.chat('viewer', '!patch ice on', { eventId: invalid as unknown as string }).code).toBe('INVALID_INPUT');
      expect(h.chat('viewer', '!patch ice on', { messageId: invalid as unknown as string }).code).toBe('INVALID_INPUT');
    }
    expect(h.chat('actor/invalid', '!patch ice on').code).toBe('INVALID_INPUT');
    expect(h.chat('a'.repeat(129), '!patch ice on').code).toBe('INVALID_INPUT');
    expect(h.room.snapshot()).toEqual(before);
    const eventId = 'opaque/notification+with=padding';
    const messageId = 'opaque/chat+with=padding';
    expect(h.chat('viewer', '!patch ice on', { eventId, messageId }).code).toBe('PROPOSAL_ACCEPTED');
    for (const length of [129, 256]) {
      expect(h.chat(`viewer-${length}`, '!patch ice on', { eventId: 'e'.repeat(length), messageId: 'm'.repeat(length) }).ok).toBe(true);
    }
    h.advance();
    expect(h.chat('second', '!patch gravity right', { eventId, messageId: 'another/chat+id=' }).code).toBe('DUPLICATE');
    expect(h.chat('second', '!patch gravity right', { eventId: 'another/notice+id=', messageId }).code).toBe('DUPLICATE');
    expect(h.room.snapshot().candidates).toHaveLength(1);
  });
  it('leaves the game unchanged with no proposals or no ballots', () => {
    const h = harness(); const initial = h.room.snapshot().game;
    h.room.act({ type: 'startRound' }); h.room.act({ type: 'closeWindow' });
    expect(h.room.snapshot().phase).toBe('play');
    h.room.act({ type: 'startRound' }); h.chat('one', '!patch ice on');
    h.room.act({ type: 'closeWindow' }); h.room.act({ type: 'closeWindow' });
    expect(h.room.snapshot().game).toEqual(initial);
    expect(h.room.snapshot().receipt.patch).toBeNull();
  });
  it('rejects malformed, no-op and unsolvable proposals without mutating the world', () => {
    const h = harness(); h.room.act({ type: 'startRound' }); const initial = h.room.snapshot().game;
    expect(h.chat('one', '!patch gravity off').code).toBe('NO_CHANGE');
    expect(h.chat('two', '!patch gravity down').code).toBe('NO_ESCAPE');
    expect(h.chat('three', '!patch ice on; eval(1)').code).toBe('IGNORED');
    expect(h.chat('four', 'x'.repeat(201)).code).toBe('INVALID_INPUT');
    expect(h.room.snapshot().candidates).toHaveLength(0);
    expect(h.room.snapshot().game).toEqual(initial);
  });
  it('does not persist paused or cooldown spam and preserves bounded round state', () => {
    const h = harness(); h.room.act({ type: 'startRound' }); h.chat('one', '!patch ice on');
    const beforeCooldown = h.room.snapshot();
    for (let i = 0; i < 100; i++) expect(h.chat('one', '!patch gravity right').code).toBe('COOLDOWN');
    expect(h.room.snapshot()).toEqual(beforeCooldown);
    h.room.act({ type: 'pause' }); const beforePause = h.room.snapshot();
    for (let i = 0; i < 100; i++) expect(h.chat(`actor-${i}`, '!patch gravity right').code).toBe('PAUSED');
    expect(h.room.snapshot()).toEqual(beforePause);
  });
  it('revalidates a voted patch through a bounded scheduler delay and preserves its replay', () => {
    let at = 100_000; let solverTime = 0;
    // At 1 ms per visited state the 58-state route exceeds the engine's 50 ms
    // default. Both room admission and final merge must use the live-room budget.
    const room = new Room({ now: () => at, solverNow: () => ++solverTime }); rooms.push(room);
    const chat = (eventId: string, text: string) => room.ingest({ origin: 'simulation', actorId: 'viewer', eventId, messageId: eventId, text, receivedAt: at });
    room.act({ type: 'startRound' });
    expect(chat('proposal', '!patch walls A closed').code).toBe('PROPOSAL_ACCEPTED');
    room.act({ type: 'closeWindow' }); at += ROOM_LIMITS.cooldownMs;
    expect(chat('vote', '!vote 1').code).toBe('VOTE_ACCEPTED');
    room.act({ type: 'closeWindow' });
    expect(room.snapshot().gameRevision).toBe(1);
    expect(room.snapshot().game.rules.walls.A).toBe(true);
    expect(room.snapshot().receipt.pathLength).toBe(24);
    room.act({ type: 'reveal' });
    const replayed = verifyReplay(room.exportReplay());
    expect(replayed.finalGame).toEqual(room.snapshot().game);
    expect(replayed.finalGame.rules.walls.A).toBe(true);
  });
  it('labels incomplete verification distinctly and never merges a timed-out winner', () => {
    let at = 100_000; let slow = false; let solverTime = 0;
    const room = new Room({ now: () => at, solverNow: () => slow ? (solverTime += ROOM_LIMITS.solverMs + 1) : 0 }); rooms.push(room);
    room.act({ type: 'startRound' }); slow = true;
    const proposal = (id: string) => room.ingest({ origin: 'simulation', actorId: id, eventId: id, messageId: id, text: '!patch ice on', receivedAt: at });
    expect(proposal('one').code).toBe('VERIFICATION_INCOMPLETE');
    expect(room.snapshot().candidates).toHaveLength(0); slow = false;
    expect(proposal('two').ok).toBe(true); room.act({ type: 'closeWindow' }); at += 2000;
    room.ingest({ origin: 'simulation', actorId: 'two', eventId: 'vote', messageId: 'vote', text: '!vote 1', receivedAt: at });
    slow = true; room.act({ type: 'closeWindow' });
    expect(room.snapshot().lastRejection?.code).toBe('VERIFICATION_INCOMPLETE');
    expect(room.snapshot().game.rules.ice).toBe(false);
  });
  it('separates room revision from frozen game revision and rejects a stale merge', () => {
    const h = harness(); h.room.act({ type: 'startRound' }); const frozenRevision = h.room.snapshot().gameRevision;
    h.chat('one', '!patch ice on'); h.room.act({ type: 'closeWindow' }); h.advance(); h.chat('one', '!vote 1');
    expect(h.room.snapshot().gameRevision).toBe(frozenRevision);
    expect(h.room.snapshot().revision).toBeGreaterThan(frozenRevision);
    // Fault injection: exercises the final defense even if a future mutator violates freeze guards.
    (h.room as unknown as { data: { frozen: { gameRevision: number } } }).data.frozen.gameRevision++;
    h.room.act({ type: 'closeWindow' });
    expect(h.room.snapshot().lastRejection?.code).toBe('STALE_SNAPSHOT');
    expect(h.room.snapshot().game.rules.ice).toBe(false);
  });
  it('removes associated candidates and votes on block without leaking participant identities', () => {
    const h = harness(); h.room.act({ type: 'startRound' });
    h.chat('private-participant-one', '!patch ice on'); h.chat('private-participant-two', '!patch gravity right');
    h.room.act({ type: 'closeWindow' }); h.advance(); h.chat('private-participant-two', '!vote 1');
    h.room.act({ type: 'blockActor', actorId: 'private-participant-one' });
    expect(h.room.snapshot().candidates.map(candidate => [candidate.id, candidate.votes])).toEqual([[2, 0]]);
    expect(h.chat('private-participant-one', '!vote 2').code).toBe('BLOCKED_ACTOR');
    expect(JSON.stringify(h.room.snapshot())).not.toContain('private-participant');
    expect(h.room.moderationState().actors.some(actor => actor.actorId === 'private-participant-one' && actor.blocked)).toBe(true);
  });
  it('hides every path until explicit reveal and replays the stored checkpoint witness', () => {
    const h = harness(); mergeIce(h);
    const merged = h.room.snapshot();
    expect(JSON.stringify(merged)).not.toContain('"witness"');
    expect(() => h.room.exportReplay()).toThrow(/Reveal/);
    h.room.act({ type: 'move', direction: 'right' });
    const actual = h.room.snapshot().game;
    expect(h.room.snapshot().lastMove?.direction).toBe('right');
    h.room.act({ type: 'reveal' });
    const reveal = h.room.snapshot();
    expect(reveal.game).toEqual(actual);
    expect(reveal.lastMove).toBeUndefined();
    expect(replayWitness(reveal.chamber, reveal.receipt.start!, reveal.receipt.witness!).escaped).toBe(true);
    expect(verifyReplay(h.room.exportReplay()).finalGame).toEqual(actual);
    expect(JSON.stringify(h.room.exportReplay())).not.toContain('viewer-a');
  });
  it('resets the entire merged checkpoint and can reveal the baseline without a patch', () => {
    const h = harness(); h.room.act({ type: 'reveal' });
    expect(h.room.snapshot().receipt.witness!.length).toBeGreaterThan(0);
    const archived = h.room.snapshot().sessionId;
    h.room.act({ type: 'newSession', origin: 'simulation' });
    mergeIce(h); const checkpoint = h.room.snapshot().game;
    h.room.act({ type: 'move', direction: 'right' }); h.room.act({ type: 'reset' });
    expect(h.room.snapshot().game).toEqual(checkpoint);
    expect(h.room.exportReplay(archived).sessionId).toBe(archived);
  });
  it('isolates real/simulated sources and cancels a Twitch election on delivery loss', () => {
    const h = harness('twitch'); h.room.act({ type: 'startRound' });
    expect(h.chat('one', '!patch ice on', { origin: 'simulation' }).code).toBe('SOURCE_MISMATCH');
    h.chat('one', '!patch ice on'); h.room.act({ type: 'closeWindow' });
    const game = h.room.snapshot().game; h.room.sourceUnavailable('private token-like provider detail');
    expect(h.room.snapshot().phase).toBe('play'); expect(h.room.snapshot().game).toEqual(game);
    expect(JSON.stringify(h.room.snapshot())).not.toContain('private token');
  });
  it('rejects missing, future and delayed live timestamps without admitting old votes into a new window', () => {
    const h = harness('twitch'); h.room.act({ type: 'startRound' });
    const oldSentAt = h.now(); h.chat('one', '!patch ice on');
    h.advance(); h.room.act({ type: 'closeWindow' });
    const before = h.room.snapshot();
    expect(h.chat('one', '!vote 1', { sentAt: oldSentAt }).code).toBe('STALE_EVENT');
    expect(h.chat('one', '!vote 1', { sentAt: undefined }).code).toBe('STALE_EVENT');
    expect(h.chat('one', '!vote 1', { sentAt: h.now() + 60_001 }).code).toBe('STALE_EVENT');
    expect(h.room.snapshot()).toEqual(before);
    h.room.act({ type: 'pause' }); h.advance(); h.room.act({ type: 'resume' });
    expect(h.chat('one', '!vote 1', { sentAt: oldSentAt + 2000 }).code).toBe('STALE_EVENT');
    expect(h.chat('one', '!vote 1').code).toBe('VOTE_ACCEPTED');
    h.room.act({ type: 'closeWindow' }); h.room.act({ type: 'reveal' });
    const event = h.room.exportReplay().events.find(entry => entry.kind === 'vote')!;
    expect(event.payload).toMatchObject({ origin: 'twitch', receivedAt: h.now(), sentAt: h.now() });
    expect(event.payload.eventId).toBeDefined(); expect(event.payload.messageId).toBeDefined();
    expect(JSON.stringify(event)).not.toContain('actorId');
  });
  it('returns detached snapshots and bounds visible history', () => {
    const h = harness(); const view = h.room.snapshot(); view.game.x = 500;
    expect(h.room.snapshot().game.x).not.toBe(500);
    for (let i = 0; i < ROOM_LIMITS.history + 2; i++) h.room.act({ type: 'reset' });
    expect(h.room.snapshot().history).toHaveLength(ROOM_LIMITS.history);
  });
});

describe('transaction visibility', () => {
  it('latches a Twitch gap through storage failure so an overdue winner cannot merge after recovery', () => {
    const durable = new SQLiteStore(':memory:'); let fail = false;
    const store: RoomStore = {
      loadActive: () => durable.loadActive(), readEvents: id => durable.readEvents(id), close: () => durable.close(),
      append: (id, state, event) => { if (fail) throw new Error('injected disk failure'); return durable.append(id, state, event); },
    };
    const h = harness('twitch', store); h.room.act({ type: 'startRound' }); h.chat('one', '!patch ice on');
    h.room.act({ type: 'closeWindow' }); h.advance(); h.chat('one', '!vote 1');
    fail = true; expect(() => h.room.sourceUnavailable('network-gap')).toThrow(/not saved/);
    h.advance(30_000); expect(() => h.room.tick()).toThrow(/not saved/);
    expect(h.room.snapshot().game.rules.ice).toBe(false);
    fail = false; h.room.tick();
    expect(h.room.snapshot().phase).toBe('play'); expect(h.room.snapshot().game.rules.ice).toBe(false);
    const events = durable.readEvents(h.room.snapshot().sessionId);
    expect(events.at(-1)?.payload.reason).toBe('source-unavailable');
    expect(events.some(event => event.kind === 'merge')).toBe(false);
  });
  it('rolls back in-memory state and emits nothing when persistence fails', () => {
    const durable = new SQLiteStore(':memory:'); let fail = false;
    const store: RoomStore = {
      loadActive: () => durable.loadActive(), readEvents: id => durable.readEvents(id), close: () => durable.close(),
      append: (id: string, state: unknown, event: ReplayEventInput) => { if (fail) throw new Error('injected disk failure'); return durable.append(id, state, event); },
    };
    const h = harness('simulation', store); let emitted = 0;
    h.room.subscribe(() => { emitted++; });
    const before = h.room.snapshot(); fail = true;
    expect(() => h.room.act({ type: 'move', direction: 'right' })).toThrow(/not saved/);
    expect(h.room.snapshot()).toEqual(before); expect(emitted).toBe(0);
    fail = false; h.room.act({ type: 'move', direction: 'right' }); expect(emitted).toBe(1);
    const saved = durable.loadActive() as { game: GameState };
    expect(saved.game).toEqual(h.room.snapshot().game);
  });
  it('does not let a failed subscriber prevent committed state or other listeners', () => {
    const h = harness(); let emitted = 0;
    h.room.subscribe(() => { throw new Error('closed socket'); });
    const unsubscribe = h.room.subscribe(() => { emitted++; });
    h.room.act({ type: 'move', direction: 'right' }); expect(emitted).toBe(1);
    unsubscribe(); h.room.act({ type: 'reset' }); expect(emitted).toBe(1);
  });
});
