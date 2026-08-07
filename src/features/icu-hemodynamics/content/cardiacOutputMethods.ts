/**
 * One canonical description of every cardiac-output method this module teaches.
 *
 * H4's core claim is that a cardiac-output result is not trustworthy merely because the monitor
 * produced a number. That claim only survives if the learner can trace one specific number back
 * through raw observation → acquisition conditions → measured inputs → assumptions → calculation →
 * repeated observations → accepted result → limitations → interpretation boundary.
 *
 * Before this file the module had two separate accounts of that chain: prose in the teaching panel
 * and behavior in the thermodilution engine, with nothing tying them together, and Fick existed only
 * as three bullet points with no inputs, no units, and no way to be wrong. The single worst
 * consequence was that "direct Fick" and "Fick with an assumed oxygen consumption" were one prose
 * paragraph rather than two methods, so the module could describe an assumption as a measurement
 * without contradicting itself.
 *
 * Everything H4 renders — panels, figures, text equivalents, the disagreement lab, and the numeric
 * audit — reads these records. A learner-facing sentence that is not derived from a record here is a
 * second authoring of the same fact, which is the thing this file exists to prevent.
 */

import { hemodynamicsSourceById } from './sources'

/* ------------------------------------------------------------------ *
 * Input provenance — the vocabulary every H4 surface labels values with
 * ------------------------------------------------------------------ */

/**
 * How a number reached the calculation.
 *
 * The distinction that matters most is `measured` versus `assumed`: a monitor displays both in the
 * same typeface, and the whole point of this section is that they are not the same kind of claim.
 * `sampled` is separated from `measured` because a sample carries a location and a time that a
 * continuous measurement does not, and both are part of whether the value is usable.
 */
export const cardiacOutputInputStatuses = [
  'measured',
  'sampled',
  'entered',
  'assumed',
  'calculated',
] as const

export type CardiacOutputInputStatus = (typeof cardiacOutputInputStatuses)[number]

export const cardiacOutputInputStatusLabels: Readonly<
  Record<CardiacOutputInputStatus, { readonly label: string; readonly detail: string }>
> = Object.freeze({
  measured: {
    label: 'Measured',
    detail: 'An instrument produced this value from the patient during this acquisition.',
  },
  sampled: {
    label: 'Sampled',
    detail:
      'A specimen was drawn from a named site at a named time, and both the site and the time are part of whether the value can be used.',
  },
  entered: {
    label: 'Entered',
    detail:
      'A person typed or selected this value. The calculation cannot tell whether it matches what was actually done.',
  },
  assumed: {
    label: 'Assumed',
    detail:
      'No one measured this on this patient. A substituted value stands in for it, and the result inherits that substitution.',
  },
  calculated: {
    label: 'Calculated',
    detail: 'An equation produced this value from the values above it. It was not observed.',
  },
})

/** Trial and result labels reused verbatim across every H4 surface. */
export const cardiacOutputResultLabels = Object.freeze({
  acceptedTrial: 'Accepted trial',
  excludedTrial: 'Excluded trial',
  unreviewedTrial: 'Not yet reviewed',
  methodResult: 'Method result',
  notInterpretable: 'Not interpretable',
})

/* ------------------------------------------------------------------ *
 * The method record
 * ------------------------------------------------------------------ */

export const cardiacOutputMethodIds = ['thermodilution', 'fick-direct', 'fick-assumed-vo2'] as const

export type CardiacOutputMethodId = (typeof cardiacOutputMethodIds)[number]

export type CardiacOutputMethodFamily = 'indicator-dilution' | 'fick'

/**
 * Whether the oxygen consumption in a Fick calculation was measured on this patient.
 *
 * `null` on a method outside the Fick family. This field is what makes the direct-versus-assumed
 * distinction structural rather than editorial: `validateCardiacOutputMethods` refuses a record that
 * carries an assumed oxygen consumption and a name containing "direct".
 */
export type CardiacOutputVo2Provenance = 'measured' | 'assumed'

export interface CardiacOutputMethodInput {
  readonly id: string
  readonly label: string
  readonly status: CardiacOutputInputStatus
  readonly unit: string | null
  /** What the quantity is, in a sentence a novice can read. */
  readonly whatItIs: string
  /** The specific way this input degrades the result when it is not what it appears to be. */
  readonly howItGoesWrong: string
}

export interface CardiacOutputAcquisitionStep {
  readonly order: number
  readonly whatYouDo: string
  readonly whatItEstablishes: string
}

export interface CardiacOutputQualityCheck {
  readonly id: string
  readonly label: string
  readonly whatToLookFor: string
  readonly whenItIsNotMet: string
}

export interface CardiacOutputFailureMode {
  readonly id: string
  readonly label: string
  readonly mechanism: string
  /**
   * What the failure does to the number. Deliberately allowed to say the direction is unresolved —
   * see `cardiacOutputOpenMethodQuestions` in `cardiacOutputSourceBoundaries.ts`.
   */
  readonly effectOnResult: string
  /** Whether the learner could see this from the acquisition alone. */
  readonly visibleInAcquisition: boolean
}

export interface CardiacOutputMethod {
  readonly id: CardiacOutputMethodId
  readonly name: string
  readonly family: CardiacOutputMethodFamily
  readonly vo2Provenance: CardiacOutputVo2Provenance | null
  /** The quantity the method is trying to estimate — question one of the four this section answers. */
  readonly measurand: string
  /** The physical event a person could watch happen. */
  readonly directlyObserved: string
  /** The raw data the result is computed from, before any number is displayed. */
  readonly rawDataRepresentation: string
  readonly inputs: readonly CardiacOutputMethodInput[]
  /** The calculation, written so a learner can follow the units through it. */
  readonly calculationAccount: readonly string[]
  readonly acquisitionSequence: readonly CardiacOutputAcquisitionStep[]
  readonly qualityChecks: readonly CardiacOutputQualityCheck[]
  readonly repeatabilityChecks: readonly CardiacOutputQualityCheck[]
  readonly failureModes: readonly CardiacOutputFailureMode[]
  readonly repeatWhen: readonly string[]
  readonly withholdWhen: readonly string[]
  /** What the other method is for, stated without ranking the two. */
  readonly alternateMethodRole: string
  readonly interpretationBoundary: string
  readonly evidenceIds: readonly string[]
  readonly sourceLimitations: readonly string[]
}

/* ------------------------------------------------------------------ *
 * The three methods
 * ------------------------------------------------------------------ */

const thermodilution: CardiacOutputMethod = {
  id: 'thermodilution',
  name: 'Bolus thermodilution',
  family: 'indicator-dilution',
  vo2Provenance: null,
  measurand:
    'Blood flow through the right heart per minute, in liters per minute, averaged over the seconds the indicator takes to pass the thermistor.',
  directlyObserved:
    'A cooler-than-blood injectate entering near the right atrium, and a temperature change arriving downstream at the pulmonary-artery thermistor a few seconds later.',
  rawDataRepresentation:
    'A temperature-against-time curve: a stable baseline, an onset, a peak change away from baseline, a decay back toward baseline, and any secondary disturbance after the main curve.',
  inputs: [
    {
      id: 'injectate-volume',
      label: 'Injectate volume',
      status: 'entered',
      unit: 'mL',
      whatItIs:
        'The volume the computation constant assumes was delivered. The monitor uses the entered figure, not the volume that actually entered the patient.',
      howItGoesWrong:
        'Delivering less than the entered volume puts less indicator into the blood, so the recorded temperature change is smaller and the flow the monitor derives is larger than the true flow.',
    },
    {
      id: 'injectate-temperature',
      label: 'Injectate temperature',
      status: 'entered',
      unit: '°C',
      whatItIs:
        'The starting temperature the computation constant assumes. It sets the size of the thermal gradient the method relies on.',
      howItGoesWrong:
        'An injectate warmer than the entered value delivers a smaller thermal signal than the calculation expects, moving the derived flow in the same direction as a short-volume injection.',
    },
    {
      id: 'injection-duration',
      label: 'Injection duration and smoothness',
      status: 'entered',
      unit: 's',
      whatItIs:
        'How long the bolus took and how continuous it was. Both shape how the indicator mixes before it reaches the thermistor.',
      howItGoesWrong:
        'A prolonged or interrupted injection spreads the indicator out, broadening the curve and changing its area without any change in the patient.',
    },
    {
      id: 'respiratory-timing',
      label: 'Respiratory phase at injection',
      status: 'entered',
      unit: null,
      whatItIs:
        'Where in the respiratory cycle the bolus was delivered. Intrathoracic pressure changes flow across the respiratory cycle.',
      howItGoesWrong:
        'Injecting at a different point in the cycle each time introduces spread between trials that looks like biological variation but comes from the operator.',
    },
    {
      id: 'blood-temperature',
      label: 'Downstream blood temperature over time',
      status: 'measured',
      unit: '°C',
      whatItIs:
        'The thermistor reading through the passage of the indicator. This is the only quantity in the method the instrument actually measures.',
      howItGoesWrong:
        'A drifting or noisy baseline makes the curve boundary ambiguous, so the area the calculation integrates is ambiguous too.',
    },
    {
      id: 'curve-area',
      label: 'Area of the temperature-time curve',
      status: 'calculated',
      unit: '°C·s',
      whatItIs:
        'The integrated temperature change over the passage of the indicator. Flow and area move in opposite directions: a larger area corresponds to lower flow.',
      howItGoesWrong:
        'The area is only as well defined as the baseline and the point at which the curve is judged to end.',
    },
    {
      id: 'thermodilution-cardiac-output',
      label: 'Cardiac output',
      status: 'calculated',
      unit: 'L/min',
      whatItIs:
        'The flow derived from the entered indicator quantity and the observed curve. It is computed from the dilution response; nothing here measures flow directly.',
      howItGoesWrong:
        'Every entered value and every curve-boundary judgement above propagates into this number, and the display shows none of them.',
    },
  ],
  calculationAccount: [
    'A known quantity of thermal indicator is entered: volume in milliliters at a stated temperature in degrees Celsius.',
    'The thermistor records blood temperature in degrees Celsius against time in seconds, giving a curve whose area has units of degrees Celsius multiplied by seconds.',
    'Flow is derived from the indicator quantity divided by that area, so a smaller area yields a larger flow and a larger area yields a smaller flow.',
    'The result is reported in liters per minute for the seconds the indicator was in transit, not for the moment the number appears on screen.',
  ],
  acquisitionSequence: [
    {
      order: 1,
      whatYouDo:
        'Confirm the catheter is in the pulmonary artery from the waveform, and that the pressure system is leveled, zeroed, and free of a distorting artifact.',
      whatItEstablishes:
        'That the injectate port and the thermistor are in the compartments the method assumes, and that the signal context around the measurement is trustworthy.',
    },
    {
      order: 2,
      whatYouDo:
        'Set the entered injectate volume and temperature so they match what will actually be delivered.',
      whatItEstablishes:
        'That the computation constant describes this injection rather than a different one.',
    },
    {
      order: 3,
      whatYouDo:
        'Say in advance what an acceptable curve should look like for this patient before generating one.',
      whatItEstablishes:
        'That the curve is being judged against an expectation rather than against the number it produced.',
    },
    {
      order: 4,
      whatYouDo:
        'Deliver one smooth, continuous bolus at a chosen point in the respiratory cycle, and use the same point for every later trial.',
      whatItEstablishes:
        'One acquisition under conditions that can be repeated deliberately rather than approximately.',
    },
    {
      order: 5,
      whatYouDo: 'Look at the raw temperature-time curve before looking at the derived number.',
      whatItEstablishes:
        'Whether the acquisition was technically usable, judged from the data rather than from whether the result looked plausible.',
    },
    {
      order: 6,
      whatYouDo: 'Accept or exclude the trial, naming a technical reason for any exclusion.',
      whatItEstablishes:
        'A defensible record of what entered the series and why anything was left out.',
    },
    {
      order: 7,
      whatYouDo:
        'Repeat with the same entered values, the same delivery, and the same respiratory timing.',
      whatItEstablishes:
        'A series whose spread reflects the patient and the method rather than the operator.',
    },
    {
      order: 8,
      whatYouDo:
        'Summarize the accepted trials and state what the resulting number still cannot establish.',
      whatItEstablishes: 'A reported flow with its method, its series, and its boundary attached.',
    },
  ],
  qualityChecks: [
    {
      id: 'baseline-stability',
      label: 'Stable baseline before the injection',
      whatToLookFor:
        'A flat temperature trace before onset, so the curve has an unambiguous starting level.',
      whenItIsNotMet:
        'A drifting baseline makes the area ambiguous; the derived number is as uncertain as the baseline it was measured from.',
    },
    {
      id: 'curve-shape',
      label: 'A single smooth rise and decay',
      whatToLookFor:
        'One clean excursion away from baseline followed by a smooth return, with no plateau, notch, or interruption partway through.',
      whenItIsNotMet:
        'A stepped or notched curve usually reports the injection rather than the patient, and should be repeated rather than accepted.',
    },
    {
      id: 'onset-timing',
      label: 'Prompt onset after injection',
      whatToLookFor:
        'The temperature change begins within a short, consistent interval of the bolus.',
      whenItIsNotMet:
        'A late or absent onset raises the question of where the injectate went, which is a catheter and port question rather than a flow question.',
    },
    {
      id: 'secondary-disturbance',
      label: 'No secondary disturbance after the main curve',
      whatToLookFor:
        'The trace returns toward baseline and stays there rather than showing a second, later excursion.',
      whenItIsNotMet:
        'A second excursion means indicator reached the thermistor by more than one route or more than once, and the simple area no longer describes a single pass.',
    },
    {
      id: 'delivery-consistency',
      label: 'The delivery matched the entered values',
      whatToLookFor:
        'The volume, temperature, duration, and respiratory phase actually used are the ones the computation constant was set to.',
      whenItIsNotMet:
        'The number is internally consistent and still describes an injection that did not happen.',
    },
  ],
  repeatabilityChecks: [
    {
      id: 'consistent-technique',
      label: 'The same acquisition, repeated deliberately',
      whatToLookFor:
        'Every trial in the series used the same entered values, the same delivery, and the same point in the respiratory cycle.',
      whenItIsNotMet:
        'Spread between trials cannot be attributed to the patient, because the operator changed between them.',
    },
    {
      id: 'spread-across-accepted-trials',
      label: 'Spread across the accepted trials',
      whatToLookFor:
        'How far apart the accepted results are, read alongside the technique that produced them.',
      whenItIsNotMet:
        'Wide spread under consistent technique is information about the measurement, not a reason to discard whichever trial is least convenient.',
    },
    {
      id: 'agreement-is-not-accuracy',
      label: 'Agreement is not accuracy',
      whatToLookFor:
        'Whether anything in the acquisition could be biasing every trial in the same direction.',
      whenItIsNotMet:
        'A series can be tightly reproducible and uniformly shifted. Repeatability describes the spread of the series; it says nothing about where the series sits.',
    },
  ],
  failureModes: [
    {
      id: 'inconsistent-injectate-technique',
      label: 'Inconsistent injectate technique',
      mechanism:
        'Volume, temperature, duration, or smoothness varied between trials, so each trial integrated a different indicator delivery.',
      effectOnResult:
        'Spread between trials that belongs to the operator, and a shifted result whenever the delivered indicator differed from the entered values.',
      visibleInAcquisition: true,
    },
    {
      id: 'baseline-temperature-drift',
      label: 'Baseline temperature drift',
      mechanism:
        'Blood temperature was moving before the injection, so the curve has no stable level to be measured from.',
      effectOnResult:
        'An ambiguous area, and a number whose uncertainty is not shown anywhere on the display.',
      visibleInAcquisition: true,
    },
    {
      id: 'respiratory-phase-inconsistency',
      label: 'Respiratory-phase inconsistency',
      mechanism:
        'Boluses were delivered at different points in the respiratory cycle, across which intrathoracic pressure and flow change.',
      effectOnResult: 'Between-trial spread that looks physiologic and is procedural.',
      visibleInAcquisition: true,
    },
    {
      id: 'catheter-position-problem',
      label: 'Injectate port or thermistor not in the assumed compartment',
      mechanism:
        'The method assumes indicator enters near the right atrium and is detected in the pulmonary artery. A tip elsewhere breaks that assumption.',
      effectOnResult:
        'The result no longer describes right-heart flow. The acquisition should be repeated after the position is re-established, not interpreted.',
      visibleInAcquisition: true,
    },
    {
      id: 'low-flow-curve',
      label: 'Low-flow curve characteristics',
      mechanism:
        'Slow transit spreads the indicator over a longer time, giving a low, prolonged curve whose end point is harder to identify.',
      effectOnResult:
        'A broader curve with a less certain boundary. This module does not assert a direction of bias in low flow.',
      visibleInAcquisition: true,
    },
    {
      id: 'tricuspid-regurgitation',
      label: 'Significant tricuspid regurgitation',
      mechanism:
        'Regurgitant flow carries indicator back and forth across the valve, so some of it reaches the thermistor late or more than once.',
      effectOnResult:
        'A broadened curve with a secondary disturbance and greater uncertainty. This module does not assert a direction of bias.',
      visibleInAcquisition: true,
    },
    {
      id: 'intracardiac-shunt',
      label: 'Intracardiac shunt',
      mechanism:
        'Indicator crosses between circulations, so what passes the thermistor is not the same volume of blood the systemic circulation received.',
      effectOnResult:
        'The measurand itself changes. A single dilution result no longer answers the question the learner asked.',
      visibleInAcquisition: false,
    },
    {
      id: 'indicator-loss-or-recirculation',
      label: 'Indicator loss or recirculation',
      mechanism:
        'Indicator is lost before the thermistor, or returns to it after passing once, so a single-pass curve no longer describes a single pass.',
      effectOnResult:
        'A distorted curve boundary and a derived flow that cannot be read off the simple area.',
      visibleInAcquisition: true,
    },
    {
      id: 'repeatable-but-biased-series',
      label: 'A reproducible series with a shared problem',
      mechanism:
        'Every trial used the same technique, and that technique was systematically off — a consistently short injection, or a consistently warm one.',
      effectOnResult:
        'Tight agreement across trials that are all shifted in the same direction. The series looks like its own confirmation.',
      visibleInAcquisition: false,
    },
  ],
  repeatWhen: [
    'The raw curve shows drift, a notch, a plateau, or a second excursion.',
    'The delivery did not match the entered volume, temperature, duration, or respiratory phase.',
    'A trial disagrees with the rest of the series and its curve shows a technical reason for it.',
    'Anything about the catheter, the pressure system, or the patient changed between trials.',
  ],
  withholdWhen: [
    'The catheter position that the method assumes has not been confirmed from the waveform.',
    'Fewer technically usable trials are available than this series is configured to summarize.',
    'The only way to reach agreement would be to exclude a trial with no technical reason for excluding it.',
    'An intracardiac shunt is present and has not been accounted for, so a single dilution result does not answer the question being asked.',
  ],
  alternateMethodRole:
    'A Fick calculation answers the same question through a different measurement system, so it can be used to interrogate a thermodilution result rather than to overrule it.',
  interpretationBoundary:
    'This gives flow during the seconds the indicator was in transit, under the acquisition conditions of these trials. It does not establish whether that flow is adequate for this patient, and it does not carry forward to a later moment on its own.',
  evidenceIds: [
    'pac-derived-part-2-2021',
    'monitor-workflow-supplied',
    'icu-hemodynamics-model-v1',
  ],
  sourceLimitations: [
    'The registered records are held as metadata; no source document text was available in this repository to verify a sentence-level claim against a locator.',
    'The injectate volume, injectate temperature, trial count, and timing windows in this module are its own configuration, not a protocol drawn from those records.',
    'The curve here is an original deterministic educational model, not calibrated device output.',
  ],
}

const fickShared = {
  family: 'fick' as const,
  measurand:
    'Blood flow per minute, in liters per minute, that would account for the oxygen the body is taking up given how much oxygen the blood loses between the arterial and mixed-venous sides.',
  directlyObserved:
    'Two blood specimens drawn from named sites, and — when it is measured rather than substituted — expired-gas analysis of oxygen uptake.',
  rawDataRepresentation:
    'Two oxygen contents in milliliters of oxygen per deciliter of blood, their difference, and an oxygen-uptake figure in milliliters per minute.',
  calculationAccount: [
    'Arterial oxygen content in milliliters of oxygen per deciliter is the oxygen bound to hemoglobin, plus a small dissolved term when it is included.',
    'Mixed-venous oxygen content is computed the same way from the pulmonary-artery specimen.',
    'The arteriovenous oxygen-content difference is the arterial content minus the mixed-venous content, still in milliliters of oxygen per deciliter.',
    'Oxygen uptake in milliliters per minute is divided by that difference, and the deciliters are converted to liters by a factor of ten, giving liters per minute.',
  ],
  qualityChecks: [
    {
      id: 'paired-in-time',
      label: 'Both specimens belong to one measurement episode',
      whatToLookFor:
        'The arterial and pulmonary-artery specimens were drawn close enough together that they describe the same circulatory state.',
      whenItIsNotMet:
        'The two contents describe two different moments, and their difference describes neither.',
    },
    {
      id: 'true-mixed-venous',
      label: 'The venous specimen is a true mixed-venous specimen',
      whatToLookFor:
        'The venous specimen came from the pulmonary artery, where the returning streams have already combined.',
      whenItIsNotMet:
        'A specimen drawn upstream of that mixing describes one region of venous return rather than the whole of it. This module withholds the calculation rather than substituting one for the other.',
    },
    {
      id: 'steady-state',
      label: 'The patient was in a steady state',
      whatToLookFor:
        'Oxygen uptake, flow, and oxygen carriage were stable across the interval the specimens and the uptake figure describe.',
      whenItIsNotMet:
        'The equation balances an uptake against a difference that were not present at the same time.',
    },
    {
      id: 'units-reconcile',
      label: 'The units reconcile end to end',
      whatToLookFor:
        'Milliliters of oxygen per minute divided by milliliters of oxygen per deciliter, with deciliters converted to liters, gives liters per minute.',
      whenItIsNotMet:
        'A number appears with the right label and the wrong magnitude, and nothing on the display says so.',
    },
    {
      id: 'content-difference-usable',
      label: 'The oxygen-content difference is usable',
      whatToLookFor:
        'The arterial content exceeds the mixed-venous content by a margin the inputs can actually support.',
      whenItIsNotMet:
        'A difference at or below zero cannot be divided into, and a very small difference makes the result extremely sensitive to error in any input.',
    },
    {
      id: 'no-unaddressed-shunt',
      label: 'No unaddressed intracardiac shunt',
      whatToLookFor:
        'Either no shunt, or a sampling scheme built for one — pulmonary and systemic flow described separately rather than by a single content difference.',
      whenItIsNotMet:
        'Across a shunt the simple form describes neither circulation. This module withholds it rather than labeling it approximate.',
    },
  ] as const,
  repeatabilityChecks: [
    {
      id: 'repeat-sampling-episode',
      label: 'Repeat the whole episode, not one number',
      whatToLookFor:
        'A repeat means new paired specimens under the same conditions, not a recalculation with one value changed.',
      whenItIsNotMet:
        'Changing one input and recalculating gives a new number with the same provenance problems as the first.',
    },
    {
      id: 'input-sensitivity',
      label: 'The same input error does not always matter the same amount',
      whatToLookFor:
        'How large the oxygen-content difference is. The difference is the denominator, so the smaller it is, the more a fixed error in any input moves the result.',
      whenItIsNotMet:
        'Two calculations with identical input quality can carry very different uncertainty, and the display shows the same number of digits for both.',
    },
    {
      id: 'agreement-is-not-accuracy-fick',
      label: 'Agreement is not accuracy',
      whatToLookFor:
        'Whether a repeat used the same substituted or mis-sited input as the original.',
      whenItIsNotMet:
        'Two calculations sharing one assumption will agree with each other and with nothing else.',
    },
  ] as const,
  alternateMethodRole:
    'A thermodilution series answers the same question through a different measurement system, so it can be used to interrogate a Fick result rather than to overrule it.',
} satisfies Partial<CardiacOutputMethod>

function fickInputs(
  vo2Provenance: CardiacOutputVo2Provenance,
): readonly CardiacOutputMethodInput[] {
  return [
    {
      id: 'vo2',
      label: 'Oxygen uptake',
      status: vo2Provenance === 'measured' ? 'measured' : 'assumed',
      unit: 'mL/min',
      whatItIs:
        vo2Provenance === 'measured'
          ? 'Oxygen consumption determined for this patient during this episode by expired-gas analysis.'
          : 'A substituted oxygen-consumption figure. Nothing about this patient was measured to produce it.',
      howItGoesWrong:
        vo2Provenance === 'measured'
          ? 'It describes the interval it was collected over. Pairing it with specimens from a different state breaks the balance the equation depends on.'
          : 'It is the numerator, so the result moves in direct proportion to it. A substituted figure that does not fit this patient shifts the answer by the same proportion, and the display gives no sign of it.',
    },
    {
      id: 'hemoglobin',
      label: 'Hemoglobin concentration',
      status: 'measured',
      unit: 'g/dL',
      whatItIs:
        'How much oxygen-carrying protein the blood contains. It scales both oxygen contents together.',
      howItGoesWrong:
        'Because it scales both contents, it scales their difference too, so an error in it moves the result in proportion.',
    },
    {
      id: 'arterial-saturation',
      label: 'Arterial oxygen saturation',
      status: 'sampled',
      unit: 'fraction',
      whatItIs: 'The fraction of hemoglobin carrying oxygen in the arterial specimen.',
      howItGoesWrong:
        'It sets the top of the content difference. A small absolute error here becomes a large proportional error whenever the difference itself is small.',
    },
    {
      id: 'mixed-venous-saturation',
      label: 'Mixed-venous oxygen saturation',
      status: 'sampled',
      unit: 'fraction',
      whatItIs:
        'The fraction of hemoglobin carrying oxygen in the pulmonary-artery specimen, after all venous return has mixed.',
      howItGoesWrong:
        'It sets the bottom of the content difference, and it is the input most sensitive to where and when the specimen was drawn.',
    },
    {
      id: 'venous-sample-site',
      label: 'Venous sampling site',
      status: 'entered',
      unit: null,
      whatItIs:
        'Where the venous specimen was drawn. Only a pulmonary-artery specimen has passed the point where all venous return has combined.',
      howItGoesWrong:
        'A specimen from upstream of that point describes a region rather than the whole, and the number it produces is not the quantity the equation is written for.',
    },
    {
      id: 'sample-timing',
      label: 'Sampling time relative to the uptake figure',
      status: 'entered',
      unit: null,
      whatItIs:
        'Whether the specimens and the oxygen-uptake figure describe the same interval and the same circulatory state.',
      howItGoesWrong:
        'Pairing values from different states produces an arithmetically complete answer to a question nobody asked.',
    },
    {
      id: 'dissolved-oxygen',
      label: 'Dissolved-oxygen term',
      status: 'calculated',
      unit: 'mL/dL',
      whatItIs:
        'The small amount of oxygen carried in solution rather than on hemoglobin, included in each content when the partial pressures are available.',
      howItGoesWrong:
        'Including it in one content and not the other changes the difference by an amount that is small and entirely artificial.',
    },
    {
      id: 'arterial-content',
      label: 'Arterial oxygen content',
      status: 'calculated',
      unit: 'mL/dL',
      whatItIs: 'Oxygen carried per deciliter of arterial blood, computed from the inputs above.',
      howItGoesWrong: 'It inherits every error in hemoglobin, saturation, and the dissolved term.',
    },
    {
      id: 'mixed-venous-content',
      label: 'Mixed-venous oxygen content',
      status: 'calculated',
      unit: 'mL/dL',
      whatItIs: 'Oxygen carried per deciliter of mixed-venous blood, computed the same way.',
      howItGoesWrong: 'Same inheritance, plus the sampling site and timing of the specimen.',
    },
    {
      id: 'content-difference',
      label: 'Arteriovenous oxygen-content difference',
      status: 'calculated',
      unit: 'mL/dL',
      whatItIs:
        'How much oxygen each deciliter of blood gave up on its way around. This is the denominator of the calculation.',
      howItGoesWrong:
        'Being the denominator, it governs how much any other error matters. As it shrinks, the same absolute input error produces a larger proportional error in the result.',
    },
    {
      id: 'fick-cardiac-output',
      label: 'Cardiac output',
      status: 'calculated',
      unit: 'L/min',
      whatItIs:
        'Flow derived from the oxygen uptake and the content difference. Nothing here measures flow directly.',
      howItGoesWrong:
        'It carries the provenance of every input above it, and the display shows none of that provenance.',
    },
  ]
}

const fickAcquisitionSequence = (
  vo2Provenance: CardiacOutputVo2Provenance,
): readonly CardiacOutputAcquisitionStep[] => [
  {
    order: 1,
    whatYouDo: 'Confirm the patient is in a steady state and say what that judgement rests on.',
    whatItEstablishes:
      'That an uptake figure and a content difference from the same interval describe the same physiology.',
  },
  {
    order: 2,
    whatYouDo:
      vo2Provenance === 'measured'
        ? 'Collect oxygen uptake by expired-gas analysis over the interval the specimens will describe.'
        : 'Record that no oxygen uptake was measured, and that a substituted figure is being used in its place.',
    whatItEstablishes:
      vo2Provenance === 'measured'
        ? 'A numerator that belongs to this patient and this interval.'
        : 'That the numerator is an assumption, and that the result is an estimate that depends on it.',
  },
  {
    order: 3,
    whatYouDo:
      'Draw the arterial specimen and the pulmonary-artery specimen close together in time, and record both sites.',
    whatItEstablishes:
      'Two contents that can legitimately be subtracted, from sites the equation is written for.',
  },
  {
    order: 4,
    whatYouDo: 'Enter hemoglobin and both saturations, and note whether a dissolved term is used.',
    whatItEstablishes: 'A content calculation whose components can each be pointed at.',
  },
  {
    order: 5,
    whatYouDo:
      'Read the oxygen-content difference before reading the flow, and note how small it is.',
    whatItEstablishes:
      'How much any input error will matter, which is a property of this episode rather than of the method.',
  },
  {
    order: 6,
    whatYouDo:
      'Follow the units through the division, then report the flow with the method named and the oxygen-uptake provenance attached.',
    whatItEstablishes: 'A result that cannot be quoted without the assumption it rests on.',
  },
]

const fickSharedFailureModes: readonly CardiacOutputFailureMode[] = [
  {
    id: 'venous-site-not-mixed',
    label: 'Venous specimen drawn upstream of mixing',
    mechanism:
      'A specimen taken before the venous streams combine describes one region of return rather than the whole of it.',
    effectOnResult:
      'A content difference that belongs to a different quantity. This module withholds the result rather than treating the two specimens as interchangeable.',
    visibleInAcquisition: true,
  },
  {
    id: 'samples-not-paired',
    label: 'Specimens not paired in time',
    mechanism:
      'The arterial and venous specimens, or the specimens and the uptake figure, describe different moments.',
    effectOnResult: 'An arithmetically complete result describing no single circulatory state.',
    visibleInAcquisition: true,
  },
  {
    id: 'non-steady-state',
    label: 'Loss of steady state',
    mechanism:
      'Flow, uptake, or oxygen carriage changed across the interval the calculation treats as one state.',
    effectOnResult:
      'The balance the equation depends on did not hold while the inputs were being collected.',
    visibleInAcquisition: true,
  },
  {
    id: 'small-content-difference',
    label: 'A very small oxygen-content difference',
    mechanism:
      'When the arterial and mixed-venous contents are close, the denominator is small and the division amplifies whatever error the inputs carry.',
    effectOnResult:
      'The same absolute error in a saturation or in hemoglobin produces a much larger proportional error in the flow.',
    visibleInAcquisition: true,
  },
  {
    id: 'unaddressed-shunt-fick',
    label: 'Intracardiac shunt not accounted for',
    mechanism:
      'With a shunt, pulmonary and systemic flow differ, and one content difference cannot describe both.',
    effectOnResult:
      'The simple form answers neither question. Separate pulmonary and systemic sampling is a different calculation, not a correction factor.',
    visibleInAcquisition: false,
  },
  {
    id: 'hemoglobin-error',
    label: 'Hemoglobin error',
    mechanism:
      'Hemoglobin scales both oxygen contents, so it scales their difference and therefore the denominator.',
    effectOnResult: 'A proportional shift in the result with no change in either saturation.',
    visibleInAcquisition: false,
  },
]

const fickDirect: CardiacOutputMethod = {
  id: 'fick-direct',
  name: 'Direct Fick with measured oxygen uptake',
  family: fickShared.family,
  vo2Provenance: 'measured',
  measurand: fickShared.measurand,
  directlyObserved: fickShared.directlyObserved,
  rawDataRepresentation: fickShared.rawDataRepresentation,
  inputs: fickInputs('measured'),
  calculationAccount: fickShared.calculationAccount,
  acquisitionSequence: fickAcquisitionSequence('measured'),
  qualityChecks: [
    ...fickShared.qualityChecks,
    {
      id: 'vo2-actually-measured',
      label: 'Oxygen uptake was measured on this patient',
      whatToLookFor:
        'A recorded expired-gas measurement covering the interval the specimens describe.',
      whenItIsNotMet:
        'If no measurement exists, this is not direct Fick. It is the assumed-uptake method and must be labeled as such.',
    },
  ],
  repeatabilityChecks: fickShared.repeatabilityChecks,
  failureModes: [
    ...fickSharedFailureModes,
    {
      id: 'vo2-interval-mismatch',
      label: 'Measured uptake from a different interval',
      mechanism:
        'A genuinely measured uptake figure still has to belong to the same interval as the specimens.',
      effectOnResult:
        'A measured numerator and a mismatched denominator, which is a timing problem rather than a provenance one.',
      visibleInAcquisition: true,
    },
  ],
  repeatWhen: [
    'The specimens and the uptake collection did not cover the same interval.',
    'Anything about ventilation, oxygenation, or hemodynamics changed while the inputs were being collected.',
    'The oxygen-content difference is small enough that the result carries more uncertainty than the display suggests.',
  ],
  withholdWhen: [
    'A required input is missing, or the two saturations are internally contradictory.',
    'The oxygen-content difference is at or below zero, so the simple form cannot be used.',
    'The venous specimen did not come from the pulmonary artery.',
    'The patient was not in a steady state, or the inputs do not belong to one measurement episode.',
    'An intracardiac shunt is present and has not been addressed with separate pulmonary and systemic sampling.',
  ],
  alternateMethodRole: fickShared.alternateMethodRole,
  interpretationBoundary:
    'This gives the flow that accounts for measured oxygen uptake during one steady interval. It does not establish whether that flow meets this patient’s demand, and it does not describe any other interval.',
  evidenceIds: ['esc-ers-ph-2022', 'pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
  sourceLimitations: [
    'The registered records are held as metadata; no source document text was available in this repository to verify a sentence-level claim against a locator.',
    'The hemoglobin oxygen-binding capacity and the dissolved-oxygen coefficient used here are labeled model constants, not values traced to a registered record.',
  ],
}

const fickAssumedVo2: CardiacOutputMethod = {
  id: 'fick-assumed-vo2',
  name: 'Fick with an assumed oxygen uptake',
  family: fickShared.family,
  vo2Provenance: 'assumed',
  measurand: fickShared.measurand,
  directlyObserved:
    'Two blood specimens drawn from named sites. Oxygen uptake is not observed at all in this method.',
  rawDataRepresentation: fickShared.rawDataRepresentation,
  inputs: fickInputs('assumed'),
  calculationAccount: [
    'A substituted oxygen-uptake figure stands in for a measurement that was not made.',
    ...fickShared.calculationAccount.slice(0, 3),
    'Oxygen uptake in milliliters per minute is divided by that difference, and the deciliters are converted to liters by a factor of ten, giving liters per minute — an estimate that inherits the substituted numerator in direct proportion.',
  ],
  acquisitionSequence: fickAcquisitionSequence('assumed'),
  qualityChecks: [
    ...fickShared.qualityChecks,
    {
      id: 'assumed-value-is-labeled',
      label: 'The substituted uptake is labeled wherever the result appears',
      whatToLookFor:
        'The reported flow names the method and says the oxygen uptake was assumed rather than measured.',
      whenItIsNotMet:
        'The number is quoted onward as though a measurement stood behind it, and the assumption disappears from the record.',
    },
    {
      id: 'substituted-value-population',
      label: 'Where the substituted figure came from',
      whatToLookFor:
        'The origin of the substituted figure, and the group of people it was derived from.',
      whenItIsNotMet:
        'A figure derived from one population is being applied to a patient who may sit far outside it, and the size of that mismatch is unknown.',
    },
  ],
  repeatabilityChecks: [
    ...fickShared.repeatabilityChecks,
    {
      id: 'repeat-shares-the-assumption',
      label: 'A repeat reuses the same assumption',
      whatToLookFor:
        'Whether the repeat substituted the same uptake figure. If it did, the two results share their largest uncertainty.',
      whenItIsNotMet:
        'Two estimates agreeing because they made the same assumption is not evidence that either is right.',
    },
  ],
  failureModes: [
    ...fickSharedFailureModes,
    {
      id: 'assumed-vo2-mismatch',
      label: 'The substituted uptake does not fit this patient',
      mechanism:
        'Oxygen consumption varies with fever, sedation, shivering, work of breathing, body habitus, and illness, none of which a substituted figure knows about.',
      effectOnResult:
        'The numerator is off by whatever the mismatch is, and the flow is off in direct proportion.',
      visibleInAcquisition: false,
    },
    {
      id: 'assumed-vo2-mislabeled',
      label: 'The estimate presented as a measurement',
      mechanism:
        'The result is quoted as Fick, or as direct Fick, without naming the substitution behind it.',
      effectOnResult:
        'A downstream reader treats an assumption as an observation, and there is nothing left in the record to correct that.',
      visibleInAcquisition: false,
    },
  ],
  repeatWhen: [
    'The specimens do not belong to one measurement episode.',
    'The oxygen-content difference is small enough that the estimate carries more uncertainty than the display suggests.',
    'Something about this patient makes the substituted uptake figure especially unlikely to fit.',
  ],
  withholdWhen: [
    'A required input is missing, or the two saturations are internally contradictory.',
    'The oxygen-content difference is at or below zero, so the simple form cannot be used.',
    'The venous specimen did not come from the pulmonary artery.',
    'The patient was not in a steady state, or the inputs do not belong to one measurement episode.',
    'An intracardiac shunt is present and has not been addressed with separate pulmonary and systemic sampling.',
    'The result would be reported without naming the substituted oxygen uptake.',
  ],
  alternateMethodRole: fickShared.alternateMethodRole,
  interpretationBoundary:
    'This is an estimate, not a measurement of flow. It says what flow would account for an assumed oxygen uptake, and it is only as good as that assumption. It should be reported as an estimate with the assumption named.',
  evidenceIds: ['esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
  sourceLimitations: [
    'The registered records are held as metadata; no source document text was available in this repository to verify a sentence-level claim against a locator.',
    'No registered record carries a claim about a published oxygen-uptake estimating equation or the population it was derived from, so this module names no equation. The substituted figure in each scenario is an authored simulation value, and the equation question is an open item for review.',
    'The hemoglobin oxygen-binding capacity and the dissolved-oxygen coefficient used here are labeled model constants, not values traced to a registered record.',
  ],
}

export const cardiacOutputMethods: readonly CardiacOutputMethod[] = Object.freeze([
  thermodilution,
  fickDirect,
  fickAssumedVo2,
])

export const cardiacOutputMethodById: ReadonlyMap<CardiacOutputMethodId, CardiacOutputMethod> =
  new Map(cardiacOutputMethods.map((method) => [method.id, method]))

export function requireCardiacOutputMethod(id: CardiacOutputMethodId): CardiacOutputMethod {
  const method = cardiacOutputMethodById.get(id)
  if (!method) throw new Error(`Unknown cardiac-output method: ${id}`)
  return method
}

/* ------------------------------------------------------------------ *
 * Text equivalent — the same record, read out in words
 * ------------------------------------------------------------------ */

/**
 * The complete text equivalent of a method card.
 *
 * Assembled from the same fields the visual surface renders, so a figure and its alternative cannot
 * describe different methods. The provenance of every input is spelled out in words rather than
 * carried by a colored chip.
 */
export function cardiacOutputMethodTextEquivalent(method: CardiacOutputMethod): string {
  const inputs = method.inputs
    .map(
      (input) =>
        `${input.label} — ${cardiacOutputInputStatusLabels[input.status].label.toLowerCase()}${
          input.unit ? `, in ${input.unit}` : ''
        }. ${input.whatItIs}`,
    )
    .join(' ')
  const vo2 =
    method.vo2Provenance === null
      ? ''
      : ` Oxygen uptake in this method was ${
          method.vo2Provenance === 'measured'
            ? 'measured on this patient'
            : 'assumed rather than measured'
        }.`
  return [
    `${method.name}.`,
    `What it estimates: ${method.measurand}`,
    `What is directly observed: ${method.directlyObserved}`,
    `Raw data: ${method.rawDataRepresentation}`,
    `Inputs and how each reached the calculation: ${inputs}`,
    `How the calculation runs: ${method.calculationAccount.join(' ')}`,
    `Repeat the acquisition when: ${method.repeatWhen.join(' ')}`,
    `Withhold the result when: ${method.withholdWhen.join(' ')}`,
    `Role of the other method: ${method.alternateMethodRole}`,
    `Interpretation boundary: ${method.interpretationBoundary}${vo2}`,
  ].join(' ')
}

/** Every learner-visible string a method record can put on screen. Used by the copy checks. */
export function cardiacOutputMethodCopy(method: CardiacOutputMethod): readonly string[] {
  return [
    method.name,
    method.measurand,
    method.directlyObserved,
    method.rawDataRepresentation,
    ...method.inputs.flatMap((input) => [input.label, input.whatItIs, input.howItGoesWrong]),
    ...method.calculationAccount,
    ...method.acquisitionSequence.flatMap((step) => [step.whatYouDo, step.whatItEstablishes]),
    ...[...method.qualityChecks, ...method.repeatabilityChecks].flatMap((check) => [
      check.label,
      check.whatToLookFor,
      check.whenItIsNotMet,
    ]),
    ...method.failureModes.flatMap((mode) => [mode.label, mode.mechanism, mode.effectOnResult]),
    ...method.repeatWhen,
    ...method.withholdWhen,
    method.alternateMethodRole,
    method.interpretationBoundary,
    ...method.sourceLimitations,
  ]
}

/* ------------------------------------------------------------------ *
 * Import-time validation
 * ------------------------------------------------------------------ */

const REQUIRED_STATUSES: readonly CardiacOutputInputStatus[] = ['calculated']

/**
 * The invariants that make the method model worth having, checked where they cannot be skipped.
 *
 * The direct-versus-assumed check is the one this module most needs: it is a naming rule enforced
 * against the structural field, so a record cannot be renamed into the wrong method.
 */
export function validateCardiacOutputMethods(
  methods: readonly CardiacOutputMethod[] = cardiacOutputMethods,
): void {
  const seen = new Set<string>()
  for (const method of methods) {
    if (seen.has(method.id)) throw new Error(`Duplicate cardiac-output method: ${method.id}`)
    seen.add(method.id)

    if (method.family === 'fick' && method.vo2Provenance === null) {
      throw new Error(
        `${method.id} is a Fick method and must declare its oxygen-uptake provenance.`,
      )
    }
    if (method.family !== 'fick' && method.vo2Provenance !== null) {
      throw new Error(
        `${method.id} is not a Fick method and must not declare an oxygen-uptake provenance.`,
      )
    }
    if (method.vo2Provenance === 'assumed' && /\bdirect\b/i.test(method.name)) {
      throw new Error(
        `${method.id} assumes its oxygen uptake and must not be named "direct Fick". An assumption is not a measurement.`,
      )
    }
    if (method.vo2Provenance === 'measured' && !/\bdirect\b/i.test(method.name)) {
      throw new Error(
        `${method.id} measures its oxygen uptake, so its learner-facing name must say so.`,
      )
    }

    const vo2Input = method.inputs.find((input) => input.id === 'vo2')
    if (method.vo2Provenance !== null) {
      if (!vo2Input) throw new Error(`${method.id} must carry an oxygen-uptake input.`)
      const expected = method.vo2Provenance === 'measured' ? 'measured' : 'assumed'
      if (vo2Input.status !== expected) {
        throw new Error(
          `${method.id} declares oxygen uptake ${method.vo2Provenance} but labels the input "${vo2Input.status}".`,
        )
      }
    }

    for (const field of [
      'measurand',
      'directlyObserved',
      'rawDataRepresentation',
      'alternateMethodRole',
      'interpretationBoundary',
    ] as const) {
      if (method[field].trim().length < 40) {
        throw new Error(`${method.id} is missing a usable ${field}.`)
      }
    }

    for (const field of [
      'inputs',
      'calculationAccount',
      'acquisitionSequence',
      'qualityChecks',
      'repeatabilityChecks',
      'failureModes',
      'repeatWhen',
      'withholdWhen',
      'evidenceIds',
      'sourceLimitations',
    ] as const) {
      if (method[field].length === 0) throw new Error(`${method.id} has an empty ${field}.`)
    }

    const statuses = new Set(method.inputs.map((input) => input.status))
    for (const required of REQUIRED_STATUSES) {
      if (!statuses.has(required)) {
        throw new Error(`${method.id} shows no ${required} value, which cannot be right.`)
      }
    }
    for (const input of method.inputs) {
      if (!cardiacOutputInputStatuses.includes(input.status)) {
        throw new Error(`${method.id} input ${input.id} carries an unknown provenance label.`)
      }
      if (input.whatItIs.trim().length < 20 || input.howItGoesWrong.trim().length < 20) {
        throw new Error(`${method.id} input ${input.id} is not fully described.`)
      }
    }

    const orders = method.acquisitionSequence.map((step) => step.order)
    if (orders.some((order, index) => order !== index + 1)) {
      throw new Error(`${method.id} has a gap or a repeat in its acquisition sequence.`)
    }

    for (const evidenceId of method.evidenceIds) {
      if (!hemodynamicsSourceById.has(evidenceId)) {
        throw new Error(`${method.id} cites unregistered evidence: ${evidenceId}`)
      }
    }

    /**
     * A method that quietly drops its major limitations is the failure this whole file exists to
     * prevent, so the two that make a cardiac-output number unusable are required by name.
     */
    const limits = [...method.withholdWhen, ...method.failureModes.map((mode) => mode.label)]
      .join(' ')
      .toLowerCase()
    if (!limits.includes('shunt')) {
      throw new Error(`${method.id} does not carry its intracardiac-shunt limitation.`)
    }
  }

  const fickMethods = methods.filter((method) => method.family === 'fick')
  const provenances = new Set(fickMethods.map((method) => method.vo2Provenance))
  if (fickMethods.length < 2 || provenances.size < 2) {
    throw new Error(
      'Measured-uptake and assumed-uptake Fick must stay two separate methods; collapsing them lets an assumption be described as a measurement.',
    )
  }
}

validateCardiacOutputMethods()
