import { hemodynamicCaseById } from '../content/cases'
import type { HemodynamicsSectionId } from '../content/sectionSpecs'
import { icuHemodynamicsReducer } from './reducer'
import { createInitialHemodynamicState } from './simulation'
import { thermodilutionAcceptedAverage } from './thermodilution'
import type {
  CatheterPosition,
  HemodynamicAction,
  HemodynamicSimulationState,
  ThermodilutionTechnique,
} from './types'

/**
 * What the engine holds while a section runs, and what each hands-on step is judged by.
 *
 * Every section opens on an authored state of the one deterministic engine; a step that needs a
 * different state (the prediction that describes a faulty line after a Recognize step showed a
 * clean one; a transfer on a new patient) declares it as an entry state, loaded when the step is
 * entered forward and never when the learner looks back. Goals are pure predicates over the
 * simulation state, so a suite can construct any state and ask which goal failed without driving
 * a catheter through jsdom.
 *
 * The magnitudes here — the offset, the damping ratios, the seeds, the technique of the poor
 * trial — are set for this simulation and are badged as such wherever a learner sees their
 * effect.
 */
export const PA_RETURN_CHECK = 'pa-waveform-return-confirmed'
export const WAVEFORM_RECOGNITION_CHECK = 'waveform-recognition'
export const DYNAMIC_RESPONSE_CLASSIFIED_CHECK = 'dynamic-response-classified'
export const DYNAMIC_RESPONSE_CORRECTED_CHECK = 'dynamic-response-corrected'
export const FAST_FLUSH_CHECK = 'fast-flush'
export const LEVEL_TOLERANCE_CM = 1

export type StageGoal =
  | { readonly type: 'level' }
  | { readonly type: 'zeroed' }
  | { readonly type: 'check'; readonly id: string }
  | { readonly type: 'position'; readonly position: CatheterPosition }
  | { readonly type: 'balloon-down' }
  | { readonly type: 'wedge-stored' }
  | { readonly type: 'trials-reviewed' }
  | { readonly type: 'series' }
  | { readonly type: 'frozen' }
  | { readonly type: 'reassessed' }
  | { readonly type: 'intervention'; readonly id: string }

export function stageGoalMet(goal: StageGoal, state: HemodynamicSimulationState): boolean {
  const checks = new Set(state.signalValidationChecks)
  switch (goal.type) {
    case 'level':
      return Math.abs(state.measurementSystem.transducerLevelCm) <= LEVEL_TOLERANCE_CM
    case 'zeroed':
      return state.measurementSystem.zeroed
    case 'check':
      return checks.has(goal.id)
    case 'position':
      return state.catheter.position === goal.position && state.catheter.targetPosition === null
    case 'balloon-down':
      return (
        state.catheter.position === 'pa' &&
        !state.catheter.balloonInflated &&
        !state.catheter.forcedSafetyRecovery
      )
    case 'wedge-stored':
      return state.catheter.storedWedgeMmHg !== null && state.catheter.storedAtEndExpiration
    case 'trials-reviewed':
      return (
        state.thermodilutionTrials.length > 0 &&
        state.thermodilutionTrials.every((trial) => trial.reviewed && trial.accepted !== null)
      )
    case 'series':
      return thermodilutionAcceptedAverage(state.thermodilutionTrials) !== null
    case 'frozen':
      return state.frozen
    case 'reassessed':
      return state.reassessed
    case 'intervention':
      return state.completedInterventionIds.includes(goal.id)
    default:
      return false
  }
}

const POSITION_WORDS: Readonly<Record<CatheterPosition, string>> = {
  introducer: 'the introducer',
  ra: 'the right atrium',
  rv: 'the right ventricle',
  pa: 'the pulmonary artery',
  wedge: 'the wedge',
}

const CHECK_WORDS: Readonly<Record<string, string>> = {
  [FAST_FLUSH_CHECK]: 'Run a fast flush on the pulmonary-artery line',
  [DYNAMIC_RESPONSE_CLASSIFIED_CHECK]: 'Read the flush response and say what it is',
  [DYNAMIC_RESPONSE_CORRECTED_CHECK]: 'Repair the line until the flush response is acceptable',
  [WAVEFORM_RECOGNITION_CHECK]: 'Name five tracings in a row from their shape',
  [PA_RETURN_CHECK]: 'Say whether the pulmonary-artery tracing has come back',
  'waveform-confirmed-ra': 'Confirm the right atrium from its tracing',
  'waveform-confirmed-rv': 'Confirm the right ventricle from its tracing',
  'waveform-confirmed-pa': 'Confirm the pulmonary artery from its tracing',
  'derived-dependency-chain-validated': 'Name every input one calculation depends on',
  'derived-withheld-for-input-validity': 'Withhold a value for the input that makes it unreadable',
  'derived-selective-invalidation-preserved': 'Keep the values that input does not touch',
  'derived-flow-method-traced': 'Trace a flow-dependent value to the method that produced it',
}

const INTERVENTION_WORDS: Readonly<Record<string, string>> = {
  'correct-measurement-system':
    'Level, zero and repair the line until its flush response is acceptable',
  'reposition-catheter': 'Bring the tip back to a confirmed pulmonary-artery tracing',
  'repeat-valid-thermodilution': 'Build a series from reviewed, usable curves',
}

export function stageGoalLabel(goal: StageGoal): string {
  switch (goal.type) {
    case 'level':
      return 'Level the transducer at the reference'
    case 'zeroed':
      return 'Open to air and zero'
    case 'check':
      return CHECK_WORDS[goal.id] ?? goal.id
    case 'position':
      return `Advance to ${POSITION_WORDS[goal.position]}`
    case 'balloon-down':
      return 'Deflate, with the tip back in the pulmonary artery'
    case 'wedge-stored':
      return 'Store the wedge at end expiration'
    case 'trials-reviewed':
      return 'Read every curve and decide each one'
    case 'series':
      return 'A series of usable curves, averaged'
    case 'frozen':
      return 'Freeze the tracing to label its waves'
    case 'reassessed':
      return 'Reassess the corrected screen against the patient'
    case 'intervention':
      return INTERVENTION_WORDS[goal.id] ?? goal.id
    default:
      return ''
  }
}

/* ------------------------------------------------------------------ *
 * Authored states
 * ------------------------------------------------------------------ */

function requireCase(caseId: string) {
  const definition = hemodynamicCaseById.get(caseId)
  if (!definition) throw new Error(`The stage runtime needs case ${caseId}.`)
  return definition
}

const teachingCase = requireCase('HD-01')
const capstoneCase = requireCase('HD-08')

export function reduceAll(
  state: HemodynamicSimulationState,
  actions: readonly HemodynamicAction[],
): HemodynamicSimulationState {
  return actions.reduce((current, action) => icuHemodynamicsReducer(current, action), state)
}

/** A clean, trusted line on the teaching patient with the tip in the artery. */
export function cleanState(
  seed = 510,
  position: CatheterPosition = 'pa',
): HemodynamicSimulationState {
  return reduceAll(createInitialHemodynamicState(teachingCase, 'learn', seed), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
    { type: 'ZERO_TRANSDUCER' },
    { type: 'SET_DAMPING', dampingRatio: 0.65 },
    { type: 'SET_ARTIFACT', artifact: 'none' },
    { type: 'SET_CATHETER_POSITION', position },
  ])
}

/** The faulty line the pressure-system prediction describes: high, unzeroed, ringing. */
export function faultyLineState(seed = 510): HemodynamicSimulationState {
  return reduceAll(createInitialHemodynamicState(teachingCase, 'learn', seed), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 },
    { type: 'SET_DAMPING', dampingRatio: 0.28 },
    { type: 'SET_ARTIFACT', artifact: 'underdamped' },
    { type: 'SET_CATHETER_POSITION', position: 'pa' },
  ])
}

/** The pressure-system transfer: a new patient, transducer low, line damped. */
export function dampedLineState(seed = 611): HemodynamicSimulationState {
  return reduceAll(createInitialHemodynamicState(teachingCase, 'learn', seed), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: -6 },
    { type: 'ZERO_TRANSDUCER' },
    { type: 'SET_DAMPING', dampingRatio: 1.15 },
    { type: 'SET_ARTIFACT', artifact: 'overdamped' },
    { type: 'SET_CATHETER_POSITION', position: 'pa' },
  ])
}

/** The advancement transfer: a confirmed atrium on a line that has started to ring. */
export function ringingAtriumState(seed = 612): HemodynamicSimulationState {
  return reduceAll(cleanState(seed, 'ra'), [
    { type: 'VALIDATE_SIGNAL', check: 'waveform-confirmed-ra' },
    { type: 'SET_DAMPING', dampingRatio: 0.28 },
    { type: 'SET_ARTIFACT', artifact: 'underdamped' },
  ])
}

/** The wedge transfer: the same patient under more positive pressure, breathing faster. */
export function ventilatedWedgeState(seed = 613): HemodynamicSimulationState {
  const variant = {
    ...teachingCase,
    initialParameters: { ...teachingCase.initialParameters, peepCmH2O: 12, respiratoryRateBpm: 22 },
  }
  return reduceAll(createInitialHemodynamicState(variant, 'learn', seed), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
    { type: 'ZERO_TRANSDUCER' },
    { type: 'SET_CATHETER_POSITION', position: 'pa' },
  ])
}

export function standardTechnique(): ThermodilutionTechnique {
  return {
    injectateVolumeMl: teachingCase.thermodilution.injectateVolumeMl,
    injectateTemperatureC: teachingCase.thermodilution.injectateTemperatureC,
    injectionDurationSeconds: 2.5,
    respiratoryPhase: 'end-expiration',
    smoothness: 0.95,
  }
}

/** Three curves already on the record: two clean, one slow and irregular. */
export function threeTrialState(seed = 510): HemodynamicSimulationState {
  const technique = standardTechnique()
  return reduceAll(cleanState(seed, 'pa'), [
    { type: 'GENERATE_THERMODILUTION_TRIAL', technique },
    {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        ...technique,
        injectionDurationSeconds: 7,
        respiratoryPhase: 'variable',
        smoothness: 0.3,
      },
    },
    { type: 'GENERATE_THERMODILUTION_TRIAL', technique },
  ])
}

/** The derive section: a trusted flow on a line that is not yet level. */
export function unlevelledDerivedState(seed = 510): HemodynamicSimulationState {
  return reduceAll(createInitialHemodynamicState(teachingCase, 'learn', seed), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 8 },
    { type: 'SET_ARTIFACT', artifact: 'none' },
    { type: 'SET_CATHETER_POSITION', position: 'pa' },
  ])
}

/** The capstone: HD-08 as authored — a tip that reads a false wedge on a line that is high, unzeroed and ringing. */
export function capstoneState(seed = 808): HemodynamicSimulationState {
  return createInitialHemodynamicState(capstoneCase, 'learn', seed)
}

/** The capstone transfer: a different patient whose systemic arterial line has gone damped. */
export function dampedArterialState(seed = 616): HemodynamicSimulationState {
  return reduceAll(cleanState(seed, 'pa'), [
    { type: 'SET_DAMPING', dampingRatio: 1.15 },
    { type: 'SET_ARTIFACT', artifact: 'overdamped' },
  ])
}

/* ------------------------------------------------------------------ *
 * Per-section runtime
 * ------------------------------------------------------------------ */

export type StageWatch =
  | 'papSystolic'
  | 'papDiastolic'
  | 'meanPap'
  | 'pulsePressure'
  | 'rap'
  | 'rvSystolic'
  | 'rvDiastolic'
  | 'pawp'
  | 'cardiacOutput'
  | 'position'

export const stageWatchLabels: Readonly<
  Record<StageWatch, { readonly label: string; readonly unit: string; readonly digits: number }>
> = {
  papSystolic: { label: 'PA systolic', unit: 'mmHg', digits: 0 },
  papDiastolic: { label: 'PA diastolic', unit: 'mmHg', digits: 0 },
  meanPap: { label: 'PA mean', unit: 'mmHg', digits: 0 },
  pulsePressure: { label: 'PA pulse pressure', unit: 'mmHg', digits: 0 },
  rap: { label: 'Right atrial mean', unit: 'mmHg', digits: 0 },
  rvSystolic: { label: 'RV systolic', unit: 'mmHg', digits: 0 },
  rvDiastolic: { label: 'RV end-diastolic', unit: 'mmHg', digits: 0 },
  pawp: { label: 'Stored wedge', unit: 'mmHg', digits: 0 },
  cardiacOutput: { label: 'Cardiac output', unit: 'L/min', digits: 1 },
  position: { label: 'Tip position', unit: '', digits: 0 },
}

export function stageWatchValue(
  watch: StageWatch,
  state: HemodynamicSimulationState,
): number | string | null {
  const measurements = state.measurements
  switch (watch) {
    case 'papSystolic':
      return measurements.papSystolicMmHg
    case 'papDiastolic':
      return measurements.papDiastolicMmHg
    case 'meanPap':
      return measurements.meanPapMmHg
    case 'pulsePressure':
      return measurements.papSystolicMmHg - measurements.papDiastolicMmHg
    case 'rap':
      return measurements.rapMmHg
    case 'rvSystolic':
      return measurements.rvSystolicMmHg
    case 'rvDiastolic':
      return measurements.rvDiastolicMmHg
    case 'pawp':
      return state.catheter.storedWedgeMmHg
    case 'cardiacOutput':
      return thermodilutionAcceptedAverage(state.thermodilutionTrials)
    case 'position':
      return POSITION_WORDS[state.catheter.position]
    default:
      return null
  }
}

export interface SectionRuntime {
  readonly sectionId: HemodynamicsSectionId
  /** The state the section opens on. */
  readonly initial: () => HemodynamicSimulationState
  /** The state the prediction step is written against, when it differs from the opening state. */
  readonly predictionEntry?: () => HemodynamicSimulationState
  readonly actGoals: readonly StageGoal[]
  readonly observeGoals: readonly StageGoal[]
  /** The state the transfer opens on; `null` keeps the learner's own state. */
  readonly transferEntry: (() => HemodynamicSimulationState) | null
  readonly transferGoals: readonly StageGoal[]
  /** The readings compared before and after the hands-on work. */
  readonly watch: readonly StageWatch[]
  /** The catheter positions the route map walks, when the section walks. */
  readonly walkPositions?: readonly CatheterPosition[]
}

const runtimes: Readonly<Record<HemodynamicsSectionId, SectionRuntime>> = {
  'why-measure': {
    sectionId: 'why-measure',
    initial: () => cleanState(500, 'pa'),
    actGoals: [],
    observeGoals: [],
    transferEntry: null,
    transferGoals: [],
    watch: [],
  },
  'pressure-system': {
    sectionId: 'pressure-system',
    initial: () => cleanState(510, 'pa'),
    predictionEntry: () => faultyLineState(510),
    actGoals: [{ type: 'level' }, { type: 'zeroed' }],
    observeGoals: [
      { type: 'check', id: FAST_FLUSH_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CLASSIFIED_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CORRECTED_CHECK },
    ],
    transferEntry: () => dampedLineState(611),
    transferGoals: [
      { type: 'level' },
      { type: 'check', id: FAST_FLUSH_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CLASSIFIED_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CORRECTED_CHECK },
    ],
    watch: ['papSystolic', 'papDiastolic', 'meanPap', 'pulsePressure'],
  },
  'waveform-interpretation': {
    sectionId: 'waveform-interpretation',
    initial: () => cleanState(520, 'ra'),
    predictionEntry: () => cleanState(520, 'rv'),
    actGoals: [{ type: 'check', id: WAVEFORM_RECOGNITION_CHECK }],
    observeGoals: [],
    transferEntry: () => cleanState(521, 'wedge'),
    transferGoals: [],
    watch: ['position'],
    walkPositions: ['ra', 'rv', 'pa', 'wedge'],
  },
  'waveform-components': {
    sectionId: 'waveform-components',
    initial: () => cleanState(530, 'ra'),
    actGoals: [{ type: 'frozen' }],
    observeGoals: [],
    transferEntry: null,
    transferGoals: [],
    watch: ['rap'],
  },
  'catheter-advancement': {
    sectionId: 'catheter-advancement',
    initial: () => cleanState(540, 'introducer'),
    predictionEntry: () =>
      reduceAll(cleanState(540, 'ra'), [
        { type: 'VALIDATE_SIGNAL', check: 'waveform-confirmed-ra' },
      ]),
    actGoals: [
      { type: 'position', position: 'rv' },
      { type: 'check', id: 'waveform-confirmed-rv' },
      { type: 'position', position: 'pa' },
      { type: 'check', id: 'waveform-confirmed-pa' },
    ],
    observeGoals: [],
    transferEntry: () => ringingAtriumState(612),
    transferGoals: [
      { type: 'check', id: FAST_FLUSH_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CLASSIFIED_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CORRECTED_CHECK },
      { type: 'position', position: 'rv' },
      { type: 'check', id: 'waveform-confirmed-rv' },
    ],
    watch: ['rvSystolic', 'rvDiastolic', 'papSystolic', 'papDiastolic', 'position'],
  },
  'pawp-capture': {
    sectionId: 'pawp-capture',
    initial: () => cleanState(550, 'pa'),
    actGoals: [{ type: 'wedge-stored' }, { type: 'balloon-down' }],
    observeGoals: [{ type: 'check', id: PA_RETURN_CHECK }],
    transferEntry: () => ventilatedWedgeState(613),
    transferGoals: [
      { type: 'wedge-stored' },
      { type: 'balloon-down' },
      { type: 'check', id: PA_RETURN_CHECK },
    ],
    watch: ['papDiastolic', 'pawp', 'position'],
  },
  'thermodilution-series': {
    sectionId: 'thermodilution-series',
    initial: () => threeTrialState(560),
    actGoals: [{ type: 'trials-reviewed' }, { type: 'series' }],
    observeGoals: [],
    transferEntry: null,
    transferGoals: [],
    watch: ['cardiacOutput'],
  },
  'derived-hemodynamics': {
    sectionId: 'derived-hemodynamics',
    initial: () => unlevelledDerivedState(570),
    actGoals: [
      { type: 'check', id: 'derived-dependency-chain-validated' },
      { type: 'check', id: 'derived-withheld-for-input-validity' },
      { type: 'check', id: 'derived-selective-invalidation-preserved' },
      { type: 'check', id: 'derived-flow-method-traced' },
    ],
    observeGoals: [],
    transferEntry: null,
    transferGoals: [],
    watch: [],
  },
  'pac-signal-validation': {
    sectionId: 'pac-signal-validation',
    initial: () => capstoneState(808),
    actGoals: [
      { type: 'intervention', id: 'correct-measurement-system' },
      { type: 'intervention', id: 'reposition-catheter' },
      { type: 'intervention', id: 'repeat-valid-thermodilution' },
    ],
    observeGoals: [{ type: 'reassessed' }],
    transferEntry: () => dampedArterialState(616),
    transferGoals: [
      { type: 'check', id: FAST_FLUSH_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CLASSIFIED_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CORRECTED_CHECK },
    ],
    watch: ['papSystolic', 'papDiastolic', 'meanPap', 'pawp', 'cardiacOutput', 'position'],
  },
}

export function sectionRuntime(sectionId: HemodynamicsSectionId): SectionRuntime {
  return runtimes[sectionId]
}

export function goalsMet(goals: readonly StageGoal[], state: HemodynamicSimulationState): boolean {
  return goals.every((goal) => stageGoalMet(goal, state))
}
