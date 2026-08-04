import type {
  VentilationAction,
  VentilationSimulationState,
  VentilatorControlKey,
  VentilatorModeId,
  VentilatorScreen,
} from '../engine'

export type VentilationLessonVariant = 'primary' | 'transfer'

export interface VentilationLessonGuidedAction {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly resolve: (state: VentilationSimulationState) => VentilationAction
}

export interface VentilationLessonRuntimeVariant {
  readonly caseId: string
  readonly goal: string
  readonly actions: readonly VentilationLessonGuidedAction[]
  readonly requiredEvidence: readonly string[]
  readonly responseSeconds: number
}

export interface VentilationLessonRuntimeDefinition {
  readonly lessonId: string
  readonly primary: VentilationLessonRuntimeVariant
  readonly transfer: VentilationLessonRuntimeVariant
}

function intervention(
  id: string,
  label: string,
  description: string,
): VentilationLessonGuidedAction {
  return {
    id: `intervention-${id}`,
    label,
    description,
    resolve: () => ({ type: 'PERFORM_INTERVENTION', interventionId: id }),
  }
}

function screen(
  id: VentilatorScreen,
  label: string,
  description: string,
): VentilationLessonGuidedAction {
  return {
    id: `screen-${id}`,
    label,
    description,
    resolve: () => ({ type: 'SET_SCREEN', screen: id }),
  }
}

function hold(
  kind: 'inspiratory' | 'expiratory',
  label: string,
  description: string,
): VentilationLessonGuidedAction {
  return {
    id: `hold-${kind}`,
    label,
    description,
    resolve: () => ({ type: 'PERFORM_HOLD', hold: kind }),
  }
}

function control(
  key: VentilatorControlKey,
  label: string,
  description: string,
  value: (state: VentilationSimulationState) => number | string | boolean,
): VentilationLessonGuidedAction {
  return {
    id: `control-${key}`,
    label,
    description,
    resolve: (state) => ({ type: 'SET_CONTROL', control: key, value: value(state) }),
  }
}

function alternateMode(state: VentilationSimulationState): VentilatorModeId {
  return state.ventilator.settings.deviceMode === 'volume-ac' ? 'pressure-ac' : 'volume-ac'
}

const openModes = screen(
  'modes',
  'Open the mode screen',
  'Inspect the available breath-delivery descriptions before selecting a comparison mode.',
)

const selectComparisonMode: VentilationLessonGuidedAction = {
  id: 'select-comparison-mode',
  label: 'Select a comparison mode',
  description:
    'Select the alternate volume- or pressure-targeted assist/control mode without applying it yet.',
  resolve: (state) => ({ type: 'SELECT_MODE', mode: alternateMode(state) }),
}

const confirmComparisonMode: VentilationLessonGuidedAction = {
  id: 'confirm-comparison-mode',
  label: 'Confirm at the breath boundary',
  description: 'Apply the pending mode and then compare the controlled and measured variables.',
  resolve: () => ({ type: 'CONFIRM_MODE' }),
}

const reviewWaveforms = intervention(
  'review-waveforms',
  'Document multitrace review',
  'Review pressure, flow, volume, and patient effort across several breaths.',
)

const assessPatient = intervention(
  'assess-patient',
  'Record bedside assessment',
  'Examine chest movement, breath sounds, comfort, respiratory effort, and hemodynamics.',
)

export const ventilationLessonRecognitionActions: readonly VentilationLessonGuidedAction[] = [
  assessPatient,
  reviewWaveforms,
] as const

export const ventilationLessonObservationActions: readonly VentilationLessonGuidedAction[] = [
  reviewWaveforms,
  {
    id: 'step-observation-breath',
    label: 'Advance one breath for reassessment',
    description: 'Generate a new breath after the action and compare it with the baseline.',
    resolve: () => ({ type: 'STEP_BREATH' }),
  },
] as const

export const ventilationLessonRecognitionEvidence = [
  'intervention:assess-patient',
  'intervention:review-waveforms',
] as const

export const ventilationLessonObservationEvidence = [
  'intervention:review-waveforms',
  'breath:stepped',
] as const

export function ventilationLessonActionEvidence(
  action: VentilationAction,
  before: VentilationSimulationState,
  after: VentilationSimulationState,
): string | null {
  if (after === before) return null
  if (action.type === 'PERFORM_INTERVENTION') {
    return after.interventions.length > before.interventions.length
      ? `intervention:${action.interventionId}`
      : null
  }
  if (action.type === 'PERFORM_HOLD') {
    return after.ventilator.holdType === action.hold ? `hold:${action.hold}` : null
  }
  if (action.type === 'TOGGLE_FREEZE') {
    return after.ventilator.frozen !== before.ventilator.frozen ? 'waveforms:frozen' : null
  }
  if (action.type === 'CONFIRM_MODE') {
    return before.ventilator.pendingMode &&
      after.ventilator.pendingMode === null &&
      after.ventilator.settings.deviceMode !== before.ventilator.settings.deviceMode
      ? 'mode:confirmed'
      : null
  }
  if (action.type === 'SET_CONTROL') {
    return JSON.stringify(after.ventilator.settings) !== JSON.stringify(before.ventilator.settings)
      ? `control:${action.control}`
      : null
  }
  if (action.type === 'STEP_BREATH') {
    return after.simulationTime > before.simulationTime ? 'breath:stepped' : null
  }
  return null
}

const lessonRuntimes: readonly VentilationLessonRuntimeDefinition[] = [
  {
    lessonId: 'waveform-anatomy',
    primary: {
      caseId: 'MV-01',
      goal: 'Name what each of the three traces plots, and read the controlled variable off their shapes.',
      actions: [
        screen('graphics', 'Open the graphics screen', 'Put all three traces in front of you.'),
        reviewWaveforms,
      ],
      requiredEvidence: ['intervention:review-waveforms'],
      responseSeconds: 12,
    },
    /*
     * The transfer has to run on a breath whose controlled variable is the *other* one, or it is
     * not a transfer. It used to run on MV-02, which is volume-controlled — the same targeting as
     * the primary, and with flow starvation scooping the pressure trace it is the most emphatically
     * volume-controlled breath in the casebook. The item asked the learner to name a
     * pressure-targeted breath over a trace that showed the opposite, and the header printed
     * "Volume-control flow starvation" above it.
     *
     * MV-04 is the only pressure-targeted assist/control case. Its inspiratory pressure sits flat
     * at the set level for the whole second half of inspiration while flow falls away from its
     * early peak, so the shape the question asks about is the shape on the screen.
     */
    transfer: {
      caseId: 'MV-04',
      goal: 'Read the controlled variable from the trace shapes on a pressure-targeted breath, without using the mode name.',
      actions: [
        screen('main', 'Return to the monitoring screen', 'Read the live breath as delivered.'),
        reviewWaveforms,
      ],
      requiredEvidence: ['intervention:review-waveforms'],
      responseSeconds: 12,
    },
  },
  {
    lessonId: 'mechanics-load-and-pressure',
    primary: {
      caseId: 'MV-13',
      goal: 'Use an inspiratory hold to separate the resistive pressure component from the elastic load.',
      actions: [
        screen('tools', 'Open ventilator tools', 'Locate the inspiratory hold maneuver.'),
        hold(
          'inspiratory',
          'Perform an inspiratory hold',
          'Measure plateau pressure and compare it with peak pressure.',
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['hold:inspiratory', 'intervention:review-waveforms'],
      responseSeconds: 15,
    },
    transfer: {
      caseId: 'MV-14',
      goal: 'Localize an abrupt rise in both peak and plateau pressure while hypotension and asymmetric examination findings are present.',
      actions: [assessPatient, reviewWaveforms],
      requiredEvidence: ['intervention:assess-patient', 'intervention:review-waveforms'],
      responseSeconds: 10,
    },
  },
  {
    lessonId: 'modes-and-breath-delivery',
    primary: {
      caseId: 'MV-02',
      goal: 'Compare breath delivery by trigger, controlled variable, cycling rule, and expiratory opportunity.',
      actions: [openModes, selectComparisonMode, confirmComparisonMode, reviewWaveforms],
      requiredEvidence: ['mode:confirmed', 'intervention:review-waveforms'],
      responseSeconds: 15,
    },
    transfer: {
      caseId: 'MV-09',
      goal: 'Apply the same variable-based comparison to a pressure-support breath with premature cycling.',
      actions: [openModes, selectComparisonMode, confirmComparisonMode, reviewWaveforms],
      requiredEvidence: ['mode:confirmed', 'intervention:review-waveforms'],
      responseSeconds: 15,
    },
  },
  {
    lessonId: 'waveform-reading-sequence',
    primary: {
      caseId: 'MV-03',
      goal: 'Read timing first, then shape and amplitude across pressure, flow, volume, and effort.',
      actions: [
        screen('tools', 'Open waveform tools', 'Use the freeze control without changing therapy.'),
        {
          id: 'freeze-waveforms',
          label: 'Freeze the multitrace display',
          description: 'Hold the current pressure, flow, and volume traces for comparison.',
          resolve: () => ({ type: 'TOGGLE_FREEZE' }),
        },
        reviewWaveforms,
      ],
      requiredEvidence: ['waveforms:frozen', 'intervention:review-waveforms'],
      responseSeconds: 10,
    },
    transfer: {
      caseId: 'MV-08',
      goal: 'Validate an extra-breath pattern against the patient and circuit before assigning a cause.',
      actions: [
        assessPatient,
        intervention(
          'inspect-circuit',
          'Inspect the circuit and trigger signal',
          'Check for condensate, leak, and oscillation near the flow sensor.',
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['intervention:inspect-circuit', 'intervention:review-waveforms'],
      responseSeconds: 15,
    },
  },
  {
    lessonId: 'triggering-and-cycling',
    primary: {
      caseId: 'MV-07',
      goal: 'Identify missed patient efforts and test trigger sensitivity without creating false breaths.',
      actions: [
        screen('controls', 'Open timing controls', 'Locate the active trigger control.'),
        control(
          'triggerThreshold',
          'Make the trigger one step more sensitive',
          'Change only the active trigger threshold, then look for captured and false breaths.',
          (state) =>
            state.ventilator.settings.trigger.type === 'flow'
              ? Math.max(0.5, state.ventilator.settings.trigger.thresholdLMin - 0.5)
              : Math.min(-0.1, state.ventilator.settings.trigger.thresholdCmH2O + 0.5),
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['control:triggerThreshold', 'intervention:review-waveforms'],
      responseSeconds: 20,
    },
    transfer: {
      caseId: 'MV-10',
      goal: 'Recognize delayed cycling in obstructive physiology and test an earlier cycling threshold.',
      actions: [
        screen('controls', 'Open cycling controls', 'Locate the expiratory trigger sensitivity.'),
        control(
          'etsPercent',
          'Increase the cycling threshold one step',
          'Cycle earlier, then compare mechanical inspiratory time and expiratory flow.',
          (state) =>
            state.ventilator.settings.mode === 'pressure-support'
              ? Math.min(80, state.ventilator.settings.etsPercent + 10)
              : 35,
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['control:etsPercent', 'intervention:review-waveforms'],
      responseSeconds: 20,
    },
  },
  {
    lessonId: 'dyssynchrony-mechanisms',
    primary: {
      caseId: 'MV-04',
      goal: 'Test whether fixed post-inflation effort reflects machine-triggered entrainment rather than generic agitation.',
      actions: [
        screen('controls', 'Open breath-timing controls', 'Locate the mandatory breath rate.'),
        control(
          'ratePerMin',
          'Change mandatory rate by two breaths/min',
          'Perturb the machine timing, then look for persistence or loss of fixed entrainment.',
          (state) =>
            state.ventilator.settings.mode === 'pressure-support'
              ? state.ventilator.settings.apneaRatePerMin + 2
              : state.ventilator.settings.ratePerMin + 2,
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['control:ratePerMin', 'intervention:review-waveforms'],
      responseSeconds: 30,
    },
    transfer: {
      caseId: 'MV-11',
      goal: 'Transfer mechanism-first reasoning to slow pressurization with a risk of overshoot.',
      actions: [
        screen('controls', 'Open pressurization controls', 'Locate the rise-time control.'),
        control(
          'pRampMs',
          'Shorten rise time one step',
          'Increase pressurization speed, then reassess effort and pressure overshoot.',
          (state) =>
            state.ventilator.settings.mode === 'volume-ac'
              ? 100
              : Math.max(50, state.ventilator.settings.pRampMs - 100),
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['control:pRampMs', 'intervention:review-waveforms'],
      responseSeconds: 20,
    },
  },
  {
    lessonId: 'oxygenation-response',
    primary: {
      caseId: 'MV-01',
      goal: 'Test a small PEEP change while watching oxygenation, plateau pressure, and MAP together.',
      actions: [
        screen('controls', 'Open oxygenation controls', 'Locate PEEP and oxygen controls.'),
        control(
          'peepCmH2O',
          'Increase PEEP by 2 cmH₂O',
          'Make one bounded change and preserve the ability to attribute the response.',
          (state) => state.ventilator.settings.peepCmH2O + 2,
        ),
        screen(
          'tools',
          'Open pressure-measurement tools',
          'Prepare to remeasure plateau pressure.',
        ),
        hold(
          'inspiratory',
          'Repeat an inspiratory hold',
          'Reassess plateau pressure after the PEEP change.',
        ),
      ],
      requiredEvidence: ['control:peepCmH2O', 'hold:inspiratory'],
      responseSeconds: 45,
    },
    transfer: {
      caseId: 'MV-14',
      goal: 'Recognize that abrupt hypoxemia with hypotension and unilateral findings requires a new mechanism assessment.',
      actions: [assessPatient, reviewWaveforms],
      requiredEvidence: ['intervention:assess-patient', 'intervention:review-waveforms'],
      responseSeconds: 10,
    },
  },
  {
    lessonId: 'ventilation-and-co2',
    primary: {
      caseId: 'MV-05',
      goal: 'Measure incomplete exhalation and intrinsic PEEP before changing nominal minute ventilation.',
      actions: [
        screen('tools', 'Open expiratory-measurement tools', 'Locate the expiratory hold.'),
        hold(
          'expiratory',
          'Perform an expiratory hold',
          'Measure intrinsic PEEP and compare it with end-expiratory flow.',
        ),
        screen('controls', 'Open cycling controls', 'Locate expiratory trigger sensitivity.'),
        control(
          'etsPercent',
          'Increase the cycling threshold one step',
          'Cycle pressure support earlier, then reassess delivered ventilation and trapped gas.',
          (state) =>
            state.ventilator.settings.mode === 'pressure-support'
              ? Math.min(80, state.ventilator.settings.etsPercent + 10)
              : 35,
        ),
        reviewWaveforms,
      ],
      requiredEvidence: ['hold:expiratory', 'control:etsPercent', 'intervention:review-waveforms'],
      responseSeconds: 45,
    },
    transfer: {
      caseId: 'MV-06',
      goal: 'Prioritize release of trapped gas when severe obstruction, hypotension, and incomplete exhalation occur together.',
      actions: [
        assessPatient,
        hold(
          'expiratory',
          'Measure intrinsic PEEP',
          'Confirm the magnitude of trapped pressure while the patient is stabilized.',
        ),
        intervention(
          'disconnect-bag',
          'Permit exhalation while manually supporting ventilation',
          'Use the authored emergency branch to release trapped gas and separate patient from ventilator causes.',
        ),
      ],
      requiredEvidence: [
        'intervention:assess-patient',
        'hold:expiratory',
        'intervention:disconnect-bag',
      ],
      responseSeconds: 20,
    },
  },
  {
    lessonId: 'safety-reassessment-and-human-factors',
    primary: {
      caseId: 'MV-15',
      goal: 'Assess distress with the patient, treat reversible discomfort, and close the reassessment loop.',
      actions: [
        intervention(
          'communication-board',
          'Establish communication',
          'Ask what breathing feels like and identify pain, fear, or unmet needs.',
        ),
        intervention(
          'treat-pain',
          'Treat the identified pain',
          'Address a reversible source of high respiratory drive before escalating sedation.',
        ),
        intervention(
          'communicate-plan',
          'State the plan and reassessment',
          'Close the loop with the patient and team.',
        ),
      ],
      requiredEvidence: [
        'intervention:communication-board',
        'intervention:treat-pain',
        'intervention:communicate-plan',
      ],
      responseSeconds: 180,
    },
    transfer: {
      caseId: 'MV-13',
      goal: 'Treat a high-pressure alarm as a signal while localizing patient, airway, and circuit causes.',
      actions: [
        assessPatient,
        intervention(
          'inspect-circuit',
          'Inspect airway and circuit',
          'Check the tube, HME, circuit, secretions, and bronchospasm branch.',
        ),
        hold(
          'inspiratory',
          'Measure plateau pressure',
          'Separate resistive from elastic load before selecting the corrective branch.',
        ),
        intervention(
          'communicate-plan',
          'State the safety plan',
          'Name the immediate action and required reassessment.',
        ),
      ],
      requiredEvidence: [
        'intervention:assess-patient',
        'intervention:inspect-circuit',
        'hold:inspiratory',
        'intervention:communicate-plan',
      ],
      responseSeconds: 20,
    },
  },
  {
    lessonId: 'high-peak-pressure-integration',
    primary: {
      caseId: 'MV-13',
      goal: 'Separate a resistive rise from an elastic one, and from patient effort, before selecting any corrective branch.',
      actions: [
        assessPatient,
        reviewWaveforms,
        hold(
          'inspiratory',
          'Measure plateau pressure',
          'Split peak pressure into the part spent moving gas and the part spent distending the respiratory system.',
        ),
        intervention(
          'inspect-circuit',
          'Inspect airway and circuit',
          'Check the tube, HME, circuit, secretions, and bronchospasm branch against the widened gap.',
        ),
        intervention(
          'communicate-plan',
          'State the mechanism and the reassessment',
          'Name the dominant mechanism, the one you excluded, and the finding that excluded it.',
        ),
      ],
      requiredEvidence: [
        'intervention:assess-patient',
        'intervention:review-waveforms',
        'hold:inspiratory',
        'intervention:inspect-circuit',
        'intervention:communicate-plan',
      ],
      responseSeconds: 45,
    },
    transfer: {
      caseId: 'MV-06',
      goal: 'Recognize the same alarm produced by trapped gas rather than by airway resistance, and act on the expiratory limb.',
      actions: [
        assessPatient,
        hold(
          'expiratory',
          'Measure intrinsic PEEP',
          'Test the fourth mechanism directly: expiratory flow that never reaches zero implicates trapped volume, not a resistive rise alone.',
        ),
        intervention(
          'disconnect-bag',
          'Permit exhalation while manually supporting ventilation',
          'Use the authored emergency branch to release trapped gas and separate patient from ventilator causes.',
        ),
      ],
      requiredEvidence: [
        'intervention:assess-patient',
        'hold:expiratory',
        'intervention:disconnect-bag',
      ],
      responseSeconds: 20,
    },
  },
] as const

export const ventilationLessonRuntimeById = new Map(
  lessonRuntimes.map((definition) => [definition.lessonId, definition]),
)

export const ventilationLessonRuntimes = lessonRuntimes

export function hasVentilationLessonEvidence(
  evidence: readonly string[],
  requirements: readonly string[],
): boolean {
  return requirements.every((required) => evidence.includes(required))
}
