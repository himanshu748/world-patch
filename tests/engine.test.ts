import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CHAMBERS, defineChamber } from '../src/shared/chambers.js';
import { parseCommand, patchKey, patchLabel } from '../src/shared/commands.js';
import {
  applyPatch, canonicalState, cloneState, DIRECTIONS, GameError, initialState, isBlocked,
  isPatch, replayWitness, solve, transition, transitionDetailed,
  type Chamber, type Direction, type GameState, type Patch,
} from '../src/shared/engine.js';

const untimed = { now: () => 0 };
const passage = defineChamber('fixture-passage', 'Fixture', 'Test only', [
  '#########', '#S~~~KE##', '#.......#', '#########',
]);
const portalRoom = defineChamber('fixture-portals', 'Fixture', 'Test only', [
  '#########', '#S0..2KE#', '#.......#', '#1....3.#', '#########',
]);
const gateRoom = defineChamber('fixture-gate', 'Fixture', 'Test only', [
  '#######', '#S.AKE#', '#######',
]);

function errorCode(fn: () => unknown, code: GameError['code']): void {
  try { fn(); throw new Error('Expected GameError'); } catch (error) {
    expect(error).toBeInstanceOf(GameError);
    expect((error as GameError).code).toBe(code);
  }
}
function freezeState(state: GameState): GameState {
  Object.freeze(state.rules.walls); Object.freeze(state.rules); return Object.freeze(state);
}

describe('authored chambers and state validation', () => {
  it.each(CHAMBERS.map(chamber => [chamber.name, chamber] as const))('%s has a replayable baseline escape', (_, chamber) => {
    const state = initialState(chamber);
    const result = solve(chamber, state, untimed);
    expect(result.status).toBe('solved');
    expect(result.witness.length).toBeGreaterThan(0);
    const end = replayWitness(chamber, state, result.witness);
    expect(end.escaped).toBe(true);
    expect(end.hasKey).toBe(true);
    expect({ x: end.x, y: end.y }).toEqual(chamber.exit);
    expect(result.explored).toBeLessThanOrEqual(2 * chamber.width * chamber.height + 1);
    expect(solve(chamber, state, untimed)).toEqual(result);
  });
  it.each([
    [0, { kind: 'walls', group: 'A', closed: true }, 24],
    [0, { kind: 'ice', value: true }, 17],
    [0, { kind: 'gravity', value: 'right' }, 14],
    [1, { kind: 'walls', group: 'A', closed: true }, 20],
    [1, { kind: 'portals', value: 'crossed' }, 14],
    [2, { kind: 'ice', value: true }, 11],
    [2, { kind: 'portals', value: 'crossed' }, 6],
  ] as const)('chamber %i has a meaningful approved patch %j', (index, patch, expectedLength) => {
    const chamber = CHAMBERS[index]!;
    const baseline = initialState(chamber);
    const patched = applyPatch(chamber, baseline, patch);
    const result = solve(chamber, patched, untimed);
    expect(result.status).toBe('solved');
    expect(result.witness).toHaveLength(expectedLength);
    expect(result.witness).not.toEqual(solve(chamber, baseline, untimed).witness);
    expect(replayWitness(chamber, patched, result.witness).escaped).toBe(true);
  });
  it.each(CHAMBERS.map(chamber => [chamber.name, chamber] as const))('%s rejects a verified directional lockout', (_, chamber) => {
    const snapshot = initialState(chamber);
    const before = canonicalState(snapshot);
    const candidate = applyPatch(chamber, snapshot, { kind: 'gravity', value: 'down' });
    expect(solve(chamber, candidate, untimed).status).toBe('unsolvable');
    expect(canonicalState(snapshot)).toBe(before);
  });
  it('rejects malformed authored maps rather than silently substituting floor', () => {
    expect(() => defineChamber('bad', '', '', ['#####', '#SK0#', '#..E#', '#####'])).toThrow(/portals/);
    expect(() => defineChamber('bad', '', '', ['#####', '#SKE', '#####'])).toThrow(/rectangular/);
    expect(() => defineChamber('bad', '', '', ['#####', '#S.E#', '#####'])).toThrow(/K required/);
    expect(() => defineChamber('bad', '', '', ['##.##', '#SKE#', '#####'])).toThrow(/border/);
  });
  it('rejects state from another chamber and impossible terminal state', () => {
    errorCode(() => transition(passage, initialState(gateRoom), 'right'), 'INVALID_STATE');
    errorCode(() => transition(passage, { ...initialState(passage), escaped: true }, 'right'), 'INVALID_STATE');
  });
});

describe('single transition contract', () => {
  it('blocked input causes no gravity and never changes the source', () => {
    const state = freezeState({ ...initialState(passage), rules: { ...initialState(passage).rules, gravity: 'down' } });
    expect(transition(passage, state, 'up')).toBe(state);
    expect(state.y).toBe(1);
  });
  it('ice carries through marked cells and stops on the first floor; checks the key', () => {
    const state = applyPatch(passage, initialState(passage), { kind: 'ice', value: true });
    const result = transitionDetailed(passage, state, 'right');
    expect(result.state).toMatchObject({ x: 5, y: 1, hasKey: true, escaped: false });
    expect(result.frames.map(frame => [frame.x, frame.kind])).toEqual([[2, 'step'], [3, 'slide'], [4, 'slide'], [5, 'slide']]);
    expect(transition(passage, result.state, 'right').escaped).toBe(true);
  });
  it('applies gravity after slide, and an unlocked exit halts remaining movement', () => {
    const state = applyPatch(passage, applyPatch(passage, initialState(passage), { kind: 'ice', value: true }), { kind: 'gravity', value: 'right' });
    expect(transitionDetailed(passage, state, 'right').state).toMatchObject({ x: 6, y: 1, hasKey: true, escaped: true });
    const atKey = { ...state, x: 5, y: 1, hasKey: true, rules: { ...state.rules, gravity: 'down' as const } };
    expect(transitionDetailed(passage, atKey, 'right').frames).toHaveLength(1);
  });
  it('checks key and exit on traversed ice tiles, not only the final position', () => {
    const layered: Chamber = { ...passage, key: { x: 3, y: 1 }, exit: { x: 4, y: 1 } };
    const state = applyPatch(layered, initialState(layered), { kind: 'ice', value: true });
    expect(transition(layered, state, 'right')).toMatchObject({ x: 4, y: 1, hasKey: true, escaped: true });
  });
  it('an exit without key is ordinary floor', () => {
    const state = { ...initialState(passage), x: 5, y: 1 };
    expect(transition(passage, state, 'right')).toMatchObject({ x: 6, y: 1, hasKey: false, escaped: false });
  });
  it('uses four meaningful portal endpoints and never re-triggers on portal arrival', () => {
    const state = initialState(portalRoom);
    expect(transition(portalRoom, state, 'right')).toMatchObject({ x: 1, y: 3 });
    const crossed = applyPatch(portalRoom, state, { kind: 'portals', value: 'crossed' });
    expect(transition(portalRoom, crossed, 'right')).toMatchObject({ x: 6, y: 3 });
    expect(transitionDetailed(portalRoom, state, 'right').frames.map(frame => frame.kind)).toEqual(['step', 'portal']);
  });
  it('resolves portal, gravity, and a portal entered by gravity in the documented order', () => {
    const rightGravity = applyPatch(portalRoom, initialState(portalRoom), { kind: 'gravity', value: 'right' });
    expect(transitionDetailed(portalRoom, rightGravity, 'right').frames.map(frame => frame.kind)).toEqual(['step', 'portal', 'gravity']);
    expect(transition(portalRoom, rightGravity, 'right')).toMatchObject({ x: 2, y: 3 });
    const leftGravity = { ...rightGravity, x: 3, y: 2, rules: { ...rightGravity.rules, gravity: 'left' as const } };
    expect(transitionDetailed(portalRoom, leftGravity, 'up').frames.map(frame => frame.kind)).toEqual(['step', 'gravity', 'portal']);
    expect(transition(portalRoom, leftGravity, 'up')).toMatchObject({ x: 1, y: 3 });
  });
  it('does not initiate another ice slide on gravity arrival', () => {
    const state = { ...initialState(passage), x: 2, y: 2, rules: { ...initialState(passage).rules, ice: true, gravity: 'up' as const } };
    expect(transitionDetailed(passage, state, 'right').frames.map(frame => frame.kind)).toEqual(['step', 'gravity']);
    expect(transition(passage, state, 'right')).toMatchObject({ x: 3, y: 1 });
  });
  it('terminal escape is absorbing and immutable', () => {
    const escaped = replayWitness(passage, initialState(passage), solve(passage, initialState(passage), untimed).witness);
    expect(transition(passage, freezeState(escaped), 'left')).toBe(escaped);
  });
});

describe('patch safety and evidence outcomes', () => {
  it('sets one law without moving or mutating the source', () => {
    const source = freezeState(initialState(gateRoom));
    const patched = applyPatch(gateRoom, source, { kind: 'gravity', value: 'right' });
    expect(patched.x).toBe(source.x); expect(patched.y).toBe(source.y);
    expect(source.rules.gravity).toBe('off'); expect(patched.rules.gravity).toBe('right');
  });
  it('rejects no-op, unavailable and occupied-wall patches', () => {
    errorCode(() => applyPatch(gateRoom, initialState(gateRoom), { kind: 'gravity', value: 'off' }), 'NO_CHANGE');
    errorCode(() => applyPatch(gateRoom, initialState(gateRoom), { kind: 'portals', value: 'crossed' }), 'UNAVAILABLE');
    errorCode(() => applyPatch(gateRoom, initialState(gateRoom), { kind: 'ice', value: true }), 'UNAVAILABLE');
    errorCode(() => applyPatch(gateRoom, { ...initialState(gateRoom), x: 3 }, { kind: 'walls', group: 'A', closed: true }), 'OCCUPIED_WALL');
    errorCode(() => applyPatch(gateRoom, initialState(gateRoom), { kind: 'walls', group: 'B', closed: true }), 'UNAVAILABLE');
  });
  it('strictly validates untrusted patch shape and values', () => {
    for (const patch of [null, [], { kind: 'gravity', value: 'diagonal' }, { kind: 'ice', value: 'true' }, { kind: 'ice', value: true, code: 'alert(1)' }, { kind: 'walls', group: '__proto__', closed: true }]) {
      expect(isPatch(patch)).toBe(false);
      errorCode(() => applyPatch(gateRoom, initialState(gateRoom), patch as Patch), 'INVALID_PATCH');
    }
  });
  it('distinguishes complete exhaustion from node/time budget interruption', () => {
    const closed = applyPatch(gateRoom, initialState(gateRoom), { kind: 'walls', group: 'A', closed: true });
    expect(solve(gateRoom, closed, untimed)).toMatchObject({ status: 'unsolvable', witness: [], explored: 2 });
    expect(solve(gateRoom, initialState(gateRoom), { ...untimed, maxNodes: 0 })).toEqual({ status: 'incomplete', witness: [], explored: 0 });
    expect(solve(gateRoom, initialState(gateRoom), { ...untimed, maxMs: 0 })).toEqual({ status: 'incomplete', witness: [], explored: 0 });
    let time = 0;
    expect(solve(gateRoom, initialState(gateRoom), { now: () => time++, maxMs: 2 }).status).toBe('incomplete');
    expect(solve(gateRoom, closed, { ...untimed, maxNodes: 2 }).status).toBe('unsolvable');
  });
  it('rejects invalid budgets and returns a terminal state without further search', () => {
    expect(() => solve(gateRoom, initialState(gateRoom), { maxNodes: -1 })).toThrow(RangeError);
    expect(() => solve(gateRoom, initialState(gateRoom), { maxMs: Number.NaN })).toThrow(RangeError);
    const end = replayWitness(gateRoom, initialState(gateRoom), solve(gateRoom, initialState(gateRoom), untimed).witness);
    expect(solve(gateRoom, end, { maxNodes: 0 })).toEqual({ status: 'solved', witness: [], explored: 0 });
  });
  it('a wall law changes real movement and can reject a lockout without changing source', () => {
    const open = { ...initialState(gateRoom), x: 2 };
    const closed = applyPatch(gateRoom, open, { kind: 'walls', group: 'A', closed: true });
    expect(transition(gateRoom, open, 'right').x).toBe(3);
    expect(transition(gateRoom, closed, 'right').x).toBe(2);
    expect(solve(gateRoom, closed, untimed).status).toBe('unsolvable');
    expect(open.rules.walls.A).toBe(false);
  });
});

describe('bounded chat grammar', () => {
  it.each([
    ['!patch gravity left', { kind: 'gravity', value: 'left' }],
    ['!patch gravity off', { kind: 'gravity', value: 'off' }],
    ['!patch portals crossed', { kind: 'portals', value: 'crossed' }],
    ['!patch ice on', { kind: 'ice', value: true }],
    ['!patch ice off', { kind: 'ice', value: false }],
    [' !PaTcH walls a CLOSED ', { kind: 'walls', group: 'A', closed: true }],
  ])('parses %s as a typed assignment', (text, patch) => expect(parseCommand(text as string)).toEqual({ type: 'patch', patch }));
  it('only accepts bounded numeric candidate votes', () => {
    expect(parseCommand('!vote 8')).toEqual({ type: 'vote', candidate: 8 });
    for (const input of ['!vote 0', '!vote 9', '!vote -1', '!vote 1.0', '!vote 01', '!vote 1;alert(1)']) expect(parseCommand(input)).toBeNull();
  });
  it('rejects wrong family values, arbitrary code, extra tokens, oversized text and control separators', () => {
    for (const text of ['!patch ice left', '!patch portals on', '!patch gravity normal', '!patch ice on now', '!patch walls C open', '!patch wall A open', '!patch gravity left\n', '!patch\tice on', '!patch ice\non', 'prefix !patch ice on', '!patch ice on ' + 'x'.repeat(201), '<script>alert(1)</script>']) expect(parseCommand(text)).toBeNull();
  });
  it('has stable canonical keys and nontechnical labels', () => {
    expect(patchKey({ kind: 'walls', group: 'A', closed: true })).toBe('walls:A:closed');
    expect(patchKey({ kind: 'ice', value: false })).toBe('ice:off');
    expect(patchLabel({ kind: 'portals', value: 'crossed' })).toBe('Cross the portal links');
  });
});

describe('seeded properties', () => {
  const direction = fc.constantFrom<Direction>(...DIRECTIONS);
  const patches = fc.constantFrom<Patch>(
    ...DIRECTIONS.map(value => ({ kind: 'gravity', value }) as Patch),
    { kind: 'gravity', value: 'off' }, { kind: 'portals', value: 'crossed' },
    { kind: 'ice', value: true }, { kind: 'walls', group: 'A', closed: true }, { kind: 'walls', group: 'B', closed: true },
  );
  it('movement remains deterministic, bounded, nonmutating and key-safe', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: CHAMBERS.length - 1 }), fc.array(direction, { maxLength: 100 }), (index, inputs) => {
      const chamber = CHAMBERS[index]!;
      let state = initialState(chamber);
      for (const input of inputs) {
        const before = canonicalState(state);
        freezeState(state);
        const next = transition(chamber, state, input);
        expect(transition(chamber, cloneState(state), input)).toEqual(next);
        expect(canonicalState(state)).toBe(before);
        expect(isBlocked(chamber, next, next.x, next.y)).toBe(false);
        if (state.hasKey) expect(next.hasKey).toBe(true);
        if (next.escaped) expect(next.hasKey && next.x === chamber.exit.x && next.y === chamber.exit.y).toBe(true);
        state = next;
      }
      expect(replayWitness(chamber, initialState(chamber), inputs)).toEqual(state);
    }), { seed: 2801026, numRuns: 150 });
  });
  it('every found patch witness escapes the exact patched snapshot', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: CHAMBERS.length - 1 }), fc.array(direction, { maxLength: 30 }), patches, (index, inputs, patch) => {
      const chamber = CHAMBERS[index]!;
      const state = replayWitness(chamber, initialState(chamber), inputs);
      const before = canonicalState(state);
      let patched: GameState;
      try { patched = applyPatch(chamber, freezeState(state), patch); } catch (error) { expect(error).toBeInstanceOf(GameError); return; }
      const result = solve(chamber, patched, untimed);
      expect(result.status).not.toBe('incomplete');
      expect(canonicalState(state)).toBe(before);
      if (result.status === 'solved') expect(replayWitness(chamber, patched, result.witness).escaped).toBe(true);
      else expect(result.witness).toEqual([]);
    }), { seed: 2801027, numRuns: 150 });
  });
  it('arbitrary text never produces an untyped patch', () => {
    fc.assert(fc.property(fc.string({ maxLength: 300 }), text => {
      const result = parseCommand(text);
      if (result?.type === 'patch') expect(isPatch(result.patch)).toBe(true);
      if (result?.type === 'vote') expect(result.candidate >= 1 && result.candidate <= 8).toBe(true);
    }), { seed: 2801028, numRuns: 300 });
  });
});
