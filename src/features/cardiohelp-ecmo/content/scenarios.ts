import type {
  PredictionControl,
  PredictionDirection,
  ScenarioDefinition,
  ScenarioObjective,
  SimulationAction,
  SupportMode,
  UnsafeActionPenalty,
} from '../engine/types'

const standardObjectives: readonly ScenarioObjective[] = [
  { id: 'goal', category: 'goal', label: 'Name the patient or safety goal', points: 15 },
  {
    id: 'control',
    category: 'control',
    label: 'Choose the correct control or inspection',
    points: 20,
  },
  {
    id: 'direction',
    category: 'direction',
    label: 'Predict the correct direction of change',
    points: 15,
  },
  {
    id: 'cause',
    category: 'cause',
    label: 'Correct the cause rather than the display',
    points: 25,
  },
  {
    id: 'reassessment',
    category: 'reassessment',
    label: 'Reassess device, circuit, and patient before reveal',
    points: 25,
  },
]

const standardUnsafeActions: readonly UnsafeActionPenalty[] = [
  {
    id: 'ack-without-correction',
    label: 'Completed a round after acknowledging an alarm without correcting its cause',
    points: 30,
    critical: true,
  },
  {
    id: 'premature-bubble-reset',
    label: 'Attempted bubble reset before the air source was corrected',
    points: 50,
    critical: true,
  },
  {
    id: 'unsafe-unclamp-before-deair',
    label: 'Opened a circuit clamp before the air source was corrected and cleared',
    points: 50,
    critical: true,
  },
  {
    id: 'global-override',
    label: 'Used Global Override as routine troubleshooting',
    points: 50,
    critical: true,
  },
  {
    id: 'rpm-during-collapse',
    label: 'Increased RPM during drainage collapse',
    points: 50,
    critical: true,
  },
  {
    id: 'air-correction-before-isolation',
    label:
      'Corrected or cleared circuit air before both near-patient clamps had isolated the patient',
    points: 50,
    critical: true,
  },
  {
    id: 'support-reduction-on-battery',
    label: 'Reduced pump support on reserve power to stretch the battery time',
    points: 50,
    critical: true,
  },
  {
    // Kept separate from `rpm-during-collapse`: recirculation is not a drainage-collapse state, and
    // labelling it as one would name the wrong mechanism in the debrief the learner reads.
    id: 'rpm-during-recirculation',
    label: 'Increased speed against established recirculation',
    points: 50,
    critical: true,
  },
  {
    id: 'capstone-flow-reduction',
    label: 'Changed or stopped circuit blood flow during a protected assessment sequence',
    points: 50,
    critical: true,
  },
  {
    id: 'va-sweep-off',
    label: 'Turned sweep gas off while forward VA circuit blood flow continued',
    points: 50,
    critical: true,
  },
]

const allActions: readonly SimulationAction['type'][] = [
  'TICK',
  'SET_PAUSED',
  'STEP',
  'SET_SCREEN',
  'TOGGLE_LOCK',
  'SET_PUMP_MODE',
  'ROTARY_DELTA',
  'SET_RPM',
  'SET_FLOW_TARGET',
  'SET_SWEEP',
  'SET_GAS_FIO2',
  'RESTORE_GAS_SOURCE',
  'RESTORE_AC_POWER',
  'TOGGLE_ZERO_FLOW',
  'TOGGLE_GLOBAL_OVERRIDE',
  'PRESS_SAFETY',
  'RELEASE_SAFETY',
  'ADJUST_LIMIT',
  'TOGGLE_TIMER',
  'RESET_TIMER',
  'ACK_ALARM',
  'RESET_BUBBLE',
  'TOGGLE_CIRCUIT_CLAMP',
  'CORRECT_FAULT',
  'PERFORM_CHECK',
  'COMMIT_PREDICTION',
  'COMMIT_REASSESSMENT',
  'REQUEST_HINT',
  'REVEAL_DEBRIEF',
  'TOGGLE_ALARM_AUDIO',
] as const

export const TIP_TO_TIP_CHECK_ID = 'tip-to-tip-circuit-inspection'

function scenario(
  definition: Omit<
    ScenarioDefinition,
    | 'supportMode'
    | 'allowedActions'
    | 'objectives'
    | 'unsafeActionPenalties'
    | 'successPredicates'
    | 'terminalRules'
  > & { supportMode?: SupportMode } & Partial<
      Pick<
        ScenarioDefinition,
        | 'allowedActions'
        | 'objectives'
        | 'unsafeActionPenalties'
        | 'successPredicates'
        | 'terminalRules'
      >
    >,
): ScenarioDefinition {
  return {
    supportMode: definition.supportMode ?? 'vv',
    allowedActions: allActions,
    objectives: standardObjectives,
    unsafeActionPenalties: standardUnsafeActions,
    successPredicates: [
      'The predicted goal, control, and direction match the scenario expectation.',
      'The underlying fault or management problem is corrected.',
      'A device, circuit, and patient reassessment is committed before reveal.',
    ],
    terminalRules: [
      'Score is calculated only after reassessment.',
      'Mastery requires at least 80% with no critical safety error.',
    ],
    ...definition,
  }
}

export const cardiohelpScenarios: readonly ScenarioDefinition[] = [
  scenario({
    id: 'startup-sensor-orientation',
    family: 'orientation',
    stationId: 'orientation',
    title: 'Startup, self-test, and sensor orientation',
    summary:
      'Complete the pre-use sequence, trace the circuit, and identify why console data cannot replace a circuit and patient check.',
    clinicalPhase: 'startup',
    initialState: {
      device: { selfTest: 'pending', rpmSetpoint: 0, pumpRunning: false },
      circuit: { circuitInspected: false },
      activeFaults: ['startup-inspection'],
      paused: true,
    },
    timedFaults: [],
    expectation: {
      goalId: 'safe-startup',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'startup-inspection',
      acceptableReassessmentTerms: ['self-test', 'circuit', 'sensor', 'patient'],
      requiredCheckId: TIP_TO_TIP_CHECK_ID,
    },
    debrief: {
      diagnosis: 'Incomplete startup and orientation check',
      causalChain: [
        'A console self-test checks device functions, not the whole extracorporeal circuit.',
        'Flow-probe direction, pressure locations, gas source, cannulas, backup power, and independent patient data require separate inspection.',
      ],
      correctWorkflow: [
        'Allow self-test to finish without operating the touchscreen or rotary control.',
        'Confirm the audible indicator and Cardiopulmonary Support startup screen.',
        'Trace drainage to pump to oxygenator to return; verify sensors, gas, power, and backup readiness.',
      ],
      safetyNotes: ['Reject a failed self-test and follow local replacement/escalation policy.'],
    },
    evidenceIds: [
      'ifu-console-workflow',
      'ifu-us-2025-scope',
      'ecmo-book-ch9',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'preload-drainage-collapse',
    family: 'preload',
    stationId: 'flow-pressure',
    title: 'Falling flow with increasingly negative pVen',
    summary:
      'Increasingly negative drainage pressure and chattering appear while displayed flow falls.',
    clinicalPhase: 'stabilization',
    initialState: {
      device: { rpmSetpoint: 3600 },
      activeFaults: ['preload-limited'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-drainage',
      control: 'rpm',
      direction: 'decrease',
      correctiveFault: 'preload-limited',
      acceptableReassessmentTerms: ['flow', 'pven', 'chatter', 'patient'],
    },
    debrief: {
      diagnosis: 'Preload-limited drainage with caval/cannula collapse pattern',
      causalChain: [
        'Available venous return becomes insufficient for the pump demand.',
        'pVen becomes more negative, the drainage line chatters, and flow becomes unstable.',
        'More RPM can worsen collapse rather than restore effective support.',
      ],
      correctWorkflow: [
        'Temporarily reduce RPM while assessing the patient and circuit.',
        'Evaluate cannula position, kinks, coughing/straining, venous volume, and other drainage causes.',
        'Correct the cause, then titrate to a patient endpoint and reassess.',
      ],
      safetyNotes: ['Do not reflexively give fluid or escalate RPM without determining the cause.'],
    },
    evidenceIds: ['ecmo-book-ch9', 'ecmo-book-ch17', 'bounded-educational-model'],
  }),
  scenario({
    id: 'afterload-return-obstruction',
    family: 'afterload',
    stationId: 'flow-pressure',
    title: 'pInt and pArt rise together as flow falls',
    summary:
      'Flow falls while pArt and pInt rise together and the oxygenator pressure-drop trend changes little.',
    clinicalPhase: 'maintenance',
    initialState: { activeFaults: ['return-obstruction'] },
    timedFaults: [],
    expectation: {
      goalId: 'localize-resistance',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'return-obstruction',
      acceptableReassessmentTerms: ['part', 'pint', 'delta', 'flow'],
    },
    debrief: {
      diagnosis: 'Downstream/return-side resistance',
      causalChain: [
        'Resistance after the oxygenator raises return pressure.',
        'pArt and pInt rise together while flow falls; delta-p need not rise substantially.',
      ],
      correctWorkflow: [
        'Inspect return tubing, clamps, connectors, cannula position, and pressure-sensor plausibility.',
        'Correct the downstream cause and reassess the patient and full pressure pattern.',
      ],
      safetyNotes: ['Do not chase a mechanically limited flow with repeated RPM escalation.'],
    },
    evidenceIds: ['ecmo-book-ch9', 'ecmo-book-ch17', 'bounded-educational-model'],
  }),
  scenario({
    id: 'afterload-oxygenator-resistance',
    family: 'afterload',
    stationId: 'flow-pressure',
    title: 'pInt rises relative to pArt',
    summary:
      'pInt rises relative to pArt and the pressure-drop trend increases as flow becomes constrained.',
    clinicalPhase: 'maintenance',
    initialState: { activeFaults: ['oxygenator-resistance'] },
    timedFaults: [],
    expectation: {
      goalId: 'localize-resistance',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'oxygenator-resistance',
      acceptableReassessmentTerms: ['pint', 'part', 'delta', 'oxygenator'],
    },
    debrief: {
      diagnosis: 'Increased oxygenator resistance/dysfunction pattern',
      causalChain: [
        'Resistance across the oxygenator raises pre-oxygenator pressure relative to post-oxygenator pressure.',
        'The delta-p trend rises and available flow may fall at the same RPM.',
      ],
      correctWorkflow: [
        'Compare pInt, pArt, delta-p trend, flow, gas transfer, and sensor plausibility.',
        'Inspect the oxygenator/circuit and escalate according to local exchange protocol.',
      ],
      safetyNotes: [
        'No fixed delta-p alarm priority is taught because the supplied IFU is internally inconsistent on that point.',
      ],
    },
    evidenceIds: [
      'ifu-anomaly-boundary',
      'ecmo-book-ch9',
      'ecmo-book-ch17',
      'elso-circuit-2022',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'vv-recirculation',
    family: 'recirculation',
    stationId: 'flow-pressure',
    title: 'High displayed flow with limited oxygenation response',
    summary:
      'Displayed flow is high, but patient oxygenation worsens and pre-oxygenator saturation rises toward patient saturation.',
    clinicalPhase: 'maintenance',
    initialState: {
      device: { rpmSetpoint: 3800 },
      activeFaults: ['recirculation'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'increase-effective-support',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'recirculation',
      acceptableReassessmentTerms: ['spo2', 'pre-oxygenator', 'flow', 'cannula'],
    },
    debrief: {
      diagnosis: 'VV recirculation limiting effective support',
      causalChain: [
        'Some oxygenated return blood is drawn back into the drainage cannula.',
        'Displayed circuit flow rises without a proportional increase in effective patient support.',
        'Pre-oxygenator saturation rises and the patient/pre-oxygenator saturation gap narrows.',
        'Asking the circuit for more flow recruits more of that returned blood, so the displayed number keeps climbing while the support reaching the patient falls.',
      ],
      correctWorkflow: [
        'Confirm the pattern with patient oxygenation and pre-oxygenator data.',
        'Reassess cannula position/configuration and seek the efficient flow point.',
      ],
      safetyNotes: [
        'Displayed L/min is not equivalent to effective systemic support.',
        'Speed is not a treatment for recirculation. Escalating it against an established recirculating share moves the displayed number and not the patient.',
      ],
    },
    evidenceIds: ['ecmo-book-ch17', 'elso-adult-vv-2021', 'bounded-educational-model'],
  }),
  scenario({
    id: 'acute-hypercapnia',
    family: 'sweep',
    stationId: 'sweep',
    title: 'Acute hypercapnic acidosis',
    summary:
      'PaCO2 is rising with acidemia during stabilization; choose the external gas control and reassess.',
    clinicalPhase: 'stabilization',
    initialState: {
      gas: { sweepLpm: 2 },
      patient: { paCO2: 68, bicarbonate: 25, pH: 7.18, workOfBreathing: 'high' },
      activeFaults: ['acute-hypercapnia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'improve-acidemia',
      control: 'sweep',
      direction: 'increase',
      correctiveFault: 'acute-hypercapnia',
      acceptableReassessmentTerms: ['paco2', 'ph', 'work', 'abg'],
    },
    debrief: {
      diagnosis: 'Insufficient CO2 clearance for the current stabilization goal',
      causalChain: [
        'Sweep flow changes gas transfer across the membrane and primarily changes CO2 clearance.',
        'The response must be interpreted with pH, bicarbonate, symptoms, and clinical phase.',
      ],
      correctWorkflow: [
        'Name the pH/CO2 goal, predict the direction, and make a measured sweep adjustment.',
        'Allow time for the response, then reassess patient status and blood gas data.',
      ],
      safetyNotes: [
        'Sweep is an external gas-blender control, not a CARDIOHELP-i touchscreen control.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch16',
      'ecmo-book-ch18',
      'elso-adult-vv-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'compensated-hypercapnia',
    family: 'sweep',
    stationId: 'sweep',
    title: 'Compensated hypercapnia in maintenance',
    summary:
      'PaCO2 is elevated but bicarbonate and pH show compensation; avoid treating one isolated number.',
    clinicalPhase: 'maintenance',
    initialState: {
      gas: { sweepLpm: 3.5 },
      patient: { paCO2: 58, bicarbonate: 34, pH: 7.39, workOfBreathing: 'low' },
      activeFaults: ['compensated-hypercapnia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'preserve-compensation',
      control: 'sweep',
      direction: 'hold',
      correctiveFault: 'compensated-hypercapnia',
      acceptableReassessmentTerms: ['ph', 'bicarbonate', 'paco2', 'phase'],
    },
    debrief: {
      diagnosis: 'Compensated hypercapnia without an automatic need to normalize PaCO2',
      causalChain: [
        'A chronic or compensated CO2 state cannot be interpreted from PaCO2 alone.',
        'Abrupt normalization can overshoot the intended acid-base goal.',
      ],
      correctWorkflow: [
        'Review pH, bicarbonate, symptoms, work of breathing, and phase.',
        'Hold or make only a goal-directed change, then reassess rather than chase a normal PaCO2.',
      ],
      safetyNotes: [
        'This exercise teaches reasoning, not a universal permissive-hypercapnia target.',
      ],
    },
    evidenceIds: ['ecmo-book-ch18', 'bounded-educational-model'],
  }),
  scenario({
    id: 'gas-source-interruption',
    family: 'gas-source',
    stationId: 'troubleshooting',
    title: 'Gas transfer falls while blood flow persists',
    summary:
      'An unannounced gas-source interruption causes CO2 retention and oxygenator gas-transfer decline while circuit blood flow remains present.',
    clinicalPhase: 'maintenance',
    initialState: {},
    timedFaults: [
      {
        id: 'gas-disconnect-5s',
        atSecond: 5,
        fault: 'gas-source-interruption',
        cue: 'Gas supply interrupted.',
      },
    ],
    expectation: {
      goalId: 'restore-gas-transfer',
      control: 'restore-gas',
      direction: 'restore',
      correctiveFault: 'gas-source-interruption',
      acceptableReassessmentTerms: ['source', 'paco2', 'spo2', 'flow'],
    },
    debrief: {
      diagnosis: 'Sweep-gas source interruption',
      causalChain: [
        'Circuit blood flow can continue while membrane gas flow is absent.',
        'CO2 clearance falls and oxygenator contribution declines despite a normal-looking blood-flow number.',
      ],
      correctWorkflow: [
        'Inspect the separate gas path and restore the source.',
        'Distinguish sweep flow from sweep-gas FiO2 and reassess patient gas exchange.',
      ],
      safetyNotes: ['Never infer intact gas exchange from circuit blood flow alone.'],
    },
    evidenceIds: [
      'ecmo-book-ch9',
      'ecmo-book-ch18',
      'elso-circuit-2022',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'arterial-bubble-stop',
    family: 'bubble',
    stationId: 'troubleshooting',
    title: 'Arterial bubble alarm with pump stop',
    summary:
      'An arterial bubble event during the run stops the pump; correct the source and confirm the circuit clear before support is resumed.',
    clinicalPhase: 'maintenance',
    initialState: {},
    timedFaults: [
      { id: 'bubble-4s', atSecond: 4, fault: 'arterial-bubble', cue: 'Arterial bubble detected.' },
    ],
    expectation: {
      goalId: 'prevent-air-return',
      control: 'correct-cause',
      direction: 'inspect',
      correctiveFault: 'arterial-bubble',
      acceptableReassessmentTerms: ['bubble', 'air', 'pump', 'patient'],
    },
    debrief: {
      diagnosis: 'Arterial bubble intervention with pump stop',
      causalChain: [
        'This case presents an arterial bubble event without assigning a bubble size.',
        'The enabled intervention generates a high-priority alarm and stops the pump.',
        'Reset is appropriate only after the air source is corrected and the circuit is confirmed clear.',
      ],
      correctWorkflow: [
        'Clamp the return limb, then the drainage limb, near the patient to isolate the circuit.',
        'Correct the source of air and confirm the circuit is bubble free.',
        'Resume support per the current IFU and approved local protocol, then reassess. Where clamp opening, pump restart and console reset fall relative to one another is set by those documents, not by this module.',
      ],
      safetyNotes: [
        'Premature reset is a critical safety error.',
        'Isolation is taught explicitly. The clamp, pump, and device-reset choreography for resumption is governed by the current manufacturer IFU and your unit’s approved ECMO air-emergency protocol; this simulation does not teach that choreography.',
      ],
    },
    evidenceIds: [
      'ifu-console-workflow',
      'ifu-anomaly-boundary',
      'elso-circuit-2022',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'transport-power-loss',
    family: 'transport',
    stationId: 'troubleshooting',
    title: 'Transport power loss and battery escalation',
    summary:
      'AC power drops during transport; recognize battery state, restore power, and verbalize backup readiness.',
    clinicalPhase: 'transport',
    initialState: { device: { screen: 'transport', batteryPercent: 24 } },
    timedFaults: [
      { id: 'ac-loss-3s', atSecond: 3, fault: 'ac-power-loss', cue: 'Mains power lost.' },
    ],
    expectation: {
      goalId: 'maintain-continuous-support',
      control: 'restore-power',
      direction: 'restore',
      correctiveFault: 'ac-power-loss',
      acceptableReassessmentTerms: ['ac', 'battery', 'backup', 'flow'],
    },
    assessmentPolicy: {
      // B6-004: the case's own opening speed, never an invented flow target.
      requireBaselineSupportRestored: true,
      minimumObservationSeconds: 1,
      reassessmentGuidance: {
        device:
          'The power-source indicator shows AC again and the battery reading is no longer falling.',
        circuit: 'Circuit flow and pressures ran unchanged through the changeover and after it.',
        patient: 'Oxygenation and perfusion are unchanged from before the event.',
      },
    },
    debrief: {
      diagnosis: 'Transport mains-power loss with battery escalation risk',
      causalChain: [
        'The console changes to battery power automatically.',
        'Remaining battery falls while circuit and patient risk rises if alternate power is not restored.',
      ],
      correctWorkflow: [
        'Recognize the power-source indicator and restore a verified AC source.',
        'Confirm circuit flow and patient status. Backup-console and emergency-drive readiness is a bedside obligation this simulator does not represent or credit.',
      ],
      safetyNotes: [
        'This screen exercise teaches recognition and readiness; hands-on emergency-drive practice belongs to bedside training with the device.',
      ],
    },
    evidenceIds: [
      'ifu-console-workflow',
      'ecmo-book-ch9',
      'elso-circuit-2022',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'vv-off-sweep-capstone',
    family: 'capstone',
    stationId: 'assessment',
    title: 'VV off-sweep integration challenge',
    summary: 'Demonstrate the correct separation sequence without reducing circuit blood flow.',
    clinicalPhase: 'weaning',
    initialState: {
      device: { pumpMode: 'rpm', rpmSetpoint: 3200 },
      gas: { sweepLpm: 3 },
      patient: { spo2: 95, paCO2: 43, pH: 7.4, respiratoryRate: 20, workOfBreathing: 'low' },
      activeFaults: ['compensated-hypercapnia'],
      paused: true,
    },
    timedFaults: [],
    expectation: {
      goalId: 'test-native-lung',
      control: 'off-sweep-trial',
      direction: 'off',
      correctiveFault: 'compensated-hypercapnia',
      acceptableReassessmentTerms: ['spo2', 'work', 'paco2', 'blood flow'],
    },
    assessmentPolicy: {
      minimumObservationSeconds: 20,
      preserveCircuitBloodFlow: true,
      orderedPatientTermGroups: [['spo2', 'oxygenation'], ['work'], ['paco2', 'ph']],
      reassessmentGuidance: {
        device: 'Confirm RPM and circuit blood flow remained stable.',
        circuit: 'Confirm sweep is off while blood continues through the circuit.',
        patient: 'Record SpO₂ first, work of breathing second, then PaCO₂/pH.',
      },
    },
    challengeBrief: {
      title:
        'Settled gas exchange on VV support, and the question of whether the patient still needs it',
      presentation:
        'Saturation, PaCO₂ and pH sit where the team wants them, breathing is unlabored, and the circuit runs steadily at its current settings; nothing has been changed yet.',
    },
    debrief: {
      diagnosis: 'VV separation assessment with sweep off and circuit blood flow maintained',
      causalChain: [
        'VV support is tested by removing membrane gas exchange while keeping adequate circuit blood flow.',
        'Oxygenation response appears first, work of breathing is assessed second, and PaCO2/pH are assessed after time for equilibration.',
      ],
      correctWorkflow: [
        'Maintain circuit blood flow and turn sweep to zero.',
        'Assess SpO2 first, work of breathing second, and PaCO2/pH third.',
        'Stop or reverse the trial if the patient fails the predefined local-protocol endpoint.',
      ],
      safetyNotes: [
        'This sequence is VV-specific and must not be transferred to the separate VA pathway.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch17',
      'ecmo-book-ch18',
      'elso-adult-vv-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-startup-sensor-orientation',
    supportMode: 'va',
    family: 'orientation',
    stationId: 'orientation',
    title: 'VA startup, femoral circuit, and sensor orientation',
    summary:
      'Complete the pre-use sequence and trace femoral venous drainage through the circuit to femoral arterial return.',
    clinicalPhase: 'startup',
    initialState: {
      device: { selfTest: 'pending', rpmSetpoint: 0, pumpRunning: false },
      circuit: { circuitInspected: false },
      patient: { rightRadialSpo2: 96, femoralArterialSpo2: 99, pulsePressure: 18 },
      activeFaults: ['startup-inspection'],
      paused: true,
    },
    timedFaults: [],
    expectation: {
      goalId: 'safe-startup',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'startup-inspection',
      acceptableReassessmentTerms: ['self-test', 'venous drainage', 'arterial return', 'patient'],
      requiredCheckId: TIP_TO_TIP_CHECK_ID,
    },
    debrief: {
      diagnosis: 'Incomplete VA startup and circuit-orientation check',
      causalChain: [
        'The shared console does not identify whether the post-oxygenator limb returns to a vein or an artery.',
        'Peripheral VA assessment also requires independent pulsatility, upper-body oxygenation, native-heart, and cannulated-limb data.',
      ],
      correctWorkflow: [
        'Allow self-test to finish without operating the controls.',
        'Trace femoral venous drainage to pump to oxygenator to femoral arterial return and verify every sensor.',
        'Confirm gas, power, backup readiness, right-arm monitoring, native ejection, and cannulated-limb assessment.',
      ],
      safetyNotes: [
        'This is recognition training; cannulation and distal-perfusion technique are learned at the bedside, not here.',
      ],
    },
    evidenceIds: [
      'ifu-console-workflow',
      'ecmo-book-ch9',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-preload-drainage-collapse',
    supportMode: 'va',
    family: 'preload',
    stationId: 'flow-pressure',
    title: 'VA falling flow with increasingly negative pVen',
    summary:
      'Unstable VA flow, increasingly negative drainage pressure, and venous-line chatter appear together.',
    clinicalPhase: 'stabilization',
    initialState: {
      device: { rpmSetpoint: 3600 },
      patient: { meanArterialPressure: 62 },
      activeFaults: ['preload-limited'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-systemic-support',
      control: 'rpm',
      direction: 'decrease',
      correctiveFault: 'preload-limited',
      acceptableReassessmentTerms: ['flow', 'pven', 'chatter', 'perfusion'],
    },
    debrief: {
      diagnosis: 'Preload-limited VA drainage',
      causalChain: [
        'Venous return cannot meet pump demand, so pVen becomes more negative and drainage becomes unstable.',
        'More RPM can deepen collapse while effective systemic support falls.',
      ],
      correctWorkflow: [
        'Temporarily reduce RPM while assessing the patient and venous drainage limb.',
        'Evaluate cannula position, kinks, venous volume, intrathoracic causes, and other impediments to filling.',
        'Correct the cause, then retitrate against perfusion and native-heart endpoints under local protocol.',
      ],
      safetyNotes: ['Do not treat a low displayed flow with reflexive RPM escalation.'],
    },
    evidenceIds: [
      'ecmo-book-ch9',
      'ecmo-book-ch17',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-afterload-arterial-return-obstruction',
    supportMode: 'va',
    family: 'afterload',
    stationId: 'flow-pressure',
    title: 'VA arterial-return resistance: pInt and pArt rise together',
    summary:
      'Flow falls while both post-pump pressures rise, pointing beyond the oxygenator toward the arterial return path.',
    clinicalPhase: 'maintenance',
    initialState: { activeFaults: ['return-obstruction'] },
    timedFaults: [],
    expectation: {
      goalId: 'localize-resistance',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'return-obstruction',
      acceptableReassessmentTerms: ['part', 'pint', 'arterial return', 'flow'],
    },
    debrief: {
      diagnosis: 'Resistance downstream of the oxygenator in the VA arterial-return path',
      causalChain: [
        'Resistance after the oxygenator raises pArt and pInt together while flow falls.',
        'pArt remains a circuit pressure; it is not the patient arterial-line pressure or MAP.',
      ],
      correctWorkflow: [
        'Inspect return tubing, connectors, clamps, cannula path, sensor plausibility, and independent patient afterload.',
        'Correct the identified circuit cause and reassess flow, pressures, perfusion, and the cannulated limb.',
      ],
      safetyNotes: [
        'No single console value distinguishes every circuit and patient afterload cause.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch9',
      'ecmo-book-ch17',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-afterload-oxygenator-resistance',
    supportMode: 'va',
    family: 'afterload',
    stationId: 'flow-pressure',
    title: 'VA oxygenator resistance: pInt separates from pArt',
    summary: 'pInt rises relative to pArt and the cross-oxygenator pressure-drop trend increases.',
    clinicalPhase: 'maintenance',
    initialState: { activeFaults: ['oxygenator-resistance'] },
    timedFaults: [],
    expectation: {
      goalId: 'localize-resistance',
      control: 'inspect-circuit',
      direction: 'inspect',
      correctiveFault: 'oxygenator-resistance',
      acceptableReassessmentTerms: ['pint', 'part', 'delta', 'oxygenator'],
    },
    debrief: {
      diagnosis: 'Increased oxygenator resistance/dysfunction pattern during VA support',
      causalChain: [
        'Resistance across the membrane raises pInt relative to pArt.',
        'The pressure-drop trend rises and available flow may fall at the same RPM.',
      ],
      correctWorkflow: [
        'Compare pInt, pArt, pressure-drop trend, matched flow/RPM, gas transfer, and sensor plausibility.',
        'Inspect and escalate according to the reviewed local circuit-exchange protocol.',
      ],
      safetyNotes: ['No fixed pressure-drop threshold or alarm priority is encoded.'],
    },
    evidenceIds: [
      'ifu-anomaly-boundary',
      'ecmo-book-ch9',
      'elso-circuit-2022',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-differential-hypoxemia',
    supportMode: 'va',
    family: 'differential-oxygenation',
    stationId: 'flow-pressure',
    title: 'Peripheral VA: upper-body oxygenation falls despite oxygenated return blood',
    summary:
      'Right-radial oxygenation falls while post-oxygenator and femoral-arterial values remain reassuring and native pulsatility is present.',
    clinicalPhase: 'maintenance',
    initialState: {
      circuit: { postOxygenatorSaturation: 99 },
      patient: {
        spo2: 82,
        rightRadialSpo2: 82,
        femoralArterialSpo2: 99,
        pulsePressure: 22,
        aorticValveOpening: true,
        nativeCardiacOutputLpm: 2.8,
      },
      activeFaults: ['differential-hypoxemia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'inspect',
      correctiveFault: 'differential-hypoxemia',
      acceptableReassessmentTerms: ['right radial', 'upper body', 'native lung', 'mixing'],
    },
    debrief: {
      diagnosis: 'Differential upper-body hypoxemia during peripheral femoral VA support',
      causalChain: [
        'Retrograde oxygenated ECMO return meets antegrade blood ejected by the native heart.',
        'When native ejection improves before lung oxygenation, the upper body can receive poorly oxygenated native blood despite reassuring lower-body and post-oxygenator values.',
      ],
      correctWorkflow: [
        'Verify the pattern with right-arm saturation or arterial blood gas and compare it with post-oxygenator and lower-body data.',
        'Assess native cardiac ejection, lung oxygenation, circuit performance, and the likely mixing region.',
        'Escalate the support/cannulation strategy to the ECMO team under the reviewed local protocol.',
      ],
      safetyNotes: [
        'This simulator intentionally does not prescribe one universal pump, ventilator, or cannulation correction.',
      ],
    },
    evidenceIds: ['elso-adult-va-2021', 'elso-neuro-monitoring-2024', 'bounded-educational-model'],
  }),
  scenario({
    id: 'va-lv-loading',
    supportMode: 'va',
    family: 'ventricular-loading',
    stationId: 'flow-pressure',
    title: 'Adequate console flow with poor pulsatility and LV-loading cues',
    summary:
      'Displayed VA flow and MAP appear acceptable, but pulse pressure is narrow, the aortic valve is not opening, and pulmonary congestion is worsening.',
    clinicalPhase: 'maintenance',
    initialState: {
      patient: {
        meanArterialPressure: 70,
        pulsePressure: 5,
        aorticValveOpening: false,
        pulmonaryCongestion: 'marked',
        nativeCardiacOutputLpm: 0.8,
        workOfBreathing: 'high',
      },
      activeFaults: ['lv-loading'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'protect-left-heart',
      control: 'assess-lv-loading',
      direction: 'inspect',
      correctiveFault: 'lv-loading',
      acceptableReassessmentTerms: ['pulse pressure', 'aortic valve', 'lv', 'pulmonary'],
    },
    debrief: {
      diagnosis: 'VA support with concerning LV-loading and inadequate native ejection cues',
      causalChain: [
        'Retrograde arterial support can increase LV afterload while an acceptable flow or MAP masks poor native ejection.',
        'Low pulsatility, reduced aortic-valve opening, pulmonary congestion, and echo findings require independent assessment.',
      ],
      correctWorkflow: [
        'Recognize that console flow and MAP do not establish adequate LV ejection.',
        'Assess pulse pressure, aortic-valve opening, LV size/stasis, lung findings, and systemic perfusion.',
        'Escalate urgently for expert unloading evaluation under the reviewed local protocol.',
      ],
      safetyNotes: [
        'No unloading device, threshold, or patient-specific algorithm is recommended in this draft module.',
      ],
    },
    evidenceIds: ['elso-adult-va-2021', 'bounded-educational-model'],
  }),
  scenario({
    id: 'va-acute-hypercapnia',
    supportMode: 'va',
    family: 'sweep',
    stationId: 'sweep',
    title: 'VA acute hypercapnic acidemia',
    summary:
      'PaCO2 rises with acidemia; adjust the external sweep control while continuing to assess circulation and native lung function.',
    clinicalPhase: 'stabilization',
    initialState: {
      gas: { sweepLpm: 2 },
      patient: { paCO2: 68, bicarbonate: 25, pH: 7.18, workOfBreathing: 'high' },
      activeFaults: ['acute-hypercapnia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'improve-acidemia',
      control: 'sweep',
      direction: 'increase',
      correctiveFault: 'acute-hypercapnia',
      acceptableReassessmentTerms: ['paco2', 'ph', 'right radial', 'perfusion'],
    },
    debrief: {
      diagnosis: 'Insufficient membrane CO2 clearance for the current VA stabilization goal',
      causalChain: [
        'Sweep flow primarily changes membrane CO2 clearance.',
        'VA assessment still requires independent circulation, upper-body oxygenation, lung, and blood-gas data.',
      ],
      correctWorkflow: [
        'Name the acid-base goal and make a measured external sweep adjustment.',
        'Reassess PaCO2, pH, right-arm oxygenation, native lung function, and perfusion.',
      ],
      safetyNotes: [
        'Sweep is separate from the CARDIOHELP-i touchscreen and does not replace circulatory assessment.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch16',
      'ecmo-book-ch18',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-gas-source-interruption',
    supportMode: 'va',
    family: 'gas-source',
    stationId: 'troubleshooting',
    title: 'VA gas-source interruption with persistent circuit blood flow',
    summary:
      'A timed sweep-gas interruption removes membrane gas transfer while arterial circuit blood flow continues.',
    clinicalPhase: 'maintenance',
    initialState: {},
    timedFaults: [
      {
        id: 'va-gas-disconnect-5s',
        atSecond: 5,
        fault: 'gas-source-interruption',
        cue: 'Gas supply interrupted.',
      },
    ],
    expectation: {
      goalId: 'restore-gas-transfer',
      control: 'restore-gas',
      direction: 'restore',
      correctiveFault: 'gas-source-interruption',
      acceptableReassessmentTerms: ['source', 'paco2', 'right radial', 'flow'],
    },
    debrief: {
      diagnosis: 'Sweep-gas source interruption during VA support',
      causalChain: [
        'The pump can continue sending blood to the arterial return limb while membrane gas flow is absent.',
        'Post-oxygenator gas transfer and patient oxygenation/CO2 control can deteriorate despite ongoing L/min.',
      ],
      correctWorkflow: [
        'Inspect and restore the external gas source path.',
        'Reassess post-oxygenator gas transfer, right-arm oxygenation, CO2/pH, circuit flow, and perfusion.',
      ],
      safetyNotes: [
        'Ongoing VA blood flow does not prove that the arterial return blood is adequately oxygenated.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch9',
      'ecmo-book-ch18',
      'elso-circuit-2022',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-arterial-bubble-stop',
    supportMode: 'va',
    family: 'bubble',
    stationId: 'troubleshooting',
    title: 'VA arterial-return bubble alarm with pump stop',
    summary:
      'A post-oxygenator bubble event during the run stops forward VA support; correct the source before reset.',
    clinicalPhase: 'maintenance',
    initialState: {},
    timedFaults: [
      {
        id: 'va-bubble-4s',
        atSecond: 4,
        fault: 'arterial-bubble',
        cue: 'Arterial bubble detected.',
      },
    ],
    expectation: {
      goalId: 'prevent-air-return',
      control: 'correct-cause',
      direction: 'inspect',
      correctiveFault: 'arterial-bubble',
      acceptableReassessmentTerms: ['bubble', 'arterial return', 'pump', 'perfusion'],
    },
    debrief: {
      diagnosis: 'Arterial-return bubble intervention with VA pump stop',
      causalChain: [
        'This case presents a bubble event without assigning a disputed size threshold.',
        'The enabled intervention stops the pump, interrupting VA circulatory support.',
      ],
      correctWorkflow: [
        'Clamp the arterial return limb, then the drainage limb, near the patient to isolate the circulation.',
        'Identify and correct the air source and confirm the return path is clear.',
        'Resume venoarterial support per the current IFU and approved local protocol, then reassess perfusion. Where clamp opening, pump restart and console reset fall relative to one another is set by those documents, not by this module.',
      ],
      safetyNotes: [
        'Premature reset and alarm acknowledgement without correction remain critical errors.',
        'Isolation is taught explicitly. The clamp, pump, and device-reset choreography for resumption is governed by the current manufacturer IFU and your unit’s approved ECMO air-emergency protocol; this simulation does not teach that choreography.',
      ],
    },
    evidenceIds: [
      'ifu-console-workflow',
      'ifu-anomaly-boundary',
      'elso-circuit-2022',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-transport-power-loss',
    supportMode: 'va',
    family: 'transport',
    stationId: 'troubleshooting',
    title: 'VA transport power loss and circulatory backup readiness',
    summary:
      'AC power drops during transport; restore verified power while confirming continuous VA support and immediate backup readiness.',
    clinicalPhase: 'transport',
    initialState: { device: { screen: 'transport', batteryPercent: 24 } },
    timedFaults: [
      { id: 'va-ac-loss-3s', atSecond: 3, fault: 'ac-power-loss', cue: 'Mains power lost.' },
    ],
    expectation: {
      goalId: 'maintain-continuous-support',
      control: 'restore-power',
      direction: 'restore',
      correctiveFault: 'ac-power-loss',
      acceptableReassessmentTerms: ['ac', 'battery', 'backup', 'perfusion'],
    },
    assessmentPolicy: {
      // B6-004: the case's own opening speed, never an invented flow target.
      requireBaselineSupportRestored: true,
      minimumObservationSeconds: 1,
      reassessmentGuidance: {
        device:
          'The power-source indicator shows AC again and the battery reading is no longer falling.',
        circuit: 'Circuit flow and pressures ran unchanged through the changeover and after it.',
        patient: 'MAP, perfusion and right-arm saturation are unchanged from before the event.',
      },
    },
    debrief: {
      diagnosis: 'Transport mains-power loss during VA circulatory support',
      causalChain: [
        'The console changes to battery automatically while continued circulatory support remains time-critical.',
        'Battery percentage does not replace a verified alternate source and prepared backup system.',
      ],
      correctWorkflow: [
        'Recognize the power source and restore verified AC.',
        'Confirm flow, pressures, perfusion and right-arm monitoring. Backup-console and emergency-drive readiness is a bedside obligation this simulator does not represent or credit.',
      ],
      safetyNotes: [
        'Recognition and readiness are taught here; hands-on emergency-drive practice is a bedside obligation this simulator does not represent.',
      ],
    },
    evidenceIds: [
      'ifu-console-workflow',
      'ecmo-book-ch9',
      'elso-circuit-2022',
      'elso-adult-va-2021',
      'bounded-educational-model',
    ],
  }),
  scenario({
    id: 'va-mixed-circulation-capstone',
    supportMode: 'va',
    family: 'capstone',
    stationId: 'assessment',
    title: 'VA mixed-circulation integration challenge',
    summary:
      'Integrate circuit, right-arm, lower-body, pulsatility, lung, and perfusion observations without applying a VV off-sweep sequence.',
    clinicalPhase: 'maintenance',
    initialState: {
      circuit: { postOxygenatorSaturation: 99 },
      patient: {
        spo2: 83,
        rightRadialSpo2: 83,
        femoralArterialSpo2: 99,
        pulsePressure: 24,
        aorticValveOpening: true,
        nativeCardiacOutputLpm: 3,
      },
      activeFaults: ['differential-hypoxemia'],
      paused: true,
    },
    timedFaults: [],
    expectation: {
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'inspect',
      correctiveFault: 'differential-hypoxemia',
      acceptableReassessmentTerms: [
        'right radial',
        'post-oxygenator',
        'native lung',
        'pulse pressure',
      ],
    },
    assessmentPolicy: {
      minimumObservationSeconds: 10,
      preserveCircuitBloodFlow: true,
      prohibitSweepZeroWhileFlowing: true,
      requiredTermGroupsByDomain: {
        device: [['flow', 'rpm', 'pressure']],
        circuit: [
          ['post-oxygenator', 'oxygenator'],
          ['femoral', 'lower-body', 'return'],
        ],
        patient: [
          ['right radial', 'right-arm'],
          ['pulse pressure', 'native ejection', 'aortic'],
          ['lung', 'oxygenation'],
          ['perfusion', 'limb'],
        ],
      },
      reassessmentGuidance: {
        device: 'Document circuit flow, RPM, or pressure stability without reducing support.',
        circuit: 'Compare post-oxygenator data with femoral/lower-body return evidence.',
        patient:
          'Integrate right-arm oxygenation, pulsatility/native ejection, lung function, and systemic plus limb perfusion.',
      },
    },
    challengeBrief: {
      title: 'Flow unchanged, patient worse: one presentation, several explanations',
      presentation:
        'Displayed VA flow and the post-oxygenator sample are unchanged, yet the patient looks worse and the right-hand and femoral saturations no longer agree.',
    },
    debrief: {
      diagnosis: 'Peripheral VA differential upper-body oxygenation pattern',
      causalChain: [
        'Reassuring post-oxygenator and lower-body data coexist with low right-arm oxygenation.',
        'Native ejection and poor lung oxygenation create a clinically important mixed-circulation mismatch.',
      ],
      correctWorkflow: [
        'Recognize and verify the upper-body mismatch with independent right-arm data.',
        'Integrate native ejection, lung status, post-oxygenator gas transfer, circuit flow, and perfusion.',
        'Escalate the support strategy under the reviewed local VA protocol; do not use a VV off-sweep trial.',
      ],
      safetyNotes: [
        'VA liberation, unloading-device selection, and cannulation changes remain outside this simulator.',
      ],
    },
    evidenceIds: ['elso-adult-va-2021', 'elso-neuro-monitoring-2024', 'bounded-educational-model'],
  }),
] as const

export const cardiohelpScenarioById = new Map(
  cardiohelpScenarios.map((definition) => [definition.id, definition]),
)

export const cardiohelpScenariosBySupportMode: Readonly<
  Record<SupportMode, readonly ScenarioDefinition[]>
> = {
  vv: cardiohelpScenarios.filter((definition) => definition.supportMode === 'vv'),
  va: cardiohelpScenarios.filter((definition) => definition.supportMode === 'va'),
}

export const cardiohelpCapstonePrerequisiteIdsBySupportMode: Readonly<
  Record<SupportMode, readonly string[]>
> = {
  vv: cardiohelpScenariosBySupportMode.vv
    .filter((definition) => definition.id !== 'vv-off-sweep-capstone')
    .map((definition) => definition.id),
  va: cardiohelpScenariosBySupportMode.va
    .filter((definition) => definition.id !== 'va-mixed-circulation-capstone')
    .map((definition) => definition.id),
}

// Kept as the legacy VV prerequisite list for ProgressV1 compatibility.
export const cardiohelpCapstonePrerequisiteIds = cardiohelpCapstonePrerequisiteIdsBySupportMode.vv

export function isCardiohelpCapstoneUnlocked(
  completedLabs: readonly string[],
  supportMode: SupportMode = 'vv',
): boolean {
  return cardiohelpCapstonePrerequisiteIdsBySupportMode[supportMode].every((id) =>
    completedLabs.includes(id),
  )
}

export const cardiohelpStations = [
  {
    id: 'orientation',
    label: 'Orientation',
    description: 'Console, circuit, sensors, and pre-use sequence',
  },
  {
    id: 'flow-pressure',
    label: 'Flow & pressure',
    description: 'Preload, afterload, and effective support',
  },
  {
    id: 'sweep',
    label: 'Sweep management',
    description: 'CO2, pH, phase, and gas FiO2 discrimination',
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    description: 'Gas, bubble, and transport rounds',
  },
  {
    id: 'assessment',
    label: 'Challenge & sources',
    description: 'Mode-specific integration challenge, causal review, and evidence',
  },
] as const

export const predictionGoals = [
  {
    id: 'initiate-vv-support',
    label: 'Establish effective VV gas-exchange support',
    supportModes: ['vv'],
  },
  {
    id: 'initiate-va-support',
    label: 'Establish effective VA circulatory support',
    supportModes: ['va'],
  },
  {
    id: 'control-hemorrhagic-shock',
    label: 'Control hemorrhage and restore effective preload',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'relieve-obstruction',
    label: 'Relieve obstructive physiology and restore flow',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'restore-effective-support',
    label: 'Restore effective support rather than displayed flow alone',
    supportModes: ['vv'],
  },
  {
    id: 'restore-membrane-function',
    label: 'Restore membrane-lung function',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'restore-vascular-tone',
    label: 'Restore vascular tone and tissue perfusion',
    supportModes: ['va'],
  },
  {
    id: 'protect-cannulated-limb',
    label: 'Restore and protect distal limb perfusion',
    supportModes: ['va'],
  },
  {
    id: 'safe-startup',
    label: 'Establish a safe, verified startup state',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'restore-drainage',
    label: 'Restore stable venous drainage without worsening collapse',
    supportModes: ['vv'],
  },
  {
    id: 'restore-systemic-support',
    label: 'Restore stable VA systemic support without worsening drainage collapse',
    supportModes: ['va'],
  },
  {
    id: 'localize-resistance',
    label: 'Localize circuit resistance before changing support',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'increase-effective-support',
    label: 'Increase effective VV support, not displayed flow alone',
    supportModes: ['vv'],
  },
  {
    id: 'protect-upper-body',
    label: 'Protect upper-body oxygen delivery during peripheral VA support',
    supportModes: ['va'],
  },
  {
    id: 'protect-left-heart',
    label: 'Recognize and escalate concerning LV-loading cues',
    supportModes: ['va'],
  },
  {
    id: 'improve-acidemia',
    label: 'Improve acute hypercapnic acidemia',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'preserve-compensation',
    label: 'Preserve acceptable compensation during maintenance',
    supportModes: ['vv'],
  },
  {
    id: 'restore-gas-transfer',
    label: 'Restore membrane gas transfer',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'prevent-air-return',
    label: 'Prevent air return and correct the bubble source',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'maintain-continuous-support',
    label: 'Maintain continuous support during transport',
    supportModes: ['vv', 'va'],
  },
  {
    id: 'test-native-lung',
    label: 'Test native lung readiness without reducing VV circuit flow',
    supportModes: ['vv'],
  },
] as const

/**
 * The authored words for the other two thirds of a prediction.
 *
 * These lists are the vocabulary of a commitment, not a property of the surface that collects it.
 * They sat inside `PracticeCasePlayer` while it was the only place a commitment was made or read
 * back; the Learn teaching panels now echo the learner's own committed triple, and two copies of a
 * label list is how the two surfaces start describing the same choice differently. Relocated
 * verbatim — same entries, same order, same labels — so the Practice selects render exactly as
 * before.
 */
export const predictionControls: readonly {
  value: PredictionControl
  label: string
  supportModes: readonly SupportMode[]
}[] = [
  { value: 'inspect-circuit', label: 'Inspect circuit / sensors', supportModes: ['vv', 'va'] },
  {
    value: 'assess-upper-body',
    label: 'Review right-arm oxygenation and mixed circulation',
    supportModes: ['va'],
  },
  {
    value: 'assess-lv-loading',
    label: 'Review pulsatility, aortic valve, LV, and lungs',
    supportModes: ['va'],
  },
  { value: 'rpm', label: 'Pump RPM', supportModes: ['vv', 'va'] },
  { value: 'sweep', label: 'External sweep flow', supportModes: ['vv', 'va'] },
  { value: 'gas-fio2', label: 'External sweep-gas FiO₂', supportModes: ['vv', 'va'] },
  { value: 'restore-gas', label: 'Restore gas source', supportModes: ['vv', 'va'] },
  { value: 'correct-cause', label: 'Resolve cause before reset', supportModes: ['vv', 'va'] },
  { value: 'restore-power', label: 'Restore verified AC power', supportModes: ['vv', 'va'] },
  { value: 'off-sweep-trial', label: 'VV off-sweep trial', supportModes: ['vv'] },
  {
    value: 'initiate-support',
    label: 'Initiate ECMO with verified settings',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'resuscitate-preload',
    label: 'Restore preload while finding the cause',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'transfuse-and-control',
    label: 'Transfuse and control hemorrhage',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'decompress-chest',
    label: 'Relieve obstructive thoracic/cardiac pressure',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'reposition-cannula',
    label: 'Review and restore cannula position',
    supportModes: ['vv'],
  },
  {
    value: 'exchange-oxygenator',
    label: 'Prepare and exchange the failing component',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'vasopressor',
    label: 'Treat vascular tone and reassess perfusion',
    supportModes: ['va'],
  },
  {
    value: 'restore-distal-perfusion',
    label: 'Restore cannulated-limb perfusion',
    supportModes: ['va'],
  },
  {
    value: 'isolate-circuit',
    label: 'Clamp to isolate the circuit and come off support',
    supportModes: ['vv', 'va'],
  },
]

export const predictionDirections: readonly { value: PredictionDirection; label: string }[] = [
  { value: 'increase', label: 'Increase' },
  { value: 'decrease', label: 'Decrease' },
  { value: 'hold', label: 'Hold / do not chase the number' },
  { value: 'inspect', label: 'Inspect and localize first' },
  { value: 'restore', label: 'Restore source' },
  { value: 'off', label: 'Turn off while maintaining blood flow' },
  { value: 'gas-exchange', label: 'Improve oxygenation / CO₂ clearance' },
  { value: 'perfusion', label: 'Improve systemic perfusion' },
  { value: 'drainage', label: 'Restore effective venous drainage' },
  { value: 'temporary', label: 'Temporize while the cause remains' },
  { value: 'definitive', label: 'Definitively resolve the cause' },
]

export function validateScenarioRegistry(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const definition of cardiohelpScenarios) {
    if (ids.has(definition.id)) errors.push(`Duplicate scenario id: ${definition.id}`)
    ids.add(definition.id)
    if (definition.objectives.reduce((sum, objective) => sum + objective.points, 0) !== 100) {
      errors.push(`${definition.id}: objective points must total 100`)
    }
    if (!definition.evidenceIds.length) errors.push(`${definition.id}: missing evidence`)
    if (!definition.allowedActions.includes('COMMIT_PREDICTION')) {
      errors.push(`${definition.id}: prediction is not allowed`)
    }
    if (!definition.allowedActions.includes('COMMIT_REASSESSMENT')) {
      errors.push(`${definition.id}: reassessment is not allowed`)
    }
    if (definition.supportMode === 'va' && !definition.id.startsWith('va-')) {
      errors.push(`${definition.id}: VA scenario IDs must use the va- prefix`)
    }
    for (const timedFault of definition.timedFaults) {
      if (timedFault.atSecond < 1)
        errors.push(`${definition.id}: timed fault must occur after start`)
    }
  }

  return errors
}
