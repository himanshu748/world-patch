import { type Chamber, type Position, type Rules } from './engine.js';

const defaultRules: Rules = { gravity: 'off', portals: 'normal', ice: false, walls: { A: false, B: false } };

/** Validate authored maps at import, so missing keys or malformed networks fail loudly. */
export function defineChamber(id: string, name: string, description: string, tiles: readonly string[], initialRules: Rules = defaultRules): Chamber {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  if (width < 3 || height < 3 || width > 15 || height > 15 || tiles.some(row => row.length !== width || /[^#.SKE~AB0-3]/.test(row))) {
    throw new Error(`Malformed chamber ${id}: bounded rectangular grid required.`);
  }
  if (tiles[0] !== '#'.repeat(width) || tiles[height - 1] !== '#'.repeat(width) || tiles.some(row => row[0] !== '#' || row[width - 1] !== '#')) {
    throw new Error(`Malformed chamber ${id}: outer border must be solid.`);
  }
  const findAll = (token: string): Position[] => tiles.flatMap((row, y) => [...row].flatMap((tile, x) => tile === token ? [{ x, y }] : []));
  const only = (token: string): Position => {
    const positions = findAll(token);
    if (positions.length !== 1) throw new Error(`Malformed chamber ${id}: exactly one ${token} required.`);
    return positions[0]!;
  };
  const portalCells = ['0', '1', '2', '3'].map(findAll);
  if (portalCells.some(positions => positions.length > 0) && !portalCells.every(positions => positions.length === 1)) {
    throw new Error(`Malformed chamber ${id}: use zero or four distinct portals.`);
  }
  return {
    id, version: 1, name, description, width, height, tiles: [...tiles],
    start: only('S'), exit: only('E'), key: only('K'),
    portals: portalCells.flat(), wallGroups: { A: findAll('A'), B: findAll('B') },
    initialRules: { ...initialRules, walls: { ...initialRules.walls } },
  };
}

export const CHAMBERS: readonly Chamber[] = [
  defineChamber('vector-foundry', 'Vector Foundry', 'Find the key. Learn the drift. Chat can close the direct crossing.', [
    '###########',
    '#S..#....K#',
    '#.#~#.##..#',
    '#.#.A.#...#',
    '#.AAA.#.#.#',
    '#...#...#.#',
    '#.~~~.##..#',
    '#....B...E#',
    '###########',
  ]),
  defineChamber('crosswire', 'Crosswire', 'Four portals. Two ways to pair them. One escape worth checking.', [
    '###########',
    '#S..#....K#',
    '#.#.#.##..#',
    '#0#.#....2#',
    '#...A.....#',
    '#1..#....3#',
    '#.###.##..#',
    '#...B....E#',
    '###########',
  ]),
  defineChamber('thin-ice', 'Thin Ice', 'The floor carries you. Gates can become brakes. Read the route before you move.', [
    '###########',
    '#..0#~~.KE#',
    '#.#.#.##..#',
    '#...A..2..#',
    '#.~~~~~.#.#',
    '#1..#..B..#',
    '#.###.#.3.#',
    '#S.......##',
    '###########',
  ]),
];
