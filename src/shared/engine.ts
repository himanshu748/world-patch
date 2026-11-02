/** The player, verifier and replay all use this discrete rules engine. */
export const ENGINE_VERSION = 'world-patch/1.0.0';
export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export interface Position { readonly x: number; readonly y: number }
export interface Rules {
  gravity: Direction | 'off';
  portals: 'normal' | 'crossed';
  ice: boolean;
  /** True means closed. */
  walls: { A: boolean; B: boolean };
}
export interface GameState {
  chamberId: string;
  x: number;
  y: number;
  hasKey: boolean;
  rules: Rules;
  escaped: boolean;
}
export type Patch =
  | { kind: 'gravity'; value: Direction | 'off' }
  | { kind: 'portals'; value: 'normal' | 'crossed' }
  | { kind: 'ice'; value: boolean }
  | { kind: 'walls'; group: 'A' | 'B'; closed: boolean };
export interface Chamber {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly string[];
  readonly start: Position;
  readonly exit: Position;
  readonly key: Position;
  /** Indexed by the numbered tile 0, 1, 2, 3; either empty or four entries. */
  readonly portals: readonly Position[];
  readonly wallGroups: { readonly A: readonly Position[]; readonly B: readonly Position[] };
  readonly initialRules: Rules;
}
export class GameError extends Error {
  constructor(public readonly code: 'INVALID_STATE' | 'INVALID_PATCH' | 'NO_CHANGE' | 'OCCUPIED_WALL' | 'UNAVAILABLE' | 'ESCAPED', message: string) {
    super(message);
    this.name = 'GameError';
  }
}

const vectors: Record<Direction, Position> = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
export const samePosition = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;
export const cloneRules = (rules: Rules): Rules => ({ ...rules, walls: { ...rules.walls } });
export const cloneState = (state: GameState): GameState => ({ ...state, rules: cloneRules(state.rules) });
export function tileAt(chamber: Chamber, x: number, y: number): string {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= chamber.width || y >= chamber.height) return '#';
  return chamber.tiles[y]?.[x] ?? '#';
}
export function isBlocked(chamber: Chamber, state: GameState, x: number, y: number): boolean {
  const tile = tileAt(chamber, x, y);
  return tile === '#' || (tile === 'A' && state.rules.walls.A) || (tile === 'B' && state.rules.walls.B);
}

function validRules(rules: Rules): boolean {
  return rules !== null && typeof rules === 'object' &&
    (rules.gravity === 'off' || DIRECTIONS.includes(rules.gravity)) &&
    (rules.portals === 'normal' || rules.portals === 'crossed') &&
    typeof rules.ice === 'boolean' && rules.walls !== null && typeof rules.walls === 'object' &&
    typeof rules.walls.A === 'boolean' && typeof rules.walls.B === 'boolean';
}
export function assertState(chamber: Chamber, state: GameState): void {
  if (state.chamberId !== chamber.id || !validRules(state.rules) ||
      !Number.isInteger(state.x) || !Number.isInteger(state.y) ||
      typeof state.hasKey !== 'boolean' || typeof state.escaped !== 'boolean' ||
      isBlocked(chamber, state, state.x, state.y) ||
      (state.escaped && (!state.hasKey || !samePosition(state, chamber.exit)))) {
    throw new GameError('INVALID_STATE', 'State does not describe a valid position in this chamber.');
  }
}
export function initialState(chamber: Chamber): GameState {
  const state: GameState = { chamberId: chamber.id, ...chamber.start, hasKey: false, rules: cloneRules(chamber.initialRules), escaped: false };
  assertState(chamber, state);
  return state;
}

/** Stable, versionable key for digests and equality; never relies on object property insertion order. */
export function canonicalState(state: GameState): string {
  return JSON.stringify({
    chamberId: state.chamberId, x: state.x, y: state.y, hasKey: state.hasKey,
    rules: { gravity: state.rules.gravity, portals: state.rules.portals, ice: state.rules.ice, walls: { A: state.rules.walls.A, B: state.rules.walls.B } },
    escaped: state.escaped,
  });
}
export const stateKey = canonicalState;

export type MovementKind = 'step' | 'slide' | 'portal' | 'gravity';
export interface MovementFrame extends Position { readonly kind: MovementKind; readonly hasKey: boolean; readonly escaped: boolean }
export interface TransitionResult { state: GameState; frames: MovementFrame[] }

/**
 * Exact substep order: manual -> ice -> portal -> one-cell gravity -> portal.
 * Exit/key are checked on EVERY entered tile, including the intermediate ice cells.
 * Animation frames are data from this same transition, never a second physics system.
 */
export function transitionDetailed(chamber: Chamber, source: GameState, direction: Direction): TransitionResult {
  assertState(chamber, source);
  if (!DIRECTIONS.includes(direction)) throw new GameError('INVALID_STATE', 'Unknown movement direction.');
  if (source.escaped) return { state: source, frames: [] };
  const vector = vectors[direction];
  if (isBlocked(chamber, source, source.x + vector.x, source.y + vector.y)) return { state: source, frames: [] };
  const state = cloneState(source);
  const frames: MovementFrame[] = [];
  const arrive = (x: number, y: number, kind: MovementKind): void => {
    state.x = x; state.y = y;
    if (samePosition(state, chamber.key)) state.hasKey = true;
    if (state.hasKey && samePosition(state, chamber.exit)) state.escaped = true;
    frames.push({ x, y, kind, hasKey: state.hasKey, escaped: state.escaped });
  };
  const portal = (): void => {
    const tile = tileAt(chamber, state.x, state.y);
    if (!/^[0-3]$/.test(tile) || chamber.portals.length !== 4) return;
    const index = Number(tile);
    const targetIndex = state.rules.portals === 'normal' ? (index ^ 1) : (3 - index);
    const destination = chamber.portals[targetIndex];
    if (!destination || isBlocked(chamber, state, destination.x, destination.y)) return;
    arrive(destination.x, destination.y, 'portal');
  };

  arrive(state.x + vector.x, state.y + vector.y, 'step');
  if (state.escaped) return { state, frames };
  while (state.rules.ice && tileAt(chamber, state.x, state.y) === '~' &&
      !isBlocked(chamber, state, state.x + vector.x, state.y + vector.y)) {
    arrive(state.x + vector.x, state.y + vector.y, 'slide');
    if (state.escaped) return { state, frames };
  }
  portal();
  if (state.escaped) return { state, frames };
  if (state.rules.gravity !== 'off') {
    const gravity = vectors[state.rules.gravity];
    if (!isBlocked(chamber, state, state.x + gravity.x, state.y + gravity.y)) {
      arrive(state.x + gravity.x, state.y + gravity.y, 'gravity');
      if (state.escaped) return { state, frames };
      portal();
    }
  }
  return { state, frames };
}
export function transition(chamber: Chamber, state: GameState, direction: Direction): GameState {
  return transitionDetailed(chamber, state, direction).state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Strict runtime check. No extra fields survive the patch trust boundary. */
export function isPatch(value: unknown): value is Patch {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort().join(',');
  if (value.kind === 'walls') return keys === 'closed,group,kind' && (value.group === 'A' || value.group === 'B') && typeof value.closed === 'boolean';
  if (keys !== 'kind,value') return false;
  if (value.kind === 'gravity') return value.value === 'off' || DIRECTIONS.some(direction => direction === value.value);
  if (value.kind === 'portals') return value.value === 'normal' || value.value === 'crossed';
  return value.kind === 'ice' && typeof value.value === 'boolean';
}
export function applyPatch(chamber: Chamber, state: GameState, patch: Patch): GameState {
  assertState(chamber, state);
  if (!isPatch(patch)) throw new GameError('INVALID_PATCH', 'Patch must exactly match an allowed rule assignment.');
  if (state.escaped) throw new GameError('ESCAPED', 'This attempt has already escaped.');
  const next = cloneState(state);
  switch (patch.kind) {
    case 'gravity':
      if (next.rules.gravity === patch.value) throw new GameError('NO_CHANGE', 'Gravity already has that direction.');
      next.rules.gravity = patch.value;
      break;
    case 'portals':
      if (chamber.portals.length !== 4) throw new GameError('UNAVAILABLE', 'This chamber has no portal network.');
      if (next.rules.portals === patch.value) throw new GameError('NO_CHANGE', 'Portals already have that pairing.');
      next.rules.portals = patch.value;
      break;
    case 'ice':
      if (!chamber.tiles.some(row => row.includes('~'))) throw new GameError('UNAVAILABLE', 'This chamber has no ice tiles.');
      if (next.rules.ice === patch.value) throw new GameError('NO_CHANGE', 'Ice already has that setting.');
      next.rules.ice = patch.value;
      break;
    case 'walls':
      if (chamber.wallGroups[patch.group].length === 0) throw new GameError('UNAVAILABLE', 'This chamber has no walls in that group.');
      if (next.rules.walls[patch.group] === patch.closed) throw new GameError('NO_CHANGE', 'That wall group already has that setting.');
      if (patch.closed && chamber.wallGroups[patch.group].some(position => samePosition(position, state))) {
        throw new GameError('OCCUPIED_WALL', 'A wall cannot close on the player.');
      }
      next.rules.walls[patch.group] = patch.closed;
  }
  return next;
}

export interface SolveOptions {
  maxNodes?: number;
  maxMs?: number;
  /** Inject a monotonic clock for deterministic deadline tests. Movement never reads it. */
  now?: () => number;
}
export interface SolveResult {
  status: 'solved' | 'unsolvable' | 'incomplete';
  witness: Direction[];
  explored: number;
}
/** BFS. Only frontier exhaustion means unsolvable; any budget exit is incomplete. */
export function solve(chamber: Chamber, initial: GameState, options: SolveOptions = {}): SolveResult {
  assertState(chamber, initial);
  if (initial.escaped) return { status: 'solved', witness: [], explored: 0 };
  const maxNodes = options.maxNodes ?? 5000;
  const maxMs = options.maxMs ?? 50;
  if (!Number.isInteger(maxNodes) || maxNodes < 0 || !Number.isFinite(maxMs) || maxMs < 0) {
    throw new RangeError('Solver budgets must be finite and non-negative; maxNodes must be an integer.');
  }
  const now = options.now ?? (() => performance.now());
  const started = now();
  const compactKey = (state: GameState): string => `${state.x},${state.y},${Number(state.hasKey)},${Number(state.escaped)}`;
  const nodes: { state: GameState; parent: number; action?: Direction }[] = [{ state: cloneState(initial), parent: -1 }];
  const seen = new Set([compactKey(initial)]);
  let cursor = 0;
  let explored = 0;
  while (cursor < nodes.length) {
    if (explored >= maxNodes || now() - started >= maxMs) return { status: 'incomplete', witness: [], explored };
    const parent = cursor++;
    const node = nodes[parent]!;
    explored++;
    for (const action of DIRECTIONS) {
      const state = transition(chamber, node.state, action);
      const key = compactKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      const index = nodes.length;
      nodes.push({ state, parent, action });
      if (state.escaped) {
        const witness: Direction[] = [];
        let step = index;
        while (nodes[step]!.parent !== -1) {
          witness.push(nodes[step]!.action!);
          step = nodes[step]!.parent;
        }
        witness.reverse();
        return { status: 'solved', witness, explored };
      }
    }
  }
  return { status: 'unsolvable', witness: [], explored };
}
export function replayWitness(chamber: Chamber, initial: GameState, witness: readonly Direction[]): GameState {
  assertState(chamber, initial);
  return witness.reduce((state, direction) => transition(chamber, state, direction), cloneState(initial));
}
