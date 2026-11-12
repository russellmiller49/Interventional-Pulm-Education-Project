import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { DEFAULT_EUS_CONTROLS } from '@/features/eus-b-simulator/eusAcoustic';
import { describeFacing, insertionDepthCm } from '@/features/eus-b-simulator/eusPose';
import {
  EusScopeControls,
  scopeKeyChange,
  scopeKeyHelp,
} from '@/features/eus-b-simulator/EusScopeControls';
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusScopePath,
  EusScopeState,
} from '@/features/eus-b-simulator/types';
import { useEusCase } from '@/features/eus-b-simulator/useEusCase';
import { useEusFrameWorker } from '@/features/eus-b-simulator/useEusFrameWorker';
import {
  applyScopeChange,
  eusLevelAt,
  useEusScopeSession,
  type EusScopeChange,
} from '@/features/eus-b-simulator/useEusScopeSession';
import type {
  EusbObservation,
  EusbWorkbenchConfig,
} from '../../../../../src/lib/eus-b-guided-bridge';
import {
  EUSB_HOLD_MS,
  eusbLab,
  type EusbControl,
  type EusbLabSpec,
} from '../../../../../src/lib/eus-b-guided-contract';
import { EusGuidedSector } from './EusGuidedSector';
import {
  buildObservation,
  heldImage,
  sameImage,
  type GuidedFrameTag,
} from './guidedObservation';
import {
  REACH_START,
  reachReducer,
  reachTimeLeftMs,
  type ReachEvent,
  type ReachState,
} from './guidedTask';
import { labReviewPose, resolveStart, resolveTarget } from './guidedViews';
import { blockingLabelIds, referenceVisibleAreaMm2, targetAreaRatio } from './visibleArea';
import './eus-b-guided.css';

/** Shortest gap between two reports to the lesson page. */
const REPORT_GAP_MS = 100;
/** Where the scope sits if a lab's start cannot be read from the case. */
const FALLBACK_START: EusScopeState = { sMm: 20, rollDeg: 0, flexDeg: 0 };

interface EusGuidedWorkbenchProps {
  config: EusbWorkbenchConfig;
  onObservation: (observation: EusbObservation) => void;
  onError: (message: string) => void;
}

/** Loads the case once, then hands it to the lab. The lab below is never remounted. */
export function EusGuidedWorkbench({ config, onObservation, onError }: EusGuidedWorkbenchProps) {
  const { manifest, path, volume, error } = useEusCase();
  useEffect(() => {
    if (error) onError('The case could not be loaded. Reload the activity to retry.');
  }, [error, onError]);
  if (error)
    return (
      <main className="eusg eusg--message">
        <p role="alert">The case could not be loaded. Reload the activity to retry.</p>
      </main>
    );
  if (!manifest || !path || !volume)
    return (
      <main className="eusg eusg--message">
        <p role="status">Loading the case…</p>
      </main>
    );
  return (
    <GuidedLab
      manifest={manifest}
      path={path}
      volume={volume}
      config={config}
      onObservation={onObservation}
    />
  );
}

/** A task's state, owned by one lab of one session, so a new lab never inherits the last one's. */
interface OwnedReach {
  labKey: string;
  reach: ReachState;
}
function ownedReachReducer(state: OwnedReach, event: ReachEvent & { labKey: string }): OwnedReach {
  const reach = state.labKey === event.labKey ? state.reach : REACH_START;
  return { labKey: event.labKey, reach: reachReducer(reach, event) };
}

interface WorkState {
  labKey: string;
  scope: EusScopeState;
  depthMm: number;
  gainDb: number;
  used: EusbControl[];
  actions: number;
  last: EusbControl | '';
}

function GuidedLab({
  manifest,
  path,
  volume,
  config,
  onObservation,
}: {
  manifest: EusCaseManifest;
  path: EusScopePath;
  volume: EusAcousticVolume;
  config: EusbWorkbenchConfig;
  onObservation: (observation: EusbObservation) => void;
}) {
  const lab: EusbLabSpec = eusbLab(config.labId);
  const labKey = `${config.sessionId}|${config.labId}`;
  const { phase } = config;
  const named = config.names === 'shown';
  const defaultDepthMm = manifest.probe.defaultDepthMm;

  const start = useMemo(
    () => resolveStart(manifest, path, lab.start) ?? FALLBACK_START,
    [manifest, path, lab],
  );
  const target = useMemo(
    () =>
      (lab.kind === 'reach' || lab.kind === 'rotate') && lab.target
        ? resolveTarget(manifest, volume, path, lab.target)
        : null,
    [manifest, volume, path, lab],
  );
  const blocking = useMemo(() => blockingLabelIds(volume), [volume]);
  const referenceMm2 = useMemo(
    () =>
      target
        ? referenceVisibleAreaMm2(volume, path, manifest, target.pose, target.labelId, blocking)
        : 0,
    [volume, path, manifest, target, blocking],
  );

  const session = useEusScopeSession({ manifest, path, volume }, start);
  const { scope, depthMm, gainDb, reset, setDepthMm, setGainDb } = session;

  // ---- The learner's own position, kept apart from the picture shown in review ---------------
  const work = useRef<WorkState>({
    labKey,
    scope: start,
    depthMm: defaultDepthMm,
    gainDb: DEFAULT_EUS_CONTROLS.gainDb,
    used: [],
    actions: 0,
    last: '',
  });
  const workFor = (key: string) => {
    if (work.current.labKey !== key)
      work.current = {
        labKey: key,
        scope: start,
        depthMm: defaultDepthMm,
        gainDb: DEFAULT_EUS_CONTROLS.gainDb,
        used: [],
        actions: 0,
        last: '',
      };
    return work.current;
  };

  const held = phase === 'review' ? config.held?.[0] : undefined;
  const heldKey = held ? held.frameId : '';
  useEffect(() => {
    const mine = workFor(labKey);
    if (phase === 'work') {
      reset(mine.scope);
      setDepthMm(mine.depthMm);
      setGainDb(mine.gainDb);
      return;
    }
    reset(held?.pose ?? labReviewPose(manifest, path, lab) ?? start);
    setDepthMm(held?.depthMm ?? defaultDepthMm);
    setGainDb(held?.gainDb ?? DEFAULT_EUS_CONTROLS.gainDb);
    // `held` is read through `heldKey`: the same image keeps its place when the object changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labKey, phase, heldKey]);

  // ---- The task --------------------------------------------------------------------------------
  const [owned, dispatch] = useReducer(ownedReachReducer, { labKey, reach: REACH_START });
  const reach = owned.labKey === labKey ? owned.reach : REACH_START;
  const locked = reach.found;
  const interactive = phase === 'work' && !locked;

  const note = (control: EusbControl) => {
    const mine = workFor(labKey);
    if (!mine.used.includes(control)) mine.used = [...mine.used, control];
    mine.actions += 1;
    mine.last = control;
  };
  const moveScope = useCallback(
    (control: EusbControl, change: EusScopeChange) => {
      if (!interactive || !lab.controls.includes(control)) return;
      const mine = workFor(labKey);
      const next = applyScopeChange(path, mine.scope, change);
      if (
        next.sMm === mine.scope.sMm &&
        next.rollDeg === mine.scope.rollDeg &&
        next.flexDeg === mine.scope.flexDeg
      )
        return;
      mine.scope = next;
      note(control);
      reset(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive, lab, labKey, path, reset],
  );
  const setImage = (control: 'depth' | 'gain', value: number) => {
    if (!interactive || !lab.controls.includes(control)) return;
    const mine = workFor(labKey);
    if (control === 'depth') {
      mine.depthMm = value;
      setDepthMm(value);
    } else {
      mine.gainDb = value;
      setGainDb(value);
    }
    note(control);
  };

  // ---- The image -------------------------------------------------------------------------------
  const controls = useMemo(
    () => ({
      ...DEFAULT_EUS_CONTROLS,
      depthMm,
      gainDb,
      sectorAngleDeg: manifest.probe.sectorAngleDeg,
    }),
    [depthMm, gainDb, manifest],
  );
  const tag = useMemo<GuidedFrameTag>(
    () => ({ labKey, phase, scope, depthMm, gainDb }),
    [labKey, phase, scope, depthMm, gainDb],
  );
  const { frame, tag: frameTag, renderError } = useEusFrameWorker(volume, {
    pose: session.acousticPose!,
    controls,
    tag,
  });
  const frameReady =
    !!frame && !!frameTag && frameTag.labKey === labKey && sameImage(frameTag, scope, depthMm, gainDb);

  useEffect(() => {
    if (!frame || !frameTag || !target) return;
    if (frameTag.labKey !== labKey || frameTag.phase !== 'work') return;
    dispatch({
      type: 'frame',
      labKey,
      areaRatio: targetAreaRatio(frame, target.labelId, referenceMm2, blocking),
      now: Date.now(),
      image: heldImage(manifest, frameTag, 'learner'),
    });
    // One evaluation per drawn frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, frameTag]);

  // The hold is timed, not counted in frames: frames stop once the scope is still.
  const holding = phase === 'work' && !reach.found && reach.heldSince !== null;
  useEffect(() => {
    if (!holding) return;
    const left = reachTimeLeftMs(reach, Date.now()) ?? 0;
    const timer = setTimeout(() => dispatch({ type: 'tick', labKey, now: Date.now() }), left + 5);
    return () => clearTimeout(timer);
    // Restarted only when a hold begins or ends, never by the frames within one hold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding, reach.heldSince, labKey]);

  // ---- Reports to the lesson page ---------------------------------------------------------------
  const report = useRef<() => EusbObservation>(() => {
    throw new Error('no report yet');
  });
  report.current = () => {
    const mine = workFor(labKey);
    return buildObservation({
      labId: config.labId,
      labKey,
      manifest,
      volume,
      scope,
      depthMm,
      gainDb,
      frame,
      frameTag,
      usedControls: mine.used,
      actionCount: mine.actions,
      lastAction: mine.last,
      target: target ? { key: target.key, reach } : null,
      now: Date.now(),
    });
  };
  const send = useRef(onObservation);
  send.current = onObservation;
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null),
    lastSent = useRef(0);
  useEffect(() => {
    if (pending.current) return;
    const wait = Math.max(0, REPORT_GAP_MS - (Date.now() - lastSent.current));
    pending.current = setTimeout(() => {
      pending.current = null;
      lastSent.current = Date.now();
      send.current(report.current());
    }, wait);
  }, [frame, frameTag, reach, scope, depthMm, gainDb, labKey, phase, config.observationRequest]);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  // ---- What is on screen ------------------------------------------------------------------------
  const [pointedKey, setPointedKey] = useState<string | null>(null);
  const [legendKey, setLegendKey] = useState<string | null>(null);
  useEffect(() => {
    if (!named) setLegendKey(null);
  }, [named]);

  const legend = useMemo(() => {
    if (!named || !frame) return [];
    const labels = volume.metadata.labels;
    const rows = [...frame.structures]
      .sort((a, b) => b.count - a.count)
      .map((entry) => {
        const label = labels[entry.id];
        const structure = session.structures.get(label.key);
        const color = session.labelColors[entry.id];
        return {
          key: label.key,
          label: structure?.label ?? label.label,
          note: structure?.note,
          color: color ? `rgb(${color.join(',')})` : '#94a3b8',
        };
      });
    // The structure the lab is about leads the list.
    const lead = target ? rows.findIndex((row) => row.key === target.key) : -1;
    if (lead > 0) rows.unshift(...rows.splice(lead, 1));
    return rows;
  }, [named, frame, volume, session.structures, session.labelColors, target]);

  const level = eusLevelAt(manifest, scope.sMm);
  const facing = session.pose ? describeFacing(session.pose.depthAxisLps) : '';
  const cm = insertionDepthCm(scope.sMm, manifest.path.incisorOffsetMm).toFixed(0);
  const showControls = phase === 'work' && lab.controls.length > 0;
  const keyHelp = showControls ? scopeKeyHelp(lab.controls) : null;

  return (
    <main
      className="eusg"
      data-eusg-lab={config.labId}
      data-phase={phase}
      data-names={config.names}
      data-frame-ready={frameReady ? 'true' : 'false'}
      data-found={target ? (reach.found ? 'true' : 'false') : undefined}
    >
      <EusGuidedSector
        volume={volume}
        frame={frame}
        renderError={renderError}
        labelColors={session.labelColors}
        named={named}
        highlightKey={legendKey}
        onPointStructure={setPointedKey}
        drivable={showControls && interactive}
        onKeyDown={(event) => {
          const action = scopeKeyChange(event.key, event.shiftKey, lab.controls);
          if (!action) return;
          event.preventDefault();
          moveScope(action.control, action.change);
        }}
      >
        {phase === 'work' && target && (holding || reach.found) && (
          <div
            className={`eusg-hold${reach.found ? ' is-done' : ''}`}
            role="status"
            aria-live="polite"
            data-eusg-hold={reach.found ? 'done' : 'holding'}
          >
            <span className="eusg-hold__text">{reach.found ? 'View held' : 'Hold this view…'}</span>
            {!reach.found && (
              <span className="eusg-hold__bar" aria-hidden="true">
                <span
                  key={reach.heldSince ?? 0}
                  className="eusg-hold__fill"
                  style={{ animationDuration: `${EUSB_HOLD_MS}ms` }}
                />
              </span>
            )}
          </div>
        )}
      </EusGuidedSector>

      <div className="eusg-side">
        <p className="eusg-position" aria-live="off">
          {named && <strong data-eusg-level>{level.label}</strong>}
          <span data-eusg-depth>≈ {cm} cm from the incisors</span>
          {named && <span>Transducer faces {facing || 'along the scope'}</span>}
        </p>

        {showControls && (
          <section className="eusg-controls" aria-label="Scope controls">
            <EusScopeControls
              allowed={lab.controls}
              manifest={manifest}
              path={path}
              scope={scope}
              depthMm={depthMm}
              gainDb={gainDb}
              onMove={moveScope}
              onDepthMm={(value) => setImage('depth', value)}
              onGainDb={(value) => setImage('gain', value)}
              disabled={!interactive}
              hideLevels={!named}
            />
            {keyHelp && <p className="eusg-keys">{keyHelp}</p>}
          </section>
        )}

        {named && (
          <section className="eusg-legend" aria-label="In this image" data-eusg-legend>
            <h2>In this image</h2>
            {legend.length === 0 ? (
              <p className="eusg-muted">Nothing in this image has a name.</p>
            ) : (
              <ul>
                {legend.map((row) => (
                  <li
                    key={row.key}
                    data-structure={row.key}
                    className={
                      row.key === (pointedKey ?? legendKey) ? 'is-pointed' : undefined
                    }
                    onPointerEnter={() => setLegendKey(row.key)}
                    onPointerLeave={() => setLegendKey(null)}
                  >
                    <span className="eusg-swatch" style={{ backgroundColor: row.color }} />
                    <span>
                      {row.label}
                      {row.note && <small>{row.note}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
