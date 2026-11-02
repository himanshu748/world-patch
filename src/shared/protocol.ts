import type { Chamber, Direction, GameState, Patch } from './engine.js';

/** Opaque provider identity bound shared by transport and room admission. */
export const MAX_PROVIDER_ID_LENGTH = 256;

export type Origin = 'simulation' | 'twitch';
export type Phase = 'play' | 'proposing' | 'voting' | 'paused' | 'revealed';
export type HostAction =
  | { type: 'move'; direction: Direction }
  | { type: 'startRound' | 'closeWindow' | 'pause' | 'resume' | 'cancel' | 'reset' | 'reveal' }
  | { type: 'removeCandidate'; candidateId: number }
  | { type: 'blockActor'; actorId: string }
  | { type: 'selectChamber'; chamberId: string }
  | { type: 'newSession'; origin: Origin; chamberId?: string };
export interface ChatInput {
  origin: Origin;
  /** Server-generated pseudonym; raw provider user IDs never enter the room. */
  actorId: string;
  messageId: string;
  eventId: string;
  text: string;
  receivedAt: number;
  /** Provider timestamp; required for live input to prevent cross-window delayed votes. */
  sentAt?: number;
}
export interface ActionResult { ok: boolean; code: string; message: string }
export interface Candidate { id: number; key: string; patch: Patch; label: string; votes: number }
export interface Rejection { code: string; message: string; at: number }
export interface HistoryItem { at: number; kind: string; message: string }
export interface VoteTally { candidateId: number; key: string; votes: number }
export interface Receipt {
  id: string;
  sessionId: string;
  engineVersion: string;
  chamberVersion: number;
  round: number;
  revision: number;
  origin: Origin;
  patch: Patch | null;
  beforeDigest: string;
  afterDigest: string;
  explored: number;
  pathLength: number;
  digest: string;
  /** Public aggregate evidence; individual voter identities remain private. */
  tally: VoteTally[];
  tieBreak: 'votes-descending-then-canonical-key-code-point-ascending';
  /** Available only after the host reveals the attempt. */
  witness?: Direction[];
  start?: GameState;
}
export interface FullReceipt extends Receipt { witness: Direction[]; start: GameState; before: GameState }
export interface PublicState {
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
  remainingMs: number | null;
  candidates: Candidate[];
  receipt: Receipt;
  history: HistoryItem[];
  lastRejection: Rejection | null;
  lastMove?: { gameRevision: number; from: GameState; direction: Direction };
}
export interface ModerationState { actors: { actorId: string; blocked: boolean }[] }
export type ReplayKind = 'session-start' | 'move' | 'reset' | 'merge' | 'reveal' | 'round-open' | 'voting-open' | 'vote' | 'proposal' | 'pause' | 'resume' | 'cancel' | 'moderation' | 'rejection' | 'recovered';
export interface ReplayEventInput { at: number; kind: ReplayKind; payload: Record<string, unknown>; gameDigest: string }
export interface ReplayEvent extends ReplayEventInput { seq: number; sessionId: string; previousHash: string; hash: string }
export interface ReplayExport { schemaVersion: 1; engineVersion: string; sessionId: string; origin: Origin; events: ReplayEvent[] }
export interface ReplayVerification { ok: true; sessionId: string; eventCount: number; mergeCount: number; finalGame: GameState; checkpoint: GameState; digest: string }
