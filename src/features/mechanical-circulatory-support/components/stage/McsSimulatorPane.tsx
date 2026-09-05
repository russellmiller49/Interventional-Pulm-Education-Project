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
}: {
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
}) {
  const baseId = useId()
  const mapRef = useRef<HTMLDivElement>(null)
  const monitorTarget: McsMonitorTargetId | undefined =
    lesson.contract.primarySurface === 'monitor'
      ? (lesson.contract.primaryTarget as McsMonitorTargetId)
      : undefined

  /*
   * On a step that opens the map, scroll this pane — not the document — to it once the pane has
   * laid out. The document's sticky header would otherwise cover the caption.
   */
  useEffect(() => {
    if (!mapPreference || !mapRef.current) return
    const node = mapRef.current
    const scroller = node.closest<HTMLElement>('[role="region"]')
    if (!scroller) return
    // The monitor above the map re-flows as the workspace settles its pane widths, so the
    // measurement is repeated over the first second and stops as soon as the learner scrolls.
    let interrupted = false
    const interrupt = () => {
      interrupted = true
    }
    scroller.addEventListener('wheel', interrupt, { passive: true })
    scroller.addEventListener('touchstart', interrupt, { passive: true })
    const timers = [80, 320, 800].map((delay) =>
      window.setTimeout(() => {
        if (interrupted) return
        const top =
          node.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop
        scroller.scrollTo({ top: Math.max(0, top - 8), behavior: 'auto' })
      }, delay),
    )
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      scroller.removeEventListener('wheel', interrupt)
      scroller.removeEventListener('touchstart', interrupt)
    }
  }, [mapPreference])

  const surfaceBody = (surface: McsStageSurfaceId) => {
    switch (surface) {
      case 'map':
        return (
          <div ref={mapRef} data-map-anchor>
            <CirculationMap state={state} emphasis={emphasis} answer={mapAnswer} />
          </div>
        )
      case 'controls':
        return <McsControls state={state} dispatch={dispatch} highlightControl={highlightControl} />
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

  return (
    <div className={styles.simulator} data-simulator-surfaces>
      <McsMonitor
        state={state}
        highlightTarget={monitorTarget}
        highlightNote={predictionCommitted}
        revealCausality={predictionCommitted}
        withheldNote="What produced this display appears once you have committed your prediction."
        withholdFlowAccount={flowAccountWithheld}
      />
      <div className={styles.surfaces}>
        {MCS_STAGE_SURFACES.map((surface) => {
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
                {/*
                  Two surfaces are not in the document until they are needed. The three-dimensional
                  view is heavy and behind its own launch gate. The controls carry labels that name
                  what a section asks the learner to predict — a pattern's own toggle, a placement
                  state — so they are mounted only once the prediction is committed, and stay mounted
                  after that so their ids hold while the learner opens and closes them.
                */}
                {surface === 'anatomy' && !open
                  ? null
                  : surface === 'controls' && !predictionCommitted
                    ? null
                    : surfaceBody(surface)}
              </div>
            </section>
          )
        })}
      </div>
      <p className={styles.boundaryNote} data-device-boundary>
        The monitor, the map and the controls are a simulation built for teaching. No product
        display is imitated and no alarm limit is reproduced.
      </p>
    </div>
  )
}
