import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CHAMBERS } from '../shared/chambers.js';
import { applyPatch, cloneState, initialState, replayWitness, solve, transition, transitionDetailed, type Chamber, type Direction, type GameState, type Patch } from '../shared/engine.js';
import type { PublicState } from '../shared/protocol.js';
import './landing.css';
import './landing-final.css';
import './landing-play.css';

const Board = lazy(() => import('./Board.js'));
type Verdict = { kind: 'ready' | 'accepted' | 'rejected' | 'incomplete'; title: string; detail: string };
type SandboxMode = 'witness' | 'play';
interface SandboxState { checkpoint: GameState; displayed: GameState; witness: Direction[]; explored: number; step: number; verdict: Verdict; mode: SandboxMode; moves: number; moveMessage: string; lastMove?: PublicState['lastMove'] }
interface DemoLaw { label: string; command: string; patch: Patch; acceptedTitle: string; icon: string; symbol?: string }
const chamberLaws: Record<string, DemoLaw> = {
  'vector-foundry': { label: 'Close wall A', command: '!patch walls A closed', patch: { kind: 'walls', group: 'A', closed: true }, acceptedTitle: 'Wall A closed. Escape survives.', icon: 'lp-gate-icon' },
  crosswire: { label: 'Cross portal pairs', command: '!patch portals crossed', patch: { kind: 'portals', value: 'crossed' }, acceptedTitle: 'Portals rewired. Escape survives.', icon: 'lp-demo-symbol', symbol: '◎' },
  'thin-ice': { label: 'Make ice slippery', command: '!patch ice on', patch: { kind: 'ice', value: true }, acceptedTitle: 'Ice enabled. Escape survives.', icon: 'lp-demo-symbol', symbol: '≈' },
};
const gravityLaw: DemoLaw = { label: 'Pull gravity down', command: '!patch gravity down', patch: { kind: 'gravity', value: 'down' }, acceptedTitle: 'Gravity changed. Escape survives.', icon: 'lp-gravity-icon', symbol: '↓' };
const directionKeys: Record<string, Direction> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left' };
const directionArrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };

function lawIsApplied(state: GameState, patch: Patch): boolean {
  switch (patch.kind) {
    case 'walls': return state.rules.walls[patch.group] === patch.closed;
    case 'gravity': return state.rules.gravity === patch.value;
    case 'portals': return state.rules.portals === patch.value;
    case 'ice': return state.rules.ice === patch.value;
  }
}
function currentChamber(state: SandboxState): Chamber { return CHAMBERS.find(item => item.id === state.checkpoint.chamberId)!; }

function freshSandbox(chamber: Chamber = CHAMBERS[0]!, mode: SandboxMode = 'witness'): SandboxState {
  const checkpoint = initialState(chamber);
  const proof = solve(chamber, checkpoint);
  const verified = proof.status === 'solved' && replayWitness(chamber, checkpoint, proof.witness).escaped;
  return {
    checkpoint, displayed: cloneState(checkpoint), witness: verified ? proof.witness : [], explored: proof.explored, step: 0, mode, moves: 0, moveMessage: 'Collect the key. Find the exit.',
    verdict: verified
      ? { kind: 'ready', title: 'The world is waiting.', detail: 'Choose a law. See what survives the check.' }
      : { kind: 'incomplete', title: 'Verification incomplete.', detail: 'Reset the sandbox to try the check again.' },
  };
}

function Arrow({ diagonal = false }: { diagonal?: boolean }): React.JSX.Element {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

function MiniChamber({ tiles }: { tiles: readonly string[] }): React.JSX.Element {
  return <div className="lp-mini-map" style={{ gridTemplateColumns: `repeat(${tiles[0]!.length}, 1fr)` }} aria-hidden="true">{tiles.flatMap((row, y) => [...row].map((tile, x) => <i key={`${x}:${y}`} className={tile === '#' ? 'mini-wall' : tile === '~' ? 'mini-ice' : /[0-3]/.test(tile) ? 'mini-portal' : tile === 'S' ? 'mini-player' : tile === 'E' ? 'mini-exit' : tile === 'A' || tile === 'B' ? 'mini-gate' : ''} />))}</div>;
}

export default function Landing(): React.JSX.Element {
  const [sandbox, setSandbox] = useState(() => freshSandbox());
  const chamber = currentChamber(sandbox);
  const chamberIndex = CHAMBERS.findIndex(item => item.id === chamber.id);
  const nextChamber = CHAMBERS[(chamberIndex + 1) % CHAMBERS.length]!;
  const playArea = useRef<HTMLElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReducedMotion(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  useEffect(() => { if (sandbox.mode === 'play') playArea.current?.focus(); }, [sandbox.mode, sandbox.checkpoint]);

  const tryLaw = (law: DemoLaw) => setSandbox(current => {
    try {
      const chamber = currentChamber(current);
      // This isolated demo uses the same engine as the room. Never mutate the
      // current checkpoint until a found witness replays to an unlocked exit.
      const candidate = applyPatch(chamber, current.checkpoint, law.patch);
      const proof = solve(chamber, candidate);
      if (proof.status === 'incomplete') return { ...current, verdict: { kind: 'incomplete', title: 'Verification incomplete.', detail: 'This law stays out. The current world is unchanged.' } };
      if (proof.status !== 'solved') return { ...current, verdict: { kind: 'rejected', title: 'Lockout rejected.', detail: 'Gravity down leaves no escape from this checkpoint. Your world stays unchanged.' } };
      if (!replayWitness(chamber, candidate, proof.witness).escaped) return { ...current, verdict: { kind: 'incomplete', title: 'Witness check failed.', detail: 'This law stays out. Reset the sandbox to try again.' } };
      return { checkpoint: candidate, displayed: cloneState(candidate), witness: proof.witness, explored: proof.explored, step: 0, mode: current.mode, moves: 0, moveMessage: 'New law, fresh attempt. Collect the key.', verdict: { kind: 'accepted', title: law.acceptedTitle, detail: `${proof.witness.length} moves still lead to the exit. ${current.mode === 'play' ? 'Your attempt restarts from the checked position.' : 'Step through the checked route.'}` } };
    } catch (cause) {
      return { ...current, verdict: { kind: 'rejected', title: 'Law not applied.', detail: cause instanceof Error ? cause.message : 'Reset the sandbox to try again.' } };
    }
  });
  const stepWitness = () => setSandbox(current => {
    if (current.mode !== 'witness') return current;
    const direction = current.witness[current.step];
    return direction ? { ...current, displayed: transition(currentChamber(current), current.displayed, direction), step: current.step + 1, lastMove: { gameRevision: current.step + 1, from: current.displayed, direction } } : current;
  });
  const changeMode = (mode: SandboxMode) => setSandbox(current => current.mode === mode ? current : { ...current, mode, displayed: cloneState(current.checkpoint), step: 0, moves: 0, moveMessage: 'Collect the key. Find the exit.', lastMove: undefined });
  const beginDemo = () => {
    changeMode('play');
    if (sandbox.mode === 'play') playArea.current?.focus();
  };
  const selectChamber = (item: Chamber) => {
    if (item.id === chamber.id) beginDemo();
    else setSandbox(freshSandbox(item, 'play'));
  };
  const move = (direction: Direction) => setSandbox(current => {
    if (current.mode !== 'play' || current.displayed.escaped) return current;
    const result = transitionDetailed(currentChamber(current), current.displayed, direction);
    if (!result.frames.length) return { ...current, moveMessage: 'Wall ahead. Try another direction.' };
    return { ...current, displayed: result.state, moves: current.moves + 1, lastMove: { gameRevision: current.moves + 1, from: current.displayed, direction }, moveMessage: result.state.escaped ? 'You found the exit. Your world still had a way out.' : result.state.hasKey ? 'Key collected. Head for OUT.' : 'Find the key, then head for OUT.' };
  });
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (sandbox.mode !== 'play' || sandbox.displayed.escaped || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target !== event.currentTarget) return;
    const direction = directionKeys[event.key];
    if (direction) { event.preventDefault(); move(direction); }
  };
  const restartAttempt = () => setSandbox(current => ({ ...current, displayed: cloneState(current.checkpoint), moves: 0, lastMove: undefined, moveMessage: 'Back at the checked position. Try another route.' }));
  const keyText = sandbox.displayed.hasKey ? 'KEY ACQUIRED' : 'KEY REQUIRED';

  return <div className="landing-page">
    <a className="lp-skip" href="#sandbox">Skip to the interactive sandbox</a>
    <header className="lp-header">
      <a className="lp-wordmark" href="/" aria-label="World Patch home">WORLD<span>//</span>PATCH<span className="lp-wordmark-corner" aria-hidden="true" /></a>
      <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#chambers">The chambers</a><a className="lp-nav-cta" href="/play">Enter the chamber <Arrow diagonal /></a></nav>
    </header>

    <main>
      <section className="lp-hero" aria-labelledby="lp-title">
        <div className="lp-hero-copy">
          <p className="lp-kicker"><span /> A PUZZLE WORLD FOR YOUR TWITCH CHAT</p>
          <h1 id="lp-title">Chat changes<br />the rules.<br /><em>You find<br />the exit.</em></h1>
          <p className="lp-introduction">Let your Twitch chat reshape the chamber. Collect the key, find the exit, and outplay the world they made.</p>
          <div className="lp-hero-actions"><button type="button" className="lp-button lp-button-primary" onClick={beginDemo} aria-controls="lp-demo-board">Play the demo <Arrow /></button><a className="lp-text-action" href="/play">Host a chamber <span aria-hidden="true">↗</span></a></div>
          <p className="lp-availability">No sign-in for the demo. Host controls and live Twitch require setup.</p>
          <div className="lp-hero-footnote"><span className="lp-edit-seam" aria-hidden="true">//</span><p>Make it difficult.<br /><strong>Leave a way out.</strong></p><span className="lp-footnote-line" /></div>
        </div>

        <section className="lp-sandbox" id="sandbox" aria-labelledby="sandbox-title" tabIndex={-1}>
          <div className="lp-sandbox-top"><span className="lp-sandbox-label"><i /> LOCAL SANDBOX</span><span className="lp-sandbox-index">EXP. {String(chamberIndex + 1).padStart(3, '0')}</span></div>
          <div className="lp-sandbox-heading"><div><p className="lp-kicker">CHANGE A LAW. TEST THE CONSEQUENCE.</p><h2 id="sandbox-title">Try to break the world.</h2></div><span className="lp-target-mark" aria-hidden="true">+</span></div>
          <div className="lp-law-choices" aria-label="Try a world law">
            {[chamberLaws[chamber.id]!, gravityLaw].map(law => <button key={law.command} className="lp-law-choice" disabled={lawIsApplied(sandbox.checkpoint, law.patch)} onClick={() => tryLaw(law)}><span><i className={law.icon} aria-hidden="true">{law.symbol}</i>{law.label}</span><code>{law.command}</code><Arrow /></button>)}
          </div>
          <div className={`lp-sandbox-verdict lp-verdict-${sandbox.verdict.kind}`} role="status"><span className="lp-verdict-icon" aria-hidden="true">{sandbox.verdict.kind === 'rejected' ? '×' : sandbox.verdict.kind === 'accepted' ? '✓' : '+'}</span><div><strong>{sandbox.verdict.title}</strong><p>{sandbox.verdict.detail}</p></div></div>
          <div className="lp-chamber-window" aria-label={`Local ${chamber.name} chamber`}>
            <div className="lp-window-meta"><span>{String(chamberIndex + 1).padStart(2, '0')} / {chamber.name.toUpperCase()}</span><span>{keyText}</span></div>
            <section className="lp-sandbox-board" id="lp-demo-board" ref={playArea} tabIndex={sandbox.mode === 'play' ? 0 : -1} aria-label="Playable sandbox board" aria-describedby={sandbox.mode === 'play' ? 'lp-play-help' : undefined} onKeyDown={keyboard} onPointerDown={event => { if (sandbox.mode === 'play') event.currentTarget.focus(); }}><Suspense fallback={<div className="lp-board-loading">Preparing the local chamber…</div>}><Board chamber={chamber} state={sandbox.displayed} checkpoint={sandbox.checkpoint} lastMove={sandbox.lastMove} reducedMotion={reducedMotion} /></Suspense></section>
            <div className="lp-window-status"><span className="lp-sandbox-position">POS {String(sandbox.displayed.x).padStart(2, '0')}.{String(sandbox.displayed.y).padStart(2, '0')}</span><span className={sandbox.displayed.escaped ? 'lp-exit-reached' : ''}>{sandbox.displayed.escaped ? 'EXIT REACHED' : '◆ YOU  ·  K KEY  ·  OUT EXIT'}</span></div>
          </div>
          <div className="lp-sandbox-laws" aria-label="Sandbox laws"><span>GRAVITY <strong>{sandbox.checkpoint.rules.gravity === 'off' ? 'Off' : sandbox.checkpoint.rules.gravity}</strong></span><span>WALL A <strong>{sandbox.checkpoint.rules.walls.A ? 'Closed' : 'Open'}</strong></span><span>FLOOR <strong>{sandbox.checkpoint.rules.ice ? 'Slippery' : 'Stable'}</strong></span><span>PORTALS <strong>{chamber.portals.length ? sandbox.checkpoint.rules.portals === 'crossed' ? 'Crossed' : 'Normal' : 'None'}</strong></span></div>
          <div className="lp-play-modes" role="group" aria-label="Sandbox experience"><button aria-pressed={sandbox.mode === 'witness'} onClick={() => changeMode('witness')}>See checked route</button><button aria-pressed={sandbox.mode === 'play'} onClick={() => changeMode('play')}>Try the escape <span aria-hidden="true">↗</span></button></div>
          {sandbox.mode === 'play' && <div className="lp-play-panel">
            <div className="lp-play-controls"><div><p id="lp-play-help">Focus the board. Use arrows or WASD, or the buttons.</p><p>Collect K, then reach OUT. New laws restart the attempt.</p></div><div className="lp-play-dpad" role="group" aria-label="Sandbox movement">{(['up', 'left', 'down', 'right'] as Direction[]).map(direction => <button className={`lp-move-${direction}`} key={direction} aria-label={`Sandbox move ${direction}`} onClick={() => move(direction)} disabled={sandbox.displayed.escaped}>{directionArrows[direction]}</button>)}</div></div>
            <p className={sandbox.displayed.escaped ? 'sr-only' : 'lp-attempt-feedback'} role="status" aria-label="Escape attempt">{sandbox.moveMessage}</p>
            {sandbox.displayed.escaped && <section className="lp-completion" aria-labelledby="lp-completion-title"><p className="lp-kicker">KEY COLLECTED · EXIT REACHED</p><h3 id="lp-completion-title">You found a way through.</h3><p>{chamber.name}, escaped in {sandbox.moves} {sandbox.moves === 1 ? 'move' : 'moves'}. Ready for a different kind of trouble?</p><div><button onClick={() => selectChamber(nextChamber)}>Next: {nextChamber.name} <Arrow /></button><a href="/play">Host a chamber <Arrow diagonal /></a></div></section>}
            <details className="lp-text-map"><summary>Text map &amp; legend</summary><p>@ = you, K = key, E = exit, # = wall, ~ = ice. A is {sandbox.displayed.rules.walls.A ? 'closed' : 'open'}; B is {sandbox.displayed.rules.walls.B ? 'closed' : 'open'}.{chamber.portals.length > 0 && ` Portals: ${sandbox.displayed.rules.portals === 'crossed' ? '0↔3 / 1↔2' : '0↔1 / 2↔3'}.`}</p><pre aria-label="Sandbox text map">{chamber.tiles.map((row, y) => [...row].map((cell, x) => x === sandbox.displayed.x && y === sandbox.displayed.y ? '@' : (cell === 'K' && sandbox.displayed.hasKey) || cell === 'S' ? '.' : cell).join(' ')).join('\n')}</pre></details>
          </div>}
          <div className="lp-witness-row"><div><span className="lp-witness-label">{sandbox.mode === 'play' ? 'YOUR ATTEMPT' : 'CHECKED ESCAPE'}</span><strong className="lp-sandbox-counter">{sandbox.mode === 'play' ? sandbox.moves : sandbox.step} <span>{sandbox.mode === 'play' ? sandbox.moves === 1 ? 'move' : 'moves' : `/ ${sandbox.witness.length} moves`}</span></strong></div><div className="lp-witness-actions">{sandbox.mode === 'play' ? <button onClick={restartAttempt}>Restart attempt <span aria-hidden="true">↺</span></button> : <button onClick={stepWitness} disabled={sandbox.step >= sandbox.witness.length || !sandbox.witness.length}>Step through escape <span aria-hidden="true">→</span></button>}<button className="lp-reset" onClick={() => setSandbox(freshSandbox(chamber))} aria-label="Reset sandbox">↺</button></div></div>
          <p className="lp-sandbox-disclosure">A real engine check in your browser. Separate from the room; no chat, votes, or session changes.</p>
          <p className="sr-only" aria-live="polite">Sandbox player at column {sandbox.displayed.x}, row {sandbox.displayed.y}. Key {sandbox.displayed.hasKey ? 'acquired' : 'not yet collected'}. {sandbox.displayed.escaped ? 'Exit reached.' : ''} {sandbox.mode === 'play' ? `${sandbox.moves} attempt moves.` : `${sandbox.step} of ${sandbox.witness.length} checked moves.`}</p>
        </section>
      </section>

      <section className="lp-loop" id="how-it-works" aria-labelledby="lp-loop-title">
        <div className="lp-section-heading"><p className="lp-kicker">THE FEEDBACK LOOP</p><h2 id="lp-loop-title">A little sabotage.<br /><span>A way through.</span></h2><p>Chat sets the challenge. You take the risk.<br />The escape check keeps the deal honest.</p></div>
        <div className="lp-loop-steps">
          <article><span className="lp-step-number">01</span><div className="lp-step-glyph lp-propose-glyph" aria-hidden="true">!patch<span>_</span></div><h3>Rewrite one law.</h3><p>Change gravity, pair the portals, make ice slippery, or close a gate. Each proposal is checked from the frozen world.</p><code>!patch gravity right</code></article>
          <article><span className="lp-step-number">02</span><div className="lp-step-glyph lp-vote-glyph" aria-hidden="true"><i /><i /><i /></div><h3>Choose the trouble.</h3><p>Only laws with a checked escape reach the ballot. One viewer, one vote. The winning law reshapes the chamber.</p><code>!vote 1</code></article>
          <article><span className="lp-step-number">03</span><div className="lp-step-glyph lp-escape-glyph" aria-hidden="true"><span>◆</span><i />OUT</div><h3>Find your way out.</h3><p>Collect the key. Reach the exit. Reveal the stored route after the attempt and see the way the world left open.</p><span className="lp-step-foot">YOUR MOVES. YOUR MOMENT.</span></article>
        </div>
      </section>

      <section className="lp-chambers" id="chambers" aria-labelledby="lp-chambers-title">
        <div className="lp-section-heading"><p className="lp-kicker">THREE AUTHORED CHAMBERS</p><h2 id="lp-chambers-title">Same mission.<br /><span>Different consequences.</span></h2><p>Choose a chamber and try it here.<br />Each begins with a checked escape.</p></div>
        <div className="lp-chamber-cards" role="group" aria-label="Choose a demo chamber">{CHAMBERS.map((item, index) => <article key={item.id} data-selected={item.id === chamber.id}><div className="lp-chamber-card-top"><span>CHAMBER {String(index + 1).padStart(2, '0')}</span><span className="lp-chamber-state">{item.id === chamber.id ? 'IN THE DEMO' : 'READY TO PLAY'}</span></div><MiniChamber tiles={item.tiles} /><h3>{item.name}</h3><p>{index === 0 ? 'A direct crossing. A gate chat can close. Find the longer way around.' : index === 1 ? 'Four portals. Two pairings. One connection changes the whole route.' : 'Slippery floors and gates that become brakes. Every move has momentum.'}</p><button className="lp-chamber-play" aria-pressed={item.id === chamber.id} onClick={() => selectChamber(item)}>Play {item.name} <Arrow /></button></article>)}</div>
      </section>

      <section className="lp-laws-section" aria-labelledby="lp-laws-title"><div><p className="lp-kicker">SMALL COMMANDS. REAL CONSEQUENCES.</p><h2 id="lp-laws-title">Four laws.<br /><span>A world to rewrite.</span></h2><p>Chat changes bounded rules, never arbitrary code. A patch has to leave an escape from its checkpoint before it can enter the vote.</p></div><div className="lp-law-details">
        <details><summary><span><b className="lp-law-symbol" aria-hidden="true">↓</b>Gravity</span><i aria-hidden="true">+</i></summary><p>One cell of drift after a legal move. Change the direction, change where a move ends.</p><code>!patch gravity up|down|left|right|off</code></details>
        <details><summary><span><b className="lp-law-symbol lp-cyan" aria-hidden="true">≈</b>Ice</span><i aria-hidden="true">+</i></summary><p>Make designated ice tiles slippery or walkable. Slides stop at a wall or stable floor.</p><code>!patch ice on|off</code></details>
        <details><summary><span><b className="lp-law-symbol lp-violet" aria-hidden="true">◎</b>Portals</span><i aria-hidden="true">+</i></summary><p>Rewire four endpoints. Normal pairs 0↔1 / 2↔3. Crossed pairs 0↔3 / 1↔2.</p><code>!patch portals normal|crossed</code></details>
        <details><summary><span><b className="lp-law-symbol" aria-hidden="true">▥</b>Walls</span><i aria-hidden="true">+</i></summary><p>Open or close authored wall groups A and B. A wall can never close on the player.</p><code>!patch walls A|B open|closed</code></details>
      </div></section>

      <section className="lp-final-cta" aria-labelledby="lp-cta-title"><div className="lp-final-coordinate" aria-hidden="true">END OF BRIEF / START OF ATTEMPT</div><p className="lp-kicker">THE WORLD IS WAITING</p><h2 id="lp-cta-title">Hand chat the laws.<br /><em>Keep your nerve.</em></h2><button type="button" className="lp-button lp-button-primary" onClick={beginDemo} aria-controls="lp-demo-board">Play the demo <Arrow /></button><p>No sign-in for the demo.<br />Host controls and live Twitch require setup.</p><a className="lp-host-link" href="/play">Host a chamber <Arrow diagonal /></a><a className="lp-spectator-link" href="/overlay">Open the read-only broadcast view <Arrow diagonal /></a></section>
    </main>
    <footer className="lp-footer"><a className="lp-wordmark" href="/">WORLD<span>//</span>PATCH</a><span>CHAT WRITES THE LAWS. YOU FIND THE EXIT.</span><span>BUILT WITH CODEX</span></footer>
  </div>;
}
