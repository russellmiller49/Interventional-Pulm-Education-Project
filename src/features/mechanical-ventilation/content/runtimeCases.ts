import type {
  MechanicalVentilationSettings,
  InterventionDefinition,
  InterventionEffectId,
  MetricCondition,
  PatientModelState,
  PhenotypeId,
  PredictionOption,
  StationId,
  VentilationCaseDefinition,
} from '../engine/types'
import { createDefaultAdvancedVentilationSettings } from '../engine/modes'
import { mechanicalVentilationSource, validateRuntimeCaseRegistry } from './schema'

const sourceCaseById = new Map(
  mechanicalVentilationSource.cases.map((sourceCase) => [sourceCase.id, sourceCase]),
)

const stationCases: Record<StationId, readonly string[]> = {
  'lung-protection-demand': ['MV-01', 'MV-02', 'MV-03'],
  'effort-triggering': ['MV-04', 'MV-07', 'MV-08'],
  'obstructive-mechanics': ['MV-05', 'MV-06', 'MV-10'],
  'pressure-support-timing': ['MV-09', 'MV-11', 'MV-12'],
  'deterioration-whole-patient': ['MV-13', 'MV-14', 'MV-15'],
}

export const ventilationStations: readonly {
  id: StationId
  label: string
  description: string
  caseIds: readonly string[]
}[] = [
  {
    id: 'lung-protection-demand',
    label: 'Lung protection & demand',
    description: 'Recruitment, flow delivery, and stacked inflation.',
    caseIds: stationCases['lung-protection-demand'],
  },
  {
    id: 'effort-triggering',
    label: 'Effort & triggering',
    description: 'Reverse triggering, weak efforts, and machine autotriggering.',
    caseIds: stationCases['effort-triggering'],
  },
  {
    id: 'obstructive-mechanics',
    label: 'Obstructive mechanics',
    description: 'Dynamic hyperinflation, obstructive shock, and delayed cycling.',
    caseIds: stationCases['obstructive-mechanics'],
  },
  {
    id: 'pressure-support-timing',
    label: 'Pressure-support timing & dose',
    description: 'Premature cycling, P-ramp mismatch, and over-assistance.',
    caseIds: stationCases['pressure-support-timing'],
  },
  {
    id: 'deterioration-whole-patient',
    label: 'Deterioration & whole-patient care',
    description: 'Airway resistance, compliance collapse, and distress.',
    caseIds: stationCases['deterioration-whole-patient'],
  },
] as const

const interventionCatalog: Record<InterventionEffectId, InterventionDefinition> = {
  'assess-patient': {
    id: 'assess-patient',
    label: 'Assess the patient at the bedside',
    category: 'assessment',
    description: 'Examine chest movement, breath sounds, effort, comfort, and hemodynamics.',
    response: 'The bedside examination is added to the case record.',
    effectId: 'assess-patient',
    latencySeconds: 0,
  },
  'review-waveforms': {
    id: 'review-waveforms',
    label: 'Review pressure, flow, and volume together',
    category: 'assessment',
    description: 'Freeze or follow several breaths and compare trigger, target/flow, and cycle.',
    response: 'Waveform review is documented for reassessment credit.',
    effectId: 'review-waveforms',
    latencySeconds: 0,
    repeatable: true,
  },
  'inspiratory-hold': {
    id: 'inspiratory-hold',
    label: 'Perform an inspiratory hold',
    category: 'ventilator',
    description: 'Use Tools > Hold to obtain a simulated plateau pressure.',
    response: 'The waveform freezes and plateau pressure becomes available.',
    effectId: 'inspiratory-hold',
    latencySeconds: 10,
    repeatable: true,
  },
  'expiratory-hold': {
    id: 'expiratory-hold',
    label: 'Perform an expiratory hold',
    category: 'ventilator',
    description: 'Use Tools > Hold to estimate total intrinsic PEEP.',
    response: 'The waveform freezes and simulated intrinsic PEEP is measured.',
    effectId: 'expiratory-hold',
    latencySeconds: 10,
    repeatable: true,
  },
  'order-abg': {
    id: 'order-abg',
    label: 'Order a repeat arterial blood gas',
    category: 'assessment',
    description: 'Sample gas exchange after allowing enough simulated time for a response.',
    response: 'A new simulated ABG is recorded from the current gas-exchange state.',
    effectId: 'order-abg',
    latencySeconds: 60,
    repeatable: true,
  },
  'communicate-plan': {
    id: 'communicate-plan',
    label: 'State the plan and close the loop',
    category: 'comfort-communication',
    description: 'Name the safety goal, action, and required reassessment to the team or patient.',
    response: 'The plan is communicated with a closed-loop reassessment request.',
    effectId: 'communicate-plan',
    latencySeconds: 0,
  },
  'disconnect-bag': {
    id: 'disconnect-bag',
    label: 'Disconnect and manually ventilate while assessing',
    category: 'airway-circuit',
    description:
      'Temporarily separate patient and ventilator causes while maintaining oxygenation and airway patency.',
    response:
      'Trapped gas can escape; manual ventilation reveals whether resistance remains patient-side.',
    effectId: 'disconnect-bag',
    latencySeconds: 20,
  },
  'treat-drive': {
    id: 'treat-drive',
    label: 'Treat fever, pain, agitation, or metabolic drive',
    category: 'medication',
    description: 'Address the case-specific non-ventilator cause of elevated respiratory drive.',
    response: 'Neural drive and distress begin to improve over several simulated minutes.',
    effectId: 'treat-drive',
    latencySeconds: 180,
  },
  'reduce-sedation': {
    id: 'reduce-sedation',
    label: 'Reassess and reduce excessive sedation',
    category: 'medication',
    description:
      'Lighten sedation when clinically appropriate and watch for return of variable patient effort.',
    response: 'Respiratory variability increases and deep-sedation burden falls.',
    effectId: 'reduce-sedation',
    latencySeconds: 120,
  },
  'deepen-sedation': {
    id: 'deepen-sedation',
    label: 'Deepen sedation without correcting the mechanism',
    category: 'medication',
    description:
      'Suppress visible respiratory effort without addressing timing, load, pain, or delirium.',
    response: 'Visible effort falls, but the uncorrected mechanism and sedation risk remain.',
    effectId: 'deepen-sedation',
    latencySeconds: 45,
    unsafe: true,
  },
  'neuromuscular-blockade': {
    id: 'neuromuscular-blockade',
    label: 'Use temporary neuromuscular blockade',
    category: 'medication',
    description:
      'Temporize only when immediate lung protection requires it while the cause is corrected.',
    response:
      'Patient effort stops temporarily; this does not by itself correct ventilator timing.',
    effectId: 'neuromuscular-blockade',
    latencySeconds: 30,
  },
  bronchodilator: {
    id: 'bronchodilator',
    label: 'Administer bronchodilator therapy',
    category: 'medication',
    description: 'Treat reversible bronchospasm and reassess resistance over time.',
    response: 'Airway resistance begins to fall over 5–15 simulated minutes.',
    effectId: 'bronchodilator',
    latencySeconds: 300,
  },
  'suction-airway': {
    id: 'suction-airway',
    label: 'Suction and reassess airway patency',
    category: 'airway-circuit',
    description: 'Use an appropriate suctioning workflow and check catheter passage.',
    response:
      'Secretions may clear; difficult catheter passage supports persistent tube obstruction.',
    effectId: 'suction-airway',
    latencySeconds: 30,
    repeatable: true,
  },
  'inspect-circuit': {
    id: 'inspect-circuit',
    label: 'Inspect the circuit, cuff, HME, and connections',
    category: 'airway-circuit',
    description: 'Look for condensate, leak, disconnection, obstruction, and tube position.',
    response: 'The active circuit or airway branch is localized without changing it.',
    effectId: 'inspect-circuit',
    latencySeconds: 20,
  },
  'drain-condensate': {
    id: 'drain-condensate',
    label: 'Drain circuit condensate safely',
    category: 'airway-circuit',
    description: 'Remove oscillating water after the circuit inspection identifies it.',
    response: 'Artifact flow oscillations and false triggers stop immediately.',
    effectId: 'drain-condensate',
    latencySeconds: 10,
    prerequisites: ['inspect-circuit'],
  },
  'correct-leak': {
    id: 'correct-leak',
    label: 'Correct the cuff or circuit leak',
    category: 'airway-circuit',
    description: 'Repair the identified leak while preserving safe ventilation.',
    response: 'Leak flow, false triggers, and delayed cycling decrease.',
    effectId: 'correct-leak',
    latencySeconds: 20,
    prerequisites: ['inspect-circuit'],
  },
  'remove-hme': {
    id: 'remove-hme',
    label: 'Remove the obstructed HME',
    category: 'airway-circuit',
    description: 'Remove the identified blocked component and restore a patent circuit.',
    response: 'Peak pressure and resistive load fall immediately if the HME is the cause.',
    effectId: 'remove-hme',
    latencySeconds: 5,
    prerequisites: ['inspect-circuit'],
  },
  'reposition-ett': {
    id: 'reposition-ett',
    label: 'Correct or exchange the obstructed ETT',
    category: 'airway-circuit',
    description:
      'Escalate a persistent kink or tube obstruction according to local airway practice.',
    response: 'Tube resistance falls after definitive correction.',
    effectId: 'reposition-ett',
    latencySeconds: 60,
    prerequisites: ['inspect-circuit'],
  },
  'decompress-pneumothorax': {
    id: 'decompress-pneumothorax',
    label: 'Perform emergency decompression',
    category: 'procedure',
    description:
      'Treat suspected tension pneumothorax immediately according to local emergency practice.',
    response: 'Compliance, oxygenation, and blood pressure improve abruptly but temporarily.',
    effectId: 'decompress-pneumothorax',
    latencySeconds: 15,
  },
  'pleural-drainage': {
    id: 'pleural-drainage',
    label: 'Establish definitive pleural drainage',
    category: 'procedure',
    description:
      'Complete definitive management after emergency decompression using local supervised practice.',
    response: 'The compliance and hemodynamic improvement is sustained.',
    effectId: 'pleural-drainage',
    latencySeconds: 90,
    prerequisites: ['decompress-pneumothorax'],
  },
  'communication-board': {
    id: 'communication-board',
    label: 'Establish a communication method',
    category: 'comfort-communication',
    description:
      'Use a board, pointing scale, blink response, or writing aid to characterize dyspnea.',
    response: 'The patient can describe air hunger, effort, pain, and timing more reliably.',
    effectId: 'communication-board',
    latencySeconds: 20,
  },
  'treat-pain': {
    id: 'treat-pain',
    label: 'Treat pain with a least-sedating strategy',
    category: 'medication',
    description: 'Address pain while preserving communication and respiratory assessment.',
    response: 'Pain and respiratory drive decrease without deep sedation.',
    effectId: 'treat-pain',
    latencySeconds: 120,
  },
  'relieve-bladder': {
    id: 'relieve-bladder',
    label: 'Identify and relieve urinary retention',
    category: 'comfort-communication',
    description: 'Treat bladder distension as a reversible source of distress.',
    response: 'Pain, agitation, and dyspnea burden decrease.',
    effectId: 'relieve-bladder',
    latencySeconds: 60,
  },
  reorient: {
    id: 'reorient',
    label: 'Reorient and normalize the environment',
    category: 'comfort-communication',
    description: 'Provide calm reorientation and consistent cues.',
    response: 'Anxiety and delirium burden begin to improve.',
    effectId: 'reorient',
    latencySeconds: 120,
  },
  'reduce-noise': {
    id: 'reduce-noise',
    label: 'Reduce nighttime disruption',
    category: 'comfort-communication',
    description: 'Reduce noise and unnecessary stimulation and support sleep/wake orientation.',
    response: 'Delirium-promoting environmental burden falls over time.',
    effectId: 'reduce-noise',
    latencySeconds: 300,
  },
  'assess-strength': {
    id: 'assess-strength',
    label: 'Assess strength and liberation readiness',
    category: 'assessment',
    description:
      'Reassess neuromuscular strength, fatigue, tube load, and readiness for assisted breathing.',
    response: 'Weak drive and imposed-load contributors are documented.',
    effectId: 'assess-strength',
    latencySeconds: 30,
  },
  'prone-plan': {
    id: 'prone-plan',
    label: 'Escalate lung-protective ARDS care',
    category: 'procedure',
    description:
      'Document prone-positioning or escalation planning without replacing the ventilator-focused task.',
    response:
      'Advanced ARDS escalation is acknowledged while the core mechanics remain under review.',
    effectId: 'prone-plan',
    latencySeconds: 0,
  },
}

interface CaseProfile {
  stationId: StationId
  phenotype: PhenotypeId
  mechanismLabel: string
  priorityId: string
  priorityLabel: string
  responseId: string
  responseLabel: string
  interventionIds: readonly InterventionEffectId[]
  requiredInterventionIds: readonly string[]
  requiredReassessmentIds: readonly string[]
  successConditions: readonly MetricCondition[]
  branchOptions: readonly string[]
  baselineSeconds: number
}

const caseProfiles: Record<string, CaseProfile> = {
  'MV-01': {
    stationId: 'lung-protection-demand',
    phenotype: 'ards-recruitment',
    mechanismLabel: 'Recruitment followed by overdistension',
    priorityId: 'protect-lung',
    priorityLabel: 'Protect the lung while restoring oxygenation',
    responseId: 'recruit-with-safe-plateau',
    responseLabel: 'SpO₂ improves while plateau pressure and MAP remain safe',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'inspiratory-hold',
      'order-abg',
      'communicate-plan',
      'prone-plan',
    ],
    requiredInterventionIds: ['inspiratory-hold'],
    requiredReassessmentIds: ['inspiratory-hold', 'review-waveforms'],
    successConditions: [
      { metric: 'patient.gasExchange.spo2Percent', comparator: 'gte', value: 88 },
      { metric: 'measurements.relaxedPlateauPressureCmH2O', comparator: 'lte', value: 30 },
    ],
    branchOptions: ['standard'],
    baselineSeconds: 30,
  },
  'MV-02': {
    stationId: 'lung-protection-demand',
    phenotype: 'flow-starvation',
    mechanismLabel: 'Inspiratory flow below patient demand',
    priorityId: 'match-demand',
    priorityLabel: 'Match flow while preserving lung-protective volume',
    responseId: 'smooth-paw',
    responseLabel: 'Pressure scooping and effort decrease without larger VT',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'order-abg',
      'treat-drive',
      'communicate-plan',
    ],
    requiredInterventionIds: ['treat-drive'],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [{ metric: 'patient.human.dyspneaScore', comparator: 'lte', value: 4 }],
    branchOptions: ['high-metabolic-drive'],
    baselineSeconds: 30,
  },
  'MV-03': {
    stationId: 'lung-protection-demand',
    phenotype: 'double-triggering',
    mechanismLabel: 'Mechanical inspiration shorter than neural inspiration',
    priorityId: 'avoid-stacked-volume',
    priorityLabel: 'Stop stacked inflation while preserving protection',
    responseId: 'reduce-stacking',
    responseLabel: 'One inflation occurs per neural effort',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'treat-drive',
      'reduce-sedation',
      'deepen-sedation',
      'neuromuscular-blockade',
      'communicate-plan',
    ],
    requiredInterventionIds: [],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [
      { metric: 'measurements.relaxedPlateauPressureCmH2O', comparator: 'lte', value: 30 },
    ],
    branchOptions: ['short-machine-ti'],
    baselineSeconds: 30,
  },
  'MV-04': {
    stationId: 'effort-triggering',
    phenotype: 'reverse-triggering',
    mechanismLabel: 'Machine-triggered neural effort with fixed entrainment',
    priorityId: 'break-entrainment',
    priorityLabel: 'Break entrainment without unnecessary deep sedation',
    responseId: 'restore-variability',
    responseLabel: 'Fixed post-inflation effort and stacking resolve',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'reduce-sedation',
      'deepen-sedation',
      'neuromuscular-blockade',
      'communicate-plan',
    ],
    requiredInterventionIds: [],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [{ metric: 'measurements.stackedVolumeMl', comparator: 'lte', value: 500 }],
    branchOptions: ['entrainment-1:1', 'entrainment-1:2'],
    baselineSeconds: 45,
  },
  'MV-05': {
    stationId: 'obstructive-mechanics',
    phenotype: 'copd-ineffective-efforts',
    mechanismLabel: 'Dynamic hyperinflation creates a trigger threshold load',
    priorityId: 'restore-exhalation',
    priorityLabel: 'Reduce hyperinflation before adding support',
    responseId: 'flow-zero-capture',
    responseLabel: 'Expiratory flow nears zero and missed efforts fall',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'expiratory-hold',
      'bronchodilator',
      'suction-airway',
      'communicate-plan',
    ],
    requiredInterventionIds: ['expiratory-hold'],
    requiredReassessmentIds: ['expiratory-hold', 'review-waveforms'],
    successConditions: [
      { metric: 'measurements.intrinsicPeepCmH2O', comparator: 'lte', value: 7 },
      { metric: 'measurements.ineffectiveEffortFraction', comparator: 'lte', value: 0.15 },
    ],
    branchOptions: ['pressure-support-dominant', 'cycling-dominant', 'trigger-dominant'],
    baselineSeconds: 45,
  },
  'MV-06': {
    stationId: 'obstructive-mechanics',
    phenotype: 'asthma-obstructive-shock',
    mechanismLabel: 'Extreme dynamic hyperinflation causing obstructive shock',
    priorityId: 'decompress-trapped-gas',
    priorityLabel: 'Permit exhalation and restore circulation immediately',
    responseId: 'map-flow-recover',
    responseLabel: 'MAP rises and expiratory flow approaches zero',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'disconnect-bag',
      'expiratory-hold',
      'bronchodilator',
      'suction-airway',
      'order-abg',
      'communicate-plan',
    ],
    requiredInterventionIds: ['disconnect-bag', 'bronchodilator'],
    requiredReassessmentIds: ['expiratory-hold', 'assess-patient'],
    successConditions: [
      { metric: 'patient.hemodynamics.mapMmHg', comparator: 'gte', value: 60 },
      { metric: 'measurements.intrinsicPeepCmH2O', comparator: 'lte', value: 10 },
    ],
    branchOptions: ['unstable-asthma'],
    baselineSeconds: 10,
  },
  'MV-07': {
    stationId: 'effort-triggering',
    phenotype: 'weak-trigger',
    mechanismLabel: 'Weak effort cannot cross the trigger threshold',
    priorityId: 'capture-without-autotrigger',
    priorityLabel: 'Improve effort capture without causing autotriggering',
    responseId: 'fewer-missed-efforts',
    responseLabel: 'Neural and displayed rates converge without false breaths',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'assess-strength',
      'order-abg',
      'communicate-plan',
    ],
    requiredInterventionIds: ['assess-strength'],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [
      { metric: 'measurements.ineffectiveEffortFraction', comparator: 'lte', value: 0.15 },
      { metric: 'measurements.autotriggerFraction', comparator: 'lte', value: 0.1 },
    ],
    branchOptions: ['weak-effort'],
    baselineSeconds: 30,
  },
  'MV-08': {
    stationId: 'effort-triggering',
    phenotype: 'autotriggering',
    mechanismLabel: 'Circuit artifact crosses an oversensitive trigger',
    priorityId: 'localize-artifact',
    priorityLabel: 'Inspect the circuit before suppressing patient drive',
    responseId: 'false-breaths-stop',
    responseLabel: 'Ventilator rate returns toward the true neural rate',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'inspect-circuit',
      'drain-condensate',
      'correct-leak',
      'disconnect-bag',
      'order-abg',
      'communicate-plan',
    ],
    requiredInterventionIds: ['inspect-circuit'],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [
      { metric: 'measurements.autotriggerFraction', comparator: 'lte', value: 0.1 },
    ],
    branchOptions: ['condensate', 'leak', 'cardiogenic-oscillation'],
    baselineSeconds: 30,
  },
  'MV-09': {
    stationId: 'pressure-support-timing',
    phenotype: 'premature-cycling',
    mechanismLabel: 'Ventilator cycles before neural inspiration ends',
    priorityId: 'lengthen-machine-ti',
    priorityLabel: 'Match mechanical and neural inspiration without excessive VT',
    responseId: 'cycle-later',
    responseLabel: 'Expiratory distortion and double triggering resolve',
    interventionIds: ['assess-patient', 'review-waveforms', 'treat-pain', 'communicate-plan'],
    requiredInterventionIds: [],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [{ metric: 'patient.human.dyspneaScore', comparator: 'lte', value: 4 }],
    branchOptions: ['restrictive'],
    baselineSeconds: 30,
  },
  'MV-10': {
    stationId: 'obstructive-mechanics',
    phenotype: 'delayed-cycling',
    mechanismLabel: 'Ventilator cycles after neural inspiration ends',
    priorityId: 'shorten-machine-ti',
    priorityLabel: 'Cycle earlier and restore expiratory time',
    responseId: 'end-inspiratory-spike-resolves',
    responseLabel: 'Mechanical Ti approaches neural Ti and intrinsic PEEP falls',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'expiratory-hold',
      'bronchodilator',
      'suction-airway',
      'communicate-plan',
    ],
    requiredInterventionIds: [],
    requiredReassessmentIds: ['review-waveforms', 'expiratory-hold'],
    successConditions: [{ metric: 'measurements.intrinsicPeepCmH2O', comparator: 'lte', value: 7 }],
    branchOptions: ['copd'],
    baselineSeconds: 30,
  },
  'MV-11': {
    stationId: 'pressure-support-timing',
    phenotype: 'rise-time-mismatch',
    mechanismLabel: 'Pressurization is too slow, then vulnerable to overshoot',
    priorityId: 'titrate-pramp',
    priorityLabel: 'Titrate P-ramp to effort and comfort',
    responseId: 'smooth-pressurization',
    responseLabel: 'Effort falls without sustained pressure overshoot',
    interventionIds: ['assess-patient', 'review-waveforms', 'communicate-plan'],
    requiredInterventionIds: [],
    requiredReassessmentIds: ['review-waveforms', 'assess-patient'],
    successConditions: [
      { metric: 'measurements.pressureOvershootCmH2O', comparator: 'lte', value: 2 },
      { metric: 'patient.human.dyspneaScore', comparator: 'lte', value: 4 },
    ],
    branchOptions: ['rise-time-mismatch'],
    baselineSeconds: 30,
  },
  'MV-12': {
    stationId: 'pressure-support-timing',
    phenotype: 'over-assistance',
    mechanismLabel: 'Excessive unloading suppresses respiratory drive',
    priorityId: 'reduce-assist',
    priorityLabel: 'Reduce assist while preserving comfortable ventilation',
    responseId: 'vt-drive-normalize',
    responseLabel: 'VT, PaCO₂, and breathing variability move toward a shared-work range',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'reduce-sedation',
      'order-abg',
      'communicate-plan',
    ],
    requiredInterventionIds: ['reduce-sedation'],
    requiredReassessmentIds: ['order-abg', 'review-waveforms'],
    successConditions: [
      { metric: 'patient.gasExchange.paCO2MmHg', comparator: 'between', value: [35, 50] },
    ],
    branchOptions: ['periodic-breathing'],
    baselineSeconds: 60,
  },
  'MV-13': {
    stationId: 'deterioration-whole-patient',
    phenotype: 'high-resistance',
    mechanismLabel: 'Acute resistive load with relatively stable plateau pressure',
    priorityId: 'stabilize-airway',
    priorityLabel: 'Stabilize and localize patient versus circuit resistance',
    responseId: 'peak-falls-plateau-stable',
    responseLabel: 'Peak pressure falls while plateau pressure remains stable',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'inspiratory-hold',
      'disconnect-bag',
      'inspect-circuit',
      'suction-airway',
      'remove-hme',
      'reposition-ett',
      'bronchodilator',
      'communicate-plan',
    ],
    requiredInterventionIds: ['inspiratory-hold', 'inspect-circuit'],
    requiredReassessmentIds: ['inspiratory-hold', 'review-waveforms'],
    successConditions: [
      { metric: 'measurements.relaxedPlateauPressureCmH2O', comparator: 'lte', value: 30 },
    ],
    branchOptions: ['secretions', 'hme-or-ett', 'bronchospasm'],
    baselineSeconds: 15,
  },
  'MV-14': {
    stationId: 'deterioration-whole-patient',
    phenotype: 'tension-pneumothorax',
    mechanismLabel: 'Sudden compliance loss with obstructive shock',
    priorityId: 'decompress-now',
    priorityLabel: 'Treat a crashing tension pneumothorax without imaging delay',
    responseId: 'compliance-map-recover',
    responseLabel: 'Plateau pressure falls while oxygenation and MAP recover',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'disconnect-bag',
      'decompress-pneumothorax',
      'pleural-drainage',
      'communicate-plan',
    ],
    requiredInterventionIds: ['decompress-pneumothorax'],
    requiredReassessmentIds: ['assess-patient', 'review-waveforms'],
    successConditions: [
      { metric: 'patient.hemodynamics.mapMmHg', comparator: 'gte', value: 60 },
      { metric: 'measurements.relaxedPlateauPressureCmH2O', comparator: 'lte', value: 32 },
    ],
    branchOptions: ['unstable', 'stable'],
    baselineSeconds: 10,
  },
  'MV-15': {
    stationId: 'deterioration-whole-patient',
    phenotype: 'dyspnea-human-factors',
    mechanismLabel: 'Mixed under-assistance, pain, anxiety, and delirium',
    priorityId: 'ask-and-treat',
    priorityLabel: 'Ask what breathing feels like and treat reversible causes',
    responseId: 'comfort-synchrony-improve',
    responseLabel: 'Dyspnea falls without excessive VT or deep sedation',
    interventionIds: [
      'assess-patient',
      'review-waveforms',
      'communication-board',
      'treat-pain',
      'relieve-bladder',
      'reorient',
      'reduce-noise',
      'deepen-sedation',
      'communicate-plan',
    ],
    requiredInterventionIds: ['communication-board', 'treat-pain', 'relieve-bladder'],
    requiredReassessmentIds: ['assess-patient', 'review-waveforms'],
    successConditions: [{ metric: 'patient.human.dyspneaScore', comparator: 'lte', value: 5 }],
    branchOptions: ['pain-bladder-delirium'],
    baselineSeconds: 30,
  },
}

function numeric(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseBloodPressure(value: unknown): { systolic: number; diastolic: number } {
  if (typeof value !== 'string') return { systolic: 120, diastolic: 70 }
  const match = value.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return { systolic: 120, diastolic: 70 }
  return { systolic: Number(match[1]), diastolic: Number(match[2]) }
}

function inferSex(description: string): 'male' | 'female' | 'unspecified' {
  if (/\b(man|male)\b/i.test(description)) return 'male'
  if (/\b(woman|female)\b/i.test(description)) return 'female'
  return 'unspecified'
}

function parseTrigger(value: unknown) {
  const text = typeof value === 'string' ? value : 'flow 2 L/min'
  if (/pressure/i.test(text)) {
    const threshold = Number(text.match(/-?\d+(?:\.\d+)?/)?.[0] ?? -2)
    return { type: 'pressure' as const, thresholdCmH2O: Math.min(-0.1, threshold) }
  }
  const threshold = Number(text.match(/\d+(?:\.\d+)?/)?.[0] ?? 2)
  return { type: 'flow' as const, thresholdLMin: Math.min(20, Math.max(0.5, threshold)) }
}

function buildSettings(sourceId: string): MechanicalVentilationSettings {
  const source = sourceCaseById.get(sourceId)!
  const initial = source.initial_ventilator
  const common = {
    deviceMode: 'volume-ac' as const,
    advanced: createDefaultAdvancedVentilationSettings(),
    oxygenPercent: numeric(initial, 'FiO2', 0.4) * 100,
    peepCmH2O: numeric(initial, 'PEEP_cmH2O', 5),
    trigger: parseTrigger(initial.trigger),
    highPressureLimitCmH2O: ['MV-06', 'MV-13', 'MV-14'].includes(sourceId) ? 60 : 40,
    trcEnabled: false,
    trcPercent: 100,
    tubeInnerDiameterMm: 7.5,
  }
  const sourceMode = String(initial.mode)
  if (sourceMode === 'PC-A/C') {
    return {
      mode: 'pressure-ac',
      ...common,
      deviceMode: 'pressure-ac',
      deltaPControlCmH2O: numeric(initial, 'inspiratory_pressure_above_PEEP_cmH2O', 15),
      ratePerMin: numeric(initial, 'RR_min', 16),
      inspiratoryTimeSeconds: numeric(initial, 'inspiratory_time_s', 0.9),
      pRampMs: 70,
    }
  }
  if (/PSV/.test(sourceMode)) {
    return {
      mode: 'pressure-support',
      ...common,
      deviceMode: 'pressure-support',
      pressureSupportCmH2O: numeric(initial, 'pressure_support_cmH2O', 10),
      pRampMs: Math.min(2000, numeric(initial, 'rise_time_ms', 100)),
      etsPercent: numeric(initial, 'flow_cycle_percent', 25),
      tiMaxSeconds: 1.5,
      apneaBackupEnabled: /apnea backup/i.test(sourceMode),
      apneaRatePerMin: 12,
    }
  }
  return {
    mode: 'volume-ac',
    ...common,
    vtMl: numeric(initial, 'VT_mL', 420),
    ratePerMin: numeric(initial, 'RR_min', 18),
    peakFlowLMin: numeric(initial, 'inspiratory_flow_L_min', 60),
    flowPattern: String(initial.flow_waveform ?? 'square').includes('decel')
      ? 'decelerating-50'
      : 'square',
    pausePercent: 0,
  }
}

function buildPatient(sourceId: string): PatientModelState {
  const source = sourceCaseById.get(sourceId)!
  const hidden = source.hidden_model
  const vitals = source.patient.vitals
  const abg = source.patient.abg ?? {}
  const bloodPressure = parseBloodPressure(vitals.BP)
  const phenotype = caseProfiles[sourceId].phenotype
  const complianceMl = numeric(
    hidden,
    'respiratory_system_compliance_mL_cmH2O',
    phenotype === 'tension-pneumothorax' ? 10 : phenotype === 'high-resistance' ? 40 : 45,
  )
  const resistance = numeric(
    hidden,
    'airway_resistance_cmH2O_L_s',
    phenotype === 'high-resistance' ? 30 : 10,
  )
  const neuralRate = numeric(
    hidden,
    'true_neural_RR_min',
    numeric(
      hidden,
      'patient_neural_RR_min',
      numeric(vitals, 'RR_observed', numeric(source.initial_ventilator, 'RR_min', 18)),
    ),
  )
  const effort = Math.abs(
    numeric(hidden, 'Pmus_peak_cmH2O', phenotype === 'weak-trigger' ? -3.5 : -8),
  )
  const paCO2 = numeric(abg, 'PaCO2_mmHg', 42)
  const bicarbonate = numeric(abg, 'HCO3_mEq_L', 24)
  const pH = numeric(abg, 'pH', 6.1 + Math.log10(bicarbonate / (0.03 * paCO2)))
  const spo2 = numeric(vitals, 'SpO2', 94)
  const map = Math.round((bloodPressure.systolic + bloodPressure.diastolic * 2) / 3)
  const initialPeep = numeric(hidden, 'intrinsic_PEEP_cmH2O', 0)
  const dyspnea =
    sourceId === 'MV-15' || sourceId === 'MV-11'
      ? 8
      : sourceId === 'MV-09'
        ? 7
        : sourceId === 'MV-10'
          ? 6
          : effort >= 12
            ? 6
            : 3
  return {
    mechanics: {
      complianceLPerCmH2O: complianceMl / 1000,
      resistanceCmH2OPerLps: resistance,
      intrinsicPeepCmH2O: initialPeep,
      endExpiratoryVolumeL: (initialPeep * complianceMl) / 1000,
      airwayLeakFraction: phenotype === 'autotriggering' ? 0.08 : 0,
      tubeResistanceCmH2OPerLps: phenotype === 'weak-trigger' ? 4 : 2,
    },
    drive: {
      neuralRatePerMin: neuralRate,
      neuralInspiratoryTimeSeconds: numeric(hidden, 'neural_inspiratory_time_s', 0.85),
      effortAmplitudeCmH2O: effort,
      variability: phenotype === 'reverse-triggering' ? 0.02 : 0.08,
      reverseTriggerDelaySeconds:
        phenotype === 'reverse-triggering'
          ? numeric(hidden, 'reverse_trigger_delay_s', 0.35)
          : null,
    },
    gasExchange: {
      shuntFraction: numeric(hidden, 'shunt_fraction', spo2 < 88 ? 0.25 : 0.08),
      deadSpaceFraction: [
        'copd-ineffective-efforts',
        'asthma-obstructive-shock',
        'delayed-cycling',
      ].includes(phenotype)
        ? 0.45
        : 0.3,
      co2ProductionMlMin: phenotype === 'flow-starvation' ? 260 : 200,
      oxygenConsumptionMlMin: phenotype === 'flow-starvation' ? 300 : 250,
      paO2MmHg: numeric(abg, 'PaO2_mmHg', Math.max(45, 30 + spo2 * 0.6)),
      paCO2MmHg: paCO2,
      bicarbonateMmolL: bicarbonate,
      pH,
      spo2Percent: spo2,
    },
    hemodynamics: {
      heartRatePerMin: numeric(vitals, 'HR', 90),
      systolicMmHg: bloodPressure.systolic,
      diastolicMmHg: bloodPressure.diastolic,
      mapMmHg: map,
      obstructiveShock:
        Boolean(hidden.obstructive_shock) || phenotype === 'asthma-obstructive-shock',
    },
    human: {
      painScore: sourceId === 'MV-15' ? 7 : sourceId === 'MV-09' ? 6 : 2,
      anxietyScore: ['MV-11', 'MV-15'].includes(sourceId) ? 8 : 3,
      deliriumScore: sourceId === 'MV-15' ? 7 : 1,
      sedationScore: sourceId === 'MV-04' ? -4 : sourceId === 'MV-12' ? -2 : 0,
      dyspneaScore: dyspnea,
      canCommunicate: sourceId !== 'MV-04',
    },
    airway: {
      secretions: phenotype === 'high-resistance',
      hmeObstructed: false,
      ettObstructed: false,
      bronchospasm: [
        'asthma-obstructive-shock',
        'copd-ineffective-efforts',
        'delayed-cycling',
      ].includes(phenotype),
      condensate: phenotype === 'autotriggering',
      circuitLeak: phenotype === 'autotriggering',
      pneumothorax: phenotype === 'tension-pneumothorax',
    },
  }
}

function stationMechanismOptions(stationId: StationId): readonly PredictionOption[] {
  return stationCases[stationId].map((id) => ({
    id: caseProfiles[id].phenotype,
    label: caseProfiles[id].mechanismLabel,
  }))
}

const priorityDistractors: readonly PredictionOption[] = [
  { id: 'normalize-all-numbers', label: 'Normalize every displayed number immediately' },
  { id: 'increase-assist', label: 'Increase assist before determining the mechanism' },
]

const responseDistractors: readonly PredictionOption[] = [
  { id: 'higher-vt-and-rate', label: 'VT and respiratory rate both rise substantially' },
  { id: 'sedation-only', label: 'Visible effort disappears without another physiologic change' },
]

function adaptationNotes(sourceId: string): readonly string[] {
  const source = sourceCaseById.get(sourceId)!
  const canonicalMode = buildSettings(sourceId).mode
  const canonicalLabel =
    canonicalMode === 'volume-ac'
      ? 'volume assist/control'
      : canonicalMode === 'pressure-ac'
        ? 'pressure assist/control'
        : 'CPAP/pressure support'
  const notes = [
    `${String(source.initial_ventilator.mode)} is normalized to the ${canonicalLabel} profile and displayed with the selected device’s vocabulary.`,
  ]
  const riseTime = numeric(source.initial_ventilator, 'rise_time_ms', 0)
  if (riseTime > 200) {
    notes.push(
      `The ${riseTime} ms source rise-time is bounded by the selected device profile; the HAMILTON-C6 SPONT profile is capped at 200 ms.`,
    )
  }
  if (sourceId === 'MV-11') {
    notes.push(
      'The educational target rise time is 70–120 ms; values below 30 ms generate the overshoot branch and are displayed in native device units.',
    )
  }
  return notes
}

const builtCases: VentilationCaseDefinition[] = mechanicalVentilationSource.cases.map((source) => {
  const profile = caseProfiles[source.id]
  const patientSex = inferSex(source.patient.description)
  return {
    id: source.id,
    sourceCaseId: source.id,
    title: source.title,
    stationId: profile.stationId,
    category: source.category,
    difficulty: source.difficulty,
    runTimeMin: source.run_time_min,
    phenotype: profile.phenotype,
    patientSex,
    predictedBodyWeightKg: source.id === 'MV-01' ? 70 : patientSex === 'female' ? 65 : 70,
    patientDescription: source.patient.description,
    learningObjectives: source.learning_objectives,
    initialSettings: buildSettings(source.id),
    initialPatient: buildPatient(source.id),
    visibleFindings: source.visible_findings,
    mechanismOptions: stationMechanismOptions(profile.stationId),
    correctMechanismId: profile.phenotype,
    priorityOptions: [
      { id: profile.priorityId, label: profile.priorityLabel },
      ...priorityDistractors,
    ],
    correctPriorityId: profile.priorityId,
    responseOptions: [
      { id: profile.responseId, label: profile.responseLabel },
      ...responseDistractors,
    ],
    correctResponseId: profile.responseId,
    interventions: profile.interventionIds.map((id) => interventionCatalog[id]),
    requiredInterventionIds: profile.requiredInterventionIds,
    requiredReassessmentIds: profile.requiredReassessmentIds,
    successConditions: profile.successConditions,
    hintLadder: source.hint_ladder,
    debrief: source.debrief,
    expectedActions: source.expected_actions,
    acceptedAlternatives: source.accepted_alternatives,
    unsafeActions: source.unsafe_actions,
    successCriteria: source.success_criteria,
    simulationLogic: source.simulation_logic,
    runTips: source.run_tips,
    sourceBasis: source.source_basis,
    branchOptions: profile.branchOptions,
    baselineSeconds: profile.baselineSeconds,
    deviceAdaptationNotes: adaptationNotes(source.id),
  }
})

validateRuntimeCaseRegistry(builtCases)

export const mechanicalVentilationCases: readonly VentilationCaseDefinition[] = builtCases
export const mechanicalVentilationCaseById = new Map(
  mechanicalVentilationCases.map((caseDefinition) => [caseDefinition.id, caseDefinition]),
)

export const mechanicalVentilationCasesByStation = Object.fromEntries(
  ventilationStations.map((station) => [
    station.id,
    station.caseIds.map((caseId) => mechanicalVentilationCaseById.get(caseId)!),
  ]),
) as unknown as Readonly<Record<StationId, readonly VentilationCaseDefinition[]>>

export const pilotCaseIds = ['MV-01', 'MV-04', 'MV-06', 'MV-11', 'MV-15'] as const

export function validateMechanicalVentilationCaseRegistry(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const caseDefinition of mechanicalVentilationCases) {
    if (ids.has(caseDefinition.id)) errors.push(`Duplicate case ID: ${caseDefinition.id}`)
    ids.add(caseDefinition.id)
    if (
      !caseDefinition.mechanismOptions.some((item) => item.id === caseDefinition.correctMechanismId)
    ) {
      errors.push(`${caseDefinition.id}: missing correct mechanism option`)
    }
    if (!caseDefinition.interventions.some((item) => item.id === 'communicate-plan')) {
      errors.push(`${caseDefinition.id}: missing communication action`)
    }
    for (const id of [
      ...caseDefinition.requiredInterventionIds,
      ...caseDefinition.requiredReassessmentIds,
    ]) {
      if (!caseDefinition.interventions.some((item) => item.id === id)) {
        errors.push(`${caseDefinition.id}: missing required intervention ${id}`)
      }
    }
  }
  return errors
}
