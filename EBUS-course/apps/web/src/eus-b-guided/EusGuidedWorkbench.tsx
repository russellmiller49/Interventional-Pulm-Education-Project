import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { isLayerGroup } from '@/features/eus-b-simulator/content';
import { EusAnatomyScene } from '@/features/eus-b-simulator/EusAnatomyScene';
import { DEFAULT_EUS_CONTROLS } from '@/features/eus-b-simulator/eusAcoustic';
import { EusEndoscopeView } from '@/features/eus-b-simulator/EusEndoscopeView';
import { describeFacing, insertionDepthCm } from '@/features/eus-b-simulator/eusPose';
import {
  EusScopeControls,
  scopeKeyChange,
  scopeKeyHelp,
} from '@/features/eus-b-simulator/EusScopeControls';
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusLayerState,
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
  type EusbPane,
} from '../../../../../src/lib/eus-b-guided-contract';
import { EusGuidedSector, type SectorPick } from './EusGuidedSector';
import {
  DEMO_LEG_MS,
  DEMO_STEP_MS,
  demoLegs,
  demoLegText,
  demoPoseAt,
  demoViewText,
} from './guidedDemo';
import {
  IDENTIFY_START,
  identifyAsked,
  identifyDone,
  identifyReducer,
  identifyReport,
  identifyRows,
  type IdentifyEvent,
  type IdentifyState,
} from './guidedIdentify';
import {
  clickHits,
  clickTolerancePx,
  labelUnder,
  landmarkPoint,
  pointFraction,
} from './guidedLandmarks';
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
import {
  blockingLabelIds,
  reachMask,
  referenceVisibleAreaMm2,
  targetAreaRatio,
} from './visibleArea';
import './eus-b-guided.css';

/** Shortest gap between two reports to the lesson page. */
const REPORT_GAP_MS = 100;
/** Where the scope sits if a lab's start cannot be read from the case. */
const FALLBACK_START: EusScopeState = { sMm: 20, rollDeg: 0, flexDeg: 0 };
/** The 3D view names nothing and draws no ultrasound image on a cut: these never change. */
const NAMES_NOTHING = () => null;
const NO_FRAMES = () => () => {};
const IGNORE = () => {};
const NO_LANDMARKS: readonly string[] = [];

/** A structure's name as it reads inside a sentence: "the left atrium", "station 7". */
function inSentence(label: string) {
  const lowered = label.charAt(0).toLowerCase() + label.slice(1);
  return /^station\b/i.test(label) ? lowered : `the ${lowered}`;
}
/**
 * What the 3D view draws when it is opened to locate a target: the airway a bronchoscopist
 * already knows, the nodes, the esophagus and stomach the scope lies in, and the abdominal organs.
 * The heart and the great vessels cover most mediastinal targets from every side, so they start
 * hidden and the learner can add them. The spine and the bowel are left out.
 */
const LOCATING_LAYERS: EusLayerState = {
  node: true,
  airway: true,
  gi: true,
  organ: true,
  heart: false,
  vessel: false,
  bone: false,
  bowel: false,
};

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

/** A mark-the-landmarks task's state, owned by one lab of one session like the reach task's. */
interface OwnedIdentify {
  labKey: string;
  state: IdentifyState;
}
function ownedIdentifyReducer(
  owned: OwnedIdentify,
  event: IdentifyEvent & { labKey: string; landmarks: readonly string[] },
): OwnedIdentify {
  const state = owned.labKey === event.labKey ? owned.state : IDENTIFY_START;
  return { labKey: event.labKey, state: identifyReducer(state, event, event.landmarks) };
}

/** The help a learner has asked for in one task. A new task, or a fresh start of one, has none. */
interface HelpState {
  labKey: string;
  /** The 3D view is open. */
  anatomy: boolean;
  /** The 3D view also draws the heart, and the vessels. */
  heart: boolean;
  vessel: boolean;
  demo: 'idle' | 'running' | 'done';
  /** What the lab is doing while it drives the scope. */
  leg: string;
}
const noHelp = (labKey: string): HelpState => ({
  labKey,
  anatomy: false,
  heart: false,
  vessel: false,
  demo: 'idle',
  leg: '',
});

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
  // ---- The mark-the-landmarks task ---------------------------------------------------------------
  const landmarks = lab.landmarks ?? NO_LANDMARKS;
  const [ownedIdentify, dispatchIdentify] = useReducer(ownedIdentifyReducer, {
    labKey,
    state: IDENTIFY_START,
  });
  const marked = ownedIdentify.labKey === labKey ? ownedIdentify.state : IDENTIFY_START;
  const identifying = lab.kind === 'identify' && phase === 'work';
  const asked = identifying ? identifyAsked(marked, landmarks) : null;
  const allMarked = lab.kind === 'identify' && identifyDone(marked, landmarks);

  const [helpState, setHelpState] = useState<HelpState>(() => noHelp(labKey));
  const help = helpState.labKey === labKey ? helpState : noHelp(labKey);
  const locked = reach.found || reach.shown;
  const interactive = phase === 'work' && !locked && help.demo !== 'running';

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

  // ---- Help for a learner who is stuck -----------------------------------------------------------
  const offered = phase === 'work' && target ? (lab.help ?? []) : [];
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopDemo = () => {
    if (demoTimer.current) clearInterval(demoTimer.current);
    demoTimer.current = null;
  };
  // A demonstration belongs to one task in its work phase and ends with it.
  useEffect(() => stopDemo, [labKey, phase]);

  const showMe = () => {
    if (!target || !interactive || demoTimer.current || !offered.includes('show')) return;
    const mine = workFor(labKey);
    const key = labKey;
    const legs = demoLegs(path, mine.scope, target.pose);
    // The view is shown as the course shows it: at the image settings of the reference.
    mine.depthMm = defaultDepthMm;
    mine.gainDb = DEFAULT_EUS_CONTROLS.gainDb;
    setDepthMm(mine.depthMm);
    setGainDb(mine.gainDb);
    // A hold the learner had begun does not finish under the demonstration.
    dispatch({ type: 'reset', labKey: key });
    const finish = () => {
      stopDemo();
      mine.scope = target.pose;
      reset(target.pose);
      dispatch({
        type: 'shown',
        labKey: key,
        image: heldImage(
          manifest,
          { scope: target.pose, depthMm: mine.depthMm, gainDb: mine.gainDb },
          'reference',
        ),
      });
      setHelpState((current) => ({
        ...(current.labKey === key ? current : noHelp(key)),
        demo: 'done',
        leg: '',
      }));
    };
    if (legs.length === 0) return finish();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const say = (at: number) =>
      setHelpState((current) => ({
        ...(current.labKey === key ? current : noHelp(key)),
        demo: 'running',
        leg: demoLegText(manifest, legs[at]),
      }));
    let at = 0;
    let began = Date.now();
    say(0);
    // A timer, not animation frames: the lesson may be in a hidden tab.
    demoTimer.current = setInterval(() => {
      const t = still ? 1 : (Date.now() - began) / DEMO_LEG_MS;
      const next = demoPoseAt(path, legs[at], t);
      mine.scope = next;
      reset(next);
      if (t < 1) return;
      at += 1;
      began = Date.now();
      if (at >= legs.length) finish();
      else say(at);
    }, DEMO_STEP_MS);
  };

  // A mark-the-landmarks task is a still image: the lens view adds nothing to it.
  const showEndoscope = config.panes.includes('endoscope') && lab.kind !== 'identify';
  const showAnatomy = help.anatomy && offered.includes('anatomy');
  const targetGroup = target ? session.structures.get(target.key)?.group : undefined;
  // The target's own kind of structure is always drawn, whatever else is hidden.
  const layers = useMemo<EusLayerState>(
    () => ({
      ...LOCATING_LAYERS,
      heart: help.heart,
      vessel: help.vessel,
      ...(targetGroup && isLayerGroup(targetGroup) ? { [targetGroup]: true } : {}),
    }),
    [help.heart, help.vessel, targetGroup],
  );
  const views: EusbPane[] = [
    ...(showEndoscope ? (['endoscope'] as const) : []),
    ...(showAnatomy ? (['anatomy'] as const) : []),
  ];

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

  // ---- Landmarks in the image on screen ----------------------------------------------------------
  // Read only from an image that is this lab's and current, and only when landmarks are drawn or
  // asked for: on a labeled image, and in a mark-the-landmarks task.
  const landmarkFrame = frameReady && landmarks.length > 0 && (named || identifying) ? frame : null;
  const reached = useMemo(
    () => (landmarkFrame ? reachMask(landmarkFrame, blocking) : null),
    [landmarkFrame, blocking],
  );
  /** Where each landmark of the lab lies in this image, as fractions of it. Absent: not in it. */
  const landmarkAt = useMemo(() => {
    const points = new Map<string, { x: number; y: number }>();
    if (!landmarkFrame || !reached) return points;
    for (const key of landmarks) {
      const id = session.labelIds.get(key);
      const point = id === undefined ? null : landmarkPoint(landmarkFrame, reached, id);
      if (point) points.set(key, pointFraction(landmarkFrame, point));
    }
    return points;
  }, [landmarkFrame, reached, landmarks, session.labelIds]);

  const pick = (at: SectorPick) => {
    if (!identifying || !landmarkFrame || !reached || !asked) return;
    const askedId = session.labelIds.get(asked);
    let key: string | null = null;
    if (
      askedId !== undefined &&
      clickHits(landmarkFrame, reached, askedId, at, clickTolerancePx(landmarkFrame))
    )
      key = asked;
    else {
      const under = labelUnder(landmarkFrame, reached, at);
      const label = under === null ? undefined : volume.metadata.labels[under];
      key = label?.reportable ? label.key : null;
    }
    dispatchIdentify({ type: 'click', labKey, landmarks, key, at: at.fraction });
  };

  // For browser tests only: where a landmark's point is in the image now on screen.
  const landmarkAtRef = useRef(landmarkAt);
  landmarkAtRef.current = landmarkAt;
  useEffect(() => {
    const host = window as unknown as {
      __eusgTest?: { landmarkPoint: (key: string) => { x: number; y: number } | null };
    };
    host.__eusgTest = { landmarkPoint: (key) => landmarkAtRef.current.get(key) ?? null };
    return () => {
      delete host.__eusgTest;
    };
  }, []);

  useEffect(() => {
    if (!frame || !frameTag || !target) return;
    if (frameTag.labKey !== labKey || frameTag.phase !== 'work') return;
    // While the lab drives the scope, nothing it passes or reaches counts as the learner's.
    if (demoTimer.current) return;
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
      views,
      identified: lab.kind === 'identify' ? identifyReport(marked) : undefined,
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
  }, [
    frame,
    frameTag,
    reach,
    marked,
    scope,
    depthMm,
    gainDb,
    labKey,
    phase,
    showEndoscope,
    showAnatomy,
    config.observationRequest,
  ]);
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

  const [badgeKey, setBadgeKey] = useState<string | null>(null);
  useEffect(() => {
    if (!named) setBadgeKey(null);
  }, [named]);

  const structureLabel = useCallback(
    (key: string) =>
      session.structures.get(key)?.label ??
      volume.metadata.labels.find((label) => label.key === key)?.label ??
      key.replace(/_/g, ' '),
    [session.structures, volume],
  );
  const structureColor = useCallback(
    (key: string) => {
      const id = session.labelIds.get(key);
      const color = id === undefined ? null : session.labelColors[id];
      return color ? `rgb(${color.join(',')})` : '#94a3b8';
    },
    [session.labelIds, session.labelColors],
  );

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
      })
      // A landmark of the view is listed with its number, above the rest.
      .filter((row) => !landmarks.includes(row.key));
    // The structure the lab is about leads the list.
    const lead = target ? rows.findIndex((row) => row.key === target.key) : -1;
    if (lead > 0) rows.unshift(...rows.splice(lead, 1));
    return rows;
  }, [named, frame, volume, session.structures, session.labelColors, target, landmarks]);
  /** The view's landmarks in their own order, each with its number, whether or not it is in the image. */
  const landmarkRows = useMemo(
    () =>
      named
        ? landmarks.map((key, index) => ({
            key,
            number: index + 1,
            label: structureLabel(key),
            note: session.structures.get(key)?.note,
            color: structureColor(key),
            // Until this lab's image is drawn there is nothing to say a landmark is missing from.
            present: landmarkFrame ? landmarkAt.has(key) : true,
          }))
        : [],
    [named, landmarks, structureLabel, structureColor, session.structures, landmarkAt, landmarkFrame],
  );
  const pointedRow = pointedKey ?? badgeKey ?? legendKey;

  /** Numbers on the image: every landmark on a labeled image, the marked ones in a task. */
  const badges = named
    ? landmarkRows.flatMap((row) => {
        const at = landmarkAt.get(row.key);
        return at ? [{ key: row.key, number: row.number, at, kind: 'named' }] : [];
      })
    : identifying
      ? identifyRows(marked, landmarks).flatMap((row) => {
          const at =
            row.state === 'done'
              ? (marked.points[row.key] ?? landmarkAt.get(row.key))
              : row.state === 'shown'
                ? landmarkAt.get(row.key)
                : undefined;
          return at ? [{ key: row.key, number: row.number, at, kind: row.state }] : [];
        })
      : [];
  const askRows = identifying ? identifyRows(marked, landmarks) : [];

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
      data-shown={target ? (reach.shown ? 'true' : 'false') : undefined}
      data-demo={target ? help.demo : undefined}
      data-views={views.length > 0 ? views.join(' ') : undefined}
      data-identify-done={lab.kind === 'identify' ? (allMarked ? 'true' : 'false') : undefined}
      data-eusg-asked={lab.kind === 'identify' ? (asked ?? '') : undefined}
    >
      <EusGuidedSector
        volume={volume}
        frame={frame}
        renderError={renderError}
        labelColors={session.labelColors}
        named={named}
        highlightKey={legendKey ?? badgeKey}
        onPointStructure={setPointedKey}
        tintKeys={identifying ? [...marked.keys, ...marked.shown] : undefined}
        onPick={identifying && !allMarked ? pick : undefined}
        drivable={showControls && interactive}
        onKeyDown={(event) => {
          const action = scopeKeyChange(event.key, event.shiftKey, lab.controls);
          if (!action) return;
          event.preventDefault();
          moveScope(action.control, action.change);
        }}
      >
        {phase === 'work' && target && (help.demo === 'running' || reach.shown) && (
          <div
            className={`eusg-hold${reach.shown ? ' is-shown' : ''}`}
            role="status"
            aria-live="polite"
            data-eusg-hold={reach.shown ? 'shown' : 'showing'}
          >
            <span className="eusg-hold__text">{reach.shown ? 'View shown' : `${help.leg}…`}</span>
          </div>
        )}
        {phase === 'work' && target && help.demo === 'idle' && (holding || reach.found) && (
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
        {badges.map((badge) => (
          <span
            key={badge.key}
            className={`eusg-badge is-${badge.kind}`}
            aria-hidden="true"
            data-eusg-marker={badge.key}
            data-number={badge.number}
            style={{
              left: `${badge.at.x * 100}%`,
              top: `${badge.at.y * 100}%`,
              borderColor: structureColor(badge.key),
            }}
            onPointerEnter={named ? () => setBadgeKey(badge.key) : undefined}
            onPointerLeave={named ? () => setBadgeKey(null) : undefined}
          >
            {badge.number}
          </span>
        ))}
      </EusGuidedSector>

      <div className="eusg-side">
        <div className="eusg-panel">
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

          {offered.length > 0 && (
            <section className="eusg-help" aria-label="If you are stuck" data-eusg-help-block>
              <h2>If you are stuck</h2>
              <div className="eusg-help__actions">
                {offered.includes('anatomy') && (
                  <button
                    type="button"
                    className="eus-step-button"
                    data-eusg-help="anatomy"
                      onClick={() => setHelpState({ ...help, anatomy: !help.anatomy })}
                  >
                    {help.anatomy ? 'Hide the 3D view' : 'Show the 3D view'}
                  </button>
                )}
                {offered.includes('show') && help.demo === 'idle' && !locked && (
                  <button
                    type="button"
                    className="eus-step-button"
                    data-eusg-help="show"
                    onClick={showMe}
                  >
                    Show me the view
                  </button>
                )}
              </div>
              <p className="eusg-muted" data-eusg-help-text>
                {reach.shown
                  ? `This is the view: ${demoViewText(manifest, scope)}. To find it yourself, use “Start this task again” above the image.`
                  : help.demo === 'running'
                    ? 'Watch the image and the scope controls.'
                    : reach.found
                      ? 'You found the view.'
                      : help.anatomy
                        ? 'In the 3D view your target is highlighted, and the scope and its scan plane follow the controls. Drag to turn the model.'
                        : 'The 3D view shows the scope in the anatomy with your target highlighted. “Show me the view” drives the scope to it.'}
              </p>
            </section>
          )}

          {identifying && (
            <section className="eusg-ask" aria-label="Mark the landmarks">
              <h2>Mark the landmarks</h2>
              <p className="eusg-ask__now" aria-live="polite" data-eusg-ask-now>
                {asked ? (
                  <>
                    Click: <strong>{structureLabel(asked)}</strong>
                  </>
                ) : (
                  'All landmarks marked.'
                )}
              </p>
              <ol data-eusg-ask>
                {askRows.map((row) => (
                  <li key={row.key} data-structure={row.key} data-state={row.state}>
                    <span className="eusg-ask__number" aria-hidden="true">
                      {row.number}
                    </span>
                    <span>{structureLabel(row.key)}</span>
                    <span className="eusg-ask__state">
                      {row.state === 'done'
                        ? '✓ Marked'
                        : row.state === 'shown'
                          ? 'Shown'
                          : row.state === 'current'
                            ? 'Now'
                            : ''}
                    </span>
                  </li>
                ))}
              </ol>
              {asked && (
                <button
                  type="button"
                  className="eus-step-button"
                  data-eusg-identify-show
                  disabled={!landmarkFrame}
                  onClick={() => dispatchIdentify({ type: 'show', labKey, landmarks })}
                >
                  Show me this one
                </button>
              )}
              <p className="eusg-ask__result" role="status" data-eusg-identify-result>
                {asked && marked.lastMiss === asked
                  ? `Not ${inSentence(structureLabel(asked))}. Try again.`
                  : ''}
              </p>
              {asked && (
                <p className="eusg-keys">
                  Keyboard: with the image focused, the arrow keys move a crosshair and Enter marks
                  the point under it. Shift moves it further.
                </p>
              )}
            </section>
          )}

          {named && (
            <section className="eusg-legend" aria-label="In this image" data-eusg-legend>
              {landmarkRows.length > 0 && (
                <>
                  <h2>Landmarks of this view</h2>
                  <ol data-eusg-landmarks>
                    {landmarkRows.map((row) => (
                      <li
                        key={row.key}
                        data-structure={row.key}
                        data-number={row.number}
                        data-present={row.present ? 'true' : 'false'}
                        className={
                          row.present && row.key === pointedRow ? 'is-pointed' : undefined
                        }
                        onPointerEnter={row.present ? () => setLegendKey(row.key) : undefined}
                        onPointerLeave={row.present ? () => setLegendKey(null) : undefined}
                      >
                        <span className="eusg-legend__number" aria-hidden="true">
                          {row.number}
                        </span>
                        <span className="eusg-swatch" style={{ backgroundColor: row.color }} />
                        <span>
                          {row.label}
                          {!row.present && <small>Not in this image</small>}
                          {row.present && row.note && <small>{row.note}</small>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {landmarkRows.length === 0 && <h2>In this image</h2>}
              {landmarkRows.length > 0 && legend.length > 0 && <h2>Also in this image</h2>}
              {legend.length === 0 ? (
                landmarkRows.length === 0 && (
                  <p className="eusg-muted">Nothing in this image has a name.</p>
                )
              ) : (
                <ul>
                  {legend.map((row) => (
                    <li
                      key={row.key}
                      data-structure={row.key}
                      className={row.key === pointedRow ? 'is-pointed' : undefined}
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

        {views.length > 0 && session.pose && (
          <div className="eusg-views">
            {showEndoscope && (
              <div className="eusg-view" data-eusg-view="endoscope">
                <h2>White light view</h2>
                <EusEndoscopeView
                  manifest={manifest}
                  path={path}
                  pose={session.pose}
                  sMm={scope.sMm}
                  depthLabel={`≈ ${cm} cm`}
                  viewSwitch={null}
                  imageOnly
                />
              </div>
            )}
            {showAnatomy && (
              <div className="eusg-view" data-eusg-view="anatomy">
                <div className="eusg-view__head">
                  <h2>3D view</h2>
                  {(['heart', 'vessel'] as const)
                    .filter((group) => group !== targetGroup)
                    .map((group) => (
                      <button
                        key={group}
                        type="button"
                        className="eus-chip-button"
                        aria-pressed={help[group]}
                        data-eusg-layer={group}
                        onClick={() => setHelpState({ ...help, [group]: !help[group] })}
                      >
                        {group === 'heart' ? 'Heart' : 'Vessels'}
                      </button>
                    ))}
                </div>
                <EusAnatomyScene
                  manifest={manifest}
                  path={path}
                  pose={session.pose}
                  sMm={scope.sMm}
                  depthMm={depthMm}
                  layers={layers}
                  onLayers={IGNORE}
                  activeStructure={target?.key ?? null}
                  hoverStructure={null}
                  onHoverStructure={IGNORE}
                  namingEnabled={false}
                  structureAt={NAMES_NOTHING}
                  sectorCanvas={null}
                  subscribeFrames={NO_FRAMES}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
