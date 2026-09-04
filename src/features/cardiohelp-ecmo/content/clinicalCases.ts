import type {
  ClinicalCaseDefinition,
  ClinicalInterventionDefinition,
  ScenarioDefinition,
  ScenarioObjective,
  SimulationAction,
  SupportMode,
  UnsafeActionPenalty,
} from '../engine/types'
import { getClinicalPracticeSupport } from './practiceSupport'

const clinicalObjectives: readonly ScenarioObjective[] = [
  { id: 'goal', category: 'goal', label: 'Identify the immediate patient goal', points: 15 },
  {
    id: 'control',
    category: 'control',
    label: 'Choose the correct first clinical move',
    points: 20,
  },
  { id: 'direction', category: 'direction', label: 'Predict the physiologic response', points: 15 },
  { id: 'cause', category: 'cause', label: 'Treat the underlying cause', points: 25 },
  {
    id: 'reassessment',
    category: 'reassessment',
    label: 'Reassess patient, circuit, and device',
    points: 25,
  },
]

const clinicalUnsafeActions: readonly UnsafeActionPenalty[] = [
  {
    id: 'rpm-during-collapse',
    label: 'Escalated RPM during drainage collapse',
    points: 50,
    critical: true,
  },
  {
    id: 'air-correction-before-isolation',
    label:
      'De-aired or corrected circuit air before both near-patient clamps had isolated the patient',
    points: 50,
    critical: true,
  },
  {
    id: 'support-reduction-on-battery',
    label: 'Reduced pump support on reserve power to stretch the runtime',
    points: 50,
    critical: true,
  },
  {
    id: 'rpm-during-recirculation',
    label: 'Increased speed against established recirculation',
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
    id: 'unsafe-clinical-shortcut',
    label: 'Used an unsafe shortcut before correcting the cause',
    points: 40,
    critical: true,
  },
  {
    id: 'ineffective-treatment-delay',
    label: 'Repeated an ineffective treatment while the patient deteriorated',
    points: 20,
    critical: false,
  },
  {
    id: 'unsafe-unclamp-before-deair',
    label: 'Opened a circuit clamp before the air source was corrected and cleared',
    points: 50,
    critical: true,
  },
]

const clinicalActions: readonly SimulationAction['type'][] = [
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
  'ACK_ALARM',
  'TOGGLE_CIRCUIT_CLAMP',
  'PERFORM_CHECK',
  'APPLY_CLINICAL_INTERVENTION',
  'START_ECMO',
  'COMMIT_PREDICTION',
  'COMMIT_REASSESSMENT',
  'REQUEST_HINT',
  'REVEAL_DEBRIEF',
  'TOGGLE_ALARM_AUDIO',
]

function intervention(definition: ClinicalInterventionDefinition): ClinicalInterventionDefinition {
  return definition
}

function clinicalScenario(
  definition: Omit<
    ScenarioDefinition,
    | 'allowedActions'
    | 'objectives'
    | 'unsafeActionPenalties'
    | 'successPredicates'
    | 'terminalRules'
  >,
): ScenarioDefinition {
  const practiceSupport = getClinicalPracticeSupport(definition.id)
  return {
    ...definition,
    allowedActions: clinicalActions,
    objectives: clinicalObjectives,
    unsafeActionPenalties: clinicalUnsafeActions,
    successPredicates: [
      'The learner commits an initial clinical plan before acting.',
      'Required interventions and case-specific ECMO actions are completed.',
      'The patient, circuit, and device response is observed before debrief.',
    ],
    terminalRules: [
      'The deterministic patient can improve, remain unstable, or worsen after each intervention.',
      'The debrief explains both the preferred sequence and the consequences of the learner actions.',
      'Mastery requires at least 80% with no critical safety error.',
    ],
    reassessment: practiceSupport?.reassessment,
    hints: practiceSupport?.hints ?? [],
  }
}

const vvInitiationCase: ClinicalCaseDefinition = {
  kind: 'initiation',
  sourceCase: 'New initiation case synthesized from the attached curriculum and adult VV guidance',
  setting: 'Medical ICU · refractory severe ARDS',
  presentationTitle: 'Falling SpO₂ and rising PaCO₂ despite optimized conventional support',
  patientLabel: '48-year-old with refractory hypoxemic and hypercapnic respiratory failure',
  openingNarrative:
    'Despite optimized conventional support, oxygenation and ventilation are worsening. The multidisciplinary ECMO team has selected femoral-femoral VV support and supplied case-specific initiation orders.',
  decisionPrompt:
    'Complete readiness checks, configure the ordered console and gas settings, then initiate support and reassess gas exchange.',
  learningObjectives: [
    'Decide from the device self-check, a hand walk from drainage cannula to return cannula, the gas path and the bedside data whether the whole system is ready to connect or only the console is.',
    'Decide from the written case orders, rather than a remembered default, what speed, sweep and oxygen fraction the console and blender should show before forward flow begins.',
    'Decide from SpO₂, PaCO₂ and pH set against the displayed flow whether the new support is effective or only running.',
  ],
  initialSupportStatus: 'not-on-ecmo',
  initialTrajectory: 'critical',
  data: [
    { label: 'SpO₂', value: '78%', trend: 'critical' },
    { label: 'PaCO₂ / pH', value: '63 mmHg / 7.18', trend: 'critical' },
    { label: 'MAP', value: '70 mmHg', trend: 'stable' },
    { label: 'Work of breathing', value: 'High despite invasive support', trend: 'critical' },
  ],
  interventions: [
    intervention({
      id: 'vv-readiness-check',
      label: 'Complete VV readiness and tip-to-tip check',
      category: 'ecmo',
      description:
        'Verify circuit, sensors, gas, power, cannulas, team roles, and backup readiness.',
      effect: 'diagnostic',
      response: 'The circuit, gas path, power supply, cannulas, and backup plan are verified.',
      reveals: ['No circuit defect is found; the prepared VV circuit is ready to connect.'],
    }),
    intervention({
      id: 'vv-connect-circuit',
      label: 'Confirm cannulation and connect the prepared VV circuit',
      category: 'procedure',
      description:
        'Represent completion of supervised cannulation and connection; this is not a cannulation trainer.',
      effect: 'supportive',
      response: 'Drainage and return limbs are connected with the circuit still stopped.',
      prerequisites: ['vv-readiness-check'],
    }),
    intervention({
      id: 'vv-pressure-escalation',
      label: 'Increase ventilator pressure instead of starting ECMO',
      category: 'resuscitation',
      description:
        'Continue escalating injurious conventional support while the prepared circuit remains idle.',
      effect: 'harmful',
      response:
        'Airway pressure rises without adequate gas-exchange recovery; the patient deteriorates.',
      patch: { patient: { airwayPressure: 39, spo2: 74, pH: 7.12 } },
      penalty: { id: 'unsafe-clinical-shortcut', points: 40, critical: true },
    }),
  ],
  requiredInterventionIds: ['vv-readiness-check', 'vv-connect-circuit'],
  initiationTargets: {
    rpm: 3200,
    sweepLpm: 4,
    fio2: 1,
    rpmTolerance: 100,
    sweepTolerance: 0.2,
    fio2Tolerance: 0.01,
  },
  completionResponse:
    'Forward VV flow is established. SpO₂ and PaCO₂ begin moving toward the case targets while the team reassesses the patient and circuit.',
  deteriorationResponse:
    'Without effective extracorporeal gas exchange, hypoxemia, hypercapnia, and acidemia continue to worsen.',
}

const vaInitiationCase: ClinicalCaseDefinition = {
  kind: 'initiation',
  sourceCase: 'New initiation case synthesized from the attached curriculum and adult VA guidance',
  setting: 'Cardiac ICU · refractory cardiogenic shock',
  presentationTitle:
    'Critically low MAP, rising lactate and a narrow pulse pressure despite conventional resuscitation',
  patientLabel: '56-year-old with severe biventricular failure and progressive shock',
  openingNarrative:
    'MAP remains critically low despite conventional resuscitation, lactate is rising, and the shock team has selected peripheral femoral VA support with case-specific initiation orders.',
  decisionPrompt:
    'Complete readiness checks, configure the ordered support, start VA ECMO, and verify both perfusion and upper-body oxygenation.',
  learningObjectives: [
    'Decide from MAP, lactate, pulse pressure and urine output whether the organs are short of blood because the pump is failing or because the vessels are, and which of those the selected support can take over.',
    'Decide, before the pump turns, what has to be true of the device, the tubing, the arterial return, the leg below the cannula and the team, and why a device self-check alone does not establish any of it.',
    'Decide from MAP, lactate and urine output set against right-arm saturation, pulsatility and the cannulated leg whether the support is doing what the orders intended or only moving the flow number.',
  ],
  initialSupportStatus: 'not-on-ecmo',
  initialTrajectory: 'critical',
  data: [
    { label: 'MAP', value: '43 mmHg', trend: 'critical' },
    { label: 'Lactate', value: '7.2 mmol/L and rising', trend: 'critical' },
    { label: 'Pulse pressure', value: '8 mmHg', trend: 'critical' },
    { label: 'Urine output', value: '10 mL/h', trend: 'critical' },
  ],
  interventions: [
    intervention({
      id: 'va-readiness-check',
      label: 'Complete VA readiness and tip-to-tip check',
      category: 'ecmo',
      description:
        'Verify circuit, arterial return, distal-limb plan, gas, power, and rescue resources.',
      effect: 'diagnostic',
      response:
        'The circuit and arterial return pathway are verified; distal-limb monitoring is established.',
      reveals: ['The prepared VA circuit is ready and right-arm monitoring is available.'],
    }),
    intervention({
      id: 'va-connect-circuit',
      label: 'Confirm cannulation and connect the prepared VA circuit',
      category: 'procedure',
      description:
        'Represent supervised cannulation and connection; this module does not teach cannulation technique.',
      effect: 'supportive',
      response:
        'Venous drainage and femoral arterial return are connected with the circuit stopped.',
      prerequisites: ['va-readiness-check'],
    }),
    intervention({
      id: 'va-vasopressor-only-delay',
      label: 'Escalate vasopressor without initiating planned support',
      category: 'medication',
      description:
        'Temporarily raise vascular tone while delaying the already selected rescue strategy.',
      effect: 'temporizing',
      response:
        'MAP rises briefly, but lactate and oliguria continue to worsen because forward perfusion remains inadequate.',
      patch: { patient: { meanArterialPressure: 50 } },
      penalty: { id: 'ineffective-treatment-delay', points: 20, critical: false },
    }),
  ],
  requiredInterventionIds: ['va-readiness-check', 'va-connect-circuit'],
  initiationTargets: {
    rpm: 3400,
    sweepLpm: 3,
    fio2: 1,
    rpmTolerance: 100,
    sweepTolerance: 0.2,
    fio2Tolerance: 0.01,
  },
  completionResponse:
    'Forward VA flow is established. MAP begins to recover, lactate stops rising, and upper- and lower-body perfusion are reassessed.',
  deteriorationResponse:
    'Without effective mechanical circulatory support, MAP, urine output, and tissue perfusion continue to decline.',
}

export const clinicalPracticeScenarios: readonly ScenarioDefinition[] = [
  clinicalScenario({
    id: 'clinical-vv-initiation-ards',
    family: 'initiation',
    stationId: 'orientation',
    supportMode: 'vv',
    title: 'Initiate VV ECMO for refractory severe ARDS',
    summary: vvInitiationCase.openingNarrative,
    clinicalPhase: 'startup',
    clinicalCase: vvInitiationCase,
    initialState: {
      device: { pumpRunning: false, rpmSetpoint: 2800 },
      gas: { sweepLpm: 2, fio2: 0.6 },
      patient: {
        spo2: 78,
        rightRadialSpo2: 78,
        femoralArterialSpo2: 78,
        paCO2: 63,
        pH: 7.18,
        respiratoryRate: 34,
        workOfBreathing: 'high',
        airwayPressure: 34,
        lactate: 3.2,
      },
      activeFaults: ['ecmo-not-initiated'],
      paused: true,
    },
    timedFaults: [],
    expectation: {
      goalId: 'initiate-vv-support',
      control: 'initiate-support',
      direction: 'gas-exchange',
      correctiveFault: 'ecmo-not-initiated',
      acceptableReassessmentTerms: ['flow', 'spo2', 'paco2', 'ph'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis: 'Refractory respiratory failure requiring planned VV ECMO initiation',
      causalChain: [
        'The primary problem is oxygenation and ventilation failure with preserved circulatory pressure.',
        'A verified circuit and case-specific settings are required before initiating extracorporeal gas exchange.',
        'The response must be judged from the patient, circuit, blood gas, and ventilator—not flow alone.',
      ],
      correctWorkflow: [
        'Confirm the multidisciplinary indication, cannulation plan, circuit, gas, power, monitoring, and backup readiness.',
        'Configure the case-specific RPM, sweep, and gas FiO₂ orders before starting support.',
        'Establish forward flow, then reassess oxygenation, PaCO₂/pH, drainage, pressures, and native ventilation.',
      ],
      safetyNotes: [
        'The displayed start settings are simulated case orders, not universal targets.',
        'Cannulation and initiation require supervised team training and local protocols.',
      ],
    },
    evidenceIds: [
      'elso-adult-vv-2021',
      'ecmo-book-ch16',
      'ecmo-book-ch17',
      'ecmo-book-ch18',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'clinical-vv-occult-hemorrhage',
    family: 'patient-deterioration',
    stationId: 'flow-pressure',
    supportMode: 'vv',
    title: 'Occult hemorrhage with drainage insufficiency',
    summary:
      'Chatter, falling flow, hypotension, low CVP, and a falling hemoglobin develop without obvious external bleeding.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'deterioration',
      sourceCase: 'Attached ECMO CASES.docx · scenario 3',
      setting: 'ECMO ICU · day 4 of VV support',
      presentationTitle: 'New low flow, tachycardia and hypotension on day 4 of VV support',
      patientLabel: 'Patient with new low flow, tachycardia, and hypotension',
      openingNarrative:
        'Flow falls despite increasing pump demand. pVen becomes progressively negative, the drainage line chatters, CVP is low, and hemoglobin has fallen from 9.4 to 6.8 g/dL.',
      decisionPrompt:
        'Stabilize drainage while finding and controlling the source of blood loss. A temporary response is not the same as definitive treatment.',
      learningObjectives: [
        'Decide from CVP, the hemoglobin trend and the behavior of the line whether falling flow is a circuit problem or a volume problem before choosing a first move.',
        'Decide from a low CVP beside a falling hemoglobin whether a low-volume state is fluid depletion or ongoing blood loss, and where a hidden source can sit around a cannulated circuit.',
        'Decide, when a pressor lifts MAP or a bolus steadies flow for a moment, whether the numbers improved because the cause was treated or only because it was masked.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'deteriorating',
      data: [
        { label: 'Flow / pVen', value: '2.7 L/min / −165 mmHg', trend: 'critical' },
        { label: 'MAP / CVP', value: '54 / 3 mmHg', trend: 'critical' },
        { label: 'Hemoglobin', value: '6.8 g/dL', trend: 'critical' },
        { label: 'Lactate', value: '4.8 mmol/L', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'hemorrhage-reduce-rpm',
          label: 'Temporarily reduce pump demand',
          category: 'ecmo',
          description:
            'Reduce repeated suction events while preserving the safest achievable support.',
          effect: 'supportive',
          response:
            'pVen becomes less negative and chatter eases, but the patient remains hypovolemic.',
          patch: { device: { rpmSetpoint: 3200 } },
          simulatorAction: {
            control: 'rpm',
            targetValue: 3200,
            tolerance: 50,
            comparison: 'at-most',
            visibility: 'prompted',
            instruction: 'Reduce pump demand to 3200 RPM on the CARDIOHELP console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'hemorrhage-search',
          label: 'Expose the patient and search for occult bleeding',
          category: 'assessment',
          description:
            'Inspect cannulation sites, posterior dressings, chest tubes, abdomen, and other hidden sources.',
          effect: 'diagnostic',
          response:
            'A saturated posterior femoral-cannulation dressing and expanding flank ecchymosis are found.',
          reveals: ['Occult cannulation-site/retroperitoneal hemorrhage is identified.'],
        }),
        intervention({
          id: 'hemorrhage-crystalloid',
          label: 'Give crystalloid volume',
          category: 'resuscitation',
          description:
            'Provide a temporizing preload challenge without replacing oxygen-carrying capacity.',
          effect: 'temporizing',
          response: 'Flow and MAP improve briefly, then fall again because bleeding continues.',
          patch: { patient: { meanArterialPressure: 61, centralVenousPressure: 5 } },
        }),
        intervention({
          id: 'hemorrhage-prbc',
          label: 'Transfuse red cells with hemostatic resuscitation',
          category: 'resuscitation',
          description:
            'Represent blood-product support according to the local massive-hemorrhage protocol.',
          effect: 'supportive',
          response: 'Hemoglobin, preload, and MAP improve, but bleeding must still be controlled.',
          patch: {
            circuit: { hemoglobin: 8.7, hematocrit: 26 },
            patient: { meanArterialPressure: 65, centralVenousPressure: 6 },
          },
        }),
        intervention({
          id: 'hemorrhage-vasopressor',
          label: 'Escalate vasopressor alone',
          category: 'medication',
          description:
            'Treat the pressure while leaving severe blood loss and drainage limitation uncorrected.',
          effect: 'temporizing',
          response: 'MAP rises transiently, but flow, hemoglobin, and lactate continue to worsen.',
          patch: { patient: { meanArterialPressure: 60 } },
          penalty: { id: 'ineffective-treatment-delay', points: 20, critical: false },
        }),
        intervention({
          id: 'hemorrhage-source-control',
          label: 'Activate definitive hemorrhage control',
          category: 'procedure',
          description:
            'Mobilize procedural or surgical source control and modify anticoagulation through local protocols.',
          effect: 'definitive',
          response:
            'Bleeding is controlled; drainage, MAP, and lactate begin to recover after resuscitation.',
          prerequisites: ['hemorrhage-search', 'hemorrhage-prbc'],
        }),
      ],
      requiredInterventionIds: [
        'hemorrhage-reduce-rpm',
        'hemorrhage-search',
        'hemorrhage-prbc',
        'hemorrhage-source-control',
      ],
      completionResponse:
        'Hemorrhage is controlled and hemostatic resuscitation restores effective preload and organ perfusion.',
      deteriorationResponse:
        'Ongoing blood loss drives worsening drainage collapse, anemia, shock, and lactate elevation.',
    },
    initialState: {
      device: { rpmSetpoint: 3600 },
      circuit: { hemoglobin: 6.8, hematocrit: 20 },
      patient: {
        meanArterialPressure: 54,
        heartRate: 124,
        centralVenousPressure: 3,
        lactate: 4.8,
        urineOutputMlHr: 12,
      },
      activeFaults: ['hemorrhagic-hypovolemia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'control-hemorrhagic-shock',
      control: 'transfuse-and-control',
      direction: 'drainage',
      correctiveFault: 'hemorrhagic-hypovolemia',
      acceptableReassessmentTerms: ['flow', 'pven', 'hemoglobin', 'map', 'lactate'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis: 'Occult hemorrhagic hypovolemia causing preload-limited VV drainage',
      causalChain: [
        'Blood loss reduces venous return and oxygen-carrying capacity.',
        'Pump demand exceeds available drainage, producing negative pVen, chatter, and falling flow.',
        'Volume or vasopressor alone may briefly change numbers but cannot stop hemorrhage.',
      ],
      correctWorkflow: [
        'Reduce repeated suction events while rapidly assessing the patient and full cannulation pathway.',
        'Find the bleeding source and activate hemostatic blood-product support.',
        'Control the source, address anticoagulation through local protocols, and trend flow, hemoglobin, MAP, and lactate.',
      ],
      safetyNotes: [
        'Do not reflexively escalate RPM or give unlimited crystalloid during drainage collapse.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch16',
      'ecmo-book-ch17',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'clinical-vv-tension-pneumothorax',
    family: 'patient-deterioration',
    stationId: 'flow-pressure',
    supportMode: 'vv',
    title: 'Tension pneumothorax causing obstructive low flow',
    summary:
      'Low ECMO flow, negative pVen, hypotension, high CVP, rising airway pressure, and absent unilateral lung sliding develop suddenly.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'deterioration',
      sourceCase: 'Attached ECMO CASES.docx · scenario 4',
      setting: 'ECMO ICU · sudden deterioration during lung-protective ventilation',
      presentationTitle:
        'Sudden low flow and hypotension with a high CVP during lung-protective ventilation on VV',
      patientLabel: 'VV ECMO patient with acute obstructive physiology',
      openingNarrative:
        'The patient becomes hypotensive as flow falls and the drainage line chatters. CVP rises to 18 mmHg, peak airway pressure rises, and right-sided lung sliding is absent.',
      decisionPrompt:
        'Treat the obstructive patient-level cause rather than repeatedly manipulating the circuit.',
      learningObjectives: [
        'Decide from CVP set against pVen whether a fall in flow is starved of blood or blocked from filling before choosing a first move.',
        'Decide from the airway-pressure trend and lung sliding on each side whether the block sits inside the chest or somewhere on the circuit.',
        'Decide, once the block is located in the chest, whether fluid, a pressor or any change on the console addresses the cause or only buys minutes.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'MAP / CVP', value: '48 / 18 mmHg', trend: 'critical' },
        { label: 'Flow / pVen', value: '2.4 L/min / −150 mmHg', trend: 'critical' },
        { label: 'Airway pressure', value: '38 cmH₂O', trend: 'critical' },
        { label: 'Lung ultrasound', value: 'Absent right lung sliding', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'tension-pocus',
          label: 'Perform immediate bedside ultrasound assessment',
          category: 'assessment',
          description: 'Integrate lung sliding, hemodynamics, and the drainage pattern.',
          effect: 'diagnostic',
          response:
            'Absent right lung sliding with obstructive physiology confirms a tension pattern.',
          reveals: ['Right tension pneumothorax is the likely cause.'],
        }),
        intervention({
          id: 'tension-volume',
          label: 'Give crystalloid volume',
          category: 'resuscitation',
          description: 'Attempt to treat the low flow as simple hypovolemia.',
          effect: 'temporizing',
          response:
            'There is minimal and short-lived improvement because intrathoracic obstruction persists.',
          patch: { patient: { meanArterialPressure: 51 } },
          penalty: { id: 'ineffective-treatment-delay', points: 20, critical: false },
        }),
        intervention({
          id: 'tension-vasopressor',
          label: 'Escalate vasopressor',
          category: 'medication',
          description: 'Temporarily support pressure while the obstructive cause remains.',
          effect: 'temporizing',
          response: 'MAP rises slightly, but venous return and ECMO drainage continue to collapse.',
          patch: { patient: { meanArterialPressure: 53 } },
        }),
        intervention({
          id: 'tension-decompress',
          label: 'Perform emergency pleural decompression',
          category: 'procedure',
          description: 'Represent immediate decompression followed by definitive pleural drainage.',
          effect: 'definitive',
          response: 'Intrathoracic pressure falls; CVP, pVen, ECMO flow, and MAP begin to recover.',
          patch: { patient: { lungSliding: 'bilateral', airwayPressure: 25 } },
        }),
      ],
      requiredInterventionIds: ['tension-decompress'],
      completionResponse:
        'Pleural decompression restores venous return, ECMO drainage, and systemic pressure.',
      deteriorationResponse:
        'Untreated tension physiology progresses to worsening shock, flow loss, and hypoxemia.',
    },
    initialState: {
      patient: {
        meanArterialPressure: 48,
        centralVenousPressure: 18,
        airwayPressure: 38,
        lungSliding: 'absent-right',
        lactate: 4.2,
      },
      activeFaults: ['tension-pneumothorax'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'relieve-obstruction',
      control: 'decompress-chest',
      direction: 'drainage',
      correctiveFault: 'tension-pneumothorax',
      acceptableReassessmentTerms: ['flow', 'pven', 'cvp', 'map', 'sliding'],
    },
    assessmentPolicy: { minimumObservationSeconds: 3 },
    debrief: {
      diagnosis: 'Tension pneumothorax impairing venous return and ECMO drainage',
      causalChain: [
        'Rising intrathoracic pressure obstructs venous return.',
        'High CVP coexists with negative drainage pressure and low ECMO flow.',
        'Circuit-only adjustments cannot relieve the intrathoracic obstruction.',
      ],
      correctWorkflow: [
        'Recognize the tension pattern and call for immediate help.',
        'Decompress without avoidable delay, then establish definitive pleural drainage.',
        'Reassess MAP, CVP, pVen, flow, airway pressure, and lung findings.',
      ],
      safetyNotes: [
        'This button represents an emergency team procedure; it does not teach procedural technique.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch16',
      'ecmo-book-ch17',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'clinical-vv-recirculation-migration',
    family: 'patient-deterioration',
    stationId: 'flow-pressure',
    supportMode: 'vv',
    title: 'Refractory hypoxemia from VV recirculation',
    summary:
      'Systemic saturation falls after repositioning despite normal post-oxygenator gas exchange and unchanged displayed flow.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'deterioration',
      sourceCase: 'Attached ECMO CASES.docx · scenario 1',
      setting: 'ECMO ICU · after patient repositioning',
      presentationTitle:
        'Falling SpO₂ after repositioning while displayed flow and post-oxygenator saturation stay high',
      patientLabel: 'Stable VV patient with paradoxically worsening oxygenation',
      openingNarrative:
        'SpO₂ falls from 90% to 78%. Flow remains 4.5 L/min and post-oxygenator oxygenation is excellent. Drainage blood appears brighter, and increasing RPM makes systemic saturation worse.',
      decisionPrompt:
        'Differentiate recirculation from membrane-lung failure and correct the cannula relationship.',
      learningObjectives: [
        'Decide from patient SpO₂ set against the pre- and post-oxygenator saturations whether a fall in oxygenation sits at the oxygenator or between the two limbs inside the patient.',
        'Decide from an unchanged displayed flow beside a rising drainage-side saturation whether the flow number still describes the support the patient actually receives.',
        'Decide, when more speed makes systemic saturation worse rather than better, what that response says about where the returned blood is going before the console is touched again.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'deteriorating',
      data: [
        { label: 'SpO₂', value: '78% and falling', trend: 'critical' },
        { label: 'Displayed flow', value: '4.5 L/min', trend: 'stable' },
        { label: 'Pre-oxygenator saturation', value: '84%', trend: 'warning' },
        { label: 'Post-oxygenator saturation', value: '99%', trend: 'stable' },
      ],
      interventions: [
        intervention({
          id: 'recirc-compare-gases',
          label: 'Compare patient, pre-, and post-oxygenator gases',
          category: 'assessment',
          description:
            'Test whether the membrane lung is working and whether drainage blood is unexpectedly oxygenated.',
          effect: 'diagnostic',
          response:
            'Post-oxygenator gas transfer is intact while drainage-line oxygenation is abnormally high.',
          reveals: ['The pattern favors recirculation rather than membrane-lung failure.'],
        }),
        intervention({
          id: 'recirc-ultrasound',
          label: 'Assess cannula position with ultrasound/echo',
          category: 'assessment',
          description: 'Assess cannula separation and the direction of the return jet.',
          effect: 'diagnostic',
          response: 'The return cannula has migrated toward the drainage cannula.',
          reveals: ['Cannula migration is confirmed.'],
        }),
        intervention({
          id: 'recirc-increase-rpm',
          label: 'Increase RPM to chase displayed flow',
          category: 'ecmo',
          description: 'Increase pump demand without correcting cannula position.',
          effect: 'harmful',
          response:
            'More oxygenated return blood is recaptured; systemic saturation falls further.',
          patch: { device: { rpmSetpoint: 3900 }, patient: { spo2: 74 } },
          // The mechanism-specific penalty rather than the generic shortcut, so the debrief names
          // what actually went wrong. It shares its id with the engine's RPM-escalation guard, which
          // deduplicates by id — one action is charged once, whether the learner reaches it through
          // this intervention card or by turning the rotary control on the console.
          penalty: { id: 'rpm-during-recirculation', points: 50, critical: true },
          simulatorAction: {
            control: 'rpm',
            targetValue: 3900,
            comparison: 'at-least',
            visibility: 'hidden',
            instruction: 'Increase RPM on the console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'recirc-reposition',
          label: 'Arrange image-guided cannula repositioning',
          category: 'procedure',
          description:
            'Restore appropriate cannula separation and return direction under expert imaging guidance.',
          effect: 'definitive',
          response:
            'Effective extracorporeal flow rises and systemic saturation begins to recover.',
          prerequisites: ['recirc-ultrasound'],
        }),
      ],
      requiredInterventionIds: ['recirc-ultrasound', 'recirc-reposition'],
      completionResponse:
        'Cannula position is corrected and effective VV support improves despite similar displayed flow.',
      deteriorationResponse:
        'Persistent recirculation reduces effective support and can worsen when flow is increased blindly.',
    },
    initialState: {
      device: { rpmSetpoint: 3550 },
      circuit: { preOxygenatorSaturation: 84 },
      patient: { spo2: 78, rightRadialSpo2: 78, femoralArterialSpo2: 78 },
      activeFaults: ['recirculation'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-effective-support',
      control: 'reposition-cannula',
      direction: 'gas-exchange',
      correctiveFault: 'recirculation',
      acceptableReassessmentTerms: ['spo2', 'pre-oxygenator', 'flow', 'cannula'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis: 'VV recirculation caused by cannula migration',
      causalChain: [
        'Oxygenated return blood is recaptured before reaching the systemic circulation.',
        'Displayed flow remains high while effective support falls.',
        'Increasing RPM can increase the recirculated fraction and worsen systemic oxygenation.',
      ],
      correctWorkflow: [
        'Confirm gas delivery and membrane-lung performance.',
        'Compare patient, pre-, and post-oxygenator data and assess cannula position.',
        'Correct cannula position under imaging and reassess effective support.',
      ],
      safetyNotes: [
        'Cannula manipulation requires qualified operators, imaging, and local emergency procedures.',
      ],
    },
    evidenceIds: [
      'ecmo-book-ch9',
      'ecmo-book-ch17',
      'elso-adult-vv-2021',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'clinical-vv-gas-disconnection',
    family: 'clinical-complication',
    stationId: 'troubleshooting',
    supportMode: 'vv',
    title: 'Sweep-gas disconnection with rapid hypercapnia',
    summary: 'PaCO₂ rises rapidly with stable pump flow and pressures; oxygenation declines later.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'complication',
      sourceCase: 'Attached ECMO CASES.docx · scenario 2',
      setting: 'ECMO ICU · acute dyssynchrony and tachypnea',
      presentationTitle:
        'Abrupt rise in PaCO₂ and falling pH with RPM, flow and circuit pressures unchanged',
      patientLabel: 'VV patient with abrupt hypercapnic acidemia',
      openingNarrative:
        'PaCO₂ rises from 42 to 88 mmHg and pH falls to 7.12 while RPM, flow, and circuit pressures remain unchanged. SpO₂ initially remains near baseline.',
      decisionPrompt:
        'Find the gas-side failure, restore gas transfer, and avoid confusing sweep with blood flow.',
      learningObjectives: [
        'Decide from a fast-rising PaCO₂ beside unchanged RPM, flow and circuit pressures whether the problem sits on the blood side or the gas side of the oxygenator.',
        'Decide whether more blood flow or more gas flow is the lever for CO₂ when the two are separate controls in separate places.',
        'Decide whether a number set on the blender or gas arriving at the oxygenator inlet is what proves delivery, and what the PaCO₂ trend should then do over time rather than at once.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'PaCO₂ / pH', value: '88 mmHg / 7.12', trend: 'critical' },
        { label: 'Flow / RPM', value: '4.1 L/min / 3200', trend: 'stable' },
        { label: 'Circuit pressures', value: 'Unchanged', trend: 'stable' },
        { label: 'Gas flow', value: 'No flow at oxygenator inlet', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'gas-inspect-path',
          label: 'Inspect the complete gas pathway',
          category: 'assessment',
          description: 'Trace source, blender, flowmeter, tubing, and oxygenator inlet/outlet.',
          effect: 'diagnostic',
          response: 'The sweep tubing is disconnected at the oxygenator gas inlet.',
          reveals: ['A gas-side disconnection is confirmed.'],
        }),
        intervention({
          id: 'gas-increase-rpm',
          label: 'Increase pump RPM',
          category: 'ecmo',
          description:
            'Attempt to treat CO₂ retention with blood flow while sweep remains disconnected.',
          effect: 'harmful',
          response:
            'PaCO₂ does not meaningfully improve and drainage pressure becomes more negative.',
          patch: { device: { rpmSetpoint: 3800 } },
          penalty: { id: 'unsafe-clinical-shortcut', points: 40, critical: true },
          simulatorAction: {
            control: 'rpm',
            targetValue: 3800,
            comparison: 'at-least',
            visibility: 'hidden',
            instruction: 'Increase RPM on the console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'gas-reconnect',
          label: 'Reconnect and independently verify the gas source',
          category: 'circuit',
          description: 'Restore the gas pathway and confirm flow at the oxygenator.',
          effect: 'definitive',
          response: 'Gas transfer resumes; PaCO₂ and pH begin a controlled recovery.',
          patch: { gas: { sourceConnected: true } },
          prerequisites: ['gas-inspect-path'],
          simulatorAction: {
            control: 'restore-gas',
            visibility: 'prompted',
            instruction: 'Reconnect the verified gas source on the external gas panel.',
            target: 'gas-panel',
            controlId: 'cardiohelp-restore-gas-source',
          },
        }),
        intervention({
          id: 'gas-set-sweep',
          label: 'Set the supplied sweep flow',
          category: 'ecmo',
          description: 'Use the external gas blender to restore the case-specific sweep flow.',
          effect: 'supportive',
          response: 'Verified sweep flow is present and membrane CO₂ clearance resumes.',
          patch: { gas: { sweepLpm: 4 } },
          simulatorAction: {
            control: 'sweep',
            targetValue: 4,
            tolerance: 0.1,
            comparison: 'within',
            visibility: 'prompted',
            instruction: 'Set sweep to 4.0 L/min on the external gas blender.',
            target: 'gas-panel',
            controlId: 'cardiohelp-sweep-control',
          },
        }),
      ],
      requiredInterventionIds: ['gas-inspect-path', 'gas-reconnect', 'gas-set-sweep'],
      completionResponse:
        'Sweep gas is restored and PaCO₂ begins improving over simulated time rather than instantly.',
      deteriorationResponse:
        'Gas-side failure causes progressive hypercapnia, acidemia, respiratory distress, and later oxygenation decline.',
    },
    initialState: {
      gas: { sourceConnected: false, sweepLpm: 0 },
      patient: { paCO2: 88, pH: 7.12, respiratoryRate: 34, workOfBreathing: 'high' },
      activeFaults: ['gas-source-interruption'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-gas-transfer',
      control: 'restore-gas',
      direction: 'gas-exchange',
      correctiveFault: 'gas-source-interruption',
      acceptableReassessmentTerms: ['paco2', 'ph', 'sweep', 'flow'],
    },
    assessmentPolicy: { minimumObservationSeconds: 5 },
    debrief: {
      diagnosis: 'Sweep-gas disconnection causing loss of membrane CO₂ clearance',
      causalChain: [
        'Blood flow and circuit pressures remain stable because the pump side is intact.',
        'Without sweep gas, membrane CO₂ clearance collapses.',
        'Restored gas flow produces a time-dependent blood-gas response.',
      ],
      correctWorkflow: [
        'Support native ventilation while tracing the full gas path.',
        'Restore and independently verify gas delivery.',
        'Trend PaCO₂, pH, oxygenation, and post-oxygenator gas transfer during controlled correction.',
      ],
      safetyNotes: ['Sweep adjustments remain external to the CARDIOHELP-i touchscreen.'],
    },
    evidenceIds: [
      'ecmo-book-ch18',
      'elso-circuit-2022',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'clinical-vv-oxygenator-thrombosis',
    family: 'clinical-complication',
    stationId: 'troubleshooting',
    supportMode: 'vv',
    title: 'Oxygenator thrombosis with worsening gas transfer',
    summary:
      'The oxygenator pressure gradient, visible fibrin, hemolysis markers, and hypoxemia worsen together.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'complication',
      sourceCase: 'Attached ECMO CASES.docx · scenarios 12 and 26',
      setting: 'ECMO ICU · progressive circuit dysfunction',
      presentationTitle:
        'Climbing Δp with visible fibrin, falling saturation leaving the circuit and increasing hemolysis markers',
      patientLabel:
        'VV patient with rising membrane resistance and falling post-oxygenator performance',
      openingNarrative:
        'The pressure gradient rises, flow becomes constrained, visible fibrin appears, and post-oxygenator oxygenation falls while hemolysis markers increase.',
      decisionPrompt:
        'Confirm membrane-lung dysfunction, protect the patient, and prepare definitive component exchange.',
      learningObjectives: [
        'Decide from pInt set against pArt and the Δp trend whether flow is being held back between those two readings, beyond pArt or on the drainage side.',
        'Decide from a climbing Δp beside the saturation leaving the circuit and the hemolysis markers whether one sensor has drifted or the component between pInt and pArt is itself failing.',
        'Decide what asking the pump for more speed can and cannot do against a fixed obstruction, and whether the trend or a single number should set the moment to escalate.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'deteriorating',
      data: [
        { label: 'Δp trend', value: 'Rising to 155 mmHg', trend: 'critical' },
        { label: 'Post-oxygenator saturation', value: '88%', trend: 'critical' },
        { label: 'Visible circuit', value: 'Fibrin on oxygenator face', trend: 'critical' },
        { label: 'Hemolysis', value: 'Markers increasing', trend: 'warning' },
      ],
      interventions: [
        intervention({
          id: 'oxygenator-verify',
          label: 'Verify pressures and compare pre/post gases',
          category: 'assessment',
          description: 'Confirm sensor plausibility, resistance, and gas-transfer failure.',
          effect: 'diagnostic',
          response: 'The rising gradient and impaired post-oxygenator gas transfer are confirmed.',
          reveals: ['The membrane lung is failing rather than a single pressure sensor.'],
        }),
        intervention({
          id: 'oxygenator-rpm-chase',
          label: 'Increase RPM to chase flow',
          category: 'ecmo',
          description: 'Increase pump work across a mechanically resistant oxygenator.',
          effect: 'harmful',
          response: 'pInt rises further with little flow benefit and more hemolysis concern.',
          patch: { device: { rpmSetpoint: 4000 } },
          penalty: { id: 'unsafe-clinical-shortcut', points: 40, critical: true },
          simulatorAction: {
            control: 'rpm',
            targetValue: 4000,
            comparison: 'at-least',
            visibility: 'hidden',
            instruction: 'Increase RPM on the console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'oxygenator-prepare-exchange',
          label: 'Prepare replacement circuit and team',
          category: 'circuit',
          description:
            'Mobilize the reviewed emergency exchange process while maintaining support.',
          effect: 'supportive',
          response: 'A primed replacement and trained exchange team are ready.',
          prerequisites: ['oxygenator-verify'],
        }),
        intervention({
          id: 'oxygenator-exchange',
          label: 'Perform supervised oxygenator/circuit exchange',
          category: 'procedure',
          description:
            'Represent definitive component exchange under the local emergency protocol.',
          effect: 'definitive',
          response:
            'Resistance falls, post-oxygenator gas transfer normalizes, and effective flow recovers.',
          prerequisites: ['oxygenator-prepare-exchange'],
        }),
      ],
      requiredInterventionIds: [
        'oxygenator-verify',
        'oxygenator-prepare-exchange',
        'oxygenator-exchange',
      ],
      completionResponse: 'The failing membrane lung is exchanged and circuit function recovers.',
      deteriorationResponse:
        'Untreated thrombosis progresses to impaired gas transfer, flow limitation, and hemolysis.',
    },
    initialState: {
      device: { rpmSetpoint: 3600 },
      circuit: { postOxygenatorSaturation: 88 },
      patient: { spo2: 84 },
      activeFaults: ['oxygenator-resistance'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-membrane-function',
      control: 'exchange-oxygenator',
      direction: 'definitive',
      correctiveFault: 'oxygenator-resistance',
      acceptableReassessmentTerms: ['delta', 'pint', 'part', 'flow', 'post-oxygenator'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis: 'Oxygenator thrombosis with rising resistance and impaired membrane function',
      causalChain: [
        'Clot increases resistance across the membrane lung.',
        'Gas transfer and effective flow deteriorate while hemolysis risk rises.',
        'RPM escalation cannot remove the obstruction and may worsen circuit stress.',
      ],
      correctWorkflow: [
        'Verify the full pressure pattern and pre/post gas transfer.',
        'Inspect for clot and mobilize the exchange team early.',
        'Exchange the failing component through the reviewed local process and reassess the patient and circuit.',
      ],
      safetyNotes: [
        'This simulator deliberately does not encode a universal Δp alarm priority or exchange threshold.',
      ],
    },
    evidenceIds: [
      'elso-circuit-2022',
      'ecmo-book-ch9',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'clinical-vv-circuit-air-embolism',
    family: 'clinical-complication',
    stationId: 'troubleshooting',
    supportMode: 'vv',
    title: 'Air entrainment with emergency circuit isolation',
    summary:
      'Air is entrained into the circuit during a bedside line exchange; the bubble intervention stops the pump. Isolate, de-air, then resume support per the current IFU and approved local protocol.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'complication',
      sourceCase:
        'New emergency case synthesized from the attached curriculum and ELSO circuit guidance',
      setting: 'ECMO ICU · VV support, bedside central-line exchange',
      presentationTitle:
        'Bubble alarm and pump stop with air visible in the drainage limb during a bedside line exchange on VV',
      patientLabel: 'VV patient with sudden circuit air and an automatic pump stop',
      openingNarrative:
        'During a central-line exchange, air is entrained into the drainage limb. The bubble intervention alarms, the pump stops, and visible air remains in the circuit.',
      decisionPrompt:
        'Isolate the patient from the circuit, correct and clear the air, then resume support per the current IFU and approved local protocol.',
      learningObjectives: [
        'Decide from a bubble alarm with the pump stopped and both lines still open whether the stop itself has already made the bedside safe or has only paused the flow.',
        'Decide, before anything is opened or restarted, in what order the two lines and the air source have to be dealt with, and what must be true of the tubing before flow is allowed back.',
        'Decide what this simulation stands for and what it leaves out: it shows why the tubing must be clear before flow comes back, and it leaves how flow is resumed to the current IFU and approved local protocol.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'Pump', value: 'Stopped by bubble intervention', trend: 'critical' },
        { label: 'Circuit air', value: 'Visible in the drainage limb', trend: 'critical' },
        { label: 'SpO₂', value: '84% and falling off support', trend: 'critical' },
        { label: 'Clamps', value: 'Both open', trend: 'warning' },
      ],
      interventions: [
        intervention({
          id: 'air-clamp-return',
          label: 'Clamp the return limb near the patient',
          category: 'circuit',
          description:
            'Isolate the patient side first so circuit air cannot reach the return cannula.',
          effect: 'supportive',
          response: 'The return limb is clamped; the patient is isolated from returning air.',
          simulatorAction: {
            control: 'clamp-return',
            visibility: 'prompted',
            instruction: 'On the bedside circuit, close the return-limb clamp near the patient.',
            target: 'circuit',
            controlId: 'cardiohelp-clamp-return',
          },
        }),
        intervention({
          id: 'air-clamp-drainage',
          label: 'Clamp the drainage limb near the patient',
          category: 'circuit',
          description: 'Complete circuit isolation so the team can de-air safely.',
          effect: 'supportive',
          response: 'The drainage limb is clamped; the circuit is fully isolated.',
          prerequisites: ['air-clamp-return'],
          simulatorAction: {
            control: 'clamp-drainage',
            visibility: 'prompted',
            instruction: 'On the bedside circuit, close the drainage-limb clamp near the patient.',
            target: 'circuit',
            controlId: 'cardiohelp-clamp-drainage',
          },
        }),
        intervention({
          id: 'air-support-patient',
          label: 'Support the patient off circuit flow',
          category: 'resuscitation',
          description:
            'Increase conventional ventilation and hemodynamic support while the circuit is isolated.',
          effect: 'supportive',
          response:
            'The patient is temporarily supported conventionally while the circuit is cleared.',
          patch: { patient: { spo2: 87 } },
        }),
        intervention({
          id: 'air-deair',
          label: 'De-air the circuit and correct the source',
          category: 'procedure',
          description:
            'Correct the entrainment source, clear the lines through the reviewed local process, and confirm the circuit is bubble free.',
          effect: 'definitive',
          response: 'The air source is corrected and the circuit is confirmed clear.',
          prerequisites: ['air-clamp-drainage'],
          patch: { circuit: { arterialBubbleDetected: false, bubbleResetRequired: false } },
        }),
        intervention({
          id: 'air-resume-support',
          label: 'Resume support per current IFU and approved local protocol',
          category: 'circuit',
          description:
            'With the source corrected and the circuit confirmed clear, resume support according to the current manufacturer instructions for use (IFU) and your unit’s approved ECMO air-emergency protocol. This bounded simulation action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.',
          effect: 'definitive',
          response:
            'Support resumes as one step; the patient is never left on both open limbs of a stopped circuit.',
          prerequisites: ['air-deair'],
          simulatorAction: {
            control: 'resume-after-bubble',
            visibility: 'prompted',
            instruction:
              'On the bedside circuit, resume support per the current IFU and approved local protocol.',
            target: 'circuit',
            controlId: 'cardiohelp-resume-support',
          },
        }),
        intervention({
          id: 'air-resume-early',
          label: 'Unclamp and restart before de-airing',
          category: 'ecmo',
          description: 'Reopen the circuit while air is still present.',
          effect: 'harmful',
          response: 'Air is driven toward the patient; this is a critical safety error.',
          penalty: { id: 'unsafe-unclamp-before-deair', points: 50, critical: true },
        }),
      ],
      requiredInterventionIds: [
        'air-clamp-return',
        'air-clamp-drainage',
        'air-deair',
        'air-resume-support',
      ],
      completionResponse:
        'The circuit is isolated, de-aired, and support is resumed per the current IFU and approved local protocol; forward flow and oxygenation recover.',
      deteriorationResponse:
        'While air remains in an open circuit, the patient is at embolic risk and support stays interrupted.',
    },
    initialState: {
      device: { pumpRunning: false },
      circuit: { arterialBubbleDetected: true, bubbleResetRequired: true },
      patient: { spo2: 84, respiratoryRate: 30, workOfBreathing: 'high' },
      activeFaults: ['arterial-bubble'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'prevent-air-return',
      control: 'isolate-circuit',
      direction: 'definitive',
      correctiveFault: 'arterial-bubble',
      acceptableReassessmentTerms: ['air', 'clamp', 'isolate', 'flow'],
    },
    assessmentPolicy: { minimumObservationSeconds: 3 },
    debrief: {
      diagnosis:
        'Air entrained into the circuit with an automatic pump stop and a live risk of air reaching the patient',
      causalChain: [
        'Air entrainment triggers the bubble intervention and an automatic pump stop.',
        'The pump stop does not isolate the patient; the near-patient clamps do.',
        'Resuming flow before de-airing risks driving air to the patient.',
      ],
      correctWorkflow: [
        'Clamp the return limb, then the drainage limb, near the patient and support the patient conventionally.',
        'Correct the air source and confirm the circuit is clear.',
        'Resume support per the current IFU and approved local protocol, then reassess. This module teaches the precondition, not the resumption choreography.',
      ],
      safetyNotes: [
        'Isolation is taught explicitly. The clamp, pump, and device-reset choreography for resumption is governed by the current manufacturer IFU and your unit’s approved ECMO air-emergency protocol; this simulation does not teach that choreography.',
        'This is recognition-and-sequence training, not a substitute for supervised circuit-emergency competency.',
      ],
    },
    evidenceIds: [
      'elso-circuit-2022',
      'ifu-console-workflow',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-initiation-shock',
    family: 'initiation',
    stationId: 'orientation',
    supportMode: 'va',
    title: 'Initiate peripheral VA ECMO for refractory cardiogenic shock',
    summary: vaInitiationCase.openingNarrative,
    clinicalPhase: 'startup',
    clinicalCase: vaInitiationCase,
    initialState: {
      device: { pumpRunning: false, rpmSetpoint: 3000 },
      gas: { sweepLpm: 2, fio2: 0.6 },
      patient: {
        meanArterialPressure: 43,
        pulsePressure: 8,
        nativeCardiacOutputLpm: 1.2,
        lactate: 7.2,
        urineOutputMlHr: 10,
        spo2: 86,
        rightRadialSpo2: 86,
        femoralArterialSpo2: 86,
      },
      activeFaults: ['ecmo-not-initiated'],
      paused: true,
    },
    timedFaults: [],
    expectation: {
      goalId: 'initiate-va-support',
      control: 'initiate-support',
      direction: 'perfusion',
      correctiveFault: 'ecmo-not-initiated',
      acceptableReassessmentTerms: ['flow', 'map', 'lactate', 'right-arm'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis: 'Refractory cardiogenic shock requiring planned VA ECMO initiation',
      causalChain: [
        'Native output is inadequate for organ perfusion.',
        'Peripheral VA flow can restore circulatory support but creates mode-specific upper-body, LV-loading, and limb-perfusion risks.',
        'Initiation is incomplete until patient and circuit effects are reassessed.',
      ],
      correctWorkflow: [
        'Confirm indication, cannulation, distal-perfusion, circuit, gas, power, and rescue readiness.',
        'Configure the supplied case orders and establish forward flow.',
        'Reassess MAP, lactate, pulsatility, aortic-valve opening, right-arm oxygenation, and the cannulated limb.',
      ],
      safetyNotes: [
        'The start settings are simulated orders, not universal VA targets.',
        'Cannulation and initiation require supervised multidisciplinary training.',
      ],
    },
    evidenceIds: [
      'elso-adult-va-2021',
      'elso-circuit-2022',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-differential-hypoxemia',
    family: 'patient-deterioration',
    stationId: 'flow-pressure',
    supportMode: 'va',
    title: 'Differential hypoxemia during cardiac recovery',
    summary:
      'Right-arm oxygenation falls while femoral and post-oxygenator samples remain reassuring.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'deterioration',
      sourceCase: 'Attached ECMO CASES.docx · scenario 8',
      setting: 'Cardiac ICU · peripheral VA support with recovering LV ejection',
      presentationTitle:
        'Right-hand SpO₂ falling as pulse pressure widens, while femoral and post-oxygenator samples stay reassuring',
      patientLabel: 'VA patient with new upper-body hypoxemia',
      openingNarrative:
        'Pulse pressure increases as native LV ejection recovers, but severe lung dysfunction persists. Femoral oxygenation is excellent while right-hand SpO₂ falls to 78%.',
      decisionPrompt:
        'Recognize mixed-circulation mismatch and protect cerebral and coronary oxygen delivery.',
      learningObjectives: [
        'Decide from the upper-body SpO₂ set against femoral and post-oxygenator samples whether a fall belongs to the oxygenator, to the lungs or to where the two blood streams meet.',
        'Decide from a widening pulse pressure beside the lung findings which stream is gaining ground in the aorta, and why a femoral sample cannot settle what the head and the coronaries are receiving.',
        'Decide, when more pump speed leaves the upper body unchanged, whether the lungs, the configuration or the flow is the lever, and which of those this module can and cannot represent.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'Right-hand SpO₂', value: '78%', trend: 'critical' },
        { label: 'Femoral saturation', value: '99%', trend: 'stable' },
        { label: 'Pulse pressure', value: '28 mmHg', trend: 'warning' },
        { label: 'Post-oxygenator', value: 'Normal gas transfer', trend: 'stable' },
      ],
      interventions: [
        intervention({
          id: 'differential-right-arm',
          label: 'Obtain right-arm oxygenation and cerebral data',
          category: 'assessment',
          description: 'Use upper-body data rather than a femoral sample alone.',
          effect: 'diagnostic',
          response:
            'Right radial oxygenation and cerebral NIRS confirm severe upper-body hypoxemia.',
          reveals: ['Differential hypoxemia is confirmed.'],
        }),
        intervention({
          id: 'differential-more-rpm',
          label: 'Increase RPM without assessing both circulations',
          category: 'ecmo',
          description:
            'Chase total flow without addressing native-lung oxygenation or the mixing region.',
          effect: 'harmful',
          response:
            'Femoral oxygenation remains excellent while right-arm oxygenation remains critically low.',
          patch: { device: { rpmSetpoint: 3900 } },
          penalty: { id: 'ineffective-treatment-delay', points: 20, critical: false },
          simulatorAction: {
            control: 'rpm',
            targetValue: 3900,
            comparison: 'at-least',
            visibility: 'hidden',
            instruction: 'Increase RPM on the console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'differential-native-lung',
          label: 'Optimize native-lung oxygenation and ventilation',
          category: 'resuscitation',
          description: 'Address the poorly oxygenated native cardiac output.',
          effect: 'supportive',
          response:
            'Right-arm oxygenation improves partially as native-lung gas exchange improves.',
          patch: { patient: { rightRadialSpo2: 86, spo2: 86 } },
        }),
        intervention({
          id: 'differential-escalate-config',
          label: 'Escalate to the reviewed configuration strategy',
          category: 'procedure',
          description:
            'Activate expert evaluation for a configuration change when upper-body hypoxemia persists.',
          effect: 'definitive',
          response:
            'The support strategy is revised and upper-body oxygen delivery begins to recover.',
          prerequisites: ['differential-right-arm', 'differential-native-lung'],
        }),
      ],
      requiredInterventionIds: [
        'differential-right-arm',
        'differential-native-lung',
        'differential-escalate-config',
      ],
      completionResponse:
        'Upper-body oxygen delivery recovers after native-lung optimization and expert support revision.',
      deteriorationResponse:
        'Cerebral and coronary hypoxemia worsen despite reassuring femoral data.',
    },
    initialState: {
      device: { rpmSetpoint: 3400 },
      patient: {
        rightRadialSpo2: 78,
        spo2: 78,
        femoralArterialSpo2: 99,
        pulsePressure: 28,
        nativeCardiacOutputLpm: 3.5,
        pulmonaryCongestion: 'marked',
      },
      activeFaults: ['differential-hypoxemia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'gas-exchange',
      correctiveFault: 'differential-hypoxemia',
      acceptableReassessmentTerms: ['right-arm', 'femoral', 'pulse pressure', 'lung'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis: 'Peripheral VA differential hypoxemia during native cardiac recovery',
      causalChain: [
        'Recovering LV ejection sends poorly oxygenated native-lung blood to the upper body.',
        'Retrograde femoral VA blood continues to oxygenate the lower body.',
        'Femoral samples can therefore conceal cerebral and coronary hypoxemia.',
      ],
      correctWorkflow: [
        'Confirm right-arm and cerebral oxygenation.',
        'Integrate native ejection, lung function, circuit performance, and the mixing region.',
        'Optimize the native lung and escalate support configuration through the reviewed local pathway.',
      ],
      safetyNotes: [
        'Configuration changes and LV-unloading decisions remain outside this simulator.',
      ],
    },
    evidenceIds: [
      'elso-adult-va-2021',
      'elso-neuro-monitoring-2024',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-tamponade',
    family: 'patient-deterioration',
    stationId: 'flow-pressure',
    supportMode: 'va',
    title: 'Postcardiotomy tamponade with low VA flow',
    summary:
      'Low flow, negative drainage pressure, high CVP, hypotension, and reduced chest-drain output develop together.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'deterioration',
      sourceCase: 'Attached ECMO CASES.docx · scenario 10',
      setting: 'Postcardiotomy ICU · peripheral VA support',
      presentationTitle:
        'Low VA flow, negative pVen, high CVP and an abrupt drop in chest-drain output after heart surgery',
      patientLabel: 'VA patient with obstructive low flow after cardiac surgery',
      openingNarrative:
        'VA flow falls as pVen becomes negative. CVP rises, MAP falls, and mediastinal-drain output abruptly decreases despite ongoing bleeding concern.',
      decisionPrompt:
        'Recognize obstructive cardiac physiology and activate definitive decompression.',
      learningObjectives: [
        'Decide from CVP set against pVen whether a fall in VA flow is starved of blood or blocked from filling before choosing a first move.',
        'Decide from an abrupt fall in chest-drain output after heart surgery, beside a high CVP and a narrow pulse pressure, whether the block sits around the heart, in the chest or in the tubing.',
        'Decide what fluid and a pressor can and cannot do for a heart that cannot fill, and whether a focused echo should delay the call for help or run alongside it.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'Flow / pVen', value: '2.3 L/min / −145 mmHg', trend: 'critical' },
        { label: 'MAP / CVP', value: '46 / 20 mmHg', trend: 'critical' },
        { label: 'Drain output', value: 'Abruptly decreased', trend: 'warning' },
        { label: 'Pulse pressure', value: '6 mmHg', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'tamponade-echo',
          label: 'Perform focused echocardiography and surgical assessment',
          category: 'assessment',
          description: 'Assess chamber compression and integrate the postoperative drain pattern.',
          effect: 'diagnostic',
          response: 'Pericardial collection and chamber compression are identified.',
          reveals: ['Postcardiotomy tamponade is confirmed.'],
        }),
        intervention({
          id: 'tamponade-volume',
          label: 'Give volume and continue observing',
          category: 'resuscitation',
          description: 'Temporarily increase preload without relieving compression.',
          effect: 'temporizing',
          response: 'Flow changes little and hypotension rapidly recurs.',
          patch: { patient: { meanArterialPressure: 50 } },
          penalty: { id: 'ineffective-treatment-delay', points: 20, critical: false },
        }),
        intervention({
          id: 'tamponade-vasopressor',
          label: 'Escalate vasopressor',
          category: 'medication',
          description: 'Support pressure while the obstructive cause remains.',
          effect: 'temporizing',
          response: 'MAP rises transiently while flow and filling remain constrained.',
          patch: { patient: { meanArterialPressure: 52 } },
        }),
        intervention({
          id: 'tamponade-decompress',
          label: 'Activate emergent surgical decompression',
          category: 'procedure',
          description:
            'Represent definitive reopening/drainage through the local postcardiotomy emergency pathway.',
          effect: 'definitive',
          response: 'Cardiac compression is relieved; CVP falls and VA flow and MAP recover.',
          prerequisites: ['tamponade-echo'],
        }),
      ],
      requiredInterventionIds: ['tamponade-echo', 'tamponade-decompress'],
      completionResponse:
        'Surgical decompression restores filling, ECMO drainage, and systemic perfusion.',
      deteriorationResponse:
        'Untreated tamponade progresses to flow loss and cardiovascular collapse.',
    },
    initialState: {
      patient: {
        meanArterialPressure: 46,
        centralVenousPressure: 20,
        pulsePressure: 6,
        lactate: 5.6,
      },
      activeFaults: ['tamponade'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'relieve-obstruction',
      control: 'decompress-chest',
      direction: 'perfusion',
      correctiveFault: 'tamponade',
      acceptableReassessmentTerms: ['flow', 'pven', 'cvp', 'map', 'echo'],
    },
    assessmentPolicy: { minimumObservationSeconds: 3 },
    debrief: {
      diagnosis: 'Postcardiotomy tamponade causing obstructive VA drainage failure',
      causalChain: [
        'Pericardial compression impairs cardiac filling and venous drainage.',
        'High CVP coexists with negative pVen and low ECMO flow.',
        'Volume and vasopressor can only temporize a mechanical obstruction.',
      ],
      correctWorkflow: [
        'Recognize the postoperative obstructive pattern.',
        'Use focused imaging without delaying the surgical emergency pathway.',
        'Relieve compression and reassess drainage, flow, MAP, CVP, and bleeding.',
      ],
      safetyNotes: ['This module represents team activation, not surgical technique.'],
    },
    evidenceIds: [
      'elso-adult-va-2021',
      'ecmo-book-ch17',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-vasoplegia',
    family: 'patient-deterioration',
    stationId: 'flow-pressure',
    supportMode: 'va',
    title: 'Recovered cardiac function with persistent vasoplegia',
    summary:
      'EF and pulsatility improve, but warm hypotension and rising lactate persist despite adequate VA flow.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'deterioration',
      sourceCase: 'Attached ECMO CASES.docx · scenario 23',
      setting: 'Cardiac ICU · septic cardiomyopathy recovering on VA support',
      presentationTitle:
        'Warm hypotension and a climbing lactate with a full pulse pressure and steady VA flow',
      patientLabel: 'VA patient with warm shock despite recovered native ejection',
      openingNarrative:
        'EF has recovered to about 45%, the aortic valve opens each beat, pulse pressure is 25 mmHg, and VA flow is 4.5 L/min. MAP remains 50–55 mmHg with warm extremities and rising lactate.',
      decisionPrompt:
        'Distinguish vasoplegia from inadequate ECMO flow and treat vascular tone and the underlying septic process.',
      learningObjectives: [
        'Decide from a steady VA flow, a full pulse pressure and an aortic valve that opens on every beat, set against a low MAP, whether the shortfall is too little flow or too little vascular tone before choosing a first move.',
        'Decide from warm extremities, a climbing lactate and fever which shock physiology fits, and why the pump cannot supply what the vessels are failing to hold.',
        'Decide what asking the pump for more speed does to pVen and the line when the heart is already ejecting, and which endpoints show the cause itself is being treated rather than the number.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'deteriorating',
      data: [
        { label: 'MAP', value: '52 mmHg', trend: 'critical' },
        { label: 'VA flow', value: '4.5 L/min', trend: 'stable' },
        { label: 'Pulse pressure', value: '25 mmHg', trend: 'stable' },
        { label: 'Lactate', value: '5.1 mmol/L and rising', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'vasoplegia-echo',
          label: 'Perform focused echo and perfusion assessment',
          category: 'assessment',
          description:
            'Confirm recovered native function, adequate flow, and a low-resistance shock pattern.',
          effect: 'diagnostic',
          response:
            'Native ejection is improved and the circuit is not flow-limited; the pattern is distributive.',
          reveals: ['Persistent vasoplegia is more likely than pump-flow failure.'],
        }),
        intervention({
          id: 'vasoplegia-more-rpm',
          label: 'Increase RPM to target 6–7 L/min',
          category: 'ecmo',
          description: 'Attempt to correct vascular tone by escalating circuit flow.',
          effect: 'harmful',
          response:
            'pVen becomes more negative and chatter begins without meaningful MAP improvement.',
          patch: { device: { rpmSetpoint: 4200 } },
          penalty: { id: 'unsafe-clinical-shortcut', points: 40, critical: true },
          simulatorAction: {
            control: 'rpm',
            targetValue: 4200,
            comparison: 'at-least',
            visibility: 'hidden',
            instruction: 'Increase RPM on the console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'vasoplegia-pressors',
          label: 'Titrate vasopressor through the local shock protocol',
          category: 'medication',
          description: 'Restore vascular tone while following perfusion endpoints.',
          effect: 'supportive',
          response: 'MAP improves while circuit flow remains stable.',
          patch: { patient: { meanArterialPressure: 65 } },
        }),
        intervention({
          id: 'vasoplegia-source-control',
          label: 'Reassess infection treatment and source control',
          category: 'resuscitation',
          description: 'Address the disease process driving persistent distributive shock.',
          effect: 'definitive',
          response: 'With vascular support and source-control escalation, lactate begins to fall.',
          prerequisites: ['vasoplegia-echo', 'vasoplegia-pressors'],
        }),
      ],
      requiredInterventionIds: [
        'vasoplegia-echo',
        'vasoplegia-pressors',
        'vasoplegia-source-control',
      ],
      completionResponse:
        'Vascular tone and source control improve MAP and tissue perfusion without unnecessary RPM escalation.',
      deteriorationResponse:
        'Persistent vasoplegia drives hypotension and rising lactate despite adequate circuit flow.',
    },
    initialState: {
      device: { rpmSetpoint: 3500 },
      patient: {
        meanArterialPressure: 52,
        pulsePressure: 25,
        nativeCardiacOutputLpm: 4.5,
        aorticValveOpening: true,
        lactate: 5.1,
        temperature: 39.2,
      },
      activeFaults: ['vasoplegia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-vascular-tone',
      control: 'vasopressor',
      direction: 'perfusion',
      correctiveFault: 'vasoplegia',
      acceptableReassessmentTerms: ['map', 'lactate', 'flow', 'pulse pressure'],
    },
    assessmentPolicy: { minimumObservationSeconds: 4 },
    debrief: {
      diagnosis:
        'Persistent septic vasoplegia despite recovered cardiac function and adequate VA flow',
      causalChain: [
        'Native cardiac output and pulsatility have recovered.',
        'Low vascular tone—not inadequate circuit flow—drives warm hypotension.',
        'More RPM can create drainage problems without correcting distributive shock.',
      ],
      correctWorkflow: [
        'Confirm native recovery, perfusion, and circuit adequacy.',
        'Treat vascular tone through the local shock protocol.',
        'Reassess source control, antimicrobial exposure, lactate, and ongoing need for VA support.',
      ],
      safetyNotes: [
        'Medication selection and dosing remain institution-specific and are intentionally not simulated numerically.',
      ],
    },
    evidenceIds: [
      'elso-adult-va-2021',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-limb-ischemia',
    family: 'clinical-complication',
    stationId: 'troubleshooting',
    supportMode: 'va',
    title: 'Cannulated-limb ischemia from distal-perfusion failure',
    summary: 'Unilateral limb NIRS and perfusion worsen while global VA support remains adequate.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'complication',
      sourceCase: 'Attached ECMO CASES.docx · scenario 11',
      setting: 'Cardiac ICU · femoral arterial VA support',
      presentationTitle:
        'A cool, mottled leg beside the arterial cannula with falling limb NIRS while VA flow and MAP hold',
      patientLabel: 'VA patient with new cannulated-leg perfusion deficit',
      openingNarrative:
        'MAP, flow, and oxygenator function are adequate, but the cannulated leg becomes cool and mottled and unilateral limb NIRS falls.',
      decisionPrompt:
        'Recognize a regional perfusion emergency and restore distal flow without changing a functioning circuit blindly.',
      learningObjectives: [
        'Decide from a leg that is cool and mottled beside a normal MAP, flow and oxygenator whether the problem is global or regional before choosing a first move.',
        'Decide from side-to-side NIRS, temperature, color and Doppler signals what one reading on one leg can and cannot establish about the blood supply below the arterial cannula.',
        'Decide what raising total VA flow does and does not do for a leg starved below the cannula, and how the clock on threatened tissue should shape what happens next.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'deteriorating',
      data: [
        { label: 'VA flow / MAP', value: '4.3 L/min / 70 mmHg', trend: 'stable' },
        { label: 'Cannulated-leg NIRS', value: '34% and falling', trend: 'critical' },
        { label: 'Contralateral NIRS', value: '68%', trend: 'stable' },
        { label: 'Limb exam', value: 'Cool, mottled, weak Doppler signal', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'limb-assessment',
          label: 'Perform bilateral limb and distal-perfusion assessment',
          category: 'assessment',
          description:
            'Compare NIRS, temperature, color, capillary refill, Doppler signals, and catheter patency.',
          effect: 'diagnostic',
          response: 'The distal-perfusion catheter is obstructed in the cannulated leg.',
          reveals: ['Regional limb ischemia is confirmed despite adequate systemic support.'],
        }),
        intervention({
          id: 'limb-increase-rpm',
          label: 'Increase VA flow',
          category: 'ecmo',
          description: 'Attempt to treat regional obstruction by increasing total circuit flow.',
          effect: 'harmful',
          response: 'Systemic flow rises slightly, but distal-limb perfusion remains threatened.',
          patch: { device: { rpmSetpoint: 3900 } },
          penalty: { id: 'ineffective-treatment-delay', points: 20, critical: false },
          simulatorAction: {
            control: 'rpm',
            targetValue: 3900,
            comparison: 'at-least',
            visibility: 'hidden',
            instruction: 'Increase RPM on the console.',
            target: 'console',
            controlId: 'cardiohelp-rpm-control',
          },
        }),
        intervention({
          id: 'limb-restore-perfusion',
          label: 'Activate vascular rescue and restore distal perfusion',
          category: 'procedure',
          description:
            'Represent urgent catheter correction or vascular intervention through the local pathway.',
          effect: 'definitive',
          response: 'Distal flow returns; NIRS, temperature, and Doppler signals begin to improve.',
          prerequisites: ['limb-assessment'],
          patch: { patient: { distalLimbPerfusion: 'normal', distalLimbNirs: 62 } },
        }),
      ],
      requiredInterventionIds: ['limb-assessment', 'limb-restore-perfusion'],
      completionResponse: 'Distal perfusion is restored while systemic VA support remains stable.',
      deteriorationResponse:
        'Untreated regional ischemia progresses despite normal global ECMO values.',
    },
    initialState: {
      patient: { distalLimbPerfusion: 'critical', distalLimbNirs: 34, meanArterialPressure: 70 },
      activeFaults: ['distal-limb-ischemia'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'protect-cannulated-limb',
      control: 'restore-distal-perfusion',
      direction: 'definitive',
      correctiveFault: 'distal-limb-ischemia',
      acceptableReassessmentTerms: ['nirs', 'limb', 'doppler', 'flow'],
    },
    assessmentPolicy: { minimumObservationSeconds: 3 },
    debrief: {
      diagnosis: 'Distal-perfusion failure causing cannulated-limb ischemia',
      causalChain: [
        'Femoral arterial return can compromise downstream limb flow.',
        'Global MAP and circuit flow do not exclude regional ischemia.',
        'Delayed restoration risks irreversible tissue injury.',
      ],
      correctWorkflow: [
        'Compare both limbs and assess the distal-perfusion pathway.',
        'Activate vascular and ECMO resources urgently.',
        'Restore distal flow and trend NIRS, Doppler signals, exam, and systemic support.',
      ],
      safetyNotes: [
        'The intervention button represents specialist rescue, not catheter manipulation instruction.',
      ],
    },
    evidenceIds: [
      'elso-adult-va-2021',
      'elso-circuit-2022',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-oxygenator-thrombosis',
    family: 'clinical-complication',
    stationId: 'troubleshooting',
    supportMode: 'va',
    title: 'VA oxygenator thrombosis with falling support',
    summary:
      'Rising membrane resistance and impaired post-oxygenator gas transfer threaten systemic support.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'complication',
      sourceCase: 'Attached ECMO CASES.docx · scenario 12',
      setting: 'Cardiac ICU · progressive VA circuit dysfunction',
      presentationTitle:
        'Climbing Δp and visible fibrin with flow constrained at the same RPM and a falling MAP on VA',
      patientLabel: 'VA patient with oxygenator resistance and worsening perfusion',
      openingNarrative:
        'The oxygenator gradient rises, post-oxygenator performance falls, and flow becomes constrained at the same RPM while MAP and right-arm oxygenation decline.',
      decisionPrompt:
        'Confirm the failing component and execute the reviewed exchange pathway before systemic support collapses.',
      learningObjectives: [
        'Decide from pInt set against pArt and the Δp trend whether VA flow is being held back between those two readings, beyond pArt or on the drainage side.',
        'Decide from a climbing Δp beside a falling MAP, visible fibrin and a falling saturation leaving the circuit whether one sensor has drifted or the component between pInt and pArt is itself failing, and why on VA that is a circulation problem and not only a gas one.',
        'Decide what a pressor buys and what it cannot fix while the component fails, and what has to be standing ready before a circulation-critical part is swapped.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'Δp trend', value: 'Rising to 160 mmHg', trend: 'critical' },
        { label: 'Post-oxygenator saturation', value: '86%', trend: 'critical' },
        { label: 'MAP', value: '56 mmHg and falling', trend: 'critical' },
        { label: 'Circuit inspection', value: 'Visible fibrin', trend: 'critical' },
      ],
      interventions: [
        intervention({
          id: 'va-oxygenator-verify',
          label: 'Verify pressure pattern and pre/post gases',
          category: 'assessment',
          description: 'Confirm membrane resistance and gas-transfer failure.',
          effect: 'diagnostic',
          response: 'Sensor plausibility is confirmed and the membrane lung is failing.',
          reveals: ['Oxygenator thrombosis is confirmed.'],
        }),
        intervention({
          id: 'va-oxygenator-pressors',
          label: 'Escalate vasopressor alone',
          category: 'medication',
          description: 'Temporarily support MAP without restoring circuit performance.',
          effect: 'temporizing',
          response: 'MAP rises briefly while flow and gas transfer continue to decline.',
          patch: { patient: { meanArterialPressure: 60 } },
        }),
        intervention({
          id: 'va-oxygenator-prepare',
          label: 'Prepare backup support and replacement circuit',
          category: 'circuit',
          description:
            'Mobilize immediate exchange resources because VA support is circulation-critical.',
          effect: 'supportive',
          response: 'Backup circulation and a primed replacement circuit are ready.',
          prerequisites: ['va-oxygenator-verify'],
        }),
        intervention({
          id: 'va-oxygenator-exchange',
          label: 'Perform supervised oxygenator/circuit exchange',
          category: 'procedure',
          description: 'Represent the reviewed emergency exchange process.',
          effect: 'definitive',
          response: 'Resistance falls and systemic flow, MAP, and gas transfer recover.',
          prerequisites: ['va-oxygenator-prepare'],
        }),
      ],
      requiredInterventionIds: [
        'va-oxygenator-verify',
        'va-oxygenator-prepare',
        'va-oxygenator-exchange',
      ],
      completionResponse: 'The failing component is exchanged and VA support recovers.',
      deteriorationResponse:
        'Circuit failure progresses rapidly toward loss of circulatory support.',
    },
    initialState: {
      device: { rpmSetpoint: 3700 },
      circuit: { postOxygenatorSaturation: 86 },
      patient: { meanArterialPressure: 56, rightRadialSpo2: 84, lactate: 4.9 },
      activeFaults: ['oxygenator-resistance'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'restore-membrane-function',
      control: 'exchange-oxygenator',
      direction: 'definitive',
      correctiveFault: 'oxygenator-resistance',
      acceptableReassessmentTerms: ['delta', 'flow', 'map', 'post-oxygenator'],
    },
    assessmentPolicy: { minimumObservationSeconds: 3 },
    debrief: {
      diagnosis: 'VA oxygenator thrombosis threatening circulatory and gas-exchange support',
      causalChain: [
        'Clot raises membrane resistance and reduces effective flow.',
        'VA circuit failure immediately threatens systemic perfusion.',
        'Temporizing pressure support cannot restore the failing component.',
      ],
      correctWorkflow: [
        'Confirm the pressure and gas-transfer pattern.',
        'Prepare backup circulation and a replacement circuit early.',
        'Execute the reviewed exchange process and reassess MAP, flow, pressures, and oxygenation.',
      ],
      safetyNotes: ['No universal Δp exchange threshold is encoded.'],
    },
    evidenceIds: [
      'elso-circuit-2022',
      'elso-adult-va-2021',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
  clinicalScenario({
    id: 'va-clinical-circuit-air-embolism',
    family: 'clinical-complication',
    stationId: 'troubleshooting',
    supportMode: 'va',
    title: 'VA circuit air with emergency arterial isolation',
    summary:
      'Air is entrained into the VA circuit; the bubble intervention stops the pump while the arterial return threatens direct embolism. Isolate, de-air, then resume support per the current IFU and approved local protocol.',
    clinicalPhase: 'maintenance',
    clinicalCase: {
      kind: 'complication',
      sourceCase:
        'New emergency case synthesized from the attached curriculum and ELSO circuit guidance',
      setting: 'Cardiac ICU · peripheral VA support, connector loosened during repositioning',
      presentationTitle:
        'Bubble alarm and pump stop after a drainage connector loosens during repositioning on VA',
      patientLabel: 'VA patient with circuit air, pump stop, and interrupted circulatory support',
      openingNarrative:
        'A drainage-limb connector loosens during repositioning and entrains air. The bubble intervention stops the pump, interrupting VA circulatory support with visible air in the circuit.',
      decisionPrompt:
        'Isolate the arterial circulation, support the patient conventionally, correct and clear the air, then resume VA support per the current IFU and approved local protocol.',
      learningObjectives: [
        'Decide from a bubble alarm with the pump stopped and both lines still open whether the stop itself has already made the bedside safe or has only paused a flow that was carrying the circulation.',
        'Decide, before anything is opened or restarted, in what order the two lines and the air source have to be dealt with on a VA run, and what must be true of the tubing before flow is allowed back.',
        'Decide what this simulation stands for and what it leaves out: it shows why the tubing must be clear before flow comes back, and it leaves how VA flow is resumed to the current IFU and approved local protocol.',
      ],
      initialSupportStatus: 'on-ecmo',
      initialTrajectory: 'critical',
      data: [
        { label: 'Pump', value: 'Stopped by bubble intervention', trend: 'critical' },
        { label: 'Circuit air', value: 'Visible near the drainage connector', trend: 'critical' },
        { label: 'MAP', value: '48 mmHg off circuit flow', trend: 'critical' },
        { label: 'Clamps', value: 'Both open', trend: 'warning' },
      ],
      interventions: [
        intervention({
          id: 'va-air-clamp-return',
          label: 'Clamp the arterial return limb near the patient',
          category: 'circuit',
          description:
            'Isolate the arterial circulation first; circuit air in the return limb is a direct embolic threat.',
          effect: 'supportive',
          response:
            'The arterial return limb is clamped; the patient is isolated from circuit air.',
          simulatorAction: {
            control: 'clamp-return',
            visibility: 'prompted',
            instruction: 'On the bedside circuit, close the return-limb clamp near the patient.',
            target: 'circuit',
            controlId: 'cardiohelp-clamp-return',
          },
        }),
        intervention({
          id: 'va-air-clamp-drainage',
          label: 'Clamp the drainage limb near the patient',
          category: 'circuit',
          description: 'Complete circuit isolation before de-airing.',
          effect: 'supportive',
          response: 'The drainage limb is clamped; the circuit is fully isolated.',
          prerequisites: ['va-air-clamp-return'],
          simulatorAction: {
            control: 'clamp-drainage',
            visibility: 'prompted',
            instruction: 'On the bedside circuit, close the drainage-limb clamp near the patient.',
            target: 'circuit',
            controlId: 'cardiohelp-clamp-drainage',
          },
        }),
        intervention({
          id: 'va-air-support-patient',
          label: 'Support the patient off circuit flow',
          category: 'resuscitation',
          description:
            'Escalate conventional hemodynamic support and ventilation while VA support is interrupted.',
          effect: 'supportive',
          response: 'MAP is temporarily supported conventionally while the circuit is cleared.',
          patch: { patient: { meanArterialPressure: 55 } },
        }),
        intervention({
          id: 'va-air-deair',
          label: 'De-air the circuit and correct the source',
          category: 'procedure',
          description:
            'Secure the loosened connector, clear the lines through the reviewed local process, and confirm the circuit is bubble free.',
          effect: 'definitive',
          response:
            'The connector is secured, the air source corrected, and the circuit confirmed clear.',
          prerequisites: ['va-air-clamp-drainage'],
          patch: { circuit: { arterialBubbleDetected: false, bubbleResetRequired: false } },
        }),
        intervention({
          id: 'va-air-resume-support',
          label: 'Resume support per current IFU and approved local protocol',
          category: 'circuit',
          description:
            'With the source corrected and the circuit confirmed clear, resume venoarterial support according to the current manufacturer instructions for use (IFU) and your unit’s approved ECMO air-emergency protocol. This bounded simulation action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.',
          effect: 'definitive',
          response:
            'Support resumes as one step; the patient is never left on both open limbs of a stopped circuit.',
          prerequisites: ['va-air-deair'],
          simulatorAction: {
            control: 'resume-after-bubble',
            visibility: 'prompted',
            instruction:
              'On the bedside circuit, resume support per the current IFU and approved local protocol.',
            target: 'circuit',
            controlId: 'cardiohelp-resume-support',
          },
        }),
        intervention({
          id: 'va-air-resume-early',
          label: 'Unclamp and restart before de-airing',
          category: 'ecmo',
          description: 'Reopen the arterial circuit while air is still present.',
          effect: 'harmful',
          response:
            'Air is driven toward the arterial circulation; this is a critical safety error.',
          penalty: { id: 'unsafe-unclamp-before-deair', points: 50, critical: true },
        }),
      ],
      requiredInterventionIds: [
        'va-air-clamp-return',
        'va-air-clamp-drainage',
        'va-air-deair',
        'va-air-resume-support',
      ],
      completionResponse:
        'The circuit is isolated, de-aired, and support is resumed per the current IFU and approved local protocol; VA support, MAP, and perfusion recover.',
      deteriorationResponse:
        'While air remains in an open circuit, the patient faces arterial embolism and absent circulatory support.',
    },
    initialState: {
      device: { pumpRunning: false },
      circuit: { arterialBubbleDetected: true, bubbleResetRequired: true },
      patient: {
        meanArterialPressure: 48,
        lactate: 4.4,
        spo2: 88,
        rightRadialSpo2: 88,
        femoralArterialSpo2: 88,
      },
      activeFaults: ['arterial-bubble'],
    },
    timedFaults: [],
    expectation: {
      goalId: 'prevent-air-return',
      control: 'isolate-circuit',
      direction: 'definitive',
      correctiveFault: 'arterial-bubble',
      acceptableReassessmentTerms: ['air', 'clamp', 'isolate', 'flow', 'map'],
    },
    assessmentPolicy: { minimumObservationSeconds: 3 },
    debrief: {
      diagnosis:
        'Air entrained into the VA circuit with an automatic pump stop and a live risk of arterial air reaching the patient',
      causalChain: [
        'A loosened drainage connector entrains air and triggers the bubble intervention with a pump stop.',
        'On VA support, circuit air in the return limb threatens the arterial circulation directly.',
        'Resuming flow before de-airing risks systemic arterial embolism.',
      ],
      correctWorkflow: [
        'Clamp the arterial return limb, then the drainage limb, near the patient; support the patient conventionally.',
        'Secure the connector, correct the air source, and confirm the circuit is clear.',
        'Resume venoarterial support per the current IFU and approved local protocol, then reassess perfusion. Where clamp opening, pump restart and console reset fall relative to one another is set by those documents, not by this module.',
      ],
      safetyNotes: [
        'Isolation is taught explicitly. The clamp, pump, and device-reset choreography for resumption is governed by the current manufacturer IFU and your unit’s approved ECMO air-emergency protocol; this simulation does not teach that choreography.',
        'This is recognition-and-sequence training, not a substitute for supervised circuit-emergency competency.',
      ],
    },
    evidenceIds: [
      'elso-circuit-2022',
      'elso-adult-va-2021',
      'attached-ecmo-case-curriculum',
      'bounded-educational-model',
    ],
  }),
] as const

export const clinicalPracticeScenarioById = new Map(
  clinicalPracticeScenarios.map((definition) => [definition.id, definition]),
)

export const clinicalPracticeScenariosBySupportMode: Readonly<
  Record<SupportMode, readonly ScenarioDefinition[]>
> = {
  vv: clinicalPracticeScenarios.filter((definition) => definition.supportMode === 'vv'),
  va: clinicalPracticeScenarios.filter((definition) => definition.supportMode === 'va'),
}

export const clinicalPracticeStations = [
  {
    id: 'orientation',
    label: 'Start ECMO',
    description: 'Readiness, settings, initiation, and first reassessment',
  },
  {
    id: 'flow-pressure',
    label: 'Patient deterioration',
    description: 'Treat the patient and circuit as one system',
  },
  {
    id: 'troubleshooting',
    label: 'Complications',
    description: 'Gas, oxygenator, limb, and circuit emergencies',
  },
] as const

export function validateClinicalPracticeRegistry(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const definition of clinicalPracticeScenarios) {
    if (ids.has(definition.id)) errors.push(`Duplicate clinical case id: ${definition.id}`)
    ids.add(definition.id)
    if (!definition.clinicalCase) errors.push(`${definition.id}: missing clinical case definition`)
    if (definition.supportMode === 'va' && !definition.id.startsWith('va-')) {
      errors.push(`${definition.id}: VA clinical case IDs must use the va- prefix`)
    }
    const interventionIds = new Set(definition.clinicalCase?.interventions.map((item) => item.id))
    for (const requiredId of definition.clinicalCase?.requiredInterventionIds ?? []) {
      if (!interventionIds.has(requiredId))
        errors.push(`${definition.id}: missing required intervention ${requiredId}`)
    }
    if (!definition.reassessment) {
      errors.push(`${definition.id}: missing structured reassessment`)
    } else {
      for (const domain of ['device', 'circuit', 'patient'] as const) {
        const question = definition.reassessment[domain]
        const optionIds = new Set(question.options.map((item) => item.id))
        if (question.options.length < 3) {
          errors.push(`${definition.id}: ${domain} reassessment needs at least three options`)
        }
        if (optionIds.size !== question.options.length) {
          errors.push(`${definition.id}: duplicate ${domain} reassessment option`)
        }
        if (!optionIds.has(question.correctOptionId)) {
          errors.push(`${definition.id}: missing correct ${domain} reassessment option`)
        }
      }
    }
    if ((definition.hints?.length ?? 0) < 2) {
      errors.push(`${definition.id}: requires at least two scored clues`)
    }
    const learningObjectives = definition.clinicalCase?.learningObjectives ?? []
    if (
      learningObjectives.length !== 3 ||
      learningObjectives.some((objective) => !objective.trim())
    ) {
      errors.push(`${definition.id}: requires exactly three learning objectives`)
    }
    for (const hint of definition.hints ?? []) {
      if (hint.penalty <= 0) errors.push(`${definition.id}: clue penalties must be positive`)
    }
    if (definition.objectives.reduce((sum, objective) => sum + objective.points, 0) !== 100) {
      errors.push(`${definition.id}: objective points must total 100`)
    }
  }
  return errors
}
