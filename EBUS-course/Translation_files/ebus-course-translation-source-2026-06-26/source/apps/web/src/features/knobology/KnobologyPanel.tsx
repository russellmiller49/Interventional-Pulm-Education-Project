import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { EducationSectionCard } from '@/components/education/EducationModuleRenderer';
import { knobologyAdvancedContent } from '@/content/education';
import { knobologyContent, knobologyControlMeta, knobologyReferenceCards } from '@/content/knobology';
import { getKnobologyMedia } from '@/content/media';
import type { KnobologyControlId } from '@/content/types';
import { KnobologySegmentVideo } from '@/features/knobology/KnobologySegmentVideo';
import { getKnobologyLearnMoreSections } from '@/features/knobology/learnMore';
import euMe2LayoutData from '@/features/knobology/processor/eu-me2-layout.json';
import { EuMe2Keyboard } from '@/features/knobology/processor/EuMe2Keyboard';
import type { EuMe2Hotspot, EuMe2Layout } from '@/features/knobology/processor/types';
import { useKnobologyVideoLookup } from '@/features/knobology/useKnobologyVideoLookup';
import {
  getKnobologyVideoDepthCm,
  getKnobologyVideoSegmentSrc,
  resolveKnobologyVideoSegment,
  type KnobologyBModeSegmentControl,
  type KnobologyFlowSegmentMode,
  type ResolvedKnobologyVideoSegment,
} from '@/features/knobology/videoSegments';
import {
  buildFrameMetrics,
  createKnobologyFrameState,
  evaluateExercise,
  getMeasurementDistanceMmForDepthCm,
  reduceKnobologyFrameState,
  type KnobologyMenuMode,
  type KnobologyProcessorActionId,
} from '@/features/knobology/logic';
import { mapNestedAssetPaths } from '@/lib/assets';
import { useLearnerProgress } from '@/lib/progress';

import './knobology.css';

const euMe2Layout = mapNestedAssetPaths(euMe2LayoutData as EuMe2Layout);

const KEYBOARD_FEEDBACK_CONTROLS = ['depth', 'gain', 'contrast'] as const;
const FLOW_PREVIEW_MODES = ['color', 'power', 'h-flow'] as const;
const FLOW_PREVIEW_MODE_LABELS: Record<KnobologyFlowSegmentMode, string> = {
  color: 'Color Flow',
  power: 'Power Flow',
  'h-flow': 'H-flow',
};

function isHotspotVisibleForMenu(hotspot: EuMe2Hotspot, menuMode: KnobologyMenuMode) {
  return hotspot.visibleInMenus ? hotspot.visibleInMenus.includes(menuMode) : true;
}

function getControlForAction(actionId: KnobologyProcessorActionId): KnobologyControlId | null {
  switch (actionId) {
    case 'GAIN_DOWN':
    case 'GAIN_UP':
      return 'gain';
    case 'OPEN_IMAGE_ADJUST':
    case 'TOGGLE_ENHANCE':
    case 'THE_OFF':
    case 'THE_P':
    case 'THE_R':
      return 'contrast';
    case 'DEPTH_UP':
    case 'FOCUS_CYCLE':
    case 'FOCUS_DOWN':
    case 'FOCUS_UP':
      return 'depth';
    case 'FLOW_MODE':
    case 'B_MODE':
    case 'PW_MODE':
      return 'color-doppler';
    case 'TRACE_MODE':
    case 'MEASURE_MODE':
    case 'MEASURE_SET':
    case 'CLEAR':
      return 'calipers';
    case 'TOGGLE_FREEZE':
    case 'CINE_REVIEW_MODE':
    case 'CINE_STEP_BACK':
    case 'CINE_PLAY_PAUSE':
    case 'CINE_STEP_FORWARD':
      return 'freeze';
    case 'SAVE_REC':
      return 'save';
    default:
      return null;
  }
}

function getActiveBModeSegmentControl(
  activeControl: KnobologyControlId,
  lastKeyboardControl: KnobologyControlId | null,
): KnobologyBModeSegmentControl {
  if (lastKeyboardControl === 'gain' || lastKeyboardControl === 'contrast' || lastKeyboardControl === 'depth') {
    return lastKeyboardControl;
  }

  if (activeControl === 'gain' || activeControl === 'contrast' || activeControl === 'depth') {
    return activeControl;
  }

  return 'depth';
}

function buildMeasurementLineModel(
  start: { x: number; y: number } | null,
  end: { x: number; y: number } | null,
  distanceMm: number | null,
) {
  if (!start) {
    return null;
  }

  if (!end) {
    return {
      angle: 0,
      distanceLabel: null,
      end: start,
      length: 0,
      midX: start.x,
      midY: start.y,
      start,
    };
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  return {
    angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
    distanceLabel: distanceMm !== null ? `${distanceMm.toFixed(1)} mm` : null,
    end,
    length: Math.sqrt(deltaX ** 2 + deltaY ** 2),
    midX: (start.x + end.x) / 2,
    midY: (start.y + end.y) / 2,
    start,
  };
}

export function KnobologyPanel({ processorDebug = false }: { processorDebug?: boolean }) {
  const { setLastUsedKnobologyControl, setModuleProgress, state: progressState } = useLearnerProgress();
  const [activeExerciseId, setActiveExerciseId] = useState(knobologyContent.controlLabExercises[0]?.id ?? '');
  const [activeControl, setActiveControl] = useState<KnobologyControlId>(
    progressState.lastUsedKnobologyControl ?? 'depth',
  );
  const [referenceFilter, setReferenceFilter] = useState('');
  const [showLearnMore, setShowLearnMore] = useState(true);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [flowPreviewMode, setFlowPreviewMode] = useState<KnobologyFlowSegmentMode>('color');
  const [frozenSegmentSnapshot, setFrozenSegmentSnapshot] = useState<ResolvedKnobologyVideoSegment | null>(null);
  const wasFrozenRef = useRef(false);
  const videoLookupState = useKnobologyVideoLookup();
  const activeExercise =
    knobologyContent.controlLabExercises.find((exercise) => exercise.id === activeExerciseId) ??
    knobologyContent.controlLabExercises[0];
  const [frameState, dispatchFrame] = useReducer(reduceKnobologyFrameState, activeExercise, createKnobologyFrameState);

  useEffect(() => {
    dispatchFrame({ type: 'RESET_FOR_EXERCISE', exercise: activeExercise });
    setActiveControl(activeExercise.focusControl);
  }, [activeExercise]);

  useEffect(() => {
    setLastUsedKnobologyControl(activeControl);
  }, [activeControl, setLastUsedKnobologyControl]);

  useEffect(() => {
    if (!frameState.cinePlaying) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      dispatchFrame({ type: 'PROCESSOR_ACTION', actionId: 'CINE_STEP_FORWARD' });
    }, 420);

    return () => window.clearInterval(timer);
  }, [frameState.cinePlaying]);

  const frameMetrics = buildFrameMetrics(frameState);
  const evaluation = evaluateExercise(activeExercise, frameState);
  const dopplerEnabled = frameState.colorDoppler;
  const safePathSelected = selectedPathId === knobologyContent.dopplerLab.safePathId;
  const dopplerMedia = getKnobologyMedia('color-doppler');
  const deferredReferenceFilter = useDeferredValue(referenceFilter);
  const learnMoreSections = getKnobologyLearnMoreSections(activeControl, knobologyAdvancedContent.sections);
  const filteredReferenceCards = knobologyReferenceCards.filter((card) => {
    const query = deferredReferenceFilter.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      card.title.toLowerCase().includes(query) ||
      card.whenToUse.toLowerCase().includes(query) ||
      card.whatChanges.toLowerCase().includes(query)
    );
  });
  const visibleProcessorHotspots = useMemo(
    () => euMe2Layout.hotspots.filter((hotspot) => isHotspotVisibleForMenu(hotspot, frameState.menu)),
    [frameState.menu],
  );
  const processorLayout = useMemo(
    () => ({
      ...euMe2Layout,
      hotspots: visibleProcessorHotspots,
    }),
    [visibleProcessorHotspots],
  );
  const compactTouchButtons = useMemo(
    () =>
      visibleProcessorHotspots
        .filter((hotspot) => hotspot.id.startsWith('touch_'))
        .map((hotspot) => ({
          actionId: hotspot.action,
          label: hotspot.label,
        })),
    [visibleProcessorHotspots],
  );
  const lastKeyboardControl = frameState.lastActionId ? getControlForAction(frameState.lastActionId) : null;
  const activeBModeSegmentControl = getActiveBModeSegmentControl(activeControl, lastKeyboardControl);
  const controlLabFlowMode: KnobologyFlowSegmentMode | null =
    frameState.mode === 'flow' ? 'color' : frameState.mode === 'pw' ? 'power' : null;
  const activeVideoMedia = controlLabFlowMode
    ? dopplerMedia
    : getKnobologyMedia(
        activeBModeSegmentControl === 'contrast'
          ? 'contrast'
          : activeBModeSegmentControl === 'gain'
            ? 'gain'
            : 'depth',
      );
  const controlLabSegment = videoLookupState.lookup
    ? resolveKnobologyVideoSegment(videoLookupState.lookup, {
        depth: frameState.depth,
        gain: frameState.gain,
        contrast: frameState.contrast,
        control: activeBModeSegmentControl,
        flowMode: controlLabFlowMode,
      })
    : null;
  const displayedControlLabSegment = frameState.frozen ? frozenSegmentSnapshot ?? controlLabSegment : controlLabSegment;
  const activeDepthCm = displayedControlLabSegment?.segment.depth ?? getKnobologyVideoDepthCm(frameState.depth);
  const dopplerPreviewSegment = videoLookupState.lookup
    ? resolveKnobologyVideoSegment(videoLookupState.lookup, {
        depth: frameState.depth,
        gain: frameState.gain,
        contrast: frameState.contrast,
        control: 'depth',
        flowMode: dopplerEnabled ? flowPreviewMode : null,
      })
    : null;
  const videoTimelineStatus =
    videoLookupState.status === 'error' ? 'Video timeline unavailable' : 'Loading video timeline';
  const measurementDistanceMm =
    frameState.measurementPoints > 1 && frameState.measurementEnd
      ? getMeasurementDistanceMmForDepthCm(activeDepthCm, frameState.measurementStart, frameState.measurementEnd)
      : null;
  const measurementLineModel = buildMeasurementLineModel(
    frameState.measurementStart,
    frameState.measurementEnd,
    measurementDistanceMm,
  );
  const activeMeasurementMarker = frameState.activeMeasurementMarker;
  const trackballActive = frameState.frozen && frameState.measurementMode === 'measure';
  const keyboardFeedbackCards = KEYBOARD_FEEDBACK_CONTROLS.map((controlId) => {
    const currentValue = frameState[controlId];
    const targetValue = activeExercise.target[controlId];
    const delta = currentValue - targetValue;
    const absDelta = Math.abs(delta);
    const isExerciseFocus = activeExercise.focusControl === controlId;
    const isKeyboardActive = activeControl === controlId;
    const hasRecentKeyboardChange = lastKeyboardControl === controlId;

    if (controlId === 'depth') {
      return {
        controlId,
        currentValue,
        targetValue,
        isExerciseFocus,
        isKeyboardActive,
        hasRecentKeyboardChange,
        status:
          absDelta <= 8
            ? 'Framing is close to target.'
            : delta < 0
              ? 'Need more depth.'
              : 'Depth is running long.',
        guidance:
          absDelta <= 8
            ? 'The node is sitting in a more usable part of the frame.'
            : delta < 0
              ? 'Use DEPTH/RANGE +/- on the processor until more tissue opens below the node.'
              : 'Cycle depth back once the target starts dropping into unused space.',
      };
    }

    if (controlId === 'gain') {
      return {
        controlId,
        currentValue,
        targetValue,
        isExerciseFocus,
        isKeyboardActive,
        hasRecentKeyboardChange,
        status:
          absDelta <= 8
            ? 'Brightness is close to target.'
            : delta < 0
              ? 'Frame still looks undergained.'
              : 'The image is washing out.',
        guidance:
          absDelta <= 8
            ? 'Target borders are readable without flooding the screen.'
            : delta < 0
              ? 'Use GAIN + until the target border separates from the background.'
              : 'Tap GAIN - to recover detail and keep the frame from looking chalky.',
      };
    }

    return {
      controlId,
      currentValue,
      targetValue,
      isExerciseFocus,
      isKeyboardActive,
      hasRecentKeyboardChange,
      status:
        absDelta <= 8
          ? 'Edge definition is close to target.'
          : delta < 0
            ? 'Contrast is still too flat.'
            : 'Contrast is too aggressive.',
      guidance:
        absDelta <= 8
          ? 'The target is separating from the haze more cleanly now.'
          : delta < 0
            ? 'Open IMAGE ADJUST and tap contrast + until the border definition starts to recover.'
            : 'Tap contrast - in IMAGE ADJUST if the border starts to look overly harsh.',
    };
  });

  useEffect(() => {
    if (frameState.frozen && !wasFrozenRef.current) {
      setFrozenSegmentSnapshot(controlLabSegment);
    }

    if (!frameState.frozen && wasFrozenRef.current) {
      setFrozenSegmentSnapshot(null);
    }

    wasFrozenRef.current = frameState.frozen;
  }, [controlLabSegment, frameState.frozen]);

  function markExerciseSolved() {
    if (evaluation.solved) {
      setModuleProgress('knobology', 55);
    }
  }

  function handleProcessorAction(actionId: KnobologyProcessorActionId) {
    dispatchFrame({ type: 'PROCESSOR_ACTION', actionId });

    const mappedControl = getControlForAction(actionId);

    if (mappedControl) {
      setActiveControl(mappedControl);
    }

    if (actionId === 'SAVE_REC') {
      setModuleProgress('knobology', 70);
    }

    if (actionId === 'FLOW_MODE') {
      setModuleProgress('knobology', 80);
    }

    if (actionId === 'MEASURE_MODE' || actionId === 'MEASURE_SET' || actionId === 'TRACE_MODE') {
      setModuleProgress('knobology', 60);
    }
  }

  function handleTrackballMove(delta: { x: number; y: number }) {
    dispatchFrame({
      type: 'MOVE_TRACKBALL',
      deltaX: delta.x,
      deltaY: delta.y,
    });
  }

  return (
    <div className="knobology-panel">
      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Primer</div>
            <h2>Control sequence before you touch the needle</h2>
          </div>
        </div>
        <div className="mini-card-grid">
          {knobologyContent.primerSections.map((section) => (
            <article key={section.id} className="mini-card">
              <div className="mini-card__title">
                <span>{knobologyControlMeta[section.id as KnobologyControlId]?.icon ?? '•'}</span>
                <strong>{section.title}</strong>
              </div>
              <p>{section.summary}</p>
              <div className="mini-card__footer">
                <span>Best move: {section.bestMove}</span>
                <span>Pitfall: {section.pitfall}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Fix The Image</div>
            <h2>Control lab</h2>
          </div>
          <select
            aria-label="Select image rescue exercise"
            className="select"
            onChange={(event) => setActiveExerciseId(event.target.value)}
            value={activeExercise.id}
          >
            {knobologyContent.controlLabExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.title}
              </option>
            ))}
          </select>
        </div>

        <div className="knobology-lab">
          <div className="knobology-workbench">
            <div className="stack-card knobology-frame">
              <div className="knobology-frame__screen">
                <div className="knobology-frame__video-shell">
                  {displayedControlLabSegment ? (
                    <KnobologySegmentVideo
                      ariaLabel="Timestamped EBUS video segment used for the knobology control lab"
                      className="knobology-frame__video"
                      paused={frameState.frozen && !frameState.cinePlaying}
                      segment={displayedControlLabSegment.segment}
                      src={getKnobologyVideoSegmentSrc(displayedControlLabSegment.segment.depth)}
                    />
                  ) : (
                    <div className="knobology-frame__video-empty">
                      <span>{videoTimelineStatus}</span>
                    </div>
                  )}
                </div>

                {frameState.measurementMode === 'measure' && frameState.measurementStart ? (
                  <div className="knobology-frame__measurement-layer">
                    <div className="knobology-frame__measurement-panel">
                      <span>D1:</span>
                      <strong>{measurementDistanceMm !== null ? `${measurementDistanceMm.toFixed(1)} mm` : '-- mm'}</strong>
                      <span>D2:</span>
                      <strong>-- mm</strong>
                    </div>
                    {measurementLineModel && frameState.measurementEnd ? (
                      <>
                        <div
                          className="knobology-frame__measurement-line"
                          style={{
                            left: `${measurementLineModel.start.x * 100}%`,
                            top: `${measurementLineModel.start.y * 100}%`,
                            transform: `translateY(-50%) rotate(${measurementLineModel.angle}deg)`,
                            width: `${measurementLineModel.length * 100}%`,
                          }}
                        />
                        <span
                          className="knobology-frame__measurement-label"
                          style={{
                            left: `${measurementLineModel.end.x * 100}%`,
                            top: `${measurementLineModel.end.y * 100}%`,
                          }}
                        >
                          D1
                        </span>
                      </>
                    ) : null}
                    {[frameState.measurementStart, frameState.measurementEnd].map((point, index) =>
                      point ? (
                        <span
                          key={`${index}-${point.x}-${point.y}`}
                          className={`knobology-frame__measurement-marker${activeMeasurementMarker === index ? ' knobology-frame__measurement-marker--active' : ''}`}
                          style={{
                            left: `${point.x * 100}%`,
                            top: `${point.y * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                ) : null}
                {frameState.pipEnabled && displayedControlLabSegment ? (
                  <div className="knobology-frame__pip" style={{ opacity: frameMetrics.pipOpacity }}>
                    <strong>{displayedControlLabSegment.label}</strong>
                    <span>PIP</span>
                  </div>
                ) : null}
                {frameState.commentCount > 0 ? (
                  <div className="knobology-frame__comments">
                    {Array.from({ length: frameState.commentCount }).map((_, index) => (
                      <span
                        key={index}
                        className="knobology-frame__comment"
                        style={{
                          left: `${18 + index * 14}%`,
                          top: `${22 + index * 12}%`,
                        }}
                      >
                        Note {index + 1}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div
                aria-label="Control lab keyboard feedback, rescue guidance, and learn more reference"
                className="knobology-lab-notes"
                tabIndex={0}
              >
                <section className="knobology-lab-notes__section knobology-keyboard-feedback">
                  <div className="eyebrow">Keyboard feedback</div>
                  <p>
                    The processor is now the only control surface here. Depth, gain, and contrast highlight as you change
                    them from the keyboard.
                  </p>
                  <div className="knobology-keyboard-feedback__grid">
                    {keyboardFeedbackCards.map((card) => (
                      <article
                        key={card.controlId}
                        className={`knobology-keyboard-feedback__card${card.isKeyboardActive ? ' knobology-keyboard-feedback__card--active' : ''}${card.isExerciseFocus ? ' knobology-keyboard-feedback__card--focus' : ''}`}
                      >
                        <div className="knobology-keyboard-feedback__header">
                          <div className="mini-card__title">
                            <span>{knobologyControlMeta[card.controlId].icon}</span>
                            <strong>{knobologyControlMeta[card.controlId].shortLabel}</strong>
                          </div>
                          <div className="tag-row">
                            {card.isExerciseFocus ? <span className="tag">Exercise focus</span> : null}
                            {card.hasRecentKeyboardChange ? <span className="tag">Recent keyboard change</span> : null}
                          </div>
                        </div>
                        <div className="knobology-keyboard-feedback__values">
                          <span>Current {card.currentValue}</span>
                          <span>Target {card.targetValue}</span>
                        </div>
                        <strong className="knobology-keyboard-feedback__status">
                          {card.hasRecentKeyboardChange ? frameState.statusMessage : card.status}
                        </strong>
                        <p>{card.guidance}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="knobology-lab-notes__section knobology-rescue-panel">
                  <div className="knobology-lab-notes__heading">
                    <div className="eyebrow">Rescue</div>
                    <h3>{activeExercise.title}</h3>
                    <p>{activeExercise.symptom}</p>
                  </div>
                  <p className="knobology-frame__status-line">{frameState.statusMessage}</p>
                  {activeVideoMedia.caption ? (
                    <p className="knobology-frame__media-note">{activeVideoMedia.caption}</p>
                  ) : null}
                  <div>
                    <div className="eyebrow">Instructions</div>
                    <p>{activeExercise.instructions}</p>
                  </div>
                  <div className={`feedback-banner${evaluation.solved ? ' feedback-banner--success' : ''}`}>
                    <strong>{evaluation.solved ? 'Solved' : `Score ${evaluation.score}`}</strong>
                    <p>{evaluation.feedback}</p>
                  </div>
                  <div className="button-row">
                    <button
                      className="button button--ghost"
                      onClick={() => dispatchFrame({ type: 'RESET_FOR_EXERCISE', exercise: activeExercise })}
                      type="button"
                    >
                      Reset frame
                    </button>
                    <button className="button" onClick={markExerciseSolved} type="button">
                      Save progress
                    </button>
                  </div>
                </section>

                <section className="learn-more-drawer knobology-lab-notes__section">
                  <div className="learn-more-drawer__header">
                    <div>
                      <div className="eyebrow">Learn More</div>
                      <h3>{knobologyControlMeta[activeControl].shortLabel} in context</h3>
                      <p>Reference content now follows the control you are actively adjusting.</p>
                    </div>
                    <button
                      className="button button--ghost"
                      onClick={() => setShowLearnMore((current) => !current)}
                      type="button"
                    >
                      {showLearnMore ? 'Hide reference' : 'Show reference'}
                    </button>
                  </div>
                  {showLearnMore ? (
                    <div className="learn-more-drawer__content">
                      {learnMoreSections.map((section) => (
                        <EducationSectionCard key={section.id} section={section} />
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            </div>

            <div className="stack-card knobology-console">
              <div className="knobology-console__prompt">
                <div className="eyebrow">Interactive processor</div>
                <strong>Tap a glowing control on the processor to update the ultrasound image.</strong>
              </div>

              <EuMe2Keyboard
                activeActionId={frameState.lastActionId}
                debug={processorDebug}
                layout={processorLayout}
                menuMode={frameState.menu}
                onAction={handleProcessorAction}
                onTrackballMove={handleTrackballMove}
                showHotspotHints
                trackballActive={trackballActive}
              />

              <div className="knobology-console__details">
                <div className="knobology-console__hero">
                  <div>
                    <h3>Use the processor and touch panel together.</h3>
                    <p>
                      Freeze first, then tap `CALIPER` to drop the initial cursor. The trackball moves the active
                      marker, `SET` fixes the first point and arms the second, and `CURSOR` swaps between the two if
                      you want to fine-tune the measurement.
                    </p>
                  </div>
                </div>

                <div className="tag-row">
                  <span className="tag">Glowing overlays = tappable controls</span>
                  <span className="tag">Touch panel hotspots change with the active screen</span>
                  <span className="tag">Trackball drives calipers on frozen images</span>
                </div>

                <div className="knobology-console__touch-panel">
                  <div className="eyebrow">Touch panel mirror</div>
                  <div className="button-row button-row--wrap">
                    {compactTouchButtons.map((button) => (
                      <button
                        key={button.actionId}
                        className={`control-pill${frameState.lastActionId === button.actionId ? ' control-pill--active' : ''}`}
                        onClick={() => handleProcessorAction(button.actionId)}
                        type="button"
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Doppler mini-lab</div>
            <h2>{knobologyContent.dopplerLab.title}</h2>
          </div>
        </div>
        <div className="split-grid">
          <div className="stack-card">
            <p>{knobologyContent.dopplerLab.brief}</p>
            <div className="doppler-lab">
              <div className="doppler-lab__frame">
                {dopplerPreviewSegment ? (
                  <KnobologySegmentVideo
                    ariaLabel="Timestamped EBUS flow video segment"
                    className="doppler-lab__video"
                    segment={dopplerPreviewSegment.segment}
                    src={getKnobologyVideoSegmentSrc(dopplerPreviewSegment.segment.depth)}
                  />
                ) : (
                  <div className="knobology-frame__video-empty">
                    <span>{videoTimelineStatus}</span>
                  </div>
                )}
                <span className="doppler-lab__state">
                  {dopplerEnabled ? FLOW_PREVIEW_MODE_LABELS[flowPreviewMode] : 'Doppler off'}
                </span>
                <span className="doppler-lab__label">
                  {dopplerPreviewSegment?.label ?? dopplerMedia.caption ?? 'Toggle Doppler to reveal flow'}
                </span>
              </div>
              <div className="button-row button-row--wrap">
                <button
                  className={`button${dopplerEnabled ? ' button--ghost' : ''}`}
                  onClick={() => handleProcessorAction(dopplerEnabled ? 'B_MODE' : 'FLOW_MODE')}
                  type="button"
                >
                  {dopplerEnabled ? 'Doppler Off' : 'Doppler On'}
                </button>
                {FLOW_PREVIEW_MODES.map((mode) => (
                  <button
                    key={mode}
                    className={`control-pill${dopplerEnabled && flowPreviewMode === mode ? ' control-pill--active' : ''}`}
                    onClick={() => {
                      setFlowPreviewMode(mode);

                      if (!dopplerEnabled) {
                        handleProcessorAction('FLOW_MODE');
                      }
                    }}
                    type="button"
                  >
                    {FLOW_PREVIEW_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="stack-card">
            <div className="eyebrow">Path challenge</div>
            <p>{knobologyContent.dopplerLab.prompt}</p>
            <div className="stack-list">
              {knobologyContent.dopplerLab.paths.map((path) => (
                <button
                  key={path.id}
                  className={`choice-card${selectedPathId === path.id ? ' choice-card--selected' : ''}`}
                  onClick={() => {
                    setSelectedPathId(path.id);
                    if (path.id === knobologyContent.dopplerLab.safePathId) {
                      setModuleProgress('knobology', 90);
                    }
                  }}
                  type="button"
                >
                  <strong>{path.label}</strong>
                  <span>{path.description}</span>
                </button>
              ))}
            </div>
            {selectedPathId ? (
              <div className={`feedback-banner${safePathSelected ? ' feedback-banner--success' : ''}`}>
                <strong>{safePathSelected ? 'Safe path selected' : 'Try again'}</strong>
                <p>
                  {safePathSelected
                    ? 'The selected path routes around the color-filled vessel instead of crossing it.'
                    : 'That path still crosses Doppler signal. Pick the trajectory that avoids the color-filled vessel.'}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-card__heading">
          <div>
            <div className="eyebrow">Quick reference</div>
            <h2>Searchable control cards</h2>
          </div>
          <input
            aria-label="Filter quick reference cards"
            className="input"
            onChange={(event) => setReferenceFilter(event.target.value)}
            placeholder="Filter by control or scenario…"
            type="search"
            value={referenceFilter}
          />
        </div>
        <div className="mini-card-grid">
          {filteredReferenceCards.map((card) => (
            <article key={card.id} className="mini-card">
              <div className="mini-card__title">
                <span>{knobologyControlMeta[card.id].icon}</span>
                <strong>{card.title}</strong>
              </div>
              <p>{card.whenToUse}</p>
              <div className="mini-card__footer">
                <span>{card.whatChanges}</span>
                <span>{card.noviceTrap}</span>
                <span>{getKnobologyMedia(card.id).caption ?? ''}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
