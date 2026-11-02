import { randomUUID } from 'node:crypto';
import { CHAMBERS } from '../shared/chambers.js';
import { parseCommand, patchKey, patchLabel } from '../shared/commands.js';
import { ENGINE_VERSION, DIRECTIONS, GameError, applyPatch, assertState, canonicalState, cloneState, initialState, solve, transition, type Chamber, type GameState, type Patch, type SolveResult } from '../shared/engine.js';
import type { ActionResult, Candidate, ChatInput, FullReceipt, HistoryItem, HostAction, ModerationState, Origin, Phase, PublicState, Receipt, Rejection, ReplayExport, ReplayKind, VoteTally } from '../shared/protocol.js';
import { MAX_PROVIDER_ID_LENGTH } from '../shared/protocol.js';
import { gameDigest, receiptDigest, verifyReceipt, verifyReplay } from './replay.js';
import { SQLiteStore, STORAGE_LIMITS, type RoomStore } from './storage.js';

export const ROOM_LIMITS = { proposalMs: 25_000, voteMs: 20_000, cooldownMs: 2_000, solverMs: 250, candidates: 8, actors: 1000, dedupe: 10_000, history: 40, commandEvents: 19_000, eventReserve: 3 } as const;
export class RoomError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode = 409) { super(message); this.name = 'RoomError'; }
}
interface PrivateCandidate extends Omit<Candidate, 'votes'> { authors: string[] }
interface RoomData {
  schemaVersion: 1;
  engineVersion: string;
  sessionId: string;
  origin: Origin;
  revision: number;
  gameRevision: number;
  chamber: Chamber;
  game: GameState;
  checkpoint: GameState;
  phase: Phase;
  round: number;
  deadline: number | null;
  windowOpenedAt: number | null;
  pausedPhase: 'proposing' | 'voting' | null;
  remainingMs: number | null;
  candidates: PrivateCandidate[];
  nextCandidateId: number;
  ballots: { actorId: string; candidateId: number }[];
  proposed: string[];
  cooldowns: { actorId: string; at: number }[];
  blocked: string[];
  eventIds: string[];
  messageIds: string[];
  frozen: { game: GameState; gameRevision: number } | null;
  receipt: FullReceipt;
  history: HistoryItem[];
  lastRejection: Rejection | null;
  lastMove: PublicState['lastMove'] | null;
}
const result = (ok: boolean, code: string, message: string): ActionResult => ({ ok, code, message });
const copy = <T>(value: T): T => structuredClone(value);
const election = (phase: Phase): boolean => phase === 'proposing' || phase === 'voting' || phase === 'paused';
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value);
// Provider IDs are opaque strings, not our actor/session identifier format.
// Preserve exact identity for deduplication and bound them like the adapter schema.
const validEventId = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= MAX_PROVIDER_ID_LENGTH;
function getChamber(id?: string): Chamber {
  const chamber = id === undefined ? CHAMBERS[0] : CHAMBERS.find(candidate => candidate.id === id);
  if (!chamber) throw new RoomError('UNKNOWN_CHAMBER', 'Choose an available chamber.', 400);
  return copy(chamber);
}

/** Server-authoritative single room; no state becomes visible before persistence succeeds. */
export class Room {
  private data: RoomData;
  private readonly store: RoomStore;
  private readonly now: () => number;
  private readonly solverNow: () => number;
  private readonly listeners = new Set<(state: PublicState) => void>();
  /** A provider gap must remain effective even when its durable cancellation initially fails. */
  private pendingSourceCancellation = false;
  constructor(options: { store?: RoomStore; origin?: Origin; chamberId?: string; now?: () => number; solverNow?: () => number } = {}) {
    this.store = options.store ?? new SQLiteStore(':memory:');
    this.now = options.now ?? Date.now;
    this.solverNow = options.solverNow ?? (() => performance.now());
    const saved = this.store.loadActive();
    if (saved !== null) {
      const data = saved as RoomData;
      if (data.schemaVersion !== 1 || data.engineVersion !== ENGINE_VERSION || !validId(data.sessionId) || !['simulation', 'twitch'].includes(data.origin) || !['play', 'proposing', 'voting', 'paused', 'revealed'].includes(data.phase)) throw new Error('Unsupported or corrupt room checkpoint.');
      assertState(data.chamber, data.game);
      assertState(data.chamber, data.checkpoint);
      verifyReceipt(data.chamber, data.receipt);
      const verification = verifyReplay({ schemaVersion: 1, engineVersion: ENGINE_VERSION, sessionId: data.sessionId, origin: data.origin, events: this.store.readEvents(data.sessionId) });
      if (canonicalState(verification.finalGame) !== canonicalState(data.game) || canonicalState(verification.checkpoint) !== canonicalState(data.checkpoint)) throw new Error('Checkpoint differs from replayed event log.');
      this.data = copy(data);
      if (election(data.phase)) {
        const next = copy(this.data);
        this.cancelElection(next);
        this.commit(next, 'recovered', {}, 'Interrupted election cancelled after restart.');
      }
    } else {
      this.data = this.fresh(options.origin ?? 'simulation', getChamber(options.chamberId));
      this.commit(this.data, 'session-start', { chamber: this.data.chamber, origin: this.data.origin, receipt: this.data.receipt }, 'Chamber ready. Find the key, then the exit.');
    }
  }
  private fresh(origin: Origin, chamber: Chamber): RoomData {
    if (origin !== 'simulation' && origin !== 'twitch') throw new RoomError('INVALID_ORIGIN', 'Unknown session source.', 400);
    const game = initialState(chamber);
    const solved = solve(chamber, game, { now: this.solverNow, maxMs: ROOM_LIMITS.solverMs });
    if (solved.status !== 'solved') throw new RoomError('BASELINE_UNVERIFIED', 'The chamber baseline could not be verified.');
    const sessionId = randomUUID();
    const receipt = this.createReceipt({ sessionId, origin, chamber, round: 0, gameRevision: 0 }, game, game, null, solved);
    return {
      schemaVersion: 1, engineVersion: ENGINE_VERSION, sessionId, origin, revision: 0, gameRevision: 0, chamber,
      game, checkpoint: cloneState(game), phase: 'play', round: 0, deadline: null, windowOpenedAt: null, pausedPhase: null, remainingMs: null,
      candidates: [], nextCandidateId: 1, ballots: [], proposed: [], cooldowns: [], blocked: [], eventIds: [], messageIds: [], frozen: null,
      receipt, history: [], lastRejection: null, lastMove: null,
    };
  }
  private createReceipt(data: Pick<RoomData, 'sessionId' | 'origin' | 'chamber' | 'round' | 'gameRevision'>, before: GameState, start: GameState, patch: Patch | null, solved: SolveResult, tally: VoteTally[] = []): FullReceipt {
    const body = {
      id: randomUUID(), sessionId: data.sessionId, engineVersion: ENGINE_VERSION, chamberVersion: data.chamber.version,
      round: data.round, revision: data.gameRevision, origin: data.origin, patch: copy(patch),
      beforeDigest: gameDigest(data.chamber, before), afterDigest: gameDigest(data.chamber, start),
      explored: solved.explored, pathLength: solved.witness.length, witness: [...solved.witness], before: cloneState(before), start: cloneState(start),
      tally: copy(tally), tieBreak: 'votes-descending-then-canonical-key-code-point-ascending' as const,
    };
    const receipt = { ...body, digest: receiptDigest(body) };
    verifyReceipt(data.chamber, receipt);
    return receipt;
  }
  private commit(next: RoomData, kind: ReplayKind, payload: Record<string, unknown>, message: string, at = this.now()): void {
    // An admitted election may still need voting-open, merge/cancel/recovery, then Reveal.
    // Ordinary host actions must preserve these slots just as chat admission does.
    const usesReserve = ['voting-open', 'merge', 'cancel', 'recovered', 'reveal'].includes(kind);
    if (!usesReserve && next.revision >= STORAGE_LIMITS.eventsPerSession - ROOM_LIMITS.eventReserve) {
      throw new RoomError('CAPACITY', 'Session action capacity reached. Cancel any open election, Reveal and export this attempt, then start a new session.');
    }
    if (kind !== 'move') next.lastMove = null;
    next.revision++;
    next.history = [...next.history, { at, kind, message }].slice(-ROOM_LIMITS.history);
    try {
      this.store.append(next.sessionId, next, { at, kind, payload, gameDigest: gameDigest(next.chamber, next.game) });
    } catch {
      throw new RoomError('STORAGE_UNAVAILABLE', 'The action was not saved. Check storage capacity or availability before continuing.', 503);
    }
    this.data = next;
    for (const listener of this.listeners) {
      // Subscribers cannot undo a durable action or prevent other subscribers receiving it.
      try { listener(this.snapshot()); } catch { /* Transport handles its own connection failures. */ }
    }
  }
  snapshot(): PublicState {
    const d = this.data;
    const { before: _before, witness, start, ...summary } = d.receipt;
    const receipt: Receipt = d.phase === 'revealed' ? { ...summary, witness, start } : summary;
    return copy({
      schemaVersion: 1, engineVersion: ENGINE_VERSION, sessionId: d.sessionId, origin: d.origin, revision: d.revision, gameRevision: d.gameRevision,
      chamber: d.chamber, game: d.game, checkpoint: d.checkpoint, phase: d.phase, round: d.round, deadline: d.deadline, remainingMs: d.remainingMs,
      candidates: d.candidates.map(({ authors: _authors, ...candidate }) => ({ ...candidate, votes: d.ballots.filter(ballot => ballot.candidateId === candidate.id).length })),
      receipt, history: d.history, lastRejection: d.lastRejection,
      ...(d.lastMove ? { lastMove: d.lastMove } : {}),
    });
  }
  moderationState(): ModerationState {
    const actors = new Set([...this.data.blocked, ...this.data.proposed, ...this.data.ballots.map(ballot => ballot.actorId)]);
    return { actors: [...actors].sort().map(actorId => ({ actorId, blocked: this.data.blocked.includes(actorId) })) };
  }
  subscribe(listener: (state: PublicState) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private requirePhase(...phases: Phase[]): void {
    if (!phases.includes(this.data.phase)) throw new RoomError('PHASE_GUARD', `This action is unavailable during ${this.data.phase}.`);
  }
  private cancelElection(next: RoomData): void {
    next.phase = 'play'; next.deadline = null; next.windowOpenedAt = null; next.remainingMs = null; next.pausedPhase = null; next.frozen = null;
    next.candidates = []; next.ballots = []; next.proposed = []; next.cooldowns = [];
  }
  tick(at = this.now()): void {
    if (!Number.isFinite(at)) throw new RoomError('INVALID_TIME', 'Invalid server time.', 400);
    this.flushSourceCancellation(at);
    // At most two transitions: proposals -> vote -> play. Expired time never grants a fresh window.
    for (let step = 0; step < 2; step++) {
      if ((this.data.phase !== 'proposing' && this.data.phase !== 'voting') || this.data.deadline === null || at < this.data.deadline) return;
      this.closeWindow(this.data.deadline, at);
    }
  }
  private closeWindow(windowEnd: number, at: number): void {
    const next = copy(this.data);
    if (next.phase === 'proposing' && next.candidates.length > 0) {
      next.phase = 'voting'; next.deadline = windowEnd + ROOM_LIMITS.voteMs; next.windowOpenedAt = windowEnd;
      this.commit(next, 'voting-open', { deadline: next.deadline }, 'Vote now. One ballot per viewer.', at);
      return;
    }
    if (next.phase === 'proposing' || next.ballots.length === 0 || next.candidates.length === 0) {
      this.cancelElection(next);
      this.commit(next, 'cancel', { reason: 'empty-audience' }, 'No audience decision. The world stays unchanged.', at);
      return;
    }
    const ranked = next.candidates.map(candidate => ({ candidate, votes: next.ballots.filter(ballot => ballot.candidateId === candidate.id).length }))
      .sort((a, b) => b.votes - a.votes || (a.candidate.key < b.candidate.key ? -1 : a.candidate.key > b.candidate.key ? 1 : 0));
    const winner = ranked[0]!;
    if (!next.frozen || next.frozen.gameRevision !== next.gameRevision || canonicalState(next.frozen.game) !== canonicalState(next.game)) {
      this.cancelElection(next);
      next.lastRejection = { code: 'STALE_SNAPSHOT', message: 'The world changed; the patch was not merged.', at };
      this.commit(next, 'cancel', { reason: 'stale-snapshot' }, next.lastRejection.message, at);
      return;
    }
    try {
      const before = cloneState(next.game);
      const start = applyPatch(next.chamber, before, winner.candidate.patch);
      const solved = solve(next.chamber, start, { now: this.solverNow, maxMs: ROOM_LIMITS.solverMs });
      if (solved.status !== 'solved') {
        this.cancelElection(next);
        next.lastRejection = { code: solved.status === 'incomplete' ? 'VERIFICATION_INCOMPLETE' : 'NO_ESCAPE', message: solved.status === 'incomplete' ? 'Verification incomplete. No patch merged.' : 'No escape under these rules. No patch merged.', at };
        this.commit(next, 'cancel', { reason: next.lastRejection.code }, next.lastRejection.message, at);
        return;
      }
      next.gameRevision++;
      next.game = start; next.checkpoint = cloneState(start);
      const tally = ranked.map(({ candidate, votes }) => ({ candidateId: candidate.id, key: candidate.key, votes }));
      next.receipt = this.createReceipt(next, before, start, winner.candidate.patch, solved, tally);
      this.cancelElection(next);
      next.lastRejection = null;
      this.commit(next, 'merge', { receipt: next.receipt, tally, tieBreak: 'votes-descending-then-canonical-key-code-point-ascending' }, `${winner.candidate.label} merged. Escape witness verified.`, at);
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      this.cancelElection(next);
      next.lastRejection = { code: error.code, message: error.message, at };
      this.commit(next, 'cancel', { reason: error.code }, 'The winning patch could not be merged.', at);
    }
  }
  act(action: HostAction, at = this.now()): ActionResult {
    this.tick(at);
    const next = copy(this.data);
    switch (action.type) {
      case 'move': {
        this.requirePhase('play');
        if (!DIRECTIONS.includes(action.direction)) throw new RoomError('INVALID_MOVE', 'Unknown movement direction.', 400);
        const game = transition(next.chamber, next.game, action.direction);
        if (canonicalState(game) === canonicalState(next.game)) return result(true, 'NO_CHANGE', 'Movement is blocked.');
        next.lastMove = { gameRevision: next.gameRevision + 1, from: cloneState(next.game), direction: action.direction };
        next.game = game; next.gameRevision++;
        this.commit(next, 'move', { direction: action.direction }, game.escaped ? 'Escaped. Reveal the witness to inspect the route.' : 'Player moved.', at);
        break;
      }
      case 'startRound':
        this.requirePhase('play');
        if (next.game.escaped) throw new RoomError('ESCAPED', 'Reveal the solution or choose a new chamber.');
        next.round++; next.phase = 'proposing'; next.deadline = at + ROOM_LIMITS.proposalMs; next.windowOpenedAt = at;
        next.frozen = { game: cloneState(next.game), gameRevision: next.gameRevision };
        next.candidates = []; next.nextCandidateId = 1; next.ballots = []; next.proposed = []; next.cooldowns = []; next.lastRejection = null;
        this.commit(next, 'round-open', { round: next.round, gameRevision: next.gameRevision, deadline: next.deadline }, 'World frozen. Propose a law.', at);
        break;
      case 'closeWindow': this.requirePhase('proposing', 'voting'); this.closeWindow(at, at); break;
      case 'pause':
        this.requirePhase('proposing', 'voting');
        next.pausedPhase = next.phase as 'proposing' | 'voting'; next.remainingMs = Math.max(0, next.deadline! - at); next.deadline = null; next.phase = 'paused';
        this.commit(next, 'pause', { remainingMs: next.remainingMs }, 'Election paused. The world remains frozen.', at);
        break;
      case 'resume':
        this.requirePhase('paused');
        next.phase = next.pausedPhase!; next.deadline = at + next.remainingMs!; next.windowOpenedAt = at; next.remainingMs = null; next.pausedPhase = null;
        this.commit(next, 'resume', { deadline: next.deadline }, 'Election resumed.', at);
        break;
      case 'cancel': this.requirePhase('proposing', 'voting', 'paused'); this.cancelElection(next); this.commit(next, 'cancel', { reason: 'host' }, 'Host cancelled the election.', at); break;
      case 'removeCandidate':
        this.requirePhase('proposing', 'voting', 'paused');
        if (!next.candidates.some(candidate => candidate.id === action.candidateId)) throw new RoomError('UNKNOWN_CANDIDATE', 'That candidate is unavailable.', 400);
        next.candidates = next.candidates.filter(candidate => candidate.id !== action.candidateId);
        next.ballots = next.ballots.filter(ballot => ballot.candidateId !== action.candidateId);
        this.commit(next, 'moderation', { action: 'remove-candidate', candidateId: action.candidateId }, 'Host removed a candidate and its ballots.', at);
        break;
      case 'blockActor': {
        if (!validId(action.actorId)) throw new RoomError('INVALID_ACTOR', 'Invalid participant identifier.', 400);
        if (next.blocked.includes(action.actorId)) return result(true, 'NO_CHANGE', 'Participant already blocked.');
        if (next.blocked.length >= ROOM_LIMITS.actors) throw new RoomError('CAPACITY', 'The participant block limit has been reached. Start a new session.');
        next.blocked.push(action.actorId);
        // A shared canonical candidate is removed when any contributing author is blocked.
        const removed = next.candidates.filter(candidate => candidate.authors.includes(action.actorId)).map(candidate => candidate.id);
        next.candidates = next.candidates.filter(candidate => !removed.includes(candidate.id));
        next.ballots = next.ballots.filter(ballot => ballot.actorId !== action.actorId && !removed.includes(ballot.candidateId));
        this.commit(next, 'moderation', { action: 'block-participant', removedCandidateIds: removed }, 'Host blocked a participant and removed associated input.', at);
        break;
      }
      case 'reset':
        this.requirePhase('play'); next.game = cloneState(next.checkpoint); next.gameRevision++;
        this.commit(next, 'reset', {}, 'Returned to the verified checkpoint.', at); break;
      case 'reveal':
        this.requirePhase('play'); next.phase = 'revealed';
        this.commit(next, 'reveal', { receipt: next.receipt }, 'Attempt ended. Replay the verified escape witness.', at); break;
      case 'selectChamber':
      case 'newSession': {
        this.requirePhase('play', 'revealed');
        const fresh = this.fresh(action.type === 'newSession' ? action.origin : next.origin, getChamber(action.chamberId ?? next.chamber.id));
        this.commit(fresh, 'session-start', { chamber: fresh.chamber, origin: fresh.origin, receipt: fresh.receipt }, 'New session. Previous evidence remains archived.', at); break;
      }
      default: throw new RoomError('INVALID_ACTION', 'Unknown host action.', 400);
    }
    return result(true, 'ACCEPTED', 'Action applied.');
  }
  ingest(input: ChatInput): ActionResult {
    this.tick();
    const at = this.now();
    if (!input || input.origin !== this.data.origin) return result(false, 'SOURCE_MISMATCH', 'Input source does not match this session.');
    if (!validId(input.actorId) || !validEventId(input.eventId) || !validEventId(input.messageId) || typeof input.text !== 'string' || input.text.length > 200 || !Number.isFinite(input.receivedAt)) return result(false, 'INVALID_INPUT', 'Malformed chat input.');
    const command = parseCommand(input.text);
    if (!command) return result(false, 'IGNORED', 'Use a documented patch or vote command.');
    if (!election(this.data.phase)) return result(false, 'WINDOW_CLOSED', 'No election is open.');
    const sentAt = input.sentAt ?? (input.origin === 'simulation' ? at : Number.NaN);
    if (!Number.isFinite(sentAt) || this.data.windowOpenedAt === null || sentAt < this.data.windowOpenedAt || sentAt > at + 60_000) return result(false, 'STALE_EVENT', 'The message was not sent in the current election window.');
    if (this.data.eventIds.includes(input.eventId) || this.data.messageIds.includes(input.messageId)) return result(false, 'DUPLICATE', 'Message already processed.');
    if (this.data.blocked.includes(input.actorId)) return result(false, 'BLOCKED_ACTOR', 'Participant is blocked for this session.');
    if (this.data.phase === 'paused') return result(false, 'PAUSED', 'The election is paused.');
    const previousCommand = this.data.cooldowns.find(item => item.actorId === input.actorId);
    if (previousCommand && at - previousCommand.at < ROOM_LIMITS.cooldownMs) return result(false, 'COOLDOWN', 'Wait two seconds between commands.');
    if (this.data.eventIds.length >= ROOM_LIMITS.dedupe || this.data.revision >= ROOM_LIMITS.commandEvents) return result(false, 'CAPACITY', 'Chat capacity reached. End this attempt and start a new session.');
    if (!this.data.cooldowns.some(item => item.actorId === input.actorId) && this.data.cooldowns.length >= ROOM_LIMITS.actors) return result(false, 'CAPACITY', 'Participant capacity reached for this round.');
    const next = copy(this.data);
    next.eventIds.push(input.eventId); next.messageIds.push(input.messageId);
    const provenance = { origin: input.origin, eventId: input.eventId, messageId: input.messageId, receivedAt: input.receivedAt, sentAt };
    const reject = (code: string, message: string): ActionResult => {
      next.lastRejection = { code, message, at };
      this.commit(next, 'rejection', { code, ...provenance }, message, at);
      return result(false, code, message);
    };
    const cooldown = next.cooldowns.find(item => item.actorId === input.actorId);
    if (cooldown) cooldown.at = at; else next.cooldowns.push({ actorId: input.actorId, at });
    if (command.type === 'patch') {
      if (next.phase !== 'proposing') return reject('WINDOW_CLOSED', 'Proposals have closed.');
      if (next.proposed.includes(input.actorId)) return reject('PROPOSAL_QUOTA', 'One accepted proposal per participant per round.');
      const key = patchKey(command.patch);
      const existing = next.candidates.find(candidate => candidate.key === key);
      if (existing) {
        existing.authors.push(input.actorId); next.proposed.push(input.actorId); next.lastRejection = null;
        this.commit(next, 'proposal', { candidateId: existing.id, key, duplicateCanonical: true, ...provenance }, `${patchLabel(command.patch)} already has a candidate.`, at);
        return result(true, 'EXISTING_CANDIDATE', `Use !vote ${existing.id} during voting.`);
      }
      if (next.nextCandidateId > ROOM_LIMITS.candidates) return reject('CANDIDATE_CAP', 'Eight candidate slots are available per round.');
      try {
        const patched = applyPatch(next.chamber, next.game, command.patch);
        const solved = solve(next.chamber, patched, { now: this.solverNow, maxMs: ROOM_LIMITS.solverMs });
        if (solved.status !== 'solved') return reject(solved.status === 'incomplete' ? 'VERIFICATION_INCOMPLETE' : 'NO_ESCAPE', solved.status === 'incomplete' ? 'Verification incomplete. Patch rejected.' : 'No escape under these rules. Patch rejected.');
        // Independent replay before a candidate is offered, repeated again on merge.
        this.createReceipt(next, next.game, patched, command.patch, solved);
        const candidate: PrivateCandidate = { id: next.nextCandidateId++, key, patch: command.patch, label: patchLabel(command.patch), authors: [input.actorId] };
        next.candidates.push(candidate); next.proposed.push(input.actorId); next.lastRejection = null;
        this.commit(next, 'proposal', { candidateId: candidate.id, key, patch: command.patch, explored: solved.explored, pathLength: solved.witness.length, ...provenance }, `${candidate.label} verified and added.`, at);
        return result(true, 'PROPOSAL_ACCEPTED', `Candidate ${candidate.id} verified.`);
      } catch (error) {
        if (error instanceof GameError) return reject(error.code, error.message);
        throw error;
      }
    }
    if (next.phase !== 'voting') return reject('WINDOW_CLOSED', 'Voting is not open.');
    if (!next.candidates.some(candidate => candidate.id === command.candidate)) return reject('UNKNOWN_CANDIDATE', 'That candidate is unavailable.');
    const ballot = next.ballots.find(item => item.actorId === input.actorId);
    if (ballot) ballot.candidateId = command.candidate; else next.ballots.push({ actorId: input.actorId, candidateId: command.candidate });
    next.lastRejection = null;
    this.commit(next, 'vote', { candidateId: command.candidate, totals: next.candidates.map(candidate => ({ candidateId: candidate.id, votes: next.ballots.filter(item => item.candidateId === candidate.id).length })), ...provenance }, 'Audience ballot recorded.', at);
    return result(true, 'VOTE_ACCEPTED', 'Your latest ballot is counted.');
  }
  sourceUnavailable(reason: string): void {
    if (this.data.origin !== 'twitch' || !election(this.data.phase)) return;
    this.pendingSourceCancellation = true;
    this.flushSourceCancellation(this.now());
    // The transport owns the detailed reason; do not persist provider-controlled text.
    void reason;
  }
  private flushSourceCancellation(at: number): void {
    if (!this.pendingSourceCancellation) return;
    if (this.data.origin !== 'twitch' || !election(this.data.phase)) { this.pendingSourceCancellation = false; return; }
    const next = copy(this.data);
    this.cancelElection(next);
    this.commit(next, 'cancel', { reason: 'source-unavailable' }, 'Twitch delivery interrupted. Election cancelled; world preserved.', at);
    this.pendingSourceCancellation = false;
  }
  exportReplay(sessionId = this.data.sessionId): ReplayExport {
    if (!validId(sessionId)) throw new RoomError('INVALID_SESSION', 'Invalid session identifier.', 400);
    const events = this.store.readEvents(sessionId);
    if (events.length === 0) throw new RoomError('UNKNOWN_SESSION', 'Session evidence is unavailable.', 404);
    let lastReveal = -1;
    for (let index = events.length - 1; index >= 0; index--) if (events[index]!.kind === 'reveal') { lastReveal = index; break; }
    if (lastReveal < 0 || events.slice(lastReveal + 1).some(event => ['move', 'merge', 'reset', 'round-open'].includes(event.kind))) throw new RoomError('REVEAL_REQUIRED', 'End the attempt with Reveal before exporting its hidden escape witnesses.');
    const origin = events[0]!.payload.origin as Origin;
    const exported: ReplayExport = { schemaVersion: 1, engineVersion: ENGINE_VERSION, sessionId, origin, events };
    verifyReplay(exported);
    return copy(exported);
  }
  close(): void { this.listeners.clear(); this.store.close(); }
}
