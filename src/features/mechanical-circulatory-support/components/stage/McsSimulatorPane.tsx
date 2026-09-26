'use client'

import { lazy, Suspense, useEffect, useId, useRef, type Dispatch } from 'react'

import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { McsLearnControlId } from '../../content/learnControls'
import type { McsMonitorTargetId } from '../../content/primarySurfaces'
import {
  MCS_STAGE_SURFACES,
  MCS_STAGE_SURFACE_LABELS,
  type McsStageLesson,
  type McsStageSurfaceId,
} from '../../content/stageLessons'
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
 * The simulator pane: the bedside monitor always, and three surfaces beside it.
 *
 * The circulation map, the controls and the three-dimensional view each sit behind a disclosure.
 * Every surface stays mounted; closed is `hidden`, not unmounted, so the controls keep their ids
 * and a step's spotlight can open-then-find. The map scrolls its own pane into view when a step
 * opens it, so the marked place is on screen without a click.
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
  highlightControl,
  openSurfaces,
  onToggleSurface,
  mapPreference,
  teachingAvailable = false,
  timingIdentification = false,
  allowedActionIds,
  focusedControls = false,
  monitorPointedAt = false,
  stepKey,
}: {
  readonly presentation?: McsPresentationKind
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
  /** The step id that opened the map on entry, or null; the map scrolls into view once per value. */
  readonly mapPreference: string | null
  readonly teachingAvailable?: boolean
  readonly timingIdentification?: boolean
  readonly allowedActionIds?: readonly string[]
  readonly focusedControls?: boolean
  /**
   * Whether this step's words point at a region of the monitor ("Look here: Arterial pressure
   * trace"). The full monitor then starts open, so the thing named is on screen (F03).
   */
  readonly monitorPointedAt?: boolean
  /** The step on screen: each step starts its disclosures in that step's own default. */
  readonly stepKey?: string
}) {
  const baseId = useId()
  const mapRef = useRef<HTMLDivElement>(null)
  const monitorTarget: McsMonitorTargetId | undefined =
    lesson.contract.primarySurface === 'monitor'
      ? (lesson.contract.primaryTarget as McsMonitorTargetId)
      : undefined

  /*
   * A step that opens the map leads with it: the map sits above the monitor, at the top of the
   * pane, so the marked place is on screen without scrolling. Scrolling the pane to the map was
   * tried first and could not be made to land — the monitor above it re-flows for seconds after a
   * step is entered, and its alarm band changes height with the ticks — so the order of the
   * surfaces carries the emphasis instead, the way the section contracts already say which surface
   * leads. On every step the pane starts at its top.
   */
  const mapLeads = mapPreference !== null
  useEffect(() => {
    const scroller = mapRef.current?.closest<HTMLElement>('[role="region"]')
    scroller?.scrollTo({ top: 0 })
  }, [mapPreference])

  const surfaceBody = (surface: McsStageSurfaceId) => {
    switch (surface) {
      case 'map':
        return (
          <div
            ref={mapRef}
            data-map-anchor
            role={presentation || lesson.introductory ? 'group' : undefined}
            aria-label={
              presentation || lesson.introductory ? 'Circulation map scroll area' : undefined
            }
            className={presentation || lesson.introductory ? styles.readableMap : undefined}
            tabIndex={presentation || lesson.introductory ? 0 : undefined}
          >
            {lesson.introductory ? (
              <p className={styles.footnote}>
                If the map extends beyond this view, scroll horizontally to inspect the full path at
                readable label size.
              </p>
            ) : null}
            <CirculationMap state={state} emphasis={emphasis} answer={mapAnswer} />
          </div>
        )
      case 'controls':
        return focusedControls ? (
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
        )
      case 'anatomy':
        return (
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
        )
      default:
        return null
    }
  }

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
  const monitor =
    teachingAvailable && lesson.introductory ? (
      <div className={styles.block} data-reference-readings>
        <h3>Reference readings</h3>
        <p>
          Mean arterial pressure {state.metrics.mapMmHg.toFixed(0)} mm Hg · modeled concurrent
          native flow {state.metrics.nativeFlowLMin.toFixed(1)} L/min.
        </p>
        <p>
          {state.device.kind === 'iabp'
            ? 'IABP: no separate pump-flow stream.'
            : `Simulated pump estimate ${state.metrics.deviceFlowLMin.toFixed(1)} L/min.`}{' '}
          Modeled effective systemic flow {state.metrics.effectiveSystemicFlowLMin.toFixed(1)}{' '}
          L/min.
        </p>
        <details>
          <summary>Full monitor and derived measurements</summary>
          {fullMonitor}
        </details>
      </div>
    ) : (
      fullMonitor
    )
  const controlsLead =
    focusedControls &&
    allowedActionIds?.some((id) => !id.startsWith('inspect:') && !id.startsWith('device:select:'))
  const surfaceOrder: readonly McsStageSurfaceId[] = mapLeads
    ? ['map', 'controls', 'anatomy']
    : [...MCS_STAGE_SURFACES]

  if (timingIdentification) return <McsTimingFigure state={state} annotated={false} />

  if (presentation) {
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
      <div
        className={styles.simulator}
        data-simulator-surfaces
        data-map-leads={showMap || undefined}
      >
        {presentation === 'timing-lab' ? <McsTimingFigure state={state} /> : null}
        {showMap ? (
          <section data-surface="map">
            <h3>Circulation map</h3>
            {surfaceBody('map')}
          </section>
        ) : null}
        {controls ? (
          <section data-surface="controls">
            <h3>Controls for this task</h3>
            {surfaceBody('controls')}
          </section>
        ) : null}
        {!(
          teachingAvailable &&
          (presentation === 'circulation-reader' || presentation === 'mechanism-comparison')
        ) ? (
          <McsTaskReadings state={state} kind={presentation} withholdFlow={flowAccountWithheld} />
        ) : null}
        {/*
         * Collapsed by default everywhere it used to be — including the steps whose own words say
         * "Look here" at one of its traces, so the target of the instruction was behind a closed
         * disclosure (F03). Those steps open it. It is keyed by step, so a learner who closes it
         * keeps it closed for the rest of that step, and the next step starts at its own default.
         * Opening or closing it is display only: no model action, no clock tick, no progress.
         */}
        <details
          key={`monitor-${stepKey ?? ''}`}
          open={monitorPointedAt || undefined}
          data-monitor-disclosure
          data-monitor-pointed-at={monitorPointedAt || undefined}
        >
          <summary>
            Full monitor and derived measurements
            {monitorPointedAt ? ' · opened because this step points at it' : ''}
          </summary>
          {fullMonitor}
        </details>
        {!showMap ? (
          <details>
            <summary>Circulation map</summary>
            {surfaceBody('map')}
          </details>
        ) : null}
        {predictionCommitted || teachingAvailable ? (
          <section data-surface="anatomy">
            <button
              type="button"
              aria-expanded={openSurfaces.has('anatomy')}
              onClick={() => onToggleSurface('anatomy', !openSurfaces.has('anatomy'))}
            >
              Optional three-dimensional view
            </button>
            {openSurfaces.has('anatomy') ? surfaceBody('anatomy') : null}
          </section>
        ) : null}
        <p className={styles.boundaryNote} data-device-boundary>
          Generic educational representation. No product display or manufacturer alarm limit is
          reproduced.
        </p>
      </div>
    )
  }

  return (
    <div
      className={styles.simulator}
      data-simulator-surfaces
      data-map-leads={mapLeads || undefined}
    >
      {controlsLead ? (
        <section className={styles.surface} data-surface="controls" data-open="true">
          <h3 className={styles.surfaceHeading}>Controls for this task</h3>
          <div className={styles.surfaceBody}>{surfaceBody('controls')}</div>
        </section>
      ) : null}
      {lesson.sectionId === 'iabp-timing-triggering' ? <McsTimingFigure state={state} /> : null}
      {mapLeads ? null : monitor}
      <div className={styles.surfaces}>
        {surfaceOrder
          .filter(
            (surface) =>
              !(controlsLead && surface === 'controls') &&
              (surface === 'map' || predictionCommitted || teachingAvailable),
          )
          .map((surface) => {
            const open = openSurfaces.has(surface)
            const panelId = `${baseId}-${surface}`
            return (
              <section
                key={surface}
                className={styles.surface}
                data-surface={surface}
                data-open={open}
              >
                <h3 className={styles.surfaceHeading}>
                  <button
                    type="button"
                    className={styles.surfaceToggle}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => onToggleSurface(surface, !open)}
                  >
                    {MCS_STAGE_SURFACE_LABELS[surface]}
                    <span className={styles.surfaceToggleHint}>{open ? 'Hide' : 'Show'}</span>
                  </button>
                </h3>
                <div id={panelId} className={styles.surfaceBody} hidden={!open}>
                  {/* References may open anatomy before questioning. Independent tasks gate it;
                      closed 3D stays unmounted and uses the existing optional launch gate. */}
                  {surface === 'anatomy' && !open ? null : surfaceBody(surface)}
                </div>
              </section>
            )
          })}
      </div>
      {mapLeads ? monitor : null}
      <p className={styles.boundaryNote} data-device-boundary>
        The monitor, the map and the controls are a simulation built for teaching. No product
        display is imitated and no alarm limit is reproduced.
      </p>
    </div>
  )
}
