import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { z } from 'zod';
import { CHAMBERS } from '../shared/chambers.js';
import { patchLabel } from '../shared/commands.js';
import { cloneState, transitionDetailed, type Direction, type MovementFrame } from '../shared/engine.js';
import type { HostAction, ModerationState } from '../shared/protocol.js';
import { configSchema, request, stateSchema, type Config, type State } from './api.js';
import ReplayTransport from './ReplayTransport.js';

const Board = lazy(() => import('./Board.js'));
const arrows: Record<Direction | 'off', string> = { up: '↑', right: '→', down: '↓', left: '←', off: '·' };
const phaseNames = { play: 'Escape the chamber', proposing: 'Proposals open', voting: 'Vote on the next law', paused: 'Round paused', revealed: 'The escape, revealed' };
const moderationSchema = z.object({ actors: z.array(z.object({ actorId: z.string().max(128), blocked: z.boolean() })).max(5000) });
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const oauthWaitingNotice = 'Twitch authorization received. Waiting for the chat subscription.';
function suggestedPatch(state: State): string {
  if (state.chamber.id === 'crosswire') return `!patch portals ${state.game.rules.portals === 'normal' ? 'crossed' : 'normal'}`;
  if (state.chamber.id === 'thin-ice') return `!patch ice ${state.game.rules.ice ? 'off' : 'on'}`;
  return `!patch walls A ${state.game.rules.walls.A ? 'open' : 'closed'}`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const changed = () => setReduced(query.matches); query.addEventListener('change', changed); return () => query.removeEventListener('change', changed); }, []);
  return reduced;
}
function Icon({ name, className = '' }: { name: 'shield' | 'arrow' | 'key' | 'reset' | 'play' | 'pause' | 'external' | 'link'; className?: string }): React.JSX.Element {
  const paths = {
    shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    key: <><circle cx="8" cy="8" r="5"/><path d="m12 12 8 8m-4-4 3-3"/></>,
    reset: <><path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/></>,
    play: <path d="m8 4 12 8-12 8Z"/>, pause: <><path d="M8 4v16M16 4v16"/></>,
    external: <><path d="M14 3h7v7m0-7-11 11M10 3H3v18h18v-7"/></>,
    link: <><path d="m10 7 2-2a5 5 0 0 1 7 7l-3 3m-2 2-2 2a5 5 0 0 1-7-7l3-3m0 7 8-8"/></>,
  };
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function App(): React.JSX.Element {
  const overlay = window.location.pathname.replace(/\/$/, '') === '/overlay';
  const [state, setState] = useState<State | null>(null), [config, setConfig] = useState<Config | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [simulationFeedback, setSimulationFeedback] = useState('');
  const [pending, setPending] = useState(false), busy = useRef(false);
  const [roundFocusRequest, setRoundFocusRequest] = useState<{ trigger: HTMLButtonElement; target: 'primary' | 'replay' } | null>(null);
  const [loginFocus, setLoginFocus] = useState(false), chamberSelect = useRef<HTMLSelectElement>(null);
  const [draftChamber, setDraftChamber] = useState<string | null>(null);
  const configRequestVersion = useRef(0), streamedSnapshotVersion = useRef(0);
  const [secret, setSecret] = useState(''), [actor, setActor] = useState('broadcaster'), [command, setCommand] = useState('!patch walls A closed');
  const [moderation, setModeration] = useState<ModerationState>({ actors: [] });
  const [clock, setClock] = useState(Date.now()), offset = useRef(0);
  const [replayIndex, setReplayIndex] = useState(0), [playing, setPlaying] = useState(false), [showGhost, setShowGhost] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1), [animateReplayStep, setAnimateReplayStep] = useState(false);
  const commandContext = useRef<{ sessionId: string; phase: State['phase'] } | null>(null);
  const [mergedReceipt, setMergedReceipt] = useState<State['receipt'] | null>(null);
  const previousReceipt = useRef<{ sessionId: string; id: string } | null>(null);
  const reducedMotion = useReducedMotion();
  const acceptState = useCallback((value: unknown) => {
    const parsed = stateSchema.safeParse(value);
    if (!parsed.success) throw new Error('The room sent an unsupported snapshot. Refresh after updating the server.');
    offset.current = parsed.data.serverTime - Date.now();
    setState(current => current?.sessionId === parsed.data.sessionId && current.revision > parsed.data.revision ? current : parsed.data);
  }, []);
  const refreshConfig = useCallback(async () => {
    const version = ++configRequestVersion.current;
    try {
      const configuration = configSchema.parse(await request('/api/config'));
      if (version !== configRequestVersion.current) return false;
      setConfig(configuration); return true;
    } catch (cause) { if (version === configRequestVersion.current) setError(errorMessage(cause)); return false; }
  }, []);

  useEffect(() => {
    let alive = true, socket: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined, attempts = 0;
    let streamHasSnapshot = false;
    const configVersion = ++configRequestVersion.current;
    void Promise.all([request('/api/state'), request('/api/config')]).then(([snapshot, configuration]) => {
      if (!alive) return;
      // A delayed bootstrap response must not replace a newer streamed session.
      if (!streamHasSnapshot) acceptState(snapshot);
      // A newer login/logout refresh owns the current authentication state.
      if (configVersion === configRequestVersion.current) setConfig(configSchema.parse(configuration));
    }).catch(cause => { if (alive) setError(errorMessage(cause)); });
    const connect = () => {
      if (!alive) return;
      setConnection(attempts ? 'disconnected' : 'connecting');
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
      socket.onopen = () => { if (alive) { attempts = 0; setConnection('connected'); } };
      socket.onmessage = event => { if (!alive) return; try { if (typeof event.data !== 'string' || event.data.length > 1_000_000) throw new Error('Room snapshot exceeded its limit.'); acceptState(JSON.parse(event.data)); streamHasSnapshot = true; streamedSnapshotVersion.current++; } catch (cause) { setError(errorMessage(cause)); } };
      socket.onclose = () => { if (!alive) return; setConnection('disconnected'); retry = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempts++)); };
      socket.onerror = () => socket?.close();
    };
    connect();
    const result = new URLSearchParams(location.search).get('oauth');
    if (result === 'connected') setNotice(oauthWaitingNotice);
    if (result === 'denied' || result === 'failed') setError('Twitch authorization did not complete. Use Connect Twitch to try again.');
    if (result) history.replaceState(null, '', overlay ? '/overlay' : '/play');
    return () => { alive = false; clearTimeout(retry); socket?.close(); };
  }, [acceptState]);
  useEffect(() => {
    if (!state?.deadline) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [state?.deadline]);
  useEffect(() => {
    setDraftChamber(null);
  }, [state?.sessionId]);
  useEffect(() => {
    const previous = commandContext.current;
    commandContext.current = state ? { sessionId: state.sessionId, phase: state.phase } : null;
    if (!state || state.origin !== 'simulation') return;
    setSimulationFeedback('');
    setCommand(current => {
      if (previous?.sessionId !== state.sessionId) return state.phase === 'voting' ? `!vote ${state.candidates[0]?.id ?? 1}` : suggestedPatch(state);
      if (state.phase === 'voting' && /^\s*!patch\b/.test(current)) return `!vote ${state.candidates[0]?.id ?? 1}`;
      if (state.phase === 'proposing' && /^\s*!vote\b/.test(current)) return suggestedPatch(state);
      return current;
    });
    // Only entry into a phase selects a suggestion; snapshots never replace edits.
  }, [state?.sessionId, state?.phase, state?.origin]);

  useEffect(() => {
    const previous = previousReceipt.current;
    previousReceipt.current = state ? { sessionId: state.sessionId, id: state.receipt.id } : null;
    // Clear canceled feedback before classifying the next receipt. Unrelated snapshots
    // do not restart this effect, and changing sessions cannot leave a stale timer/class.
    setMergedReceipt(null);
    if (!state || state.phase !== 'play' || !state.receipt.patch || !previous ||
      previous.sessionId !== state.sessionId || previous.id === state.receipt.id) return;
    setMergedReceipt(state.receipt);
    const timeout = setTimeout(() => setMergedReceipt(null), 900);
    return () => clearTimeout(timeout);
  }, [state?.sessionId, state?.receipt.id, state?.phase]);
  useEffect(() => {
    setReplayIndex(0);
    setAnimateReplayStep(false);
    const revealOnBroadcast = overlay && state?.phase === 'revealed';
    setShowGhost(state?.phase === 'revealed');
    setPlaying(revealOnBroadcast && !reducedMotion);
  }, [state?.receipt.id, state?.phase, overlay]);
  useEffect(() => { if (reducedMotion) setPlaying(false); }, [reducedMotion]);

  const replay = useMemo(() => {
    if (!state?.receipt.start || !state.receipt.witness) return null;
    let current = cloneState(state.receipt.start);
    const states = [current], frames: MovementFrame[][] = [[]];
    for (const direction of state.receipt.witness) { const result = transitionDetailed(state.chamber, current, direction); current = result.state; states.push(current); frames.push(result.frames); }
    return { states, frames, witness: state.receipt.witness };
  }, [state?.sessionId, state?.receipt.digest, state?.phase, state?.chamber.id, state?.chamber.version]);
  useEffect(() => {
    if (!playing || !replay || reducedMotion) return;
    if (replayIndex >= replay.witness.length) { setPlaying(false); return; }
    const duration = Math.max(550, (replay.frames[replayIndex + 1]?.length ?? 1) * 140 + 150) / replaySpeed;
    const timeout = setTimeout(() => { setAnimateReplayStep(true); setReplayIndex(index => index + 1); }, duration);
    return () => clearTimeout(timeout);
  }, [playing, replay, replayIndex, reducedMotion, replaySpeed]);

  const mutate = useCallback(async (path: string, body: unknown): Promise<Record<string, unknown> | null> => {
    if (busy.current) return null;
    busy.current = true; setPending(true); setError('');
    const streamVersion = streamedSnapshotVersion.current;
    try {
      const response = await request(path, body);
      // Stream snapshots received during this request supersede its HTTP snapshot.
      if (response.state && streamVersion === streamedSnapshotVersion.current) acceptState(response.state);
      return response;
    } catch (cause) { setError(errorMessage(cause)); if (errorMessage(cause).includes('Sign in')) void refreshConfig(); return null; }
    finally { busy.current = false; setPending(false); }
  }, [acceptState, refreshConfig]);
  useEffect(() => {
    if (!roundFocusRequest || pending) return;
    setRoundFocusRequest(null);
    // Wait for React to commit the enabled controls. Disabling the old button
    // can blur it before the phase changes; preserve any focus chosen meanwhile.
    if (document.activeElement === document.body) {
      const trigger = roundFocusRequest.trigger;
      const target = roundFocusRequest.target === 'replay'
        ? document.querySelector<HTMLButtonElement>('[data-replay-primary]')
        : trigger.isConnected && !trigger.disabled ? trigger : document.querySelector<HTMLButtonElement>('.primary-control-row button.primary:not(:disabled)');
      target?.focus();
    }
  }, [roundFocusRequest, pending]);
  useEffect(() => {
    if (!loginFocus || pending || !config?.authenticated) return;
    setLoginFocus(false);
    if (document.activeElement === document.body) chamberSelect.current?.focus();
  }, [loginFocus, pending, config?.authenticated]);
  const act = useCallback(async (action: HostAction) => {
    const trigger = document.activeElement;
    const fromRoundControls = trigger instanceof HTMLButtonElement && (!!trigger.closest('.primary-control-row') || action.type === 'reveal');
    const result = await mutate('/api/action', action);
    if (result?.code === 'NO_CHANGE' && typeof result.message === 'string') setNotice(result.message);
    if (result && fromRoundControls) setRoundFocusRequest({ trigger, target: action.type === 'reveal' ? 'replay' : 'primary' });
    return result;
  }, [mutate]);
  const login = async (event: FormEvent) => { event.preventDefault(); if (await mutate('/api/login', { secret })) { setSecret(''); if (await refreshConfig()) { setNotice(''); setLoginFocus(true); } } };
  const simulate = async (event?: FormEvent, text = command) => { event?.preventDefault(); setSimulationFeedback(''); const result = await mutate('/api/simulate', { actor, text }); if (result && typeof result.message === 'string') setSimulationFeedback(result.message); };
  const loadModeration = async () => { try { setModeration(moderationSchema.parse(await request('/api/host'))); } catch (cause) { setError(errorMessage(cause)); } };
  const connectTwitch = async () => { const result = await mutate('/api/twitch/connect', {}); if (typeof result?.url === 'string') { const url = new URL(result.url); if (url.origin === 'https://id.twitch.tv' && url.pathname === '/oauth2/authorize') location.assign(url.href); else setError('The Twitch authorization address was rejected.'); } };
  const downloadReplay = async () => {
    try {
      const data = await request('/api/replay'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `world-patch-${state?.sessionId ?? 'replay'}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const authenticated = !!config?.authenticated && !overlay;
  const enabled = authenticated && !pending && connection === 'connected';
  const movable = enabled && state?.phase === 'play' && !state.game.escaped;
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!movable || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target !== event.currentTarget) return;
    const keys: Record<string, Direction> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left' };
    const direction = keys[event.key]; if (direction) { event.preventDefault(); void act({ type: 'move', direction }); }
  };
  const frozen = state && ['proposing', 'voting', 'paused'].includes(state.phase);
  const seconds = state ? Math.ceil(Math.max(0, state.deadline ? state.deadline - (clock + offset.current) : state.remainingMs ?? 0) / 1000) : 0;
  const totalVotes = state?.candidates.reduce((sum, candidate) => sum + candidate.votes, 0) ?? 0;
  const chamberNumber = Math.max(1, CHAMBERS.findIndex(chamber => chamber.id === state?.chamber.id) + 1);
  const ghost = showGhost && replay ? replay.states[replayIndex] ?? null : null;
  const displayed = ghost ?? state?.game;
  const mergeFlash = mergedReceipt !== null;
  const changedLaw = mergedReceipt?.patch?.kind;
  const latest = state?.history.at(-1);
  const visibleNotice = notice === oauthWaitingNotice && state?.twitch.state === 'ready' ? state.origin === 'twitch' ? 'Twitch chat is ready for this session.' : 'Twitch chat is ready. Start a fresh Twitch session to use live input.' : notice;
  const hostGuidance = connection !== 'connected' ? 'Controls pause until the room reconnects.' : state?.phase === 'paused' ? 'The clock and audience input are paused.' : state?.phase === 'proposing' ? 'Invite a law. Close proposals when the ballot is ready.' : state?.phase === 'voting' ? 'Choose the next law. Close the vote to apply its result.' : state?.phase === 'revealed' ? 'Inspect the checked route, export it, then continue.' : state?.game.escaped ? 'Exit reached. Reveal the checked escape to compare routes.' : state?.origin === 'twitch' && state.twitch.state !== 'ready' ? 'Connect Twitch before opening an audience round.' : 'Collect the key and reach OUT, or invite a new law.';

  return <div className={`app-shell ${overlay ? 'overlay' : ''} ${(state?.candidates.length ?? 0) > 2 ? 'dense-ballot' : ''} phase-${state?.phase ?? 'loading'}`}>
    {!overlay && <a className="skip-link" href="#play-region">Skip to the chamber</a>}
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="World Patch home"><span className="brand-mark" aria-hidden="true">W<span>//</span>P</span><span>WORLD<span className="slash">//</span>PATCH</span></a>
      <div className="header-status">
        <span className={`mode-badge ${state?.origin === 'twitch' ? 'live' : ''}`}><span className="status-dot" />{state?.origin === 'twitch' ? 'TWITCH SESSION' : 'SIMULATION'}</span>
        <span className={`server-status ${connection === 'connected' ? 'online' : ''}`}><span className="status-dot" />{connection === 'connected' ? 'Room connected' : connection === 'connecting' ? 'Connecting to room' : 'Room reconnecting'}</span>
        <span className={`header-twitch ${state?.twitch.state === 'ready' ? 'ready' : ''}`}>Twitch {state?.twitch.state === 'disabled' ? 'not configured' : state?.twitch.state ?? 'connecting'}</span>
        {!overlay && <a className="text-link overlay-link" href="/overlay" target="_blank" rel="noreferrer">OBS view <Icon name="external" /></a>}
      </div>
    </header>

    <main>
      <section className="intro">
        <div><p className="eyebrow">A COLLECTIVE ACT OF SABOTAGE. WITH AN ESCAPE CLAUSE.</p><h1>Chat changes the rules.<br/><span>You find the exit.</span></h1></div>
        <div className="promise"><Icon name="shield" /><p>Make it difficult.<br/><strong>Leave a way out.</strong><small>Every merged patch has a verified escape from its checkpoint.</small></p></div>
      </section>
      {error && <div role="alert" className="alert error"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {visibleNotice && !overlay && <div className="notice" role="status"><span>{visibleNotice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}>×</button></div>}
      {state && !overlay && connection !== 'connected' && <div className="room-outage" role="status"><div><strong>Reconnecting to the room</strong><p>Controls are paused. The displayed world may be out of date; reconnection is automatic.</p></div><button onClick={() => location.reload()}>Reload room</button></div>}
      {state && !overlay && !authenticated && <section className="host-access" aria-label="Host access"><div className="host-login"><div><p className="eyebrow">HOST ACCESS</p><h2>Take the controls.</h2><p>Unlock this room with the host secret from your local setup.</p><a href="/">Try the no-login demo <Icon name="arrow"/></a></div><form onSubmit={event => void login(event)}><label htmlFor="host-secret">Host secret</label><div className="input-action"><input id="host-secret" type="password" autoComplete="current-password" value={secret} onChange={event => setSecret(event.target.value)} placeholder="Enter your local host secret" required maxLength={512}/><button className="primary" disabled={pending || !secret}>Unlock controls <Icon name="arrow"/></button></div></form></div></section>}
      {!state ? <section className="loading-room"><div className="brand-mark" aria-hidden="true">W//P</div><h2>Establishing the chamber</h2><p>Connecting to the authoritative room. If this takes longer than a moment, check that the server is running.</p><button onClick={() => location.reload()}>Retry connection</button></section> : <>
        {authenticated && <section className="primary-control-row" aria-label="Round controls"><div className="host-actions"><div className="host-copy"><p className="eyebrow">YOU ARE THE HOST · {state.origin === 'simulation' ? 'LOCAL SIMULATION' : 'TWITCH SESSION'}</p><span>{hostGuidance}</span>{state.origin === 'simulation' && ['proposing','voting'].includes(state.phase) && <a className="phase-jump" href="#simulation-panel">{state.phase === 'proposing' ? 'Send a test proposal' : 'Cast a test ballot'} <Icon name="arrow"/></a>}</div><div className="host-chamber-picker"><label htmlFor="host-chamber">Start a new chamber</label><div><select id="host-chamber" ref={chamberSelect} value={draftChamber ?? state.chamber.id} disabled={!enabled || !!frozen} onChange={event => setDraftChamber(event.target.value)}>{CHAMBERS.map((chamber,index)=><option key={chamber.id} value={chamber.id}>{String(index+1).padStart(2,'0')} · {chamber.name}</option>)}</select><button disabled={!enabled || !!frozen || !draftChamber || draftChamber === state.chamber.id} onClick={() => void act({type:'selectChamber',chamberId:draftChamber ?? state.chamber.id}).then(result=>{if(result)setDraftChamber(null);})}>Start</button></div><p>Starts a fresh attempt. Reveal and export first to keep its replay.</p></div><div className="action-cluster">
              {state.phase === 'play' && <><button className="primary" disabled={!enabled || (!state.game.escaped && state.origin === 'twitch' && state.twitch.state !== 'ready')} onClick={() => void act(state.game.escaped ? {type:'reveal'} : { type: 'startRound' })}>{state.game.escaped ? 'Reveal escape witness' : 'Open patch round'} <Icon name="arrow"/></button><button disabled={!enabled} onClick={() => void act({ type: 'reset' })}><Icon name="reset"/>Reset checkpoint</button>{!state.game.escaped && <button disabled={!enabled} onClick={() => void act({ type: 'reveal' })}>End attempt &amp; reveal</button>}</>}
              {(state.phase === 'proposing' || state.phase === 'voting') && <><button className="primary" disabled={!enabled} onClick={() => void act({ type: 'closeWindow' })}>{state.phase === 'proposing' ? 'Close proposals → vote' : 'Close vote & merge'} <Icon name="arrow"/></button><button disabled={!enabled} onClick={() => void act({ type: 'pause' })}><Icon name="pause"/>Pause round</button></>}
              {state.phase === 'paused' && <button className="primary" disabled={!enabled} onClick={() => void act({ type: 'resume' })}><Icon name="play"/>Resume round</button>}
              {frozen && <button disabled={!enabled} onClick={() => void act({ type: 'cancel' })}>Cancel round</button>}
              {state.phase === 'revealed' && <><button className="primary" disabled={!enabled} onClick={() => void act({ type: 'selectChamber', chamberId: CHAMBERS[chamberNumber % CHAMBERS.length]!.id })}>Next chamber <Icon name="arrow"/></button><button disabled={!enabled} onClick={() => void act({ type: 'selectChamber', chamberId: state.chamber.id })}>Replay this chamber</button><button onClick={() => void downloadReplay()}>Export replay evidence</button></>}
            </div></div></section>}
        <div className="game-layout">
          <section className={`world-panel ${mergeFlash ? 'merge-flash' : ''}`} aria-labelledby="chamber-title" data-merge-receipt={mergedReceipt?.id}>
            <div className="world-heading"><div><p className="eyebrow">CHAMBER {String(chamberNumber).padStart(2, '0')} <span>/ 03</span></p><h2 id="chamber-title">{state.chamber.name}</h2></div><div className={`chamber-coordinate ${mergeFlash ? 'merge-confirmation' : ''}`}><span>{mergeFlash ? 'PATCH MERGED' : `ROUND ${String(state.round).padStart(2, '0')}`}</span><strong>{mergedReceipt?.patch ? patchLabel(mergedReceipt.patch) : ghost ? 'WITNESS REPLAY' : state.game.escaped ? 'ESCAPED' : frozen ? 'WORLD FROZEN' : 'FIND KEY → EXIT'}</strong></div></div>
            <div className="board-frame">
              <div className="board-topline"><span className={displayed?.hasKey ? 'key-found' : ''}><Icon name="key" />{displayed?.hasKey ? 'KEY ACQUIRED' : 'KEY REQUIRED'}</span><span>{ghost ? `REPLAY ${replayIndex}/${replay?.witness.length} · POS ${ghost.x}.${ghost.y}` : `POS ${String(state.game.x).padStart(2, '0')}.${String(state.game.y).padStart(2, '0')}`}</span></div>
              <section id="play-region" className="play-region" tabIndex={overlay ? -1 : 0} aria-label="Puzzle play area" aria-describedby={overlay ? 'board-description' : 'board-description controls-help'} onKeyDown={keyboard}>
                <Suspense fallback={<div className="board-loading">Preparing the chamber…</div>}><Board chamber={state.chamber} state={state.game} checkpoint={state.checkpoint} lastMove={state.lastMove} reducedMotion={reducedMotion} ghost={ghost} ghostFrames={animateReplayStep && showGhost && replay ? replay.frames[replayIndex] : undefined} /></Suspense>
                {frozen && <div className="freeze-label"><span className="status-dot" />WORLD FROZEN · {state.phase === 'paused' ? 'ROUND PAUSED' : 'CHAT IS REWRITING'}</div>}
                {state.game.escaped && !showGhost && <div className="escape-label"><Icon name="shield" /><strong>ESCAPE CONFIRMED</strong><span>The world changed. You found a way.</span>{authenticated && state.phase === 'play' && <button disabled={!enabled} onClick={() => void act({type:'reveal'})}>Inspect the escape <Icon name="arrow"/></button>}</div>}
              </section>
              <div className="board-legend"><span><i className="legend-player" />YOU</span><span><i className="legend-key" />KEY</span><span><i className="legend-exit" />EXIT</span><span><i className="legend-ice" />ICE</span>{state.chamber.portals.length > 0 && <span><i className="legend-portal" />PORTAL</span>}</div>
            </div>
            <p id="board-description" className="sr-only" aria-live={!overlay && !playing ? 'polite' : 'off'}>{ghost ? 'Replay ghost' : 'Player'} at column {displayed?.x}, row {displayed?.y}. Key {displayed?.hasKey ? 'acquired' : `at column ${state.chamber.key.x}, row ${state.chamber.key.y}`}. Exit at column {state.chamber.exit.x}, row {state.chamber.exit.y}. Gravity {state.game.rules.gravity}. Ice {state.game.rules.ice ? 'slippery' : 'walkable'}. {phaseNames[state.phase]}.</p>
            <div className="laws-strip" aria-label="Current world laws">
              <div className={changedLaw === 'gravity' ? 'law-change' : ''} data-law="gravity"><span>GRAVITY</span><strong><b>{arrows[state.game.rules.gravity]}</b>{state.game.rules.gravity === 'off' ? 'Off' : state.game.rules.gravity}</strong></div>
              <div className={changedLaw === 'ice' ? 'law-change' : ''} data-law="ice"><span>FLOOR</span><strong><b className="cyan">≈</b>{state.game.rules.ice ? 'Slippery' : 'Stable'}</strong></div>
              <div className={changedLaw === 'portals' ? 'law-change' : ''} data-law="portals"><span>PORTALS</span><strong className="portal-pairs" title={state.game.rules.portals === 'normal' ? 'Normal pairing' : 'Crossed pairing'}><b className="violet">⌘</b>{state.chamber.portals.length ? (state.game.rules.portals === 'normal' ? '0↔1 / 2↔3' : '0↔3 / 1↔2') : 'None'}</strong></div>
              <div className={changedLaw === 'walls' ? 'law-change' : ''} data-law="walls"><span>WALLS</span><strong className="walls-rule">A <em>{state.game.rules.walls.A ? 'closed' : 'open'}</em> B <em>{state.game.rules.walls.B ? 'closed' : 'open'}</em></strong></div>
            </div>
            {!overlay && <div className="play-dock"><div><p id="controls-help"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><span>or WASD · focus the board</span></p><span className="muted">{connection !== 'connected' ? 'Waiting for the room to reconnect.' : frozen ? 'Movement resumes when the round resolves.' : !authenticated ? 'Unlock host controls above to move.' : state.phase === 'revealed' ? 'The cyan ghost follows the stored route. Your attempt is unchanged.' : state.game.escaped ? 'Exit reached. Inspect the checked escape next.' : 'Collect the key, then reach the green exit.'}</span></div><div className="dpad" aria-label="Movement controls">{(['up', 'left', 'down', 'right'] as Direction[]).map(direction => <button key={direction} className={`dpad-${direction}`} aria-label={`Move ${direction}`} disabled={!movable} onClick={() => void act({ type: 'move', direction })}>{arrows[direction]}</button>)}</div></div>}
          </section>

          <aside className="patch-desk" aria-labelledby="patch-heading">
            <div className="phase-heading"><div><p className="eyebrow">THE PATCH DESK</p><h2 id="patch-heading"><span className="phase-copy" key={`${state.sessionId}:${state.phase}`}>{phaseNames[state.phase]}</span></h2></div>{frozen && <div className="countdown" aria-label={`${seconds} seconds remaining`}>{String(seconds).padStart(2, '0')}<small>SEC</small></div>}</div>
            <div className="phase-track" aria-label={`Current phase: ${state.phase}`}><span className={state.phase === 'proposing' ? 'current' : ''}>01 PROPOSE</span><i/><span className={state.phase === 'voting' ? 'current' : ''}>02 VOTE</span><i/><span className={['play', 'revealed'].includes(state.phase) ? 'current' : ''}>03 ESCAPE</span></div>
            {state.phase === 'revealed' ? <div className="replay-card"><div className="receipt-symbol"><Icon name="shield" /></div><p className="eyebrow">THE WORLD KEPT ITS PROMISE</p><h3>{state.receipt.pathLength} moves to freedom.</h3><p>Play the stored escape from the exact checkpoint that was verified.</p>{replay && <ReplayTransport index={replayIndex} length={replay.witness.length} playing={playing} reducedMotion={reducedMotion} speed={replaySpeed} escaped={!!replay.states[replayIndex]?.escaped} onTogglePlay={() => { setShowGhost(true); if (replayIndex >= replay.witness.length) { setAnimateReplayStep(false); setReplayIndex(0); } setPlaying(!playing); }} onStep={() => { setPlaying(false); setShowGhost(true); setAnimateReplayStep(true); setReplayIndex(index => Math.min(index + 1, replay.witness.length)); }} onReset={() => { setPlaying(false); setShowGhost(true); setAnimateReplayStep(false); setReplayIndex(0); }} onSeek={index => { if (!Number.isFinite(index)) return; setPlaying(false); setShowGhost(true); setAnimateReplayStep(false); setReplayIndex(Math.max(0, Math.min(replay.witness.length, Math.round(index)))); }} onSpeedChange={speed => { if ([0.5,1,2].includes(speed)) setReplaySpeed(speed); }} />}</div> : <>
              <p className="phase-description">{connection !== 'connected' ? 'Room reconnecting. This ballot may be out of date.' : state.phase === 'proposing' ? <>Propose with <code>!patch …</code>. Every candidate needs a checked escape.</> : state.phase === 'voting' ? <>Vote with <code>!vote {'<number>'}</code>. Your latest ballot counts.</> : state.phase === 'paused' ? 'The clock and audience input are paused. The world and votes are preserved.' : state.game.escaped ? 'Exit reached. Reveal the checked route to see the way the world left open.' : 'Find the key, then OUT. Chat votes when the host opens a round.'}</p>
              <div className="candidates" aria-label="Patch candidates">
                {state.candidates.length ? state.candidates.map(candidate => <article className="candidate" key={candidate.id}><div className="candidate-top"><span className="candidate-number">{String(candidate.id).padStart(2, '0')}</span><span className="verified-small"><Icon name="shield"/>ESCAPE VERIFIED</span>{authenticated && frozen && <button className="remove-candidate" aria-label={`Remove candidate ${candidate.id}`} disabled={!enabled} onClick={() => void act({ type: 'removeCandidate', candidateId: candidate.id })}>×</button>}</div><h3>{candidate.label}</h3><div className="candidate-bottom"><code>!vote {candidate.id}</code><span><strong>{candidate.votes}</strong> {candidate.votes === 1 ? 'vote' : 'votes'}</span></div><div className="vote-track"><span style={{ width: totalVotes ? `${candidate.votes / totalVotes * 100}%` : '0%' }} /></div></article>) : <div className="empty-candidates"><span className="empty-cross" aria-hidden="true">+</span><h3>{state.phase === 'proposing' ? 'A world waiting for your patch.' : 'Your audience is the architect.'}</h3><p>{state.phase === 'proposing' ? 'Send one of the commands below. Every proposal starts with a solvability check.' : 'Open a patch round to invite new laws. With an empty audience, the chamber stays playable.'}</p><span className="empty-count">0 PROPOSALS · 0 VOTES</span></div>}
              </div>
              {state.lastRejection && <div className="rejection" role="status"><span>PATCH NOT ACCEPTED</span><p>{state.lastRejection.message}</p></div>}
              <div className="chat-cheatsheet"><p className="eyebrow">TYPE A LAW IN CHAT</p><code>!patch gravity right</code><code>!patch walls A closed</code>{state.chamber.tiles.some(row => row.includes('~')) && <code>!patch ice on</code>}{state.chamber.portals.length > 0 && <code>!patch portals crossed</code>}</div>
              {state.phase === 'voting' && <p className="muted vote-note">{totalVotes} {totalVotes === 1 ? 'ballot' : 'ballots'} · Ties use canonical patch order. Zero votes means no merge.</p>}
            </>}
            <div className="fairness-receipt"><div className="receipt-heading"><Icon name="shield"/><span>FAIRNESS RECEIPT</span><b>STORED</b></div><p>{state.receipt.patch ? patchLabel(state.receipt.patch) : 'Original chamber checkpoint'}</p><div className="receipt-stats"><span><strong>{state.receipt.pathLength}</strong> moves to escape</span><span><strong>{state.receipt.explored}</strong> states searched</span></div><div className="receipt-foot"><code>{state.receipt.digest.slice(0, 12)}</code><span>{state.origin === 'twitch' ? 'TWITCH' : 'SIMULATED'} · REV {state.receipt.revision}</span></div></div>
          </aside>
        </div>

        {!overlay && authenticated && <section className="control-section" aria-label="Host controls">
            <div className="host-panels">
              {state.origin === 'simulation' && <section className="simulation-panel" id="simulation-panel" tabIndex={-1} aria-labelledby="simulation-title"><div className="panel-title"><h3 id="simulation-title">Try the audience side</h3><span className="mode-badge">SIMULATION</span></div><p>Send a local command through the real checks. {state.phase === 'voting' ? 'Choose a candidate below, then send your ballot.' : 'The suggested command is checked when you send it.'} Nothing is posted to Twitch.</p><form onSubmit={event => void simulate(event)}><div className="sim-fields"><label>Simulated viewer<input value={actor} onChange={event => setActor(event.target.value)} maxLength={32} pattern="[A-Za-z0-9_-]+" required/></label><label>Chat command<input value={command} onChange={event => setCommand(event.target.value)} maxLength={200} required spellCheck={false}/></label></div><div className="simulation-submit"><span>{state.phase === 'proposing' ? 'One accepted proposal per viewer · wait 2s between commands' : state.phase === 'voting' ? 'One ballot per viewer · wait 2s after your last command' : state.phase === 'paused' ? 'Resume the round before sending audience input.' : 'Open a patch round before sending a command.'}</span><button className="primary" disabled={!enabled || !['proposing', 'voting'].includes(state.phase)}>Send test command <Icon name="arrow"/></button></div></form>{simulationFeedback && <p className="simulation-feedback" role="status">{simulationFeedback}</p>}<div className="preset-row"><span>FILL COMMAND</span>{state.phase === 'voting' ? state.candidates.map(candidate=><button key={candidate.id} onClick={()=>setCommand(`!vote ${candidate.id}`)}>Vote {candidate.id}</button>) : <><button onClick={() => setCommand(suggestedPatch(state))}>Suggested law</button><button onClick={() => setCommand('!patch gravity down')}>Try a lockout</button></>}</div></section>}
              <section className="session-panel"><div className="panel-title"><h3>Session setup</h3><span className={`twitch-state ${state.twitch.state === 'ready' ? 'ready' : ''}`}>● Twitch {state.twitch.state === 'disabled' ? 'not configured' : state.twitch.state}</span></div><p className="session-source">Current source: <strong>{state.origin === 'simulation' ? 'Local simulation' : 'Twitch chat'}</strong></p><p className="session-warning">Changing source starts a fresh session. Reveal and export first if you need this attempt's replay.</p><div className="session-switch"><button disabled={!enabled || !!frozen || state.origin === 'simulation'} onClick={() => void act({ type: 'newSession', origin: 'simulation' })}>New simulation</button><button disabled={!enabled || !!frozen || state.twitch.state !== 'ready' || state.origin === 'twitch'} onClick={() => void act({ type: 'newSession', origin: 'twitch' })}>New Twitch session</button></div><details className="setup-details"><summary><Icon name="link"/>Twitch connection & setup</summary><div>{!config?.twitchConfigured ? <p>Add <code>{config?.missingTwitchVariables.join(', ')}</code> to the server environment and restart. Register the redirect URI shown in the local setup guide.</p> : <p>{state.twitch.channel ? `Connected account: ${state.twitch.channel}. ` : ''}Authorize your own account to receive chat. No separate bot account is needed.</p>}<p className="muted">{state.twitch.reason ?? 'Only a subscribed connection is marked ready.'}</p><p className="muted">{state.twitch.received} real chat events received{state.twitch.lastEventAt ? ` · latest ${new Date(state.twitch.lastEventAt).toLocaleTimeString()}` : ''}.</p><div className="action-cluster"><button disabled={!enabled || !config?.twitchConfigured || ['ready', 'connecting'].includes(state.twitch.state)} onClick={() => void connectTwitch()}>Connect Twitch</button><button disabled={!enabled || ['disabled', 'disconnected'].includes(state.twitch.state)} onClick={() => void mutate('/api/twitch/disconnect', {})}>Disconnect</button></div></div></details></section>
            </div>
        </section>}

        <section className="evidence-strip"><div className="event-line"><span className="event-marker"/><span className="eyebrow">LATEST EVENT</span><p>{latest?.message ?? 'Chamber ready. The first law is yours to write.'}</p></div><div className="evidence-details">
          <details><summary>How this world works</summary><div><p>Move one cell. Slippery ice carries you forward. Portals redirect your route. Gravity drifts you one cell after each legal move. Find the key before entering OUT.</p><p>Chat can change one bounded law at a time. An escape witness is checked from the frozen checkpoint before a patch merges. A later move can still trap you; reset returns to that checkpoint.</p>{state.chamber.portals.length > 0 && <p>Portal pairs: {state.game.rules.portals === 'normal' ? '0 ↔ 1 and 2 ↔ 3' : '0 ↔ 3 and 1 ↔ 2'}.</p>}<p className="muted">A witness proves an escape in this deterministic model. It does not measure human difficulty.</p></div></details>
          <details><summary>Receipt & event history</summary><div className="receipt-details"><dl><dt>Engine</dt><dd>{state.engineVersion}</dd><dt>Snapshot digest</dt><dd>{state.receipt.afterDigest}</dd><dt>Receipt digest</dt><dd>{state.receipt.digest}</dd><dt>Source</dt><dd>{state.origin}</dd></dl>{state.receipt.tally.length > 0 && <div className="final-tally"><p>Final ballot · votes descending, then canonical patch key.</p><ol>{state.receipt.tally.map(item => <li key={item.candidateId}><code>#{item.candidateId} {item.key}</code><strong>{item.votes} {item.votes === 1 ? 'vote' : 'votes'}</strong></li>)}</ol></div>}<ol className="history-list">{state.history.slice(-10).reverse().map((item, index) => <li key={`${item.at}-${index}`}><time>{new Date(item.at).toLocaleTimeString()}</time><span>{item.message}</span></li>)}</ol></div></details>
          {!overlay && <details><summary>Accessible text map</summary><div><p>S = start, K = key, E = exit, # = wall, ~ = ice, A/B = editable walls, 0–3 = portals. {ghost ? 'Replay ghost' : 'Current player'}: column {displayed?.x}, row {displayed?.y}. Key {displayed?.hasKey ? 'collected' : 'not yet collected'}.</p><pre className="text-map">{state.chamber.tiles.map((row, y) => [...row].map((cell, x) => x === displayed?.x && y === displayed?.y ? '@' : cell === 'K' && displayed?.hasKey ? '.' : cell).join(' ')).join('\n')}</pre></div></details>}
          {authenticated && <details onToggle={event => { if (event.currentTarget.open) void loadModeration(); }}><summary>Participant moderation</summary><div><p>Blocking removes that participant's input for this session.</p><button onClick={() => void loadModeration()}>Refresh participants</button>{moderation.actors.length ? <ul className="moderation-list">{moderation.actors.map(participant => <li key={participant.actorId}><code>{participant.actorId}</code><button disabled={!enabled || participant.blocked} onClick={() => void act({ type: 'blockActor', actorId: participant.actorId }).then(loadModeration)}>{participant.blocked ? 'Blocked' : 'Block'}</button></li>)}</ul> : <p className="muted">No participants have proposed or voted yet.</p>}</div></details>}
        </div></section>
        <div className="sr-only" aria-live="polite">{mergedReceipt?.patch ? `Patch merged: ${patchLabel(mergedReceipt.patch)}. Verified escape from checkpoint: ${mergedReceipt.pathLength} moves.` : ''} {state.game.escaped ? 'You escaped.' : ''} {phaseNames[state.phase]}</div>
      </>}
    </main>
    <footer><span>WORLD//PATCH <span className="footer-divider">/</span> BUILT WITH CODEX</span><span>{overlay ? 'SPECTATOR VIEW · READ ONLY' : 'CHAT WRITES THE LAWS. THE PROOF KEEPS THEM FAIR.'}</span>{authenticated && <button className="text-link" onClick={() => void mutate('/api/logout', {}).then(refreshConfig)}>Lock controls</button>}</footer>
  </div>;
}
