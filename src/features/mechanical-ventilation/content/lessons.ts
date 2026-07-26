import type { CriticalCareActivityPhase } from '@/features/learning-module/activity'

export interface VentilationLessonChoice {
  readonly id: string
  readonly label: string
}

export interface VentilationLessonPhase {
  readonly objective: string
  readonly requiredAction: string
  readonly teachingPoint: string
}

export interface VentilationLessonDefinition {
  readonly id: string
  readonly title: string
  readonly domain: string
  readonly estimatedMinutes: number
  readonly summary: string
  readonly relatedCaseIds: readonly string[]
  readonly evidenceIds: readonly string[]
  readonly phases: Readonly<Record<CriticalCareActivityPhase, VentilationLessonPhase>>
  readonly prediction: {
    readonly prompt: string
    readonly choices: readonly VentilationLessonChoice[]
    readonly correctChoiceId: string
    readonly explanation: string
  }
  readonly transfer: {
    readonly prompt: string
    readonly choices: readonly VentilationLessonChoice[]
    readonly correctChoiceId: string
    readonly explanation: string
  }
  readonly references: readonly { title: string; summary: string }[]
}

function lesson(
  definition: Omit<VentilationLessonDefinition, 'estimatedMinutes' | 'evidenceIds'> & {
    readonly estimatedMinutes?: number
    readonly evidenceIds?: readonly string[]
  },
): VentilationLessonDefinition {
  return {
    estimatedMinutes: 8,
    evidenceIds: ['supplied-casebook-2026', 'bounded-ventilation-model'],
    ...definition,
  }
}

export const mechanicalVentilationLessons: readonly VentilationLessonDefinition[] = [
  lesson({
    id: 'mechanics-load-and-pressure',
    title: 'Mechanics: load, pressure, and volume',
    domain: 'Mechanics',
    summary:
      'Separate resistive and elastic load by reading the patient, pressure signal, flow, and volume together.',
    relatedCaseIds: ['MV-01', 'MV-05', 'MV-13', 'MV-14'],
    phases: {
      recognize: {
        objective: 'Recognize a change in the pressure signal without naming its cause too early.',
        requiredAction: 'Review the pressure, flow, and bedside findings as one measurement set.',
        teachingPoint:
          'A high displayed pressure is a finding. The pressure components, waveform timing, and patient examination determine the mechanism.',
      },
      predict: {
        objective:
          'Predict which additional observation best separates resistance from compliance.',
        requiredAction: 'Commit to one discriminating assessment before changing therapy.',
        teachingPoint:
          'The lesson rewards a mechanism-first prediction, not an isolated threshold response.',
      },
      act: {
        objective: 'Choose a bounded assessment action.',
        requiredAction:
          'Compare peak and plateau behavior and inspect the airway/circuit when indicated.',
        teachingPoint:
          'The simulator keeps assessment, ventilator changes, and airway/circuit actions as distinct semantic commands.',
      },
      observe: {
        objective: 'Observe whether the discriminating signal changed in the expected direction.',
        requiredAction: 'Re-read pressure, flow, volume, and hemodynamics after the action.',
        teachingPoint:
          'Reassessment is part of the action; it is not an optional confirmation after the case is solved.',
      },
      explain: {
        objective: 'Explain the causal chain.',
        requiredAction: 'Connect the load, waveform pattern, action, and response.',
        teachingPoint:
          'A defensible explanation names what was measured, what changed, and what remained uncertain.',
      },
      transfer: {
        objective: 'Transfer the same reasoning to a sudden compliance change.',
        requiredAction:
          'Select the response that begins with patient assessment and mechanism localization.',
        teachingPoint:
          'The same pressure number can arise from different patient, tube, circuit, or lung mechanisms.',
      },
    },
    prediction: {
      prompt:
        'Peak pressure rises while the cause is still unclear. What best preserves diagnostic information?',
      choices: [
        {
          id: 'integrated-assessment',
          label: 'Compare pressure components, flow, and the bedside examination',
        },
        { id: 'single-number', label: 'Treat the peak pressure number without another assessment' },
      ],
      correctChoiceId: 'integrated-assessment',
      explanation:
        'The integrated assessment distinguishes mechanisms before an intervention changes the signal.',
    },
    transfer: {
      prompt:
        'A new case has an abrupt pressure rise and hypotension. What is the safest first reasoning step?',
      choices: [
        {
          id: 'localize',
          label: 'Assess the patient immediately while localizing lung, airway, and circuit causes',
        },
        { id: 'normalize', label: 'Normalize the displayed pressure before examining the patient' },
      ],
      correctChoiceId: 'localize',
      explanation:
        'Urgent bedside assessment and mechanism localization preserve the safety boundary in a deteriorating case.',
    },
    references: [
      {
        title: 'Pressure components',
        summary: 'Use the modeled peak, plateau, flow, and volume signals together.',
      },
      {
        title: 'Model boundary',
        summary:
          'Synthetic responses are bounded teaching approximations, not patient-specific predictions.',
      },
    ],
  }),
  lesson({
    id: 'waveform-reading-sequence',
    title: 'Waveforms: a repeatable reading sequence',
    domain: 'Waveforms',
    summary:
      'Read pressure, flow, volume, and patient effort in a stable order before naming a pattern.',
    relatedCaseIds: ['MV-02', 'MV-03', 'MV-04', 'MV-08'],
    phases: {
      recognize: {
        objective: 'Orient to timing before amplitude.',
        requiredAction: 'Locate inspiration, expiration, trigger, and cycle across the traces.',
        teachingPoint:
          'Timing relationships make later shape and amplitude observations interpretable.',
      },
      predict: {
        objective: 'Predict whether a single breath is representative.',
        requiredAction: 'Commit to reviewing several breaths and the bedside context.',
        teachingPoint:
          'A repeatable pattern is stronger evidence than one selected waveform sample.',
      },
      act: {
        objective: 'Use the waveform tools without changing therapy.',
        requiredAction: 'Freeze or follow several breaths, then compare all traces.',
        teachingPoint: 'Documented signal review is an assessment action in the case record.',
      },
      observe: {
        objective: 'Observe consistency and exceptions.',
        requiredAction: 'Describe the recurring timing relationship in words.',
        teachingPoint:
          'The waveform has a text-equivalent measurement panel for nonvisual interpretation.',
      },
      explain: {
        objective: 'Explain the pattern without overclaiming its cause.',
        requiredAction: 'Separate observed waveform features from the inferred mechanism.',
        teachingPoint:
          'The causal debrief distinguishes recognition, mechanism, action, and reassessment.',
      },
      transfer: {
        objective: 'Transfer the sequence to an artifact-prone trace.',
        requiredAction:
          'Select the response that validates the signal and circuit before treatment.',
        teachingPoint:
          'Condensate, leak, and patient effort can produce different repeating patterns.',
      },
    },
    prediction: {
      prompt: 'What should come before naming a dyssynchrony from one waveform snapshot?',
      choices: [
        {
          id: 'sequence',
          label: 'Review timing across several breaths and correlate with the patient',
        },
        { id: 'snapshot', label: 'Classify the single snapshot without another signal' },
      ],
      correctChoiceId: 'sequence',
      explanation:
        'A stable reading sequence reduces premature closure and supports a testable mechanism.',
    },
    transfer: {
      prompt:
        'The flow trace oscillates and extra breaths appear. What best transfers the sequence?',
      choices: [
        {
          id: 'circuit',
          label: 'Inspect the circuit and correlate the pattern before changing support',
        },
        { id: 'sedate', label: 'Suppress patient effort before inspecting the signal source' },
      ],
      correctChoiceId: 'circuit',
      explanation:
        'The signal source and circuit should be assessed before attributing every extra breath to patient drive.',
    },
    references: [
      {
        title: 'Waveform buffer',
        summary: 'The display provides synchronized pressure, flow, volume, and effort samples.',
      },
      {
        title: 'Text equivalent',
        summary:
          'Measured values and case findings remain available without relying on trace color alone.',
      },
    ],
  }),
  lesson({
    id: 'modes-and-breath-delivery',
    title: 'Modes: trigger, target, cycle, and expiration',
    domain: 'Modes',
    summary:
      'Translate device-native labels into trigger, controlled variable, cycling, and expiration.',
    relatedCaseIds: ['MV-01', 'MV-02', 'MV-09', 'MV-12'],
    phases: {
      recognize: {
        objective: 'Recognize the four breath variables behind a device label.',
        requiredAction: 'Identify trigger, target or flow, cycle, and expiration.',
        teachingPoint:
          'Device vocabulary differs, while the underlying breath variables remain comparable.',
      },
      predict: {
        objective: 'Predict what will remain controlled after a mode change.',
        requiredAction: 'Commit to the variable-based description rather than the brand label.',
        teachingPoint:
          'A mode name alone does not describe the patient interaction or the resulting measurements.',
      },
      act: {
        objective: 'Map a device-native mode to its breath-delivery variables.',
        requiredAction: 'Review the selected console profile before confirming the mode.',
        teachingPoint:
          'Available modes and confirmation steps depend on the selected training console.',
      },
      observe: {
        objective: 'Observe the next breath boundary.',
        requiredAction: 'Compare the controlled variable and measured response.',
        teachingPoint: 'A confirmed mode change takes effect at the next breath boundary.',
      },
      explain: {
        objective: 'Explain why labels and behavior must both be checked.',
        requiredAction: 'Name the breath-delivery behavior and the device-native label.',
        teachingPoint:
          'The training facsimile teaches navigation without claiming full proprietary-device fidelity.',
      },
      transfer: {
        objective: 'Transfer the variable framework to pressure-support cycling.',
        requiredAction: 'Localize which breath variable is mismatched before choosing a new mode.',
        teachingPoint: 'A different mode label does not replace assessment of the measured breath.',
      },
    },
    prediction: {
      prompt: 'Two consoles use different labels. What is the most reliable comparison?',
      choices: [
        { id: 'variables', label: 'Compare trigger, target or flow, cycle, and expiration' },
        { id: 'label-shape', label: 'Assume similarly placed labels have identical behavior' },
      ],
      correctChoiceId: 'variables',
      explanation:
        'The variable framework is shared; labels and control workflows remain profile-specific.',
    },
    transfer: {
      prompt:
        'A pressure-support breath ends while patient inspiratory effort continues. Which variable should be localized?',
      choices: [
        { id: 'reset', label: 'The criterion that cycles inspiration to expiration' },
        { id: 'trigger-only', label: 'Only the criterion that triggers inspiration' },
      ],
      correctChoiceId: 'reset',
      explanation:
        'The mismatch occurs at breath termination, so the cycling rule is the discriminating variable.',
    },
    references: [
      {
        title: 'Breath-delivery foundations',
        summary: 'Compare volume A/C, pressure A/C, and pressure support by breath variables.',
      },
      {
        title: 'Profile-specific modes',
        summary:
          'Advanced mode names and availability come from the selected source-bound device profile.',
      },
    ],
  }),
  lesson({
    id: 'triggering-and-cycling',
    title: 'Triggering and cycling',
    domain: 'Timing',
    summary: 'Localize delayed, missed, false, premature, and delayed breath transitions.',
    relatedCaseIds: ['MV-07', 'MV-08', 'MV-09', 'MV-10'],
    phases: {
      recognize: {
        objective: 'Recognize where patient and machine timing diverge.',
        requiredAction: 'Separate inspiratory trigger from expiratory cycling.',
        teachingPoint:
          'Trigger and cycle problems occupy different breath transitions and require different tests.',
      },
      predict: {
        objective: 'Predict which transition is abnormal.',
        requiredAction: 'Commit to trigger, cycle, or non-ventilator mechanism.',
        teachingPoint:
          'Recording a prediction preserves an independent baseline while practice controls remain available.',
      },
      act: {
        objective: 'Change one timing variable or correct one identified source.',
        requiredAction: 'Use the console or circuit action that tests the prediction.',
        teachingPoint: 'One bounded change preserves attribution in the simulated response.',
      },
      observe: {
        objective: 'Observe delay, missed effort, or cycling direction.',
        requiredAction: 'Compare several breaths after the action.',
        teachingPoint:
          'Trigger delay and the fractions of ineffective or false triggers remain visible measurements.',
      },
      explain: {
        objective: 'Explain the transition and response.',
        requiredAction: 'Name where timing failed and how the action tested it.',
        teachingPoint:
          'A correct setting without mechanism and reassessment does not receive full case credit.',
      },
      transfer: {
        objective: 'Transfer from a patient-effort case to a circuit-artifact case.',
        requiredAction: 'Choose the discriminating inspection before changing the trigger again.',
        teachingPoint: 'Similar extra-breath patterns can reflect different sources.',
      },
    },
    prediction: {
      prompt: 'What distinction should be made before adjusting a timing control?',
      choices: [
        { id: 'transition', label: 'Identify whether the problem occurs at trigger or cycle' },
        { id: 'generic', label: 'Treat every timing mismatch as a trigger problem' },
      ],
      correctChoiceId: 'transition',
      explanation:
        'Trigger begins inspiration; cycle ends it. The simulator models them separately.',
    },
    transfer: {
      prompt: 'Extra machine breaths continue after patient effort is reassessed. What next?',
      choices: [
        { id: 'inspect', label: 'Inspect condensate, leak, and circuit signal sources' },
        {
          id: 'repeat-trigger',
          label: 'Keep changing trigger sensitivity without inspecting the circuit',
        },
      ],
      correctChoiceId: 'inspect',
      explanation:
        'Circuit-driven autotriggering requires source localization, not repeated unstructured setting changes.',
    },
    references: [
      {
        title: 'Trigger measurement',
        summary: 'Compare trigger delay, ineffective efforts, and false breaths.',
      },
      {
        title: 'Cycling measurement',
        summary: 'Mechanical inspiratory time is compared with the modeled neural timing.',
      },
    ],
  }),
  lesson({
    id: 'dyssynchrony-mechanisms',
    title: 'Dyssynchrony: mechanism before label',
    domain: 'Dyssynchrony',
    summary: 'Build a causal explanation from drive, load, timing, support, and the whole patient.',
    relatedCaseIds: ['MV-02', 'MV-03', 'MV-04', 'MV-11', 'MV-12'],
    phases: {
      recognize: {
        objective: 'Recognize a mismatch without assuming agitation is the cause.',
        requiredAction: 'Review effort, ventilator timing, load, comfort, and sedation together.',
        teachingPoint:
          'Patient drive and ventilator breath delivery must be evaluated as separate contributors.',
      },
      predict: {
        objective: 'Predict the dominant mismatch mechanism.',
        requiredAction: 'Commit to one mechanism and expected response.',
        teachingPoint: 'The expected response makes the prediction falsifiable.',
      },
      act: {
        objective: 'Test the mechanism with a targeted action.',
        requiredAction:
          'Choose a setting, whole-patient, or circuit action tied to the prediction.',
        teachingPoint:
          'Sedation-only actions can be marked unsafe when they obscure an uncorrected mechanism.',
      },
      observe: {
        objective: 'Observe waveform, effort, and comfort response.',
        requiredAction: 'Allow the modeled response time and repeat the discriminating assessment.',
        teachingPoint:
          'Immediate mechanics and delayed patient responses use different simulated time scales.',
      },
      explain: {
        objective: 'Explain why the intervention did or did not work.',
        requiredAction: 'Connect drive, load, timing, action, and response.',
        teachingPoint:
          'Several accepted paths can remain clinically coherent when the mechanism and reassessment remain sound.',
      },
      transfer: {
        objective: 'Transfer to a mismatch with the opposite timing direction.',
        requiredAction: 'Choose reassessment before repeating the original adjustment.',
        teachingPoint:
          'A prior successful action is not automatically correct for a new timing pattern.',
      },
    },
    prediction: {
      prompt:
        'A ventilated patient appears distressed. What makes the mechanism prediction testable?',
      choices: [
        { id: 'expected-response', label: 'State the expected response to a targeted action' },
        { id: 'label-only', label: 'Apply a dyssynchrony label without an expected response' },
      ],
      correctChoiceId: 'expected-response',
      explanation:
        'A predicted response lets the learner reassess rather than merely rename the pattern.',
    },
    transfer: {
      prompt:
        'The waveform timing changes after the first adjustment. What is the next best reasoning move?',
      choices: [
        { id: 'reassess', label: 'Reassess the new timing pattern and patient response' },
        { id: 'repeat', label: 'Repeat the original adjustment without checking direction' },
      ],
      correctChoiceId: 'reassess',
      explanation:
        'Transfer requires re-localizing the mismatch rather than reusing an action by habit.',
    },
    references: [
      {
        title: 'Patient drive',
        summary:
          'Neural rate, inspiratory time, effort, and variability are modeled independently.',
      },
      {
        title: 'Human factors',
        summary:
          'Pain, anxiety, delirium, sedation, dyspnea, and communication remain visible case domains.',
      },
    ],
  }),
  lesson({
    id: 'oxygenation-response',
    title: 'Oxygenation: action and consequence',
    domain: 'Oxygenation',
    summary:
      'Observe oxygenation together with pressure, compliance, and hemodynamic consequences.',
    relatedCaseIds: ['MV-01', 'MV-14'],
    phases: {
      recognize: {
        objective: 'Recognize oxygenation failure in the whole patient context.',
        requiredAction: 'Review saturation, modeled gas exchange, pressures, and blood pressure.',
        teachingPoint:
          'Oxygenation, respiratory mechanics, and hemodynamics can change in different directions.',
      },
      predict: {
        objective: 'Predict both benefit and a safety consequence.',
        requiredAction: 'Commit to the expected oxygenation and pressure/hemodynamic response.',
        teachingPoint:
          'A one-direction prediction is incomplete when the intervention has modeled tradeoffs.',
      },
      act: {
        objective: 'Make a bounded change tied to the case mechanism.',
        requiredAction:
          'Use one console or whole-patient action, then wait for its modeled response.',
        teachingPoint: 'The lesson does not prescribe settings for a real patient.',
      },
      observe: {
        objective: 'Observe oxygenation and safety signals together.',
        requiredAction: 'Recheck saturation, pressures, compliance, and MAP.',
        teachingPoint:
          'Improvement in one number does not erase an adverse modeled consequence elsewhere.',
      },
      explain: {
        objective: 'Explain benefit, burden, and remaining uncertainty.',
        requiredAction: 'Name the intended effect and the signal that limits further change.',
        teachingPoint:
          'The debrief preserves the casebook success conditions and critical-error rules.',
      },
      transfer: {
        objective: 'Transfer to abrupt hypoxemia with instability.',
        requiredAction: 'Select immediate bedside assessment and mechanism localization.',
        teachingPoint:
          'A new unstable phenotype should not be treated as a continuation of the prior clean case.',
      },
    },
    prediction: {
      prompt: 'Which prediction best supports reassessment after an oxygenation action?',
      choices: [
        { id: 'tradeoff', label: 'Predict oxygenation plus pressure and hemodynamic direction' },
        { id: 'spo2-only', label: 'Predict only the saturation direction' },
      ],
      correctChoiceId: 'tradeoff',
      explanation:
        'The preserved cases compare physiologic response and safety, not a single display value.',
    },
    transfer: {
      prompt: 'Hypoxemia becomes abrupt and hypotension appears. What changes?',
      choices: [
        {
          id: 'urgent-reassess',
          label: 'Reassess the patient urgently and localize the new mechanism',
        },
        { id: 'continue', label: 'Continue the prior sequence without checking the new phenotype' },
      ],
      correctChoiceId: 'urgent-reassess',
      explanation: 'The new instability requires a fresh safety assessment and mechanism check.',
    },
    references: [
      {
        title: 'Gas exchange',
        summary: 'The model exposes bounded SpO₂, PaO₂, PaCO₂, pH, shunt, and dead-space behavior.',
      },
      {
        title: 'Coupled consequences',
        summary: 'Modeled mechanics and hemodynamics remain visible during oxygenation changes.',
      },
    ],
  }),
  lesson({
    id: 'ventilation-and-co2',
    title: 'Ventilation: measured response over time',
    domain: 'Ventilation',
    summary:
      'Distinguish immediate delivered ventilation from the slower modeled carbon-dioxide response.',
    relatedCaseIds: ['MV-05', 'MV-06', 'MV-12'],
    phases: {
      recognize: {
        objective: 'Recognize inadequate or excessive modeled ventilation.',
        requiredAction:
          'Review delivered volume, total rate, minute ventilation, and gas exchange.',
        teachingPoint: 'The displayed settings and measured delivery are not interchangeable.',
      },
      predict: {
        objective: 'Predict immediate and delayed response separately.',
        requiredAction: 'Commit to a waveform/mechanics direction and a gas-exchange direction.',
        teachingPoint:
          'Delivered breath measurements change before the full gas-exchange response is available.',
      },
      act: {
        objective: 'Apply a mechanism-specific change.',
        requiredAction: 'Change one ventilator or patient factor tied to effective ventilation.',
        teachingPoint:
          'Make one bounded change so its effect can be attributed during reassessment.',
      },
      observe: {
        objective: 'Observe delivery before interpreting delayed gas exchange.',
        requiredAction:
          'Review waveforms and mechanics, then allow simulated time before repeat gas assessment.',
        teachingPoint: 'An early gas sample may not represent the eventual modeled response.',
      },
      explain: {
        objective: 'Explain the time sequence.',
        requiredAction: 'Separate immediate delivery from delayed carbon-dioxide response.',
        teachingPoint:
          'The case debrief credits the correct response direction and reassessment timing.',
      },
      transfer: {
        objective: 'Transfer to obstructive emptying failure.',
        requiredAction: 'Choose the assessment that checks expiration before increasing delivery.',
        teachingPoint:
          'More nominal minute ventilation can worsen an expiratory timing problem in the model.',
      },
    },
    prediction: {
      prompt: 'After a setting change, which response should be checked first in this model?',
      choices: [
        {
          id: 'delivery-first',
          label: 'Delivered waveforms and mechanics, then delayed gas exchange',
        },
        { id: 'instant-abg', label: 'Assume the gas measurement changes fully and immediately' },
      ],
      correctChoiceId: 'delivery-first',
      explanation:
        'Waveforms and mechanics respond first; modeled gas exchange evolves more slowly.',
    },
    transfer: {
      prompt: 'An obstructive case has incomplete exhalation. What should precede increasing rate?',
      choices: [
        { id: 'expiration', label: 'Assess expiratory flow and intrinsic PEEP' },
        { id: 'rate-only', label: 'Increase rate without checking expiration' },
      ],
      correctChoiceId: 'expiration',
      explanation:
        'The obstructive cases require assessment of emptying and dynamic hyperinflation.',
    },
    references: [
      {
        title: 'Immediate response',
        summary: 'Waveforms and mechanics change before the delayed gas response.',
      },
      {
        title: 'Delayed response',
        summary: 'Gas exchange and medication effects use slower bounded response behavior.',
      },
    ],
  }),
  lesson({
    id: 'safety-reassessment-and-human-factors',
    title: 'Safety, reassessment, and the whole patient',
    domain: 'Safety',
    summary:
      'Keep alarms, examination, communication, comfort, and explicit reassessment inside the action loop.',
    relatedCaseIds: ['MV-06', 'MV-13', 'MV-14', 'MV-15'],
    phases: {
      recognize: {
        objective: 'Recognize when the patient needs immediate bedside assessment.',
        requiredAction: 'Read alarms as signals and examine the simulated patient context.',
        teachingPoint: 'Acknowledging an alarm does not resolve its modeled cause.',
      },
      predict: {
        objective: 'Predict the immediate safety priority and response.',
        requiredAction: 'Record an initial frame, then compare it with the response to an action.',
        teachingPoint: 'The commitment separates pre-action reasoning from hindsight.',
      },
      act: {
        objective: 'Choose an action within the case safety boundary.',
        requiredAction:
          'Use bedside, airway/circuit, ventilator, or escalation actions as indicated.',
        teachingPoint:
          'High-risk actions remain recognition-and-priority exercises tied to local supervised protocols.',
      },
      observe: {
        objective: 'Observe patient, alarm, waveform, and hemodynamic response.',
        requiredAction: 'Repeat the case-specific discriminating assessment.',
        teachingPoint: 'A successful-looking screen change is not completion without reassessment.',
      },
      explain: {
        objective: 'Explain safety priority, action, and consequence.',
        requiredAction: 'Close the loop with the team or patient in the case record.',
        teachingPoint: 'Communication and comfort remain part of the causal review.',
      },
      transfer: {
        objective: 'Transfer to a new high-pressure deterioration.',
        requiredAction: 'Repeat patient, airway, circuit, and pressure-component assessment.',
        teachingPoint: 'A new patient requires fresh mechanism localization.',
      },
    },
    prediction: {
      prompt: 'What does acknowledging a ventilator alarm accomplish?',
      choices: [
        {
          id: 'signal-only',
          label: 'It records acknowledgment; the active condition still requires assessment',
        },
        { id: 'treatment', label: 'It treats the modeled cause automatically' },
      ],
      correctChoiceId: 'signal-only',
      explanation:
        'Alarm acknowledgment changes alert handling; it does not correct the active cause.',
    },
    transfer: {
      prompt:
        'A different patient develops a high-pressure alarm. What assessment should be repeated?',
      choices: [
        {
          id: 'clean-case',
          label: 'Patient examination, airway/circuit inspection, and peak-to-plateau comparison',
        },
        {
          id: 'altered-state',
          label: 'Alarm acknowledgment alone without examining the patient or circuit',
        },
      ],
      correctChoiceId: 'clean-case',
      explanation: 'The new event requires patient-specific assessment and mechanism localization.',
    },
    references: [
      {
        title: 'Reasoning domains',
        summary:
          'The debrief compares safety, mechanism, corrective action, reassessment, and communication.',
      },
      {
        title: 'Clinical boundary',
        summary:
          'This module is not a device, treatment recommendation, or substitute for supervised practice.',
      },
    ],
  }),
  lesson({
    id: 'high-peak-pressure-integration',
    title: 'High peak pressure: resistance, compliance, auto-PEEP, or patient effort?',
    domain: 'Integration',
    estimatedMinutes: 14,
    summary:
      'One alarm, four mechanisms. Use the peak-to-plateau split, the expiratory limb, and the patient to separate them before acting.',
    relatedCaseIds: ['MV-01', 'MV-05', 'MV-06', 'MV-13', 'MV-14'],
    phases: {
      recognize: {
        objective: 'Recognize that a high peak pressure names an alarm, not a mechanism.',
        requiredAction:
          'Read the patient, the pressure and flow waveforms, and the alarm together before touching a setting.',
        teachingPoint:
          'Peak pressure is the sum of what it took to move gas through the circuit and airway plus what it took to distend the respiratory system. The alarm cannot say which term rose.',
      },
      predict: {
        objective:
          'Predict which of resistance, compliance, auto-PEEP, or patient effort the discriminating measurements will implicate.',
        requiredAction:
          'Commit to one dominant mechanism and state what the peak-to-plateau difference and the expiratory flow tracing should show if you are right.',
        teachingPoint:
          'Naming the expected finding before measuring is what makes the measurement informative rather than confirmatory.',
      },
      act: {
        objective: 'Obtain the measurements that separate the four mechanisms.',
        requiredAction:
          'Perform an inspiratory hold for plateau pressure, inspect whether expiratory flow returns to zero, and assess patient effort and the airway/circuit.',
        teachingPoint:
          'A widened peak-to-plateau gap points at resistance; a raised plateau with a narrow gap points at the respiratory system itself; expiratory flow that never reaches zero points at trapped volume. Effort can raise or lower measured pressures depending on its timing.',
      },
      observe: {
        objective: 'Observe what the measurements actually showed, including where they disagree.',
        requiredAction:
          'Compare the observed plateau, the peak-to-plateau difference, the expiratory limb, and the patient against the committed prediction.',
        teachingPoint:
          'Holds are only interpretable in a relaxed patient; an active effort during the maneuver makes the plateau uninterpretable rather than reassuring.',
      },
      explain: {
        objective: 'Explain the mechanism in terms of the measurement that identified it.',
        requiredAction:
          'State the dominant mechanism, the competing one you excluded, and the finding that excluded it.',
        teachingPoint:
          'More than one mechanism can be present at once. The useful claim is which one is dominant now, not which one is uniquely present.',
      },
      transfer: {
        objective: 'Transfer the sequence to a high-pressure alarm with a different cause.',
        requiredAction:
          'Repeat patient assessment, the peak-to-plateau split, and the expiratory-limb inspection on the new patient.',
        teachingPoint:
          'The reading sequence transfers; the answer does not. A new patient requires fresh localization.',
      },
    },
    prediction: {
      prompt:
        'Peak pressure has risen sharply. Plateau pressure is unchanged, and expiratory flow still returns to zero before the next breath. Which mechanism does this pattern implicate?',
      choices: [
        {
          id: 'resistance',
          label:
            'A resistive problem in the airway or circuit — the peak-to-plateau gap widened while the distending pressure did not change',
        },
        {
          id: 'compliance',
          label: 'A fall in respiratory-system compliance',
        },
        {
          id: 'auto-peep',
          label: 'Dynamic hyperinflation with trapped end-expiratory volume',
        },
      ],
      correctChoiceId: 'resistance',
      explanation:
        'An unchanged plateau means the pressure required to distend the respiratory system at end-inspiration has not changed, so the extra peak pressure was spent moving gas — secretions, a kinked or obstructed tube, bronchospasm, or a circuit problem. Expiratory flow reaching zero argues against trapped volume as the dominant contributor.',
    },
    transfer: {
      prompt:
        'A different patient triggers the same high-pressure alarm. Plateau pressure has risen with an unchanged peak-to-plateau difference, and the patient is making visible inspiratory effort. What should be established first?',
      choices: [
        {
          id: 'relaxed-measurement',
          label:
            'Whether the hold measurements are interpretable at all, since active effort during the maneuver invalidates the plateau before any mechanism can be assigned',
        },
        {
          id: 'raise-alarm-limit',
          label: 'Raise the pressure alarm limit so the alarm stops and reassess later',
        },
        {
          id: 'assume-compliance',
          label: 'Assume a compliance fall and act on it, since the plateau rose',
        },
      ],
      correctChoiceId: 'relaxed-measurement',
      explanation:
        'The pattern is consistent with a compliance problem, but patient effort during an inspiratory hold makes the plateau uninterpretable — the same tracing can be produced by effort alone. Establish measurement validity before assigning a mechanism, exactly as the waveform-reading sequence requires.',
    },
    references: [
      {
        title: 'Pressure components',
        summary:
          'The peak-to-plateau difference separates the resistive component from the pressure needed to distend the respiratory system.',
      },
      {
        title: 'Expiratory limb',
        summary:
          'Expiratory flow that does not return to zero before the next breath indicates incomplete emptying and trapped volume.',
      },
      {
        title: 'Measurement validity',
        summary:
          'Hold maneuvers assume a relaxed patient. Reported values from an actively breathing patient are not interpretable as mechanics.',
      },
      {
        title: 'Clinical boundary',
        summary:
          'Numeric thresholds and corrective protocols are deliberately not supplied here; they belong to the module content pass and to local policy.',
      },
    ],
  }),
] as const

export const mechanicalVentilationLessonById = new Map(
  mechanicalVentilationLessons.map((definition) => [definition.id, definition]),
)

export const mechanicalVentilationLessonIds = mechanicalVentilationLessons.map(
  (definition) => definition.id,
)

export const MECHANICAL_VENTILATION_ASSESSMENT_ID = 'masked-seeded'

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function selectVentilationAssessmentCaseId(
  seed: string,
  caseIds: readonly string[],
): string | null {
  if (caseIds.length === 0) return null
  return caseIds[hashSeed(seed) % caseIds.length] ?? null
}
