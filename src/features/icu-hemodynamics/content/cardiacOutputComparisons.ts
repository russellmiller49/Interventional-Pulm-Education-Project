/**
 * Four measurement episodes in which thermodilution and a Fick calculation disagree.
 *
 * The exercise is not "which method is better". Every scenario here is decided on the acquisition
 * evidence in that specific episode, and one of them ends with neither result being defensible. A
 * universal ranking is refused on purpose: nothing in this module's registry carries a claim that
 * ranks the two, and `cardiacOutputOpenMethodQuestions` says so where a learner can read it.
 *
 * Every scenario carries an averaging option, and it is never the defensible one. Averaging two
 * estimates from two measurement systems produces a number that belongs to neither and hides which
 * acquisition was the problem.
 *
 * Thermodilution is specified rather than materialized: the specs below feed the same generator the
 * live lab uses, so an authored scenario and a learner-generated series are the same kind of object
 * and are judged by the same quality rules.
 */

import type { FickInputSet } from '../engine/fick'
import type { ThermodilutionTechnique } from '../engine/types'
import { requireCardiacOutputMethod } from './cardiacOutputMethods'
import { cardiacOutputOpenMethodQuestions } from './cardiacOutputSourceBoundaries'
import { hemodynamicsSourceById } from './sources'

export interface CardiacOutputTrialSpec {
  readonly sequence: number
  readonly technique: ThermodilutionTechnique
  /** How this acquisition went, in the learner's terms, before any number is shown. */
  readonly acquisitionNote: string
}

export interface CardiacOutputThermodilutionSide {
  readonly trueCardiacOutputLMin: number
  readonly seed: number
  readonly modifiers: {
    readonly tricuspidRegurgitationSeverity?: number
    readonly shuntFraction?: number
    readonly lowFlowFraction?: number
    readonly rhythmRegularity?: number
  }
  readonly trialSpecs: readonly CardiacOutputTrialSpec[]
  readonly acquisitionNarrative: string
  readonly positionConfirmed: boolean
}

export type CardiacOutputDecisionVerdict =
  | 'defensible'
  | 'not-defensible'
  | 'averages-unlike-methods'

export interface CardiacOutputDecisionOption {
  readonly id: string
  readonly label: string
  readonly verdict: CardiacOutputDecisionVerdict
  readonly why: string
}

export interface CardiacOutputComparisonScenario {
  readonly id: string
  readonly title: string
  readonly presentation: string
  readonly thermodilution: CardiacOutputThermodilutionSide
  readonly fick: FickInputSet
  readonly fickAcquisitionNarrative: string
  readonly options: readonly CardiacOutputDecisionOption[]
  readonly defensibleOptionId: string
  /**
   * The direction a bias would move the result, where the sources support naming one. `null` means
   * this module will not assert a direction — see `openQuestionIds`.
   */
  readonly biasDirection: string | null
  readonly openQuestionIds: readonly string[]
  readonly whatToRepeatOrCorrect: readonly string[]
  readonly whyNotAverage: string
  /** What a learner should carry forward, with the method attached. */
  readonly reportedResult: string
  readonly evidenceIds: readonly string[]
}

const standardTechnique: ThermodilutionTechnique = {
  injectateVolumeMl: 10,
  injectateTemperatureC: 5,
  injectionDurationSeconds: 2.5,
  respiratoryPhase: 'end-expiration',
  smoothness: 0.95,
}

const AVERAGING_WHY =
  'Averaging combines an indicator-dilution estimate with an oxygen-balance estimate. The two carry different assumptions and different failure modes, so their midpoint describes neither measurement system, and it hides which acquisition was the problem.'

export const cardiacOutputComparisonScenarios: readonly CardiacOutputComparisonScenario[] =
  Object.freeze([
    {
      id: 'co-cmp-td-acquisition-poor',
      title: 'The curves were rushed; the specimens were not',
      presentation:
        'An adult in the ICU after major surgery. A confirmed pulmonary-artery position, a leveled and zeroed pressure system, and a stable ventilator setting for the last twenty minutes. The series was acquired during a busy handover.',
      thermodilution: {
        trueCardiacOutputLMin: 5.6,
        seed: 4101,
        modifiers: { rhythmRegularity: 0.95 },
        positionConfirmed: true,
        trialSpecs: [
          {
            sequence: 1,
            technique: { ...standardTechnique, injectionDurationSeconds: 6.2, smoothness: 0.55 },
            acquisitionNote:
              'The bolus went in slowly and in two pushes while the operator answered a question.',
          },
          {
            sequence: 2,
            technique: {
              ...standardTechnique,
              respiratoryPhase: 'variable',
              injectionDurationSeconds: 1.9,
            },
            acquisitionNote:
              'Delivered quickly, at whatever point in the respiratory cycle the syringe was ready.',
          },
          {
            sequence: 3,
            technique: { ...standardTechnique, injectateVolumeMl: 5 },
            acquisitionNote:
              'Half the entered volume actually went in; the monitor was still set to the larger constant.',
          },
        ],
        acquisitionNarrative:
          'Three acquisitions, three different techniques. The entered computation constant stayed the same throughout, so at least one curve describes an injection that did not happen.',
      },
      fick: {
        methodId: 'fick-direct',
        vo2MlMin: 240,
        hemoglobinGDl: 11,
        arterialSaturationFraction: 0.98,
        mixedVenousSaturationFraction: 0.7,
        venousSampleSite: 'pulmonary-artery',
        arterialPo2MmHg: null,
        venousPo2MmHg: null,
        includeDissolvedOxygen: false,
        steadyState: true,
        samplesPairedInTime: true,
        intracardiacShuntPresent: false,
        shuntSamplingAddressed: false,
      },
      fickAcquisitionNarrative:
        'Oxygen uptake was measured by expired-gas analysis over the same interval the specimens were drawn in. The venous specimen came from the pulmonary artery, and the arterial specimen was drawn within a minute of it.',
      options: [
        {
          id: 'report-fick-repeat-thermodilution',
          label:
            'Report the Fick result with its method named, and repeat thermodilution with one standardized technique before using a series.',
          verdict: 'defensible',
          why: 'The Fick inputs belong to one episode and come from the sites the equation is written for. The thermodilution series does not describe one acquisition, so it has nothing to contribute until it is repeated.',
        },
        {
          id: 'average-the-two',
          label: 'Report the midpoint of the thermodilution series and the Fick result.',
          verdict: 'averages-unlike-methods',
          why: AVERAGING_WHY,
        },
        {
          id: 'trust-thermodilution-because-bedside',
          label:
            'Report the thermodilution series, because it was acquired at the bedside from the catheter already in place.',
          verdict: 'not-defensible',
          why: 'Where a measurement was made says nothing about whether the acquisition was usable. These three curves came from three different injections.',
        },
        {
          id: 'drop-the-outlier',
          label:
            'Drop whichever thermodilution trial is furthest from the Fick result and report the average of the other two.',
          verdict: 'not-defensible',
          why: 'That selects trials by which answer they give. Every one of these three has a technical problem, and choosing among them by their agreement with another method is not a technical reason.',
        },
      ],
      defensibleOptionId: 'report-fick-repeat-thermodilution',
      biasDirection:
        'A short-volume injection puts less indicator into the blood than the computation constant assumes, so that trial reports a higher flow than the patient has.',
      openQuestionIds: [],
      whatToRepeatOrCorrect: [
        'Set the entered volume and temperature to what will actually be delivered, and deliver exactly that.',
        'Use one point in the respiratory cycle for the whole series.',
        'Deliver each bolus smoothly and continuously, without pausing partway.',
      ],
      whyNotAverage: AVERAGING_WHY,
      reportedResult:
        'Cardiac output by direct Fick with measured oxygen uptake. Thermodilution withheld pending a standardized repeat series.',
      evidenceIds: ['pac-derived-part-2-2021', 'esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'co-cmp-fick-assumption-limited',
      title: 'A clean series, and an estimate that is mostly an assumption',
      presentation:
        'An adult with a fever of 39.4 degrees Celsius, visibly shivering, and agitated on minimal sedation. A confirmed pulmonary-artery position. Nobody measured oxygen uptake; the value in the calculation was substituted.',
      thermodilution: {
        trueCardiacOutputLMin: 7.2,
        seed: 4202,
        modifiers: { rhythmRegularity: 0.96 },
        positionConfirmed: true,
        trialSpecs: [
          {
            sequence: 1,
            technique: standardTechnique,
            acquisitionNote: 'Smooth, continuous bolus at the same point in the respiratory cycle.',
          },
          {
            sequence: 2,
            technique: standardTechnique,
            acquisitionNote: 'Same entered values, same delivery, same respiratory timing.',
          },
          {
            sequence: 3,
            technique: standardTechnique,
            acquisitionNote: 'Same again, deliberately rather than approximately.',
          },
        ],
        acquisitionNarrative:
          'Three acquisitions under one technique. The entered constants describe what was delivered, and every curve rose and decayed cleanly from a stable baseline.',
      },
      fick: {
        methodId: 'fick-assumed-vo2',
        vo2MlMin: 210,
        hemoglobinGDl: 10.5,
        arterialSaturationFraction: 0.97,
        mixedVenousSaturationFraction: 0.74,
        venousSampleSite: 'pulmonary-artery',
        arterialPo2MmHg: null,
        venousPo2MmHg: null,
        includeDissolvedOxygen: false,
        steadyState: true,
        samplesPairedInTime: true,
        intracardiacShuntPresent: false,
        shuntSamplingAddressed: false,
      },
      fickAcquisitionNarrative:
        'Both specimens were drawn together and the venous one came from the pulmonary artery, so the denominator is sound. The numerator was never measured on this patient — a substituted oxygen-uptake figure was used, and this patient is febrile, shivering, and agitated.',
      options: [
        {
          id: 'report-thermodilution-label-estimate',
          label:
            'Report the thermodilution series with its method named, and record the Fick number as an assumption-dependent estimate rather than as a second measurement.',
          verdict: 'defensible',
          why: 'The series was acquired under one technique from a confirmed position. The Fick number is proportional to a substituted uptake figure, and fever, shivering, and agitation are exactly the conditions that make a substituted figure unlikely to fit.',
        },
        {
          id: 'average-the-two',
          label: 'Report the midpoint of the thermodilution series and the Fick estimate.',
          verdict: 'averages-unlike-methods',
          why: AVERAGING_WHY,
        },
        {
          id: 'prefer-fick-as-reference',
          label:
            'Report the Fick number, because a Fick calculation is the more fundamental description of flow.',
          verdict: 'not-defensible',
          why: 'The principle being sound does not make this particular calculation sound. Its numerator was not measured, and no registered source in this module ranks the two methods.',
        },
        {
          id: 'call-it-direct-fick',
          label:
            'Report the Fick number as a direct Fick result, since both blood specimens were properly obtained.',
          verdict: 'not-defensible',
          why: 'Direct Fick means the oxygen uptake was measured. Good specimens do not make a substituted numerator into a measured one, and calling it direct removes the one caveat a later reader needs.',
        },
      ],
      defensibleOptionId: 'report-thermodilution-label-estimate',
      biasDirection:
        'A substituted uptake figure that is lower than this patient’s actual consumption makes the numerator too small, so the estimate comes out lower than the true flow. Fever, shivering, and agitation all raise consumption above what a substituted figure would assume.',
      openQuestionIds: [],
      whatToRepeatOrCorrect: [
        'Measure oxygen uptake if a Fick result is going to be used for anything.',
        'Until it is measured, report the number as an estimate and name the assumption alongside it.',
        'Keep trending with whichever method actually measured what it needed to.',
      ],
      whyNotAverage: AVERAGING_WHY,
      reportedResult:
        'Cardiac output by bolus thermodilution, from a series of three reviewed trials. A Fick estimate is on record with an assumed oxygen uptake and is not a second measurement.',
      evidenceIds: ['pac-derived-part-2-2021', 'esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'co-cmp-both-limited',
      title: 'Neither acquisition can carry the question',
      presentation:
        'An adult with severe tricuspid regurgitation on a rising norepinephrine infusion, changed twice in the last ten minutes. The venous specimen was drawn from the central line rather than the pulmonary-artery port.',
      thermodilution: {
        trueCardiacOutputLMin: 3.4,
        seed: 4303,
        modifiers: { tricuspidRegurgitationSeverity: 0.72, rhythmRegularity: 0.82 },
        positionConfirmed: true,
        trialSpecs: [
          {
            sequence: 1,
            technique: standardTechnique,
            acquisitionNote:
              'Standard delivery. The trace broadens and does not return toward baseline inside the recorded window.',
          },
          {
            sequence: 2,
            technique: standardTechnique,
            acquisitionNote: 'Same delivery, same broadened shape, same unfinished decay.',
          },
          {
            sequence: 3,
            technique: { ...standardTechnique, respiratoryPhase: 'variable' },
            acquisitionNote:
              'Delivered at a different point in the respiratory cycle while the infusion was being changed.',
          },
        ],
        acquisitionNarrative:
          'Two acquisitions under one technique and one that was not. All of them were made while the vasopressor dose was moving, and the regurgitant flow carries indicator back and forth across the valve, so none of the traces finishes inside the recording.',
      },
      fick: {
        methodId: 'fick-direct',
        vo2MlMin: 205,
        hemoglobinGDl: 9.4,
        arterialSaturationFraction: 0.95,
        mixedVenousSaturationFraction: 0.61,
        venousSampleSite: 'superior-vena-cava',
        arterialPo2MmHg: null,
        venousPo2MmHg: null,
        includeDissolvedOxygen: false,
        steadyState: false,
        samplesPairedInTime: true,
        intracardiacShuntPresent: false,
        shuntSamplingAddressed: false,
      },
      fickAcquisitionNarrative:
        'Oxygen uptake was measured, but the venous specimen came from the superior vena cava rather than the pulmonary artery, and the vasopressor dose changed twice while the inputs were being collected.',
      options: [
        {
          id: 'withhold-both-and-fix',
          label:
            'Withhold both results, say why each is unusable, and repeat once the infusion is steady and a pulmonary-artery specimen is available.',
          verdict: 'defensible',
          why: 'The Fick inputs describe a moving state and a specimen from a compartment the equation is not written for. Every thermodilution curve runs past the end of its recording, and one trial was not acquired with the series technique. Neither has a usable result to report.',
        },
        {
          id: 'average-the-two',
          label:
            'Report the midpoint of the two, since both are imperfect in different directions.',
          verdict: 'averages-unlike-methods',
          why: `${AVERAGING_WHY} Two unusable acquisitions do not become one usable one.`,
        },
        {
          id: 'use-thermodilution-anyway',
          label:
            'Report the thermodilution series, adjusted downward for the tricuspid regurgitation.',
          verdict: 'not-defensible',
          why: 'This module names no direction of bias for tricuspid regurgitation, because no registered record here carries one. An adjustment in an unknown direction is not a correction.',
        },
        {
          id: 'treat-central-venous-as-mixed',
          label:
            'Report the Fick result, treating the central venous specimen as equivalent to a mixed-venous one.',
          verdict: 'not-defensible',
          why: 'A specimen drawn before the venous streams combine describes one region of return rather than all of it. Nothing in this module’s reviewed set supports substituting one for the other here, and the state was not steady either.',
        },
      ],
      defensibleOptionId: 'withhold-both-and-fix',
      biasDirection: null,
      openQuestionIds: ['tricuspid-regurgitation-direction', 'low-flow-direction'],
      whatToRepeatOrCorrect: [
        'Wait for the vasopressor dose to hold still long enough for one state to be described.',
        'Draw the venous specimen from the pulmonary-artery port, and pair it in time with the arterial one.',
        'Reacquire the thermodilution series under one technique, and read every curve for whether it finishes inside the recording.',
        'If the curves still do not finish under clean technique, say so in the record rather than adjusting the number.',
      ],
      whyNotAverage: AVERAGING_WHY,
      reportedResult:
        'No cardiac-output result is reported. Both acquisitions are recorded as unusable, with the specific reason for each.',
      evidenceIds: ['pac-derived-part-2-2021', 'esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
    },
    {
      id: 'co-cmp-both-acceptable-still-apart',
      title: 'Two clean acquisitions that still do not agree',
      presentation:
        'An adult with chronic pulmonary vascular disease during a stable, quiet study. A confirmed pulmonary-artery position, one thermodilution technique throughout, and paired specimens with a measured oxygen uptake.',
      thermodilution: {
        trueCardiacOutputLMin: 4.1,
        seed: 4404,
        modifiers: { rhythmRegularity: 0.97 },
        positionConfirmed: true,
        trialSpecs: [
          {
            sequence: 1,
            technique: standardTechnique,
            acquisitionNote: 'Stable baseline, prompt onset, single smooth rise and decay.',
          },
          {
            sequence: 2,
            technique: standardTechnique,
            acquisitionNote: 'Identical acquisition; the trace overlays the first almost exactly.',
          },
          {
            sequence: 3,
            technique: standardTechnique,
            acquisitionNote: 'Identical again. Nothing in the series suggests a technical problem.',
          },
        ],
        acquisitionNarrative:
          'A tightly reproducible series under one deliberate technique. Reproducibility describes the spread of these three acquisitions; it does not describe where the three sit.',
      },
      fick: {
        methodId: 'fick-direct',
        // Chosen so both acquisitions produce a result and the two land far enough apart to change
        // a downstream resistance calculation. A gap inside rounding would make this scenario read
        // as agreement with noise, which is the opposite of what it is for.
        vo2MlMin: 172,
        hemoglobinGDl: 13.6,
        arterialSaturationFraction: 0.94,
        mixedVenousSaturationFraction: 0.66,
        venousSampleSite: 'pulmonary-artery',
        arterialPo2MmHg: 72,
        venousPo2MmHg: 35,
        includeDissolvedOxygen: true,
        steadyState: true,
        samplesPairedInTime: true,
        intracardiacShuntPresent: false,
        shuntSamplingAddressed: false,
      },
      fickAcquisitionNarrative:
        'Oxygen uptake was measured over the interval the specimens describe, both specimens were drawn from the sites the equation is written for, and the dissolved-oxygen term is applied to both contents.',
      options: [
        {
          id: 'report-both-with-methods',
          label:
            'Report both results with their methods named, state that the acquisitions were acceptable, and keep trending with one of them consistently.',
          verdict: 'defensible',
          why: 'Two different measurement systems can both be acquired well and still land apart. Nothing here identifies an acquisition to reject, so the honest record is both numbers with their methods, and one method carried forward for the trend.',
        },
        {
          id: 'average-the-two',
          label: 'Report the midpoint, since both acquisitions were acceptable.',
          verdict: 'averages-unlike-methods',
          why: `${AVERAGING_WHY} Acceptable acquisitions do not make the two estimates the same kind of quantity.`,
        },
        {
          id: 'pick-the-expected-one',
          label: 'Report whichever value fits the clinical impression better.',
          verdict: 'not-defensible',
          why: 'That selects by expectation. It also removes the disagreement from the record, which is the piece of information most worth keeping.',
        },
        {
          id: 'repeat-until-agreement',
          label:
            'Keep repeating the thermodilution series until it lands closer to the Fick value.',
          verdict: 'not-defensible',
          why: 'Repeating until a series matches another method is selection by agreement. The series is already reproducible under one technique; more acquisitions add no information about where it sits.',
        },
      ],
      defensibleOptionId: 'report-both-with-methods',
      biasDirection: null,
      openQuestionIds: ['method-hierarchy'],
      whatToRepeatOrCorrect: [
        'Nothing in either acquisition needs repeating on technical grounds.',
        'Record both results with their methods, so the disagreement stays visible to whoever reads them next.',
        'Choose one method for the trend and stay with it, because a change of method inside a trend looks like a change in the patient.',
      ],
      whyNotAverage: AVERAGING_WHY,
      reportedResult:
        'Bolus thermodilution and direct Fick are both reported, each with its method named, and the disagreement is recorded rather than resolved. One method is carried forward for the trend.',
      evidenceIds: ['pac-derived-part-2-2021', 'esc-ers-ph-2022', 'icu-hemodynamics-model-v1'],
    },
  ])

export const cardiacOutputComparisonById: ReadonlyMap<string, CardiacOutputComparisonScenario> =
  new Map(cardiacOutputComparisonScenarios.map((scenario) => [scenario.id, scenario]))

export function requireCardiacOutputComparison(id: string): CardiacOutputComparisonScenario {
  const scenario = cardiacOutputComparisonById.get(id)
  if (!scenario) throw new Error(`Unknown cardiac-output comparison scenario: ${id}`)
  return scenario
}

/** Every learner-visible string a scenario can put on screen. Used by the copy checks. */
export function cardiacOutputComparisonCopy(
  scenario: CardiacOutputComparisonScenario,
): readonly string[] {
  return [
    scenario.title,
    scenario.presentation,
    scenario.thermodilution.acquisitionNarrative,
    ...scenario.thermodilution.trialSpecs.map((spec) => spec.acquisitionNote),
    scenario.fickAcquisitionNarrative,
    ...scenario.options.flatMap((option) => [option.label, option.why]),
    scenario.biasDirection ?? '',
    ...scenario.whatToRepeatOrCorrect,
    scenario.whyNotAverage,
    scenario.reportedResult,
  ].filter((entry) => entry.length > 0)
}

export function validateCardiacOutputComparisons(
  scenarios: readonly CardiacOutputComparisonScenario[] = cardiacOutputComparisonScenarios,
): void {
  const openQuestionIds = new Set(cardiacOutputOpenMethodQuestions.map((question) => question.id))
  const seen = new Set<string>()
  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) throw new Error(`Duplicate comparison scenario: ${scenario.id}`)
    seen.add(scenario.id)

    // Both methods must resolve to a record, so a scenario cannot name a method that does not exist.
    requireCardiacOutputMethod('thermodilution')
    requireCardiacOutputMethod(scenario.fick.methodId)

    const defensible = scenario.options.filter((option) => option.verdict === 'defensible')
    if (defensible.length !== 1 || defensible[0].id !== scenario.defensibleOptionId) {
      throw new Error(`${scenario.id} must offer exactly one defensible position.`)
    }
    if (!scenario.options.some((option) => option.verdict === 'averages-unlike-methods')) {
      throw new Error(
        `${scenario.id} must offer an averaging position, so the learner has to decline it rather than never meeting it.`,
      )
    }
    if (
      scenario.options.some(
        (option) =>
          option.verdict === 'averages-unlike-methods' && option.id === scenario.defensibleOptionId,
      )
    ) {
      throw new Error(`${scenario.id} marks an averaging position as defensible.`)
    }
    if (scenario.thermodilution.trialSpecs.length === 0) {
      throw new Error(`${scenario.id} has no thermodilution acquisitions.`)
    }
    const orders = scenario.thermodilution.trialSpecs.map((spec) => spec.sequence)
    if (orders.some((order, index) => order !== index + 1)) {
      throw new Error(`${scenario.id} has a gap or a repeat in its thermodilution sequence.`)
    }
    for (const questionId of scenario.openQuestionIds) {
      if (!openQuestionIds.has(questionId)) {
        throw new Error(`${scenario.id} names an unknown open question: ${questionId}`)
      }
    }
    if (scenario.biasDirection === null && scenario.openQuestionIds.length === 0) {
      throw new Error(
        `${scenario.id} names no direction of bias and no open question, so a learner cannot tell whether the direction is unknown or simply unstated.`,
      )
    }
    for (const evidenceId of scenario.evidenceIds) {
      if (!hemodynamicsSourceById.has(evidenceId)) {
        throw new Error(`${scenario.id} cites unregistered evidence: ${evidenceId}`)
      }
    }
  }

  const fickMethods = new Set(scenarios.map((scenario) => scenario.fick.methodId))
  if (fickMethods.size < 2) {
    throw new Error(
      'The comparison set must include both a measured-uptake and an assumed-uptake Fick episode.',
    )
  }
  if (!scenarios.some((scenario) => scenario.defensibleOptionId.startsWith('withhold'))) {
    throw new Error('At least one comparison must end with both results withheld.')
  }
}

validateCardiacOutputComparisons()
