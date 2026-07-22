import type {
  IcuPatientState,
  IcuResponseCriterionEvaluation,
  IcuResponseEvaluation,
  IcuResponseNumericMetric,
  IcuResponsePredicate,
  IcuResponseTarget,
  IcuScenarioDefinition,
  IcuSimulationState,
} from './types'

const RESPONSE_UNITS: Readonly<Record<IcuResponseNumericMetric, string>> = {
  'map-mm-hg': 'mmHg',
  'native-cardiac-output-l-min': 'L/min',
  'effective-systemic-flow-l-min': 'L/min',
  'rap-mm-hg': 'mmHg',
  'pawp-mm-hg': 'mmHg',
  'svr-dyn-sec-cm5': 'dyn·s/cm⁵',
  'pvr-wu': 'WU',
  'pericardial-pressure-mm-hg': 'mmHg',
  'circulating-volume-ml': 'mL',
  'spo2-percent': '%',
  'potassium-mmol-l': 'mmol/L',
  'hemoglobin-g-dl': 'g/dL',
  'lactate-mmol-l': 'mmol/L',
  'infection-burden': 'modeled fraction',
  'pulmonary-obstruction-severity': 'modeled fraction',
}

function numericMetric(patient: IcuPatientState, metric: IcuResponseNumericMetric): number {
  if (metric === 'map-mm-hg') return patient.hemodynamics.mapMmHg
  if (metric === 'native-cardiac-output-l-min') return patient.hemodynamics.nativeCardiacOutputLMin
  if (metric === 'effective-systemic-flow-l-min')
    return patient.hemodynamics.effectiveSystemicFlowLMin
  if (metric === 'rap-mm-hg') return patient.hemodynamics.rapMmHg
  if (metric === 'pawp-mm-hg') return patient.hemodynamics.pawpMmHg
  if (metric === 'svr-dyn-sec-cm5') return patient.hemodynamics.systemicVascularResistanceDynSecCm5
  if (metric === 'pvr-wu') return patient.hemodynamics.pulmonaryVascularResistanceWU
  if (metric === 'pericardial-pressure-mm-hg') return patient.hemodynamics.pericardialPressureMmHg
  if (metric === 'circulating-volume-ml') return patient.hemodynamics.circulatingVolumeMl
  if (metric === 'spo2-percent') return patient.respiratory.spo2Percent
  if (metric === 'potassium-mmol-l') return patient.renal.potassiumMmolL
  if (metric === 'hemoglobin-g-dl') return patient.hematology.hemoglobinGdl
  if (metric === 'lactate-mmol-l') return patient.perfusion.lactateMmolL
  if (metric === 'infection-burden') return patient.drivers.infectionBurden
  if (metric === 'pulmonary-obstruction-severity')
    return patient.drivers.pulmonaryVascularObstructionSeverity
  const exhaustive: never = metric
  return exhaustive
}

function booleanMetric(
  patient: IcuPatientState,
  metric: Extract<IcuResponsePredicate, { kind: 'boolean' }>['metric'],
): boolean {
  if (metric === 'antimicrobials-administered') return patient.antimicrobialsAdministered
  if (metric === 'source-control-completed') return patient.sourceControlCompleted
  if (metric === 'reperfusion-completed') return patient.reperfusionCompleted
  if (metric === 'tamponade-drained') return patient.tamponadeDrained
  const exhaustive: never = metric
  return exhaustive
}

function resolvedTarget(initial: number, target: IcuResponseTarget): number {
  if (target.kind === 'absolute') return target.value
  if (target.kind === 'initial-delta') return initial + target.delta
  return initial * target.ratio
}

function compactNumber(value: number): string {
  return Number(value.toFixed(Math.abs(value) >= 100 ? 0 : 2)).toString()
}

function targetDescription(
  comparison: 'gte' | 'lte',
  target: IcuResponseTarget,
  initial: number,
): string {
  const operator = comparison === 'gte' ? '≥' : '≤'
  const resolved = compactNumber(resolvedTarget(initial, target))
  if (target.kind === 'absolute') return `${operator} ${resolved}`
  if (target.kind === 'initial-delta') {
    const sign = target.delta >= 0 ? '+' : '−'
    return `${operator} ${resolved} (initial ${sign} ${compactNumber(Math.abs(target.delta))})`
  }
  return `${operator} ${resolved} (${compactNumber(target.ratio)} × initial)`
}

function evaluatePredicate(
  predicate: IcuResponsePredicate,
  state: Pick<IcuSimulationState, 'patient' | 'devices' | 'alarms' | 'performedActionIds'>,
  scenario: IcuScenarioDefinition,
  pathId: string | null,
): IcuResponseCriterionEvaluation {
  if (predicate.kind === 'numeric') {
    const actual = numericMetric(state.patient, predicate.metric)
    const initial = numericMetric(scenario.initialPatient, predicate.metric)
    const target = resolvedTarget(initial, predicate.target)
    return {
      id: predicate.id,
      label: predicate.label,
      pathId,
      passed: predicate.comparison === 'gte' ? actual >= target : actual <= target,
      actual,
      target: targetDescription(predicate.comparison, predicate.target, initial),
      unit: RESPONSE_UNITS[predicate.metric],
    }
  }
  if (predicate.kind === 'boolean') {
    const actual = booleanMetric(state.patient, predicate.metric)
    return {
      id: predicate.id,
      label: predicate.label,
      pathId,
      passed: actual === predicate.expected,
      actual,
      target: predicate.expected ? 'completed' : 'not completed',
      unit: null,
    }
  }
  if (predicate.kind === 'therapy-running') {
    const actual = state.devices[predicate.therapy].status === 'running'
    return {
      id: predicate.id,
      label: predicate.label,
      pathId,
      passed: actual === predicate.expected,
      actual: actual ? 'running' : 'not running',
      target: predicate.expected ? 'running' : 'not running',
      unit: null,
    }
  }
  if (predicate.kind === 'therapy-never-started') {
    const started = state.performedActionIds.includes(`therapy:${predicate.therapy}:start`)
    return {
      id: predicate.id,
      label: predicate.label,
      pathId,
      passed: !started,
      actual: started ? 'started previously' : 'never started',
      target: 'never started',
      unit: null,
    }
  }
  if (predicate.kind === 'no-active-device-limitation') {
    const activeAlarmCount = state.alarms.filter(
      (alarm) =>
        alarm.active && predicate.subsystems.some((subsystem) => subsystem === alarm.subsystem),
    ).length
    return {
      id: predicate.id,
      label: predicate.label,
      pathId,
      passed: activeAlarmCount === 0,
      actual: activeAlarmCount,
      target: '0 unresolved device limitations',
      unit: null,
    }
  }
  const activeAlarmCount = state.alarms.filter(
    (alarm) =>
      alarm.active &&
      alarm.priority === 'critical' &&
      predicate.subsystems.includes(alarm.subsystem),
  ).length
  return {
    id: predicate.id,
    label: predicate.label,
    pathId,
    passed: activeAlarmCount === 0,
    actual: activeAlarmCount,
    target: '0 active critical alarms',
    unit: null,
  }
}

export function createEmptyIcuResponseEvaluation(): IcuResponseEvaluation {
  return {
    evaluated: false,
    passed: false,
    passedPathIds: [],
    substitutedActionIds: [],
    criteria: [],
  }
}

/**
 * Evaluates authored educational-model response thresholds without changing patient truth,
 * learner action history, replay, or checkpoint order.
 */
export function evaluateIcuMasteryResponse(
  state: Pick<IcuSimulationState, 'patient' | 'devices' | 'alarms' | 'performedActionIds'>,
  scenario: IcuScenarioDefinition,
): IcuResponseEvaluation {
  const required = scenario.masteryResponse.required.map((predicate) =>
    evaluatePredicate(predicate, state, scenario, null),
  )
  const pathEvaluations = (scenario.masteryResponse.oneOf ?? []).map((path) => {
    const criteria = path.predicates.map((predicate) =>
      evaluatePredicate(predicate, state, scenario, path.id),
    )
    return { path, criteria, passed: criteria.every((criterion) => criterion.passed) }
  })
  const passedPaths = pathEvaluations.filter((path) => path.passed)
  const requiredPassed = required.every((criterion) => criterion.passed)
  const pathPassed = pathEvaluations.length === 0 || passedPaths.length > 0
  const passed = requiredPassed && pathPassed
  const substitutions = passed
    ? [...new Set(passedPaths.flatMap(({ path }) => path.substitutesForActionIds))].sort()
    : []
  return {
    evaluated: true,
    passed,
    passedPathIds: passedPaths.map(({ path }) => path.id),
    substitutedActionIds: substitutions,
    criteria: [...required, ...pathEvaluations.flatMap(({ criteria }) => criteria)],
  }
}
