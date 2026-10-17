'use client'

import { lazy, Suspense, type Dispatch } from 'react'

import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { McsLearnControlId } from '../../content/learnControls'
import type { McsMonitorTargetId } from '../../content/primarySurfaces'
import type { McsStageLesson, McsStageSurfaceId } from '../../content/stageLessons'
import type { McsAction, McsSimulationState } from '../../engine/types'
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
import type { McsPresentationKind } from '../../content/taskPresentation'

const McsAnatomy3D = lazy(() =>
  import('../McsAnatomy3D').then((module) => ({ default: module.McsAnatomy3D })),
)

/**
 * The simulator pane: the right-hand pane of every task but the unloading comparison.
 *
 * Under the clock bar (the host's), a timing lab leads with its timing figure, then the circulation
 * map where the task reads or answers on it, the task's own controls, the current readings, the
 * full monitor in a disclosure that opens where the task points at it, and the three-dimensional
 * view on request. The module's one statement that this is a teaching simulator is in the frame;
 * the pane does not repeat it.
 */
export function McsSimulatorPane({
  lesson,
  presentation,
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
}: {
  readonly presentation: McsPresentationKind
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
      <CirculationMap state={state} emphasis={emphasis} answer={mapAnswer} />
    </div>
  )

  const fullMonitor = (
    <McsMonitor
      state={state}
      highlightTarget={monitorTarget}
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
  return (
    <div className={styles.simulator} data-simulator-surfaces data-map-leads={showMap || undefined}>
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
        <McsTaskReadings state={state} kind={presentation} withholdFlow={flowAccountWithheld} />
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
        <details>
          <summary>Circulation map</summary>
          {map}
        </details>
      ) : null}
      {predictionCommitted || teachingAvailable ? (
        <section data-surface="anatomy">
          <button
            type="button"
            aria-expanded={openSurfaces.has('anatomy')}
            onClick={() => onToggleSurface('anatomy', !openSurfaces.has('anatomy'))}
          >
            Three-dimensional view
          </button>
          {openSurfaces.has('anatomy') ? (
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
                <McsAnatomy3D state={state} />
              </Suspense>
            </SimulationLaunchGate>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
