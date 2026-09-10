import { useMemo } from 'react';

import { useCourseShellText } from '@/i18n/courseShell';

import { questStars, type QuestState } from './questMode';
import { formatSimulatorStation } from './stationIds';

const LOCK_RING_RADIUS = 26;
const LOCK_RING_CIRCUMFERENCE = 2 * Math.PI * LOCK_RING_RADIUS;
const CONFETTI_PIECE_COUNT = 26;

function formatQuestClock(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Deterministic per-piece confetti styling so re-renders never reshuffle the animation. */
function confettiPieceStyle(index: number) {
  const leftPct = (index * 37 + 11) % 100;
  const delayMs = (index * 137) % 900;
  const durationMs = 2400 + ((index * 211) % 1400);
  const drift = ((index * 53) % 120) - 60;

  return {
    left: `${leftPct}%`,
    animationDelay: `${delayMs}ms`,
    animationDuration: `${durationMs}ms`,
    '--quest-confetti-drift': `${drift}px`,
  } as React.CSSProperties;
}

/**
 * Overlay chrome for Station Quest: countdown, the in-run status bar (target, score, streak,
 * clock), the lock-on ring while the target is being imaged, and the end-of-run scorecard.
 * Pure presentation — every transition is driven by the parent's quest state.
 */
export function QuestHud({
  bestScore,
  branchHint,
  countdown,
  detected,
  elapsedMs,
  hintActive,
  holdProgress,
  onDone,
  onHint,
  onQuit,
  onRestart,
  onSkip,
  state,
}: {
  bestScore: number | null;
  /** Branch name revealed with the hint (e.g. "RMS — 11Ri, 11Rs, 7"); null when unknown. */
  branchHint: string | null;
  /** 3 → 1 pre-run countdown; 0 renders as GO; null once the run is live. */
  countdown: number | null;
  detected: boolean;
  elapsedMs: number;
  hintActive: boolean;
  /** 0..1 progress of the capture hold while the target stays imaged. */
  holdProgress: number;
  onDone: () => void;
  onHint: () => void;
  onQuit: () => void;
  onRestart: () => void;
  onSkip: () => void;
  state: QuestState;
}) {
  const t = useCourseShellText();
  const confettiPieces = useMemo(
    () => Array.from({ length: CONFETTI_PIECE_COUNT }, (_, index) => confettiPieceStyle(index)),
    [],
  );

  if (state.status === 'complete') {
    const stars = questStars(state.score, state.targets.length);
    const captured = state.results.filter((result) => !result.skipped).length;
    const isNewBest = state.score > 0 && (bestScore === null || state.score > bestScore);

    return (
      <div className="simulator-quest-summary-backdrop" role="dialog" aria-label={t('Quest complete')}>
        <div className="simulator-quest-confetti" aria-hidden="true">
          {confettiPieces.map((style, index) => (
            <span key={index} style={style} />
          ))}
        </div>
        <section className="simulator-quest-summary">
          <span className="eyebrow">{t('Station quest complete')}</span>
          <div className="simulator-quest-summary__stars" aria-label={`${stars}/3`}>
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={star <= stars ? 'simulator-quest-star simulator-quest-star--lit' : 'simulator-quest-star'}
                style={{ animationDelay: `${star * 180}ms` }}
              >
                ★
              </span>
            ))}
          </div>
          <div className="simulator-quest-summary__score">
            {state.score.toLocaleString()} {t('pts')}
            {isNewBest ? <span className="simulator-quest-newbest">{t('New best!')}</span> : null}
          </div>
          <div className="simulator-quest-summary__meta">
            <span>
              {captured}/{state.targets.length} {t('found')}
            </span>
            <span>
              {t('Best streak')} ×{state.bestStreak}
            </span>
            <span>{formatQuestClock(elapsedMs)}</span>
            {bestScore !== null && !isNewBest ? (
              <span>
                {t('Best')} {bestScore.toLocaleString()}
              </span>
            ) : null}
          </div>
          <ul className="simulator-quest-summary__list">
            {state.results.map((result) => (
              <li key={result.stationKey}>
                <span>
                  {t('Station')} {formatSimulatorStation(result.station)}
                </span>
                <span>
                  {result.skipped
                    ? t('skipped')
                    : `${result.points.toLocaleString()} ${t('pts')}${result.usedHint ? ` · ${t('hint')}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="simulator-quest-summary__actions">
            <button className="simulator-button" onClick={onRestart} type="button">
              {t('Play again')}
            </button>
            <button className="simulator-button" onClick={onDone} type="button">
              {t('Done')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const target = state.targets[state.currentIndex] ?? null;

  return (
    <>
      {countdown !== null ? (
        <div className="simulator-quest-countdown" aria-hidden="true">
          <span key={countdown}>{countdown > 0 ? countdown : t('GO!')}</span>
        </div>
      ) : null}

      <div className="simulator-quest-hud" role="status" aria-label={t('Station quest')}>
        <div className="simulator-quest-hud__target">
          <span className="simulator-quest-hud__eyebrow">
            {t('Find')} {state.currentIndex + 1}/{state.targets.length}
          </span>
          <strong>{target ? `${t('Station')} ${formatSimulatorStation(target.station)}` : ''}</strong>
          {hintActive && branchHint ? <span className="simulator-quest-hud__branch">{branchHint}</span> : null}
        </div>
        <div className="simulator-quest-hud__stats">
          <span className="simulator-chip">{state.score.toLocaleString()} {t('pts')}</span>
          {state.streak > 1 ? (
            <span className="simulator-chip simulator-quest-hud__streak">×{state.streak}</span>
          ) : null}
          <span className="simulator-chip">{formatQuestClock(elapsedMs)}</span>
        </div>
        <div className="simulator-quest-hud__actions">
          <button
            aria-pressed={hintActive}
            className="simulator-sector-style-toggle"
            disabled={hintActive}
            onClick={onHint}
            title={t('Show a beacon at the target (costs points)')}
            type="button"
          >
            {t('Hint')}
          </button>
          <button className="simulator-sector-style-toggle" onClick={onSkip} type="button">
            {t('Skip')}
          </button>
          <button className="simulator-sector-style-toggle" onClick={onQuit} type="button">
            {t('End')}
          </button>
        </div>
      </div>

      {detected ? (
        <div className="simulator-quest-lock" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <circle className="simulator-quest-lock__track" cx="32" cy="32" r={LOCK_RING_RADIUS} />
            <circle
              className="simulator-quest-lock__fill"
              cx="32"
              cy="32"
              r={LOCK_RING_RADIUS}
              strokeDasharray={LOCK_RING_CIRCUMFERENCE}
              strokeDashoffset={LOCK_RING_CIRCUMFERENCE * (1 - holdProgress)}
            />
          </svg>
          <span>{t('Hold the image…')}</span>
        </div>
      ) : null}
    </>
  );
}
