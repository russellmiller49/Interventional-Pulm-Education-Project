'use client'

import { lazy, Suspense, type Dispatch } from 'react'

import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { McsLearnControlId } from '../../content/learnControls'
import type { McsMonitorTargetId } from '../../content/primarySurfaces'
import type { McsStageLesson, McsStageSurfaceId } from '../../content/stageLessons'
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import {
  CirculationMap,
  type CirculationMapAnswer,
  type CirculationMapEmphasis,
} from '../circulation-map/CirculationMap'
import { McsControls } from '../McsControls'
import { McsMonitor } from '../McsMonitor'
import styles from './mcs-stage.module.css'
import { McsTaskControls } from './McsTaskControls'
import { McsTimingFigure } from './McsTimingFigure'
import { McsTaskReadings } from './McsTaskReadings'
import type { McsLeadVisual, McsPresentationKind } from '../../content/taskPresentation'
import type { McsPointedPlace } from '../../content/readingPlaces'

const McsAnatomy3D = lazy(() =>
  import('../McsAnatomy3D').then((module) => ({ default: module.McsAnatomy3D })),
)

/**
 * The simulator pane: the right-hand pane of every task but the unloading comparison.
 *
 * Under the clock bar (the host's), every task opens on one picture, its lead visual: a timing lab
 * on its timing figure, a task read on the loop on the circulation map, and the rest (a patient
 * on a device, the controller's readings, the three pathways) on the heart and the device in
 * three dimensions. Then the task's own controls, the current readings, and the full monitor in a
 * disclosure that opens where the task points at it. Whichever of the map and the
 * three-dimensional view is not leading stays one press away. The module's one statement that
 * this is a teaching simulator is in the frame; the pane does not repeat it.
 */
export function McsSimulatorPane({
  lesson,
  presentation,
  leadVisual,
  state,
  dispatch,
  predictionCommitted,
  flowAccountWithheld,
  emphasis,
  mapAnswer,
  openSurfaces,
  onToggleSurface,
  teachingAvailable = false,
  allowedActionIds,
  focusedControls = false,
  highlightControl,
  monitorPointedAt = false,
  monitorOpen = monitorPointedAt,
  onMonitorToggle,
  stepKey,
  pointed = null,
  onPoint,
  readingsFocus,
  readingsBefore = null,
}: {
  readonly presentation: McsPresentationKind
  /** The picture this task opens on (see `mcsLeadVisual`). */
  readonly leadVisual: McsLeadVisual
  readonly lesson: McsStageLesson
  readonly state: McsSimulationState
  readonly dispatch: Dispatch<McsAction>
  readonly predictionCommitted: boolean
  readonly flowAccountWithheld: boolean
  readonly emphasis: CirculationMapEmphasis | null
  readonly mapAnswer: CirculationMapAnswer | null
  readonly highlightControl?: McsLearnControlId
  readonly openSurfaces: ReadonlySet<McsStageSurfaceId>
  readonly onToggleSurface: (surface: McsStageSurfaceId, open: boolean) => void
  /** The step id that opened the map on entry, or null. */
  readonly mapPreference: string | null
  readonly teachingAvailable?: boolean
  readonly allowedActionIds?: readonly string[]
  readonly focusedControls?: boolean
  /**
   * Whether this step's words point at a region of the monitor ("Look here: Arterial pressure
   * trace"). The full monitor then starts open, so the thing named is on screen (F03).
   */
  readonly monitorPointedAt?: boolean
  readonly monitorOpen?: boolean
  readonly onMonitorToggle?: (open: boolean) => void
  /** The step on screen: each step starts its disclosures in that step's own default. */
  readonly stepKey?: string
  /**
   * The reading the learner is pointing at, lit on the map, the heart and the monitor. `onPoint`
   * is absent where pointing is off (a place on the map is the question): the readings are then
   * plain rows.
   */
  readonly pointed?: McsPointedPlace | null
  readonly onPoint?: (place: McsPointedPlace | null) => void
  /** On an Observe task: the readings its instruction names, and the values before the change. */
  readonly readingsFocus?: readonly (keyof McsDerivedMetrics)[]
  readonly readingsBefore?: McsDerivedMetrics | null
}) {
  const monitorTarget: McsMonitorTargetId | undefined =
    lesson.contract.primarySurface === 'monitor'
      ? (lesson.contract.primaryTarget as McsMonitorTargetId)
      : undefined

  const map = (
    <div
      data-map-anchor
      role="group"
      aria-label="Circulation map scroll area"
      className={styles.readableMap}
      tabIndex={0}
    >
      <CirculationMap
        state={state}
        emphasis={
          pointed
            ? { segmentIds: pointed.segmentIds, caption: pointed.sentence, tone: 'implicated' }
            : emphasis
        }
        answer={mapAnswer}
      />
    </div>
  )

  const fullMonitor = (
    <McsMonitor
      state={state}
      highlightTarget={pointed?.monitorTarget ?? monitorTarget}
      highlightNote={predictionCommitted}
      revealCausality={predictionCommitted || teachingAvailable}
      withheldNote="What produced this display appears once you have committed your prediction."
      withholdFlowAccount={flowAccountWithheld}
    />
  )

  const showMap =
    presentation === 'circulation-reader' ||
    (presentation === 'mechanism-comparison' && !teachingAvailable) ||
    presentation === 'pump-loading-lab' ||
    mapAnswer !== null
  const controls = allowedActionIds?.some(
    (id) =>
      !id.startsWith('inspect:') && !id.startsWith('device:select:') && id !== 'team:escalate',
  )
  const anatomyOpen = openSurfaces.has('anatomy')
  /*
   * The heart and the device lead where the task's picture is the device itself. Open, the view
   * takes the lead column beside the readings; closed by the learner, or left closed on a window
   * too small for it, the circulation map opens in its place so the pane still shows a picture.
   */
  const anatomyLeads = leadVisual === 'anatomy' && !showMap && anatomyOpen
  const mapStandsIn = leadVisual === 'anatomy' && !showMap && !anatomyOpen
  const anatomy =
    predictionCommitted || teachingAvailable ? (
      <section data-surface="anatomy" data-leading={anatomyLeads || undefined}>
        <button
          type="button"
          aria-expanded={anatomyOpen}
          onClick={() => onToggleSurface('anatomy', !anatomyOpen)}
        >
          Three-dimensional view
        </button>
        {anatomyOpen ? (
          <SimulationLaunchGate
            activityTitle="Three-dimensional view of the heart and the device"
            minimumViewport="desktop"
            bandwidthClass="heavy"
            estimatedSizeLabel="Interactive heart and device model"
            lightweightAlternativeHref="/critical-care/reference?item=mcs-cardiac-text-summary"
            theme="dark"
          >
            <Suspense
              fallback={<p className={shellStyles.meta}>Loading the three-dimensional view…</p>}
            >
              <McsAnatomy3D state={state} compact={anatomyLeads} pointed={pointed} />
            </Suspense>
          </SimulationLaunchGate>
        ) : null}
      </section>
    ) : null
  return (
    <div
      className={styles.simulator}
      data-simulator-surfaces
      data-lead-visual={leadVisual}
      data-map-leads={showMap || undefined}
      data-anatomy-leads={anatomyLeads || undefined}
    >
      {/*
       * The reference's legend and measured limits start open on the first timing step and on
       * the step that names the relationship; on the demonstrations between they are folded,
       * keyed by step so each step starts from its own default (F39).
       */}
      {presentation === 'timing-lab' ? (
        <McsTimingFigure
          key={`timing-${stepKey ?? ''}`}
          state={state}
          detailOpen={
            stepKey === undefined ||
            stepKey.endsWith('-normal-beat') ||
            stepKey.endsWith('-recognize')
          }
        />
      ) : null}
      {showMap ? (
        <section data-surface="map">
          <h3>Circulation map</h3>
          {map}
        </section>
      ) : null}
      {anatomyLeads ? anatomy : null}
      {controls ? (
        <section data-surface="controls">
          <h3>Controls for this task</h3>
          {focusedControls ? (
            <McsTaskControls
              state={state}
              dispatch={dispatch}
              allowedActionIds={allowedActionIds ?? []}
            />
          ) : (
            <McsControls
              state={state}
              dispatch={dispatch}
              highlightControl={highlightControl}
              allowedActionIds={allowedActionIds}
            />
          )}
        </section>
      ) : null}
      {!(
        teachingAvailable &&
        (presentation === 'circulation-reader' || presentation === 'mechanism-comparison')
      ) ? (
        <McsTaskReadings
          state={state}
          kind={presentation}
          withholdFlow={flowAccountWithheld}
          pointed={pointed}
          onPoint={onPoint}
          focus={readingsFocus}
          before={readingsBefore}
        />
      ) : null}
      {/*
       * Collapsed by default, except on the steps whose own words say "Look here" at one of its
       * traces (F03). It is keyed by step, so a learner who closes it keeps that preference on
       * revisit; each unvisited step starts at its own default. Opening or closing it is display
       * only: no model action, no clock tick, no progress.
       */}
      <details
        key={`monitor-${stepKey ?? ''}`}
        open={monitorOpen}
        onToggle={(event) => onMonitorToggle?.(event.currentTarget.open)}
        data-monitor-disclosure
        data-monitor-pointed-at={monitorPointedAt || undefined}
      >
        <summary>Full monitor and derived measurements</summary>
        {fullMonitor}
      </details>
      {!showMap ? (
        <details key={`map-${stepKey ?? ''}-${mapStandsIn}`} open={mapStandsIn || undefined}>
          <summary>Circulation map</summary>
          {map}
        </details>
      ) : null}
      {anatomyLeads ? null : anatomy}
    </div>
  )
}
