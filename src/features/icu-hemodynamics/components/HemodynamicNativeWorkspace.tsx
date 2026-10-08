'use client'

import type { ReactNode } from 'react'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import { BedsideMonitor } from './BedsideMonitor'
import { FormulaDrawer } from './FormulaDrawer'
import { PacActionDock } from './PacActionDock'
import { PacSkillsLab } from './PacSkillsLab'
import { PhysiologyPanel } from './PhysiologyPanel'
import flowStyles from './stage/hemodynamics-flow.module.css'

interface HemodynamicNativeWorkspaceProps {
  readonly state: HemodynamicSimulationState
  readonly dispatch: (action: HemodynamicAction) => void
  readonly showPressureSystem?: boolean
  readonly showThermodilution?: boolean
  readonly showDerived?: boolean
  readonly pressureChallengeMode?: 'selectable' | 'current-state'
  readonly interactive?: boolean
  readonly revealModel?: boolean
  readonly task?: ReactNode
}

/** One patient owner above this view. Tools disclose in place; layout never reloads the engine. */
export function HemodynamicNativeWorkspace({
  state,
  dispatch,
  showPressureSystem = true,
  showThermodilution = true,
  showDerived = true,
  pressureChallengeMode = 'selectable',
  interactive = true,
  revealModel = false,
  task,
}: HemodynamicNativeWorkspaceProps) {
  const toolsOffered =
    interactive || state.catheter.balloonInflated || state.catheter.floatBalloonInflated
  return (
    <div className={flowStyles.caseWorkspace} data-case-workspace>
      <div className={flowStyles.paired}>
        <BedsideMonitor
          state={state}
          dispatch={dispatch}
          chamberLabel={revealModel ? 'shown' : 'withheld'}
          showControls={false}
        />
        {task}
      </div>
      {/*
        Where the tools are not offered they are hidden, not unmounted (ported from PR #321). The
        case's earlier checkpoints can be reopened at any time; unmounting the tools there threw
        away whatever lived only in them — a technique chosen for an injection not yet given, which
        tools were open — and the learner came back to an emptied station. Hidden, they keep it and
        are out of sight, out of the tab order and out of the accessibility tree. The debrief's
        read-only view is a separate instance with nothing to keep, so it still mounts none.
      */}
      {toolsOffered || !revealModel ? (
        <div
          className={flowStyles.toolGroups}
          aria-label="Measurement tools"
          hidden={!toolsOffered}
        >
          {showPressureSystem ? (
            <details>
              <summary>Pressure measurement · level, zero and response</summary>
              <PacSkillsLab
                state={state}
                dispatch={dispatch}
                focus="pressure-system"
                pressureChallengeMode={pressureChallengeMode}
              />
            </details>
          ) : null}
          <details
            open={
              state.catheter.balloonInflated || state.catheter.floatBalloonInflated || undefined
            }
          >
            <summary>Catheter actions and acquisition</summary>
            <PacActionDock state={state} dispatch={dispatch} maskPosition={!revealModel} />
          </details>
          {showThermodilution ? (
            <details id="hemodynamic-native-thermodilution">
              <summary>Cardiac-output trials</summary>
              <PacSkillsLab state={state} dispatch={dispatch} focus="thermodilution" />
            </details>
          ) : null}
          {showDerived ? (
            <details>
              <summary>Calculated results and source validity</summary>
              <FormulaDrawer state={state} dispatch={dispatch} observedInputsOnly />
            </details>
          ) : null}
        </div>
      ) : null}
      {revealModel ? (
        <details>
          <summary>Model reference: internal physiology and anatomy</summary>
          <p>
            This view exposes internal simulation values. It is not an additional acquired
            measurement.
          </p>
          <PhysiologyPanel state={state} dispatch={dispatch} />
        </details>
      ) : null}
    </div>
  )
}
