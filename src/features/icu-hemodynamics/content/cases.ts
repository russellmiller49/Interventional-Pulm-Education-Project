import type {
  CirculationParameters,
  HemodynamicCaseDefinition,
  HemodynamicInterventionDefinition,
} from '../engine'

const sharedSources = [
  'pac-waveforms-part-1-2021',
  'pac-derived-part-2-2021',
  'esicm-shock-2025',
  'master-hemodynamics-reference',
  'icu-hemodynamics-model-v1',
] as const

const baseParameters: CirculationParameters = {
  heartRateBpm: 82,
  respiratoryRateBpm: 18,
  bodySurfaceAreaM2: 1.9,
  referenceCardiacOutputLMin: 5.5,
  circulatingVolumeFraction: 1,
  stressedVenousVolumeMl: 900,
  venousComplianceMlMmHg: 100,
  systemicVascularResistanceDynSecCm5: 950,
  pulmonaryVascularResistanceWU: 1.5,
  systemicArterialComplianceMlMmHg: 1.6,
  pulmonaryArterialComplianceMlMmHg: 4.5,
  leftVentricularContractility: 1,
  rightVentricularContractility: 1,
  leftVentricularCompliance: 1,
  rightVentricularCompliance: 1,
  rightAtrialPressureSetPointMmHg: 3,
  leftAtrialPressureSetPointMmHg: 8,
  pericardialPressureMmHg: 0,
  peepCmH2O: 5,
  pleuralPressureSwingMmHg: 3,
  arterialOxygenSaturationPercent: 97,
  mixedVenousOxygenSaturationPercent: 65,
  tricuspidRegurgitationSeverity: 0,
  shuntFraction: 0.05,
  rhythmRegularity: 1,
  spontaneousBreathingFraction: 0,
  fluidResponsiveness: 0.35,
}

function intervention(
  definition: HemodynamicInterventionDefinition,
): HemodynamicInterventionDefinition {
  return definition
}

const plr = intervention({
  id: 'passive-leg-raise',
  label: 'Passive leg raise with real-time stroke-volume endpoint',
  shortLabel: 'PLR',
  category: 'assessment',
  description:
    'Transiently recruit venous blood while watching flow, not a static filling pressure alone.',
  response:
    'A reversible preload challenge begins; watch the CO/SV trend over the next 10–20 seconds.',
  onsetSeconds: 5,
  recoverySeconds: 35,
  parameterDeltas: { circulatingVolumeFraction: 0.08 },
})

const fluidStep = intervention({
  id: 'fluid-250',
  label: 'Give one modeled 250 mL crystalloid step',
  shortLabel: 'Fluid +250 mL',
  category: 'preload',
  description: 'A bounded relative volume step; this is not patient-specific fluid advice.',
  response:
    'The modeled volume step equilibrates over 15–30 seconds. Reassess flow and congestion.',
  onsetSeconds: 12,
  repeatable: true,
  parameterDeltas: { circulatingVolumeFraction: 0.075, stressedVenousVolumeMl: 180 },
})

const norepinephrine = intervention({
  id: 'norepinephrine-up',
  label: 'Increase norepinephrine one relative tier',
  shortLabel: 'Norepinephrine ↑',
  category: 'vascular-tone',
  description: 'Raises systemic vascular tone in a bounded educational tier without a dose.',
  response: 'Systemic vascular tone rises over several seconds; MAP response depends on flow.',
  onsetSeconds: 7,
  repeatable: true,
  parameterDeltas: { systemicVascularResistanceDynSecCm5: 340, leftVentricularContractility: 0.04 },
})

const vasopressin = intervention({
  id: 'vasopressin-add',
  label: 'Add vasopressin as a relative adjunct tier',
  shortLabel: 'Vasopressin +',
  category: 'vascular-tone',
  description: 'Adds a non-catecholamine vascular-tone effect without a patient-specific dose.',
  response: 'Vascular tone rises modestly; observe MAP and peripheral perfusion together.',
  onsetSeconds: 9,
  parameterDeltas: { systemicVascularResistanceDynSecCm5: 210 },
})

const dobutamine = intervention({
  id: 'dobutamine-up',
  label: 'Increase dobutamine one relative tier',
  shortLabel: 'Dobutamine ↑',
  category: 'inotropy',
  description: 'Adds a bounded inotropic/flow effect without specifying a dose.',
  response:
    'Contractility and forward flow increase over 10–20 seconds; check MAP and ectopy context.',
  onsetSeconds: 10,
  repeatable: true,
  parameterDeltas: {
    leftVentricularContractility: 0.28,
    rightVentricularContractility: 0.1,
    systemicVascularResistanceDynSecCm5: -70,
    heartRateBpm: 4,
  },
})

const milrinone = intervention({
  id: 'milrinone-up',
  label: 'Increase milrinone one relative tier',
  shortLabel: 'Milrinone ↑',
  category: 'inotropy',
  description:
    'Adds relative inotropy and pulmonary/systemic vasodilation without specifying a dose.',
  response: 'RV/LV contractility rises as vascular resistance falls; monitor systemic pressure.',
  onsetSeconds: 16,
  repeatable: true,
  parameterDeltas: {
    leftVentricularContractility: 0.16,
    rightVentricularContractility: 0.25,
    pulmonaryVascularResistanceWU: -0.8,
    systemicVascularResistanceDynSecCm5: -110,
  },
})

const diuresis = intervention({
  id: 'diuresis-step',
  label: 'Increase decongestion one relative tier',
  shortLabel: 'Diuresis ↑',
  category: 'decongestion',
  description:
    'Reduces modeled filling volume gradually; no patient-specific agent or dose is implied.',
  response:
    'Filling pressures fall gradually. Reassess flow, renal perfusion context, and congestion.',
  onsetSeconds: 24,
  repeatable: true,
  parameterDeltas: {
    circulatingVolumeFraction: -0.08,
    rightAtrialPressureSetPointMmHg: -1,
    leftAtrialPressureSetPointMmHg: -2,
  },
})

const systemicPulmonaryVasodilator = intervention({
  id: 'systemic-pulmonary-vasodilator',
  label: 'Increase systemic pulmonary vasodilator one relative tier',
  shortLabel: 'Systemic PVD ↑',
  category: 'pulmonary-vascular',
  description: 'Lowers PVR but can also lower systemic vascular tone.',
  response: 'PVR falls, but systemic pressure also declines; inspect RV flow and MAP together.',
  onsetSeconds: 14,
  parameterDeltas: {
    pulmonaryVascularResistanceWU: -1.4,
    systemicVascularResistanceDynSecCm5: -240,
  },
})

const inhaledPulmonaryVasodilator = intervention({
  id: 'inhaled-pulmonary-vasodilator',
  label: 'Increase inhaled pulmonary vasodilation one relative tier',
  shortLabel: 'Inhaled PVD ↑',
  category: 'pulmonary-vascular',
  description: 'Models selective PVR reduction as a bridge while the cause is addressed.',
  response: 'RV afterload falls over seconds with little modeled systemic vasodilation.',
  onsetSeconds: 8,
  parameterDeltas: { pulmonaryVascularResistanceWU: -1.5, arterialOxygenSaturationPercent: 1 },
})

const decreasePeep = intervention({
  id: 'peep-down',
  label: 'Decrease PEEP one relative step after respiratory review',
  shortLabel: 'PEEP ↓',
  category: 'ventilator',
  description:
    'Reduces intrathoracic pressure while preserving the need to reassess oxygenation and recruitment.',
  response: 'Pleural-pressure transmission and RV impedance fall; reassess oxygenation and flow.',
  onsetSeconds: 6,
  parameterDeltas: { peepCmH2O: -3 },
})

const increasePeepUnsafe = intervention({
  id: 'peep-up-unsafe',
  label: 'Increase PEEP without a respiratory indication',
  shortLabel: 'PEEP ↑',
  category: 'ventilator',
  description: 'A deliberately unsafe choice in this hemodynamic context.',
  response: 'Venous return and RV output worsen as intrathoracic pressure rises.',
  onsetSeconds: 5,
  unsafe: true,
  critical: true,
  parameterDeltas: { peepCmH2O: 5, rightVentricularContractility: -0.08 },
})

const reperfusion = intervention({
  id: 'pe-reperfusion',
  label: 'Activate the case-specific PE reperfusion pathway',
  shortLabel: 'PE reperfusion',
  category: 'definitive',
  description:
    'Represents an appropriate definitive pathway selected after clinical confirmation; it does not choose a real-patient procedure.',
  response:
    'The modeled obstructive load begins to resolve; PAP and RV loading improve with delay.',
  onsetSeconds: 20,
  parameterDeltas: { pulmonaryVascularResistanceWU: -3.6, rightVentricularContractility: 0.12 },
})

const pericardialDrainage = intervention({
  id: 'pericardial-drainage',
  label: 'Activate the case-specific urgent pericardial drainage pathway',
  shortLabel: 'Drainage pathway',
  category: 'definitive',
  description:
    'Represents escalation to an urgent supervised drainage pathway, not procedural instruction.',
  response: 'Pericardial constraint falls and biventricular filling/flow begin to recover.',
  onsetSeconds: 8,
  parameterDeltas: { pericardialPressureMmHg: -14, referenceCardiacOutputLMin: 0.5 },
})

const correctMeasurement = intervention({
  id: 'correct-measurement-system',
  label: 'Re-level, re-zero, inspect tubing, and repeat the fast-flush test',
  shortLabel: 'Correct signal system',
  category: 'assessment',
  description: 'Treat the signal before treating the patient when internal consistency fails.',
  response:
    'Hydrostatic offset and dynamic-response artifacts are corrected. Re-read the waveform.',
  onsetSeconds: 1,
  parameterDeltas: {},
})

const repositionCatheter = intervention({
  id: 'reposition-catheter',
  label: 'Deflate and return the catheter to a confirmed PA position',
  shortLabel: 'Restore PA position',
  category: 'assessment',
  description:
    'Corrects wall contact or false-wedge morphology before interpreting PAWP or shooting CO.',
  response:
    'A pulsatile PA waveform returns; repeat measurements only after position confirmation.',
  onsetSeconds: 1,
  parameterDeltas: {},
})

const repeatThermodilution = intervention({
  id: 'repeat-valid-thermodilution',
  label: 'Repeat thermodilution with standardized technique',
  shortLabel: 'Repeat valid CO',
  category: 'assessment',
  description:
    'Obtain at least three internally consistent curves after signal and catheter validation.',
  response: 'The monitor is ready for a standardized series of up to six trials.',
  onsetSeconds: 1,
  parameterDeltas: {},
})

const commonMechanisms = [
  { id: 'underfilled', label: 'Underfilled, preload-responsive circulation' },
  { id: 'vasodilatory', label: 'Vasodilatory/distributive shock' },
  { id: 'lv-failure', label: 'LV-predominant pump failure' },
  { id: 'rv-afterload', label: 'Acute RV pressure overload' },
  { id: 'tamponade', label: 'Pericardial constraint/tamponade physiology' },
  { id: 'artifact', label: 'Measurement-system and catheter artifact' },
] as const

const commonPriorities = [
  { id: 'validate-preload', label: 'Validate dynamic preload responsiveness before more fluid' },
  { id: 'restore-map', label: 'Restore vascular tone toward an initial MAP near 65 mmHg' },
  { id: 'support-flow', label: 'Support forward flow while limiting congestion' },
  { id: 'unload-rv', label: 'Reduce RV afterload and activate definitive treatment' },
  { id: 'relieve-constraint', label: 'Escalate urgently to relieve pericardial constraint' },
  { id: 'validate-signal', label: 'Validate the signal before treating the displayed number' },
] as const

const standardThermodilution = {
  injectateVolumeMl: 10,
  injectateTemperatureC: 5,
  maximumTrials: 6,
  minimumAcceptedTrials: 3,
} as const

export const hemodynamicCases: readonly HemodynamicCaseDefinition[] = [
  {
    id: 'HD-01',
    version: '1.0.0',
    station: 'preload-and-flow',
    title: 'A narrow pulse pressure after volume loss',
    shortTitle: 'Underfilled shock',
    presentation:
      'An adult remains tachycardic with cool extremities after acute volume loss. The arterial trace is narrow; filling pressures are low.',
    learningObjectives: [
      'Use a reversible dynamic test before fluid.',
      'Reassess stroke volume and congestion after each bounded volume step.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 116,
      referenceCardiacOutputLMin: 6,
      circulatingVolumeFraction: 0.72,
      systemicVascularResistanceDynSecCm5: 1450,
      rightAtrialPressureSetPointMmHg: 1,
      leftAtrialPressureSetPointMmHg: 4,
      mixedVenousOxygenSaturationPercent: 57,
      fluidResponsiveness: 1,
    },
    initialMeasurementSystem: { zeroed: false },
    initialCatheterPosition: 'pa',
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'underfilled',
    correctPriorityId: 'validate-preload',
    interventions: [plr, fluidStep, norepinephrine, dobutamine, increasePeepUnsafe],
    requiredInterventionIds: ['passive-leg-raise', 'fluid-250'],
    unsafeInterventionIds: ['peep-up-unsafe'],
    successCriteria: [
      { metric: 'cardiacOutputLMin', operator: 'at-least', value: 4.5, label: 'CO ≥ 4.5 L/min' },
      { metric: 'mapMmHg', operator: 'at-least', value: 65, label: 'MAP ≥ 65 mmHg' },
    ],
    guidedPrompt:
      'First prove that transient preload recruitment raises flow; a low RAP or PAWP alone is not the fluid decision.',
    debrief: [
      'Dynamic change in flow is more informative than an isolated filling pressure.',
      'Repeat 250 mL steps only while benefit exceeds congestion risk.',
    ],
    sourceIds: sharedSources,
    safetyCriticalErrorIds: ['peep-up-unsafe'],
  },
  {
    id: 'HD-02',
    version: '1.0.0',
    station: 'vascular-tone',
    title: 'Warm shock with a low diastolic pressure',
    shortTitle: 'Vasodilatory sepsis',
    presentation:
      'An adult with suspected infection has warm extremities, a bounding pulse, low diastolic pressure, and persistent hypotension after initial resuscitation.',
    learningObjectives: [
      'Recognize low vascular tone with preserved/high flow.',
      'Use dynamic assessment and serial perfusion reassessment rather than reflex fluid.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 112,
      referenceCardiacOutputLMin: 7.2,
      circulatingVolumeFraction: 0.9,
      systemicVascularResistanceDynSecCm5: 520,
      systemicArterialComplianceMlMmHg: 1.9,
      mixedVenousOxygenSaturationPercent: 70,
      fluidResponsiveness: 0.45,
    },
    initialMeasurementSystem: { zeroed: false },
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'vasodilatory',
    correctPriorityId: 'restore-map',
    interventions: [plr, fluidStep, norepinephrine, vasopressin, dobutamine],
    requiredInterventionIds: ['norepinephrine-up'],
    unsafeInterventionIds: [],
    successCriteria: [
      { metric: 'mapMmHg', operator: 'at-least', value: 65, label: 'MAP ≥ 65 mmHg' },
    ],
    guidedPrompt:
      'The initial modeled MAP target is around 65 mmHg; individualize after serial perfusion assessment.',
    debrief: [
      'Norepinephrine is represented as the first vascular-tone tier.',
      'Fluid is conditional on dynamic responsiveness and repeated assessment.',
    ],
    sourceIds: [...sharedSources, 'ssc-sepsis-2026'],
    safetyCriticalErrorIds: [],
  },
  {
    id: 'HD-03',
    version: '1.0.0',
    station: 'pump-failure',
    title: 'Low flow with pulmonary congestion',
    shortTitle: 'LV cardiogenic shock',
    presentation:
      'An adult has cool extremities, pulmonary edema, a high PAWP, and a low cardiac index despite compensatory vascular tone.',
    learningObjectives: [
      'Distinguish congestion from preload responsiveness.',
      'Balance inotropic flow support with decongestion and pressure.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 104,
      referenceCardiacOutputLMin: 5,
      circulatingVolumeFraction: 1.12,
      systemicVascularResistanceDynSecCm5: 1550,
      leftVentricularContractility: 0.42,
      leftVentricularCompliance: 0.5,
      leftAtrialPressureSetPointMmHg: 18,
      rightAtrialPressureSetPointMmHg: 7,
      mixedVenousOxygenSaturationPercent: 50,
      fluidResponsiveness: 0.1,
    },
    initialMeasurementSystem: { zeroed: false },
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'lv-failure',
    correctPriorityId: 'support-flow',
    interventions: [dobutamine, milrinone, diuresis, fluidStep, norepinephrine],
    requiredInterventionIds: ['dobutamine-up', 'diuresis-step'],
    unsafeInterventionIds: ['fluid-250'],
    successCriteria: [
      {
        metric: 'cardiacIndexLMinM2',
        operator: 'at-least',
        value: 2.2,
        label: 'CI ≥ 2.2 L/min/m²',
      },
      { metric: 'pawpMmHg', operator: 'at-most', value: 22, label: 'PAWP ≤ 22 mmHg' },
    ],
    guidedPrompt:
      'High filling pressure does not prove adequate forward flow. Treat perfusion and congestion as linked but distinct targets.',
    debrief: [
      'Echo remains first-line imaging for shock mechanism.',
      'PAC trends can help follow flow and filling-pressure response when shock persists.',
    ],
    sourceIds: sharedSources,
    safetyCriticalErrorIds: [],
  },
  {
    id: 'HD-04',
    version: '1.0.0',
    station: 'rv-afterload',
    title: 'Abrupt RV pressure overload',
    shortTitle: 'Acute PE / RV shock',
    presentation:
      'An adult develops sudden hypoxemia, systemic hypotension, high RAP, high PAP, and a low-flow state with a relatively low PAWP.',
    learningObjectives: [
      'Recognize acute RV afterload failure.',
      'Use a selective bridge while activating definitive PE treatment.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 122,
      referenceCardiacOutputLMin: 5.5,
      pulmonaryVascularResistanceWU: 7,
      pulmonaryArterialComplianceMlMmHg: 1.5,
      rightVentricularContractility: 0.5,
      rightVentricularCompliance: 0.55,
      rightAtrialPressureSetPointMmHg: 6,
      leftAtrialPressureSetPointMmHg: 6,
      arterialOxygenSaturationPercent: 88,
      mixedVenousOxygenSaturationPercent: 48,
      fluidResponsiveness: 0.1,
    },
    initialMeasurementSystem: { zeroed: false },
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'rv-afterload',
    correctPriorityId: 'unload-rv',
    interventions: [
      inhaledPulmonaryVasodilator,
      systemicPulmonaryVasodilator,
      reperfusion,
      fluidStep,
      increasePeepUnsafe,
    ],
    requiredInterventionIds: ['inhaled-pulmonary-vasodilator', 'pe-reperfusion'],
    unsafeInterventionIds: ['peep-up-unsafe', 'fluid-250'],
    successCriteria: [
      { metric: 'cardiacIndexLMinM2', operator: 'at-least', value: 2, label: 'CI ≥ 2.0 L/min/m²' },
      { metric: 'meanPapMmHg', operator: 'at-most', value: 30, label: 'mPAP ≤ 30 mmHg' },
    ],
    guidedPrompt:
      'The RV needs afterload relief and definitive treatment, not indiscriminate volume or higher intrathoracic pressure.',
    debrief: [
      'Inhaled pulmonary vasodilation is modeled only as a selective bridge.',
      'Definitive PE treatment is case-specific and outside this simulator’s procedural scope.',
    ],
    sourceIds: sharedSources,
    safetyCriticalErrorIds: ['peep-up-unsafe'],
  },
  {
    id: 'HD-05',
    version: '1.0.0',
    station: 'pulmonary-hypertension',
    title: 'Decompensated pre-capillary PH with RV failure',
    shortTitle: 'Precapillary PH crisis',
    presentation:
      'An adult with known pulmonary vascular disease has rising RAP, low output, high PAP, and PAWP ≤15 mmHg.',
    learningObjectives: [
      'Apply the current >2 WU pre-capillary definition.',
      'Support RV flow while reducing afterload and avoiding systemic hypotension.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 110,
      referenceCardiacOutputLMin: 5,
      circulatingVolumeFraction: 1.04,
      pulmonaryVascularResistanceWU: 8,
      pulmonaryArterialComplianceMlMmHg: 1.2,
      rightVentricularContractility: 0.46,
      rightVentricularCompliance: 0.45,
      rightAtrialPressureSetPointMmHg: 7,
      leftAtrialPressureSetPointMmHg: 7,
      mixedVenousOxygenSaturationPercent: 48,
      tricuspidRegurgitationSeverity: 0.45,
      fluidResponsiveness: 0.1,
    },
    initialMeasurementSystem: { zeroed: false },
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'rv-afterload',
    correctPriorityId: 'unload-rv',
    interventions: [
      inhaledPulmonaryVasodilator,
      systemicPulmonaryVasodilator,
      milrinone,
      diuresis,
      fluidStep,
    ],
    requiredInterventionIds: ['inhaled-pulmonary-vasodilator', 'milrinone-up'],
    unsafeInterventionIds: ['fluid-250'],
    successCriteria: [
      { metric: 'cardiacIndexLMinM2', operator: 'at-least', value: 2, label: 'CI ≥ 2.0 L/min/m²' },
      { metric: 'rapMmHg', operator: 'at-most', value: 14, label: 'RAP ≤ 14 mmHg' },
    ],
    guidedPrompt:
      'Pre-capillary physiology is mPAP >20 mmHg, PAWP ≤15 mmHg, and PVR >2 WU in current guidance.',
    debrief: [
      'The model uses >2 WU, not the historical 3-WU threshold.',
      'Treatment evidence is less certain in the 2–3 WU range; classification is not itself a treatment instruction.',
    ],
    sourceIds: [...sharedSources, 'esc-ers-ph-2022'],
    safetyCriticalErrorIds: [],
  },
  {
    id: 'HD-06',
    version: '1.0.0',
    station: 'congestion-and-peep',
    title: 'Post-capillary PH with biventricular congestion',
    shortTitle: 'Congestion + PEEP',
    presentation:
      'An intubated adult has high RAP, elevated PAWP, secondary pulmonary hypertension, reduced flow, and substantial PEEP transmission.',
    learningObjectives: [
      'Separate post-capillary pressure from PVR.',
      'Reassess filling pressure and flow after decongestion and PEEP changes.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 96,
      referenceCardiacOutputLMin: 5.2,
      circulatingVolumeFraction: 1.16,
      systemicVascularResistanceDynSecCm5: 1200,
      pulmonaryVascularResistanceWU: 3,
      pulmonaryArterialComplianceMlMmHg: 2,
      leftVentricularContractility: 0.7,
      rightVentricularContractility: 0.72,
      leftVentricularCompliance: 0.55,
      rightVentricularCompliance: 0.65,
      rightAtrialPressureSetPointMmHg: 8,
      leftAtrialPressureSetPointMmHg: 18,
      peepCmH2O: 12,
      mixedVenousOxygenSaturationPercent: 54,
      fluidResponsiveness: 0.05,
    },
    initialMeasurementSystem: { zeroed: false },
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'lv-failure',
    correctPriorityId: 'support-flow',
    interventions: [diuresis, decreasePeep, dobutamine, fluidStep, inhaledPulmonaryVasodilator],
    requiredInterventionIds: ['diuresis-step', 'peep-down'],
    unsafeInterventionIds: ['fluid-250'],
    successCriteria: [
      { metric: 'pawpMmHg', operator: 'at-most', value: 22, label: 'PAWP ≤ 22 mmHg' },
      { metric: 'cardiacIndexLMinM2', operator: 'at-least', value: 2, label: 'CI ≥ 2.0 L/min/m²' },
    ],
    guidedPrompt:
      'Measured PAWP includes intrathoracic-pressure transmission; interpret it with end-expiratory technique and the ventilator context.',
    debrief: [
      'A PEEP change can alter both measured pressure and true loading.',
      'Preserve oxygenation/recruitment while testing hemodynamic effects.',
    ],
    sourceIds: sharedSources,
    safetyCriticalErrorIds: [],
  },
  {
    id: 'HD-07',
    version: '1.0.0',
    station: 'obstructive-shock',
    title: 'Pressure equalization with a falling pulse pressure',
    shortTitle: 'Cardiac tamponade',
    presentation:
      'An adult has hypotension, tachycardia, high and converging diastolic filling pressures, and respiratory variation in flow.',
    learningObjectives: [
      'Recognize pericardial constraint as an obstructive mechanism.',
      'Prioritize urgent definitive escalation rather than normalizing a single number.',
    ],
    initialParameters: {
      ...baseParameters,
      heartRateBpm: 118,
      referenceCardiacOutputLMin: 5.5,
      circulatingVolumeFraction: 0.95,
      systemicVascularResistanceDynSecCm5: 1250,
      pericardialPressureMmHg: 14,
      rightAtrialPressureSetPointMmHg: 3,
      leftAtrialPressureSetPointMmHg: 7,
      pleuralPressureSwingMmHg: 6,
      mixedVenousOxygenSaturationPercent: 48,
      fluidResponsiveness: 0.4,
    },
    initialMeasurementSystem: { zeroed: false },
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'tamponade',
    correctPriorityId: 'relieve-constraint',
    interventions: [pericardialDrainage, fluidStep, norepinephrine, increasePeepUnsafe],
    requiredInterventionIds: ['pericardial-drainage'],
    unsafeInterventionIds: ['peep-up-unsafe'],
    successCriteria: [
      {
        metric: 'cardiacIndexLMinM2',
        operator: 'at-least',
        value: 2.2,
        label: 'CI ≥ 2.2 L/min/m²',
      },
      { metric: 'mapMmHg', operator: 'at-least', value: 65, label: 'MAP ≥ 65 mmHg' },
    ],
    guidedPrompt:
      'This pattern requires urgent clinical confirmation and definitive escalation; a PAC never replaces bedside echo.',
    debrief: [
      'Echocardiography is first-line shock imaging.',
      'A pressure pattern supports physiology but does not independently diagnose or authorize a procedure.',
    ],
    sourceIds: sharedSources,
    safetyCriticalErrorIds: ['peep-up-unsafe'],
  },
  {
    id: 'HD-08',
    version: '1.0.0',
    station: 'signal-validation',
    title: 'The numbers do not fit the patient',
    shortTitle: 'Artifacts and false wedge',
    presentation:
      'The monitor shows internally inconsistent pressures and erratic thermodilution curves while bedside perfusion appears unchanged.',
    learningObjectives: [
      'Recognize hydrostatic, damping, catheter-position, and injectate artifacts.',
      'Correct the measurement chain before changing management.',
    ],
    initialParameters: { ...baseParameters, heartRateBpm: 88, referenceCardiacOutputLMin: 5.6 },
    initialMeasurementSystem: {
      zeroed: false,
      transducerLevelCm: 10,
      dampingRatio: 0.28,
      artifact: 'false-wedge',
      noiseAmplitudeMmHg: 0.8,
    },
    initialCatheterPosition: 'wedge',
    thermodilution: standardThermodilution,
    mechanismOptions: commonMechanisms,
    priorityOptions: commonPriorities,
    correctMechanismId: 'artifact',
    correctPriorityId: 'validate-signal',
    interventions: [
      correctMeasurement,
      repositionCatheter,
      repeatThermodilution,
      fluidStep,
      norepinephrine,
    ],
    requiredInterventionIds: [
      'correct-measurement-system',
      'reposition-catheter',
      'repeat-valid-thermodilution',
    ],
    unsafeInterventionIds: ['fluid-250', 'norepinephrine-up'],
    successCriteria: [
      {
        metric: 'cardiacOutputLMin',
        operator: 'at-least',
        value: 4.5,
        label: 'Validated CO ≥ 4.5 L/min',
      },
    ],
    guidedPrompt:
      'Internal inconsistency is a signal-validation problem until proven otherwise. Inspect level, zero, dynamic response, catheter position, and curve technique.',
    debrief: [
      'Hydrostatic error changes all displayed invasive pressures.',
      'A false wedge and poor thermodilution curve should be rejected, not averaged into certainty.',
    ],
    sourceIds: [...sharedSources, 'monitor-workflow-supplied'],
    safetyCriticalErrorIds: [],
  },
] as const

export const hemodynamicCaseById = new Map(
  hemodynamicCases.map((definition) => [definition.id, definition]),
)
