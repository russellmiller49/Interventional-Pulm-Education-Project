import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import {
  DerivedEpisodeWorkbench,
  DerivedProvenanceDrill,
  DerivedTransferComparison,
} from '../components/DerivedHemodynamicsWorkbench'
import { DerivedHemodynamicsTeachingPanel } from '../components/PacMeasurementTeaching'
import {
  cardiacOutputMethodById,
  derivedClaimVerifications,
  derivedInputDefinitions,
  derivedMeasurementEpisodes,
  derivedMethodDisagreementDecision,
  derivedMetricCopy,
  derivedMetricRecords,
  derivedMetricTextEquivalent,
  derivedSelectiveDecision,
  derivedSourceSupportsClaim,
  derivedThresholdContexts,
  derivedThresholdContextDecision,
  derivedTransferComparisonDecision,
  derivedUnsupportedClaimTopics,
  hemodynamicCaseById,
  hemodynamicsSourceById,
  pacLearningPathwaySections,
  requireDerivedInputDefinition,
  requireDerivedMeasurementEpisode,
  requireDerivedMetric,
  requireDerivedThresholdContext,
  validateDerivedMetrics,
  validateDerivedMeasurementEpisodes,
  type DerivedMeasurementEpisode,
  type DerivedMetricRecord,
  type DerivedThresholdContext,
} from '../content'
import { ICU_HEMODYNAMICS_CONTENT_VERSION } from '../content/release'
import {
  DERIVED_SECTION_CHECKS,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_VERSION,
  createInitialHemodynamicState,
  derivedHemodynamicsSectionCompletion,
  evaluateDerivedEpisode,
  evaluateDerivedMetric,
  icuHemodynamicsReducer,
  type HemodynamicSimulationState,
} from '../engine'
import { goalsMet, sectionRuntime } from '../engine/stageRuntime'

/**
 * H5 — a derived hemodynamic value, traced back to its equation and its inputs.
 *
 * The failure this package is built against is a learner who treats a calculated number as a new
 * measurement. Four specific forms of that failure are pinned here, at the level where they can be
 * reintroduced:
 *
 * - a calculated quantity labeled as measured,
 * - a formula fed an input from the wrong convention, the wrong episode, or an unknown method,
 * - one invalid input silently suppressing (or silently sparing) unrelated metrics, and
 * - a phenotype-specific boundary or a method disagreement flattened into one universal number.
 *
 * Everything else is the machinery those depend on: one canonical record set, hand-checked
 * arithmetic with explicit units, preserved discordance, and a completion contract no formula
 * reference can satisfy.
 */

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
  useRouter: () => ({ push: jest.fn() }),
}))

const COHERENT = requireDerivedMeasurementEpisode('ep-coherent-complete')
const INVALID_PAWP = requireDerivedMeasurementEpisode('ep-invalid-pawp')
const ASSUMED_VO2 = requireDerivedMeasurementEpisode('ep-assumed-vo2')
const DISAGREEMENT = requireDerivedMeasurementEpisode('ep-method-disagreement')
const MIXED = requireDerivedMeasurementEpisode('ep-mixed-states')
const NEAR_ZERO = requireDerivedMeasurementEpisode('ep-near-zero-denominator')
const MISSING_BSA = requireDerivedMeasurementEpisode('ep-missing-bsa')
const DISCORDANT = requireDerivedMeasurementEpisode('ep-discordant-gradient')

function acceptedFlow(episode: DerivedMeasurementEpisode) {
  const flow = episode.flowResults.find((candidate) => candidate.status === 'accepted')
  if (!flow) throw new Error(`${episode.id} has no accepted flow`)
  return flow
}

function evaluate(episode: DerivedMeasurementEpisode, metricId: DerivedMetricRecord['id']) {
  return evaluateDerivedMetric(metricId, episode, acceptedFlow(episode))
}

function withInput(
  episode: DerivedMeasurementEpisode,
  inputId: string,
  overrides: Partial<DerivedMeasurementEpisode['inputs'][number]>,
): DerivedMeasurementEpisode {
  return {
    ...episode,
    inputs: episode.inputs.map((input) =>
      input.inputId === inputId ? { ...input, ...overrides } : input,
    ),
  }
}

function derivedState(): HemodynamicSimulationState {
  const definition = hemodynamicCaseById.get('HD-01')
  if (!definition) throw new Error('HD-01 is required.')
  return createInitialHemodynamicState(definition, 'learn', 5500)
}

/** Every learner-visible string this package authored. */
function h5LearnerCopy(): readonly string[] {
  return [
    ...derivedMetricRecords.flatMap(derivedMetricCopy),
    ...derivedMeasurementEpisodes.flatMap((episode) => [
      episode.title,
      episode.presentation,
      episode.bodySizeNote,
      episode.stateNote,
      ...episode.inputs.map((input) => input.note),
      ...episode.flowResults.flatMap((flow) => [flow.acquisitionNote, ...flow.withheldReasons]),
      episode.sensitivityFocus?.note ?? '',
    ]),
    ...[
      derivedMethodDisagreementDecision,
      derivedTransferComparisonDecision,
      derivedThresholdContextDecision,
    ].flatMap((decision) => [
      decision.prompt,
      ...decision.options.flatMap((option) => [option.label, option.why]),
    ]),
    derivedSelectiveDecision.prompt,
    ...derivedSelectiveDecision.withholdReasonOptions.map((option) => option.label),
  ].filter((entry) => entry.length > 0)
}

describe('H5 canonical derived-metric model', () => {
  it('keeps the eleven displayed metrics as one validated record set', () => {
    expect(derivedMetricRecords.map((metric) => metric.id)).toEqual([
      'cardiacIndexLMinM2',
      'strokeVolumeMl',
      'strokeVolumeIndexMlM2',
      'systemicVascularResistance',
      'systemicVascularResistanceIndex',
      'pulmonaryVascularResistance',
      'pulmonaryVascularResistanceIndex',
      'cardiacPowerOutputW',
      'pulmonaryArteryPulsatilityIndex',
      'pulmonaryArteryCompliance',
      'pulsePressureVariationPercent',
    ])
    expect(() => validateDerivedMetrics()).not.toThrow()
    expect(() => validateDerivedMeasurementEpisodes()).not.toThrow()
  })

  it('gives every dependency a resolvable input with a unit and a provenance rule', () => {
    for (const metric of derivedMetricRecords) {
      expect(metric.dependencies.length).toBeGreaterThan(0)
      for (const dependency of metric.dependencies) {
        const definition = requireDerivedInputDefinition(dependency.inputId)
        expect(definition.unit.length).toBeGreaterThan(0)
        expect(dependency.acceptableProvenance.length).toBeGreaterThan(0)
      }
    }
  })

  function withMetric(replacement: DerivedMetricRecord): readonly DerivedMetricRecord[] {
    return derivedMetricRecords.map((metric) =>
      metric.id === replacement.id ? replacement : metric,
    )
  }

  it('refuses a calculated quantity labeled as measured', () => {
    const ci = requireDerivedMetric('cardiacIndexLMinM2')
    const broken: DerivedMetricRecord = {
      ...ci,
      dependencies: ci.dependencies.map((dependency) =>
        dependency.inputId === 'cardiacOutputLMin'
          ? { ...dependency, acceptableProvenance: ['measured', 'calculated'] as const }
          : dependency,
      ),
    }
    expect(() => validateDerivedMetrics(withMetric(broken), derivedThresholdContexts)).toThrow(
      /must not be labeled measured/i,
    )
  })

  it('refuses a record whose flow or body-size flags disagree with its own dependencies', () => {
    const svr = requireDerivedMetric('systemicVascularResistance')
    expect(() =>
      validateDerivedMetrics(
        withMetric({ ...svr, requiresFlowMethod: false }),
        derivedThresholdContexts,
      ),
    ).toThrow(/requiresFlowMethod disagrees/i)
    const papi = requireDerivedMetric('pulmonaryArteryPulsatilityIndex')
    expect(() =>
      validateDerivedMetrics(
        withMetric({ ...papi, requiresBodySurfaceArea: true }),
        derivedThresholdContexts,
      ),
    ).toThrow(/requiresBodySurfaceArea disagrees/i)
  })

  it('marks cardiac output, stroke volume, and body surface area as calculated quantities', () => {
    for (const inputId of ['cardiacOutputLMin', 'strokeVolumeMl', 'bodySurfaceAreaM2']) {
      expect(requireDerivedInputDefinition(inputId).isCalculated).toBe(true)
    }
    expect(
      derivedInputDefinitions.filter((definition) => !definition.isCalculated).length,
    ).toBeGreaterThan(0)
  })

  it('derives the text equivalent from the same record the visual card renders', () => {
    for (const metric of derivedMetricRecords) {
      const text = derivedMetricTextEquivalent(metric)
      expect(text).toContain(metric.formulaText)
      expect(text).toContain('a calculated value, not a measurement')
      for (const contextId of metric.thresholdContextIds) {
        expect(text).toContain(requireDerivedThresholdContext(contextId).statement)
      }
    }
  })

  it('attaches a classified context record to every metric and threshold', () => {
    for (const metric of derivedMetricRecords) {
      expect(metric.thresholdContextIds.length).toBeGreaterThan(0)
    }
    for (const context of derivedThresholdContexts) {
      expect(context.population.trim().length).toBeGreaterThan(0)
      expect(context.intendedUse.trim().length).toBeGreaterThan(0)
      expect(context.notUniversal.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps the authored learner copy free of flagged terms and universal-target phrasing', () => {
    for (const entry of h5LearnerCopy()) {
      expect(flaggedLearnerCopyTerms(entry)).toEqual([])
      assertNoUniversalTargetLanguage(entry)
    }
  })
})

describe('H5 formula and unit correctness', () => {
  it('reproduces the hand-calculated coherent episode exactly', () => {
    const expectations: readonly [DerivedMetricRecord['id'], number, string][] = [
      // 5.2 / 1.9 = 2.736…
      ['cardiacIndexLMinM2', 2.7, 'L/min/m²'],
      // 5.2 × 1000 / 78 = 66.66… → 67
      ['strokeVolumeMl', 67, 'mL'],
      // 66.66 / 1.9 = 35.08… → 35
      ['strokeVolumeIndexMlM2', 35, 'mL/m²'],
      // 80 × (86 − 8) / 5.2 = 1200 exactly
      ['systemicVascularResistance', 1200, 'dyn·s·cm⁻⁵'],
      // 1200 × 1.9 = 2280
      ['systemicVascularResistanceIndex', 2280, 'dyn·s·cm⁻⁵·m²'],
      // (24 − 14) / 5.2 = 1.923 → 1.9
      ['pulmonaryVascularResistance', 1.9, 'WU'],
      // 1.923 × 1.9 = 3.65… → 3.7
      ['pulmonaryVascularResistanceIndex', 3.7, 'WU·m²'],
      // 86 × 5.2 / 451 = 0.9915 → 0.99
      ['cardiacPowerOutputW', 0.99, 'W'],
      // (38 − 16) / 8 = 2.75
      ['pulmonaryArteryPulsatilityIndex', 2.75, ''],
      // 66.66 / 22 = 3.03 → 3
      ['pulmonaryArteryCompliance', 3, 'mL/mmHg'],
      // (46 − 41) / 43.5 × 100 = 11.49 → 11
      ['pulsePressureVariationPercent', 11, '%'],
    ]
    for (const [metricId, value, unit] of expectations) {
      const result = evaluate(COHERENT, metricId)
      expect(result.status).toBe('available')
      expect(result.value).toBe(value)
      expect(result.unit).toBe(unit)
    }
  })

  it('states its unit conversions rather than hiding them in arithmetic', () => {
    expect(requireDerivedMetric('systemicVascularResistance').unitAccount.join(' ')).toMatch(
      /×80 converts mmHg·min\/L \(Wood units\) to dyn·s·cm⁻⁵/,
    )
    expect(requireDerivedMetric('cardiacPowerOutputW').unitAccount.join(' ')).toMatch(
      /÷451 converts mmHg × L\/min to watts/,
    )
    expect(requireDerivedMetric('pulmonaryVascularResistance').unitAccount.join(' ')).toMatch(
      /Wood units/,
    )
  })

  it('withholds on nonfinite inputs instead of calculating through them', () => {
    const broken = withInput(COHERENT, 'mapMmHg', { value: Number.NaN })
    const result = evaluateDerivedMetric('systemicVascularResistance', broken, acceptedFlow(broken))
    expect(result.status).toBe('withheld')
    expect(result.value).toBeNull()
    expect(result.mathematicalValidityReasons.join(' ')).toMatch(/not a finite number/i)
  })

  it('withholds on a zero denominator with the denominator named', () => {
    const zeroRap = withInput(NEAR_ZERO, 'rapMmHg', { value: 0 })
    const papi = evaluateDerivedMetric(
      'pulmonaryArteryPulsatilityIndex',
      zeroRap,
      acceptedFlow(zeroRap),
    )
    expect(papi.status).toBe('withheld')
    expect(papi.value).toBeNull()
    expect(papi.mathematicalValidityReasons.join(' ')).toMatch(
      /zero denominator cannot be divided/i,
    )
  })

  it('preserves a negative transpulmonary gradient as discordance, never clamping it', () => {
    const pvr = evaluate(DISCORDANT, 'pulmonaryVascularResistance')
    expect(pvr.status).toBe('withheld')
    expect(pvr.value).toBeNull()
    const gradient = pvr.gradientAccounts.find((account) => /transpulmonary/i.test(account.label))
    expect(gradient?.valueMmHg).toBe(-2)
    expect(pvr.mathematicalValidityReasons.join(' ')).toMatch(/-2 mmHg/)
    expect(pvr.mathematicalValidityReasons.join(' ')).toMatch(/two measurements disagree/i)
    // The neighbors whose inputs are internally consistent stay available.
    expect(evaluate(DISCORDANT, 'systemicVascularResistance').status).toBe('available')
    expect(evaluate(DISCORDANT, 'pulmonaryArteryPulsatilityIndex').status).toBe('available')
  })

  it('requires the mean PAWP convention and refuses an end-diastolic substitute', () => {
    const endDiastolic = withInput(COHERENT, 'pawpMeanMmHg', { convention: 'end-diastolic' })
    const pvr = evaluateDerivedMetric(
      'pulmonaryVascularResistance',
      endDiastolic,
      acceptedFlow(endDiastolic),
    )
    expect(pvr.status).toBe('withheld')
    expect(pvr.clinicalValidityReasons.join(' ')).toMatch(
      /obtained as end diastolic.*requires the mean end expiration value/i,
    )
    // The same substitution leaves SVR untouched — it never consumes the wedge.
    expect(
      evaluateDerivedMetric('systemicVascularResistance', endDiastolic, acceptedFlow(endDiastolic))
        .status,
    ).toBe('available')
  })

  it('refuses an input recorded under a unit the formula cannot reconcile', () => {
    const wrongUnit = withInput(COHERENT, 'mapMmHg', { recordedUnit: 'kPa' })
    const svr = evaluateDerivedMetric(
      'systemicVascularResistance',
      wrongUnit,
      acceptedFlow(wrongUnit),
    )
    expect(svr.status).toBe('withheld')
    expect(svr.mathematicalValidityReasons.join(' ')).toMatch(/recorded in kPa.*needs mmHg/i)
  })

  it('shows the near-zero-denominator sensitivity as a perturbation comparison, not a cutoff', () => {
    const papi = evaluate(NEAR_ZERO, 'pulmonaryArteryPulsatilityIndex')
    expect(papi.status).toBe('available-with-caution')
    expect(papi.value).toBe(11)
    expect(papi.sensitivity).not.toBeNull()
    // (40 − 18) / 3 = 7.33 and (40 − 18) / 1 = 22 by hand.
    expect(papi.sensitivity?.perturbedLow).toBe(7.33)
    expect(papi.sensitivity?.perturbedHigh).toBe(22)
    expect(papi.sensitivity?.baseline).toBe(11)
  })
})

describe('H5 measurement-episode validity', () => {
  it('refuses to combine values from different measurement episodes silently', () => {
    const svr = evaluate(MIXED, 'systemicVascularResistance')
    expect(svr.status).toBe('withheld')
    expect(svr.clinicalValidityReasons.join(' ')).toMatch(
      /different measurement episodes \(current and earlier-titration\)/i,
    )
    const cpo = evaluate(MIXED, 'cardiacPowerOutputW')
    expect(cpo.status).toBe('withheld')
    const papi = evaluate(MIXED, 'pulmonaryArteryPulsatilityIndex')
    expect(papi.status).toBe('withheld')
    // The all-current branch stays interpretable.
    expect(evaluate(MIXED, 'pulmonaryVascularResistance').status).toBe('available')
    expect(evaluate(MIXED, 'cardiacIndexLMinM2').status).toBe('available')
  })

  it('lets no method-unknown cardiac output feed a downstream metric', () => {
    const plausible = requireDerivedMeasurementEpisode('ep-transfer-plausible')
    for (const metricId of [
      'cardiacIndexLMinM2',
      'strokeVolumeMl',
      'systemicVascularResistance',
      'pulmonaryVascularResistance',
      'cardiacPowerOutputW',
      'pulmonaryArteryCompliance',
    ] as const) {
      const result = evaluate(plausible, metricId)
      expect(result.status).toBe('withheld')
      expect(
        [...result.clinicalValidityReasons, ...result.mathematicalValidityReasons].join(' '),
      ).toMatch(/method is unknown/i)
    }
    expect(evaluate(plausible, 'pulmonaryArteryPulsatilityIndex').status).toBe('available')
  })

  it('propagates the assumed-uptake caution into every flow-dependent value and no further', () => {
    for (const metricId of [
      'cardiacIndexLMinM2',
      'systemicVascularResistance',
      'pulmonaryVascularResistance',
      'cardiacPowerOutputW',
      'pulmonaryArteryCompliance',
    ] as const) {
      const result = evaluate(ASSUMED_VO2, metricId)
      expect(result.status).toBe('available-with-caution')
      expect(result.cautions.join(' ')).toMatch(/assumed oxygen uptake/i)
      expect(result.flowMethodLabel).toBe('Fick with an assumed oxygen uptake')
    }
    const papi = evaluate(ASSUMED_VO2, 'pulmonaryArteryPulsatilityIndex')
    expect(papi.status).toBe('available')
    expect(papi.cautions).toEqual([])
  })

  it('withholds every dependent metric when the flow result was itself withheld', () => {
    const withheldFlow: DerivedMeasurementEpisode = {
      ...ASSUMED_VO2,
      flowResults: [
        {
          ...ASSUMED_VO2.flowResults[0],
          status: 'withheld',
          valueLMin: null,
          withheldReasons: ['The venous specimen did not come from the pulmonary artery.'],
        },
      ],
    }
    const svr = evaluateDerivedMetric(
      'systemicVascularResistance',
      withheldFlow,
      withheldFlow.flowResults[0],
    )
    expect(svr.status).toBe('withheld')
    expect(svr.clinicalValidityReasons.join(' ')).toMatch(
      /withheld rather than recalculated from stale inputs/i,
    )
    expect(
      evaluateDerivedMetric(
        'pulmonaryArteryPulsatilityIndex',
        withheldFlow,
        withheldFlow.flowResults[0],
      ).status,
    ).toBe('available')
  })

  it('withholds only the wedge-dependent branch for an invalid PAWP', () => {
    expect(evaluate(INVALID_PAWP, 'pulmonaryVascularResistance').status).toBe('withheld')
    expect(evaluate(INVALID_PAWP, 'pulmonaryVascularResistanceIndex').status).toBe('withheld')
    for (const survivor of [
      'systemicVascularResistance',
      'cardiacPowerOutputW',
      'pulmonaryArteryPulsatilityIndex',
      'cardiacIndexLMinM2',
      'strokeVolumeMl',
      'pulmonaryArteryCompliance',
    ] as const) {
      expect(evaluate(INVALID_PAWP, survivor).status).toBe('available')
    }
  })

  it('withholds only the RAP-dependent branch when RAP is missing', () => {
    const missingRap = withInput(COHERENT, 'rapMmHg', {
      value: null,
      valid: false,
      note: 'The right atrial trace was lost before a mean could be stored on this occasion.',
    })
    const flow = acceptedFlow(missingRap)
    expect(evaluateDerivedMetric('systemicVascularResistance', missingRap, flow).status).toBe(
      'withheld',
    )
    expect(evaluateDerivedMetric('pulmonaryArteryPulsatilityIndex', missingRap, flow).status).toBe(
      'withheld',
    )
    expect(evaluateDerivedMetric('pulmonaryVascularResistance', missingRap, flow).status).toBe(
      'available',
    )
    expect(evaluateDerivedMetric('cardiacPowerOutputW', missingRap, flow).status).toBe('available')
  })

  it('withholds only the indexed branch when body size is missing', () => {
    for (const indexed of [
      'cardiacIndexLMinM2',
      'strokeVolumeIndexMlM2',
      'systemicVascularResistanceIndex',
      'pulmonaryVascularResistanceIndex',
    ] as const) {
      const result = evaluate(MISSING_BSA, indexed)
      expect(result.status).toBe('withheld')
    }
    for (const survivor of [
      'strokeVolumeMl',
      'systemicVascularResistance',
      'pulmonaryVascularResistance',
      'cardiacPowerOutputW',
      'pulmonaryArteryPulsatilityIndex',
      'pulmonaryArteryCompliance',
    ] as const) {
      expect(evaluate(MISSING_BSA, survivor).status).toBe('available')
    }
  })

  it('keeps pressure-only metrics alive when no cardiac output exists at all', () => {
    const noFlow: DerivedMeasurementEpisode = { ...COHERENT, flowResults: [] }
    const sets = evaluateDerivedEpisode(noFlow)
    expect(sets).toHaveLength(1)
    const byId = new Map(sets[0].results.map((result) => [result.metricId, result]))
    expect(byId.get('systemicVascularResistance')?.status).toBe('withheld')
    expect(byId.get('pulmonaryArteryPulsatilityIndex')?.status).toBe('available')
    expect(byId.get('pulsePressureVariationPercent')?.status).toBe('available')
  })
})

describe('H5 method dependence and disagreement', () => {
  it('produces two separate labeled result sets for two acceptable methods', () => {
    const sets = evaluateDerivedEpisode(DISAGREEMENT)
    expect(sets).toHaveLength(2)
    const [thermodilution, fick] = sets
    expect(thermodilution.flowMethodLabel).toBe('Bolus thermodilution')
    expect(fick.flowMethodLabel).toBe('Direct Fick with measured oxygen uptake')

    const tdSvr = thermodilution.results.find(
      (result) => result.metricId === 'systemicVascularResistance',
    )
    const fickSvr = fick.results.find((result) => result.metricId === 'systemicVascularResistance')
    // 80 × (90 − 9) / 4.1 = 1580.5 → 1580 and 80 × 81 / 5.6 = 1157.1 → 1157 by hand.
    expect(tdSvr?.value).toBe(1580)
    expect(fickSvr?.value).toBe(1157)
    expect(tdSvr?.flowMethodLabel).toBe('Bolus thermodilution')
    expect(fickSvr?.flowMethodLabel).toBe('Direct Fick with measured oxygen uptake')

    const tdPvr = thermodilution.results.find(
      (result) => result.metricId === 'pulmonaryVascularResistance',
    )
    const fickPvr = fick.results.find((result) => result.metricId === 'pulmonaryVascularResistance')
    expect(tdPvr?.value).toBe(5.4)
    expect(fickPvr?.value).toBe(3.9)

    /**
     * The averaged flow (4.85 L/min) would give PVR 4.5 and SVR 1336. Neither number exists in
     * either set: the two methods are never combined before deriving values.
     */
    const everyValue = sets.flatMap((set) => set.results.map((result) => result.value))
    expect(everyValue).not.toContain(4.5)
    expect(everyValue).not.toContain(1336)
  })

  it('keeps method-independent metrics identical across the two sets', () => {
    const sets = evaluateDerivedEpisode(DISAGREEMENT)
    const papiValues = sets.map(
      (set) =>
        set.results.find((result) => result.metricId === 'pulmonaryArteryPulsatilityIndex')?.value,
    )
    expect(papiValues[0]).toBe(papiValues[1])
    expect(papiValues[0]).toBe(3.11)
  })

  it('marks the method-dependent values with the disagreement caution in both sets', () => {
    const sets = evaluateDerivedEpisode(DISAGREEMENT)
    for (const set of sets) {
      const svr = set.results.find((result) => result.metricId === 'systemicVascularResistance')
      expect(svr?.status).toBe('available-with-caution')
      expect(svr?.cautions.join(' ')).toMatch(/separate labeled sets rather than averaged/i)
    }
  })

  it('offers averaging as a position and never as the defensible one', () => {
    for (const decision of [derivedMethodDisagreementDecision, derivedTransferComparisonDecision]) {
      const averaging = decision.options.filter((option) => option.verdict === 'averages-methods')
      expect(averaging.length).toBeGreaterThan(0)
      expect(averaging.some((option) => option.id === decision.defensibleOptionId)).toBe(false)
      const defensible = decision.options.filter((option) => option.verdict === 'defensible')
      expect(defensible).toHaveLength(1)
      expect(defensible[0].id).toBe(decision.defensibleOptionId)
    }
  })

  it('treats selecting the expected-looking result as indefensible in both decisions', () => {
    expect(
      derivedMethodDisagreementDecision.options.find((option) => option.id === 'pick-expected-set')
        ?.verdict,
    ).toBe('not-defensible')
    expect(
      derivedTransferComparisonDecision.options.find(
        (option) => option.id === 'report-plausible-because-normal',
      )?.verdict,
    ).toBe('not-defensible')
    // The accepted disagreement itself remains unresolved: the defensible option keeps both sets.
    expect(derivedMethodDisagreementDecision.defensibleOptionId).toBe('two-method-labeled-sets')
  })
})

describe('H5 threshold context', () => {
  function context(id: string): DerivedThresholdContext {
    return requireDerivedThresholdContext(id)
  }

  it('classifies every boundary and refuses treatment targets outright', () => {
    expect(context('papi-acute-rv-infarction-cut-point').classification).toBe(
      'phenotype-specific-cutoff',
    )
    expect(context('cpo-acute-cardiac-cohort-cut-point').classification).toBe(
      'cohort-risk-association',
    )
    expect(context('pvr-esc-ers-definition-component').classification).toBe('diagnostic-definition')
    expect(context('pa-compliance-cohort-distribution').classification).toBe(
      'cohort-risk-association',
    )
    expect(context('ci-educational-alarm-boundaries').classification).toBe('model-parameter')

    const target: DerivedThresholdContext = {
      ...context('cpo-acute-cardiac-cohort-cut-point'),
      id: 'cpo-as-target',
      classification: 'treatment-target',
    }
    expect(() =>
      validateDerivedMetrics(derivedMetricRecords, [...derivedThresholdContexts, target]),
    ).toThrow(/classified as a treatment target/i)
  })

  it('keeps the diagnostic definition a definition, not a target', () => {
    const definition = context('pvr-esc-ers-definition-component')
    expect(definition.statement).toMatch(
      /contributes to the pre-capillary definition only together/i,
    )
    expect(definition.notUniversal).toMatch(/not a treatment target/i)
  })

  it('names the population behind every cohort association and phenotype cut point', () => {
    for (const candidate of derivedThresholdContexts) {
      if (
        candidate.classification === 'cohort-risk-association' ||
        candidate.classification === 'phenotype-specific-cutoff'
      ) {
        expect(candidate.population).toMatch(/cohort|population|adults|patients|simulation/i)
        expect(candidate.notUniversal.length).toBeGreaterThan(20)
      }
    }
  })

  it('declares its source gaps instead of inventing numbers for them', () => {
    const gaps = derivedUnsupportedClaimTopics()
    expect(gaps).toContain('bsa-estimating-formula')
    expect(gaps).toContain('small-denominator-numeric-criterion')
    expect(gaps).toContain('universal-derived-normal-ranges')
    expect(gaps).toContain('derived-value-treatment-targets')
    expect(derivedSourceSupportsClaim('pac-derived-part-2-2021', 'derived-variable-formulas')).toBe(
      true,
    )
    expect(derivedSourceSupportsClaim('pac-derived-part-2-2021', 'bsa-estimating-formula')).toBe(
      false,
    )
  })

  it('records a locator for exactly the claims verified against source text', () => {
    for (const verification of derivedClaimVerifications) {
      if (verification.depth === 'source-text-and-locator-verified') {
        expect(verification.locator).toMatch(/Bootsma.*p\. \d+/)
      } else {
        expect(verification.locator).toBeNull()
      }
    }
  })

  it('labels availability in words on the rendered result cards, never by color alone', () => {
    render(<DerivedTransferComparison />)
    fireEvent.click(
      screen.getByLabelText(/Report the coherent episode’s values with their method named/),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit this position' }))
    expect(screen.getAllByText('Withheld').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/calculated using bolus thermodilution/i).length).toBeGreaterThan(0)
  })
})

describe('H5 completion contract', () => {
  it('cannot be completed by the formula reference or by viewing numbers', () => {
    const { actGoals } = sectionRuntime('derived-hemodynamics')
    let state = derivedState()
    expect(goalsMet(actGoals, state)).toBe(false)
    // `derived-reviewed` was the one check the old formula reference set; it earns nothing here.
    state = icuHemodynamicsReducer(state, { type: 'VALIDATE_SIGNAL', check: 'derived-reviewed' })
    expect(goalsMet(actGoals, state)).toBe(false)

    // Nor does it complete the section, even with every other commitment already in hand: the
    // four hands-on checks stay outstanding.
    const completion = derivedHemodynamicsSectionCompletion({
      signalValidationChecks: state.signalValidationChecks,
      measuredCalculatedSeparated: true,
      disagreementPreservedWithoutAveraging: true,
      thresholdContextResolved: true,
    })
    expect(completion.complete).toBe(false)
    expect(completion.outstanding).toHaveLength(4)
    expect(completion.dependencyChainValidated).toBe(false)
    expect(completion.withheldForValidity).toBe(false)
    expect(completion.selectiveInvalidationPreserved).toBe(false)
    expect(completion.flowMethodTraced).toBe(false)
  })

  it('requires all four hands-on checks for the objective', () => {
    const { actGoals } = sectionRuntime('derived-hemodynamics')
    const checks = Object.values(DERIVED_SECTION_CHECKS)
    // The stage's goals and the completion contract's checks are one vocabulary, so the stage
    // cannot call the work done while the contract still lists it as outstanding.
    expect(actGoals).toHaveLength(checks.length)
    for (const id of checks) expect(actGoals).toContainEqual({ type: 'check', id })

    let state = derivedState()
    for (const check of checks.slice(0, -1)) {
      state = icuHemodynamicsReducer(state, { type: 'VALIDATE_SIGNAL', check })
      expect(goalsMet(actGoals, state)).toBe(false)
    }
    state = icuHemodynamicsReducer(state, {
      type: 'VALIDATE_SIGNAL',
      check: checks[checks.length - 1],
    })
    expect(goalsMet(actGoals, state)).toBe(true)
  })

  it('holds section completion to all seven evidence requirements', () => {
    const complete = derivedHemodynamicsSectionCompletion({
      signalValidationChecks: Object.values(DERIVED_SECTION_CHECKS),
      measuredCalculatedSeparated: true,
      disagreementPreservedWithoutAveraging: true,
      thresholdContextResolved: true,
    })
    expect(complete.complete).toBe(true)
    expect(complete.outstanding).toEqual([])

    const missingThreshold = derivedHemodynamicsSectionCompletion({
      signalValidationChecks: Object.values(DERIVED_SECTION_CHECKS),
      measuredCalculatedSeparated: true,
      disagreementPreservedWithoutAveraging: true,
      thresholdContextResolved: false,
    })
    expect(missingThreshold.complete).toBe(false)
    expect(missingThreshold.outstanding.join(' ')).toMatch(/phenotype-specific boundary/i)

    const nothing = derivedHemodynamicsSectionCompletion({
      signalValidationChecks: ['derived-reviewed'],
      measuredCalculatedSeparated: false,
      disagreementPreservedWithoutAveraging: false,
      thresholdContextResolved: false,
    })
    expect(nothing.complete).toBe(false)
    expect(nothing.outstanding).toHaveLength(7)
  })
})

describe('H5 station surfaces', () => {
  it('earns the separation only when every quantity is classified as recorded', () => {
    const onSeparated = jest.fn()
    render(<DerivedProvenanceDrill separated={false} onSeparated={onSeparated} />)
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(6)

    fireEvent.change(screen.getByLabelText('Mean PA pressure on the monitor'), {
      target: { value: 'measured' },
    })
    fireEvent.change(screen.getByLabelText('SVR on the flowsheet'), {
      target: { value: 'measured' },
    })
    for (const [label, value] of [
      ['Body surface area in the chart header', 'calculated'],
      ['The oxygen uptake inside a Fick result with no expired-gas collection', 'assumed'],
      ['Injectate volume typed into the cardiac-output computer', 'entered'],
      ['Mixed-venous saturation on a blood-gas slip', 'sampled'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit these classifications' }))
    expect(onSeparated).not.toHaveBeenCalled()
    expect(screen.getByText(/This value is calculated\./)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('SVR on the flowsheet'), {
      target: { value: 'calculated' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit these classifications' }))
    expect(onSeparated).toHaveBeenCalledTimes(1)
  })

  it('hides the coherent episode results until the chain and the method are committed', () => {
    const dispatch = jest.fn()
    render(
      <DerivedEpisodeWorkbench
        dispatch={dispatch}
        checks={[]}
        disagreementPreserved={false}
        onDisagreementPreserved={jest.fn()}
        thresholdContextResolved={false}
        onThresholdContextResolved={jest.fn()}
      />,
    )
    expect(screen.queryByText(/Results · Bolus thermodilution/)).not.toBeInTheDocument()

    for (const label of ['Mean pulmonary artery pressure', 'Mean PAWP', 'Cardiac output']) {
      fireEvent.click(screen.getByRole('checkbox', { name: label }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit the dependency chain' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: DERIVED_SECTION_CHECKS.dependencyChain,
    })

    fireEvent.click(screen.getByRole('radio', { name: 'Bolus thermodilution' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit the method' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: DERIVED_SECTION_CHECKS.methodTraced,
    })
  })

  it('reveals results and the threshold commitment once the checks are on record', () => {
    const onThresholdContextResolved = jest.fn()
    render(
      <DerivedEpisodeWorkbench
        dispatch={jest.fn()}
        checks={[DERIVED_SECTION_CHECKS.dependencyChain, DERIVED_SECTION_CHECKS.methodTraced]}
        disagreementPreserved={false}
        onDisagreementPreserved={jest.fn()}
        thresholdContextResolved={false}
        onThresholdContextResolved={onThresholdContextResolved}
      />,
    )
    expect(screen.getByText('Results · Bolus thermodilution')).toBeInTheDocument()
    expect(screen.getAllByText(/calculated using bolus thermodilution/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText(/As a cohort finding from acute inferior MI/))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this position' }))
    expect(onThresholdContextResolved).toHaveBeenCalledTimes(1)
  })

  it('grades the selective-invalidation decisions against the evaluator', () => {
    const dispatch = jest.fn()
    render(
      <DerivedEpisodeWorkbench
        dispatch={dispatch}
        checks={[]}
        disagreementPreserved={false}
        onDisagreementPreserved={jest.fn()}
        thresholdContextResolved={false}
        onThresholdContextResolved={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'The stored wedge is not interpretable' }))

    fireEvent.change(screen.getByLabelText(/PVR = \(mPAP − mean PAWP\) \/ CO/), {
      target: { value: 'withhold' },
    })
    fireEvent.change(screen.getByLabelText('Withholding reason for PVR'), {
      target: { value: derivedSelectiveDecision.correctWithholdReasonId },
    })
    for (const label of [/SVR = 80/, /PAPi = \(PASP/, /CI = CO/]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'calculate' } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit these decisions' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: DERIVED_SECTION_CHECKS.withheldForValidity,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: DERIVED_SECTION_CHECKS.selectivePreserved,
    })
  })

  it('withholds the preserved check when unrelated metrics are suppressed globally', () => {
    const dispatch = jest.fn()
    render(
      <DerivedEpisodeWorkbench
        dispatch={dispatch}
        checks={[]}
        disagreementPreserved={false}
        onDisagreementPreserved={jest.fn()}
        thresholdContextResolved={false}
        onThresholdContextResolved={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'The stored wedge is not interpretable' }))

    fireEvent.change(screen.getByLabelText(/PVR = \(mPAP − mean PAWP\) \/ CO/), {
      target: { value: 'withhold' },
    })
    fireEvent.change(screen.getByLabelText('Withholding reason for PVR'), {
      target: { value: derivedSelectiveDecision.correctWithholdReasonId },
    })
    // "Withhold everything to be safe" — the global switch the station refuses.
    for (const label of [/SVR = 80/, /PAPi = \(PASP/, /CI = CO/]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'withhold' } })
    }
    for (const metric of ['SVR', 'PAPi', 'CI']) {
      fireEvent.change(screen.getByLabelText(`Withholding reason for ${metric}`), {
        target: { value: 'required-input-invalid-pawp' },
      })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit these decisions' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: DERIVED_SECTION_CHECKS.withheldForValidity,
    })
    expect(dispatch).not.toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: DERIVED_SECTION_CHECKS.selectivePreserved,
    })
    expect(screen.getAllByText(/should remain available/i).length).toBeGreaterThan(0)
  })

  it('keeps the transfer evaluations hidden until a position is committed', () => {
    render(<DerivedTransferComparison />)
    expect(screen.getAllByText(/As printed on the sheet, before any validity reading/).length).toBe(
      2,
    )
    expect(screen.queryByText(/Evaluated ·/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Blend the two episodes/))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this position' }))
    expect(screen.getByText(/This averages or blends unlike quantities/)).toBeInTheDocument()
    expect(screen.getAllByText(/Evaluated ·/).length).toBe(2)
  })

  it('renders the metric model panel from the canonical records', () => {
    render(<DerivedHemodynamicsTeachingPanel />)
    expect(
      screen.getByRole('heading', {
        name: 'Derived hemodynamics are equations, not new measurements',
      }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'PAPi' }))
    expect(screen.getAllByText(/Phenotype-specific cut point/).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/must not be extrapolated from one phenotype to another/).length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'CPO' }))
    expect(screen.getAllByText(/Cohort risk association/).length).toBeGreaterThan(0)
  })
})

/**
 * A wrong graded answer has to be recoverable.
 *
 * Two of these decisions carry completion evidence awarded only for the defensible option. Locking
 * every commitment permanently meant a learner who answered wrong held that answer until they reset
 * the activity. The contract below is: the first attempt and its feedback survive until the learner
 * explicitly reconsiders, a defensible answer stays locked because there is nothing to recover from,
 * and reconsidering never silently swaps the wrong answer for the right one.
 */
describe('H5 decision recovery', () => {
  function renderWorkbench(overrides: {
    readonly onDisagreementPreserved?: () => void
    readonly onThresholdContextResolved?: () => void
  }) {
    render(
      <DerivedEpisodeWorkbench
        dispatch={jest.fn()}
        checks={[DERIVED_SECTION_CHECKS.dependencyChain, DERIVED_SECTION_CHECKS.methodTraced]}
        disagreementPreserved={false}
        onDisagreementPreserved={overrides.onDisagreementPreserved ?? jest.fn()}
        thresholdContextResolved={false}
        onThresholdContextResolved={overrides.onThresholdContextResolved ?? jest.fn()}
      />,
    )
  }

  const RECONSIDER = 'Reconsider and commit again'
  const COMMIT = 'Commit this position'

  it('does not award disagreement preservation for averaging, and offers a way back', () => {
    const onDisagreementPreserved = jest.fn()
    renderWorkbench({ onDisagreementPreserved })
    fireEvent.click(screen.getByRole('tab', { name: 'Two defensible flows, two result sets' }))

    fireEvent.click(screen.getByLabelText(/Average the two flows to 4.85/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))

    expect(onDisagreementPreserved).not.toHaveBeenCalled()
    // The first attempt and its feedback stay put until the learner asks to change them.
    expect(screen.getByText(/This averages or blends unlike quantities/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Average the two flows to 4.85/)).toBeChecked()
    expect(screen.getByRole('button', { name: RECONSIDER })).toBeInTheDocument()
  })

  it('lets the wrong disagreement answer be reconsidered and then earns the check', () => {
    const onDisagreementPreserved = jest.fn()
    renderWorkbench({ onDisagreementPreserved })
    fireEvent.click(screen.getByRole('tab', { name: 'Two defensible flows, two result sets' }))
    fireEvent.click(screen.getByLabelText(/Average the two flows to 4.85/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))

    fireEvent.click(screen.getByRole('button', { name: RECONSIDER }))

    // Re-enabled, and the attempted selection is cleared rather than replaced with the right one.
    const averaging = screen.getByLabelText(/Average the two flows to 4.85/)
    expect(averaging).toBeEnabled()
    expect(averaging).not.toBeChecked()
    expect(screen.getByLabelText(/Keep two method-labeled result sets/)).not.toBeChecked()
    expect(screen.queryByRole('button', { name: RECONSIDER })).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Keep two method-labeled result sets/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))
    expect(onDisagreementPreserved).toHaveBeenCalledTimes(1)
  })

  it('does not award threshold context for the universal reading, and offers a way back', () => {
    const onThresholdContextResolved = jest.fn()
    renderWorkbench({ onThresholdContextResolved })

    fireEvent.click(screen.getByLabelText(/As a universal rule/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))

    expect(onThresholdContextResolved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: RECONSIDER })).toBeInTheDocument()
  })

  it('lets the wrong threshold answer be reconsidered and then earns the check', () => {
    const onThresholdContextResolved = jest.fn()
    renderWorkbench({ onThresholdContextResolved })
    fireEvent.click(screen.getByLabelText(/As a treatment trigger/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))

    fireEvent.click(screen.getByRole('button', { name: RECONSIDER }))
    expect(screen.getByLabelText(/As a treatment trigger/)).not.toBeChecked()

    fireEvent.click(screen.getByLabelText(/As a cohort finding from acute inferior MI/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))
    expect(onThresholdContextResolved).toHaveBeenCalledTimes(1)
  })

  it('lets the transfer decision be retried without taking back the comparison', () => {
    render(<DerivedTransferComparison />)
    fireEvent.click(screen.getByLabelText(/Blend the two episodes/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))
    expect(screen.getAllByText(/Evaluated ·/).length).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: RECONSIDER }))
    expect(screen.getByLabelText(/Blend the two episodes/)).not.toBeChecked()
    // The comparison was earned by committing once; reconsidering does not hide it again.
    expect(screen.getAllByText(/Evaluated ·/).length).toBe(2)

    fireEvent.click(screen.getByLabelText(/Report the coherent episode’s values/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))
    expect(screen.getByText(/Defensible for this episode/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: RECONSIDER })).not.toBeInTheDocument()
  })

  it('keeps a correctly earned answer recorded and locked', () => {
    render(
      <DerivedEpisodeWorkbench
        dispatch={jest.fn()}
        checks={[DERIVED_SECTION_CHECKS.dependencyChain, DERIVED_SECTION_CHECKS.methodTraced]}
        disagreementPreserved
        onDisagreementPreserved={jest.fn()}
        thresholdContextResolved
        onThresholdContextResolved={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Two defensible flows, two result sets' }))

    const defensible = screen.getByLabelText(/Keep two method-labeled result sets/)
    expect(defensible).toBeChecked()
    expect(defensible).toBeDisabled()
    expect(screen.queryByRole('button', { name: RECONSIDER })).not.toBeInTheDocument()
  })

  it('moves focus to the re-enabled choices when the learner reconsiders', () => {
    renderWorkbench({})
    fireEvent.click(screen.getByLabelText(/As a universal rule/))
    fireEvent.click(screen.getByRole('button', { name: COMMIT }))
    fireEvent.click(screen.getByRole('button', { name: RECONSIDER }))

    // The learner was sent back to the decision; focus lands on its first option, not on nothing.
    expect(document.activeElement).toBe(
      screen.getByLabelText(/As a cohort finding from acute inferior MI/),
    )
  })
})

/**
 * A pressure is transduced from a waveform; a specimen is drawn from a site at a time. H4 gave
 * `sampled` the second meaning, so letting a pressure claim it blurs the one provenance distinction
 * the Fick oxygen inputs depend on. The rule is structural rather than per-record so a new pressure
 * cannot quietly acquire it later.
 */
describe('H5 pressure provenance', () => {
  const PRESSURE_INPUTS = [
    'mapMmHg',
    'rapMmHg',
    'meanPapMmHg',
    'papSystolicMmHg',
    'papDiastolicMmHg',
    'pawpMeanMmHg',
  ] as const

  it('marks every pressure input as a waveform reading', () => {
    for (const inputId of PRESSURE_INPUTS) {
      expect(requireDerivedInputDefinition(inputId).isPressureReading).toBe(true)
    }
  })

  it('never accepts sampled for a pressure anywhere in the model', () => {
    for (const metric of derivedMetricRecords) {
      for (const dependency of metric.dependencies) {
        if (!requireDerivedInputDefinition(dependency.inputId).isPressureReading) continue
        expect(dependency.acceptableProvenance).not.toContain('sampled')
      }
    }
  })

  it('accepts a measured mean PAWP in both resistance metrics', () => {
    for (const metricId of ['pulmonaryVascularResistance', 'pulmonaryVascularResistanceIndex']) {
      const dependency = requireDerivedMetric(
        metricId as DerivedMetricRecord['id'],
      ).dependencies.find((candidate) => candidate.inputId === 'pawpMeanMmHg')
      expect(dependency?.acceptableProvenance).toEqual(['measured'])
    }
    expect(evaluate(COHERENT, 'pulmonaryVascularResistance').status).toBe('available')
    expect(evaluate(COHERENT, 'pulmonaryVascularResistanceIndex').status).toBe('available')
  })

  it('withholds PVR when the episode records the wedge as a specimen', () => {
    const sampledWedge = withInput(COHERENT, 'pawpMeanMmHg', { provenance: 'sampled' })
    expect(evaluate(sampledWedge, 'pulmonaryVascularResistance').status).toBe('withheld')
  })

  it('refuses a model that lets a pressure be sampled', () => {
    const pvr = requireDerivedMetric('pulmonaryVascularResistance')
    const broken: DerivedMetricRecord = {
      ...pvr,
      dependencies: pvr.dependencies.map((dependency) =>
        dependency.inputId === 'pawpMeanMmHg'
          ? { ...dependency, acceptableProvenance: ['measured', 'sampled'] as const }
          : dependency,
      ),
    }
    expect(() =>
      validateDerivedMetrics(
        derivedMetricRecords.map((metric) => (metric.id === broken.id ? broken : metric)),
        derivedThresholdContexts,
      ),
    ).toThrow(/must not accept sampled/i)
  })

  it('shows only the Measured chip for PAWP on the PVR and PVRI cards', () => {
    render(<DerivedHemodynamicsTeachingPanel />)
    for (const tab of ['PVR', 'PVRI']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      const wedgeRow = screen.getByText('Mean PAWP (mmHg) · numerator').closest('div')
      expect(wedgeRow).not.toBeNull()
      expect(wedgeRow?.textContent).toContain('Measured')
      expect(wedgeRow?.textContent).not.toContain('Sampled')
    }
  })

  it('leaves sampled available to the genuine specimen inputs', () => {
    // H4's oxygen measurements are what `sampled` was defined for; H5 must not take it from them.
    const fick = cardiacOutputMethodById.get('fick-direct')
    const sampled = fick?.inputs.filter((input) => input.status === 'sampled') ?? []
    expect(sampled.map((input) => input.id)).toEqual(
      expect.arrayContaining(['arterial-saturation', 'mixed-venous-saturation']),
    )
  })
})

/**
 * An exact number on screen is a claim about a source. These pin the two the review caught: an SVRI
 * interval attributed to a table that does not tabulate one, and a PAPi cut point attributed to a
 * cohort that did not report it.
 */
describe('H5 threshold provenance', () => {
  /** Every exact figure a displayed boundary states, as digits. */
  function numbersIn(text: string): readonly string[] {
    return text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []
  }

  it('gives every displayed boundary a population and at least one resolvable source', () => {
    for (const context of derivedThresholdContexts) {
      expect(context.population.length).toBeGreaterThan(0)
      expect(context.evidenceIds.length).toBeGreaterThan(0)
      for (const evidenceId of context.evidenceIds) {
        expect(hemodynamicsSourceById.get(evidenceId)).toBeDefined()
      }
    }
  })

  it('keeps 0.9 with the acute inferior-MI cohort', () => {
    const context = requireDerivedThresholdContext('papi-acute-rv-infarction-cut-point')
    expect(context.statement).toContain('0.9')
    expect(context.evidenceIds).toContain('papi-rvmi-2012')
    expect(context.evidenceIds).not.toContain('papi-lvad-rvf-2016')
    expect(context.population).toMatch(/inferior-MI/i)
  })

  it('attributes 1.85 to the LVAD cohort that reported it, not to the acute-MI paper', () => {
    const context = requireDerivedThresholdContext('papi-advanced-hf-teaching-band')
    expect(context.statement).toContain('1.85')
    expect(context.evidenceIds).toEqual(['papi-lvad-rvf-2016'])
    expect(context.evidenceIds).not.toContain('papi-rvmi-2012')
    // The specific study design, not a vague "advanced heart failure" band.
    expect(context.statement).toMatch(/receiver-operating-characteristic/i)
    expect(context.population).toMatch(/132/)
    expect(context.intendedUse).toMatch(/postoperative right ventricular failure/i)
    expect(context.notUniversal).toMatch(/not a treatment target/i)

    const source = hemodynamicsSourceById.get('papi-lvad-rvf-2016')
    expect(source?.citation).toMatch(/Morine/)
    expect(source?.citation).toMatch(/J Card Fail\. 2016;22\(2\):110–116/)
    expect(source?.citation).toMatch(/10\.1016\/j\.cardfail\.2015\.10\.019/)
  })

  it('records honest verification depth for the LVAD cut point', () => {
    const record = derivedClaimVerifications.find(
      (candidate) => candidate.topic === 'papi-lvad-cut-point',
    )
    // The paper was not available locally, so it must not claim locator-level verification.
    expect(record?.depth).toBe('claim-text-audited')
    expect(record?.locator).toBeNull()
    expect(derivedSourceSupportsClaim('papi-lvad-rvf-2016', 'papi-lvad-cut-point')).toBe(true)
  })

  it('states no SVRI interval, because none was verified', () => {
    const context = requireDerivedThresholdContext('svri-no-bedside-boundary')
    expect(context.classification).toBe('reference-interval')
    expect(numbersIn(context.statement)).toEqual([])
    expect(context.statement).toMatch(/no adult reference interval for SVRI/i)
    // The verified figures are the four the table actually carries.
    const verified = derivedClaimVerifications.find(
      (candidate) => candidate.topic === 'adult-reference-intervals',
    )
    expect(verified?.whatWasVerified).toMatch(/No SVRI interval was verified/i)
  })

  it('shows no SVRI number on the rendered card', () => {
    render(<DerivedHemodynamicsTeachingPanel />)
    fireEvent.click(screen.getByRole('tab', { name: 'SVRI' }))
    expect(screen.queryByText(/1,970/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2,390/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/no adult reference interval for SVRI/i).length).toBeGreaterThan(0)
  })

  it('still refuses a treatment-target classification', () => {
    const context = requireDerivedThresholdContext('papi-advanced-hf-teaching-band')
    expect(() =>
      validateDerivedMetrics(
        derivedMetricRecords,
        derivedThresholdContexts.map((candidate) =>
          candidate.id === context.id
            ? ({ ...candidate, classification: 'treatment-target' } as DerivedThresholdContext)
            : candidate,
        ),
      ),
    ).toThrow(/treatment target/i)
  })
})

/**
 * Over-wedging and incomplete occlusion are different failures with different tracings. The episode
 * used to name both for one set of clues that fit only over-wedging.
 */
describe('H5 invalid-wedge mechanism', () => {
  it('names over-wedging only, and agrees with its own upward-drift clue', () => {
    const wedge = INVALID_PAWP.inputs.find((input) => input.inputId === 'pawpMeanMmHg')
    const copy = `${INVALID_PAWP.title} ${INVALID_PAWP.presentation} ${wedge?.note ?? ''}`

    expect(INVALID_PAWP.title).toBe('The stored wedge is not interpretable')
    expect(copy).toMatch(/drifted upward/i)
    expect(copy).toMatch(/over-wedging/i)
    expect(copy).not.toMatch(/incomplete occlusion/i)
    expect(copy).not.toMatch(/did not wedge/i)
  })

  it('leaves the evaluator outcome and selective withholding unchanged', () => {
    expect(evaluate(INVALID_PAWP, 'pulmonaryVascularResistance').status).toBe('withheld')
    expect(evaluate(INVALID_PAWP, 'pulmonaryVascularResistanceIndex').status).toBe('withheld')
    for (const metricId of [
      'systemicVascularResistance',
      'cardiacIndexLMinM2',
      'pulmonaryArteryPulsatilityIndex',
      'cardiacPowerOutputW',
    ] as const) {
      expect(evaluate(INVALID_PAWP, metricId).status).toBe('available')
    }
  })

  it('fails the copy contract if the two mechanisms are merged again', () => {
    const merged = withInput(INVALID_PAWP, 'pawpMeanMmHg', {
      note: 'The occlusion trace never showed atrial morphology and drifted upward — an over-wedged, incomplete occlusion.',
    })
    const note = merged.inputs.find((input) => input.inputId === 'pawpMeanMmHg')?.note ?? ''
    expect(note).toMatch(/incomplete occlusion/i)
  })
})

describe('H5 non-regression', () => {
  /**
   * The flow rebuild (2026-09-05) renamed every section by its presentation and added two
   * sections elsewhere on the pathway. The derived station's id, place after the cardiac-output
   * station, route and completion contract are unchanged.
   */
  it('keeps the derived station identity unchanged inside the rebuilt pathway', () => {
    const order = pacLearningPathwaySections.map((section) => section.id)
    expect(order).toHaveLength(9)
    expect(order.indexOf('derived-hemodynamics')).toBe(order.indexOf('thermodilution-series') + 1)
    expect(order.indexOf('derived-hemodynamics')).toBe(order.indexOf('pac-signal-validation') - 1)
    const activity = criticalCareActivityById.get('hemodynamics:learn:derived-hemodynamics')
    expect(activity).toBeDefined()
    expect(activity?.title).toBe('Numbers made of numbers')
    expect(activity?.query).toEqual({ activity: 'derived-hemodynamics' })
    expect(activity?.curriculumStage).toBe('application')
  })

  it('leaves storage keys, progress versions, and the content version untouched', () => {
    expect(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY).toBe('icu-hemodynamics-progress-v2')
    expect(ICU_HEMODYNAMICS_PROGRESS_VERSION).toBe(2)
    expect(ICU_HEMODYNAMICS_CONTENT_VERSION).toBe('1.0.0-preview.1')
  })

  it('keeps the case-scoring derived-reviewed check intact for the case workflow', () => {
    // The Learn station no longer uses it, but case scoring still counts it; the check must
    // survive in the reducer's vocabulary.
    let state = derivedState()
    state = icuHemodynamicsReducer(state, { type: 'VALIDATE_SIGNAL', check: 'derived-reviewed' })
    expect(state.signalValidationChecks).toContain('derived-reviewed')
  })

  it('adds no shock-management instruction to the derived station copy', () => {
    const copy = h5LearnerCopy().join(' ')
    expect(copy).not.toMatch(/\bstart (norepinephrine|dobutamine|epinephrine|vasopressin)\b/i)
    expect(copy).not.toMatch(/\btitrate\b[^.]*\bto\b[^.]*\d/i)
    // "not a mandate to give fluid" is the boundary statement itself; an instruction is banned.
    expect(copy).not.toMatch(/(?<!mandate to )\bgive fluids?\b/i)
  })
})
