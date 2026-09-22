import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { pacAdvancementScenario } from './pacAdvancementReasoning'
import { pacGuidedLearningItems } from './pacLearningItems'
import type { HemodynamicsSectionId } from './sectionSpecs'

/**
 * The prediction and the transfer for every section of the rebuilt pathway.
 *
 * Six sections keep the items H0–H5 authored (`pacLearningItems.ts`) or reuse a commitment from
 * the advancement scenarios; three are new here — the orientation, the place-naming prediction
 * the waveform section answers on the catheter map, and the capstone's — and two existing items are
 * moved to the section whose concept they test: the tricuspid-regurgitation item leaves the
 * place-naming section for the one that reads waves inside a named place, and the true-wedge
 * item that used to open catheter advancement is retired (its question is the wedge section's
 * plausibility commitment).
 *
 * Everything goes through the shared schema at import, so a banned term or an unkeyed choice is a
 * build failure. Every item authored or edited here is `draft`, awaiting subject-matter review.
 */
function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const orientationEvidence = ['pac-review-2014', 'esicm-shock-2025', 'icu-hemodynamics-model-v1']
const waveformEvidence = ['pac-waveforms-part-1-2021', 'clinical-hemodynamics-waveforms']
const capstoneEvidence = [
  'arterial-pressure-five-step-2020',
  'pac-waveforms-part-1-2021',
  'monitor-workflow-supplied',
]

export interface HemodynamicsSectionItems {
  readonly prediction: ClinicalLearningItem
  readonly transfer: ClinicalLearningItem
}

/** A scenario commitment, re-declared as the transfer it serves without a second copy of its copy. */
function transferFromScenario(
  scenarioId: string,
  id: string,
  transferVariantId: string,
): ClinicalLearningItem {
  const source = pacAdvancementScenario(scenarioId).commitment
  return item({
    ...source,
    id,
    phase: 'transfer',
    itemType: 'transfer-case',
    transferVariantId,
  })
}

const whyMeasure: HemodynamicsSectionItems = {
  prediction: item({
    id: 'hd-why-predict-1',
    activityId: 'hemodynamics:learn:why-measure',
    phase: 'predict',
    itemType: 'mechanism-interpretation',
    contextRequirement: 'patient',
    clinicalContextId: 'why-measure-low-arterial-pressure',
    stem: 'An adult is hypotensive after a long operation. The arterial line is level, zeroed and crisp, and its mean pressure is low. What does that number establish on its own?',
    choices: [
      {
        id: 'driving-pressure-only',
        label:
          'That arterial pressure is low at the measurement site, without establishing cardiac output or cause.',
        rationale:
          'Pressure is force per unit area; flow is volume per unit time. A valid low arterial pressure does not distinguish reduced cardiac output from reduced vascular resistance or establish the cause.',
        plausibility: 'best',
      },
      {
        id: 'needs-fluid',
        label: 'That the circulation is under-filled, so the next step is to give fluid.',
        rationale:
          'A low pressure can come from low cardiac output, from vasodilation (low systemic vascular resistance) or from an obstruction to flow. Low circulating volume is one cause among several, and the arterial number cannot pick it out.',
        // HD-PRE-REVIEW-01 (report L1-02): was 'reasonable-but-incomplete', which the card reads
        // out as "Partly correct. Defensible, but not the whole picture" — an endorsement of an
        // inference the option's own rationale, and the item's explanation, both reject. The key,
        // the wording and the source are unchanged; only the label that contradicted them moves.
        // Same correction as HD-03-05 on 'measures-resistance' below.
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'heart-failing',
        label: 'That the heart is failing, because pressure is what the heart produces.',
        rationale:
          'The heart generates flow; arterial pressure reflects that flow meeting vascular resistance. A failing heart is one way to lower it and vasodilation is another, and the displayed number can be the same.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    correctChoiceIds: ['driving-pressure-only'],
    explanation:
      'A valid arterial pressure establishes pressure at the measurement site. Cardiac output and additional clinical context help interpret it. A low pressure alone neither establishes fluid benefit nor mandates a pulmonary-artery catheter or a specific treatment.',
    evidenceIds: orientationEvidence,
    reviewStatus: 'draft',
  }),
  transfer: item({
    id: 'hd-why-transfer-1',
    activityId: 'hemodynamics:learn:why-measure',
    phase: 'transfer',
    itemType: 'transfer-case',
    contextRequirement: 'patient',
    clinicalContextId: 'why-measure-pa-catheter',
    transferVariantId: 'why-measure-what-the-catheter-measures',
    stem: 'A pulmonary-artery catheter has been placed in a patient in shock, and its tracings are trustworthy. Which answer separates what the catheter itself measures or collects from what is later calculated or interpreted?',
    choices: [
      {
        id: 'measures-pressures-flow-samples',
        label:
          'Transduced pressures, a temperature–time curve used to derive cardiac output, and a distal blood sample for laboratory analysis.',
        rationale:
          'The transducer measures pressure and the thermistor senses temperature. Thermodilution derives cardiac output from the temperature curve and injection information. A distal sample is analyzed for saturation; oxygen content is calculated using hemoglobin and oxygen measurements.',
        plausibility: 'best',
      },
      {
        id: 'measures-resistance',
        label:
          'The resistance the heart pumps against, since that is what the catheter is placed to find.',
        rationale:
          'Resistance is calculated from a pressure difference and a flow. It is only as good as the pressures and the flow measurement it was built from.',
        // HD-03-05: was 'reasonable-but-incomplete'. The catheter does not measure resistance.
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'measures-responsiveness',
        label:
          'Whether the patient will respond to fluid, because that is what a filling pressure is for.',
        rationale:
          'A filling pressure is a pressure. Whether more volume would raise flow is a prediction that needs a change and a response, not a single reading.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    correctChoiceIds: ['measures-pressures-flow-samples'],
    explanation:
      'Distinguish the pressure signal, the thermodilution measurement workflow, and the blood sample. Laboratory saturation and calculated oxygen content are separate from sampling. Resistance and oxygen delivery are further calculated variables; fluid benefit requires additional clinical evaluation.',
    evidenceIds: orientationEvidence,
    reviewStatus: 'draft',
  }),
}

const pressureSystem: HemodynamicsSectionItems = {
  prediction: pacGuidedLearningItems['pressure-system'].prediction,
  transfer: pacGuidedLearningItems['pressure-system'].transfer,
}

const waveformInterpretation: HemodynamicsSectionItems = {
  prediction: item({
    id: 'hd-place-predict-1',
    activityId: 'hemodynamics:learn:waveform-interpretation',
    phase: 'predict',
    itemType: 'signal-recognition',
    contextRequirement: 'technical',
    clinicalContextId: 'pac-name-the-place',
    visualAssetIds: ['pac-live-waveform'],
    stem: 'The line is trustworthy and the tracing from the catheter tip is on the monitor with its chamber label covered. Where is the tip?',
    choices: [
      {
        id: 'ra',
        label: 'The right atrium',
        rationale:
          'An atrial tracing is low and quiet, with small waves and descents. This tracing has a tall peak.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'rv',
        label: 'The right ventricle',
        rationale:
          'A tall peak, a diastole that falls to a low diastolic pressure and rises through filling, and no notch on the way down: the ventricle.',
        plausibility: 'best',
      },
      {
        id: 'pa',
        label: 'The pulmonary artery',
        rationale:
          'The artery shares the peak but maintains a higher diastolic pressure between beats and shows a notch as the valve closes. Neither is here.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'wedge',
        label: 'The wedge',
        rationale:
          'A wedge is an atrial shape again — low, with a and v waves — and would need the balloon up. This tracing is neither.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'cannot-name',
        label: 'It cannot be named from this display',
        rationale:
          'Not on this display: the line has been checked, the scale fits, and the shape carries the features that name the chamber. This is the right reading when the signal itself cannot be trusted — a ringing or damped line, a scale that clips the tracing, or a tip still moving — and then the next step is to repair or re-read before naming any place.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    correctChoiceIds: ['rv'],
    explanation:
      'The systolic number cannot tell the ventricle from the artery, because they normally share it. The diastole can: diastolic pressure that falls low and climbs, with no notch, is the ventricle; a diastolic step-up and a notch on the way down is the artery.',
    evidenceIds: waveformEvidence,
    reviewStatus: 'draft',
  }),
  transfer: item({
    ...pacGuidedLearningItems['waveform-interpretation'].transfer,
    id: 'hd-place-transfer-1',
    stem: 'The live PAC tracing is shown in a new model example with faster breathing and higher positive-pressure support. Use its pressure morphology and delayed timing against the ECG to identify its origin.',
    visualAssetIds: ['pac-live-waveform'],
    choices: [
      ...pacGuidedLearningItems['waveform-interpretation'].transfer.choices,
      {
        id: 'cannot-name',
        label: 'It cannot be named from this display',
        rationale:
          'Not on this display: the timing against the ECG is shown, and an atrial-shaped tracing whose waves arrive later than the right atrium’s is left-atrial pressure transmitted back through the occluded branch. Choose this answer when the signal itself cannot be trusted, and repair or re-read before naming a place.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    reviewStatus: 'draft',
  }),
}

const waveformComponents: HemodynamicsSectionItems = {
  prediction: item({
    ...pacGuidedLearningItems['waveform-interpretation'].prediction,
    id: 'hd-waves-predict-1',
    activityId: 'hemodynamics:learn:waveform-components',
    reviewStatus: 'draft',
  }),
  transfer: item({
    id: 'hd-waves-transfer-1',
    activityId: 'hemodynamics:learn:waveform-components',
    phase: 'transfer',
    itemType: 'transfer-case',
    contextRequirement: 'patient',
    clinicalContextId: 'pac-waves-converging-diastolic',
    transferVariantId: 'waveform-components-lost-y-descent',
    stem: 'A hypotensive, tachycardic adult has a confirmed right-atrial tracing on a trustworthy line. Its x descent is preserved and its y descent has all but disappeared, and the diastolic pressures on every channel sit close together. Which mechanism best explains the tracing?',
    choices: [
      {
        id: 'pericardial-constraint',
        label:
          'Tamponade: fluid under pressure around the heart limits filling throughout diastole, so the early-diastolic y descent is lost.',
        rationale:
          'Tamponade compresses the chambers through the whole of diastole. Early rapid filling — the y descent — cannot happen, while systolic emptying still lowers atrial pressure and keeps the x descent.',
        plausibility: 'best',
      },
      {
        id: 'constriction',
        label:
          'Constriction: a stiff pericardium halts filling abruptly and produces the same loss of the y descent.',
        rationale:
          'A stiff pericardium allows rapid early filling and then stops it: the y descent is exaggerated rather than lost. The two are confused precisely because both raise and equalise the diastolic pressures.',
        // HD-PRE-REVIEW-01 (report L4-07): the rationale says constriction predicts the opposite
        // finding, so "Defensible, but not the whole picture" endorsed a mechanism the same card
        // then rejects. The differential, the key and the source are unchanged.
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'tricuspid-regurgitation',
        label:
          'Tricuspid regurgitation: a systolic leak back into the atrium that reshapes the atrial waves.',
        rationale:
          'Regurgitation floods the atrium in systole, so it is the x descent that is lost under a tall c-v wave — not the y descent, and not with the diastolic pressures drawn together.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    correctChoiceIds: ['pericardial-constraint'],
    explanation:
      'The same tracing, read letter by letter: a lost y descent with a kept x descent, alongside diastolic pressures that have converged, fits filling limited through the whole of diastole. The pattern supports the mechanism; it does not diagnose it, and the bedside and the echo decide.',
    evidenceIds: waveformEvidence,
    reviewStatus: 'draft',
  }),
}

/**
 * The advancement scenario's own commitment, its keyed choice as authored.
 *
 * The flow rebuild trimmed that label to "the ventricular shape" so the keyed option would not be the
 * longest, and appended the full label to the rationale. HD-01 restores the morphology the choice
 * names — a clinical qualifier worth reading, not a cue to hide — and drops the appended copy. The
 * choice text is the scenario's, unchanged; the item stays `draft` until faculty review.
 */
const advancementPrediction = item({
  ...pacAdvancementScenario('ra-to-rv').commitment,
  id: 'hd-advance-predict-1',
  reviewStatus: 'draft',
})

const catheterAdvancement: HemodynamicsSectionItems = {
  prediction: advancementPrediction,
  transfer: transferFromScenario(
    'ra-signal-invalid',
    'hd-advance-transfer-1',
    'advancement-signal-invalid-hold',
  ),
}

const pawpCapture: HemodynamicsSectionItems = {
  prediction: pacGuidedLearningItems['pawp-capture'].prediction,
  transfer: pacGuidedLearningItems['pawp-capture'].transfer,
}

const thermodilutionSeries: HemodynamicsSectionItems = {
  prediction: pacGuidedLearningItems['thermodilution-series'].prediction,
  transfer: pacGuidedLearningItems['thermodilution-series'].transfer,
}

const derivedHemodynamics: HemodynamicsSectionItems = {
  prediction: pacGuidedLearningItems['derived-hemodynamics'].prediction,
  transfer: pacGuidedLearningItems['derived-hemodynamics'].transfer,
}

const capstone: HemodynamicsSectionItems = {
  prediction: item({
    id: 'hd-capstone-predict-1',
    activityId: 'hemodynamics:learn:pac-signal-validation',
    phase: 'predict',
    itemType: 'management-decision',
    contextRequirement: 'patient',
    clinicalContextId: 'pac-capstone-numbers-changed',
    stem: 'Since the last set of readings the displayed pressures have moved, the three thermodilution numbers disagree with each other, and the patient looks the same as an hour ago. What do you commit to first?',
    choices: [
      {
        id: 'doubt-the-screen-first',
        label:
          'Set every number aside as unconfirmed and check the line and the tip before anything else.',
        rationale:
          'When the screen changes and the patient does not, the first suspect is the measurement, not the circulation. Each doubtful number is restored in order — the line, the tip, the series — before any of them is read.',
        plausibility: 'best',
      },
      {
        id: 'repeat-the-series',
        label:
          'Repeat the thermodilution series, since the disagreeing numbers are the most obvious problem.',
        rationale:
          'A series repeated on an unchecked line and an unconfirmed tip inherits both problems. The disagreement is the loudest sign, not the first thing to fix.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'treat-the-pattern',
        label:
          'Treat the new pressure pattern now, because the patient may deteriorate before the checks are finished.',
        rationale:
          'Treating a number that has not been confirmed treats the line. The patient is unchanged; the checks take minutes and the treatment could do harm.',
        plausibility: 'unsafe',
      },
      {
        id: 'blame-the-ventilator',
        label:
          'Attribute the change to the ventilator, since positive pressure alters every reading.',
        rationale:
          'Positive pressure moves readings with the breath and is handled by reading at end expiration. It does not move a whole set of pressures between one hour and the next, nor make curves disagree.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    correctChoiceIds: ['doubt-the-screen-first'],
    explanation:
      'One patient, one hour, one changed screen. The order that restores it is the order of the table: the line first, then where the tip is, then the series, and only then the numbers made of numbers.',
    evidenceIds: capstoneEvidence,
    reviewStatus: 'draft',
  }),
  transfer: item({
    id: 'hd-capstone-transfer-1',
    activityId: 'hemodynamics:learn:pac-signal-validation',
    phase: 'transfer',
    itemType: 'transfer-case',
    contextRequirement: 'technical',
    clinicalContextId: 'pac-capstone-blunted-arterial',
    visualAssetIds: ['fast-flush-trace'],
    transferVariantId: 'capstone-overdamped-arterial-line',
    stem: 'On a different patient the arterial tracing has become rounded, its peak is blunted and its pulse pressure narrow, while the mean has hardly moved. A colleague reads the lower systolic pressure as a fall in blood pressure and reaches for a vasopressor. What comes first?',
    choices: [
      {
        id: 'flush-and-repair-first',
        label:
          'Run a fast flush and read how the line settles; if it creeps back without a ring, repair the fluid path before any pressure is treated.',
        rationale:
          'A rounded, blunted tracing with a preserved mean is the shape of a damped line. The flush response settles whether the shape is the patient’s or the tubing’s, and the tubing is repaired before the number is believed.',
        plausibility: 'best',
      },
      {
        id: 'level-and-zero',
        label:
          'Re-level and re-zero the transducer first; the reference is checked before anything else on a line.',
        rationale:
          'Level and zero shift the whole tracing and change no shape. A rounded upstroke and a lost peak are a shape change, which those two checks cannot produce or repair.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'treat-the-number',
        label:
          'Start the vasopressor now and troubleshoot the line afterwards; a low systolic pressure cannot wait.',
        rationale:
          'The mean has not moved and the shape says the line is damped. Treating the systolic number here treats the tubing, with a drug.',
        plausibility: 'unsafe',
      },
    ],
    correctChoiceIds: ['flush-and-repair-first'],
    explanation:
      'The same rows, on a systemic arterial line: a shape change with a preserved mean lives in the fluid path, the flush response confirms it, and the repair comes before the reading — however urgent the number looks.',
    evidenceIds: capstoneEvidence,
    reviewStatus: 'draft',
  }),
}

export const hemodynamicsStageItems: Readonly<
  Record<HemodynamicsSectionId, HemodynamicsSectionItems>
> = {
  'why-measure': whyMeasure,
  'pressure-system': pressureSystem,
  'waveform-interpretation': waveformInterpretation,
  'waveform-components': waveformComponents,
  'catheter-advancement': catheterAdvancement,
  'pawp-capture': pawpCapture,
  'thermodilution-series': thermodilutionSeries,
  'derived-hemodynamics': derivedHemodynamics,
  'pac-signal-validation': capstone,
}

export function hemodynamicsSectionItems(
  sectionId: HemodynamicsSectionId,
): HemodynamicsSectionItems {
  return hemodynamicsStageItems[sectionId]
}

export function validateHemodynamicsStageItems(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const [sectionId, items] of Object.entries(hemodynamicsStageItems)) {
    for (const [role, entry] of [
      ['prediction', items.prediction],
      ['transfer', items.transfer],
    ] as const) {
      if (ids.has(entry.id)) errors.push(`Item ${entry.id} is used twice.`)
      ids.add(entry.id)
      if (entry.activityId !== `hemodynamics:learn:${sectionId}`) {
        errors.push(`The ${role} of ${sectionId} belongs to ${entry.activityId}.`)
      }
      if (role === 'transfer' && entry.phase !== 'transfer') {
        errors.push(`The transfer of ${sectionId} is not a transfer item.`)
      }
      if (role === 'prediction' && entry.phase === 'transfer') {
        errors.push(`The prediction of ${sectionId} is a transfer item.`)
      }
    }
    if (items.prediction.stem === items.transfer.stem) {
      errors.push(`The transfer of ${sectionId} repeats its prediction's stem.`)
    }
  }
  return errors
}

const stageItemErrors = validateHemodynamicsStageItems()
if (stageItemErrors.length > 0) {
  throw new Error(`Hemodynamics stage items are invalid:\n${stageItemErrors.join('\n')}`)
}
