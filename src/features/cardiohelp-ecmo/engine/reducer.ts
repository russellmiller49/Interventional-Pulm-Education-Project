import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import {
  applyClinicalIntervention,
  attemptClinicalEcmoStart,
  markClinicalImproving,
} from './clinicalResponse'
import {
  clamp,
  createInitialSimulationState,
  deriveSimulation,
  hasFault,
  injectFault,
  MAX_HISTORY_ENTRIES,
  resolveDrainageLimitation,
} from './simulation'
import type {
  EcmoSimulationState,
  FaultId,
  ScenarioCredit,
  ScenarioDefinition,
  SimulationAction,
} from './types'

const actionLabels: Partial<Record<SimulationAction['type'], string>> = {
  SET_RPM: 'Changed RPM setpoint',
  SET_FLOW_TARGET: 'Changed LPM setpoint',
  SET_SWEEP: 'Changed external sweep flow',
  SET_GAS_FIO2: 'Changed sweep-gas FiO2',
  RESTORE_GAS_SOURCE: 'Restored gas source',
  RESTORE_AC_POWER: 'Restored AC power',
  TOGGLE_ZERO_FLOW: 'Changed zero-flow state',
  TOGGLE_GLOBAL_OVERRIDE: 'Changed Global Override state',
  ACK_ALARM: 'Acknowledged alarm',
  RESET_BUBBLE: 'Attempted bubble reset',
  TOGGLE_CIRCUIT_CLAMP: 'Changed circuit clamp state',
  CORRECT_FAULT: 'Corrected scenario cause',
  PERFORM_CHECK: 'Performed circuit/device check',
  ROTARY_DELTA: 'Turned rotary control',
  SET_PUMP_MODE: 'Changed pump mode',
  SET_SCREEN: 'Changed touchscreen screen',
  PRESS_SAFETY: 'Pressed safety control',
  RELEASE_SAFETY: 'Released safety control',
  ADJUST_LIMIT: 'Adjusted parameter alarm limit',
  APPLY_CLINICAL_INTERVENTION: 'Applied clinical intervention',
  START_ECMO: 'Attempted ECMO initiation',
  REQUEST_HINT: 'Requested a scored clue',
  TOGGLE_TIMER: 'Changed timer state',
  RESET_TIMER: 'Reset timer',
}

function getDefinition(state: EcmoSimulationState): ScenarioDefinition {
  return (
    clinicalPracticeScenarioById.get(state.scenario.scenarioId) ??
    cardiohelpScenarioById.get(state.scenario.scenarioId) ??
    cardiohelpScenarios[0]
  )
}

function appendHistory(
  state: EcmoSimulationState,
  kind: 'action' | 'alarm' | 'fault' | 'system',
  label: string,
): EcmoSimulationState {
  return {
    ...state,
    history: [
      ...state.history,
      {
        id: `${kind}-${state.simulationTime}-${state.history.length}`,
        time: state.simulationTime,
        kind,
        label,
      },
    ].slice(-MAX_HISTORY_ENTRIES),
  }
}

function completedObjectiveIds(credit: ScenarioCredit): string[] {
  return Object.entries(credit)
    .filter(([, complete]) => complete)
    .map(([id]) => id)
}

function updateCredit(
  state: EcmoSimulationState,
  changes: Partial<ScenarioCredit>,
): EcmoSimulationState {
  const credit = { ...state.scenario.credit, ...changes }
  return {
    ...state,
    scenario: {
      ...state.scenario,
      credit,
      completedObjectiveIds: completedObjectiveIds(credit),
    },
  }
}

function addCriticalError(
  state: EcmoSimulationState,
  id: string,
  fallbackPoints: number,
): EcmoSimulationState {
  if (state.scenario.criticalErrors.includes(id)) return state
  const definition = getDefinition(state)
  const penalty = definition.unsafeActionPenalties.find((item) => item.id === id)
  return {
    ...state,
    scenario: {
      ...state.scenario,
      criticalErrors: [...state.scenario.criticalErrors, id],
      penalties: state.scenario.penalties + (penalty?.points ?? fallbackPoints),
    },
  }
}

function addPenalty(
  state: EcmoSimulationState,
  id: string,
  points: number,
  critical: boolean,
): EcmoSimulationState {
  if (critical) return addCriticalError(state, id, points)
  return {
    ...state,
    scenario: {
      ...state.scenario,
      penalties: state.scenario.penalties + points,
    },
  }
}

function applyClinicalInterventionAndResolve(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
  interventionId: string,
) {
  const result = applyClinicalIntervention(state, definition, interventionId)
  let next = result.state
  if (result.penalty) {
    next = addPenalty(next, result.penalty.id, result.penalty.points, result.penalty.critical)
  }
  if (result.resolutionReady) {
    next = next.scenario.activeFaults.includes(definition.expectation.correctiveFault)
      ? correctFault(next, definition.expectation.correctiveFault)
      : markClinicalImproving(next, definition)
    next = deriveSimulation(next)
    next = updateCredit(next, { control: true })
  }
  return { state: next, result }
}

const clampSimulatorControls = {
  'clamp-drainage': { limb: 'drainage', closed: true },
  'clamp-return': { limb: 'return', closed: true },
  'unclamp-drainage': { limb: 'drainage', closed: false },
  'unclamp-return': { limb: 'return', closed: false },
} as const

type ClampSimulatorControl = keyof typeof clampSimulatorControls

function simulatorTargetMatches(
  value: number,
  targetValue: number,
  comparison: 'within' | 'at-least' | 'at-most',
  tolerance: number,
) {
  if (comparison === 'at-least') return value >= targetValue - tolerance
  if (comparison === 'at-most') return value <= targetValue + tolerance
  return Math.abs(value - targetValue) <= tolerance
}

function findMatchingSimulatorIntervention(
  state: EcmoSimulationState,
  definition: ScenarioDefinition,
  action: SimulationAction,
) {
  const clinicalCase = definition.clinicalCase
  const clinical = state.scenario.clinical
  if (!clinicalCase || !clinical) return null
  const appliedIds = new Set(clinical.appliedInterventions.map((record) => record.interventionId))

  return (
    clinicalCase.interventions.find((intervention) => {
      const requirement = intervention.simulatorAction
      if (!requirement || appliedIds.has(intervention.id)) return false
      if (requirement.control === 'restore-gas') return action.type === 'RESTORE_GAS_SOURCE'
      if (requirement.control === 'restore-power') return action.type === 'RESTORE_AC_POWER'
      if (requirement.control === 'resume-after-bubble') {
        return action.type === 'RESUME_SUPPORT_AFTER_BUBBLE'
      }
      if (requirement.control in clampSimulatorControls) {
        if (action.type !== 'TOGGLE_CIRCUIT_CLAMP') return false
        const spec = clampSimulatorControls[requirement.control as ClampSimulatorControl]
        const currentlyClosed =
          action.limb === 'drainage'
            ? state.circuit.drainageClampClosed
            : state.circuit.returnClampClosed
        const intendedClosed = action.closed ?? !currentlyClosed
        return action.limb === spec.limb && intendedClosed === spec.closed
      }

      const actionValue =
        requirement.control === 'rpm' && action.type === 'SET_RPM'
          ? action.rpm
          : requirement.control === 'sweep' && action.type === 'SET_SWEEP'
            ? action.sweep
            : requirement.control === 'gas-fio2' && action.type === 'SET_GAS_FIO2'
              ? action.fio2
              : null
      if (actionValue === null || requirement.targetValue === undefined) return false
      return simulatorTargetMatches(
        actionValue,
        requirement.targetValue,
        requirement.comparison ?? 'within',
        requirement.tolerance ?? 0,
      )
    }) ?? null
  )
}

/**
 * Whether the air has actually been dealt with, by either of the two paths that deal with it.
 *
 * The drill corrects the source explicitly, which records the fault as corrected and clears the
 * detector while deliberately leaving the console latch set. The clinical case de-airs, which
 * clears the detector and the latch through an intervention patch without recording a corrected
 * fault. Neither is the other, so both are named rather than one being inferred from the other.
 */
function airIsCorrectedAndClear(state: EcmoSimulationState): boolean {
  if (state.circuit.arterialBubbleDetected) return false
  return (
    state.scenario.correctedFaults.includes('arterial-bubble') || !state.circuit.bubbleResetRequired
  )
}

function markFaultCorrected(state: EcmoSimulationState, fault: FaultId): EcmoSimulationState {
  const correctedFaults = state.scenario.correctedFaults.includes(fault)
    ? state.scenario.correctedFaults
    : [...state.scenario.correctedFaults, fault]
  const preserveLatch = fault === 'arterial-bubble'
  const activeFaults = preserveLatch
    ? state.scenario.activeFaults
    : state.scenario.activeFaults.filter((active) => active !== fault)

  const credited = updateCredit(
    {
      ...state,
      scenario: {
        ...state.scenario,
        correctedFaults,
        activeFaults,
        phase: 'reassess',
        causeCorrectedAt: state.simulationTime,
      },
    },
    { cause: true },
  )
  const definition = getDefinition(credited)
  return definition.clinicalCase ? markClinicalImproving(credited, definition) : credited
}

function actionMatchesControl(
  definition: ScenarioDefinition,
  action: SimulationAction,
): { control: boolean; direction: boolean } {
  const expected = definition.expectation
  const stateIndependentMatches =
    (expected.control === 'inspect-circuit' &&
      (action.type === 'PERFORM_CHECK' ||
        (action.type === 'CORRECT_FAULT' && action.fault === expected.correctiveFault))) ||
    (expected.control === 'restore-gas' && action.type === 'RESTORE_GAS_SOURCE') ||
    (expected.control === 'restore-power' && action.type === 'RESTORE_AC_POWER') ||
    (expected.control === 'correct-cause' &&
      action.type === 'CORRECT_FAULT' &&
      action.fault === expected.correctiveFault) ||
    ((expected.control === 'assess-upper-body' || expected.control === 'assess-lv-loading') &&
      action.type === 'CORRECT_FAULT' &&
      action.fault === expected.correctiveFault) ||
    (expected.control === 'gas-fio2' && action.type === 'SET_GAS_FIO2') ||
    (expected.control === 'off-sweep-trial' && action.type === 'SET_SWEEP' && action.sweep === 0)

  if (stateIndependentMatches) return { control: true, direction: true }
  if (expected.control === 'rpm' && action.type === 'SET_RPM') {
    return { control: true, direction: true }
  }
  if (expected.control === 'sweep' && action.type === 'SET_SWEEP') {
    return { control: true, direction: true }
  }
  return { control: false, direction: false }
}

function applyControlCredit(
  previous: EcmoSimulationState,
  next: EcmoSimulationState,
  action: SimulationAction,
): EcmoSimulationState {
  const definition = getDefinition(previous)
  const baseMatch = actionMatchesControl(definition, action)
  if (!baseMatch.control) return next

  let direction = baseMatch.direction
  if (action.type === 'SET_RPM') {
    direction =
      (definition.expectation.direction === 'decrease' &&
        action.rpm < previous.device.rpmSetpoint) ||
      (definition.expectation.direction === 'increase' &&
        action.rpm > previous.device.rpmSetpoint) ||
      (definition.expectation.direction === 'hold' && action.rpm === previous.device.rpmSetpoint)
  }
  if (action.type === 'SET_SWEEP') {
    direction =
      (definition.expectation.direction === 'increase' && action.sweep > previous.gas.sweepLpm) ||
      (definition.expectation.direction === 'decrease' && action.sweep < previous.gas.sweepLpm) ||
      (definition.expectation.direction === 'hold' && action.sweep === previous.gas.sweepLpm) ||
      (definition.expectation.direction === 'off' && action.sweep === 0)
  }

  let credited = updateCredit(next, { control: true, direction })
  if (
    direction &&
    ((definition.expectation.control === 'sweep' && action.type === 'SET_SWEEP') ||
      (definition.expectation.control === 'off-sweep-trial' && action.type === 'SET_SWEEP'))
  ) {
    credited = markFaultCorrected(credited, definition.expectation.correctiveFault)
  }
  return credited
}

function correctFault(state: EcmoSimulationState, fault: FaultId): EcmoSimulationState {
  if (!state.scenario.activeFaults.includes(fault)) return state

  let next = state
  if (fault === 'startup-inspection') {
    next = {
      ...next,
      device: { ...next.device, selfTest: 'passed' },
      circuit: { ...next.circuit, circuitInspected: true },
    }
  }
  if (fault === 'gas-source-interruption') {
    next = { ...next, gas: { ...next.gas, sourceConnected: true } }
  }
  if (fault === 'ac-power-loss') {
    next = { ...next, device: { ...next.device, powerSource: 'ac' } }
  }
  if (fault === 'flow-sensor-failure') {
    next = { ...next, circuit: { ...next.circuit, flowSensorConnected: true } }
  }
  if (fault === 'arterial-bubble') {
    next = { ...next, circuit: { ...next.circuit, arterialBubbleDetected: false } }
  }
  if (fault === 'ecmo-not-initiated') {
    next = { ...next, device: { ...next.device, pumpRunning: true } }
  }
  if (fault === 'hemorrhagic-hypovolemia') {
    next = {
      ...next,
      circuit: {
        ...next.circuit,
        hemoglobin: Math.max(8.7, next.circuit.hemoglobin),
        hematocrit: Math.max(26, next.circuit.hematocrit),
      },
      patient: {
        ...next.patient,
        meanArterialPressure: Math.max(65, next.patient.meanArterialPressure),
        centralVenousPressure: 7,
      },
    }
  }
  if (fault === 'tension-pneumothorax') {
    next = {
      ...next,
      patient: {
        ...next.patient,
        lungSliding: 'bilateral',
        airwayPressure: 25,
        centralVenousPressure: 10,
      },
    }
  }
  if (fault === 'tamponade') {
    next = {
      ...next,
      patient: { ...next.patient, centralVenousPressure: 10, meanArterialPressure: 62 },
    }
  }
  if (fault === 'vasoplegia') {
    next = {
      ...next,
      patient: { ...next.patient, meanArterialPressure: 65 },
    }
  }
  if (fault === 'distal-limb-ischemia') {
    next = {
      ...next,
      patient: { ...next.patient, distalLimbPerfusion: 'normal', distalLimbNirs: 62 },
    }
  }
  return markFaultCorrected(next, fault)
}

function injectScheduledFaults(state: EcmoSimulationState): EcmoSimulationState {
  const definition = getDefinition(state)
  let next = state
  for (const timedFault of definition.timedFaults) {
    if (
      timedFault.atSecond <= next.simulationTime &&
      !next.scenario.injectedTimedFaultIds.includes(timedFault.id)
    ) {
      next = injectFault(next, timedFault.fault)
      next = {
        ...next,
        scenario: {
          ...next.scenario,
          injectedTimedFaultIds: [...next.scenario.injectedTimedFaultIds, timedFault.id],
        },
      }
    }
  }
  return next
}

function advanceOneSecond(state: EcmoSimulationState): EcmoSimulationState {
  const nextTime = state.simulationTime + 1
  const lastActionTime =
    [...state.history].reverse().find((entry) => entry.kind === 'action')?.time ?? 0
  const timeAdvanced: EcmoSimulationState = {
    ...state,
    simulationTime: nextTime,
    device: {
      ...state.device,
      locked: state.device.locked || nextTime - lastActionTime >= 180,
      timers: state.device.timers.map((timer, index) =>
        state.device.timerRunning[index]
          ? index === 3
            ? Math.max(0, timer - 1)
            : timer + 1
          : timer,
      ),
    },
  }
  const derived = deriveSimulation(injectScheduledFaults(timeAdvanced))
  const definition = getDefinition(derived)
  const clinical = derived.scenario.clinical
  const lastIntervention = clinical?.appliedInterventions.at(-1)
  if (
    clinical &&
    definition.clinicalCase &&
    derived.scenario.activeFaults.length > 0 &&
    lastIntervention?.effect === 'temporizing' &&
    derived.simulationTime - lastIntervention.time >= 3
  ) {
    return {
      ...derived,
      scenario: {
        ...derived.scenario,
        clinical: {
          ...clinical,
          trajectory: 'deteriorating',
          lastResponse: definition.clinicalCase.deteriorationResponse,
        },
      },
    }
  }
  return derived
}

function advance(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let next = state
  const boundedSeconds = clamp(Math.floor(seconds), 1, 60)
  for (let index = 0; index < boundedSeconds; index += 1) next = advanceOneSecond(next)
  return next
}

export function ecmoSimulationReducer(
  state: EcmoSimulationState,
  action: SimulationAction,
): EcmoSimulationState {
  if (action.type === 'LOAD_SCENARIO') {
    return createInitialSimulationState(action.scenarioId, action.mode ?? state.simulationMode)
  }

  if (action.type === 'COMMIT_PREDICTION') {
    const definition = getDefinition(state)
    const goal = action.goalId === definition.expectation.goalId
    const control = action.control === definition.expectation.control
    const direction = action.direction === definition.expectation.direction
    return appendHistory(
      updateCredit(
        {
          ...state,
          scenario: {
            ...state.scenario,
            phase: 'act',
            prediction: { committed: true, ...action },
          },
        },
        { goal, control, direction },
      ),
      'action',
      'Committed prediction before action',
    )
  }

  switch (action.type) {
    case 'TICK':
      return state.paused ? state : advance(state, action.seconds ?? 1)
    case 'STEP':
      return advance(state, 1)
    case 'SET_PAUSED':
      return { ...state, paused: action.paused }
    case 'SET_SCREEN':
      return appendHistory(
        { ...state, device: { ...state.device, screen: action.screen } },
        'action',
        actionLabels.SET_SCREEN ?? '',
      )
    case 'TOGGLE_LOCK':
      return appendHistory(
        { ...state, device: { ...state.device, locked: !state.device.locked } },
        'action',
        state.device.locked ? 'Unlocked controls after hold' : 'Locked controls',
      )
    case 'SET_PUMP_MODE': {
      if (state.device.locked) return state
      const definition = getDefinition(state)
      const mode = action.mode === 'lpm' && !state.circuit.flowSensorConnected ? 'rpm' : action.mode
      const next = {
        ...state,
        device: { ...state.device, pumpMode: mode, displayedSetpoint: null },
      }
      return appendHistory(
        definition.assessmentPolicy?.preserveCircuitBloodFlow && mode !== state.device.pumpMode
          ? addCriticalError(next, 'capstone-flow-reduction', 50)
          : next,
        'action',
        actionLabels.SET_PUMP_MODE ?? '',
      )
    }
    case 'ROTARY_DELTA': {
      if (state.device.locked) return state
      if (state.device.pumpMode === 'rpm') {
        return ecmoSimulationReducer(state, {
          type: 'SET_RPM',
          rpm: clamp(state.device.rpmSetpoint + action.delta * 50, 0, 5000),
        })
      }
      return ecmoSimulationReducer(state, {
        type: 'SET_FLOW_TARGET',
        flow: clamp(state.device.lpmSetpoint + action.delta * 0.1, 0, 9.9),
      })
    }
    case 'SET_RPM': {
      if (state.device.locked) return state
      const definition = getDefinition(state)
      let next: EcmoSimulationState = {
        ...state,
        device: {
          ...state.device,
          rpmSetpoint: Math.round(clamp(action.rpm, 0, 5000)),
          displayedSetpoint: Math.round(clamp(action.rpm, 0, 5000)),
        },
      }
      const raisingSpeed = action.rpm > state.device.rpmSetpoint
      /*
       * Charged against the model's own drainage capacity, not against the direction alone.
       *
       * The guard used to fire on any increase while a drainage-limited fault was active, which
       * penalised a learner who had backed the pump well off and was bringing it back toward the
       * speed the circuit can actually support — an action the model itself treats as helpful. It
       * now fires when the new speed asks for more than the drainage can give, which is precisely
       * where the model stops delivering it, so the score and the display finally agree.
       */
      if (
        resolveDrainageLimitation({ ...state, device: next.device }, action.rpm)?.limited &&
        raisingSpeed
      ) {
        next = addCriticalError(next, 'rpm-during-collapse', 50)
      }
      // Same reflex, different mechanism. Pulling harder against established recirculation widens
      // the recirculating share rather than the support the patient receives, so it belongs in the
      // RPM-escalation guard family — but under its own name, because calling it drainage collapse
      // would teach the wrong cause.
      //
      // Gated on the case's own opening speed as well as on the direction of travel, because that
      // is exactly where the model starts charging for it. A learner who has backed the pump off
      // and is returning toward the speed the case opened at is not escalating, and scoring them as
      // though they were would punish an action the simulation itself treats as harmless.
      if (
        hasFault(state, 'recirculation') &&
        raisingSpeed &&
        action.rpm > state.scenario.baselineRpmSetpoint
      ) {
        next = addCriticalError(next, 'rpm-during-recirculation', 50)
      }
      if (
        definition.assessmentPolicy?.preserveCircuitBloodFlow &&
        action.rpm !== state.device.rpmSetpoint
      ) {
        next = addCriticalError(next, 'capstone-flow-reduction', 50)
      }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.SET_RPM ?? '',
      )
    }
    case 'SET_FLOW_TARGET': {
      if (state.device.locked || !state.circuit.flowSensorConnected) return state
      const definition = getDefinition(state)
      let next: EcmoSimulationState = {
        ...state,
        device: {
          ...state.device,
          lpmSetpoint: Math.round(clamp(action.flow, 0, 9.9) * 10) / 10,
          displayedSetpoint: action.flow,
        },
      }
      if (
        definition.assessmentPolicy?.preserveCircuitBloodFlow &&
        action.flow !== state.device.lpmSetpoint
      ) {
        next = addCriticalError(next, 'capstone-flow-reduction', 50)
      }
      return appendHistory(next, 'action', actionLabels.SET_FLOW_TARGET ?? '')
    }
    case 'SET_SWEEP': {
      const definition = getDefinition(state)
      const sweepLpm = clamp(action.sweep, 0, 15)
      let next = { ...state, gas: { ...state.gas, sweepLpm } }
      if (
        definition.assessmentPolicy?.prohibitSweepZeroWhileFlowing &&
        sweepLpm === 0 &&
        Math.abs(state.circuit.bloodFlow) > 0.05
      ) {
        next = addCriticalError(next, 'va-sweep-off', 50)
      }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.SET_SWEEP ?? '',
      )
    }
    case 'SET_GAS_FIO2': {
      const definition = getDefinition(state)
      let next = { ...state, gas: { ...state.gas, fio2: clamp(action.fio2, 0.21, 1) } }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.SET_GAS_FIO2 ?? '',
      )
    }
    case 'RESTORE_GAS_SOURCE': {
      const definition = getDefinition(state)
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      const next = simulatorIntervention
        ? applyClinicalInterventionAndResolve(state, definition, simulatorIntervention.id).state
        : correctFault(
            { ...state, gas: { ...state.gas, sourceConnected: true } },
            'gas-source-interruption',
          )
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.RESTORE_GAS_SOURCE ?? '',
      )
    }
    case 'RESTORE_AC_POWER': {
      const next = correctFault(
        { ...state, device: { ...state.device, powerSource: 'ac' } },
        'ac-power-loss',
      )
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        actionLabels.RESTORE_AC_POWER ?? '',
      )
    }
    case 'PRESS_SAFETY':
      return appendHistory(
        {
          ...state,
          device: { ...state.device, safetyHeld: true },
        },
        'action',
        actionLabels.PRESS_SAFETY ?? '',
      )
    case 'RELEASE_SAFETY':
      return appendHistory(
        { ...state, device: { ...state.device, safetyHeld: false } },
        'action',
        actionLabels.RELEASE_SAFETY ?? '',
      )
    case 'ADJUST_LIMIT': {
      if (state.device.locked) return state
      const current = state.device.limits[action.parameter]
      const isPressure = action.parameter.startsWith('p')
      const candidate = clamp(current + action.delta, isPressure ? -500 : 0, isPressure ? 900 : 9.9)
      let adjusted = candidate
      if (action.parameter === 'pVenWarningLow')
        adjusted = Math.max(candidate, state.device.limits.pVenAlarmLow)
      if (action.parameter === 'pVenAlarmLow')
        adjusted = Math.min(candidate, state.device.limits.pVenWarningLow)
      if (action.parameter === 'pIntWarningHigh')
        adjusted = Math.min(candidate, state.device.limits.pIntAlarmHigh)
      if (action.parameter === 'pIntAlarmHigh')
        adjusted = Math.max(candidate, state.device.limits.pIntWarningHigh)
      if (action.parameter === 'pArtWarningHigh')
        adjusted = Math.min(candidate, state.device.limits.pArtAlarmHigh)
      if (action.parameter === 'pArtAlarmHigh')
        adjusted = Math.max(candidate, state.device.limits.pArtWarningHigh)
      if (action.parameter === 'flowLow')
        adjusted = Math.min(candidate, state.device.limits.flowHigh)
      if (action.parameter === 'flowHigh')
        adjusted = Math.max(candidate, state.device.limits.flowLow)
      return appendHistory(
        {
          ...state,
          device: {
            ...state.device,
            limits: { ...state.device.limits, [action.parameter]: adjusted },
          },
        },
        'action',
        `${actionLabels.ADJUST_LIMIT}: ${action.parameter}`,
      )
    }
    case 'TOGGLE_TIMER': {
      if (action.timerIndex < 0 || action.timerIndex >= state.device.timers.length) return state
      const timerRunning = [...state.device.timerRunning]
      timerRunning[action.timerIndex] = !timerRunning[action.timerIndex]
      return appendHistory(
        { ...state, device: { ...state.device, timerRunning } },
        'action',
        `${actionLabels.TOGGLE_TIMER}: ${action.timerIndex + 1}`,
      )
    }
    case 'RESET_TIMER': {
      if (action.timerIndex < 0 || action.timerIndex >= state.device.timers.length) return state
      const timers = [...state.device.timers]
      const timerRunning = [...state.device.timerRunning]
      timers[action.timerIndex] = action.timerIndex === 3 ? 600 : 0
      timerRunning[action.timerIndex] = false
      return appendHistory(
        { ...state, device: { ...state.device, timers, timerRunning } },
        'action',
        `${actionLabels.RESET_TIMER}: ${action.timerIndex + 1}`,
      )
    }
    case 'TOGGLE_ZERO_FLOW': {
      if (!state.device.safetyHeld) {
        return appendHistory(state, 'system', 'Zero flow requires Safety to be held')
      }
      const zeroFlowDefinition = getDefinition(state)
      return appendHistory(
        zeroFlowDefinition.assessmentPolicy?.preserveCircuitBloodFlow &&
          !state.device.zeroFlowActive
          ? addCriticalError(
              {
                ...state,
                device: {
                  ...state.device,
                  zeroFlowActive: true,
                  safetyHeld: false,
                },
              },
              'capstone-flow-reduction',
              50,
            )
          : {
              ...state,
              device: {
                ...state.device,
                zeroFlowActive: !state.device.zeroFlowActive,
                safetyHeld: false,
              },
              circuit: state.device.zeroFlowActive
                ? { ...state.circuit, backflowSeconds: 0 }
                : state.circuit,
            },
        'action',
        actionLabels.TOGGLE_ZERO_FLOW ?? '',
      )
    }
    case 'TOGGLE_GLOBAL_OVERRIDE': {
      if (!state.device.safetyHeld) {
        return appendHistory(state, 'system', 'Global Override requires Safety to be held')
      }
      const changed = {
        ...state,
        device: {
          ...state.device,
          globalOverride: !state.device.globalOverride,
          safetyHeld: false,
        },
      }
      return appendHistory(
        addCriticalError(changed, 'global-override', 50),
        'action',
        actionLabels.TOGGLE_GLOBAL_OVERRIDE ?? '',
      )
    }
    case 'ACK_ALARM': {
      const selectedId = action.alarmId ?? state.alarms[0]?.id
      const next: EcmoSimulationState = {
        ...state,
        device: { ...state.device, alarmPausedUntil: state.simulationTime + 60 },
        alarms: state.alarms.map((alarm) =>
          alarm.id === selectedId ? { ...alarm, acknowledgedAt: state.simulationTime } : alarm,
        ),
        alarmHistory: state.alarmHistory.map((alarm) =>
          alarm.id === selectedId ? { ...alarm, acknowledgedAt: state.simulationTime } : alarm,
        ),
      }
      return appendHistory(next, 'action', actionLabels.ACK_ALARM ?? '')
    }
    case 'RESET_BUBBLE': {
      if (
        hasFault(state, 'arterial-bubble') &&
        !state.scenario.correctedFaults.includes('arterial-bubble')
      ) {
        return appendHistory(
          addCriticalError(state, 'premature-bubble-reset', 50),
          'action',
          'Bubble reset rejected: correct the cause first',
        )
      }
      const next = {
        ...state,
        device: { ...state.device, pumpRunning: true },
        circuit: {
          ...state.circuit,
          arterialBubbleDetected: false,
          bubbleResetRequired: false,
        },
        scenario: {
          ...state.scenario,
          activeFaults: state.scenario.activeFaults.filter((fault) => fault !== 'arterial-bubble'),
        },
      }
      return appendHistory(next, 'action', 'Bubble intervention reset after cause correction')
    }
    /**
     * Resume support after an air event, in one transition.
     *
     * The old lesson walked the learner out through open-drainage, open-return, reset — which put
     * the patient back on both limbs of a stopped centrifugal circuit before anything was turning.
     * Where clamp opening, pump restart and console reset fall relative to one another during
     * resumption is device- and program-specific, so this module stopped teaching an order. What it
     * teaches instead is the precondition: the source is corrected and the circuit is clear. This
     * bounded action stands in for the device- and program-specific resumption sequence; it does not
     * reproduce or teach that sequence, and completing it is not evidence that any real protocol was
     * followed.
     */
    case 'RESUME_SUPPORT_AFTER_BUBBLE': {
      if (!airIsCorrectedAndClear(state)) {
        return appendHistory(
          addCriticalError(state, 'premature-bubble-reset', 50),
          'action',
          'Resume rejected: correct the air source and clear the circuit first',
        )
      }
      const resumed = deriveSimulation({
        ...state,
        device: { ...state.device, pumpRunning: true },
        circuit: {
          ...state.circuit,
          arterialBubbleDetected: false,
          bubbleResetRequired: false,
          drainageClampClosed: false,
          returnClampClosed: false,
        },
      })
      /*
       * The clinical intervention resolves before the fault is retired, not after.
       *
       * In a clinical case this action is the last required intervention, and resolving it is what
       * records the corrective fault and the credit for it. `correctFault` returns early on a fault
       * that is no longer active, so retiring the fault first would silently cost the learner the
       * cause credit they had just earned.
       */
      const definition = getDefinition(state)
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      const resolved = simulatorIntervention
        ? applyClinicalInterventionAndResolve(resumed, definition, simulatorIntervention.id).state
        : resumed
      const next = {
        ...resolved,
        scenario: {
          ...resolved.scenario,
          activeFaults: resolved.scenario.activeFaults.filter(
            (fault) => fault !== 'arterial-bubble',
          ),
        },
      }
      return appendHistory(
        next,
        'action',
        "Completed the simulation's protocol-governed resumption abstraction",
      )
    }
    case 'TOGGLE_CIRCUIT_CLAMP': {
      const clampKey = action.limb === 'drainage' ? 'drainageClampClosed' : 'returnClampClosed'
      const closing = action.closed ?? !state.circuit[clampKey]
      if (closing === state.circuit[clampKey]) return state
      const definition = getDefinition(state)
      const circuit = {
        ...state.circuit,
        [clampKey]: closing,
      }
      /*
       * The one state resumption may never render.
       *
       * Opening the last closed limb while the bubble latch still holds the pump would put the
       * patient back on both limbs of a circuit that is not moving blood — and a centrifugal head
       * is non-occlusive, so nothing holds a column in place.
       *
       * What happens, precisely: the transition is always refused, so the state is never reached.
       * It is additionally charged while air remains outstanding, because reaching for a clamp then
       * is the same unsafe act whether or not the model lets it land. Once the source is corrected
       * there is nothing unsafe about wanting to resume, so the learner is redirected to the bounded
       * resumption action with no further safety penalty.
       *
       * Scoped to the latch on purpose. Both limbs open with a stopped pump is the ordinary pre-use
       * state of every circuit in this module, and making it globally illegal would break startup.
       */
      if (
        !closing &&
        !circuit.drainageClampClosed &&
        !circuit.returnClampClosed &&
        state.circuit.bubbleResetRequired &&
        !state.device.pumpRunning
      ) {
        // Charged only while the air is still outstanding; after correction the refusal is a
        // redirection rather than a penalty. See the note above the guard for the full rule.
        const held = airIsCorrectedAndClear(state)
          ? state
          : addCriticalError(state, 'unsafe-unclamp-before-deair', 50)
        return appendHistory(
          held,
          'action',
          'Clamp held: resume support per the current IFU and approved local protocol rather than opening the last limb onto a stopped pump',
        )
      }
      const canResumeAfterOpening =
        !closing &&
        !circuit.drainageClampClosed &&
        !circuit.returnClampClosed &&
        !circuit.bubbleResetRequired &&
        !state.device.zeroFlowActive &&
        state.device.rpmSetpoint > 0
      let next = deriveSimulation({
        ...state,
        device: canResumeAfterOpening ? { ...state.device, pumpRunning: true } : state.device,
        circuit,
      })
      if (closing && definition.assessmentPolicy?.preserveCircuitBloodFlow) {
        next = addCriticalError(next, 'capstone-flow-reduction', 50)
      }
      // Opening a clamp is unsafe while circuit air is neither corrected (drill
      // CORRECT_FAULT path) nor cleared (clinical de-air patch clears the latch).
      if (
        !closing &&
        hasFault(state, 'arterial-bubble') &&
        !state.scenario.correctedFaults.includes('arterial-bubble') &&
        state.circuit.bubbleResetRequired
      ) {
        next = addCriticalError(next, 'unsafe-unclamp-before-deair', 50)
      }
      const simulatorIntervention = findMatchingSimulatorIntervention(state, definition, action)
      if (simulatorIntervention) {
        next = applyClinicalInterventionAndResolve(next, definition, simulatorIntervention.id).state
      }
      return appendHistory(
        next,
        'action',
        `${actionLabels.TOGGLE_CIRCUIT_CLAMP}: ${action.limb} ${closing ? 'closed' : 'open'}`,
      )
    }
    case 'CORRECT_FAULT': {
      const next = correctFault(state, action.fault)
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        `${actionLabels.CORRECT_FAULT}: ${action.fault}`,
      )
    }
    case 'APPLY_CLINICAL_INTERVENTION': {
      const definition = getDefinition(state)
      const selected = definition.clinicalCase?.interventions.find(
        (intervention) => intervention.id === action.interventionId,
      )
      if (selected?.simulatorAction) {
        const clinical = state.scenario.clinical
        const next = clinical
          ? {
              ...state,
              scenario: {
                ...state.scenario,
                clinical: {
                  ...clinical,
                  lastResponse: `${selected.simulatorAction.instruction} This action must be completed on the simulator.`,
                },
              },
            }
          : state
        return appendHistory(
          next,
          'system',
          `Action held: use ${selected.simulatorAction.control} on the simulator`,
        )
      }
      const { state: next, result } = applyClinicalInterventionAndResolve(
        state,
        definition,
        action.interventionId,
      )
      return appendHistory(
        next,
        'action',
        result.intervention
          ? `${actionLabels.APPLY_CLINICAL_INTERVENTION}: ${result.intervention.label}`
          : `${actionLabels.APPLY_CLINICAL_INTERVENTION}: unavailable`,
      )
    }
    case 'START_ECMO': {
      const definition = getDefinition(state)
      const result = attemptClinicalEcmoStart(state, definition)
      const next = result.started
        ? updateCredit(
            deriveSimulation(correctFault(result.state, definition.expectation.correctiveFault)),
            { control: true },
          )
        : result.state
      return appendHistory(
        next,
        'action',
        `${actionLabels.START_ECMO}: ${result.started ? 'support established' : result.message}`,
      )
    }
    case 'PERFORM_CHECK': {
      const definition = getDefinition(state)
      const fault = definition.expectation.correctiveFault
      const inspectedState: EcmoSimulationState = {
        ...state,
        circuit: { ...state.circuit, circuitInspected: true },
      }
      if (
        !definition.expectation.requiredCheckId ||
        action.checkId !== definition.expectation.requiredCheckId
      ) {
        return appendHistory(
          inspectedState,
          'action',
          `Tip-to-tip circuit and sensor inspection documented; the scenario cause remains active`,
        )
      }
      const next = correctFault(inspectedState, fault)
      return appendHistory(
        applyControlCredit(state, next, action),
        'action',
        `${actionLabels.PERFORM_CHECK}: ${action.checkId}`,
      )
    }
    case 'REQUEST_HINT': {
      const definition = getDefinition(state)
      const hint = definition.hints?.find((item) => item.id === action.hintId)
      if (!hint || state.scenario.usedHintIds.includes(action.hintId)) return state
      return appendHistory(
        {
          ...state,
          scenario: {
            ...state.scenario,
            usedHintIds: [...state.scenario.usedHintIds, action.hintId],
            hintPenalty: state.scenario.hintPenalty + hint.penalty,
            penalties: state.scenario.penalties + hint.penalty,
          },
        },
        'action',
        `${actionLabels.REQUEST_HINT}: ${hint.title}`,
      )
    }
    case 'COMMIT_REASSESSMENT': {
      const definition = getDefinition(state)
      const reassessment = resolveScenarioReassessment(definition)
      const answers = action.answers
      const hasAllDomains = [
        answers.deviceOptionId,
        answers.circuitOptionId,
        answers.patientOptionId,
      ].every(Boolean)
      const answersCorrect =
        answers.deviceOptionId === reassessment.device.correctOptionId &&
        answers.circuitOptionId === reassessment.circuit.correctOptionId &&
        answers.patientOptionId === reassessment.patient.correctOptionId
      const correctedAt = state.scenario.causeCorrectedAt
      const clinicalActionAt = state.scenario.clinical?.appliedInterventions.at(-1)?.time ?? null
      const acknowledgedAt = state.alarms.reduce<number | null>(
        (latest, alarm) =>
          alarm.acknowledgedAt === undefined
            ? latest
            : Math.max(latest ?? alarm.acknowledgedAt, alarm.acknowledgedAt),
        null,
      )
      const acknowledgementOnlyAttempt = correctedAt === null && acknowledgedAt !== null
      const observationAnchor = correctedAt ?? clinicalActionAt ?? acknowledgedAt
      const minimumObservationSeconds = definition.assessmentPolicy?.minimumObservationSeconds ?? 1
      const observedAfterAction =
        observationAnchor !== null &&
        state.simulationTime - observationAnchor >= minimumObservationSeconds
      const submissionReady = hasAllDomains
      const causeCorrected = state.scenario.correctedFaults.includes(
        definition.expectation.correctiveFault,
      )
      const valid = submissionReady && causeCorrected && answersCorrect && observedAfterAction
      const assessmentState =
        submissionReady && acknowledgementOnlyAttempt
          ? addCriticalError(state, 'ack-without-correction', 30)
          : state
      return appendHistory(
        updateCredit(
          {
            ...assessmentState,
            scenario: {
              ...assessmentState.scenario,
              reassessment: submissionReady ? answers : assessmentState.scenario.reassessment,
              phase: submissionReady ? 'debrief' : 'reassess',
            },
          },
          { reassessment: valid },
        ),
        'action',
        valid
          ? 'Committed reassessment'
          : submissionReady
            ? 'Committed reassessment; the response comparison will be shown in the debrief'
            : 'Choose one device, circuit/gas, and patient response before recording the reassessment',
      )
    }
    case 'REVEAL_DEBRIEF':
      return { ...state, scenario: { ...state.scenario, phase: 'complete' } }
    case 'TOGGLE_ALARM_AUDIO':
      return {
        ...state,
        device: { ...state.device, alarmAudioEnabled: !state.device.alarmAudioEnabled },
      }
    case 'INJECT_FAULT':
      return injectFault(state, action.fault)
    case 'DISCONNECT_FLOW_SENSOR':
      return deriveSimulation(injectFault(state, 'flow-sensor-failure'))
    default:
      return state
  }
}

export interface ScenarioOutcome {
  score: number
  mastery: boolean
  totalPenalty: number
  hintPenalty: number
  maximumScoreAfterHints: number
  criticalErrors: readonly string[]
  completedObjectiveIds: readonly string[]
}

export function selectScenarioOutcome(state: EcmoSimulationState): ScenarioOutcome {
  const definition = getDefinition(state)
  const earned = definition.objectives.reduce((total, objective) => {
    if (objective.category === 'safety') return total
    return total + (state.scenario.credit[objective.category] ? objective.points : 0)
  }, 0)
  const score = clamp(earned - state.scenario.penalties, 0, 100)
  return {
    score,
    mastery: score >= 80 && state.scenario.criticalErrors.length === 0,
    totalPenalty: state.scenario.penalties,
    hintPenalty: state.scenario.hintPenalty,
    maximumScoreAfterHints: clamp(100 - state.scenario.hintPenalty, 0, 100),
    criticalErrors: state.scenario.criticalErrors,
    completedObjectiveIds: state.scenario.completedObjectiveIds,
  }
}

export function selectHighestPriorityAlarm(state: EcmoSimulationState) {
  return state.alarms[0] ?? null
}
