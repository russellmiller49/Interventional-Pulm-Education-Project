import { advanceFilterProgression, type FilterProgressionInput } from '../filterModel'
import type { FilterProgressionParameters, FilterState } from '../types'

const filter: FilterState = {
  filterId: 'synthetic-filter',
  effectivePermeabilityFraction: 1,
  foulingBurdenFraction: 0,
  clotBurdenFraction: 0,
  bloodFlowInterruptionFraction: 0,
  lowEffectiveBloodFlowFraction: 0,
  procoagulantBurdenFraction: 0,
}

const parameters: FilterProgressionParameters = {
  foulingFractionPerHourAtRiskOne: 0.01,
  clotFractionPerHourAtRiskOne: 0.02,
  filtrationFractionWeight: 1,
  interruptionWeight: 1,
  lowFlowWeight: 1,
  accessDysfunctionWeight: 1,
  hematocritWeight: 1,
  procoagulantWeight: 1,
  anticoagulationProtectionFraction: { none: 0, 'systemic-concept': 0.5 },
  referenceHematocritFraction: 0.25,
  reviewStatus: 'pending',
  sourceIds: ['TEST-P2-001'],
}

const baseline: FilterProgressionInput = {
  filtrationFraction: 0.1,
  bloodFlowInterruptionFraction: 0,
  lowEffectiveBloodFlowFraction: 0,
  accessDysfunctionFraction: 0,
  hematocritFraction: 0.25,
  procoagulantBurdenFraction: 0,
  anticoagulation: 'none',
}

function progression(overrides: Partial<FilterProgressionInput> = {}) {
  return advanceFilterProgression(filter, { ...baseline, ...overrides }, parameters, 3600)
}

describe('CRRT filter burden model', () => {
  it.each([
    ['filtration fraction', { filtrationFraction: 0.5 }],
    ['blood-flow interruption', { bloodFlowInterruptionFraction: 1 }],
    ['low effective blood flow', { lowEffectiveBloodFlowFraction: 1 }],
    ['access dysfunction', { accessDysfunctionFraction: 1 }],
    ['hematocrit stress', { hematocritFraction: 0.6 }],
    ['scenario procoagulant burden', { procoagulantBurdenFraction: 1 }],
  ])('responds directionally to increased %s', (_label, overrides) => {
    const control = progression()
    const stressed = progression(overrides)
    expect(stressed.protectedRiskIndex).toBeGreaterThan(control.protectedRiskIndex)
    expect(stressed.filter.foulingBurdenFraction).toBeGreaterThan(
      control.filter.foulingBurdenFraction,
    )
    expect(stressed.filter.clotBurdenFraction).toBeGreaterThan(control.filter.clotBurdenFraction)
  })

  it('applies only the caller-supplied anticoagulation abstraction', () => {
    const noAnticoagulation = progression({ procoagulantBurdenFraction: 0.8 })
    const systemicConcept = progression({
      procoagulantBurdenFraction: 0.8,
      anticoagulation: 'systemic-concept',
    })
    expect(systemicConcept.protectedRiskIndex).toBeLessThan(noAnticoagulation.protectedRiskIndex)
  })

  it('is monotonic with time and clamps burdens at one', () => {
    const short = advanceFilterProgression(filter, baseline, parameters, 60)
    const long = advanceFilterProgression(filter, baseline, parameters, 3600)
    expect(long.foulingDeltaFraction).toBeGreaterThan(short.foulingDeltaFraction)
    const capped = advanceFilterProgression(
      { ...filter, foulingBurdenFraction: 0.999, clotBurdenFraction: 0.999 },
      { ...baseline, bloodFlowInterruptionFraction: 1, procoagulantBurdenFraction: 1 },
      { ...parameters, foulingFractionPerHourAtRiskOne: 10, clotFractionPerHourAtRiskOne: 10 },
      3600,
    )
    expect(capped.filter.foulingBurdenFraction).toBe(1)
    expect(capped.filter.clotBurdenFraction).toBe(1)
  })

  it('rejects impossible fractions and calibration values', () => {
    expect(() => progression({ filtrationFraction: 1.1 })).toThrow(/between 0 and 1/i)
    expect(() =>
      advanceFilterProgression(
        filter,
        baseline,
        { ...parameters, clotFractionPerHourAtRiskOne: -1 },
        1,
      ),
    ).toThrow(/nonnegative/i)
  })
})
