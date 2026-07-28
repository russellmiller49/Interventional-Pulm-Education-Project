'use client'

import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import { BedsideMonitor } from './BedsideMonitor'
import { FormulaDrawer } from './FormulaDrawer'
import { PacActionDock } from './PacActionDock'
import { PacSkillsLab } from './PacSkillsLab'
import { PhysiologyPanel } from './PhysiologyPanel'
import { ResizablePacWorkspace } from './ResizablePacWorkspace'
import styles from './icu-hemodynamics.module.css'

interface HemodynamicNativeWorkspaceProps {
  readonly state: HemodynamicSimulationState
  readonly dispatch: (action: HemodynamicAction) => void
  readonly showPressureSystem?: boolean
  readonly showThermodilution?: boolean
  readonly showDerived?: boolean
  readonly pressureChallengeMode?: 'selectable' | 'current-state'
}

/**
 * Keeps the monitor, anatomy, and complete validation workflow synchronized while allowing every
 * pane to scroll and resize independently.
 */
export function HemodynamicNativeWorkspace({
  state,
  dispatch,
  showPressureSystem = true,
  showThermodilution = true,
  showDerived = true,
  pressureChallengeMode = 'selectable',
}: HemodynamicNativeWorkspaceProps) {
  function openCardiacOutput() {
    const lab = document.getElementById('hemodynamic-native-thermodilution')
    if (lab instanceof HTMLDetailsElement) lab.open = true
    window.setTimeout(() => lab?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <ResizablePacWorkspace
      className={styles.hemodynamicNativeWorkspace}
      monitor={
        <BedsideMonitor state={state} dispatch={dispatch} onOpenCardiacOutput={openCardiacOutput} />
      }
      physiology={<PhysiologyPanel state={state} dispatch={dispatch} />}
      controls={
        <div className={styles.hemodynamicNativeControls}>
          <PacActionDock state={state} dispatch={dispatch} />
          <div className={styles.hemodynamicNativeLabs}>
            {showPressureSystem ? (
              <details open>
                <summary>Pressure-system validation · level, zero, and dynamic response</summary>
                <PacSkillsLab
                  state={state}
                  dispatch={dispatch}
                  focus="pressure-system"
                  pressureChallengeMode={pressureChallengeMode}
                />
              </details>
            ) : null}
            {showThermodilution ? (
              <details id="hemodynamic-native-thermodilution" open>
                <summary>Thermodilution technique and accepted-curve series</summary>
                <PacSkillsLab state={state} dispatch={dispatch} focus="thermodilution" />
              </details>
            ) : null}
            {showDerived ? (
              <details>
                <summary>Derived hemodynamics and input-validity review</summary>
                <FormulaDrawer state={state} dispatch={dispatch} />
              </details>
            ) : null}
          </div>
        </div>
      }
    />
  )
}
