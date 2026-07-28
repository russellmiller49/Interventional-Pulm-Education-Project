import type {
  IcuPatientState,
  IcuResponseBooleanMetric,
  IcuResponseNumericMetric,
  IcuResponsePredicate,
  IcuResponseTarget,
  IcuScenarioDefinition,
  IcuScenarioInterventionDefinition,
  IcuScoreDomain,
  IcuTherapyId,
} from '../engine/types'
import { parseIcuScenarioDefinition } from './schema'

type PatientOverrides = {
  adultAgeYears?: number
  weightKg?: number
  predictedBodyWeightKg?: number
  bodySurfaceAreaM2?: number
  drivers?: Partial<IcuPatientState['drivers']>
  hemodynamics?: Partial<IcuPatientState['hemodynamics']>
  respiratory?: Partial<IcuPatientState['respiratory']>
  renal?: Partial<IcuPatientState['renal']>
  hematology?: Partial<IcuPatientState['hematology']>
  perfusion?: Partial<IcuPatientState['perfusion']>
}

function makePatient(syntheticPatientId: string, override: PatientOverrides): IcuPatientState {
  return {
    syntheticPatientId,
    adultAgeYears: override.adultAgeYears ?? 58,
    weightKg: override.weightKg ?? 82,
    predictedBodyWeightKg: override.predictedBodyWeightKg ?? 70,
    bodySurfaceAreaM2: override.bodySurfaceAreaM2 ?? 1.95,
    drivers: {
      vasoplegiaSeverity: 0,
      leftVentricularFailureSeverity: 0,
      rightVentricularFailureSeverity: 0,
      pulmonaryVascularObstructionSeverity: 0,
      tamponadePressureMmHg: 0,
      lungInjurySeverity: 0,
      acuteKidneyInjurySeverity: 0,
      bleedingRateMlHour: 0,
      infectionBurden: 0,
      ...override.drivers,
    },
    hemodynamics: {
      heartRateBpm: 92,
      mapMmHg: 72,
      systolicMmHg: 104,
      diastolicMmHg: 56,
      cardiacOutputLMin: 4.8,
      nativeCardiacOutputLMin: 4.8,
      effectiveSystemicFlowLMin: 4.8,
      rapMmHg: 7,
      pawpMmHg: 10,
      meanPapMmHg: 20,
      systemicVascularResistanceDynSecCm5: 1_100,
      pulmonaryVascularResistanceWU: 2,
      circulatingVolumeMl: 4_360,
      leftVentricularContractility: 1,
      rightVentricularContractility: 1,
      pericardialPressureMmHg: 0,
      ...override.hemodynamics,
    },
    respiratory: {
      intubated: false,
      spontaneousRatePerMin: 20,
      complianceMlCmH2O: 55,
      resistanceCmH2OPerLps: 10,
      shuntFraction: 0.08,
      deadSpaceFraction: 0.3,
      oxygenConsumptionMlMin: 250,
      co2ProductionMlMin: 210,
      paO2MmHg: 85,
      paCO2MmHg: 40,
      bicarbonateMmolL: 24,
      pH: 7.4,
      spo2Percent: 96,
      meanAirwayPressureCmH2O: 3,
      plateauPressureCmH2O: 0,
      minuteVentilationLMin: 8,
      prone: false,
      ...override.respiratory,
    },
    renal: {
      creatinineMgDl: 1,
      bunMgDl: 18,
      sodiumMmolL: 139,
      potassiumMmolL: 4.1,
      bicarbonateMmolL: 24,
      urineOutputMlHour: 55,
      cumulativeUrineMl: 0,
      cumulativeCrrtRemovalMl: 0,
      ...override.renal,
    },
    hematology: {
      hemoglobinGdl: 11,
      hematocritPercent: 33,
      plateletCountK: 190,
      inr: 1.1,
      cumulativeBloodLossMl: 0,
      cumulativeCrystalloidMl: 0,
      cumulativeBloodProductMl: 0,
      ...override.hematology,
    },
    perfusion: {
      lactateMmolL: 1.8,
      temperatureC: 37,
      oxygenDeliveryMlMin: 700,
      oxygenExtractionRatio: 0.3,
      capillaryRefillSeconds: 2,
      mottlingScore: 0,
      ...override.perfusion,
    },
    medications: { vasopressorTier: 0, inotropeTier: 0, sedationTier: 0 },
    sourceControlCompleted: false,
    reperfusionCompleted: false,
    tamponadeDrained: false,
    antimicrobialsAdministered: false,
  }
}

const scenarioEvidence = ['ICU-SCENARIO-MODEL', 'ICU-HEMO-CORE'] as const

const absoluteTarget = (value: number): IcuResponseTarget => ({ kind: 'absolute', value })
const initialDeltaTarget = (delta: number): IcuResponseTarget => ({
  kind: 'initial-delta',
  delta,
})
const initialRatioTarget = (ratio: number): IcuResponseTarget => ({
  kind: 'initial-ratio',
  ratio,
})

function numericResponse(
  id: string,
  label: string,
  metric: IcuResponseNumericMetric,
  comparison: 'gte' | 'lte',
  target: IcuResponseTarget,
  evidenceIds: readonly string[] = scenarioEvidence,
): IcuResponsePredicate {
  return { id, label, kind: 'numeric', metric, comparison, target, evidenceIds }
}

function booleanResponse(
  id: string,
  label: string,
  metric: IcuResponseBooleanMetric,
  expected = true,
  evidenceIds: readonly string[] = scenarioEvidence,
): IcuResponsePredicate {
  return { id, label, kind: 'boolean', metric, expected, evidenceIds }
}

function therapyRunningResponse(
  id: string,
  label: string,
  therapy: IcuTherapyId,
  expected: boolean,
  evidenceIds: readonly string[] = scenarioEvidence,
): IcuResponsePredicate {
  return { id, label, kind: 'therapy-running', therapy, expected, evidenceIds }
}

function therapyNeverStartedResponse(
  id: string,
  label: string,
  therapy: IcuTherapyId,
  evidenceIds: readonly string[] = scenarioEvidence,
): IcuResponsePredicate {
  return { id, label, kind: 'therapy-never-started', therapy, evidenceIds }
}

function noActiveAlarmResponse(
  id: string,
  label: string,
  subsystems: readonly (IcuTherapyId | 'patient')[],
  evidenceIds: readonly string[] = scenarioEvidence,
): IcuResponsePredicate {
  return { id, label, kind: 'no-active-critical-alarm', subsystems, evidenceIds }
}

function noActiveDeviceLimitationResponse(
  id: string,
  label: string,
  subsystems: readonly IcuTherapyId[],
  evidenceIds: readonly string[] = scenarioEvidence,
): IcuResponsePredicate {
  return { id, label, kind: 'no-active-device-limitation', subsystems, evidenceIds }
}

function action(
  actionId: string,
  label: string,
  kind: IcuScenarioInterventionDefinition['kind'],
  scoringDomains: readonly IcuScoreDomain[],
  evidenceIds: readonly string[] = scenarioEvidence,
  criticalErrorId: string | null = null,
): IcuScenarioInterventionDefinition {
  return { actionId, label, kind, scoringDomains, criticalErrorId, evidenceIds }
}

const allModes = ['learn', 'practice', 'assess', 'sandbox'] as const
const commonAssessments = [
  'bedside-exam',
  'abg',
  'core-labs',
  'lactate',
  'coagulation',
  'focused-echo',
  'chest-imaging',
  'pac',
] as const

const septicArdsAki = parseIcuScenarioDefinition({
  id: 'septic-ards-aki',
  version: '1.0.0',
  family: 'septic-ards-aki',
  title: 'Septic shock with ARDS and evolving AKI',
  shortTitle: 'Sepsis + ARDS + AKI',
  summary:
    'A 12-hour integrated course requiring shock classification, lung-protective support, infection control, and fluid-aware renal support.',
  openingNarrative:
    'A synthetic adult with pneumonia has worsening vasodilatory shock, bilateral lung injury, oliguria, and rising lactate despite initial stabilization.',
  durationHours: 12,
  minimumMasteryElapsedSeconds: 10_800,
  expectedClassification: 'distributive',
  allowedModes: allModes,
  initialPatient: makePatient('icu-sepsis-01', {
    adultAgeYears: 63,
    weightKg: 88,
    drivers: {
      vasoplegiaSeverity: 0.7,
      lungInjurySeverity: 0.72,
      acuteKidneyInjurySeverity: 0.62,
      infectionBurden: 0.85,
    },
    hemodynamics: {
      heartRateBpm: 118,
      mapMmHg: 56,
      systolicMmHg: 82,
      diastolicMmHg: 43,
      cardiacOutputLMin: 6.1,
      nativeCardiacOutputLMin: 6.1,
      effectiveSystemicFlowLMin: 6.1,
      rapMmHg: 6,
      pawpMmHg: 10,
      systemicVascularResistanceDynSecCm5: 610,
      circulatingVolumeMl: 3_950,
    },
    respiratory: {
      spontaneousRatePerMin: 34,
      complianceMlCmH2O: 24,
      shuntFraction: 0.38,
      paO2MmHg: 54,
      paCO2MmHg: 48,
      bicarbonateMmolL: 18,
      pH: 7.2,
      spo2Percent: 84,
    },
    renal: {
      creatinineMgDl: 2.6,
      bunMgDl: 54,
      potassiumMmolL: 5.3,
      bicarbonateMmolL: 18,
      urineOutputMlHour: 12,
    },
    perfusion: { lactateMmolL: 5.2, capillaryRefillSeconds: 5, mottlingScore: 3 },
  }),
  capabilities: {
    assessments: commonAssessments,
    therapies: ['ventilator', 'crrt', 'ecmo'],
    interventions: [
      'fluid-bolus',
      'vasopressor-up',
      'vasopressor-down',
      'sedation-up',
      'sedation-down',
      'prone',
      'supine',
      'antimicrobials',
      'source-control',
      'communicate-plan',
    ],
    mcsDevices: [],
    ecmoModes: ['vv'],
  },
  scheduledEvents: [
    {
      id: 'sepsis-aki-progresses',
      atSeconds: 10_800,
      jitterSeconds: { minimum: -300, maximum: 300 },
      label: 'Oliguric kidney injury progresses',
      effect: { kind: 'driver-delta', driver: 'acuteKidneyInjurySeverity', delta: 0.16 },
      evidenceIds: ['ICU-KDIGO-AKI'],
    },
  ],
  interventions: [
    action('diagnosis:correct', 'Commit the correct working shock classification', 'assessment', [
      'prioritization',
    ]),
    action('assessment:bedside-exam', 'Perform bedside shock examination', 'assessment', [
      'assessment',
    ]),
    action('assessment:abg', 'Review arterial blood gas', 'assessment', ['assessment']),
    action('assessment:lactate', 'Trend lactate', 'assessment', ['assessment']),
    action(
      'care:antimicrobials',
      'Administer abstracted antimicrobial milestone',
      'care',
      ['prioritization'],
      ['ICU-SSC-2026'],
    ),
    action(
      'care:source-control',
      'Complete abstracted source-control milestone',
      'care',
      ['prioritization'],
      ['ICU-SSC-2026'],
    ),
    action(
      'care:vasopressor-up',
      'Escalate relative vasopressor tier',
      'care',
      ['therapy'],
      ['ICU-SSC-2026'],
    ),
    action(
      'therapy:ventilator:start',
      'Start mechanical ventilation after readiness review',
      'therapy',
      ['therapy'],
      ['ICU-ATS-ARDS', 'ICU-MV-ENGINE'],
    ),
    action(
      'device:ventilator:peep-cmh2o',
      'Adjust PEEP and reassess whole-patient response',
      'device',
      ['device'],
      ['ICU-ATS-ARDS', 'ICU-MV-ENGINE'],
    ),
    action(
      'care:prone',
      'Use prone positioning in the authored severe ARDS course',
      'care',
      ['device'],
      ['ICU-ATS-ARDS'],
    ),
    action(
      'therapy:crrt:start',
      'Start CRRT after readiness review',
      'therapy',
      ['therapy'],
      ['ICU-KDIGO-AKI', 'ICU-CRRT-ENGINE'],
    ),
    action(
      'device:crrt:patient-fluid-removal-ml-hour',
      'Set fluid removal with hemodynamic reassessment',
      'device',
      ['device'],
      ['ICU-CRRT-ENGINE'],
    ),
    action('reassess:hemodynamics', 'Reassess perfusion and shock phenotype', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:respiratory', 'Reassess gas exchange and mechanics', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:renal', 'Reassess renal and fluid response', 'reassessment', ['reassessment']),
    action('care:communicate-plan', 'Communicate the integrated plan', 'safety', ['safety']),
    action(
      'device:ventilator:peep-cmh2o:unsafe-high',
      'Apply injurious PEEP without reassessment',
      'device',
      ['safety'],
      ['ICU-ATS-ARDS'],
      'unsafe-peep',
    ),
  ],
  checkpoints: [
    {
      id: 'sepsis-recognize-and-treat',
      label: 'Identify vasodilatory shock and treat the infection milestone',
      requiredActionIds: ['assessment:bedside-exam', 'care:antimicrobials'],
      acceptedAlternativeActionIdGroups: [['assessment:lactate', 'assessment:abg']],
      evidenceIds: scenarioEvidence,
    },
    {
      id: 'sepsis-support-organs',
      label: 'Support respiratory and renal failure',
      requiredActionIds: ['therapy:ventilator:start'],
      acceptedAlternativeActionIdGroups: [['therapy:crrt:start', 'reassess:renal']],
      evidenceIds: scenarioEvidence,
    },
  ],
  scoring: {
    assessment: ['assessment:bedside-exam', 'assessment:abg'],
    prioritization: ['diagnosis:correct', 'care:antimicrobials', 'care:source-control'],
    therapy: ['care:vasopressor-up', 'therapy:ventilator:start'],
    device: ['device:ventilator:peep-cmh2o', 'device:crrt:patient-fluid-removal-ml-hour'],
    reassessment: ['reassess:hemodynamics', 'reassess:respiratory', 'reassess:renal'],
    safety: ['care:communicate-plan'],
  },
  masteryResponse: {
    educationalModelOnly: true,
    reviewStatus: 'pending',
    required: [
      booleanResponse(
        'sepsis-antimicrobials',
        'Antimicrobial milestone completed',
        'antimicrobials-administered',
        true,
        ['ICU-SSC-2026'],
      ),
      booleanResponse(
        'sepsis-source-control',
        'Source-control milestone completed',
        'source-control-completed',
        true,
        ['ICU-SSC-2026'],
      ),
      numericResponse(
        'sepsis-infection-response',
        'Modeled infection burden decreased',
        'infection-burden',
        'lte',
        initialRatioTarget(0.5),
        ['ICU-SSC-2026', 'ICU-SCENARIO-MODEL'],
      ),
      numericResponse(
        'sepsis-map-response',
        'Arterial pressure did not deteriorate from presentation',
        'map-mm-hg',
        'gte',
        initialDeltaTarget(0),
        ['ICU-ESICM-SHOCK', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'sepsis-oxygenation-floor',
        'Modeled oxygen saturation reached the response floor',
        'spo2-percent',
        'gte',
        absoluteTarget(90),
        ['ICU-ATS-ARDS', 'ICU-MV-ENGINE'],
      ),
      numericResponse(
        'sepsis-oxygenation-change',
        'Modeled oxygen saturation improved from presentation',
        'spo2-percent',
        'gte',
        initialDeltaTarget(5),
        ['ICU-ATS-ARDS', 'ICU-MV-ENGINE'],
      ),
      numericResponse(
        'sepsis-potassium-response',
        'Modeled potassium improved during renal support',
        'potassium-mmol-l',
        'lte',
        initialDeltaTarget(-0.2),
        ['ICU-KDIGO-AKI', 'ICU-CRRT-ENGINE'],
      ),
      numericResponse(
        'sepsis-lactate-response',
        'Modeled lactate decreased from presentation',
        'lactate-mmol-l',
        'lte',
        initialDeltaTarget(-1),
        ['ICU-SSC-2026', 'ICU-ESICM-SHOCK'],
      ),
      therapyRunningResponse(
        'sepsis-ventilation-delivered',
        'Mechanical ventilation was delivering support',
        'ventilator',
        true,
        ['ICU-ATS-ARDS', 'ICU-MV-ENGINE'],
      ),
      therapyRunningResponse('sepsis-crrt-delivered', 'CRRT was delivering support', 'crrt', true, [
        'ICU-KDIGO-AKI',
        'ICU-CRRT-ENGINE',
      ]),
      noActiveDeviceLimitationResponse(
        'sepsis-device-alarm-free',
        'No unresolved ventilator, CRRT, or ECMO limitation remained',
        ['ventilator', 'crrt', 'ecmo'],
        ['ICU-MV-ENGINE', 'ICU-CRRT-ENGINE', 'ICU-ECMO-ENGINE'],
      ),
    ],
  },
  criticalErrors: [
    {
      id: 'unsafe-peep',
      actionId: 'device:ventilator:peep-cmh2o:unsafe-high',
      message: 'Marked PEEP escalation caused preventable hemodynamic compromise.',
    },
  ],
  learningObjectives: [
    'Integrate distributive shock, ARDS, and AKI instead of treating each device in isolation.',
    'Reassess preload and perfusion as ventilator and CRRT settings change.',
    'Recognize that VV ECMO supports gas exchange but does not directly correct vasoplegia.',
  ],
  debrief: [
    'Early infection treatment and source control remain causal priorities alongside support.',
    'PEEP, fluid removal, and ECMO drainage all interact through available venous return.',
  ],
  evidenceIds: ['ICU-SSC-2026', 'ICU-ATS-ARDS', 'ICU-KDIGO-AKI', 'ICU-ELSO', ...scenarioEvidence],
  reviewStatus: 'pending',
  educationalUseOnly: true,
})

const lvCardiogenic = parseIcuScenarioDefinition({
  id: 'lv-cardiogenic',
  version: '1.0.0',
  family: 'lv-cardiogenic',
  title: 'LV cardiogenic shock with pulmonary edema',
  shortTitle: 'LV cardiogenic shock',
  summary:
    'A 6-hour course emphasizing phenotype confirmation, pulmonary support, unloading, and case-authorized circulatory support.',
  openingNarrative:
    'A synthetic adult after a large myocardial injury has hypotension, pulmonary edema, elevated filling pressures, and falling cardiac output.',
  durationHours: 6,
  minimumMasteryElapsedSeconds: 3_600,
  expectedClassification: 'lv-cardiogenic',
  allowedModes: allModes,
  initialPatient: makePatient('icu-cardiogenic-01', {
    adultAgeYears: 67,
    weightKg: 84,
    drivers: { leftVentricularFailureSeverity: 0.78, lungInjurySeverity: 0.25 },
    hemodynamics: {
      heartRateBpm: 112,
      mapMmHg: 54,
      systolicMmHg: 78,
      diastolicMmHg: 42,
      cardiacOutputLMin: 2.2,
      nativeCardiacOutputLMin: 2.2,
      effectiveSystemicFlowLMin: 2.2,
      rapMmHg: 13,
      pawpMmHg: 26,
      meanPapMmHg: 34,
      systemicVascularResistanceDynSecCm5: 1_450,
      leftVentricularContractility: 0.38,
    },
    respiratory: {
      spontaneousRatePerMin: 31,
      complianceMlCmH2O: 31,
      shuntFraction: 0.26,
      paO2MmHg: 60,
      spo2Percent: 87,
    },
    renal: { urineOutputMlHour: 15 },
    perfusion: { lactateMmolL: 4.8, capillaryRefillSeconds: 5, mottlingScore: 3 },
  }),
  capabilities: {
    assessments: commonAssessments,
    therapies: ['ventilator', 'ecmo', 'mcs', 'crrt'],
    interventions: [
      'inotrope-up',
      'inotrope-down',
      'vasopressor-up',
      'vasopressor-down',
      'sedation-up',
      'sedation-down',
      'communicate-plan',
    ],
    mcsDevices: ['iabp', 'left-impella'],
    ecmoModes: ['va'],
  },
  scheduledEvents: [
    {
      id: 'lv-output-declines',
      atSeconds: 3_600,
      jitterSeconds: { minimum: -120, maximum: 120 },
      label: 'Native LV output declines further',
      effect: { kind: 'driver-delta', driver: 'leftVentricularFailureSeverity', delta: 0.08 },
      evidenceIds: ['ICU-MCS-ENGINE'],
    },
  ],
  interventions: [
    action('diagnosis:correct', 'Commit the correct working shock classification', 'assessment', [
      'prioritization',
    ]),
    action('assessment:focused-echo', 'Perform focused echo', 'assessment', ['assessment']),
    action('assessment:pac', 'Interpret invasive hemodynamics', 'assessment', ['assessment']),
    action('assessment:lactate', 'Trend lactate', 'assessment', ['assessment']),
    action('care:inotrope-up', 'Escalate relative inotrope tier', 'care', ['prioritization']),
    action(
      'therapy:ventilator:start',
      'Support pulmonary edema with ventilation',
      'therapy',
      ['therapy'],
      ['ICU-MV-ENGINE'],
    ),
    action(
      'therapy:circulatory-support:start',
      'Start a case-authorized circulatory support strategy',
      'therapy',
      ['therapy'],
      ['ICU-MCS-ENGINE', 'ICU-ELSO'],
    ),
    action(
      'device:circulatory-support:adjust',
      'Adjust support and reconcile loading conditions',
      'device',
      ['device'],
      ['ICU-MCS-ENGINE', 'ICU-ECMO-ENGINE'],
    ),
    action('reassess:hemodynamics', 'Reassess flow, MAP, and filling pressures', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:respiratory', 'Reassess pulmonary edema and gas exchange', 'reassessment', [
      'reassessment',
    ]),
    action('care:communicate-plan', 'Activate and communicate with the support team', 'safety', [
      'safety',
    ]),
    action(
      'device:circulatory-support:adjust:unsafe',
      'Escalate pump demand despite suction/loading alarm',
      'device',
      ['safety'],
      ['ICU-MCS-ENGINE'],
      'ignore-suction',
    ),
  ],
  checkpoints: [
    {
      id: 'cardiogenic-phenotype',
      label: 'Confirm the low-output LV phenotype',
      requiredActionIds: ['assessment:focused-echo'],
      acceptedAlternativeActionIdGroups: [['assessment:pac', 'assessment:lactate']],
      evidenceIds: scenarioEvidence,
    },
    {
      id: 'cardiogenic-support',
      label: 'Restore flow with medication or rescue support, then reassess',
      requiredActionIds: ['reassess:hemodynamics'],
      acceptedAlternativeActionIdGroups: [
        ['therapy:circulatory-support:start', 'care:inotrope-up'],
      ],
      evidenceIds: scenarioEvidence,
    },
  ],
  scoring: {
    assessment: ['assessment:focused-echo', 'assessment:pac'],
    prioritization: ['diagnosis:correct', 'care:inotrope-up'],
    therapy: ['therapy:ventilator:start', 'therapy:circulatory-support:start'],
    device: ['device:circulatory-support:adjust'],
    reassessment: ['reassess:hemodynamics', 'reassess:respiratory'],
    safety: ['care:communicate-plan'],
  },
  masteryResponse: {
    educationalModelOnly: true,
    reviewStatus: 'pending',
    required: [
      numericResponse(
        'lv-map-response',
        'Modeled arterial pressure improved',
        'map-mm-hg',
        'gte',
        initialDeltaTarget(10),
        ['ICU-ACC-CARDIOGENIC', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'lv-lactate-response',
        'Modeled lactate decreased',
        'lactate-mmol-l',
        'lte',
        initialDeltaTarget(-1),
        ['ICU-ACC-CARDIOGENIC', 'ICU-ESICM-SHOCK'],
      ),
      noActiveDeviceLimitationResponse(
        'lv-ventilator-limitation-free',
        'No unresolved ventilator limitation remained',
        ['ventilator'],
        ['ICU-MV-ENGINE'],
      ),
    ],
    oneOf: [
      {
        id: 'lv-no-rescue-device',
        label: 'Native-flow recovery without rescue hardware',
        predicates: [
          therapyRunningResponse('lv-no-rescue-ecmo-off', 'ECMO was not required', 'ecmo', false, [
            'ICU-ACC-CARDIOGENIC',
            'ICU-ELSO',
          ]),
          therapyNeverStartedResponse(
            'lv-no-rescue-ecmo-never-started',
            'ECMO was never started during the course',
            'ecmo',
            ['ICU-ACC-CARDIOGENIC', 'ICU-ELSO'],
          ),
          therapyRunningResponse(
            'lv-no-rescue-mcs-off',
            'Temporary MCS was not required',
            'mcs',
            false,
            ['ICU-ACC-CARDIOGENIC', 'ICU-MCS-ENGINE'],
          ),
          therapyNeverStartedResponse(
            'lv-no-rescue-mcs-never-started',
            'Temporary MCS was never started during the course',
            'mcs',
            ['ICU-ACC-CARDIOGENIC', 'ICU-MCS-ENGINE'],
          ),
          numericResponse(
            'lv-no-rescue-native-flow',
            'Native cardiac output improved',
            'native-cardiac-output-l-min',
            'gte',
            initialDeltaTarget(0.6),
            ['ICU-ACC-CARDIOGENIC', 'ICU-HEMO-CORE'],
          ),
          numericResponse(
            'lv-no-rescue-pawp',
            'Modeled left-sided filling pressure decreased',
            'pawp-mm-hg',
            'lte',
            initialDeltaTarget(-4),
            ['ICU-ACC-CARDIOGENIC', 'ICU-HEMO-CORE'],
          ),
        ],
        substitutesForActionIds: [
          'therapy:circulatory-support:start',
          'device:circulatory-support:adjust',
        ],
      },
      {
        id: 'lv-mcs-rescue',
        label: 'MCS rescue with effective flow and unloading response',
        predicates: [
          therapyRunningResponse(
            'lv-mcs-rescue-running',
            'Temporary MCS was running',
            'mcs',
            true,
            ['ICU-ACC-CARDIOGENIC', 'ICU-MCS-ENGINE'],
          ),
          therapyRunningResponse(
            'lv-mcs-rescue-ecmo-off',
            'Concurrent ECMO was avoided',
            'ecmo',
            false,
            ['ICU-ELSO', 'ICU-MCS-ENGINE'],
          ),
          numericResponse(
            'lv-mcs-rescue-flow',
            'Effective systemic flow improved with MCS',
            'effective-systemic-flow-l-min',
            'gte',
            initialDeltaTarget(1),
            ['ICU-MCS-ENGINE', 'ICU-HEMO-CORE'],
          ),
          numericResponse(
            'lv-mcs-rescue-pawp',
            'Modeled left-sided filling pressure decreased',
            'pawp-mm-hg',
            'lte',
            initialDeltaTarget(-3),
            ['ICU-ACC-CARDIOGENIC', 'ICU-MCS-ENGINE'],
          ),
          noActiveDeviceLimitationResponse(
            'lv-mcs-rescue-alarm-free',
            'No unresolved MCS support limitation remained',
            ['mcs'],
            ['ICU-MCS-ENGINE'],
          ),
        ],
        substitutesForActionIds: [],
      },
      {
        id: 'lv-va-ecmo-rescue',
        label: 'VA ECMO rescue with effective systemic-flow response',
        predicates: [
          therapyRunningResponse('lv-va-ecmo-running', 'VA ECMO was running', 'ecmo', true, [
            'ICU-ELSO',
            'ICU-ECMO-ENGINE',
          ]),
          therapyRunningResponse('lv-va-ecmo-mcs-off', 'Concurrent MCS was avoided', 'mcs', false, [
            'ICU-ELSO',
            'ICU-MCS-ENGINE',
          ]),
          numericResponse(
            'lv-va-ecmo-flow',
            'Effective systemic flow improved with VA ECMO',
            'effective-systemic-flow-l-min',
            'gte',
            initialDeltaTarget(1.5),
            ['ICU-ELSO', 'ICU-ECMO-ENGINE'],
          ),
          numericResponse(
            'lv-va-ecmo-pawp',
            'Modeled left-sided filling pressure did not markedly worsen',
            'pawp-mm-hg',
            'lte',
            initialDeltaTarget(2),
            ['ICU-ACC-CARDIOGENIC', 'ICU-ECMO-ENGINE'],
          ),
          noActiveDeviceLimitationResponse(
            'lv-va-ecmo-alarm-free',
            'No unresolved ECMO support limitation remained',
            ['ecmo'],
            ['ICU-ECMO-ENGINE'],
          ),
        ],
        substitutesForActionIds: [],
      },
    ],
  },
  criticalErrors: [
    {
      id: 'ignore-suction',
      actionId: 'device:circulatory-support:adjust:unsafe',
      message: 'Support was escalated through an active preload or suction limitation.',
    },
  ],
  learningObjectives: [
    'Distinguish low output with elevated left-sided filling pressure from vasodilatory shock.',
    'Compare IABP, left Impella, and VA ECMO as authored alternatives rather than interchangeable devices.',
    'Track unloading, pulmonary congestion, native ejection, and end-organ response after support changes.',
  ],
  debrief: [
    'A higher device setting is not automatically better when preload, position, or afterload limits flow.',
    'Support choice should match the physiologic objective and be followed by serial reassessment.',
  ],
  evidenceIds: [
    'ICU-ACC-CARDIOGENIC',
    'ICU-MCS-ENGINE',
    'ICU-ELSO',
    'ICU-MV-ENGINE',
    ...scenarioEvidence,
  ],
  reviewStatus: 'pending',
  educationalUseOnly: true,
})

const massivePeRv = parseIcuScenarioDefinition({
  id: 'massive-pe-rv',
  version: '1.0.0',
  family: 'massive-pe-rv',
  title: 'Massive pulmonary embolism with acute RV shock',
  shortTitle: 'Massive PE + RV shock',
  summary:
    'A time-sensitive 6-hour course integrating RV-afterload recognition, cautious airway management, reperfusion, and rescue support.',
  openingNarrative:
    'A synthetic adult has sudden hypoxemia, hypotension, severe RV dilation, and a high pulmonary vascular load with impending respiratory failure.',
  durationHours: 6,
  minimumMasteryElapsedSeconds: 1_800,
  expectedClassification: 'rv-obstructive',
  allowedModes: allModes,
  initialPatient: makePatient('icu-pe-01', {
    adultAgeYears: 52,
    weightKg: 96,
    drivers: {
      rightVentricularFailureSeverity: 0.72,
      pulmonaryVascularObstructionSeverity: 0.84,
    },
    hemodynamics: {
      heartRateBpm: 126,
      mapMmHg: 52,
      systolicMmHg: 76,
      diastolicMmHg: 40,
      cardiacOutputLMin: 2.4,
      nativeCardiacOutputLMin: 2.4,
      effectiveSystemicFlowLMin: 2.4,
      rapMmHg: 19,
      pawpMmHg: 8,
      meanPapMmHg: 43,
      pulmonaryVascularResistanceWU: 9,
      rightVentricularContractility: 0.45,
    },
    respiratory: {
      spontaneousRatePerMin: 35,
      deadSpaceFraction: 0.58,
      paO2MmHg: 58,
      paCO2MmHg: 31,
      spo2Percent: 85,
    },
    perfusion: { lactateMmolL: 6, capillaryRefillSeconds: 6, mottlingScore: 4 },
  }),
  capabilities: {
    assessments: commonAssessments,
    therapies: ['ventilator', 'ecmo', 'mcs'],
    interventions: [
      'fluid-bolus',
      'vasopressor-up',
      'vasopressor-down',
      'inotrope-up',
      'inotrope-down',
      'reperfusion',
      'communicate-plan',
    ],
    mcsDevices: ['rp-impella'],
    ecmoModes: ['va'],
  },
  scheduledEvents: [
    {
      id: 'pe-rv-fatigue',
      atSeconds: 2_400,
      jitterSeconds: { minimum: -90, maximum: 90 },
      label: 'RV contractile reserve falls',
      effect: { kind: 'driver-delta', driver: 'rightVentricularFailureSeverity', delta: 0.09 },
      evidenceIds: ['ICU-SCENARIO-MODEL'],
    },
  ],
  interventions: [
    action('diagnosis:correct', 'Commit the correct working shock classification', 'assessment', [
      'prioritization',
    ]),
    action(
      'assessment:focused-echo',
      'Identify the acute RV pressure-load phenotype',
      'assessment',
      ['assessment'],
    ),
    action('assessment:abg', 'Assess gas exchange and ventilation', 'assessment', ['assessment']),
    action('care:reperfusion', 'Complete the abstracted reperfusion milestone', 'care', [
      'prioritization',
      'therapy',
    ]),
    action(
      'care:vasopressor-up',
      'Support perfusion while definitive therapy is mobilized',
      'care',
      ['therapy'],
    ),
    action(
      'care:inotrope-up',
      'Support modeled RV contractile reserve while definitive therapy is mobilized',
      'care',
      ['therapy'],
      ['ICU-ESC-PE', 'ICU-ESICM-SHOCK'],
    ),
    action(
      'therapy:ventilator:start',
      'Start ventilation after hemodynamic readiness review',
      'therapy',
      ['therapy'],
      ['ICU-MV-ENGINE'],
    ),
    action(
      'therapy:circulatory-support:start',
      'Start rescue RP Impella or VA ECMO in the authored branch',
      'therapy',
      ['therapy'],
      ['ICU-MCS-ENGINE', 'ICU-ELSO'],
    ),
    action(
      'device:ventilator:peep-cmh2o',
      'Use cautious PEEP and observe RV response',
      'device',
      ['device'],
      ['ICU-MV-ENGINE'],
    ),
    action(
      'device:circulatory-support:adjust',
      'Adjust rescue support',
      'device',
      ['device'],
      ['ICU-MCS-ENGINE', 'ICU-ECMO-ENGINE'],
    ),
    action('reassess:hemodynamics', 'Reassess RV loading and systemic flow', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:respiratory', 'Reassess oxygenation and ventilation', 'reassessment', [
      'reassessment',
    ]),
    action('care:communicate-plan', 'Communicate the reperfusion and rescue plan', 'safety', [
      'safety',
    ]),
    action(
      'device:ventilator:peep-cmh2o:unsafe-high',
      'Apply high PEEP during preload-sensitive RV shock',
      'device',
      ['safety'],
      ['ICU-MV-ENGINE'],
      'excessive-peep-rv',
    ),
  ],
  checkpoints: [
    {
      id: 'pe-recognition',
      label: 'Recognize RV pressure overload and prioritize reperfusion',
      requiredActionIds: ['assessment:focused-echo', 'care:reperfusion'],
      acceptedAlternativeActionIdGroups: [],
      evidenceIds: scenarioEvidence,
    },
    {
      id: 'pe-stabilization',
      label: 'Stabilize without worsening venous return',
      requiredActionIds: ['reassess:hemodynamics'],
      acceptedAlternativeActionIdGroups: [
        ['therapy:circulatory-support:start', 'care:vasopressor-up'],
      ],
      evidenceIds: scenarioEvidence,
    },
  ],
  scoring: {
    assessment: ['assessment:focused-echo', 'assessment:abg'],
    prioritization: ['diagnosis:correct', 'care:reperfusion'],
    therapy: ['care:vasopressor-up', 'care:inotrope-up', 'therapy:circulatory-support:start'],
    device: ['device:ventilator:peep-cmh2o', 'device:circulatory-support:adjust'],
    reassessment: ['reassess:hemodynamics', 'reassess:respiratory'],
    safety: ['care:communicate-plan'],
  },
  masteryResponse: {
    educationalModelOnly: true,
    reviewStatus: 'pending',
    required: [
      booleanResponse(
        'pe-reperfusion-completed',
        'Definitive reperfusion milestone completed',
        'reperfusion-completed',
        true,
        ['ICU-ESC-PE'],
      ),
      numericResponse(
        'pe-obstruction-response',
        'Modeled pulmonary obstruction decreased',
        'pulmonary-obstruction-severity',
        'lte',
        initialRatioTarget(0.3),
        ['ICU-ESC-PE', 'ICU-SCENARIO-MODEL'],
      ),
      numericResponse(
        'pe-pvr-response',
        'Modeled pulmonary vascular resistance decreased',
        'pvr-wu',
        'lte',
        initialRatioTarget(0.4),
        ['ICU-ESC-PE', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'pe-map-response',
        'Modeled arterial pressure improved',
        'map-mm-hg',
        'gte',
        initialDeltaTarget(8),
        ['ICU-ESC-PE', 'ICU-ESICM-SHOCK'],
      ),
      numericResponse(
        'pe-rap-response',
        'Modeled right atrial pressure decreased',
        'rap-mm-hg',
        'lte',
        initialDeltaTarget(-3),
        ['ICU-ESC-PE', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'pe-lactate-response',
        'Modeled lactate decreased',
        'lactate-mmol-l',
        'lte',
        initialDeltaTarget(-1),
        ['ICU-ESC-PE', 'ICU-ESICM-SHOCK'],
      ),
      noActiveDeviceLimitationResponse(
        'pe-ventilator-limitation-free',
        'No unresolved ventilator limitation remained',
        ['ventilator'],
        ['ICU-MV-ENGINE'],
      ),
    ],
    oneOf: [
      {
        id: 'pe-no-rescue-device',
        label: 'Native-flow recovery without rescue hardware',
        predicates: [
          therapyRunningResponse('pe-no-rescue-ecmo-off', 'ECMO was not required', 'ecmo', false, [
            'ICU-ESC-PE',
            'ICU-ELSO',
          ]),
          therapyNeverStartedResponse(
            'pe-no-rescue-ecmo-never-started',
            'ECMO was never started during the course',
            'ecmo',
            ['ICU-ESC-PE', 'ICU-ELSO'],
          ),
          therapyRunningResponse(
            'pe-no-rescue-mcs-off',
            'Temporary right-sided MCS was not required',
            'mcs',
            false,
            ['ICU-ESC-PE', 'ICU-MCS-ENGINE'],
          ),
          therapyNeverStartedResponse(
            'pe-no-rescue-mcs-never-started',
            'Temporary right-sided MCS was never started during the course',
            'mcs',
            ['ICU-ESC-PE', 'ICU-MCS-ENGINE'],
          ),
          numericResponse(
            'pe-no-rescue-native-flow',
            'Native cardiac output improved after reperfusion',
            'native-cardiac-output-l-min',
            'gte',
            initialDeltaTarget(0.6),
            ['ICU-ESC-PE', 'ICU-HEMO-CORE'],
          ),
        ],
        substitutesForActionIds: [
          'therapy:circulatory-support:start',
          'device:circulatory-support:adjust',
        ],
      },
      {
        id: 'pe-rp-mcs-rescue',
        label: 'Right-sided MCS rescue with effective-flow response',
        predicates: [
          therapyRunningResponse('pe-rp-mcs-running', 'Right-sided MCS was running', 'mcs', true, [
            'ICU-ESC-PE',
            'ICU-MCS-ENGINE',
          ]),
          therapyRunningResponse(
            'pe-rp-mcs-ecmo-off',
            'Concurrent ECMO was avoided',
            'ecmo',
            false,
            ['ICU-ELSO', 'ICU-MCS-ENGINE'],
          ),
          numericResponse(
            'pe-rp-mcs-flow',
            'Effective systemic flow improved with right-sided support',
            'effective-systemic-flow-l-min',
            'gte',
            initialDeltaTarget(1),
            ['ICU-MCS-ENGINE', 'ICU-HEMO-CORE'],
          ),
          noActiveDeviceLimitationResponse(
            'pe-rp-mcs-alarm-free',
            'No unresolved MCS support limitation remained',
            ['mcs'],
            ['ICU-MCS-ENGINE'],
          ),
        ],
        substitutesForActionIds: [],
      },
      {
        id: 'pe-va-ecmo-rescue',
        label: 'VA ECMO rescue with effective-flow response',
        predicates: [
          therapyRunningResponse('pe-va-ecmo-running', 'VA ECMO was running', 'ecmo', true, [
            'ICU-ESC-PE',
            'ICU-ELSO',
            'ICU-ECMO-ENGINE',
          ]),
          therapyRunningResponse('pe-va-ecmo-mcs-off', 'Concurrent MCS was avoided', 'mcs', false, [
            'ICU-ELSO',
            'ICU-MCS-ENGINE',
          ]),
          numericResponse(
            'pe-va-ecmo-flow',
            'Effective systemic flow improved with VA ECMO',
            'effective-systemic-flow-l-min',
            'gte',
            initialDeltaTarget(1),
            ['ICU-ELSO', 'ICU-ECMO-ENGINE'],
          ),
          noActiveDeviceLimitationResponse(
            'pe-va-ecmo-alarm-free',
            'No unresolved ECMO support limitation remained',
            ['ecmo'],
            ['ICU-ECMO-ENGINE'],
          ),
        ],
        substitutesForActionIds: [],
      },
    ],
  },
  criticalErrors: [
    {
      id: 'excessive-peep-rv',
      actionId: 'device:ventilator:peep-cmh2o:unsafe-high',
      message: 'Excessive airway pressure worsened preload-sensitive RV shock.',
    },
  ],
  learningObjectives: [
    'Recognize acute RV pressure overload and preserve venous return during airway management.',
    'Treat reperfusion as definitive while using vasoactive or mechanical support as a bridge.',
    'Understand that right-sided support improves pulmonary delivery but does not remove obstruction.',
  ],
  debrief: [
    'Reperfusion remains the causal intervention in the scenario.',
    'Intubation and PEEP can destabilize severe RV shock by reducing venous return and increasing RV afterload.',
  ],
  evidenceIds: ['ICU-ESC-PE', 'ICU-ESICM-SHOCK', 'ICU-MCS-ENGINE', 'ICU-ELSO', 'ICU-MV-ENGINE'],
  reviewStatus: 'pending',
  educationalUseOnly: true,
})

const hemorrhagic = parseIcuScenarioDefinition({
  id: 'hemorrhagic',
  version: '1.0.0',
  family: 'hemorrhagic',
  title: 'Active hemorrhagic hypovolemic shock',
  shortTitle: 'Hemorrhagic shock',
  summary:
    'A 6-hour course centered on ongoing blood loss, oxygen delivery, balanced support, and abstract source control.',
  openingNarrative:
    'A synthetic adult has persistent internal bleeding, falling hemoglobin, worsening tachycardia, and inadequate perfusion after an initial crystalloid bolus.',
  durationHours: 6,
  minimumMasteryElapsedSeconds: 1_800,
  expectedClassification: 'hypovolemic-hemorrhagic',
  allowedModes: allModes,
  initialPatient: makePatient('icu-hemorrhage-01', {
    adultAgeYears: 41,
    weightKg: 78,
    drivers: { bleedingRateMlHour: 720 },
    hemodynamics: {
      heartRateBpm: 132,
      mapMmHg: 50,
      systolicMmHg: 72,
      diastolicMmHg: 39,
      cardiacOutputLMin: 3.1,
      nativeCardiacOutputLMin: 3.1,
      effectiveSystemicFlowLMin: 3.1,
      rapMmHg: 2,
      pawpMmHg: 4,
      circulatingVolumeMl: 3_100,
      systemicVascularResistanceDynSecCm5: 1_420,
    },
    respiratory: { spontaneousRatePerMin: 30, paCO2MmHg: 31, bicarbonateMmolL: 17, pH: 7.27 },
    hematology: { hemoglobinGdl: 7.4, hematocritPercent: 22, inr: 1.7, plateletCountK: 105 },
    perfusion: { lactateMmolL: 6.8, capillaryRefillSeconds: 7, mottlingScore: 4 },
  }),
  capabilities: {
    assessments: commonAssessments,
    therapies: ['ventilator'],
    interventions: [
      'fluid-bolus',
      'blood-products',
      'vasopressor-up',
      'vasopressor-down',
      'source-control',
      'communicate-plan',
    ],
    mcsDevices: [],
    ecmoModes: [],
  },
  scheduledEvents: [
    {
      id: 'bleeding-accelerates',
      atSeconds: 1_800,
      jitterSeconds: { minimum: -60, maximum: 60 },
      label: 'Uncontrolled bleeding accelerates',
      effect: { kind: 'bleeding-rate', rateMlHour: 1_050 },
      evidenceIds: ['ICU-SCENARIO-MODEL'],
    },
  ],
  interventions: [
    action('diagnosis:correct', 'Commit the correct working shock classification', 'assessment', [
      'prioritization',
    ]),
    action('assessment:bedside-exam', 'Identify low-preload shock', 'assessment', ['assessment']),
    action('assessment:core-labs', 'Trend hemoglobin and metabolic state', 'assessment', [
      'assessment',
    ]),
    action('assessment:coagulation', 'Assess coagulopathy', 'assessment', ['assessment']),
    action('care:blood-products', 'Administer bounded blood-product support', 'care', [
      'prioritization',
      'therapy',
    ]),
    action('care:source-control', 'Complete abstracted hemorrhage source control', 'care', [
      'prioritization',
    ]),
    action('care:fluid-bolus', 'Use bounded crystalloid support', 'care', ['therapy']),
    action(
      'device:ventilator:peep-cmh2o',
      'Use the lowest effective airway-pressure strategy',
      'device',
      ['device'],
    ),
    action(
      'reassess:hemodynamics',
      'Reassess volume responsiveness and perfusion',
      'reassessment',
      ['reassessment'],
    ),
    action('reassess:perfusion', 'Reassess lactate and oxygen delivery', 'reassessment', [
      'reassessment',
    ]),
    action('care:communicate-plan', 'Activate and communicate hemorrhage control', 'safety', [
      'safety',
    ]),
    action(
      'therapy:ecmo:start',
      'Start ECMO before hemorrhage control',
      'therapy',
      ['safety'],
      ['ICU-ELSO'],
      'premature-ecmo',
    ),
    action(
      'therapy:crrt:start',
      'Start fluid-removing CRRT during active hypovolemia',
      'therapy',
      ['safety'],
      ['ICU-CRRT-ENGINE'],
      'premature-crrt',
    ),
    action(
      'device:ventilator:peep-cmh2o:unsafe-high',
      'Apply high PEEP during severe hypovolemia',
      'device',
      ['safety'],
      ['ICU-MV-ENGINE'],
      'high-peep-hypovolemia',
    ),
  ],
  checkpoints: [
    {
      id: 'hemorrhage-recognize',
      label: 'Recognize hemorrhagic shock and impaired oxygen delivery',
      requiredActionIds: ['assessment:bedside-exam', 'assessment:core-labs'],
      acceptedAlternativeActionIdGroups: [],
      evidenceIds: scenarioEvidence,
    },
    {
      id: 'hemorrhage-control',
      label: 'Restore circulating oxygen-carrying capacity and control the source',
      requiredActionIds: ['care:blood-products', 'care:source-control'],
      acceptedAlternativeActionIdGroups: [],
      evidenceIds: scenarioEvidence,
    },
  ],
  scoring: {
    assessment: ['assessment:bedside-exam', 'assessment:core-labs', 'assessment:coagulation'],
    prioritization: ['diagnosis:correct', 'care:blood-products', 'care:source-control'],
    therapy: ['care:fluid-bolus', 'care:blood-products'],
    device: ['device:ventilator:peep-cmh2o'],
    reassessment: ['reassess:hemodynamics', 'reassess:perfusion'],
    safety: ['care:communicate-plan'],
  },
  masteryResponse: {
    educationalModelOnly: true,
    reviewStatus: 'pending',
    required: [
      booleanResponse(
        'hemorrhage-source-control',
        'Hemorrhage source-control milestone completed',
        'source-control-completed',
        true,
        ['ICU-TRAUMA-HEMORRHAGE'],
      ),
      numericResponse(
        'hemorrhage-map-response',
        'Modeled arterial pressure improved',
        'map-mm-hg',
        'gte',
        initialDeltaTarget(6),
        ['ICU-TRAUMA-HEMORRHAGE', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'hemorrhage-volume-response',
        'Modeled circulating volume increased',
        'circulating-volume-ml',
        'gte',
        initialDeltaTarget(500),
        ['ICU-TRAUMA-HEMORRHAGE', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'hemorrhage-hemoglobin-response',
        'Modeled hemoglobin increased',
        'hemoglobin-g-dl',
        'gte',
        initialDeltaTarget(0.5),
        ['ICU-TRAUMA-HEMORRHAGE', 'ICU-SCENARIO-MODEL'],
      ),
      numericResponse(
        'hemorrhage-lactate-response',
        'Modeled lactate decreased',
        'lactate-mmol-l',
        'lte',
        initialDeltaTarget(-1),
        ['ICU-TRAUMA-HEMORRHAGE', 'ICU-ESICM-SHOCK'],
      ),
      noActiveAlarmResponse(
        'hemorrhage-patient-alarm-free',
        'No active critical patient alarm remained',
        ['patient'],
        ['ICU-TRAUMA-HEMORRHAGE'],
      ),
      noActiveDeviceLimitationResponse(
        'hemorrhage-ventilator-limitation-free',
        'No unresolved ventilator limitation remained',
        ['ventilator'],
        ['ICU-MV-ENGINE'],
      ),
    ],
  },
  criticalErrors: [
    {
      id: 'premature-ecmo',
      actionId: 'therapy:ecmo:start',
      message:
        'ECMO was initiated without addressing active hemorrhage and inadequate circulating volume.',
    },
    {
      id: 'premature-crrt',
      actionId: 'therapy:crrt:start',
      message: 'Fluid-removing CRRT was initiated during active hypovolemic shock.',
    },
    {
      id: 'high-peep-hypovolemia',
      actionId: 'device:ventilator:peep-cmh2o:unsafe-high',
      message: 'High PEEP further reduced venous return during severe hypovolemia.',
    },
  ],
  learningObjectives: [
    'Connect blood loss, hemoglobin, flow, and oxygen delivery.',
    'Prioritize blood-product support and source control over device escalation.',
    'Recognize ventilation and ultrafiltration choices that can worsen hypovolemia.',
  ],
  debrief: [
    'Without source control, modeled bleeding recurs despite temporary support.',
    'ECMO, MCS, and CRRT do not replace circulating volume or stop hemorrhage.',
  ],
  evidenceIds: [
    'ICU-TRAUMA-HEMORRHAGE',
    'ICU-ESICM-SHOCK',
    'ICU-MV-ENGINE',
    'ICU-CRRT-ENGINE',
    ...scenarioEvidence,
  ],
  reviewStatus: 'pending',
  educationalUseOnly: true,
})

const tamponade = parseIcuScenarioDefinition({
  id: 'tamponade',
  version: '1.0.0',
  family: 'tamponade',
  title: 'Evolving cardiac tamponade',
  shortTitle: 'Cardiac tamponade',
  summary:
    'A focused 6-hour course with a short time-critical deterioration, serial assessment, temporary bridges, and abstracted urgent drainage.',
  openingNarrative:
    'A synthetic adult after a cardiac procedure develops narrowing pulse pressure, rising venous pressure, tachycardia, and progressive pericardial constraint.',
  durationHours: 6,
  minimumMasteryElapsedSeconds: 900,
  expectedClassification: 'tamponade-obstructive',
  allowedModes: allModes,
  initialPatient: makePatient('icu-tamponade-01', {
    adultAgeYears: 61,
    weightKg: 80,
    drivers: { tamponadePressureMmHg: 11 },
    hemodynamics: {
      heartRateBpm: 116,
      mapMmHg: 58,
      systolicMmHg: 78,
      diastolicMmHg: 48,
      cardiacOutputLMin: 2.9,
      nativeCardiacOutputLMin: 2.9,
      effectiveSystemicFlowLMin: 2.9,
      rapMmHg: 16,
      pawpMmHg: 17,
      meanPapMmHg: 25,
      pericardialPressureMmHg: 11,
    },
    perfusion: { lactateMmolL: 4.1, capillaryRefillSeconds: 5, mottlingScore: 3 },
  }),
  capabilities: {
    assessments: commonAssessments,
    therapies: ['ventilator'],
    interventions: [
      'fluid-bolus',
      'vasopressor-up',
      'vasopressor-down',
      'tamponade-drainage',
      'communicate-plan',
    ],
    mcsDevices: [],
    ecmoModes: [],
  },
  scheduledEvents: [
    {
      id: 'tamponade-progresses',
      atSeconds: 900,
      jitterSeconds: { minimum: -45, maximum: 45 },
      label: 'Pericardial constraint rapidly worsens',
      effect: { kind: 'driver-delta', driver: 'tamponadePressureMmHg', delta: 6 },
      evidenceIds: ['ICU-SCENARIO-MODEL'],
    },
  ],
  interventions: [
    action('diagnosis:correct', 'Commit the correct working shock classification', 'assessment', [
      'prioritization',
    ]),
    action('assessment:bedside-exam', 'Recognize obstructive shock signs', 'assessment', [
      'assessment',
    ]),
    action('assessment:focused-echo', 'Identify pericardial constraint', 'assessment', [
      'assessment',
    ]),
    action('assessment:pac', 'Reconcile pressure equalization and low output', 'assessment', [
      'assessment',
    ]),
    action('care:tamponade-drainage', 'Complete abstracted urgent drainage', 'care', [
      'prioritization',
      'therapy',
    ]),
    action('care:fluid-bolus', 'Use a bounded bridge while drainage is mobilized', 'care', [
      'therapy',
    ]),
    action(
      'device:ventilator:peep-cmh2o',
      'Minimize airway-pressure burden if ventilation is needed',
      'device',
      ['device'],
    ),
    action('reassess:hemodynamics', 'Reassess immediately after drainage', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:perfusion', 'Reassess perfusion after relief of constraint', 'reassessment', [
      'reassessment',
    ]),
    action('care:communicate-plan', 'Activate and communicate urgent drainage', 'safety', [
      'safety',
    ]),
    action(
      'therapy:ecmo:start',
      'Escalate to ECMO instead of relieving tamponade',
      'therapy',
      ['safety'],
      ['ICU-ELSO'],
      'device-before-drainage',
    ),
  ],
  checkpoints: [
    {
      id: 'tamponade-recognize',
      label: 'Recognize the constrained-heart phenotype',
      requiredActionIds: ['assessment:focused-echo'],
      acceptedAlternativeActionIdGroups: [['assessment:bedside-exam', 'assessment:pac']],
      evidenceIds: scenarioEvidence,
    },
    {
      id: 'tamponade-relieve',
      label: 'Relieve the constraint and reassess',
      requiredActionIds: ['care:tamponade-drainage', 'reassess:hemodynamics'],
      acceptedAlternativeActionIdGroups: [],
      evidenceIds: scenarioEvidence,
    },
  ],
  scoring: {
    assessment: ['assessment:bedside-exam', 'assessment:focused-echo'],
    prioritization: ['diagnosis:correct', 'care:tamponade-drainage'],
    therapy: ['care:fluid-bolus', 'care:tamponade-drainage'],
    device: ['device:ventilator:peep-cmh2o'],
    reassessment: ['reassess:hemodynamics', 'reassess:perfusion'],
    safety: ['care:communicate-plan'],
  },
  masteryResponse: {
    educationalModelOnly: true,
    reviewStatus: 'pending',
    required: [
      booleanResponse(
        'tamponade-drainage-completed',
        'Definitive drainage milestone completed',
        'tamponade-drained',
        true,
        ['ICU-ESC-PERICARDIAL'],
      ),
      numericResponse(
        'tamponade-pressure-relieved',
        'Modeled pericardial pressure was relieved',
        'pericardial-pressure-mm-hg',
        'lte',
        absoluteTarget(1),
        ['ICU-ESC-PERICARDIAL', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'tamponade-map-response',
        'Modeled arterial pressure improved after relief',
        'map-mm-hg',
        'gte',
        initialDeltaTarget(8),
        ['ICU-ESC-PERICARDIAL', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'tamponade-flow-response',
        'Effective systemic flow improved after relief',
        'effective-systemic-flow-l-min',
        'gte',
        initialDeltaTarget(1),
        ['ICU-ESC-PERICARDIAL', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'tamponade-rap-response',
        'Modeled right atrial pressure decreased after relief',
        'rap-mm-hg',
        'lte',
        initialDeltaTarget(-3),
        ['ICU-ESC-PERICARDIAL', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'tamponade-lactate-response',
        'Modeled lactate decreased after relief',
        'lactate-mmol-l',
        'lte',
        initialDeltaTarget(-0.5),
        ['ICU-ESC-PERICARDIAL', 'ICU-ESICM-SHOCK'],
      ),
    ],
    oneOf: [
      {
        id: 'tamponade-no-ventilation',
        label: 'Definitive drainage without positive-pressure ventilation',
        predicates: [
          therapyRunningResponse(
            'tamponade-no-ventilation-off',
            'Positive-pressure ventilation was not required',
            'ventilator',
            false,
            ['ICU-ESC-PERICARDIAL', 'ICU-MV-ENGINE'],
          ),
          therapyNeverStartedResponse(
            'tamponade-no-ventilation-never-started',
            'Positive-pressure ventilation was never started during the course',
            'ventilator',
            ['ICU-ESC-PERICARDIAL', 'ICU-MV-ENGINE'],
          ),
        ],
        substitutesForActionIds: ['care:fluid-bolus', 'device:ventilator:peep-cmh2o'],
      },
      {
        id: 'tamponade-ventilated',
        label: 'Definitive drainage with monitored ventilation',
        predicates: [
          therapyRunningResponse(
            'tamponade-ventilation-running',
            'Mechanical ventilation was running',
            'ventilator',
            true,
            ['ICU-ESC-PERICARDIAL', 'ICU-MV-ENGINE'],
          ),
          noActiveDeviceLimitationResponse(
            'tamponade-ventilation-alarm-free',
            'No unresolved ventilator limitation remained',
            ['ventilator'],
            ['ICU-MV-ENGINE'],
          ),
        ],
        substitutesForActionIds: ['care:fluid-bolus'],
      },
    ],
  },
  criticalErrors: [
    {
      id: 'device-before-drainage',
      actionId: 'therapy:ecmo:start',
      message: 'Device escalation delayed definitive relief of pericardial constraint.',
    },
  ],
  learningObjectives: [
    'Recognize progressive pericardial constraint using serial examination and echo.',
    'Use temporary bridges only while arranging definitive drainage.',
    'Confirm hemodynamic improvement and watch for recurrence after drainage.',
  ],
  debrief: [
    'Increasing pump support does not remove the fixed pericardial constraint.',
    'The scenario rewards early recognition, drainage, and immediate reassessment.',
  ],
  evidenceIds: ['ICU-ESC-PERICARDIAL', 'ICU-ESICM-SHOCK', 'ICU-MV-ENGINE', ...scenarioEvidence],
  reviewStatus: 'pending',
  educationalUseOnly: true,
})

const mixedShock = parseIcuScenarioDefinition({
  id: 'mixed-cardiogenic-vasodilatory',
  version: '1.0.0',
  family: 'mixed-cardiogenic-vasodilatory',
  title: 'Mixed cardiogenic–vasodilatory shock capstone',
  shortTitle: 'Mixed shock capstone',
  summary:
    'A 12-hour capstone requiring repeated shock reclassification before and after VA ECMO restores flow but not vascular tone.',
  openingNarrative:
    'A synthetic adult with severe infection and septic cardiomyopathy has both depressed contractility and low vascular tone, then remains hypotensive after VA ECMO restores flow.',
  durationHours: 12,
  minimumMasteryElapsedSeconds: 7_200,
  expectedClassification: 'mixed-cardiogenic-vasodilatory',
  allowedModes: allModes,
  initialPatient: makePatient('icu-mixed-01', {
    adultAgeYears: 59,
    weightKg: 90,
    drivers: {
      vasoplegiaSeverity: 0.7,
      leftVentricularFailureSeverity: 0.66,
      rightVentricularFailureSeverity: 0.25,
      infectionBurden: 0.78,
      lungInjurySeverity: 0.32,
    },
    hemodynamics: {
      heartRateBpm: 122,
      mapMmHg: 48,
      systolicMmHg: 70,
      diastolicMmHg: 36,
      cardiacOutputLMin: 2.6,
      nativeCardiacOutputLMin: 2.6,
      effectiveSystemicFlowLMin: 2.6,
      rapMmHg: 11,
      pawpMmHg: 20,
      meanPapMmHg: 30,
      systemicVascularResistanceDynSecCm5: 590,
      leftVentricularContractility: 0.42,
    },
    respiratory: { spontaneousRatePerMin: 29, shuntFraction: 0.2, paO2MmHg: 66, spo2Percent: 89 },
    renal: { creatinineMgDl: 2.1, urineOutputMlHour: 16 },
    perfusion: { lactateMmolL: 7.2, capillaryRefillSeconds: 7, mottlingScore: 4 },
  }),
  capabilities: {
    assessments: commonAssessments,
    therapies: ['ventilator', 'ecmo', 'crrt'],
    interventions: [
      'fluid-bolus',
      'vasopressor-up',
      'vasopressor-down',
      'inotrope-up',
      'inotrope-down',
      'antimicrobials',
      'source-control',
      'communicate-plan',
    ],
    mcsDevices: [],
    ecmoModes: ['va'],
  },
  scheduledEvents: [
    {
      id: 'mixed-vasoplegia-persists',
      atSeconds: 7_200,
      jitterSeconds: { minimum: -180, maximum: 180 },
      label: 'Vasoplegia persists despite improved extracorporeal flow',
      effect: { kind: 'driver-delta', driver: 'vasoplegiaSeverity', delta: 0.12 },
      evidenceIds: ['ICU-SSC-2026'],
    },
  ],
  interventions: [
    action('diagnosis:correct', 'Commit the correct working shock classification', 'assessment', [
      'prioritization',
    ]),
    action('assessment:focused-echo', 'Identify depressed contractility', 'assessment', [
      'assessment',
    ]),
    action('assessment:pac', 'Identify low SVR and low native output', 'assessment', [
      'assessment',
    ]),
    action('assessment:lactate', 'Trend global perfusion', 'assessment', ['assessment']),
    action(
      'care:antimicrobials',
      'Administer abstracted antimicrobial milestone',
      'care',
      ['prioritization'],
      ['ICU-SSC-2026'],
    ),
    action(
      'care:source-control',
      'Complete abstracted source-control milestone',
      'care',
      ['prioritization'],
      ['ICU-SSC-2026'],
    ),
    action(
      'care:vasopressor-up',
      'Treat persistent low vascular tone',
      'care',
      ['therapy'],
      ['ICU-SSC-2026'],
    ),
    action('care:inotrope-up', 'Support depressed native contractility', 'care', ['therapy']),
    action(
      'therapy:circulatory-support:start',
      'Start VA ECMO in the authored refractory branch',
      'therapy',
      ['therapy'],
      ['ICU-ELSO'],
    ),
    action(
      'device:circulatory-support:adjust',
      'Adjust VA flow without chasing RPM alone',
      'device',
      ['device'],
      ['ICU-ECMO-ENGINE'],
    ),
    action(
      'device:ventilator:peep-cmh2o',
      'Balance lung support against venous return',
      'device',
      ['device'],
      ['ICU-MV-ENGINE'],
    ),
    action('reassess:hemodynamics', 'Reclassify shock after support changes', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:perfusion', 'Reassess oxygen delivery and lactate', 'reassessment', [
      'reassessment',
    ]),
    action('reassess:devices', 'Reconcile device flow with patient response', 'reassessment', [
      'reassessment',
    ]),
    action('care:communicate-plan', 'Communicate the mixed-shock plan and roles', 'safety', [
      'safety',
    ]),
    action(
      'device:circulatory-support:adjust:unsafe',
      'Escalate RPM through a drainage limitation',
      'device',
      ['safety'],
      ['ICU-ECMO-ENGINE'],
      'rpm-chasing',
    ),
  ],
  checkpoints: [
    {
      id: 'mixed-identify',
      label: 'Identify both pump and vascular-tone failure',
      requiredActionIds: ['assessment:focused-echo', 'assessment:pac'],
      acceptedAlternativeActionIdGroups: [],
      evidenceIds: scenarioEvidence,
    },
    {
      id: 'mixed-reclassify',
      label: 'Restore flow, then identify persistent vasoplegia',
      requiredActionIds: [
        'therapy:circulatory-support:start',
        'reassess:hemodynamics',
        'care:vasopressor-up',
      ],
      acceptedAlternativeActionIdGroups: [],
      evidenceIds: scenarioEvidence,
    },
  ],
  scoring: {
    assessment: ['assessment:focused-echo', 'assessment:pac'],
    prioritization: ['diagnosis:correct', 'care:antimicrobials', 'care:source-control'],
    therapy: ['care:vasopressor-up', 'care:inotrope-up', 'therapy:circulatory-support:start'],
    device: ['device:circulatory-support:adjust', 'device:ventilator:peep-cmh2o'],
    reassessment: ['reassess:hemodynamics', 'reassess:perfusion', 'reassess:devices'],
    safety: ['care:communicate-plan'],
  },
  masteryResponse: {
    educationalModelOnly: true,
    reviewStatus: 'pending',
    required: [
      booleanResponse(
        'mixed-antimicrobials',
        'Antimicrobial milestone completed',
        'antimicrobials-administered',
        true,
        ['ICU-SSC-2026'],
      ),
      booleanResponse(
        'mixed-source-control',
        'Source-control milestone completed',
        'source-control-completed',
        true,
        ['ICU-SSC-2026'],
      ),
      numericResponse(
        'mixed-infection-response',
        'Modeled infection burden decreased',
        'infection-burden',
        'lte',
        initialRatioTarget(0.5),
        ['ICU-SSC-2026', 'ICU-SCENARIO-MODEL'],
      ),
      therapyRunningResponse(
        'mixed-va-ecmo-running',
        'VA ECMO was running in the authored refractory branch',
        'ecmo',
        true,
        ['ICU-ELSO', 'ICU-ECMO-ENGINE'],
      ),
      numericResponse(
        'mixed-map-response',
        'Modeled arterial pressure improved',
        'map-mm-hg',
        'gte',
        initialDeltaTarget(10),
        ['ICU-SSC-2026', 'ICU-ESICM-SHOCK'],
      ),
      numericResponse(
        'mixed-native-flow-response',
        'Native cardiac output improved',
        'native-cardiac-output-l-min',
        'gte',
        initialDeltaTarget(0.3),
        ['ICU-ACC-CARDIOGENIC', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'mixed-effective-flow-response',
        'Effective systemic flow improved with VA ECMO',
        'effective-systemic-flow-l-min',
        'gte',
        initialDeltaTarget(1.5),
        ['ICU-ELSO', 'ICU-ECMO-ENGINE'],
      ),
      numericResponse(
        'mixed-svr-response',
        'Modeled vascular tone improved after reclassification',
        'svr-dyn-sec-cm5',
        'gte',
        initialDeltaTarget(100),
        ['ICU-SSC-2026', 'ICU-HEMO-CORE'],
      ),
      numericResponse(
        'mixed-lactate-response',
        'Modeled lactate decreased',
        'lactate-mmol-l',
        'lte',
        initialDeltaTarget(-1.5),
        ['ICU-SSC-2026', 'ICU-ESICM-SHOCK'],
      ),
      numericResponse(
        'mixed-pawp-response',
        'Modeled left-sided filling pressure did not markedly worsen',
        'pawp-mm-hg',
        'lte',
        initialDeltaTarget(2),
        ['ICU-ACC-CARDIOGENIC', 'ICU-ECMO-ENGINE'],
      ),
      noActiveDeviceLimitationResponse(
        'mixed-ecmo-alarm-free',
        'No unresolved ECMO or ventilator limitation remained',
        ['ecmo', 'ventilator'],
        ['ICU-ECMO-ENGINE', 'ICU-MV-ENGINE'],
      ),
    ],
  },
  criticalErrors: [
    {
      id: 'rpm-chasing',
      actionId: 'device:circulatory-support:adjust:unsafe',
      message:
        'RPM was escalated through a drainage limitation without correcting available preload.',
    },
  ],
  learningObjectives: [
    'Identify simultaneous myocardial depression and vasoplegia.',
    'Reclassify shock after VA ECMO restores flow but hypotension persists.',
    'Use patient response, loading conditions, and vascular tone instead of pump speed alone.',
  ],
  debrief: [
    'VA ECMO can restore systemic flow while severe vasoplegia continues to limit arterial pressure.',
    'Serial reclassification is the central capstone behavior.',
  ],
  evidenceIds: ['ICU-SSC-2026', 'ICU-ELSO', 'ICU-ECMO-ENGINE', ...scenarioEvidence],
  reviewStatus: 'pending',
  educationalUseOnly: true,
})

/**
 * Ordered by interacting-system count and duration (WP10 §5.5): one dominant mechanism first,
 * the twelve-hour multisystem scenarios last, capstone at the end. The previous order opened on
 * the longest and most multi-system scenario in the set.
 */
export const icuScenarios: readonly IcuScenarioDefinition[] = Object.freeze([
  hemorrhagic,
  tamponade,
  lvCardiogenic,
  massivePeRv,
  septicArdsAki,
  mixedShock,
])

export const icuScenarioById: ReadonlyMap<string, IcuScenarioDefinition> = new Map(
  icuScenarios.map((scenario) => [scenario.id, scenario]),
)

export function getIcuScenario(id: string): IcuScenarioDefinition {
  const scenario = icuScenarioById.get(id)
  if (!scenario) throw new Error(`Unknown ICU simulation scenario: ${id}`)
  return scenario
}
