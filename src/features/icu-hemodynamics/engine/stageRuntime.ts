import { hemodynamicCaseById, normalCirculationParameters } from '../content/cases'
import type { HemodynamicsSectionId } from '../content/sectionSpecs'
import { icuHemodynamicsReducer } from './reducer'
import { paReturnEpisodeKey, paWaveformReturned } from './catheterSafety'
import {
  pressureObservationKey,
  catheterFlushBlocked,
  flushReleaseReady,
} from './pressureObservation'
import { currentThermodilutionAverage, thermodilutionSeriesView } from './measurementProvenance'
import { createInitialHemodynamicState, unroundedModelEstimates } from './simulation'
import type {
  CatheterPosition,
  HemodynamicAction,
  HemodynamicCaseDefinition,
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
export const DYNAMIC_RESPONSE_CLASSIFIED_CHECK = 'dynamic-response-classified'
export const DYNAMIC_RESPONSE_CORRECTED_CHECK = 'dynamic-response-corrected'
export const FAST_FLUSH_CHECK = 'fast-flush'
/** A flush of one named line (`fast-flush:<line>`), set beside the generic check. */
export const ARTERIAL_FAST_FLUSH_CHECK = 'fast-flush:systemic-arterial'
/** Evidence unique to this Learn reassessment; a correction click cannot supply it. */
export const CURRENT_RESPONSE_RECHECKED = 'learn-current-response-rechecked'
export const LEVEL_TOLERANCE_CM = 1

export type StageGoal =
  | { readonly type: 'level' }
  | { readonly type: 'zeroed' }
  | { readonly type: 'check'; readonly id: string }
  /** The tip has reached this stop — or gone past it, which means it was reached on the way. */
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
      if (goal.id === PA_RETURN_CHECK) {
        // The observation belongs to one occlusion. A confirmation taken before any balloon went
        // up, or left over from an earlier wedge, is not this episode's (report L6-05).
        const episode = paReturnEpisodeKey(state)
        return (
          episode !== null &&
          paWaveformReturned(state) &&
          checks.has(`${PA_RETURN_CHECK}:${episode}`)
        )
      }
      if (goal.id === CURRENT_RESPONSE_RECHECKED) {
        return (
          !catheterFlushBlocked(state, 'pulmonary-artery') &&
          flushReleaseReady(state) &&
          state.measurementSystem.artifact === 'none' &&
          checks.has(
            `${CURRENT_RESPONSE_RECHECKED}:${pressureObservationKey(state, 'pulmonary-artery')}`,
          )
        )
      }
      return checks.has(goal.id)
    case 'position': {
      if (state.catheter.targetPosition !== null) return false
      const route: readonly CatheterPosition[] = ['introducer', 'ra', 'rv', 'pa', 'wedge']
      return route.indexOf(state.catheter.position) >= route.indexOf(goal.position)
    }
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
      // A series for the conditions now — not one acquired before a modeled intervention.
      return thermodilutionSeriesView(state).currentEstablished
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
  [FAST_FLUSH_CHECK]: 'Run a fast flush on the catheter’s distal lumen',
  [ARTERIAL_FAST_FLUSH_CHECK]: 'Run a fast flush on the arterial line',
  [DYNAMIC_RESPONSE_CLASSIFIED_CHECK]: 'Read the flush response and say what it is',
  [DYNAMIC_RESPONSE_CORRECTED_CHECK]: 'Repair the line until the flush response is acceptable',
  [CURRENT_RESPONSE_RECHECKED]: 'Flush the corrected line again and identify the current response',
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

/**
 * The teaching patient: the module's first case with a quiet, normal circulation in place of its
 * shock. Every Learn section but the capstone runs on it, so a learner meets the normal state
 * before any fault is put in front of it; the capstone runs on the authored HD-08.
 */
const teachingCase: HemodynamicCaseDefinition = {
  ...requireCase('HD-01'),
  title: 'A quiet circulation on a monitored bed',
  shortTitle: 'Teaching patient',
  presentation:
    'An adult on a monitored bed with a quiet, unremarkable circulation, a pulmonary-artery catheter in place, and an arterial line. Nothing about this patient is in question; the line and the catheter are.',
  initialParameters: normalCirculationParameters,
  initialMeasurementSystem: { zeroed: false },
}
const capstoneCase = requireCase('HD-08')

export function reduceAll(
  state: HemodynamicSimulationState,
  actions: readonly HemodynamicAction[],
): HemodynamicSimulationState {
  return actions.reduce((current, action) => icuHemodynamicsReducer(current, action), state)
}

/** The teaching patient exactly as authored: level, unzeroed, well damped, tip in the artery. */
export function freshTeachingState(seed = 700): HemodynamicSimulationState {
  return createInitialHemodynamicState(teachingCase, 'learn', seed)
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

/** Isolated teaching states. No physiology changes or application credit are introduced. */
export function pressureDemonstrationState(topic: 'level' | 'zero' | 'scale' | 'response') {
  if (topic === 'zero') return freshTeachingState(510)
  return cleanState(510, 'pa')
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

/**
 * The capstone transfer: a different patient whose systemic arterial line has gone damped.
 *
 * Only the arterial line (report L9-05). This used to damp the shared measurement system, so the
 * pulmonary-artery and central-venous traces were damped too and "repairing the arterial line"
 * restored all three. The arterial line's own response is set; the others are left clean.
 */
export function dampedArterialState(seed = 616): HemodynamicSimulationState {
  return reduceAll(cleanState(seed, 'pa'), [
    { type: 'SET_DAMPING', dampingRatio: 1.15, line: 'systemic-arterial' },
    { type: 'SET_ARTIFACT', artifact: 'overdamped', line: 'systemic-arterial' },
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
  | 'artSystolic'
  | 'artDiastolic'
  | 'artPulsePressure'
  | 'rap'
  | 'rvSystolic'
  | 'rvDiastolic'
  | 'pawp'
  | 'cardiacOutput'
  | 'position'

export const stageWatchLabels: Readonly<
  Record<StageWatch, { readonly label: string; readonly unit: string; readonly digits: number }>
> = {
  papSystolic: { label: 'PA systolic', unit: 'mmHg', digits: 1 },
  papDiastolic: { label: 'PA diastolic', unit: 'mmHg', digits: 1 },
  meanPap: { label: 'PA mean', unit: 'mmHg', digits: 1 },
  pulsePressure: { label: 'PA pulse pressure', unit: 'mmHg', digits: 1 },
  artSystolic: { label: 'Arterial systolic', unit: 'mmHg', digits: 1 },
  artDiastolic: { label: 'Arterial diastolic', unit: 'mmHg', digits: 1 },
  artPulsePressure: { label: 'Arterial pulse pressure', unit: 'mmHg', digits: 1 },
  rap: { label: 'Right atrial mean', unit: 'mmHg', digits: 1 },
  rvSystolic: { label: 'RV systolic', unit: 'mmHg', digits: 1 },
  rvDiastolic: { label: 'RV end-diastolic', unit: 'mmHg', digits: 1 },
  pawp: { label: 'Stored wedge', unit: 'mmHg', digits: 0 },
  cardiacOutput: { label: 'Cardiac output', unit: 'L/min', digits: 1 },
  position: { label: 'Tip position', unit: '', digits: 0 },
}

/**
 * One reading for the before-and-after table.
 *
 * Pressures are the model's estimates before rounding (HD-PRE-REVIEW-02): a difference is taken
 * between unrounded values and shown to a tenth of a mmHg, so a pure offset reads as the same
 * change on every row instead of +5 on one and +6 on the next. They are model estimates, not the
 * monitor's last beat, and the table says so.
 */
export function stageWatchValue(
  watch: StageWatch,
  state: HemodynamicSimulationState,
): number | string | null {
  const measurements = unroundedModelEstimates(state)
  switch (watch) {
    case 'papSystolic':
      return measurements.papSystolicMmHg
    case 'papDiastolic':
      return measurements.papDiastolicMmHg
    case 'meanPap':
      return measurements.meanPapMmHg
    case 'pulsePressure':
      return measurements.papSystolicMmHg - measurements.papDiastolicMmHg
    case 'artSystolic':
      return measurements.artSystolicMmHg
    case 'artDiastolic':
      return measurements.artDiastolicMmHg
    case 'artPulsePressure':
      return measurements.artSystolicMmHg - measurements.artDiastolicMmHg
    case 'rap':
      return measurements.rapMmHg
    case 'rvSystolic':
      return measurements.rvSystolicMmHg
    case 'rvDiastolic':
      return measurements.rvDiastolicMmHg
    case 'pawp':
      return state.catheter.storedWedgeMmHg
    case 'cardiacOutput':
      return currentThermodilutionAverage(state)
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
  /** The readings for the transfer round, when they are not the section's own (report L9-05). */
  readonly transferWatch?: readonly StageWatch[]
  /**
   * What the Explain step compares: the readings before and after the work, or — for the section
   * whose work is moving the tip — the ventricle against the artery, side by side.
   */
  readonly comparison?: 'before-after' | 'ventricle-artery'
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
      { type: 'check', id: CURRENT_RESPONSE_RECHECKED },
    ],
    transferEntry: () => dampedLineState(611),
    transferGoals: [
      { type: 'level' },
      { type: 'check', id: FAST_FLUSH_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CLASSIFIED_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CORRECTED_CHECK },
      { type: 'check', id: CURRENT_RESPONSE_RECHECKED },
    ],
    watch: ['papSystolic', 'papDiastolic', 'meanPap', 'pulsePressure'],
  },
  'waveform-interpretation': {
    sectionId: 'waveform-interpretation',
    initial: () => cleanState(520, 'ra'),
    predictionEntry: () => cleanState(520, 'rv'),
    // HD-02: the recognition practice is not simulation work, so the section sets no act goal, and
    // with nothing changed on the simulator there is no before-and-after table to offer.
    actGoals: [],
    observeGoals: [],
    transferEntry: () =>
      reduceAll(ventilatedWedgeState(521), [{ type: 'SET_CATHETER_POSITION', position: 'wedge' }]),
    transferGoals: [],
    watch: [],
    walkPositions: ['ra', 'rv', 'pa', 'wedge'],
  },
  'waveform-components': {
    sectionId: 'waveform-components',
    initial: () => reduceAll(cleanState(530, 'ra'), [{ type: 'TOGGLE_FREEZE' }]),
    actGoals: [],
    observeGoals: [],
    transferEntry: null,
    transferGoals: [],
    // No step of this section changes the simulator, so there is nothing to compare (HD-02).
    watch: [],
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
    comparison: 'ventricle-artery',
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
      { type: 'check', id: ARTERIAL_FAST_FLUSH_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CLASSIFIED_CHECK },
      { type: 'check', id: DYNAMIC_RESPONSE_CORRECTED_CHECK },
    ],
    watch: ['papSystolic', 'papDiastolic', 'meanPap', 'pawp', 'cardiacOutput', 'position'],
    // The transfer repairs the arterial line, so its table reports the arterial line — with the
    // pulmonary-artery and right-atrial rows beside it, which a line-specific repair leaves alone.
    transferWatch: ['artSystolic', 'artDiastolic', 'artPulsePressure', 'pulsePressure', 'rap'],
  },
}

export function sectionRuntime(sectionId: HemodynamicsSectionId): SectionRuntime {
  return runtimes[sectionId]
}

export function goalsMet(goals: readonly StageGoal[], state: HemodynamicSimulationState): boolean {
  return goals.every((goal) => stageGoalMet(goal, state))
}
