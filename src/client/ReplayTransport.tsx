import { useId, type JSX } from 'react';
import './replay-transport.css';

export interface ReplayTransportProps {
  index: number;
  length: number;
  playing: boolean;
  reducedMotion: boolean;
  speed: number;
  escaped: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: number) => void;
}

export default function ReplayTransport({
  index, length, playing, reducedMotion, speed, escaped,
  onTogglePlay, onStep, onReset, onSeek, onSpeedChange,
}: ReplayTransportProps): JSX.Element {
  const id = useId();
  const atEnd = index >= length;

  return <div className="replay-transport" role="group" aria-label="Witness replay controls">
    <div className="replay-readout">
      <label htmlFor={`${id}-step`}>WITNESS STEP</label>
      <p className="replay-counter">{index} / {length} moves · {escaped ? 'EXIT REACHED' : 'cyan ghost'}</p>
    </div>
    <input
      id={`${id}-step`}
      className="replay-seek"
      type="range"
      min={0}
      max={length}
      step={1}
      value={index}
      aria-label="Witness step"
      aria-valuetext={`Move ${index} of ${length}${escaped ? ', exit reached' : ''}`}
      onChange={event => onSeek(event.currentTarget.valueAsNumber)}
    />
    <div className="replay-actions">
      <button
        type="button"
        className={reducedMotion ? undefined : 'primary'}
        disabled={reducedMotion}
        data-replay-primary={reducedMotion ? undefined : ''}
        onClick={onTogglePlay}
      >
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {playing ? <><path d="M8 4v16M16 4v16" /></> : <path d="m8 4 12 8-12 8Z" />}
        </svg>
        {playing ? 'Pause replay' : 'Play witness'}
      </button>
      <button
        type="button"
        className={reducedMotion && !atEnd ? 'primary' : undefined}
        disabled={atEnd}
        data-replay-primary={reducedMotion && !atEnd ? '' : undefined}
        onClick={onStep}
      >Step →</button>
      <button
        type="button"
        className={`icon-button${reducedMotion && atEnd ? ' primary' : ''}`}
        aria-label="Reset replay"
        data-replay-primary={reducedMotion && atEnd ? '' : undefined}
        onClick={onReset}
      >
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9a8 8 0 1 1 0 7M4 3v6h6" /></svg>
      </button>
    </div>
    <div className="replay-options">
      <label htmlFor={`${id}-speed`}>Replay speed</label>
      <select
        id={`${id}-speed`}
        aria-label="Replay speed"
        value={speed}
        disabled={reducedMotion}
        onChange={event => onSpeedChange(Number(event.currentTarget.value))}
      >
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={2}>2×</option>
      </select>
      {reducedMotion && <span className="replay-motion-note">Manual steps only</span>}
    </div>
    <p className="replay-scope">Controls are local to this view. Your actual attempt is unchanged.{reducedMotion && ' Reduced motion is on; use Step or the slider.'}</p>
  </div>;
}
