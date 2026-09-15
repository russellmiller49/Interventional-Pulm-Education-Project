import type { CrrtWorkedCaseExample, CrrtWorkedComparisonArm } from './content/workedCaseExamples'
import type { RuntimeCrrtCase } from './content/schema'
import { advanceFilterProgression, type FilterProgressionInput } from './engine/filterModel'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningExperience,
  type CrrtLearningSessionState,
} from './engine/learningSession'
import { accessDysfunctionFraction } from './engine/simulation'
import type { CrrtSimulationState } from './engine/types'
import {
  createSyntheticPressureLocalizationResult,
  pressureLocalizationSites,
  type PressureLocalizationSignal,
  type PressureLocalizationSite,
  type QualitativePressureDirection,
} from './pressureLocalizationLabModel'

/**
 * Worked-case explanations say what the simulator does. Every number they show is read from a
 * real session, run through the same reducer a learner drives, so the explanation cannot drift
 * from the modeled response.
 */

export const crrtWorkedSignalIds = [
  'blood-flow',
  'pre-replacement-flow',
  'post-replacement-flow',
  'total-replacement-flow',
  'prescribed-dose',
  'delivered-dose',
  'downtime',
  'access-pressure',
  'filter-pressure',
  'return-pressure',
  'effluent-pressure',
  'tmp',
  'filter-drop',
  'urea-marker',
  'hematocrit',
] as const

export type CrrtWorkedSignalId = (typeof crrtWorkedSignalIds)[number]

export interface CrrtWorkedSignalDefinition {
  readonly label: string
  readonly unit: string
  readonly decimals: number
}

export const crrtWorkedSignals: Readonly<Record<CrrtWorkedSignalId, CrrtWorkedSignalDefinition>> =
  Object.freeze({
    'blood-flow': { label: 'Blood flow', unit: 'mL/min', decimals: 0 },
    'pre-replacement-flow': { label: 'Pre-filter replacement', unit: 'mL/h', decimals: 0 },
    'post-replacement-flow': { label: 'Post-filter replacement', unit: 'mL/h', decimals: 0 },
    'total-replacement-flow': { label: 'Total replacement', unit: 'mL/h', decimals: 0 },
    'prescribed-dose': { label: 'Prescribed effluent dose', unit: 'mL/kg/h', decimals: 1 },
    'delivered-dose': { label: 'Delivered dose', unit: 'mL/kg/h', decimals: 1 },
    downtime: { label: 'Downtime', unit: 'min', decimals: 0 },
    'access-pressure': { label: 'Access pressure', unit: 'mmHg', decimals: 1 },
    'filter-pressure': { label: 'Filter pressure', unit: 'mmHg', decimals: 1 },
    'return-pressure': { label: 'Return pressure', unit: 'mmHg', decimals: 1 },
    'effluent-pressure': { label: 'Effluent pressure', unit: 'mmHg', decimals: 1 },
    tmp: { label: 'TMP', unit: 'mmHg', decimals: 1 },
    'filter-drop': { label: 'Filter pressure drop', unit: 'mmHg', decimals: 1 },
    'urea-marker': { label: 'Small-solute marker', unit: 'mmol/L', decimals: 1 },
    hematocrit: { label: 'Hematocrit', unit: '%', decimals: 0 },
  })

export interface CrrtWorkedSnapshot {
  readonly timeSeconds: number
  readonly values: Readonly<Record<CrrtWorkedSignalId, number | null>>
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function snapshotCrrtWorkedSignals(state: CrrtSimulationState): CrrtWorkedSnapshot {
  const flows = state.prescription.status === 'configured' ? state.prescription.flows : null
  const pressures = state.circuit.pressures
  const patient = state.patient.status === 'configured' ? state.patient : null
  const values: Record<CrrtWorkedSignalId, number | null> = {
    'blood-flow': flows ? flows.bloodFlowMlMin : null,
    'pre-replacement-flow': flows ? flows.preReplacementFlowMlHour : null,
    'post-replacement-flow': flows ? flows.postReplacementFlowMlHour : null,
    'total-replacement-flow': flows
      ? flows.preReplacementFlowMlHour + flows.postReplacementFlowMlHour
      : null,
    'prescribed-dose': finiteOrNull(state.deliveredTherapy.prescribedEffluentDoseMlKgHour),
    'delivered-dose': finiteOrNull(state.deliveredTherapy.deliveredDoseMlKgHour),
    downtime: state.deliveredTherapy.cumulativeDowntimeSeconds / 60,
    'access-pressure': finiteOrNull(pressures.accessPressureMmHg),
    'filter-pressure': finiteOrNull(pressures.filterPressureMmHg),
    'return-pressure': finiteOrNull(pressures.returnPressureMmHg),
    'effluent-pressure': finiteOrNull(pressures.effluentPressureMmHg),
    tmp: finiteOrNull(pressures.prismaxTransmembranePressureMmHg),
    'filter-drop': finiteOrNull(pressures.prismaxFilterPressureDropMmHg),
    'urea-marker': finiteOrNull(patient?.solutes['urea-marker']?.concentrationPerLiter),
    hematocrit: patient ? patient.hematocritFraction * 100 : null,
  }
  return Object.freeze({
    timeSeconds: state.simulationTimeSeconds,
    values: Object.freeze(values),
  })
}

/** Differences smaller than this are rounding, not a modeled change. */
export const CRRT_WORKED_EQUIVALENCE_TOLERANCE = 1e-9

export function formatCrrtWorkedValue(id: CrrtWorkedSignalId, value: number | null): string {
  if (value === null) return 'Unavailable'
  const { unit, decimals } = crrtWorkedSignals[id]
  const rounded = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return unit === '%' ? `${rounded}%` : `${rounded} ${unit}`
}

export function formatCrrtWorkedDifference(id: CrrtWorkedSignalId, difference: number | null) {
  if (difference === null) return 'Unavailable'
  const { unit, decimals } = crrtWorkedSignals[id]
  if (Math.abs(difference) <= CRRT_WORKED_EQUIVALENCE_TOLERANCE) return 'No change'
  // Whole-number signals (flows, minutes) stay whole; small pressure changes need two places.
  const digits = decimals === 0 ? 0 : 2
  const shown = Math.abs(difference).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const sign = difference > 0 ? '+' : '−'
  return unit === '%' ? `${sign}${shown}%` : `${sign}${shown} ${unit}`
}

export function formatCrrtWorkedClock(seconds: number): string {
  if (seconds === 0) return 'start'
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hr`
  return `${Math.round(seconds / 60)} min`
}

/** Case interventions are authored per case with a stable suffix; resolve exactly one. */
export function resolveCrrtInterventionIdBySuffix(
  definition: RuntimeCrrtCase,
  suffix: string,
): string {
  const matches = definition.interventions.filter(({ id }) => id.endsWith(suffix))
  if (matches.length !== 1) {
    throw new Error(
      `${definition.id} has ${matches.length} interventions ending in ${suffix}; expected one.`,
    )
  }
  return matches[0].id
}

function freshSession(
  definition: RuntimeCrrtCase,
  experience: CrrtLearningExperience,
): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: definition,
    experience,
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

/** Performs the arm's actions through the learner reducer, then advances to the arm's clock. */
export function runCrrtWorkedArm(
  definition: RuntimeCrrtCase,
  arm: CrrtWorkedComparisonArm,
  experience: CrrtLearningExperience = 'practice',
): CrrtLearningSessionState {
  let session = freshSession(definition, experience)
  for (const suffix of arm.interventionSuffixes) {
    const interventionId = resolveCrrtInterventionIdBySuffix(definition, suffix)
    const next = crrtLearningSessionReducer(session, {
      type: 'PERFORM_INTERVENTION',
      interventionId,
    })
    if (next.performedInterventionIds.length === session.performedInterventionIds.length) {
      throw new Error(`${definition.id} comparison could not perform ${interventionId}.`)
    }
    session = next
  }
  const remainingSeconds = arm.observeSeconds - session.simulation.simulationTimeSeconds
  if (remainingSeconds < 0) {
    throw new Error(`${definition.id} comparison arm "${arm.label}" overran its clock.`)
  }
  if (remainingSeconds > 0) {
    session = crrtLearningSessionReducer(session, {
      type: 'ADVANCE_TIME',
      seconds: remainingSeconds,
    })
  }
  return session
}

export interface CrrtWorkedComparisonRow {
  readonly id: CrrtWorkedSignalId
  readonly label: string
  readonly first: number | null
  readonly second: number | null
  readonly difference: number | null
}

export interface CrrtWorkedComparisonResult {
  readonly armLabels: readonly [string, string]
  readonly clocks: readonly [number, number]
  readonly rows: readonly CrrtWorkedComparisonRow[]
}

const comparisonCache = new Map<string, CrrtWorkedComparisonResult>()

export function selectCrrtWorkedComparison(
  definition: RuntimeCrrtCase,
  example: CrrtWorkedCaseExample,
  experience: CrrtLearningExperience = 'practice',
): CrrtWorkedComparisonResult {
  const key = `${definition.id}:${definition.contentVersion}:${experience}`
  const cached = comparisonCache.get(key)
  if (cached) return cached

  const [firstArm, secondArm] = example.comparison.arms
  const first = snapshotCrrtWorkedSignals(
    runCrrtWorkedArm(definition, firstArm, experience).simulation,
  )
  const second = snapshotCrrtWorkedSignals(
    runCrrtWorkedArm(definition, secondArm, experience).simulation,
  )
  const rows = example.comparison.signalIds.map((id) => {
    const firstValue = first.values[id]
    const secondValue = second.values[id]
    return Object.freeze({
      id,
      label: crrtWorkedSignals[id].label,
      first: firstValue,
      second: secondValue,
      difference: firstValue === null || secondValue === null ? null : secondValue - firstValue,
    })
  })
  const result: CrrtWorkedComparisonResult = Object.freeze({
    armLabels: [firstArm.label, secondArm.label] as const,
    clocks: [first.timeSeconds, second.timeSeconds] as const,
    rows: Object.freeze(rows),
  })
  comparisonCache.set(key, result)
  return result
}

export type CrrtWorkedRunStartOptions = Pick<
  CrrtLearningSessionState,
  'caseDefinition' | 'fixture' | 'experience' | 'roleLens' | 'attempt'
> & { readonly deviceId: CrrtSimulationState['deviceId'] }

/** The unperformed starting point of the learner's own session, rebuilt from the same options. */
export function selectCrrtWorkedRunStart(options: CrrtWorkedRunStartOptions): CrrtWorkedSnapshot {
  return snapshotCrrtWorkedSignals(createCrrtLearningSession(options).simulation)
}

export type CrrtWorkedRunStatus = 'not-started' | 'actions-without-time' | 'observed'

export interface CrrtWorkedRunObservation {
  readonly status: CrrtWorkedRunStatus
  /** The comparison's actions the learner has actually performed in this session. */
  readonly performedComparisonActionIds: readonly string[]
  readonly comparisonActionIds: readonly string[]
  readonly start: CrrtWorkedSnapshot
  readonly current: CrrtWorkedSnapshot
}

export function selectCrrtWorkedRunObservation(
  session: CrrtLearningSessionState,
  example: CrrtWorkedCaseExample,
  start: CrrtWorkedSnapshot,
): CrrtWorkedRunObservation {
  const definition = session.caseDefinition
  const comparisonActionIds = [
    ...new Set(
      example.comparison.arms.flatMap(({ interventionSuffixes }) =>
        interventionSuffixes.map((suffix) => resolveCrrtInterventionIdBySuffix(definition, suffix)),
      ),
    ),
  ]
  const performed = new Set(session.performedInterventionIds)
  const current = snapshotCrrtWorkedSignals(session.simulation)
  const timeAdvanced = current.timeSeconds > start.timeSeconds
  return Object.freeze({
    status: timeAdvanced
      ? 'observed'
      : session.performedInterventionIds.length > 0
        ? 'actions-without-time'
        : 'not-started',
    performedComparisonActionIds: comparisonActionIds.filter((id) => performed.has(id)),
    comparisonActionIds,
    start,
    current,
  })
}

export interface CrrtWorkedRetiredIds {
  readonly interventionIds: ReadonlySet<string>
  readonly reassessmentOptionIds: ReadonlySet<string>
}

export function selectCrrtWorkedRetiredIds(
  definition: RuntimeCrrtCase,
  example: CrrtWorkedCaseExample | undefined,
): CrrtWorkedRetiredIds {
  if (!example) return { interventionIds: new Set(), reassessmentOptionIds: new Set() }
  return {
    interventionIds: new Set(
      example.retired.interventionSuffixes.map((suffix) =>
        resolveCrrtInterventionIdBySuffix(definition, suffix),
      ),
    ),
    reassessmentOptionIds: new Set(
      definition.reassessmentOptions
        .filter(({ id }) =>
          example.retired.reassessmentSuffixes.some((suffix) => id.endsWith(suffix)),
        )
        .map(({ id }) => id),
    ),
  }
}

export const crrtWorkedPressureLocationSignals = [
  'access',
  'filter',
  'return',
  'tmp',
  'filter-drop',
] as const satisfies readonly PressureLocalizationSignal[]

export type CrrtWorkedPressureLocationSignal = (typeof crrtWorkedPressureLocationSignals)[number]

export interface CrrtWorkedPressureLocationRow {
  readonly site: PressureLocalizationSite
  readonly siteLabel: string
  readonly directions: Readonly<
    Record<CrrtWorkedPressureLocationSignal, QualitativePressureDirection>
  >
  readonly locationExplanation: string
}

const workedPressureLocationSites = [
  'access-catheter',
  'filter',
  'return-line',
  'effluent-line',
] as const satisfies readonly PressureLocalizationSite[]

/** Direction signatures from the module's pressure-location model, one resistance at a time. */
export function selectCrrtWorkedPressureLocations(): readonly CrrtWorkedPressureLocationRow[] {
  return workedPressureLocationSites.map((site) => {
    const result = createSyntheticPressureLocalizationResult('obstruction', site)
    const directionOf = (signal: CrrtWorkedPressureLocationSignal) => {
      const match = result.signals.find(({ id }) => id === signal)
      if (!match) throw new Error(`Pressure-location model omitted ${signal}.`)
      return match.direction
    }
    return Object.freeze({
      site,
      siteLabel:
        pressureLocalizationSites.find((candidate) => candidate.id === site)?.label ?? site,
      directions: Object.freeze({
        access: directionOf('access'),
        filter: directionOf('filter'),
        return: directionOf('return'),
        tmp: directionOf('tmp'),
        'filter-drop': directionOf('filter-drop'),
      }),
      locationExplanation: result.locationExplanation,
    })
  })
}

export const crrtWorkedFilterTermIds = [
  'access',
  'filtration',
  'hematocrit',
  'interruption',
  'low-flow',
  'procoagulant',
] as const

export type CrrtWorkedFilterTermId = (typeof crrtWorkedFilterTermIds)[number]

export interface CrrtWorkedFilterTerms {
  /** Terms contributing to the filter model's burden rate right now, in listed order. */
  readonly activeTermIds: readonly CrrtWorkedFilterTermId[]
  readonly termRiskIndex: Readonly<Record<CrrtWorkedFilterTermId, number>>
  readonly unprotectedRiskIndex: number
}

const zeroFilterInput = (input: FilterProgressionInput): FilterProgressionInput => ({
  ...input,
  filtrationFraction: 0,
  bloodFlowInterruptionFraction: 0,
  lowEffectiveBloodFlowFraction: 0,
  accessDysfunctionFraction: 0,
  hematocritFraction: 0,
  procoagulantBurdenFraction: 0,
})

/**
 * Splits the filter model's risk index into its terms by asking the filter model itself for each
 * term alone. Interruption follows the delivery state the next simulated minute would use.
 */
export function selectCrrtWorkedFilterTerms(
  state: CrrtSimulationState,
): CrrtWorkedFilterTerms | null {
  const parameters = state.scenario.modelConfiguration.filter
  const filtrationFraction = state.scenario.modelConfiguration.filtrationFraction
  if (
    !parameters ||
    filtrationFraction === null ||
    state.patient.status !== 'configured' ||
    state.access.status !== 'configured' ||
    state.prescription.status !== 'configured'
  ) {
    return null
  }
  const full: FilterProgressionInput = {
    filtrationFraction,
    bloodFlowInterruptionFraction: state.device.deliveryState === 'running' ? 0 : 1,
    lowEffectiveBloodFlowFraction: state.circuit.filter.lowEffectiveBloodFlowFraction,
    accessDysfunctionFraction: accessDysfunctionFraction(state.access),
    hematocritFraction: state.patient.hematocritFraction,
    procoagulantBurdenFraction: state.circuit.filter.procoagulantBurdenFraction,
    anticoagulation: state.prescription.anticoagulation,
  }
  const riskIndex = (input: FilterProgressionInput) =>
    advanceFilterProgression(state.circuit.filter, input, parameters, 0).unprotectedRiskIndex
  const empty = zeroFilterInput(full)
  const termRiskIndex: Record<CrrtWorkedFilterTermId, number> = {
    access: riskIndex({ ...empty, accessDysfunctionFraction: full.accessDysfunctionFraction }),
    filtration: riskIndex({ ...empty, filtrationFraction: full.filtrationFraction }),
    hematocrit: riskIndex({ ...empty, hematocritFraction: full.hematocritFraction }),
    interruption: riskIndex({
      ...empty,
      bloodFlowInterruptionFraction: full.bloodFlowInterruptionFraction,
    }),
    'low-flow': riskIndex({
      ...empty,
      lowEffectiveBloodFlowFraction: full.lowEffectiveBloodFlowFraction,
    }),
    procoagulant: riskIndex({
      ...empty,
      procoagulantBurdenFraction: full.procoagulantBurdenFraction,
    }),
  }
  return Object.freeze({
    activeTermIds: crrtWorkedFilterTermIds.filter(
      (id) => termRiskIndex[id] > CRRT_WORKED_EQUIVALENCE_TOLERANCE,
    ),
    termRiskIndex: Object.freeze(termRiskIndex),
    unprotectedRiskIndex: riskIndex(full),
  })
}
