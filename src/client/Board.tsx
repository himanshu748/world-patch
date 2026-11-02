import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { canonicalState, transitionDetailed, type Chamber, type GameState, type MovementFrame } from '../shared/engine.js';
import type { PublicState } from '../shared/protocol.js';

interface BoardProps { chamber: Chamber; state: GameState; checkpoint: GameState; lastMove?: PublicState['lastMove']; reducedMotion: boolean; ghost?: GameState | null; ghostFrames?: MovementFrame[] }
const CELL = 66, PAD = 40;
const C = { floor: 0x121b28, line: 0x263346, wall: 0x263348, edge: 0x3b4a60, amber: 0xffc857, cyan: 0x76e4f7, violet: 0xbc9cff, green: 0xb2f199, ink: 0x090c12 };

class ChamberScene extends Phaser.Scene {
  private layer?: Phaser.GameObjects.Container;
  private pawn?: Phaser.GameObjects.Container;
  private ghostPawn?: Phaser.GameObjects.Container;
  private previous?: BoardProps;
  private animation = 0;
  constructor(private readProps: () => BoardProps) { super('chamber'); }
  create(): void { this.paint(this.readProps(), true); }
  private label(x: number, y: number, text: string, size = 14, color = '#aab4c4'): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, { fontFamily: 'ui-monospace, monospace', fontSize: `${size}px`, color, fontStyle: 'bold' }).setOrigin(.5);
    this.layer!.add(label); return label;
  }
  private character(x: number, y: number, ghost = false): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const shape = this.add.graphics();
    const color = ghost ? C.cyan : C.amber;
    shape.fillStyle(color, ghost ? .12 : .12).fillCircle(0, 0, 27);
    shape.lineStyle(1, color, .4).strokeCircle(0, 0, 26);
    shape.fillStyle(color, ghost ? .55 : 1);
    shape.fillPoints([{ x: 0, y: -19 }, { x: 17, y: 0 }, { x: 0, y: 19 }, { x: -17, y: 0 }], true);
    shape.fillStyle(ghost ? 0xffffff : C.ink, 1).fillRect(-4, -4, 8, 8);
    container.add(shape); container.setDepth(20); return container;
  }
  private position(x: number, y: number): { x: number; y: number } { return { x: PAD + x * CELL + CELL / 2, y: PAD + y * CELL + CELL / 2 }; }
  private animate(pawn: Phaser.GameObjects.Container, frames: MovementFrame[], reducedMotion: boolean, epoch: number): void {
    if (!frames.length || epoch !== this.animation || !pawn.active) return;
    if (reducedMotion) { const last = frames.at(-1)!; pawn.setPosition(...Object.values(this.position(last.x, last.y)) as [number, number]); return; }
    const [frame, ...rest] = frames;
    if (!frame) return;
    if (frame.kind === 'portal') {
      this.tweens.add({ targets: pawn, alpha: .1, scale: .75, duration: 65, onComplete: () => {
        if (epoch !== this.animation || !pawn.active) return;
        const point = this.position(frame.x, frame.y); pawn.setPosition(point.x, point.y);
        this.tweens.add({ targets: pawn, alpha: 1, scale: 1, duration: 100, onComplete: () => this.animate(pawn, rest, reducedMotion, epoch) });
      } });
    } else {
      const point = this.position(frame.x, frame.y);
      this.tweens.add({ targets: pawn, x: point.x, y: point.y, duration: frame.kind === 'slide' ? 75 : 115, ease: 'Cubic.Out', onComplete: () => this.animate(pawn, rest, reducedMotion, epoch) });
    }
  }
  paint(props: BoardProps, first = false): void {
    // create() runs before Phaser marks a scene active; its first paint must still run.
    if (!first && !this.sys.isActive()) return;
    const previous = this.previous;
    this.previous = props;
    const epoch = ++this.animation;
    this.tweens.killAll();
    this.layer?.destroy(true); this.pawn?.destroy(true); this.ghostPawn?.destroy(true);
    this.layer = this.add.container();
    const { chamber, state } = props;
    const displayed = props.ghost ?? state;
    const g = this.add.graphics(); this.layer.add(g);
    g.fillStyle(C.ink).fillRect(0, 0, chamber.width * CELL + PAD * 2, chamber.height * CELL + PAD * 2);
    for (let y = 0; y < chamber.height; y++) for (let x = 0; x < chamber.width; x++) {
      const px = PAD + x * CELL, py = PAD + y * CELL;
      const tile = chamber.tiles[y]![x]!;
      const isGroup = tile === 'A' || tile === 'B';
      const closed = isGroup && state.rules.walls[tile as 'A' | 'B'];
      g.fillStyle(C.floor).fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      g.lineStyle(1, C.line, .5).strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      if (tile === '#' || closed) {
        g.fillStyle(closed ? 0x57472b : C.wall).fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
        g.fillStyle(closed ? 0x8a7039 : C.edge).fillRect(px + 3, py + 3, CELL - 6, 4);
        g.fillStyle(0x090c12, .4).fillRect(px + 3, py + CELL - 9, CELL - 6, 6);
        if (isGroup) {
          g.lineStyle(2, C.amber, .4);
          for (let n = 12; n < CELL - 8; n += 13) g.lineBetween(px + n, py + 7, px + 7, py + n);
          this.label(px + CELL / 2, py + CELL / 2, tile, 20, '#ffc857');
        }
      } else if (isGroup) {
        g.lineStyle(1, C.amber, .5).strokeRect(px + 8, py + 8, CELL - 16, CELL - 16);
        this.label(px + CELL / 2, py + CELL / 2, tile, 17, '#a68f63');
      }
      if (tile === '~') {
        g.fillStyle(C.cyan, state.rules.ice ? .15 : .035).fillRect(px + 4, py + 4, CELL - 8, CELL - 8);
        g.lineStyle(1.5, C.cyan, state.rules.ice ? .75 : .2);
        for (let n = 12; n < CELL - 5; n += 13) g.lineBetween(px + n, py + 7, px + 7, py + n);
        this.label(px + CELL - 14, py + CELL - 14, '≈', 16, state.rules.ice ? '#76e4f7' : '#668b9c');
      }
      if (/^[0-3]$/.test(tile)) {
        const index = Number(tile), pair = state.rules.portals === 'normal' ? Math.floor(index / 2) : (index === 0 || index === 3 ? 0 : 1);
        const color = pair === 0 ? C.violet : C.cyan;
        g.fillStyle(color, .09).fillCircle(px + CELL / 2, py + CELL / 2, 23);
        g.lineStyle(2, color, .9).strokeCircle(px + CELL / 2, py + CELL / 2, 21);
        g.lineStyle(1, color, .4).strokeCircle(px + CELL / 2, py + CELL / 2, 26);
        this.label(px + CELL / 2, py + CELL / 2, tile, 18, pair === 0 ? '#bc9cff' : '#76e4f7');
      }
    }
    const goal = this.position(chamber.exit.x, chamber.exit.y);
    g.fillStyle(C.green, displayed.hasKey ? .18 : .04).fillRect(goal.x - 25, goal.y - 26, 50, 52);
    g.lineStyle(2, C.green, displayed.hasKey ? 1 : .5).strokeRect(goal.x - 22, goal.y - 23, 44, 46);
    this.label(goal.x, goal.y, 'OUT', 15, '#b2f199');
    if (!displayed.hasKey) {
      const key = this.position(chamber.key.x, chamber.key.y);
      g.lineStyle(3, C.amber).strokeCircle(key.x - 5, key.y - 5, 8);
      g.lineBetween(key.x + 1, key.y + 1, key.x + 12, key.y + 12);
      g.lineBetween(key.x + 12, key.y + 12, key.x + 17, key.y + 7);
      this.label(key.x, key.y + 23, 'KEY', 10, '#ffc857');
    }
    const check = this.position(props.checkpoint.x, props.checkpoint.y);
    g.lineStyle(1, C.amber, .4).strokeRect(check.x - 25, check.y - 25, 50, 50);
    for (let x = 0; x < chamber.width; x++) this.label(PAD + x * CELL + CELL / 2, PAD - 19, String(x).padStart(2, '0'), 11, '#63738c');
    for (let y = 0; y < chamber.height; y++) this.label(PAD - 20, PAD + y * CELL + CELL / 2, String(y).padStart(2, '0'), 11, '#63738c');
    const end = this.position(state.x, state.y);
    this.pawn = this.character(end.x, end.y);
    const movement = props.lastMove;
    if (!first && previous && movement && previous.lastMove !== movement &&
        canonicalState(previous.state) === canonicalState(movement.from) && !props.reducedMotion) {
      const result = transitionDetailed(chamber, movement.from, movement.direction);
      if (canonicalState(result.state) === canonicalState(state)) {
        const start = this.position(movement.from.x, movement.from.y); this.pawn.setPosition(start.x, start.y);
        this.animate(this.pawn, result.frames, props.reducedMotion, epoch);
      }
    }
    if (props.ghost) {
      this.pawn.setAlpha(.3);
      const ghost = this.position(props.ghost.x, props.ghost.y);
      this.ghostPawn = this.character(ghost.x, ghost.y, true);
      if (previous?.ghost && props.ghostFrames?.length && !props.reducedMotion) {
        const start = this.position(previous.ghost.x, previous.ghost.y); this.ghostPawn.setPosition(start.x, start.y);
        this.animate(this.ghostPawn, props.ghostFrames, props.reducedMotion, epoch);
      }
    }
  }
}

export default function Board(props: BoardProps): React.JSX.Element {
  const mount = useRef<HTMLDivElement>(null), latest = useRef(props), scene = useRef<ChamberScene | null>(null);
  const stateKey = canonicalState(props.state), checkpointKey = canonicalState(props.checkpoint), ghostKey = props.ghost ? canonicalState(props.ghost) : '';
  latest.current = props;
  useEffect(() => {
    if (!mount.current) return;
    const nextScene = new ChamberScene(() => latest.current); scene.current = nextScene;
    const game = new Phaser.Game({
      type: Phaser.CANVAS, parent: mount.current,
      width: props.chamber.width * CELL + PAD * 2, height: props.chamber.height * CELL + PAD * 2,
      transparent: true, scene: nextScene, audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: true }, banner: false,
    });
    game.canvas.setAttribute('aria-hidden', 'true');
    return () => { scene.current = null; game.destroy(true); };
  }, [props.chamber.id, props.chamber.width, props.chamber.height]);
  useEffect(() => { scene.current?.paint(latest.current); }, [props.chamber.id, props.chamber.version, stateKey, checkpointKey, ghostKey, props.reducedMotion]);
  return <div className="phaser-mount" ref={mount} style={{ aspectRatio: `${props.chamber.width * CELL + PAD * 2} / ${props.chamber.height * CELL + PAD * 2}` }} />;
}
