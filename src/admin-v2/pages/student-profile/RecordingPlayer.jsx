import { useEffect, useRef } from 'react';
import { LuGauge, LuPause, LuPlay, LuRotateCcw, LuRotateCw, LuVideoOff } from 'react-icons/lu';
import { formatDuration } from '../../components/useNow';
import { ScreenFeed } from '../live-monitor/StudentTile';
import { alertInfo } from '../../utils/alerts';

const SPEEDS = [1, 2, 4, 8];
const TICK_MS = 250;

/**
 * Controlled recording player. In the mock phase it runs a simulated clock;
 * in the backend phase the same controls/markers drive a real <video src={recording_url}>.
 */
export default function RecordingPlayer({ duration, events, time, playing, speed, onTime, onPlaying, onSpeed }) {
  const trackRef = useRef(null);
  const timeRef = useRef(time);
  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  // Simulated playback clock
  useEffect(() => {
    if (!playing || !duration) return undefined;
    const id = setInterval(() => {
      const next = Math.min(duration, timeRef.current + (TICK_MS / 1000) * speed);
      onTime(next);
      if (next >= duration) onPlaying(false);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, duration, onTime, onPlaying]);

  if (!duration) {
    return (
      <div className="v2-player v2-player--empty">
        <LuVideoOff aria-hidden="true" />
        <p>No recording was saved for this attempt.</p>
      </div>
    );
  }

  const pct = (time / duration) * 100;
  const seek = (t) => onTime(Math.min(duration, Math.max(0, t)));
  const current = [...events].reverse().find((e) => e.offset_seconds <= time && time - e.offset_seconds < 6);

  const onTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  const onKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      onPlaying(!playing);
    } else if (e.key === 'ArrowRight') {
      seek(time + 10);
    } else if (e.key === 'ArrowLeft') {
      seek(time - 10);
    }
  };

  return (
    <div className="v2-player" tabIndex={0} onKeyDown={onKeyDown} aria-label="Screen recording player. Space to play or pause, arrows to skip 10 seconds.">
      <div className="v2-player__screen" onClick={() => onPlaying(!playing)}>
        <ScreenFeed large />
        <span className="v2-player__mock">Recording preview (mock)</span>
        {current && (
          <span key={current.id} className={`v2-player__event v2-player__event--${alertInfo(current.type).severity}`}>
            {alertInfo(current.type).label}
          </span>
        )}
        <span className={`v2-player__bigplay ${playing ? 'is-hidden' : ''}`} aria-hidden="true">
          <LuPlay />
        </span>
      </div>

      <div className="v2-player__timeline">
        <div ref={trackRef} className="v2-player__track" onClick={onTrackClick}>
          <span className="v2-player__progress" style={{ transform: `scaleX(${pct / 100})` }} />
          {events.map((e) => {
            const info = alertInfo(e.type);
            return (
              <button
                key={e.id}
                type="button"
                className={`v2-player__marker v2-player__marker--${info.severity}`}
                style={{ left: `${(e.offset_seconds / duration) * 100}%` }}
                title={`${formatDuration(e.offset_seconds)} · ${info.label}`}
                aria-label={`Jump to ${info.label} at ${formatDuration(e.offset_seconds)}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  seek(e.offset_seconds - 3);
                }}
              />
            );
          })}
          <span className="v2-player__head-rail" style={{ transform: `translateX(${pct}%)` }} aria-hidden="true">
            <span className="v2-player__head" />
          </span>
        </div>
      </div>

      <div className="v2-player__controls">
        <button type="button" className="v2-player__btn v2-player__btn--play" onClick={() => onPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <LuPause /> : <LuPlay />}
        </button>
        <button type="button" className="v2-player__btn" onClick={() => seek(time - 10)} aria-label="Back 10 seconds">
          <LuRotateCcw />
        </button>
        <button type="button" className="v2-player__btn" onClick={() => seek(time + 10)} aria-label="Forward 10 seconds">
          <LuRotateCw />
        </button>
        <span className="v2-player__time">
          {formatDuration(time)} / {formatDuration(duration)}
        </span>
        <button
          type="button"
          className="v2-player__speed"
          onClick={() => onSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          aria-label={`Playback speed ${speed}x`}
        >
          <LuGauge aria-hidden="true" /> {speed}x
        </button>
      </div>
    </div>
  );
}
