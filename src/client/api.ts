import { z } from 'zod';
import type { PublicState } from '../shared/protocol.js';

const direction = z.enum(['up', 'right', 'down', 'left']);
const point = z.object({ x: z.number().int().min(0).max(14), y: z.number().int().min(0).max(14) });
const rules = z.object({ gravity: z.enum(['off', 'up', 'right', 'down', 'left']), portals: z.enum(['normal', 'crossed']), ice: z.boolean(), walls: z.object({ A: z.boolean(), B: z.boolean() }) });
const game = point.extend({ chamberId: z.string().max(100), hasKey: z.boolean(), escaped: z.boolean(), rules });
const patch = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gravity'), value: z.enum(['off', 'up', 'right', 'down', 'left']) }),
  z.object({ kind: z.literal('portals'), value: z.enum(['normal', 'crossed']) }),
  z.object({ kind: z.literal('ice'), value: z.boolean() }),
  z.object({ kind: z.literal('walls'), group: z.enum(['A', 'B']), closed: z.boolean() }),
]);
const origin = z.enum(['simulation', 'twitch']);
export const twitchSchema = z.object({
  state: z.enum(['disabled', 'disconnected', 'authorizing', 'connecting', 'ready', 'reconnecting', 'error']),
  channel: z.string().max(100).optional(), reason: z.string().max(1000).optional(),
  lastEventAt: z.number().optional(), received: z.number().int().nonnegative(),
});
export type State = PublicState & { serverTime: number; twitch: z.infer<typeof twitchSchema> };
export const stateSchema = z.object({
  schemaVersion: z.literal(1), engineVersion: z.string().max(100), sessionId: z.string().max(100),
  origin, revision: z.number().int().nonnegative(), gameRevision: z.number().int().nonnegative(),
  chamber: z.object({
    id: z.string().max(100), version: z.number().int(), name: z.string().max(100), description: z.string().max(500),
    width: z.number().int().min(3).max(15), height: z.number().int().min(3).max(15),
    tiles: z.array(z.string().max(15)).max(15), start: point, exit: point, key: point,
    portals: z.array(point).max(4), wallGroups: z.object({ A: z.array(point).max(225), B: z.array(point).max(225) }), initialRules: rules,
  }),
  game, checkpoint: game, phase: z.enum(['play', 'proposing', 'voting', 'paused', 'revealed']),
  round: z.number().int().nonnegative(), deadline: z.number().nullable(), remainingMs: z.number().nullable(),
  candidates: z.array(z.object({ id: z.number().int(), key: z.string().max(100), patch, label: z.string().max(200), votes: z.number().int().nonnegative() })).max(8),
  receipt: z.object({
    id: z.string().max(100), sessionId: z.string().max(100), engineVersion: z.string().max(100),
    chamberVersion: z.number(), round: z.number(), revision: z.number(), origin, patch: patch.nullable(),
    beforeDigest: z.string().max(128), afterDigest: z.string().max(128), explored: z.number(), pathLength: z.number(), digest: z.string().max(128),
    tally: z.array(z.object({ candidateId: z.number().int(), key: z.string().max(100), votes: z.number().int().nonnegative() })).max(8),
    tieBreak: z.literal('votes-descending-then-canonical-key-code-point-ascending'),
    witness: z.array(direction).max(1000).optional(), start: game.optional(),
  }),
  history: z.array(z.object({ at: z.number(), kind: z.string().max(100), message: z.string().max(1000) })).max(200),
  lastRejection: z.object({ code: z.string().max(100), message: z.string().max(1000), at: z.number() }).nullable(),
  lastMove: z.object({ gameRevision: z.number(), from: game, direction }).optional(),
  serverTime: z.number(), twitch: twitchSchema,
});
export const configSchema = z.object({ authenticated: z.boolean(), twitchConfigured: z.boolean(), missingTwitchVariables: z.array(z.string().max(100)).max(10), origin: z.string() });
export type Config = z.infer<typeof configSchema>;

export async function request(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12_000),
  });
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. Please retry.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The server returned an invalid response.');
  const result = data as Record<string, unknown>;
  if (!response.ok || result.ok === false) throw new Error(typeof result.message === 'string' ? result.message : `Request failed (${response.status}).`);
  return result;
}
