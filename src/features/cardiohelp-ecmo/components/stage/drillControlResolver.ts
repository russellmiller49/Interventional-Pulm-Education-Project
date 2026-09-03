import type {
  ConsoleScreen,
  EcmoSimulationState,
  GuidedControlId,
  GuidedTarget,
  SimulationAction,
} from '../../engine/types'

/**
 * How a simulator step names the control it wants, and how the stage knows it has been operated.
 *
 * Lifted unchanged from the drill lesson player. A step whose single action is a device, gas,
 * circuit or power change resolves to the control that performs it — the physical rotary for a
 * speed, the blender slider for a sweep, the clamp for an isolation — with the instruction the
 * learner reads on the Now card and the test that marks the step performed once the engine state
 * matches. Nothing here dispatches anything: the learner operates the real control, and the stage
 * watches the state.
 */

export const targetLabels: Readonly<Record<GuidedTarget, string>> = {
  console: 'Device console',
  circuit: 'Circuit and sensors',
  'gas-panel': 'Separate gas panel',
  'patient-monitor': 'Independent patient monitor',
  'trend-panel': 'Device + patient trends',
}

export const panelControlIds: Readonly<Record<GuidedTarget, GuidedControlId>> = {
  console: 'cardiohelp-console',
  circuit: 'cardiohelp-circuit-panel',
  'gas-panel': 'cardiohelp-gas-panel',
  'patient-monitor': 'cardiohelp-patient-monitor',
  'trend-panel': 'cardiohelp-trend-panel',
}

const screenControlIds: Partial<Record<ConsoleScreen, GuidedControlId>> = {
  parameters: 'cardiohelp-screen-parameters',
  blood: 'cardiohelp-screen-blood',
  transport: 'cardiohelp-screen-transport',
  interventions: 'cardiohelp-screen-interventions',
  timers: 'cardiohelp-screen-timers',
}

export interface GuidedSimulatorTask {
  readonly controlId: GuidedControlId
  readonly instruction: string
  readonly satisfied: boolean
}

export function guidedActionSatisfied(
  action: SimulationAction,
  state: EcmoSimulationState,
): boolean {
  switch (action.type) {
    case 'SET_SCREEN':
      return state.device.screen === action.screen
    case 'SET_RPM':
      return state.device.pumpMode === 'rpm' && state.device.rpmSetpoint === action.rpm
    case 'SET_FLOW_TARGET':
      return (
        state.device.pumpMode === 'lpm' && Math.abs(state.device.lpmSetpoint - action.flow) < 0.001
      )
    case 'SET_SWEEP':
      return Math.abs(state.gas.sweepLpm - action.sweep) < 0.001
    case 'SET_GAS_FIO2':
      return Math.abs(state.gas.fio2 - action.fio2) < 0.001
    case 'SET_PUMP_MODE':
      return state.device.pumpMode === action.mode
    case 'RESTORE_GAS_SOURCE':
      return state.gas.sourceConnected
    case 'RESTORE_AC_POWER':
      return state.device.powerSource === 'ac'
    case 'TOGGLE_CIRCUIT_CLAMP': {
      // Guided clamp steps always declare an explicit target state.
      const targetClosed = action.closed ?? true
      return action.limb === 'drainage'
        ? state.circuit.drainageClampClosed === targetClosed
        : state.circuit.returnClampClosed === targetClosed
    }
    case 'RESET_BUBBLE':
      return (
        !state.circuit.bubbleResetRequired &&
        state.scenario.correctedFaults.includes('arterial-bubble')
      )
    case 'RESUME_SUPPORT_AFTER_BUBBLE':
      return (
        !state.circuit.bubbleResetRequired &&
        !state.circuit.drainageClampClosed &&
        !state.circuit.returnClampClosed &&
        state.device.pumpRunning
      )
    case 'PERFORM_CHECK':
      return (
        state.circuit.circuitInspected &&
        state.scenario.correctedFaults.includes('startup-inspection')
      )
    default:
      return false
  }
}

export function resolveGuidedSimulatorTask(
  actions: readonly SimulationAction[],
  state: EcmoSimulationState,
): GuidedSimulatorTask | null {
  if (actions.length !== 1) return null
  const action = actions[0]
  const satisfied = guidedActionSatisfied(action, state)

  switch (action.type) {
    case 'SET_SCREEN': {
      if (action.screen === 'startup') {
        return {
          controlId: 'cardiohelp-home-button',
          instruction: 'On the console toolbar, select Home to return to the START screen.',
          satisfied,
        }
      }
      if (action.screen === 'alarm-history') {
        return state.device.screen === 'menu'
          ? {
              controlId: 'cardiohelp-alarm-list-button',
              instruction: 'In the console Menu, select Alarm list.',
              satisfied,
            }
          : {
              controlId: 'cardiohelp-menu-button',
              instruction: 'On the console toolbar, select Menu. Then choose Alarm list.',
              satisfied,
            }
      }
      const controlId = screenControlIds[action.screen]
      if (!controlId) return null
      const screenLabels: Partial<Record<ConsoleScreen, string>> = {
        parameters: 'PARAM',
        blood: 'BLOOD',
        transport: 'TRANS',
        interventions: 'INTERV',
        timers: 'TIME',
      }
      return {
        controlId,
        instruction: `On the CARDIOHELP touchscreen, select ${screenLabels[action.screen] ?? action.screen}.`,
        satisfied,
      }
    }
    case 'SET_RPM':
      return state.device.pumpMode === 'rpm'
        ? {
            controlId: 'cardiohelp-rpm-control',
            instruction: `Use the physical rotary control to set ${action.rpm} RPM.`,
            satisfied,
          }
        : {
            controlId: 'cardiohelp-pump-mode-rpm',
            instruction: 'On the physical console panel, select RPM mode first.',
            satisfied,
          }
    case 'SET_FLOW_TARGET':
      return state.device.pumpMode === 'lpm'
        ? {
            controlId: 'cardiohelp-rpm-control',
            instruction: `Use the physical rotary control to set ${action.flow.toFixed(1)} L/min.`,
            satisfied,
          }
        : {
            controlId: 'cardiohelp-pump-mode-lpm',
            instruction: 'On the physical console panel, select LPM mode first.',
            satisfied,
          }
    case 'SET_PUMP_MODE':
      return {
        controlId: action.mode === 'rpm' ? 'cardiohelp-pump-mode-rpm' : 'cardiohelp-pump-mode-lpm',
        instruction: `On the physical console panel, select ${action.mode.toUpperCase()} mode.`,
        satisfied,
      }
    case 'SET_SWEEP':
      return {
        controlId: 'cardiohelp-sweep-control',
        instruction: `On the separate gas blender, set sweep flow to ${action.sweep.toFixed(1)} L/min.`,
        satisfied,
      }
    case 'SET_GAS_FIO2':
      return {
        controlId: 'cardiohelp-fio2-control',
        instruction: `On the separate gas blender, set sweep-gas FiO₂ to ${Math.round(action.fio2 * 100)}%.`,
        satisfied,
      }
    case 'PERFORM_CHECK':
      return {
        controlId: 'cardiohelp-circuit-check',
        instruction: 'In the circuit panel, perform the tip-to-tip circuit and sensor check.',
        satisfied,
      }
    case 'TOGGLE_CIRCUIT_CLAMP': {
      const closing = action.closed ?? true
      return {
        controlId:
          action.limb === 'drainage' ? 'cardiohelp-clamp-drainage' : 'cardiohelp-clamp-return',
        instruction: `On the bedside circuit, ${closing ? 'close' : 'open'} the ${action.limb}-limb clamp near the patient.`,
        satisfied,
      }
    }
    case 'RESTORE_GAS_SOURCE':
      return {
        controlId: 'cardiohelp-restore-gas-source',
        instruction: 'On the separate gas panel, select Restore verified gas source.',
        satisfied,
      }
    case 'RESUME_SUPPORT_AFTER_BUBBLE':
      return {
        controlId: 'cardiohelp-resume-support',
        instruction:
          'On the bedside circuit, resume support per the current IFU and approved local protocol.',
        satisfied,
      }
    case 'RESET_BUBBLE':
      return state.device.screen === 'interventions'
        ? {
            controlId: 'cardiohelp-reset-bubble',
            instruction: 'On the Interventions screen, reset the bubble intervention.',
            satisfied,
          }
        : {
            controlId: 'cardiohelp-screen-interventions',
            instruction: 'Open INTERV on the console, then use the bubble reset control.',
            satisfied,
          }
    case 'RESTORE_AC_POWER':
      return state.device.screen === 'transport'
        ? {
            controlId: 'cardiohelp-restore-ac-power',
            instruction: 'On the Transport screen, reconnect the verified AC source.',
            satisfied,
          }
        : {
            controlId: 'cardiohelp-screen-transport',
            instruction: 'Open TRANS on the console, then reconnect the verified AC source.',
            satisfied,
          }
    default:
      return null
  }
}
