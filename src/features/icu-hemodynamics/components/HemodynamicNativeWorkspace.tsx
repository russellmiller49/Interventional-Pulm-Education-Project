'use client'

import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import { BedsideMonitor } from './BedsideMonitor'
import { FormulaDrawer } from './FormulaDrawer'
import { PacActionDock } from './PacActionDock'
import { PacSkillsLab } from './PacSkillsLab'
import { PhysiologyPanel } from './PhysiologyPanel'
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
 * Restores the original synchronized PAC workspace inside routed activities.
 * The monitor, CT-derived heart, catheter controls, and measurement labs remain
 * available together instead of replacing one another with a surface toggle.
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
    <section
      className={styles.hemodynamicNativeWorkspace}
      aria-label="Synchronized PAC monitor, anatomy, catheter controls, and measurement labs"
    >
      <div className={styles.hemodynamicNativeMonitor}>
        <BedsideMonitor state={state} dispatch={dispatch} onOpenCardiacOutput={openCardiacOutput} />
      </div>
      <div className={styles.hemodynamicNativePhysiology}>
        <PhysiologyPanel state={state} dispatch={dispatch} />
      </div>
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
    </section>
  )
}
