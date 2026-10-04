import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AcousticPose } from '@bronchoscopy-core/acoustic';

import {
  EUS_DEFAULT_LAYERS,
  EUS_FIND_COPY,
  EUS_INTRO,
  EUS_LANDMARK_BY_KEY,
  EUS_LANDMARK_GROUPS,
  EUS_LANDMARKS,
  EUS_MODEL_LIMITS,
  EUS_ORIENTATION_NOTES,
} from './content';
import { EusAnatomyScene } from './EusAnatomyScene';
import { EusCtView, type EusCtPlane } from './EusCtView';
import { EusEndoscopeView } from './EusEndoscopeView';
import { EusSectorView, type EusLabelColors } from './EusSectorView';
import { eusLabelAt, type EusAcousticFrame } from './eusAcoustic';
import {
  clamp,
  computeEusPose,
  describeFacing,
  FLEX_MAX_DEG,
  FLEX_MIN_DEG,
  insertionDepthCm,
  normalizeRollDeg,
  ROLL_MAX_DEG,
  ROLL_MIN_DEG,
  scopeShaftPolyline,
} from './eusPose';
import { FIND_HOLD_MS, FIND_START, referenceAreaMm2, targetHeld } from './findTarget';
import type { Point3 } from '@bronchoscopy-core/frame';
import type { EusCaseManifest, EusLandmarkPose, EusLayerState, EusScopeState } from './types';
import { useEusCase, useEusCt } from './useEusCase';
import './eus-b-simulator.css';

type Mode = 'explore' | 'find';

interface FindRound {
  targetKey: string;
  labelId: number;
  referenceMm2: number;
  hints: number;
  /** Set when the learner held the target, or asked to be shown the reference view. */
  outcome: null | { kind: 'found' | 'shown'; sMm: number; facing: string };
}

/** Landmarks marked on the insertion ruler; a short list so the labels never collide. */
const RULER_TICKS = [
  { key: 'station_4l', label: '4L' },
  { key: 'station_7', label: '7' },
  { key: 'station_9', label: '9' },
  { key: 'station_8', label: '8' },
  { key: 'left_adrenal', label: 'Adrenal' },
];

function levelAt(manifest: EusCaseManifest, sMm: number) {
  const levels = manifest.path.levels;
  return (
    levels.find((level) => sMm >= level.fromSMm && sMm < level.toSMm) ?? levels[levels.length - 1]
  );
}

function hexToRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)) as [number, number, number];
}

/** A button that steps once on click and keeps stepping while it is held. */
function HoldButton({
  label,
  onStep,
  children,
}: {
  label: string;
  onStep: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const step = useRef(onStep);
  step.current = onStep;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className="eus-step-button"
      aria-label={label}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
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

export function EusBSimulatorPage() {
  const { manifest, path, volume, error } = useEusCase();
  // The third pane shows the view through the endoscope or the CT.
  const [correlate, setCorrelate] = useState<'endoscope' | 'ct'>('endoscope');
  const [ctPlane, setCtPlane] = useState<EusCtPlane>('scan');
  const { ct, error: ctError } = useEusCt(manifest, correlate === 'ct');
  const [scope, setScope] = useState<EusScopeState | null>(null);
  const [depthMm, setDepthMm] = useState(50);
  const [layers, setLayers] = useState<EusLayerState>(EUS_DEFAULT_LAYERS);
  const [showColors, setShowColors] = useState(false);
  const [activeStructure, setActiveStructure] = useState<string | null>(null);
  // The structure under the pointer in any view; every view outlines or lights it.
  const [hoverStructure, setHoverStructure] = useState<string | null>(null);
  const [sectorCanvas, setSectorCanvas] = useState<HTMLCanvasElement | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<string | null>('station_7');
  const [mode, setMode] = useState<Mode>('explore');
  const [findTarget, setFindTarget] = useState('station_7');
  const [ultrasoundOnly, setUltrasoundOnly] = useState(false);
  const [round, setRound] = useState<FindRound | null>(null);

  const landmarkPoses = useMemo(
    () => new Map((manifest?.landmarks ?? []).map((landmark) => [landmark.key, landmark])),
    [manifest],
  );
  // Only landmarks that have both a calibrated pose and authored copy are offered.
  const landmarks = useMemo(
    () => EUS_LANDMARKS.filter((landmark) => landmarkPoses.has(landmark.key)),
    [landmarkPoses],
  );

  useEffect(() => {
    if (!manifest || scope) return;
    const start = landmarkPoses.get('station_7') ?? manifest.landmarks[0];
    setDepthMm(manifest.probe.defaultDepthMm);
    setScope(
      start ? { sMm: start.sMm, rollDeg: start.rollDeg, flexDeg: start.flexDeg } : FIND_START,
    );
  }, [manifest, scope, landmarkPoses]);

  const pose = useMemo(() => (path && scope ? computeEusPose(path, scope) : null), [path, scope]);
  const shaftLps = useMemo(
    () => (path && pose && scope ? scopeShaftPolyline(path, pose, scope.sMm) : []),
    [path, pose, scope],
  );
  const acousticPose = useMemo<AcousticPose | null>(
    () =>
      pose && {
        originLps: pose.originLps,
        depthAxisLps: pose.depthAxisLps,
        lateralAxisLps: pose.lateralAxisLps,
      },
    [pose],
  );

  const structures = useMemo(
    () => new Map((manifest?.structures ?? []).map((structure) => [structure.key, structure])),
    [manifest],
  );
  const labelIds = useMemo(
    () => new Map((volume?.metadata.labels ?? []).map((label) => [label.key, label.id])),
    [volume],
  );
  const structureAt = useCallback(
    (point: Point3) => {
      if (!volume) return null;
      const label = volume.metadata.labels[eusLabelAt(volume, ...point)];
      return label?.reportable ? label.key : null;
    },
    [volume],
  );
  // The 3D view redraws the image on its scan plane each time the ultrasound canvas changes.
  const frameListeners = useRef(new Set<() => void>());
  const subscribeFrames = useCallback((listener: () => void) => {
    frameListeners.current.add(listener);
    return () => {
      frameListeners.current.delete(listener);
    };
  }, []);
  const notifyFrameDrawn = useCallback(() => frameListeners.current.forEach((run) => run()), []);
  const labelColors = useMemo<EusLabelColors>(() => {
    if (!manifest || !volume) return [];
    const colors = new Map(manifest.structures.map((s) => [s.key, hexToRgb(s.color)]));
    return volume.metadata.labels.map((label) =>
      label.reportable ? (colors.get(label.key) ?? null) : null,
    );
  }, [manifest, volume]);

  const searching = mode === 'find' && round !== null && round.outcome === null;
  const namingEnabled = !searching;

  const move = useCallback(
    (change: Partial<EusScopeState> | ((current: EusScopeState) => Partial<EusScopeState>)) => {
      if (!path) return;
      setScope((current) => {
        if (!current) return current;
        const next = { ...current, ...(typeof change === 'function' ? change(current) : change) };
        return {
          sMm: clamp(next.sMm, 0, path.totalLengthMm),
          rollDeg: normalizeRollDeg(next.rollDeg),
          flexDeg: clamp(next.flexDeg, FLEX_MIN_DEG, FLEX_MAX_DEG),
        };
      });
    },
    [path],
  );

  const goToLandmark = useCallback(
    (landmark: EusLandmarkPose) => {
      setSelectedLandmark(landmark.key);
      setActiveStructure(landmark.key);
      move({ sMm: landmark.sMm, rollDeg: landmark.rollDeg, flexDeg: landmark.flexDeg });
    },
    [move],
  );

  // ---- Find a target -----------------------------------------------------------------------
  const roundRef = useRef(round);
  roundRef.current = round;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(() => clearHold, []);

  const handleFrame = useCallback((frame: EusAcousticFrame) => {
    const current = roundRef.current;
    if (!current || current.outcome) return;
    if (!targetHeld(frame, current.labelId, current.referenceMm2)) return clearHold();
    // Frames stop arriving once the scope is still, so the hold is timed, not counted in frames.
    if (holdTimer.current) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      const live = roundRef.current,
        at = scopeRef.current,
        facing = poseRef.current;
      if (!live || live.outcome || !at || !facing) return;
      setRound({
        ...live,
        outcome: { kind: 'found', sMm: at.sMm, facing: describeFacing(facing.depthAxisLps) },
      });
      setActiveStructure(live.targetKey);
      setShowColors(true);
    }, FIND_HOLD_MS);
  }, []);

  const startRound = () => {
    if (!manifest || !path || !volume) return;
    const landmark = landmarkPoses.get(findTarget);
    const label = volume.metadata.labels.find((entry) => entry.key === findTarget);
    if (!landmark || !label) return;
    clearHold();
    setShowColors(false);
    setActiveStructure(null);
    setSelectedLandmark(null);
    setRound({
      targetKey: findTarget,
      labelId: label.id,
      referenceMm2: referenceAreaMm2(volume, path, manifest, landmark, label.id),
      hints: 0,
      outcome: null,
    });
    move(FIND_START);
  };

  const showReference = () => {
    const landmark = round && landmarkPoses.get(round.targetKey);
    if (!round || !landmark || !path) return;
    clearHold();
    const reference = computeEusPose(path, landmark);
    setRound({
      ...round,
      outcome: { kind: 'shown', sMm: landmark.sMm, facing: describeFacing(reference.depthAxisLps) },
    });
    setActiveStructure(round.targetKey);
    setShowColors(true);
    move({ sMm: landmark.sMm, rollDeg: landmark.rollDeg, flexDeg: landmark.flexDeg });
  };

  const endRound = () => {
    clearHold();
    setRound(null);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    endRound();
    setMode(next);
  };

  // ---- Keyboard driving --------------------------------------------------------------------
  const onDriveKey = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName)) return;
    const big = event.shiftKey;
    const actions: Record<string, () => void> = {
      ArrowUp: () => move((c) => ({ sMm: c.sMm + (big ? 10 : 2) })),
      ArrowDown: () => move((c) => ({ sMm: c.sMm - (big ? 10 : 2) })),
      ArrowRight: () => move((c) => ({ rollDeg: c.rollDeg + (big ? 15 : 3) })),
      ArrowLeft: () => move((c) => ({ rollDeg: c.rollDeg - (big ? 15 : 3) })),
      ']': () => move((c) => ({ flexDeg: c.flexDeg + 3 })),
      '[': () => move((c) => ({ flexDeg: c.flexDeg - 3 })),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  if (error) {
    return (
      <main className="eus-page">
        <section className="eus-card" role="alert">
          <h1>{EUS_INTRO.title}</h1>
          <p>The simulator case could not be loaded. Reload the page to retry.</p>
          <p className="eus-muted">{error}</p>
        </section>
      </main>
    );
  }
  if (!manifest || !path || !volume || !scope || !pose || !acousticPose) {
    return (
      <main className="eus-page">
        <section className="eus-card" role="status">
          <span className="eus-eyebrow">{EUS_INTRO.eyebrow}</span>
          <h1>{EUS_INTRO.title}</h1>
          <p>Loading the case…</p>
        </section>
      </main>
    );
  }

  const level = levelAt(manifest, scope.sMm);
  const depthCm = insertionDepthCm(scope.sMm, manifest.path.incisorOffsetMm);
  const facing = describeFacing(pose.depthAxisLps);
  const selected = selectedLandmark ? EUS_LANDMARK_BY_KEY.get(selectedLandmark) : undefined;
  const selectedPose = selectedLandmark ? landmarkPoses.get(selectedLandmark) : undefined;
  const atSelected =
    !!selectedPose &&
    Math.abs(scope.sMm - selectedPose.sMm) < 1.5 &&
    Math.abs(normalizeRollDeg(scope.rollDeg - selectedPose.rollDeg)) < 2 &&
    Math.abs(scope.flexDeg - selectedPose.flexDeg) < 2;
  const roundLandmark = round ? EUS_LANDMARK_BY_KEY.get(round.targetKey) : undefined;
  const roundPose = round ? landmarkPoses.get(round.targetKey) : undefined;
  const hideCorrelates = searching && ultrasoundOnly;
  const shownStructure = namingEnabled ? (hoverStructure ?? activeStructure) : null;
  const cmLabel = (sMm: number) =>
    `≈ ${insertionDepthCm(sMm, manifest.path.incisorOffsetMm).toFixed(0)} cm`;
  const correlateSwitch = (
    <div className="eus-segmented" role="group" aria-label="Third view">
      <button
        type="button"
        aria-pressed={correlate === 'endoscope'}
        onClick={() => setCorrelate('endoscope')}
      >
        Endoscope
      </button>
      <button type="button" aria-pressed={correlate === 'ct'} onClick={() => setCorrelate('ct')}>
        CT
      </button>
    </div>
  );

  return (
    <main className="eus-page">
      <header className="eus-card eus-header">
        <div>
          <span className="eus-eyebrow">{EUS_INTRO.eyebrow}</span>
          <h1>
            {EUS_INTRO.title} <span className="eus-badge">Development preview</span>
          </h1>
          <p>{EUS_INTRO.lede}</p>
          <p className="eus-muted">{EUS_INTRO.scope}</p>
        </div>
        <div className="eus-header-notes">
          <details>
            <summary>How the image is oriented</summary>
            <ul>
              {EUS_ORIENTATION_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
          <details>
            <summary>What this simulator does not show</summary>
            <ul>
              {EUS_MODEL_LIMITS.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        </div>
      </header>

      <div className="eus-modebar">
        <div className="eus-segmented" role="group" aria-label="Simulator mode">
          <button type="button" aria-pressed={mode === 'explore'} onClick={() => switchMode('explore')}>
            Explore landmarks
          </button>
          <button type="button" aria-pressed={mode === 'find'} onClick={() => switchMode('find')}>
            Find a target
          </button>
        </div>
        <p className="eus-position" aria-live="polite">
          {/* The level name would tell a searching learner when they have arrived. */}
          {!searching && <strong>{level.label}</strong>}
          <span>
            {cmLabel(scope.sMm)} from the incisors <em>(estimate)</em>
          </span>
          <span>Transducer faces {facing || 'along the scope'}</span>
        </p>
      </div>

      {mode === 'explore' ? (
        <section className="eus-card eus-landmarks" aria-label="Landmark views">
          <div className="eus-landmarks__head">
            <h2>Landmark views</h2>
            <p className="eus-muted">
              Each view was calibrated on this case. Open one, then move the scope away and find it
              again.
            </p>
          </div>
          <div className="eus-landmark-rail">
            {EUS_LANDMARK_GROUPS.map((group) => (
              <div className="eus-landmark-rail__group" key={group.key}>
                <h3>{group.label}</h3>
                <div className="eus-landmark-rail__chips">
                  {landmarks
                    .filter((landmark) => landmark.group === group.key)
                    .map((landmark) => (
                      <button
                        key={landmark.key}
                        type="button"
                        className="eus-landmark-button"
                        aria-pressed={selectedLandmark === landmark.key}
                        onClick={() => goToLandmark(landmarkPoses.get(landmark.key)!)}
                      >
                        {landmark.title}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          {selected && selectedPose && (
            <article className="eus-landmark-card" aria-live="polite">
              <h3>
                {selected.title}
                <small>
                  {selected.subtitle ? ` · ${selected.subtitle}` : ''} · {cmLabel(selectedPose.sMm)}
                </small>
              </h3>
              <p>
                <strong>In the ultrasound image:</strong> {selected.lookFor}
              </p>
              {selected.note && <p className="eus-note">{selected.note}</p>}
              <p className="eus-muted">
                Segmented structures in this view:{' '}
                {selectedPose.inView.map((key) => structures.get(key)?.label ?? key).join(', ')}.
              </p>
              {!atSelected && (
                <button
                  type="button"
                  className="eus-step-button"
                  onClick={() => goToLandmark(selectedPose)}
                >
                  Return to this view
                </button>
              )}
            </article>
          )}
        </section>
      ) : (
      <section className="eus-card eus-find" aria-label="Find a target">
        <h2>Find a target</h2>
        {!round && (
          <>
            <p>{EUS_FIND_COPY.intro}</p>
            <label className="eus-field">
              Target
              <select value={findTarget} onChange={(event) => setFindTarget(event.target.value)}>
                {EUS_LANDMARK_GROUPS.map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {landmarks
                      .filter((landmark) => landmark.group === group.key)
                      .map((landmark) => (
                        <option key={landmark.key} value={landmark.key}>
                          {landmark.title}
                          {landmark.subtitle ? ` (${landmark.subtitle})` : ''}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="eus-check">
              <input
                type="checkbox"
                checked={ultrasoundOnly}
                onChange={(event) => setUltrasoundOnly(event.target.checked)}
              />
              {EUS_FIND_COPY.ultrasoundOnly}
            </label>
            <button type="button" className="eus-primary-button" onClick={startRound}>
              Start from the upper esophagus
            </button>
          </>
        )}
        {round && roundLandmark && roundPose && (
          <>
            <p className="eus-find__target">
              Target: <strong>{roundLandmark.title}</strong>
              {roundLandmark.subtitle && ` (${roundLandmark.subtitle})`}
            </p>
            {!round.outcome && (
              <>
                <p role="status">{EUS_FIND_COPY.searching}</p>
                {round.hints >= 1 && (
                  <p className="eus-note">
                    Level: {levelAt(manifest, roundPose.sMm).label.toLowerCase()}, at{' '}
                    {cmLabel(roundPose.sMm)} from the incisors (estimate).
                  </p>
                )}
                {round.hints >= 2 && (
                  <p className="eus-note">
                    Direction: in the reference view the transducer faces{' '}
                    {describeFacing(computeEusPose(path, roundPose).depthAxisLps)}.
                  </p>
                )}
                <div className="eus-find__actions">
                  {round.hints < 2 && (
                    <button
                      type="button"
                      className="eus-step-button"
                      onClick={() => setRound({ ...round, hints: round.hints + 1 })}
                    >
                      {round.hints === 0 ? 'Hint: which level' : 'Hint: which direction'}
                    </button>
                  )}
                  <button type="button" className="eus-step-button" onClick={showReference}>
                    Show the reference view
                  </button>
                  <button type="button" className="eus-step-button" onClick={endRound}>
                    Stop
                  </button>
                </div>
              </>
            )}
            {round.outcome && (
              <article className="eus-landmark-card" aria-live="polite">
                <h3>
                  {round.outcome.kind === 'found'
                    ? `${roundLandmark.title} is in the image.`
                    : `Reference view of ${roundLandmark.title}`}
                </h3>
                {round.outcome.kind === 'found' && (
                  <p>
                    You held it at {cmLabel(round.outcome.sMm)}, facing {round.outcome.facing}. The
                    reference view is at {cmLabel(roundPose.sMm)}, facing{' '}
                    {describeFacing(computeEusPose(path, roundPose).depthAxisLps)}. Hints used:{' '}
                    {round.hints}.
                  </p>
                )}
                <p>
                  <strong>In the ultrasound image:</strong> {roundLandmark.lookFor}
                </p>
                {roundLandmark.note && <p className="eus-note">{roundLandmark.note}</p>}
                <div className="eus-find__actions">
                  <button type="button" className="eus-primary-button" onClick={endRound}>
                    Choose another target
                  </button>
                </div>
              </article>
            )}
          </>
        )}
      </section>
      )}

      {/* One block for the views and the scope controls, so the controls can stay pinned in view
          beneath the images they move (see `.eus-stage`). */}
      <div className="eus-stage">
      <div
        className={`eus-workspace${hideCorrelates ? ' eus-workspace--single' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="Simulator views. Arrow keys advance, withdraw and rotate the scope; brackets angle the tip."
        onKeyDown={onDriveKey}
      >
        {!hideCorrelates && (
          <EusAnatomyScene
            manifest={manifest}
            path={path}
            pose={pose}
            sMm={scope.sMm}
            depthMm={depthMm}
            layers={layers}
            onLayers={setLayers}
            activeStructure={namingEnabled ? activeStructure : null}
            hoverStructure={namingEnabled ? hoverStructure : null}
            onHoverStructure={setHoverStructure}
            namingEnabled={namingEnabled}
            structureAt={structureAt}
            sectorCanvas={sectorCanvas}
            subscribeFrames={subscribeFrames}
          />
        )}
        <EusSectorView
          volume={volume}
          pose={acousticPose}
          sectorAngleDeg={manifest.probe.sectorAngleDeg}
          depthMm={depthMm}
          onDepthMm={setDepthMm}
          labelColors={labelColors}
          structures={structures}
          showColors={showColors}
          onShowColors={setShowColors}
          namingEnabled={namingEnabled}
          activeStructure={activeStructure}
          onActiveStructure={setActiveStructure}
          hoverStructure={hoverStructure}
          onHoverStructure={setHoverStructure}
          onFrame={handleFrame}
          onCanvas={setSectorCanvas}
          onFrameDrawn={notifyFrameDrawn}
        />
        {!hideCorrelates &&
          (correlate === 'endoscope' ? (
            <EusEndoscopeView
              manifest={manifest}
              path={path}
              pose={pose}
              sMm={scope.sMm}
              depthLabel={cmLabel(scope.sMm)}
              viewSwitch={correlateSwitch}
            />
          ) : (
            <EusCtView
              ct={ct}
              loadError={ctError}
              volume={volume}
              pose={pose}
              shaftLps={shaftLps}
              depthMm={depthMm}
              sectorAngleDeg={manifest.probe.sectorAngleDeg}
              labelColors={labelColors}
              showColors={showColors && namingEnabled}
              highlightId={shownStructure ? (labelIds.get(shownStructure) ?? null) : null}
              highlightStrength={hoverStructure ? 0.58 : 0.3}
              plane={ctPlane}
              onPlane={setCtPlane}
              viewSwitch={correlateSwitch}
            />
          ))}
      </div>

      <section className="eus-card eus-drive" aria-label="Scope controls">
        <p className="eus-drive__lede">{EUS_INTRO.controls}</p>
        <div className="eus-control">
          <div className="eus-control__head">
            <span className="eus-control__name">Advance or withdraw</span>
            <span className="eus-control__value">
              {cmLabel(scope.sMm)} · {pose.region === 'stomach' ? 'stomach' : 'esophagus'}
            </span>
          </div>
          <div className="eus-control__row">
            <HoldButton label="Withdraw the scope" onStep={() => move((c) => ({ sMm: c.sMm - 1 }))}>
              Withdraw
            </HoldButton>
            <div className="eus-track">
              <input
                aria-label="Insertion depth along the scope path"
                type="range"
                min={0}
                max={Math.round(path.totalLengthMm)}
                step={1}
                value={Math.round(scope.sMm)}
                onChange={(event) => move({ sMm: Number(event.target.value) })}
              />
              {/* The ruler is the map of the path. During a search its landmark ticks and the
                  current-level highlight are withheld: they would give the target's level away. */}
              <div className="eus-ruler" aria-hidden="true">
                {manifest.path.levels.map((entry) => (
                  <span
                    key={entry.key}
                    className={`eus-ruler__level${!searching && entry.key === level.key ? ' is-current' : ''}`}
                    style={{
                      left: `${(entry.fromSMm / path.totalLengthMm) * 100}%`,
                      width: `${((entry.toSMm - entry.fromSMm) / path.totalLengthMm) * 100}%`,
                    }}
                    title={searching ? undefined : entry.label}
                  />
                ))}
                {!searching &&
                  RULER_TICKS.filter((tick) => landmarkPoses.has(tick.key)).map((tick) => (
                    <span
                      key={tick.key}
                      className="eus-ruler__tick"
                      style={{
                        left: `${(landmarkPoses.get(tick.key)!.sMm / path.totalLengthMm) * 100}%`,
                      }}
                    >
                      {tick.label}
                    </span>
                  ))}
                <span
                  className="eus-ruler__tick eus-ruler__tick--junction"
                  style={{ left: `${(path.gejSMm / path.totalLengthMm) * 100}%` }}
                >
                  GEJ
                </span>
              </div>
            </div>
            <HoldButton label="Advance the scope" onStep={() => move((c) => ({ sMm: c.sMm + 1 }))}>
              Advance
            </HoldButton>
          </div>
        </div>
        <div className="eus-control">
          <div className="eus-control__head">
            <span className="eus-control__name">Rotate the shaft</span>
            <span className="eus-control__value">
              {scope.rollDeg === 0
                ? '0°'
                : `${Math.abs(Math.round(scope.rollDeg))}° ${scope.rollDeg > 0 ? 'clockwise' : 'counterclockwise'}`}
            </span>
          </div>
          <div className="eus-control__row">
            <HoldButton
              label="Rotate counterclockwise"
              onStep={() => move((c) => ({ rollDeg: c.rollDeg - 2 }))}
            >
              ⟲
            </HoldButton>
            <input
              aria-label="Shaft rotation in degrees, clockwise positive"
              type="range"
              min={ROLL_MIN_DEG}
              max={ROLL_MAX_DEG}
              step={1}
              value={Math.round(scope.rollDeg)}
              onChange={(event) => move({ rollDeg: Number(event.target.value) })}
            />
            <HoldButton label="Rotate clockwise" onStep={() => move((c) => ({ rollDeg: c.rollDeg + 2 }))}>
              ⟳
            </HoldButton>
          </div>
        </div>
        <div className="eus-control">
          <div className="eus-control__head">
            <span className="eus-control__name">Angle the tip</span>
            <span className="eus-control__value">
              {scope.flexDeg === 0
                ? 'Neutral'
                : `${Math.abs(Math.round(scope.flexDeg))}° ${scope.flexDeg > 0 ? 'up' : 'down'}`}
            </span>
          </div>
          <div className="eus-control__row">
            <input
              aria-label="Tip angulation in degrees, up positive"
              type="range"
              min={FLEX_MIN_DEG}
              max={FLEX_MAX_DEG}
              step={1}
              value={Math.round(scope.flexDeg)}
              onChange={(event) => move({ flexDeg: Number(event.target.value) })}
            />
            <button type="button" className="eus-step-button" onClick={() => move({ flexDeg: 0 })}>
              Neutral
            </button>
          </div>
        </div>
        <p className="eus-muted eus-drive__keys">
          Keyboard: click a view, then use ↑ ↓ to advance or withdraw, ← → to rotate, [ ] to angle
          the tip. Hold Shift for larger steps.
        </p>
      </section>
      </div>

    </main>
  );
}
