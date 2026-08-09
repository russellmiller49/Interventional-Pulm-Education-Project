import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import { CardiacOutputDisagreementLab } from '../components/CardiacOutputDisagreementLab'
import { CardiacOutputMethodModel } from '../components/CardiacOutputMethodModel'
import { FickMethodWorkbench } from '../components/FickMethodWorkbench'
import {
  PacGuidedSkillActivity,
  pacGuidedObjectiveComplete,
} from '../components/PacGuidedSkillActivity'
import { PacSkillsLab } from '../components/PacSkillsLab'
import { ThermodilutionTrialCard } from '../components/ThermodilutionTrialReview'
import {
  CARDIAC_OUTPUT_VERIFICATION_DEPTH,
  cardiacOutputAcquisitionParameters,
  cardiacOutputComparisonCopy,
  cardiacOutputComparisonScenarios,
  cardiacOutputInputStatuses,
  cardiacOutputMethodCopy,
  cardiacOutputMethods,
  cardiacOutputMethodTextEquivalent,
  cardiacOutputOpenMethodQuestions,
  cardiacOutputSourcesSupportingClaim,
  cardiacOutputSourceSupportsClaim,
  cardiacOutputUnsupportedClaimTopics,
  hemodynamicCaseById,
  hemodynamicsSourceById,
  pacLearningPathwaySections,
  requireCardiacOutputMethod,
  requireCardiacOutputParameter,
  validateCardiacOutputComparisons,
  validateCardiacOutputMethods,
  type CardiacOutputMethod,
  type PacLearningPathwaySectionId,
} from '../content'
import {
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_VERSION,
  canExcludeThermodilutionTrial,
  createInitialHemodynamicState,
  fickCardiacOutput,
  fickErrorAmplification,
  fickResultTextEquivalent,
  generateThermodilutionCurve,
  icuHemodynamicsReducer,
  oxygenContentMlDl,
  thermodilutionAcceptedAverage,
  thermodilutionCurveFeatures,
  thermodilutionCurveTextEquivalent,
  thermodilutionExclusionReasonsFor,
  thermodilutionSectionCompletion,
  thermodilutionSeriesSummary,
  CARDIAC_OUTPUT_MODEL_CONSTANTS,
  type FickInputSet,
  type HemodynamicSimulationState,
  type ThermodilutionTechnique,
  type ThermodilutionTrial,
} from '../engine'
import { ICU_HEMODYNAMICS_CONTENT_VERSION } from '../content/release'

/**
 * H4 — a cardiac-output number, traced back to the acquisition that produced it.
 *
 * The failure this package is built against is a learner who believes a result because a monitor
 * displayed it. Three specific forms of that failure are pinned here, at the level where they can
 * actually be reintroduced:
 *
 * - an assumption presented as a measurement (assumed oxygen uptake called direct Fick),
 * - an acceptance decision made without looking at the acquisition, and
 * - a disagreement resolved by splitting the difference.
 *
 * Everything else in the file is the machinery those three depend on: that the method model is one
 * record set, that exclusion needs a reason the curve shows, that units reconcile, and that none of
 * this moved the section's identity, routes, storage, or scoring.
 */

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}))

const STANDARD_TECHNIQUE: ThermodilutionTechnique = {
  injectateVolumeMl: 10,
  injectateTemperatureC: 5,
  injectionDurationSeconds: 2.5,
  respiratoryPhase: 'end-expiration',
  smoothness: 0.95,
}

const CONFIGURATION = {
  injectateVolumeMl: 10,
  injectateTemperatureC: 5,
  maximumTrials: 6,
  minimumAcceptedTrials: 3,
}

function trial(
  overrides: Partial<ThermodilutionTrial> = {},
  technique = STANDARD_TECHNIQUE,
  sequence = 1,
): ThermodilutionTrial {
  return {
    ...generateThermodilutionCurve({
      trueCardiacOutputLMin: 5,
      technique,
      configuration: CONFIGURATION,
      modifiers: { catheterPosition: 'pa' },
      seed: 991,
      sequence,
    }),
    ...overrides,
  }
}

/** Three clean, reviewed, accepted trials — the state the section's objective is defined over. */
function acceptedSeries(): readonly ThermodilutionTrial[] {
  return [1, 2, 3].map((sequence) =>
    trial({ accepted: true, reviewed: true }, STANDARD_TECHNIQUE, sequence),
  )
}

function thermodilutionState(): HemodynamicSimulationState {
  const definition = hemodynamicCaseById.get('HD-01')
  if (!definition) throw new Error('HD-01 is required for the cardiac-output station.')
  return icuHemodynamicsReducer(createInitialHemodynamicState(definition, 'learn', 4400), {
    type: 'SET_CATHETER_POSITION',
    position: 'pa',
  })
}

const MEASURED_FICK: FickInputSet = {
  methodId: 'fick-direct',
  vo2MlMin: 245,
  hemoglobinGDl: 12.4,
  arterialSaturationFraction: 0.97,
  mixedVenousSaturationFraction: 0.68,
  venousSampleSite: 'pulmonary-artery',
  arterialPo2MmHg: null,
  venousPo2MmHg: null,
  includeDissolvedOxygen: false,
  steadyState: true,
  samplesPairedInTime: true,
  intracardiacShuntPresent: false,
}

/** Every learner-visible string this package authored. */
function h4LearnerCopy(): readonly string[] {
  return [
    ...cardiacOutputMethods.flatMap(cardiacOutputMethodCopy),
    ...cardiacOutputComparisonScenarios.flatMap(cardiacOutputComparisonCopy),
    ...cardiacOutputAcquisitionParameters.flatMap((parameter) => [
      parameter.label,
      parameter.learnerFacingQualifier,
    ]),
    ...cardiacOutputOpenMethodQuestions.flatMap((question) => [
      question.question,
      question.whyItIsOpen,
      question.whatThisModuleDoes,
    ]),
  ].filter((entry) => entry.length > 0)
}

describe('H4 canonical cardiac-output method model', () => {
  it('keeps thermodilution, measured-uptake Fick, and assumed-uptake Fick as three separate methods', () => {
    expect(cardiacOutputMethods.map((method) => method.id)).toEqual([
      'thermodilution',
      'fick-direct',
      'fick-assumed-vo2',
    ])
    expect(requireCardiacOutputMethod('fick-direct').vo2Provenance).toBe('measured')
    expect(requireCardiacOutputMethod('fick-assumed-vo2').vo2Provenance).toBe('assumed')
    expect(requireCardiacOutputMethod('thermodilution').vo2Provenance).toBeNull()
  })

  it('refuses a record that assumes its oxygen uptake and calls itself direct Fick', () => {
    const assumed = requireCardiacOutputMethod('fick-assumed-vo2')
    expect(() =>
      validateCardiacOutputMethods([
        { ...assumed, name: 'Direct Fick' } as CardiacOutputMethod,
        requireCardiacOutputMethod('fick-direct'),
      ]),
    ).toThrow(/must not be named "direct Fick"/i)
  })

  it('refuses a record whose oxygen-uptake input contradicts its declared provenance', () => {
    const assumed = requireCardiacOutputMethod('fick-assumed-vo2')
    expect(() =>
      validateCardiacOutputMethods([
        {
          ...assumed,
          inputs: assumed.inputs.map((input) =>
            input.id === 'vo2' ? { ...input, status: 'measured' as const } : input,
          ),
        },
        requireCardiacOutputMethod('fick-direct'),
      ]),
    ).toThrow(/labels the input "measured"/i)
  })

  it('refuses a set in which the two Fick methods have collapsed into one', () => {
    expect(() =>
      validateCardiacOutputMethods([
        requireCardiacOutputMethod('thermodilution'),
        requireCardiacOutputMethod('fick-direct'),
      ]),
    ).toThrow(/two separate methods/i)
  })

  it('keeps every record complete, sourced, and carrying its major limitations', () => {
    validateCardiacOutputMethods()
    for (const method of cardiacOutputMethods) {
      expect(method.inputs.length).toBeGreaterThan(3)
      expect(method.withholdWhen.length).toBeGreaterThan(0)
      expect(method.failureModes.length).toBeGreaterThan(0)
      for (const evidenceId of method.evidenceIds) {
        expect(hemodynamicsSourceById.has(evidenceId)).toBe(true)
      }
      // The two limits that make a cardiac-output number unusable rather than merely uncertain.
      const limits = [
        ...method.withholdWhen,
        ...method.failureModes.map((mode) => mode.label),
      ].join(' ')
      expect(limits).toMatch(/shunt/i)
      for (const input of method.inputs) {
        expect(cardiacOutputInputStatuses).toContain(input.status)
      }
      // Every method shows at least one measured-or-sampled input and at least one calculated one,
      // so no method can present itself as producing flow without a calculation.
      const statuses = new Set(method.inputs.map((input) => input.status))
      expect(statuses.has('calculated')).toBe(true)
      expect(statuses.has('measured') || statuses.has('sampled')).toBe(true)
    }
  })

  it('derives the text equivalent from the same record the visual surface renders', () => {
    render(<CardiacOutputMethodModel />)
    for (const method of cardiacOutputMethods) {
      fireEvent.click(screen.getByRole('tab', { name: method.name }))
      const text = cardiacOutputMethodTextEquivalent(method)
      expect(text).toContain(method.measurand)
      expect(text).toContain(method.directlyObserved)
      expect(text).toContain(method.rawDataRepresentation)
      expect(text).toContain(method.interpretationBoundary)
      for (const input of method.inputs) expect(text).toContain(input.label)
      expect(screen.getByRole('heading', { level: 3, name: method.name })).toBeInTheDocument()
      expect(screen.getByText(method.measurand)).toBeInTheDocument()
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('says exactly how far the source audit went, and never more', () => {
    expect(CARDIAC_OUTPUT_VERIFICATION_DEPTH).toBe('claim-text-audited')
    expect(CARDIAC_OUTPUT_VERIFICATION_DEPTH).not.toBe('source-text-and-locator-verified')
  })

  it('shows no number for a parameter no registered claim supports', () => {
    const unsupported = cardiacOutputAcquisitionParameters.filter(
      (parameter) => parameter.provenance === 'unsupported',
    )
    expect(unsupported.length).toBeGreaterThan(0)
    for (const parameter of unsupported) expect(parameter.valueShown).toBeNull()

    // The four widely taught numbers this module declines to assert.
    expect(requireCardiacOutputParameter('numeric-repeatability-criterion').valueShown).toBeNull()
    expect(requireCardiacOutputParameter('oxygen-uptake-estimating-equation').valueShown).toBeNull()
    expect(requireCardiacOutputParameter('respiratory-phase-requirement').valueShown).toBeNull()
    expect(requireCardiacOutputParameter('minimum-accepted-trials').provenance).toBe(
      'simulation-parameter',
    )
    expect(cardiacOutputUnsupportedClaimTopics()).toEqual(
      expect.arrayContaining([
        'numeric-repeatability-criterion',
        'oxygen-uptake-estimating-equation',
        'oxygen-content-constants',
        'method-performance-in-tricuspid-regurgitation',
        'method-performance-in-low-flow',
      ]),
    )
  })

  it('separates a citation that resolves from a citation that supports the claim', () => {
    expect(hemodynamicsSourceById.has('pac-derived-part-2-2021')).toBe(true)
    expect(
      cardiacOutputSourceSupportsClaim('pac-derived-part-2-2021', 'thermodilution-measurement'),
    ).toBe(true)
    // The same record resolves, and its claim says nothing about an agreement criterion.
    expect(
      cardiacOutputSourceSupportsClaim(
        'pac-derived-part-2-2021',
        'numeric-repeatability-criterion',
      ),
    ).toBe(false)
    expect(cardiacOutputSourcesSupportingClaim('numeric-repeatability-criterion')).toEqual([])
  })

  it('keeps every learner-facing sentence free of grading language and universal targets', () => {
    for (const entry of h4LearnerCopy()) {
      expect(flaggedLearnerCopyTerms(entry)).toEqual([])
      assertNoUniversalTargetLanguage(entry)
    }
  })
})

describe('H4 thermodilution acquisition, quality, and repeatability', () => {
  it('hides the derived value until the raw curve has been reviewed', () => {
    const unreviewed = trial()
    const { rerender } = render(
      <ThermodilutionTrialCard
        trial={unreviewed}
        onReview={jest.fn()}
        onAccept={jest.fn()}
        onExclude={jest.fn()}
      />,
    )
    expect(screen.getByText(/derived value stays hidden until the raw curve/i)).toBeInTheDocument()
    expect(
      screen.queryByText(`${unreviewed.estimatedCardiacOutputLMin.toFixed(1)} L/min`),
    ).not.toBeInTheDocument()
    // The curve, its named parts, and the acceptance state are all readable before the number is.
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      thermodilutionCurveTextEquivalent(unreviewed),
    )
    expect(screen.getByText('Baseline')).toBeInTheDocument()
    expect(screen.getByText('Not yet reviewed')).toBeInTheDocument()

    rerender(
      <ThermodilutionTrialCard
        trial={{ ...unreviewed, reviewed: true }}
        onReview={jest.fn()}
        onAccept={jest.fn()}
        onExclude={jest.fn()}
      />,
    )
    expect(
      screen.getByText(`${unreviewed.estimatedCardiacOutputLMin.toFixed(1)} L/min`),
    ).toBeInTheDocument()
  })

  it('refuses to accept a trial whose curve was never reviewed', () => {
    let state = thermodilutionState()
    state = icuHemodynamicsReducer(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: STANDARD_TECHNIQUE,
    })
    const generated = state.thermodilutionTrials[0]
    expect(generated.reviewed).toBe(false)

    const refused = icuHemodynamicsReducer(state, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: generated.id,
      accepted: true,
    })
    expect(refused.thermodilutionTrials[0].accepted).toBeNull()
    expect(refused.responseMessage).toMatch(/review the trial .* curve before accepting/i)

    const reviewed = icuHemodynamicsReducer(state, {
      type: 'REVIEW_THERMODILUTION_CURVE',
      trialId: generated.id,
    })
    const accepted = icuHemodynamicsReducer(reviewed, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: generated.id,
      accepted: true,
    })
    expect(accepted.thermodilutionTrials[0].accepted).toBe(true)
  })

  it('keeps rejected and invalid trials out of the accepted series', () => {
    const clean = acceptedSeries()
    const invalid = trial(
      { accepted: true, reviewed: true },
      { ...STANDARD_TECHNIQUE, injectionDurationSeconds: 7, smoothness: 0.3 },
      4,
    )
    expect(invalid.quality).not.toBe('valid')
    expect(thermodilutionAcceptedAverage([...clean, invalid])).toBe(
      thermodilutionAcceptedAverage(clean),
    )

    const withExcluded = [
      ...clean,
      trial({ accepted: false, reviewed: true }, STANDARD_TECHNIQUE, 5),
    ]
    const summary = thermodilutionSeriesSummary(withExcluded)
    expect(summary.acceptedTrialIds).toHaveLength(3)
    expect(summary.excludedTrialIds).toHaveLength(1)
    expect(summary.averageLMin).toBe(thermodilutionAcceptedAverage(clean))
  })

  it('averages exactly the accepted trial set and nothing else', () => {
    const clean = acceptedSeries()
    const expected =
      Math.round(
        (clean.reduce((total, item) => total + item.estimatedCardiacOutputLMin, 0) / clean.length) *
          10,
      ) / 10
    expect(thermodilutionAcceptedAverage(clean)).toBe(expected)
    // Adding an unreviewed trial with an accepted flag must not move the value.
    expect(
      thermodilutionAcceptedAverage([
        ...clean,
        trial({ accepted: true, reviewed: false }, STANDARD_TECHNIQUE, 6),
      ]),
    ).toBe(expected)
  })

  it('refuses to exclude a trial without a technical reason that trial actually shows', () => {
    const clean = trial({ reviewed: true })
    expect(thermodilutionExclusionReasonsFor(clean)).toEqual([])
    expect(canExcludeThermodilutionTrial(clean, undefined)).toBe(false)
    expect(canExcludeThermodilutionTrial(clean, 'respiratory-phase-inconsistent')).toBe(false)

    const variable = trial(
      { reviewed: true },
      { ...STANDARD_TECHNIQUE, respiratoryPhase: 'variable' },
      2,
    )
    expect(canExcludeThermodilutionTrial(variable, 'respiratory-phase-inconsistent')).toBe(true)
    // A reason the curve does not show is still refused, even on a trial that has other problems.
    expect(canExcludeThermodilutionTrial(variable, 'catheter-position-not-confirmed')).toBe(false)
  })

  it('will not let a disagreeing but technically clean trial be dropped from a series', () => {
    let state = thermodilutionState()
    for (let index = 0; index < 3; index += 1) {
      state = icuHemodynamicsReducer(state, {
        type: 'GENERATE_THERMODILUTION_TRIAL',
        technique: STANDARD_TECHNIQUE,
      })
    }
    const target = state.thermodilutionTrials[2]
    state = icuHemodynamicsReducer(state, {
      type: 'REVIEW_THERMODILUTION_CURVE',
      trialId: target.id,
    })
    const refused = icuHemodynamicsReducer(state, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: target.id,
      accepted: false,
      exclusionReasonId: 'baseline-not-stable',
    })
    expect(refused.thermodilutionTrials[2].accepted).toBeNull()
    expect(refused.responseMessage).toMatch(
      /no technical reason|requires naming a technical reason/i,
    )
    expect(refused.responseMessage).toMatch(/disagreeing|technical reason/i)
  })

  it('never describes repeatability as proof of accuracy', () => {
    const method = requireCardiacOutputMethod('thermodilution')
    const repeatability = method.repeatabilityChecks
      .map((check) => `${check.label} ${check.whatToLookFor} ${check.whenItIsNotMet}`)
      .join(' ')
    expect(repeatability).toMatch(/agreement is not accuracy/i)
    expect(repeatability).toMatch(/says nothing about where the series sits/i)
    // A systematically shifted but reproducible series is represented as its own failure mode.
    expect(method.failureModes.map((mode) => mode.id)).toContain('repeatable-but-biased-series')

    render(
      <PacSkillsLab state={thermodilutionState()} dispatch={jest.fn()} focus="thermodilution" />,
    )
    const readout = screen.getByRole('heading', { name: 'Accepted series' }).closest('section')
    expect(readout).not.toBeNull()
    expect(readout as HTMLElement).toHaveTextContent(/does not describe where they sit/i)
    expect(readout as HTMLElement).toHaveTextContent(
      /does not apply a numeric agreement criterion/i,
    )
  })

  it('shows no numeric acquisition or agreement rule that a registered claim does not support', () => {
    render(
      <PacSkillsLab state={thermodilutionState()} dispatch={jest.fn()} focus="thermodilution" />,
    )
    const panel = screen.getByRole('region', { name: /thermodilution measurement lab/i })
    // The injectate constants appear, and they appear as this scenario's configuration.
    expect(panel).toHaveTextContent(/configured computation constant/i)
    expect(panel).toHaveTextContent(
      requireCardiacOutputParameter('injectate-volume').learnerFacingQualifier,
    )
    // No percentage agreement criterion anywhere on the acquisition surface.
    expect(panel.textContent ?? '').not.toMatch(/within\s*\d+\s*(percent|%)/i)
  })

  it('represents the acquisition problems it teaches, and only where the engine can show them', () => {
    const cases: readonly [string, ThermodilutionTrial][] = [
      [
        'inadequate-or-variable-indicator-delivery',
        trial({ reviewed: true }, { ...STANDARD_TECHNIQUE, injectionDurationSeconds: 6.5 }, 2),
      ],
      [
        'respiratory-phase-inconsistent',
        trial({ reviewed: true }, { ...STANDARD_TECHNIQUE, respiratoryPhase: 'variable' }, 3),
      ],
      [
        'delivery-did-not-match-entered-values',
        trial({ reviewed: true }, { ...STANDARD_TECHNIQUE, injectateVolumeMl: 5 }, 4),
      ],
    ]
    for (const [reasonId, candidate] of cases) {
      expect(thermodilutionExclusionReasonsFor(candidate).map((reason) => reason.id)).toContain(
        reasonId,
      )
    }

    /**
     * What significant tricuspid regurgitation does in this model is broaden the curve past the end
     * of its recording — not add a visible second excursion. The exclusion reason and the teaching
     * copy both say that, rather than describing a disturbance the trace does not show.
     */
    const regurgitant = generateThermodilutionCurve({
      trueCardiacOutputLMin: 3.4,
      technique: STANDARD_TECHNIQUE,
      configuration: CONFIGURATION,
      modifiers: { catheterPosition: 'pa', tricuspidRegurgitationSeverity: 0.72 },
      seed: 4303,
      sequence: 1,
    })
    const regurgitantFeatures = thermodilutionCurveFeatures(regurgitant)
    expect(regurgitantFeatures.decayToTenthSeconds).toBeNull()
    expect(regurgitantFeatures.secondaryDisturbance).toBe(false)
    expect(thermodilutionExclusionReasonsFor(regurgitant).map((reason) => reason.id)).toContain(
      'curve-does-not-settle',
    )
    // A clean curve finishes inside the recording, so the same reason does not apply to it.
    expect(thermodilutionCurveFeatures(trial()).decayToTenthSeconds).not.toBeNull()
    expect(canExcludeThermodilutionTrial(trial({ reviewed: true }), 'curve-does-not-settle')).toBe(
      false,
    )

    const trMode = requireCardiacOutputMethod('thermodilution').failureModes.find(
      (mode) => mode.id === 'tricuspid-regurgitation',
    )
    expect(trMode?.effectOnResult).toMatch(/does not assert a direction/i)
    expect(trMode?.effectOnResult).toMatch(/outside the recording/i)
  })

  /**
   * The copy contract for tricuspid regurgitation.
   *
   * Every learner-facing sentence about what this model's regurgitant curve *shows* has to agree
   * with the derived curve features. The open-question record used to say "a broadened curve with a
   * secondary disturbance" while the trace has none, and that sentence is rendered on the method
   * panel and beside the both-limited comparison — so a learner was sent looking for a feature that
   * is not there.
   */
  describe('tricuspid-regurgitation copy agrees with the modeled curve', () => {
    const REGURGITANT = generateThermodilutionCurve({
      trueCardiacOutputLMin: 3.4,
      technique: STANDARD_TECHNIQUE,
      configuration: CONFIGURATION,
      modifiers: { catheterPosition: 'pa', tricuspidRegurgitationSeverity: 0.72 },
      seed: 4303,
      sequence: 1,
    })

    it('produces a broadened, unsettled curve with no secondary excursion', () => {
      const features = thermodilutionCurveFeatures(REGURGITANT)
      expect(features.secondaryDisturbance).toBe(false)
      expect(features.secondaryDisturbanceTimeSeconds).toBeNull()
      expect(features.decayToTenthSeconds).toBeNull()
      // The text equivalent reports the absence rather than staying silent about it.
      expect(thermodilutionCurveTextEquivalent(REGURGITANT)).toMatch(
        /No secondary disturbance appears after the trace settles/i,
      )
      expect(thermodilutionCurveTextEquivalent(REGURGITANT)).toMatch(
        /does not return to within a tenth of its peak excursion/i,
      )
    })

    it('describes it in the open question as broadened and unsettled', () => {
      const question = cardiacOutputOpenMethodQuestions.find(
        (candidate) => candidate.id === 'tricuspid-regurgitation-direction',
      )
      expect(question).toBeDefined()
      expect(question!.whatThisModuleDoes).toMatch(/broadened curve/i)
      expect(question!.whatThisModuleDoes).toMatch(
        /may not return toward baseline inside the recorded window/i,
      )
      expect(question!.whatThisModuleDoes).toMatch(/states no direction of bias/i)
    })

    it('never says a modeled regurgitant curve shows a secondary disturbance', () => {
      const trSpecificCopy = [
        cardiacOutputOpenMethodQuestions.find(
          (candidate) => candidate.id === 'tricuspid-regurgitation-direction',
        )!.whatThisModuleDoes,
        ...(() => {
          const mode = requireCardiacOutputMethod('thermodilution').failureModes.find(
            (candidate) => candidate.id === 'tricuspid-regurgitation',
          )!
          return [mode.label, mode.effectOnResult]
        })(),
        // Whatever the model actually raises as an alert on a regurgitant acquisition.
        ...REGURGITANT.alerts.filter((alert) => /regurgitation/i.test(alert)),
      ]
      expect(trSpecificCopy.length).toBeGreaterThan(3)
      for (const sentence of trSpecificCopy) {
        expect(sentence).not.toMatch(/secondary disturbance/i)
        expect(sentence).not.toMatch(/second excursion/i)
        expect(sentence).not.toMatch(/recirculation disturbance/i)
      }
      // The alert the learner reads describes the broadening this model produces.
      expect(REGURGITANT.alerts.join(' ')).toMatch(
        /broadens the curve.*may not return toward baseline/i,
      )
    })

    it('renders the corrected open-question copy on the method panel', () => {
      render(<CardiacOutputMethodModel />)
      const question = cardiacOutputOpenMethodQuestions.find(
        (candidate) => candidate.id === 'tricuspid-regurgitation-direction',
      )!
      const card = screen.getByText(question.question).closest('p') as HTMLElement
      expect(card).toHaveTextContent(/may not return toward baseline inside the recorded window/i)
      expect(card).not.toHaveTextContent(/secondary disturbance/i)
    })

    it('keeps the generic secondary-disturbance category available for a curve that shows one', () => {
      // The concept is not TR-specific and must survive: a trace that genuinely rebounds after
      // decaying is still excludable under it.
      const rebounding: ThermodilutionTrial = {
        ...REGURGITANT,
        reviewed: true,
        curve: [
          ...Array.from({ length: 5 }, (_, index) => ({
            timeSeconds: index * 0.05,
            temperatureChangeC: 0,
          })),
          { timeSeconds: 0.3, temperatureChangeC: -1 },
          { timeSeconds: 0.6, temperatureChangeC: -0.5 },
          { timeSeconds: 0.9, temperatureChangeC: -0.05 },
          { timeSeconds: 1.2, temperatureChangeC: -0.4 },
          { timeSeconds: 1.5, temperatureChangeC: -0.05 },
        ],
      }
      const features = thermodilutionCurveFeatures(rebounding)
      expect(features.secondaryDisturbance).toBe(true)
      expect(thermodilutionExclusionReasonsFor(rebounding).map((reason) => reason.id)).toContain(
        'secondary-curve-disturbance',
      )
      expect(canExcludeThermodilutionTrial(rebounding, 'secondary-curve-disturbance')).toBe(true)

      // And the generic quality check and repeat rule keep the concept in the method record.
      const method = requireCardiacOutputMethod('thermodilution')
      expect(method.qualityChecks.map((check) => check.id)).toContain('secondary-disturbance')
      expect(method.repeatWhen.join(' ')).toMatch(/second excursion/i)
    })
  })
})

describe('H4 Fick input tracing', () => {
  it('labels a measured and an assumed oxygen uptake differently, and never calls the assumed one direct', () => {
    const measured = fickCardiacOutput(MEASURED_FICK)
    const assumed = fickCardiacOutput({ ...MEASURED_FICK, methodId: 'fick-assumed-vo2' })

    expect(measured.vo2Provenance).toBe('measured')
    expect(assumed.vo2Provenance).toBe('assumed')
    expect(assumed.methodName).not.toMatch(/\bdirect\b/i)
    expect(measured.trace.find((row) => row.id === 'vo2')?.status).toBe('measured')
    expect(assumed.trace.find((row) => row.id === 'vo2')?.status).toBe('assumed')
    expect(assumed.trace.find((row) => row.id === 'vo2')?.display).toMatch(
      /assumed; not measured on this patient/i,
    )
    expect(assumed.caveats.join(' ')).toMatch(/assumed rather than measured/i)
  })

  it('keeps the arterial and true mixed-venous inputs identifiable, with their site and timing', () => {
    const result = fickCardiacOutput(MEASURED_FICK)
    const ids = result.trace.map((row) => row.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'arterial-saturation',
        'mixed-venous-saturation',
        'venous-sample-site',
        'sample-timing',
        'steady-state',
        'arterial-content',
        'mixed-venous-content',
        'content-difference',
      ]),
    )
    expect(result.trace.find((row) => row.id === 'venous-sample-site')?.display).toMatch(
      /pulmonary artery.*true mixed-venous specimen/i,
    )
    expect(result.trace.find((row) => row.id === 'arterial-saturation')?.status).toBe('sampled')
  })

  it('reconciles units through the division and shows the content difference explicitly', () => {
    const result = fickCardiacOutput(MEASURED_FICK)

    /**
     * Written out rather than recomputed from the module's own constants. A unit-conversion
     * regression changes both sides of a derived expectation and passes; it cannot change a number
     * that was worked out by hand.
     *
     * 1.34 mL/g × 12.4 g/dL × 0.97 = 16.12 mL/dL arterial
     * 1.34 mL/g × 12.4 g/dL × 0.68 = 11.30 mL/dL mixed-venous
     * difference 4.82 mL/dL; 245 mL/min ÷ (4.82 mL/dL × 10 dL/L) = 5.08 L/min
     */
    expect(oxygenContentMlDl({ hemoglobinGDl: 12.4, saturationFraction: 0.97 })).toBeCloseTo(
      16.12,
      2,
    )
    expect(result.arterialOxygenContentMlDl).toBeCloseTo(16.12, 2)
    expect(result.mixedVenousOxygenContentMlDl).toBeCloseTo(11.3, 2)
    expect(result.contentDifferenceMlDl).toBeCloseTo(4.82, 2)
    expect(result.cardiacOutputLMin).toBeCloseTo(5.08, 2)
    expect(CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter).toBe(10)

    // The displayed account has to carry the same conversion the arithmetic used.
    const account = result.unitAccount.join(' ')
    expect(account).toContain('× 10 dL per L')
    expect(account).toMatch(/deciliters convert to liters, leaving liters per minute/i)
    expect(account).toContain('4.82 mL/dL')
    expect(account).toContain('5.08 L/min')
    expect(result.trace.find((row) => row.id === 'content-difference')?.display).toMatch(
      /this is the denominator/i,
    )
  })

  it('never produces a result without its method attached', () => {
    for (const methodId of ['fick-direct', 'fick-assumed-vo2'] as const) {
      const method = requireCardiacOutputMethod(methodId)
      const calculated = fickCardiacOutput({ ...MEASURED_FICK, methodId })
      expect(calculated.methodName).toBe(method.name)
      expect(calculated.methodName.trim().length).toBeGreaterThan(0)
      expect(calculated.trace.find((row) => row.id === 'fick-cardiac-output')?.display).toContain(
        method.name.toLowerCase(),
      )
      expect(fickResultTextEquivalent(calculated)).toContain(method.name)

      // A withheld result still names the method it withheld.
      const withheld = fickCardiacOutput({
        ...MEASURED_FICK,
        methodId,
        venousSampleSite: 'superior-vena-cava',
      })
      expect(withheld.methodName).toBe(method.name)
      expect(fickResultTextEquivalent(withheld)).toContain(method.name)
    }

    render(<FickMethodWorkbench />)
    for (const label of [
      'by direct fick with measured oxygen uptake',
      'by fick with an assumed oxygen uptake',
    ]) {
      expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0)
    }
  })

  it('amplifies the same absolute input error as the content difference narrows', () => {
    const wide = fickErrorAmplification(MEASURED_FICK, 0.03)
    const narrow = fickErrorAmplification(
      { ...MEASURED_FICK, mixedVenousSaturationFraction: 0.85 },
      0.03,
    )
    expect(wide).not.toBeNull()
    expect(narrow).not.toBeNull()
    expect(narrow!.contentDifferenceMlDl).toBeLessThan(wide!.contentDifferenceMlDl)
    // Same absolute saturation error on both sides; larger proportional move on the narrow one.
    expect(narrow!.saturationErrorFraction).toBe(wide!.saturationErrorFraction)
    expect(Math.abs(narrow!.relativeOutputChange)).toBeGreaterThan(
      Math.abs(wide!.relativeOutputChange),
    )
  })

  it('withholds a mathematically complete but clinically incoherent input set', () => {
    const contradictory = fickCardiacOutput({
      ...MEASURED_FICK,
      mixedVenousSaturationFraction: 0.99,
    })
    expect(contradictory.status).toBe('withheld')
    expect(contradictory.cardiacOutputLMin).toBeNull()
    expect(contradictory.withheldReasons.join(' ')).toMatch(/at or above the arterial content/i)

    const missing = fickCardiacOutput({ ...MEASURED_FICK, hemoglobinGDl: null })
    expect(missing.status).toBe('withheld')
    expect(missing.withheldReasons.join(' ')).toMatch(/hemoglobin/i)

    const unpaired = fickCardiacOutput({ ...MEASURED_FICK, samplesPairedInTime: false })
    expect(unpaired.status).toBe('withheld')
    const unsteady = fickCardiacOutput({ ...MEASURED_FICK, steadyState: false })
    expect(unsteady.status).toBe('withheld')
  })

  it('does not treat a central venous specimen as a mixed-venous one', () => {
    const central = fickCardiacOutput({ ...MEASURED_FICK, venousSampleSite: 'superior-vena-cava' })
    expect(central.status).toBe('withheld')
    expect(central.withheldReasons.join(' ')).toMatch(/not a true mixed-venous specimen/i)
  })

  /**
   * The simple form fails closed for any shunt, and nothing in the input set can talk it round.
   *
   * A `shuntSamplingAddressed` flag used to sit beside `intracardiacShuntPresent`, and setting it
   * produced an ordinary result — from one arterial content and one pulmonary-artery content, which
   * is a single systemic difference. The flag was removed rather than defaulted, so there is no
   * boolean left that could wave an under-specified shunt calculation through.
   */
  it('withholds the simple one-difference calculation for any intracardiac shunt', () => {
    for (const methodId of ['fick-direct', 'fick-assumed-vo2'] as const) {
      const shunted = fickCardiacOutput({
        ...MEASURED_FICK,
        methodId,
        intracardiacShuntPresent: true,
      })
      expect(shunted.status).toBe('withheld')
      expect(shunted.cardiacOutputLMin).toBeNull()

      // The reason names the boundary: what is missing is the compartmental Qp/Qs model, not a
      // sampling step this implementation could have taken.
      const reason = shunted.withheldReasons.join(' ')
      expect(reason).toMatch(/intracardiac shunt is present/i)
      expect(reason).toMatch(/simple one-difference Fick calculation/i)
      expect(reason).toMatch(/separate pulmonary and systemic flow/i)
      expect(reason).toMatch(/Qp\/Qs/)
      expect(reason).toMatch(/outside this model/i)
      expect(fickResultTextEquivalent(shunted)).toMatch(/Qp\/Qs/)
    }
  })

  it('has no boolean that lets an under-specified shunt calculation produce a result', () => {
    // Every extra key the input set could carry is enumerated here, so a re-added bypass flag has
    // to be added to this list before it can pass — and adding it fails the assertion below.
    const withEveryOtherInputMadeIdeal = {
      ...MEASURED_FICK,
      intracardiacShuntPresent: true,
      steadyState: true,
      samplesPairedInTime: true,
      venousSampleSite: 'pulmonary-artery' as const,
      includeDissolvedOxygen: true,
      arterialPo2MmHg: 92,
      venousPo2MmHg: 40,
    }
    expect(fickCardiacOutput(withEveryOtherInputMadeIdeal).status).toBe('withheld')

    // A stray property cannot switch the behavior either: nothing outside the declared input set is
    // consulted.
    const withStrayFlag = {
      ...withEveryOtherInputMadeIdeal,
      shuntSamplingAddressed: true,
    } as unknown as FickInputSet
    expect(fickCardiacOutput(withStrayFlag).status).toBe('withheld')

    expect(Object.keys(MEASURED_FICK)).not.toContain('shuntSamplingAddressed')
  })

  it('leaves non-shunt direct Fick behaviour unchanged', () => {
    const clean = fickCardiacOutput(MEASURED_FICK)
    expect(clean.status).toBe('calculated')
    expect(clean.cardiacOutputLMin).toBeCloseTo(5.08, 2)
    expect(clean.withheldReasons).toEqual([])
    expect(clean.trace.map((row) => row.id)).toContain('content-difference')
  })

  it('does not imply that a Fick approach is unusable in every shunt, only this calculation', () => {
    const boundary = [
      ...requireCardiacOutputMethod('fick-direct').withholdWhen,
      ...requireCardiacOutputMethod('fick-assumed-vo2').withholdWhen,
      fickCardiacOutput({ ...MEASURED_FICK, intracardiacShuntPresent: true }).withheldReasons.join(
        ' ',
      ),
    ].join(' ')
    // The claim is about this implementation and the model's scope.
    expect(boundary).toMatch(/this simple one-difference calculation|simple one-difference Fick/i)
    expect(boundary).toMatch(/outside this model/i)
    // Not a claim that the Fick principle itself fails in shunts.
    expect(boundary).not.toMatch(/fick (?:is|becomes) (?:invalid|unusable|impossible)/i)
    expect(boundary).not.toMatch(/never use fick/i)
  })

  it('applies the dissolved-oxygen term to both contents or to neither', () => {
    const both = fickCardiacOutput({
      ...MEASURED_FICK,
      includeDissolvedOxygen: true,
      arterialPo2MmHg: 90,
      venousPo2MmHg: 38,
    })
    expect(both.trace.find((row) => row.id === 'dissolved-oxygen')?.display).toMatch(
      /included in both contents/i,
    )

    const onlyOne = fickCardiacOutput({
      ...MEASURED_FICK,
      includeDissolvedOxygen: true,
      arterialPo2MmHg: 90,
      venousPo2MmHg: null,
    })
    expect(onlyOne.trace.find((row) => row.id === 'dissolved-oxygen')?.display).toBe('Not included')
    expect(onlyOne.caveats.join(' ')).toMatch(/applied to neither/i)
  })

  it('renders the workbench with both provenance labels and the withheld episodes visible', () => {
    render(<FickMethodWorkbench />)
    expect(
      screen.getByRole('heading', { name: 'Fick: trace every input before you use the number' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Result withheld').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('Assumed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Measured').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/not a true mixed-venous specimen/i).length).toBeGreaterThan(0)
  })
})

describe('H4 method disagreement', () => {
  it('offers four episodes covering the four acquisition combinations, and never averages them', () => {
    validateCardiacOutputComparisons()
    expect(cardiacOutputComparisonScenarios).toHaveLength(4)

    for (const scenario of cardiacOutputComparisonScenarios) {
      const averaging = scenario.options.filter(
        (option) => option.verdict === 'averages-unlike-methods',
      )
      expect(averaging.length).toBeGreaterThan(0)
      for (const option of averaging) expect(option.id).not.toBe(scenario.defensibleOptionId)
      expect(scenario.whyNotAverage).toMatch(/midpoint describes neither/i)
      // The reported result always names its method, or says nothing is reported.
      expect(scenario.reportedResult).toMatch(
        /thermodilution|direct fick|assumed oxygen uptake|no cardiac-output result is reported/i,
      )
    }

    const defensibleIds = cardiacOutputComparisonScenarios.map(
      (scenario) => scenario.defensibleOptionId,
    )
    // Fick preferred once, thermodilution preferred once, both withheld once, both kept once.
    expect(defensibleIds).toEqual([
      'report-fick-repeat-thermodilution',
      'report-thermodilution-label-estimate',
      'withhold-both-and-fix',
      'report-both-with-methods',
    ])
  })

  it('declares no universal ranking, and preserves the questions the sources do not settle', () => {
    const copy = cardiacOutputComparisonScenarios.flatMap(cardiacOutputComparisonCopy).join(' ')
    expect(copy).not.toMatch(/fick is (always|the) gold standard/i)
    expect(copy).not.toMatch(/thermodilution is always (preferred|better)/i)

    const hierarchy = cardiacOutputOpenMethodQuestions.find(
      (question) => question.id === 'method-hierarchy',
    )
    expect(hierarchy?.whatThisModuleDoes).toMatch(/refuses a universal ranking/i)

    // Where a direction of bias is not supported, the scenario says so and names the open question.
    const unnamed = cardiacOutputComparisonScenarios.filter(
      (scenario) => scenario.biasDirection === null,
    )
    expect(unnamed.length).toBeGreaterThan(0)
    for (const scenario of unnamed) expect(scenario.openQuestionIds.length).toBeGreaterThan(0)
  })

  it('shows both acquisitions before the decision, and reveals the reasoning only after commitment', () => {
    render(<CardiacOutputDisagreementLab />)
    const scenario = cardiacOutputComparisonScenarios[0]
    const card = screen
      .getByRole('heading', { level: 3, name: scenario.title })
      .closest('article') as HTMLElement

    // Both method names and both acquisitions are on screen before anything is chosen.
    expect(
      within(card).getByRole('region', { name: `Thermodilution acquisition — ${scenario.title}` }),
    ).toBeInTheDocument()
    expect(
      within(card).getByRole('region', { name: `Fick acquisition — ${scenario.title}` }),
    ).toBeInTheDocument()
    expect(within(card).getByText(scenario.thermodilution.acquisitionNarrative)).toBeInTheDocument()
    expect(within(card).getByText(scenario.fickAcquisitionNarrative)).toBeInTheDocument()

    const defensible = scenario.options.find((option) => option.id === scenario.defensibleOptionId)!
    expect(within(card).queryByText(new RegExp(defensible.why.slice(0, 40), 'i'))).toBeNull()
    expect(within(card).queryByText(new RegExp(scenario.whyNotAverage.slice(0, 40)))).toBeNull()

    fireEvent.click(within(card).getByRole('radio', { name: defensible.label }))
    fireEvent.click(within(card).getByRole('button', { name: 'Commit this position' }))
    expect(within(card).getByText(/Defensible for this episode/i)).toBeInTheDocument()
    expect(
      within(card).getByText(new RegExp(scenario.whyNotAverage.slice(0, 40))),
    ).toBeInTheDocument()
    expect(within(card).getByText(scenario.reportedResult)).toBeInTheDocument()
  })

  it('names an averaging choice as averaging rather than as a defensible position', () => {
    render(<CardiacOutputDisagreementLab />)
    const scenario = cardiacOutputComparisonScenarios[3]
    const card = screen
      .getByRole('heading', { level: 3, name: scenario.title })
      .closest('article') as HTMLElement
    const averaging = scenario.options.find(
      (option) => option.verdict === 'averages-unlike-methods',
    )!

    fireEvent.click(within(card).getByRole('radio', { name: averaging.label }))
    fireEvent.click(within(card).getByRole('button', { name: 'Commit this position' }))
    expect(within(card).getByText(/This averages two unlike methods/i)).toBeInTheDocument()
    expect(within(card).queryByText(/Defensible for this episode/i)).toBeNull()
  })

  it('lets both results be withheld when both acquisitions are inadequate', () => {
    const bothLimited = cardiacOutputComparisonScenarios.find(
      (scenario) => scenario.id === 'co-cmp-both-limited',
    )!
    expect(bothLimited.defensibleOptionId).toBe('withhold-both-and-fix')
    expect(fickCardiacOutput(bothLimited.fick).status).toBe('withheld')
    expect(bothLimited.reportedResult).toMatch(/no cardiac-output result is reported/i)
    // Every thermodilution curve in this episode runs past the end of its recording, so the series
    // has nothing to contribute either.
    for (const spec of bothLimited.thermodilution.trialSpecs) {
      const authored = generateThermodilutionCurve({
        trueCardiacOutputLMin: bothLimited.thermodilution.trueCardiacOutputLMin,
        technique: spec.technique,
        configuration: CONFIGURATION,
        modifiers: { ...bothLimited.thermodilution.modifiers, catheterPosition: 'pa' },
        seed: bothLimited.thermodilution.seed,
        sequence: spec.sequence,
      })
      expect(thermodilutionExclusionReasonsFor(authored).length).toBeGreaterThan(0)
    }
  })

  it('keeps the both-acceptable episode a real disagreement rather than a rounding difference', () => {
    const scenario = cardiacOutputComparisonScenarios.find(
      (candidate) => candidate.id === 'co-cmp-both-acceptable-still-apart',
    )!
    const fick = fickCardiacOutput(scenario.fick)
    expect(fick.status).toBe('calculated')

    const trials = scenario.thermodilution.trialSpecs.map((spec) => ({
      ...generateThermodilutionCurve({
        trueCardiacOutputLMin: scenario.thermodilution.trueCardiacOutputLMin,
        technique: spec.technique,
        configuration: CONFIGURATION,
        modifiers: { ...scenario.thermodilution.modifiers, catheterPosition: 'pa' },
        seed: scenario.thermodilution.seed,
        sequence: spec.sequence,
      }),
      accepted: true as const,
      reviewed: true,
    }))
    // Nothing in this series gives a technical reason to leave a trial out.
    for (const item of trials) expect(thermodilutionExclusionReasonsFor(item)).toEqual([])

    const summary = thermodilutionSeriesSummary(trials)
    expect(summary.averageLMin).not.toBeNull()
    const gap = Math.abs((summary.averageLMin as number) - (fick.cardiacOutputLMin as number))
    // Far enough apart to change a downstream resistance calculation, so the scenario cannot be
    // read as agreement with noise.
    expect(gap / (fick.cardiacOutputLMin as number)).toBeGreaterThan(0.15)
  })
})

describe('H4 completion and non-regression', () => {
  it('needs all four of the section’s commitments, not just an accepted series', () => {
    const series = acceptedSeries()
    expect(
      thermodilutionSectionCompletion({
        trials: series,
        methodProvenanceResolved: false,
        disagreementResolvedWithoutAveraging: true,
      }).complete,
    ).toBe(false)
    expect(
      thermodilutionSectionCompletion({
        trials: series,
        methodProvenanceResolved: true,
        disagreementResolvedWithoutAveraging: false,
      }).complete,
    ).toBe(false)
    expect(
      thermodilutionSectionCompletion({
        trials: series,
        methodProvenanceResolved: true,
        disagreementResolvedWithoutAveraging: true,
      }).complete,
    ).toBe(true)
  })

  it('cannot be completed by an unreviewed, invalid, or unreasoned trial set', () => {
    const unreviewed = acceptedSeries().map((item, index) =>
      index === 0 ? { ...item, reviewed: false } : item,
    )
    const completion = thermodilutionSectionCompletion({
      trials: unreviewed,
      methodProvenanceResolved: true,
      disagreementResolvedWithoutAveraging: true,
    })
    expect(completion.everyAcceptedTrialWasReviewed).toBe(false)
    expect(completion.complete).toBe(false)

    const invalid = [1, 2, 3].map((sequence) =>
      trial(
        { accepted: true, reviewed: true },
        { ...STANDARD_TECHNIQUE, injectionDurationSeconds: 7, smoothness: 0.3 },
        sequence,
      ),
    )
    expect(
      thermodilutionSectionCompletion({
        trials: invalid,
        methodProvenanceResolved: true,
        disagreementResolvedWithoutAveraging: true,
      }).acceptedSeriesEstablished,
    ).toBe(false)

    const unreasoned = [
      ...acceptedSeries(),
      trial({ accepted: false, reviewed: true, exclusionReasonId: null }, STANDARD_TECHNIQUE, 4),
    ]
    expect(
      thermodilutionSectionCompletion({
        trials: unreasoned,
        methodProvenanceResolved: true,
        disagreementResolvedWithoutAveraging: true,
      }).everyExclusionHasATechnicalReason,
    ).toBe(false)
  })

  it('keeps the hands-on objective a function of the reviewed accepted series', () => {
    const base = thermodilutionState()
    expect(
      pacGuidedObjectiveComplete('thermodilution-series', {
        ...base,
        thermodilutionTrials: acceptedSeries(),
      }),
    ).toBe(true)
    expect(
      pacGuidedObjectiveComplete('thermodilution-series', {
        ...base,
        thermodilutionTrials: acceptedSeries().map((item) => ({ ...item, reviewed: false })),
      }),
    ).toBe(false)
  })

  it('leaves the pathway, the section identity, and the route unchanged', () => {
    const expected: readonly PacLearningPathwaySectionId[] = [
      'pressure-system',
      'waveform-interpretation',
      'catheter-advancement',
      'pawp-capture',
      'thermodilution-series',
      'derived-hemodynamics',
      'pac-signal-validation',
    ]
    expect(pacLearningPathwaySections.map((section) => section.id)).toEqual(expected)

    const activity = criticalCareActivityById.get('hemodynamics:learn:thermodilution-series')
    expect(activity).toBeDefined()
    expect(activity?.pathname).toBe('/icu-hemodynamics/learn')
    expect(activity?.query).toEqual({ activity: 'thermodilution-series' })
    expect(activity?.completionRuleId).toBe('hemodynamics:completion:learn-existing')
    expect(activity?.competencyIds).toEqual(['signal-validation', 'hemodynamic-reassessment'])
    expect(activity?.estimatedMinutes).toBe(18)
    expect(activity?.prerequisiteActivityIds).toEqual(['hemodynamics:learn:pawp-capture'])
    expect(activity?.curriculumStage).toBe('mechanism')
    expect(activity?.stageOrder).toBe(3)
    // Scoring and mastery are section-level, and this station carries no mastery rule of its own.
    expect(activity?.masteryRuleId).toBeUndefined()
    expect(activity?.completionEvidenceAuthority).toBe(
      criticalCareActivityById.get('hemodynamics:learn:derived-hemodynamics')
        ?.completionEvidenceAuthority,
    )
  })

  it('leaves storage keys, progress versions, and the content version unchanged', () => {
    expect(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY).toBe('icu-hemodynamics-progress-v2')
    expect(ICU_HEMODYNAMICS_PROGRESS_VERSION).toBe(2)
    expect(ICU_HEMODYNAMICS_CONTENT_VERSION).toBe('1.0.0-preview.1')
  })

  it('keeps H2/H3 wedge safety and advancement behavior out of this package’s reach', () => {
    const definition = hemodynamicCaseById.get('HD-01')!
    const state = createInitialHemodynamicState(definition, 'learn', 77)
    // The PAWP objective still refuses a forced recovery, and still needs the learner's own
    // assessment that the PA waveform returned.
    expect(
      pacGuidedObjectiveComplete('pawp-capture', {
        ...state,
        catheter: {
          ...state.catheter,
          position: 'pa',
          storedWedgeMmHg: 11,
          balloonInflated: false,
          forcedSafetyRecovery: true,
        },
        signalValidationChecks: ['pawp-pa-waveform-returned'],
      }),
    ).toBe(false)
    expect(
      pacGuidedObjectiveComplete('catheter-advancement', {
        ...state,
        catheter: { ...state.catheter, position: 'pa' },
        signalValidationChecks: ['waveform-confirmed-ra', 'waveform-confirmed-rv'],
      }),
    ).toBe(false)
  })

  it('does not pull derived-hemodynamic content into the cardiac-output station', () => {
    render(<PacGuidedSkillActivity skillId="thermodilution-series" />)
    expect(
      screen.queryByRole('heading', {
        name: 'Derived hemodynamics are equations, not new measurements',
      }),
    ).toBeNull()
    expect(screen.queryByText(/SVR = 80/)).toBeNull()
    expect(screen.queryByText(/PVR = \(mPAP/)).toBeNull()
  })
})
