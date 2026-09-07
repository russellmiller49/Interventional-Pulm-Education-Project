'use client'

import type { Dispatch, ReactNode } from 'react'

import type { RouteStopId } from '../../content/routeSpine'
import type { StageAnatomy, StageSurface } from '../../content/stageLessons'
import type {
  FastFlushLineType,
  HemodynamicAction,
  HemodynamicSimulationState,
} from '../../engine/types'
import { BedsideMonitor } from '../BedsideMonitor'
import { CatheterMap, type CatheterMapAnswer } from '../catheter-map/CatheterMap'
import { HemodynamicHeart3DDynamic } from '../HemodynamicHeart3DDynamic'
import { WaveformRecognitionDrill } from '../WaveformRecognitionDrill'
import {
  FlushDock,
  FreezeDock,
  LineDock,
  ThermodilutionDock,
  TipDock,
  WedgeDock,
} from './StageDocks'
import styles from './hemodynamics-stage.module.css'

/**
 * The simulator pane: the monitor, the controls the step opens, and the catheter map.
 *
 * The monitor is always present and never scaled — it is the thing the learner is learning to
 * read. Beneath it, only the dock the current step needs; beneath that, the map with the step's
 * stops lit and, when the step asks a where-question, the answer pins. The extra surfaces a step
 * carries (the recognition drill, the derived workbench) render between the monitor and the map.
 */
export function HemodynamicsSimulatorPane({
  state,
  dispatch,
  surface,
  anatomy = 'none',
  flushLine,
  controlsEnabled,
  lockedReason,
  pausedReason,
  chamberLabel,
  stops,
  mapCaption,
  mapAnswer,
  tipVisible,
  children,
}: {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
  readonly surface: StageSurface
  /** The anatomy surface beneath the docks; the 3D heart on the wedge section. */
  readonly anatomy?: StageAnatomy
  readonly flushLine: FastFlushLineType
  readonly controlsEnabled: boolean
  /** Why the docks are off while the learner decides; printed on the simulator. */
  readonly lockedReason?: string
  /** Why the docks are off while the learner looks back; printed on the simulator. */
  readonly pausedReason?: string
  readonly chamberLabel: 'shown' | 'withheld'
  readonly stops: readonly RouteStopId[]
  readonly mapCaption?: string
  readonly mapAnswer?: CatheterMapAnswer
  readonly tipVisible: boolean
  readonly children?: ReactNode
}) {
  const dock = (() => {
    const props = { state, dispatch, enabled: controlsEnabled }
    switch (surface) {
      case 'line':
        return <LineDock {...props} />
      case 'flush':
        return (
          <>
            <LineDock {...props} />
            <FlushDock {...props} lineType={flushLine} />
          </>
        )
      case 'flush-then-tip':
        return (
          <>
            <FlushDock {...props} lineType={flushLine} />
            <TipDock {...props} />
          </>
        )
      case 'tip':
        return <TipDock {...props} />
      case 'wedge':
        return <WedgeDock {...props} />
      case 'thermodilution':
        return <ThermodilutionDock {...props} />
      case 'freeze':
        return <FreezeDock {...props} />
      case 'recognition':
        return (
          <div className={styles.surfaceCard} data-surface="recognition">
            <WaveformRecognitionDrill
              dispatch={controlsEnabled ? dispatch : undefined}
              questionSet="places"
            />
          </div>
        )
      case 'capstone':
        return (
          <>
            <LineDock {...props} />
            <FlushDock {...props} lineType="pulmonary-artery" />
            <WedgeDock {...props} />
            <TipDock {...props} />
            <ThermodilutionDock {...props} />
          </>
        )
      default:
        return null
    }
  })()

  return (
    <div className={styles.simulator} data-simulator-surface={surface}>
      <div className={styles.monitorFrame}>
        <BedsideMonitor
          state={state}
          dispatch={dispatch}
          chamberLabel={chamberLabel}
          showControls={false}
        />
      </div>
      {lockedReason ? (
        <p className={styles.lockedNote} role="status" data-controls-locked>
          {lockedReason}
        </p>
      ) : null}
      {pausedReason ? (
        <p className={styles.lockedNote} role="status" data-controls-paused>
          {pausedReason}
        </p>
      ) : null}
      {dock ? <div className={styles.docks}>{dock}</div> : null}
      {anatomy === 'heart' ? (
        <section
          className={styles.surfaceCard}
          data-surface="heart-3d"
          aria-label="The heart and the catheter, in three dimensions"
        >
          <p className={styles.kicker}>The heart and the catheter · teaching model</p>
          <p className={styles.dockNote}>
            The catheter&apos;s course through the right heart, its balloon and the transducer, in
            step with the monitor above. Drag to turn it; the arrows and Reset view do the same from
            the keyboard.
          </p>
          <HemodynamicHeart3DDynamic state={state} />
        </section>
      ) : null}
      {children}
      <CatheterMap
        emphasis={stops}
        caption={mapCaption}
        tipPosition={tipVisible ? state.catheter.position : null}
        balloonUp={tipVisible && state.catheter.balloonInflated}
        answer={mapAnswer}
      />
    </div>
  )
}
