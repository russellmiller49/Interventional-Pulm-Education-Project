import { useEffect, useRef, type ReactNode } from 'react';

import { EUS_DEPTH_RANGE_MM } from './eusAcoustic';
import {
  FLEX_MAX_DEG,
  FLEX_MIN_DEG,
  insertionDepthCm,
  ROLL_MAX_DEG,
  ROLL_MIN_DEG,
} from './eusPose';
import type { EusCaseManifest, EusScopePath, EusScopeState } from './types';
import { eusLevelAt, type EusScopeChange } from './useEusScopeSession';
import './eus-b-simulator.css';

/** The movements and image settings an operator has. */
export type EusScopeControl = 'advance' | 'rotate' | 'flex' | 'depth' | 'gain';

export const EUS_GAIN_RANGE_DB: [number, number] = [-15, 15];

/** A button that steps once on click and keeps stepping while it is held. */
export function HoldButton({
  label,
  onStep,
  disabled,
  children,
}: {
  label: string;
  onStep: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const step = useRef(onStep);
  step.current = onStep;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  return (
    <button
      type="button"
      className="eus-step-button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) return;
        step.current();
        stop();
        timer.current = setInterval(() => step.current(), 70);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // Keyboard activation arrives as a click with no pointer; pointer clicks already stepped.
      onClick={(event) => {
        if (event.detail === 0) step.current();
      }}
    >
      {children}
    </button>
  );
}

/**
 * The scope movement a key asks for, or null when the key is not a driving key or its control is
 * not offered. Arrows advance, withdraw and rotate; brackets angle the tip; Shift takes larger
 * steps.
 */
export function scopeKeyChange(
  key: string,
  shiftKey: boolean,
  allowed: readonly EusScopeControl[],
): { control: EusScopeControl; change: EusScopeChange } | null {
  const big = shiftKey;
  const actions: Record<string, { control: EusScopeControl; change: EusScopeChange }> = {
    ArrowUp: { control: 'advance', change: (c) => ({ sMm: c.sMm + (big ? 10 : 2) }) },
    ArrowDown: { control: 'advance', change: (c) => ({ sMm: c.sMm - (big ? 10 : 2) }) },
    ArrowRight: { control: 'rotate', change: (c) => ({ rollDeg: c.rollDeg + (big ? 15 : 3) }) },
    ArrowLeft: { control: 'rotate', change: (c) => ({ rollDeg: c.rollDeg - (big ? 15 : 3) }) },
    ']': { control: 'flex', change: (c) => ({ flexDeg: c.flexDeg + 3 }) },
    '[': { control: 'flex', change: (c) => ({ flexDeg: c.flexDeg - 3 }) },
  };
  const action = Object.prototype.hasOwnProperty.call(actions, key) ? actions[key] : null;
  return action && allowed.includes(action.control) ? action : null;
}

/** Which driving keys are live for a set of controls, as one sentence, or null for none. */
export function scopeKeyHelp(allowed: readonly EusScopeControl[]): string | null {
  const parts = [
    allowed.includes('advance') && '↑ ↓ to advance or withdraw',
    allowed.includes('rotate') && '← → to rotate',
    allowed.includes('flex') && '[ ] to angle the tip',
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `Keyboard: click the image, then use ${parts.join(', ')}. Hold Shift for larger steps.`;
}

interface EusScopeControlsProps {
  /** Controls that are offered. One that is not listed is not drawn at all. */
  allowed: readonly EusScopeControl[];
  manifest: EusCaseManifest;
  path: EusScopePath;
  scope: EusScopeState;
  depthMm: number;
  gainDb: number;
  onMove: (control: EusScopeControl, change: EusScopeChange) => void;
  onDepthMm: (depthMm: number) => void;
  onGainDb: (gainDb: number) => void;
  /** Every control is shown but none responds. */
  disabled?: boolean;
  /**
   * Withhold the map of the path under the advance slider and the name of the region. Both tell a
   * learner who is searching where they are.
   */
  hideLevels?: boolean;
}

/** The scope's controls: advance or withdraw, rotate the shaft, angle the tip, depth and gain. */
export function EusScopeControls({
  allowed,
  manifest,
  path,
  scope,
  depthMm,
  gainDb,
  onMove,
  onDepthMm,
  onGainDb,
  disabled = false,
  hideLevels = false,
}: EusScopeControlsProps) {
  const has = (control: EusScopeControl) => allowed.includes(control);
  const level = eusLevelAt(manifest, scope.sMm);
  const cm = insertionDepthCm(scope.sMm, manifest.path.incisorOffsetMm).toFixed(0);
  return (
    <>
      {has('advance') && (
        <div className="eus-control" data-eus-control="advance">
          <div className="eus-control__head">
            <span className="eus-control__name">Advance / withdraw</span>
            <span className="eus-control__value">
              ≈ {cm} cm{hideLevels ? '' : ` · ${scope.sMm >= path.gejSMm ? 'stomach' : 'esophagus'}`}
            </span>
          </div>
          <div className="eus-control__row">
            <HoldButton
              label="Withdraw the scope"
              disabled={disabled}
              onStep={() => onMove('advance', (c) => ({ sMm: c.sMm - 1 }))}
            >
              Withdraw
            </HoldButton>
            <div className="eus-track">
              <input
                aria-label="Advance or withdraw: distance along the esophagus, in millimetres"
                type="range"
                min={0}
                max={Math.round(path.totalLengthMm)}
                step={1}
                value={Math.round(scope.sMm)}
                disabled={disabled}
                onChange={(event) => onMove('advance', { sMm: Number(event.target.value) })}
              />
              {!hideLevels && (
                <div className="eus-ruler" aria-hidden="true">
                  {manifest.path.levels.map((entry) => (
                    <span
                      key={entry.key}
                      className={`eus-ruler__level${entry.key === level.key ? ' is-current' : ''}`}
                      style={{
                        left: `${(entry.fromSMm / path.totalLengthMm) * 100}%`,
                        width: `${((entry.toSMm - entry.fromSMm) / path.totalLengthMm) * 100}%`,
                      }}
                      title={entry.label}
                    />
                  ))}
                  <span
                    className="eus-ruler__tick eus-ruler__tick--junction"
                    style={{ left: `${(path.gejSMm / path.totalLengthMm) * 100}%` }}
                  >
                    GEJ
                  </span>
                </div>
              )}
            </div>
            <HoldButton
              label="Advance the scope"
              disabled={disabled}
              onStep={() => onMove('advance', (c) => ({ sMm: c.sMm + 1 }))}
            >
              Advance
            </HoldButton>
          </div>
        </div>
      )}
      {has('rotate') && (
        <div className="eus-control" data-eus-control="rotate">
          <div className="eus-control__head">
            <span className="eus-control__name">Rotate the shaft</span>
            <span className="eus-control__value">
              {Math.round(scope.rollDeg) === 0
                ? '0°'
                : `${Math.abs(Math.round(scope.rollDeg))}° ${scope.rollDeg > 0 ? 'clockwise' : 'counterclockwise'}`}
            </span>
          </div>
          <div className="eus-control__row">
            <HoldButton
              label="Rotate counterclockwise"
              disabled={disabled}
              onStep={() => onMove('rotate', (c) => ({ rollDeg: c.rollDeg - 2 }))}
            >
              ⟲
            </HoldButton>
            <input
              aria-label="Rotate the shaft: degrees, clockwise positive"
              type="range"
              min={ROLL_MIN_DEG}
              max={ROLL_MAX_DEG}
              step={1}
              value={Math.round(scope.rollDeg)}
              disabled={disabled}
              onChange={(event) => onMove('rotate', { rollDeg: Number(event.target.value) })}
            />
            <HoldButton
              label="Rotate clockwise"
              disabled={disabled}
              onStep={() => onMove('rotate', (c) => ({ rollDeg: c.rollDeg + 2 }))}
            >
              ⟳
            </HoldButton>
          </div>
        </div>
      )}
      {has('flex') && (
        <div className="eus-control" data-eus-control="flex">
          <div className="eus-control__head">
            <span className="eus-control__name">Angle the tip</span>
            <span className="eus-control__value">
              {Math.round(scope.flexDeg) === 0
                ? 'Neutral'
                : `${Math.abs(Math.round(scope.flexDeg))}° ${scope.flexDeg > 0 ? 'up' : 'down'}`}
            </span>
          </div>
          <div className="eus-control__row">
            <input
              aria-label="Angle the tip: degrees, up positive"
              type="range"
              min={FLEX_MIN_DEG}
              max={FLEX_MAX_DEG}
              step={1}
              value={Math.round(scope.flexDeg)}
              disabled={disabled}
              onChange={(event) => onMove('flex', { flexDeg: Number(event.target.value) })}
            />
            <button
              type="button"
              className="eus-step-button"
              disabled={disabled}
              onClick={() => onMove('flex', { flexDeg: 0 })}
            >
              Neutral
            </button>
          </div>
        </div>
      )}
      {has('depth') && (
        <div className="eus-control" data-eus-control="depth">
          <div className="eus-control__head">
            <span className="eus-control__name">Depth</span>
            <span className="eus-control__value">{depthMm} mm</span>
          </div>
          <div className="eus-control__row">
            <input
              aria-label="Depth of the ultrasound image, in millimetres"
              type="range"
              min={EUS_DEPTH_RANGE_MM[0]}
              max={EUS_DEPTH_RANGE_MM[1]}
              step={5}
              value={depthMm}
              disabled={disabled}
              onChange={(event) => onDepthMm(Number(event.target.value))}
            />
          </div>
        </div>
      )}
      {has('gain') && (
        <div className="eus-control" data-eus-control="gain">
          <div className="eus-control__head">
            <span className="eus-control__name">Gain</span>
            <span className="eus-control__value">{gainDb} dB</span>
          </div>
          <div className="eus-control__row">
            <input
              aria-label="Gain of the ultrasound image, in decibels"
              type="range"
              min={EUS_GAIN_RANGE_DB[0]}
              max={EUS_GAIN_RANGE_DB[1]}
              step={1}
              value={gainDb}
              disabled={disabled}
              onChange={(event) => onGainDb(Number(event.target.value))}
            />
          </div>
        </div>
      )}
    </>
  );
}
