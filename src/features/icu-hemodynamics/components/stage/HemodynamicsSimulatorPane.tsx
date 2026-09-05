'use client'

import type { Dispatch, ReactNode } from 'react'

import type { RouteStopId } from '../../content/routeSpine'
import type { StageSurface } from '../../content/stageLessons'
import type {
  FastFlushLineType,
  HemodynamicAction,
  HemodynamicSimulationState,
} from '../../engine/types'
import { BedsideMonitor } from '../BedsideMonitor'
import { CatheterMap, type CatheterMapAnswer } from '../catheter-map/CatheterMap'
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
  flushLine,
  controlsEnabled,
  lockedReason,
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
  readonly flushLine: FastFlushLineType
  readonly controlsEnabled: boolean
  readonly lockedReason?: string
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
            <WaveformRecognitionDrill dispatch={controlsEnabled ? dispatch : undefined} />
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
      {dock ? <div className={styles.docks}>{dock}</div> : null}
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
