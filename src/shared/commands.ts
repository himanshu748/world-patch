import { isPatch, type Patch } from './engine.js';

export type ChatCommand = { type: 'patch'; patch: Patch } | { type: 'vote'; candidate: number };

/** Bounded allowlist, anchored to the whole message; chat is never executable. */
export function parseCommand(text: string): ChatCommand | null {
  if (typeof text !== 'string' || text.length > 200) return null;
  const command = text.replace(/^ +| +$/g, '');
  // ASCII spaces are deliberate: reject control characters / invisible separators.
  const vote = /^!vote ([1-8])$/i.exec(command);
  if (vote) return { type: 'vote', candidate: Number(vote[1]) };
  const match = /^!patch (gravity|portals|ice) (up|right|down|left|off|normal|crossed|on)$/i.exec(command);
  if (match) {
    const kind = match[1]!.toLowerCase();
    const value = match[2]!.toLowerCase();
    const patch: unknown = { kind, value: kind === 'ice' && (value === 'on' || value === 'off') ? value === 'on' : value };
    if (isPatch(patch)) return { type: 'patch', patch };
    return null;
  }
  const walls = /^!patch walls (A|B) (open|closed)$/i.exec(command);
  if (walls) return { type: 'patch', patch: { kind: 'walls', group: walls[1]!.toUpperCase() as 'A' | 'B', closed: walls[2]!.toLowerCase() === 'closed' } };
  return null;
}

export function patchKey(patch: Patch): string {
  if (!isPatch(patch)) throw new TypeError('Invalid patch.');
  return patch.kind === 'walls' ? `walls:${patch.group}:${patch.closed ? 'closed' : 'open'}` :
    `${patch.kind}:${typeof patch.value === 'boolean' ? (patch.value ? 'on' : 'off') : patch.value}`;
}
export function patchLabel(patch: Patch): string {
  if (!isPatch(patch)) throw new TypeError('Invalid patch.');
  switch (patch.kind) {
    case 'gravity': return patch.value === 'off' ? 'Gravity off' : `Gravity ${patch.value}`;
    case 'portals': return patch.value === 'crossed' ? 'Cross the portal links' : 'Restore normal portal links';
    case 'ice': return patch.value ? 'Ice becomes slippery' : 'Ice becomes walkable';
    case 'walls': return `${patch.closed ? 'Close' : 'Open'} wall group ${patch.group}`;
  }
}
