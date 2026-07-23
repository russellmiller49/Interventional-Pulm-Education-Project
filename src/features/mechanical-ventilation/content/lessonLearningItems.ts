import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

export type MechanicalVentilationLessonId =
  | 'mechanics-load-and-pressure'
  | 'modes-and-breath-delivery'
  | 'waveform-reading-sequence'
  | 'triggering-and-cycling'
  | 'dyssynchrony-mechanisms'
  | 'oxygenation-response'
  | 'ventilation-and-co2'
  | 'safety-reassessment-and-human-factors'

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const mechanicsEvidence = [
  'supplied-casebook-2026',
  'tobin-3e-monitoring',
  'tobin-3e-fighting-ventilator',
]
const modesEvidence = ['supplied-casebook-2026', 'tobin-3e-setting-ventilator']
const dyssynchronyEvidence = [
  'supplied-casebook-2026',
  'antonogiannaki-dyssynchrony-2017',
  'tobin-3e-fighting-ventilator',
]
const oxygenationEvidence = ['supplied-casebook-2026', 'tobin-3e-peep', 'tobin-3e-monitoring']
const obstructiveEvidence = ['supplied-casebook-2026', 'tobin-3e-copd', 'tobin-3e-monitoring']

export const mechanicalVentilationLessonItems: Readonly<
  Record<
    MechanicalVentilationLessonId,
    { prediction: ClinicalLearningItem; transfer: ClinicalLearningItem }
  >
> = {
  'mechanics-load-and-pressure': {
    prediction: item({
      id: 'vent-mechanics-predict-1',
      activityId: 'ventilation:learn:mechanics-load-and-pressure',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'patient',
      clinicalContextId: 'mv13-high-pressure',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-bedside-findings'],
      stem: 'Peak airway pressure has risen. An inspiratory hold shows that plateau pressure is nearly unchanged, and expiratory wheeze or airway secretions are present. Which mechanism best fits the combined findings?',
      choices: [
        {
          id: 'resistive-load',
          label: 'Increased resistive load between the ventilator and alveoli',
          rationale:
            'A wider peak-to-plateau difference localizes additional pressure to flow resistance.',
          plausibility: 'best',
        },
        {
          id: 'elastic-load',
          label: 'Abrupt loss of respiratory-system compliance',
          rationale:
            'A major compliance loss would usually raise plateau pressure along with peak pressure.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'alarm-fault',
          label: 'A high-pressure alarm without a physiologic or circuit cause',
          rationale:
            'The measured pressure components and bedside findings provide a mechanism that still requires localization.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['resistive-load'],
      explanation:
        'Peak pressure includes resistive and elastic components. The hold removes flow, so a relatively stable plateau with a larger peak-to-plateau gap supports increased resistance.',
      evidenceIds: mechanicsEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-mechanics-transfer-1',
      activityId: 'ventilation:learn:mechanics-load-and-pressure',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv14-compliance-collapse',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-bedside-findings'],
      transferVariantId: 'mv14-abrupt-elastic-load',
      stem: 'In a new patient, peak and plateau pressures rise together while SpO₂ and blood pressure fall and breath sounds become asymmetric. What is the best immediate interpretation?',
      choices: [
        {
          id: 'new-elastic-emergency',
          label:
            'Treat this as an acute compliance and hemodynamic emergency while urgently examining the patient',
          rationale:
            'The coupled elastic-pressure rise, instability, and asymmetric examination point to an acute patient-side process such as tension pneumothorax.',
          plausibility: 'best',
        },
        {
          id: 'same-resistance',
          label: 'Assume the same resistive mechanism because peak pressure is high',
          rationale:
            'The proportional plateau rise and hemodynamic collapse distinguish this case from isolated resistance.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'silence-only',
          label: 'Silence the alarm and wait for the pressure to normalize',
          rationale:
            'Alarm acknowledgment does not stabilize the patient or localize the new mechanism.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['new-elastic-emergency'],
      explanation:
        'A new rise in plateau pressure plus hypotension and unilateral findings requires immediate bedside localization and emergency treatment according to local protocol.',
      evidenceIds: mechanicsEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'modes-and-breath-delivery': {
    prediction: item({
      id: 'vent-modes-predict-1',
      activityId: 'ventilation:learn:modes-and-breath-delivery',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'technical',
      clinicalContextId: 'mv02-breath-delivery',
      visualAssetIds: ['vent-console-mode-screen', 'vent-pressure-flow-volume'],
      stem: 'Two ventilators use different mode labels. Which description gives the most clinically useful comparison of a single breath?',
      choices: [
        {
          id: 'breath-variables',
          label:
            'Identify how inspiration is triggered, what variable is controlled, how inspiration cycles, and how expiration proceeds',
          rationale: 'These variables describe breath delivery even when device labels differ.',
          plausibility: 'best',
        },
        {
          id: 'screen-position',
          label: 'Match controls by their position on the two screens',
          rationale: 'Similar screen position does not establish equivalent breath behavior.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'mode-name-only',
          label: 'Use the mode name alone without checking measured delivery',
          rationale:
            'A label does not show the patient interaction or resulting pressure, flow, and volume.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['breath-variables'],
      explanation:
        'Trigger, controlled variable, cycling rule, and expiration provide a transferable description. The measured breath still must be checked after a change.',
      evidenceIds: modesEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-modes-transfer-1',
      activityId: 'ventilation:learn:modes-and-breath-delivery',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv09-pressure-support-cycling',
      visualAssetIds: ['vent-console-mode-screen', 'vent-pressure-flow-volume'],
      transferVariantId: 'mv09-variable-framework',
      stem: 'A patient receiving pressure support begins exhaling while inspiratory effort is still present. Which breath variable should be localized before selecting a different mode?',
      choices: [
        {
          id: 'cycling-rule',
          label: 'The criterion that ends inspiration',
          rationale:
            'The mismatch occurs at the transition from inspiration to expiration, which is the cycling event.',
          plausibility: 'best',
        },
        {
          id: 'trigger-rule',
          label: 'Only the criterion that starts inspiration',
          rationale:
            'Triggering concerns initiation and does not explain an early end to an already triggered breath.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'oxygen-setting',
          label: 'Only the oxygen concentration',
          rationale:
            'Oxygen concentration does not determine when a pressure-support breath cycles to expiration.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['cycling-rule'],
      explanation:
        'The variable framework localizes premature cycling to the end-inspiration criterion. Mode selection should follow, not replace, that localization.',
      evidenceIds: [...modesEvidence, 'antonogiannaki-dyssynchrony-2017'],
      reviewStatus: 'sme-review',
    }),
  },
  'waveform-reading-sequence': {
    prediction: item({
      id: 'vent-waveforms-predict-1',
      activityId: 'ventilation:learn:waveform-reading-sequence',
      phase: 'predict',
      itemType: 'signal-recognition',
      contextRequirement: 'technical',
      clinicalContextId: 'mv03-stacked-inflation',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-pmus-overlay'],
      stem: 'Across several breaths, a second inspiration begins before expiratory flow and volume return toward baseline. What should be recorded before naming the cause?',
      choices: [
        {
          id: 'timing-across-traces',
          label:
            'The timing relationship among effort, pressure, flow, and volume across repeated breaths',
          rationale:
            'The repeated multitrace sequence establishes whether one effort, a prolonged effort, or another trigger produced stacked inflation.',
          plausibility: 'best',
        },
        {
          id: 'single-peak',
          label: 'Only the highest pressure from one breath',
          rationale: 'A single amplitude does not establish the timing sequence or stacked volume.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'appearance-only',
          label: 'The visual shape without the patient or measured values',
          rationale:
            'Waveform appearance must be correlated with effort, delivered volume, and the bedside context.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['timing-across-traces'],
      explanation:
        'A repeatable sequence starts with timing, then compares shape and amplitude across all traces and the patient.',
      evidenceIds: dyssynchronyEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-waveforms-transfer-1',
      activityId: 'ventilation:learn:waveform-reading-sequence',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv08-extra-breaths',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-circuit-finding'],
      transferVariantId: 'mv08-artifact-validation',
      stem: 'A new trace shows extra machine breaths without matching patient effort. Condensate oscillates near the flow sensor. What is the best next step?',
      choices: [
        {
          id: 'validate-circuit',
          label: 'Inspect and correct the circuit signal source, then repeat the multitrace review',
          rationale:
            'The missing effort and visible condensate support a circuit-driven trigger that should be validated directly.',
          plausibility: 'best',
        },
        {
          id: 'suppress-effort',
          label: 'Suppress patient effort before inspecting the circuit',
          rationale:
            'The extra breaths are not matched to effort, and sedation would not correct a circuit signal.',
          plausibility: 'unsafe',
        },
        {
          id: 'single-trace',
          label: 'Classify the pressure trace alone and ignore flow',
          rationale:
            'Flow and effort timing are central to distinguishing a false trigger from patient-triggered breaths.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['validate-circuit'],
      explanation:
        'The transfer requires signal validation: correlate pressure, flow, volume, effort, patient findings, and the circuit before changing support.',
      evidenceIds: dyssynchronyEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'triggering-and-cycling': {
    prediction: item({
      id: 'vent-timing-predict-1',
      activityId: 'ventilation:learn:triggering-and-cycling',
      phase: 'predict',
      itemType: 'signal-recognition',
      contextRequirement: 'patient',
      clinicalContextId: 'mv07-weak-trigger',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-pmus-overlay'],
      stem: 'Patient effort appears on the effort trace, but some efforts are not followed by pressure, flow, or volume delivery. Which transition is failing?',
      choices: [
        {
          id: 'trigger-failure',
          label: 'The transition that initiates inspiration',
          rationale: 'An effort without a delivered breath indicates ineffective triggering.',
          plausibility: 'best',
        },
        {
          id: 'cycle-failure',
          label: 'The transition that ends inspiration',
          rationale: 'Cycling can be evaluated only after a breath has begun.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'oxygenation-only',
          label: 'An oxygenation problem without a timing abnormality',
          rationale: 'The paired effort and missing breath directly identify a timing problem.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['trigger-failure'],
      explanation:
        'Ineffective effort is a trigger problem. A sensitivity change must then be checked for both improved capture and new false breaths.',
      evidenceIds: dyssynchronyEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-timing-transfer-1',
      activityId: 'ventilation:learn:triggering-and-cycling',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv10-delayed-cycling',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-pmus-overlay'],
      transferVariantId: 'mv10-delayed-cycle',
      stem: 'In obstructive physiology, inspiratory flow continues after patient effort has ended, expiration starts late, and intrinsic PEEP rises. Which test best targets the mismatch?',
      choices: [
        {
          id: 'earlier-cycle',
          label:
            'Test an earlier cycling threshold and reassess inspiratory time plus expiratory emptying',
          rationale:
            'The mechanical breath is ending too late for the patient and is shortening expiration.',
          plausibility: 'best',
        },
        {
          id: 'more-sensitive-trigger',
          label: 'Make the trigger progressively more sensitive without changing cycling',
          rationale: 'The breath already begins; the mismatch occurs at its termination.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'increase-rate',
          label: 'Increase breath frequency before checking expiratory flow',
          rationale: 'This may further shorten expiration and worsen dynamic hyperinflation.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['earlier-cycle'],
      explanation:
        'Delayed cycling is an end-inspiration mismatch. The reassessment must include mechanical inspiratory time, patient effort, and expiratory flow.',
      evidenceIds: [...dyssynchronyEvidence, 'tobin-3e-copd'],
      reviewStatus: 'sme-review',
    }),
  },
  'dyssynchrony-mechanisms': {
    prediction: item({
      id: 'vent-dyssynchrony-predict-1',
      activityId: 'ventilation:learn:dyssynchrony-mechanisms',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'patient',
      clinicalContextId: 'mv04-reverse-trigger',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-pmus-overlay'],
      stem: 'A deeply sedated patient develops a fixed effort after mandatory inflation, sometimes followed by a second breath. What mechanism should be tested?',
      choices: [
        {
          id: 'reverse-triggering',
          label: 'Machine-triggered neural entrainment with possible stacked inflation',
          rationale:
            'A fixed post-inflation effort in a sedated patient supports entrainment rather than a random spontaneous trigger.',
          plausibility: 'best',
        },
        {
          id: 'flow-starvation',
          label: 'Only inadequate inspiratory flow during every breath',
          rationale:
            'Flow starvation produces effort during inflation rather than a fixed effort after machine initiation.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'agitation',
          label: 'Nonspecific agitation that should be treated without reviewing timing',
          rationale:
            'The fixed temporal relationship is diagnostic information that should not be obscured.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['reverse-triggering'],
      explanation:
        'Dyssynchrony should be described by drive, load, timing, and assist. Perturbing machine timing and reviewing several breaths tests fixed entrainment.',
      evidenceIds: dyssynchronyEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-dyssynchrony-transfer-1',
      activityId: 'ventilation:learn:dyssynchrony-mechanisms',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv11-rise-time',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-pmus-overlay'],
      transferVariantId: 'mv11-pressurization-mismatch',
      stem: 'A new patient has strong early inspiratory effort, slow pressure delivery, and air hunger. Which response makes a pressurization hypothesis testable?',
      choices: [
        {
          id: 'titrate-rise',
          label:
            'Shorten rise time one step and reassess early effort, comfort, and pressure overshoot',
          rationale:
            'The action targets the proposed magnitude/timing mismatch and defines both benefit and excess.',
          plausibility: 'best',
        },
        {
          id: 'sedate-only',
          label: 'Deepen sedation without checking the pressure and effort relationship',
          rationale: 'This can hide effort while leaving the delivery mismatch untested.',
          plausibility: 'unsafe',
        },
        {
          id: 'repeat-prior',
          label:
            'Repeat the rate change used for the prior patient without relocalizing the mismatch',
          rationale: 'A successful action in reverse triggering does not test slow pressurization.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['titrate-rise'],
      explanation:
        'A targeted change plus predicted benefit and harm makes the mechanism falsifiable and prevents reflex reuse of a prior adjustment.',
      evidenceIds: dyssynchronyEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  'oxygenation-response': {
    prediction: item({
      id: 'vent-oxygenation-predict-1',
      activityId: 'ventilation:learn:oxygenation-response',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mv01-ards-peep',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-vital-monitor'],
      stem: 'In diffuse hypoxemic respiratory failure, a small PEEP increase is planned. Which prediction is complete enough to guide reassessment?',
      choices: [
        {
          id: 'coupled-response',
          label:
            'Predict the direction of oxygenation, plateau pressure, compliance, and blood pressure',
          rationale:
            'PEEP can recruit lung while also increasing distending pressure and affecting venous return.',
          plausibility: 'best',
        },
        {
          id: 'spo2-only',
          label: 'Predict only that SpO₂ will rise',
          rationale: 'An oxygenation benefit does not establish mechanical or hemodynamic safety.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'pressure-only',
          label: 'Predict only that airway pressure will rise',
          rationale:
            'This omits the intended oxygenation response and the hemodynamic consequence.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['coupled-response'],
      explanation:
        'The reassessment must couple benefit and burden: oxygenation, plateau pressure, compliance, and MAP should be interpreted together.',
      evidenceIds: oxygenationEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-oxygenation-transfer-1',
      activityId: 'ventilation:learn:oxygenation-response',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv14-abrupt-hypoxemia',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-bedside-findings'],
      transferVariantId: 'mv14-new-hypoxemic-emergency',
      stem: 'A different patient develops abrupt hypoxemia, hypotension, rising plateau pressure, and unilateral loss of breath sounds. What should happen before another recruitment step?',
      choices: [
        {
          id: 'urgent-new-mechanism',
          label:
            'Perform an urgent bedside assessment and treat the new obstructive mechanism according to local emergency protocol',
          rationale:
            'The abrupt coupled deterioration is not the same phenotype as diffuse recruitable hypoxemia.',
          plausibility: 'best',
        },
        {
          id: 'continue-peep',
          label: 'Continue increasing PEEP without examining the patient',
          rationale:
            'This may worsen hemodynamic compromise and delays treatment of a new patient-side emergency.',
          plausibility: 'unsafe',
        },
        {
          id: 'watch-spo2',
          label: 'Watch SpO₂ alone until the pattern becomes clearer',
          rationale:
            'The hypotension and unilateral examination findings already demand urgent action.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['urgent-new-mechanism'],
      explanation:
        'Transfer depends on recognizing a changed phenotype. Abrupt instability requires concurrent stabilization and mechanism localization.',
      evidenceIds: [...oxygenationEvidence, 'tobin-3e-fighting-ventilator'],
      reviewStatus: 'sme-review',
    }),
  },
  'ventilation-and-co2': {
    prediction: item({
      id: 'vent-co2-predict-1',
      activityId: 'ventilation:learn:ventilation-and-co2',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'patient',
      clinicalContextId: 'mv05-dynamic-hyperinflation',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-abg-panel'],
      stem: 'An obstructive patient has elevated PaCO₂, expiratory flow that has not returned to zero before the next breath, and intrinsic PEEP. What should precede an increase in breath frequency?',
      choices: [
        {
          id: 'measure-emptying',
          label:
            'Measure expiratory emptying and intrinsic PEEP, then create more time for exhalation',
          rationale:
            'Nominal minute ventilation can rise while effective alveolar ventilation worsens if trapped gas increases.',
          plausibility: 'best',
        },
        {
          id: 'increase-rate',
          label: 'Increase frequency immediately without checking expiratory flow',
          rationale:
            'A shorter expiratory interval can worsen dynamic hyperinflation and hemodynamics.',
          plausibility: 'unsafe',
        },
        {
          id: 'abg-only',
          label: 'Use the PaCO₂ value alone without the flow or pressure measurements',
          rationale: 'The gas value does not localize the delivery and emptying mechanism.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['measure-emptying'],
      explanation:
        'In obstruction, delivery, emptying, intrinsic PEEP, hemodynamics, and the delayed gas response must be considered together.',
      evidenceIds: obstructiveEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-co2-transfer-1',
      activityId: 'ventilation:learn:ventilation-and-co2',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv06-obstructive-shock',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-vital-monitor'],
      transferVariantId: 'mv06-obstructive-shock',
      stem: 'A new patient with severe asthma becomes hypotensive while expiratory flow remains above zero and intrinsic PEEP is very high. What is the immediate priority?',
      choices: [
        {
          id: 'release-trapped-gas',
          label:
            'Permit exhalation and release trapped gas while supporting ventilation and treating obstruction',
          rationale:
            'Dynamic hyperinflation can impair venous return and requires immediate decompression of trapped volume.',
          plausibility: 'best',
        },
        {
          id: 'raise-rate',
          label: 'Increase breath frequency to lower PaCO₂ before addressing hypotension',
          rationale: 'This can shorten expiration further and worsen obstructive shock.',
          plausibility: 'unsafe',
        },
        {
          id: 'wait-abg',
          label: 'Wait for a repeat blood gas before assessing the hemodynamic emergency',
          rationale:
            'The circulation and expiratory-flow findings already define an urgent priority.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['release-trapped-gas'],
      explanation:
        'The transfer case elevates the same emptying mechanism into a hemodynamic emergency. Immediate stabilization takes priority over normalization of PaCO₂.',
      evidenceIds: [...obstructiveEvidence, 'tobin-3e-fighting-ventilator'],
      reviewStatus: 'sme-review',
    }),
  },
  'safety-reassessment-and-human-factors': {
    prediction: item({
      id: 'vent-safety-predict-1',
      activityId: 'ventilation:learn:safety-reassessment-and-human-factors',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'patient',
      clinicalContextId: 'mv15-distress',
      visualAssetIds: ['vent-vital-monitor', 'vent-bedside-findings'],
      stem: 'A ventilated patient has air hunger, pain, anxiety, and delirium but can communicate with assistance. What is the best first management sequence?',
      choices: [
        {
          id: 'ask-assess-treat',
          label:
            'Establish communication, characterize the distress, treat reversible causes, and reassess patient plus waveforms',
          rationale:
            'This preserves diagnostic information and addresses causes that a ventilator change or deeper sedation may miss.',
          plausibility: 'best',
        },
        {
          id: 'sedate-first',
          label: 'Deepen sedation before asking about pain or breathing discomfort',
          rationale:
            'This can obscure assessment and does not address the identified reversible causes.',
          plausibility: 'unsafe',
        },
        {
          id: 'screen-only',
          label: 'Use the ventilator display alone because patient report is unreliable',
          rationale:
            'Patient experience and bedside examination are essential parts of dyspnea assessment.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['ask-assess-treat'],
      explanation:
        'Safety includes the whole patient. Communication, comfort, waveform review, treatment of reversible causes, and explicit reassessment belong in one loop.',
      evidenceIds: dyssynchronyEvidence,
      reviewStatus: 'sme-review',
    }),
    transfer: item({
      id: 'vent-safety-transfer-1',
      activityId: 'ventilation:learn:safety-reassessment-and-human-factors',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mv13-high-pressure-alarm',
      visualAssetIds: ['vent-pressure-flow-volume', 'vent-bedside-findings'],
      transferVariantId: 'mv13-alarm-cause-localization',
      stem: 'A different patient develops a high-pressure alarm. Peak pressure rises, plateau pressure is uncertain, and secretions, bronchospasm, tube obstruction, and circuit obstruction remain possible. What does alarm acknowledgment accomplish?',
      choices: [
        {
          id: 'signal-acknowledged',
          label:
            'It records and temporarily quiets the alert; the patient, airway, circuit, and pressure components still require assessment',
          rationale: 'Acknowledgment changes alert handling, not the cause of the high pressure.',
          plausibility: 'best',
        },
        {
          id: 'cause-treated',
          label: 'It treats the cause and makes further bedside assessment unnecessary',
          rationale:
            'No physiologic, airway, or circuit problem is corrected by acknowledging an alert.',
          plausibility: 'unsafe',
        },
        {
          id: 'pressure-normal',
          label: 'It proves that the pressure measurement is now normal',
          rationale: 'Measurement validity and mechanism must be established independently.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['signal-acknowledged'],
      explanation:
        'A safe transfer requires bedside assessment, airway/circuit inspection, a peak-to-plateau comparison, action on the localized cause, and closed-loop reassessment.',
      evidenceIds: mechanicsEvidence,
      reviewStatus: 'sme-review',
    }),
  },
} as const
