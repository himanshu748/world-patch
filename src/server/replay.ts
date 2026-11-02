import { createHash } from 'node:crypto';
import { defineChamber } from '../shared/chambers.js';
import { patchKey } from '../shared/commands.js';
import { ENGINE_VERSION, DIRECTIONS, applyPatch, assertState, canonicalState, cloneState, initialState, isPatch, replayWitness, transition, type Chamber, type Direction, type GameState } from '../shared/engine.js';
import type { FullReceipt, ReplayEvent, ReplayExport, ReplayVerification } from '../shared/protocol.js';

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const result = JSON.stringify(value);
    if (result === undefined) throw new Error('Unsupported value in canonical evidence.');
    return result;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(',')}}`;
}
export const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export const gameDigest = (chamber: Chamber, state: GameState): string => digest({ engineVersion: ENGINE_VERSION, chamber, state: JSON.parse(canonicalState(state)) as unknown });
export const eventDigest = (event: Omit<ReplayEvent, 'hash'>): string => digest(event);
export function receiptDigest(receipt: Omit<FullReceipt, 'digest'>): string { return digest(receipt); }

function fail(message: string): never { throw new Error(`Replay verification failed: ${message}`); }
function same(a: GameState, b: GameState): boolean { return canonicalState(a) === canonicalState(b); }
export function verifyReceipt(chamber: Chamber, receipt: FullReceipt): void {
  if (!receipt || receipt.engineVersion !== ENGINE_VERSION || receipt.chamberVersion !== chamber.version) fail('unsupported receipt version');
  assertState(chamber, receipt.before);
  assertState(chamber, receipt.start);
  if (!Array.isArray(receipt.witness) || receipt.witness.length > 1000 || receipt.witness.some(action => !DIRECTIONS.includes(action))) fail('invalid witness');
  if (receipt.pathLength !== receipt.witness.length || !Number.isInteger(receipt.explored) || receipt.explored < 0) fail('invalid search evidence');
  if (!Array.isArray(receipt.tally) || receipt.tally.length > 8 || receipt.tieBreak !== 'votes-descending-then-canonical-key-code-point-ascending' ||
    receipt.tally.some(entry => !Number.isInteger(entry.candidateId) || entry.candidateId < 1 || entry.candidateId > 8 || typeof entry.key !== 'string' || entry.key.length > 60 || !Number.isInteger(entry.votes) || entry.votes < 0 || entry.votes > 1000) ||
    new Set(receipt.tally.map(entry => entry.candidateId)).size !== receipt.tally.length) fail('invalid vote summary');
  const expected = receipt.patch === null ? receipt.before : applyPatch(chamber, receipt.before, receipt.patch);
  if (!same(expected, receipt.start) || receipt.beforeDigest !== gameDigest(chamber, receipt.before) || receipt.afterDigest !== gameDigest(chamber, receipt.start)) fail('receipt snapshot mismatch');
  if (!replayWitness(chamber, receipt.start, receipt.witness).escaped) fail('witness does not escape');
  const { digest: hash, ...body } = receipt;
  if (hash !== receiptDigest(body)) fail('receipt digest mismatch');
}

/** Recompute state from actions; stored states and success labels are never trusted. */
export function verifyReplay(input: ReplayExport): ReplayVerification {
  if (!input || input.schemaVersion !== 1 || input.engineVersion !== ENGINE_VERSION || !Array.isArray(input.events) || input.events.length === 0 || input.events.length > 20_000) fail('unsupported or empty export');
  if (input.origin !== 'simulation' && input.origin !== 'twitch') fail('invalid origin');
  let previousHash = '0'.repeat(64);
  let chamber: Chamber | undefined;
  let game: GameState | undefined;
  let checkpoint: GameState | undefined;
  let merges = 0;
  const passive = new Set(['round-open', 'voting-open', 'vote', 'proposal', 'pause', 'resume', 'cancel', 'moderation', 'rejection', 'recovered']);
  for (const [index, event] of input.events.entries()) {
    if (event.seq !== index + 1 || event.sessionId !== input.sessionId || event.previousHash !== previousHash || !Number.isFinite(event.at)) fail('sequence mismatch');
    const { hash, ...body } = event;
    if (hash !== eventDigest(body)) fail('event digest mismatch');
    previousHash = hash;
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) fail('invalid payload');
    if (index === 0) {
      if (event.kind !== 'session-start' || event.payload.origin !== input.origin) fail('missing session start');
      const recorded = event.payload.chamber as Chamber;
      if (!recorded || typeof recorded.id !== 'string' || recorded.version !== 1 || !Array.isArray(recorded.tiles)) fail('invalid chamber');
      chamber = defineChamber(recorded.id, recorded.name, recorded.description, recorded.tiles, recorded.initialRules);
      if (canonical(chamber) !== canonical(recorded)) fail('chamber metadata mismatch');
      game = initialState(chamber);
      checkpoint = cloneState(game);
      const receipt = event.payload.receipt as FullReceipt;
      verifyReceipt(chamber, receipt);
      if (receipt.sessionId !== input.sessionId || receipt.origin !== input.origin || receipt.patch !== null || !same(receipt.before, game)) fail('baseline mismatch');
    } else {
      if (!chamber || !game || !checkpoint) fail('missing baseline');
      switch (event.kind) {
        case 'move': {
          const direction = event.payload.direction as Direction;
          if (!DIRECTIONS.includes(direction)) fail('invalid move');
          game = transition(chamber, game, direction);
          break;
        }
        case 'reset': game = cloneState(checkpoint); break;
        case 'merge': {
          const receipt = event.payload.receipt as FullReceipt;
          verifyReceipt(chamber, receipt);
          if (!isPatch(receipt.patch) || receipt.sessionId !== input.sessionId || receipt.origin !== input.origin || !same(receipt.before, game)) fail('merge snapshot mismatch');
          const ranked = [...receipt.tally].sort((a, b) => b.votes - a.votes || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
          if (!ranked[0] || ranked[0].votes === 0 || ranked[0].key !== patchKey(receipt.patch) || canonical(event.payload.tally) !== canonical(receipt.tally)) fail('winning aggregate tally mismatch');
          game = applyPatch(chamber, game, receipt.patch);
          checkpoint = cloneState(game);
          merges++;
          break;
        }
        case 'reveal': {
          const receipt = event.payload.receipt as FullReceipt;
          verifyReceipt(chamber, receipt);
          if (receipt.sessionId !== input.sessionId || receipt.origin !== input.origin || !same(receipt.start, checkpoint)) fail('reveal checkpoint mismatch');
          break;
        }
        default: if (!passive.has(event.kind)) fail('unknown event kind');
      }
    }
    if (!chamber || !game || event.gameDigest !== gameDigest(chamber, game)) fail('game digest mismatch');
  }
  if (!chamber || !game || !checkpoint) fail('missing state');
  return { ok: true, sessionId: input.sessionId, eventCount: input.events.length, mergeCount: merges, finalGame: cloneState(game), checkpoint: cloneState(checkpoint), digest: gameDigest(chamber, game) };
}
