import { criticalCareFeatureFlagNames, resolveCriticalCareFeatureFlags } from '../featureFlags'

describe('critical-care recovery feature flags', () => {
  it('keeps the dashboard and active hemodynamics recovery independent from unrecovered chrome', () => {
    expect(resolveCriticalCareFeatureFlags({})).toEqual({
      criticalCareDashboardV2: true,
      hemodynamicsGuidedV2: true,
      ventilationLearnV2: false,
      mcsChromeV2: false,
      ecmoChromeV2: false,
      crrtChromeV2: false,
      icuChromeV2: false,
    })
  })

  it.each([
    ['1', true],
    ['true', true],
    ['enabled', true],
    ['0', false],
    ['false', false],
    ['disabled', false],
  ] as const)('parses an explicit dashboard value of %s', (value, expected) => {
    expect(
      resolveCriticalCareFeatureFlags({ CRITICAL_CARE_DASHBOARD_V2: value })
        .criticalCareDashboardV2,
    ).toBe(expected)
  })

  it('falls back safely for invalid values without coupling flags together', () => {
    const resolved = resolveCriticalCareFeatureFlags({
      VENTILATION_LEARN_V2: 'yes',
      ECMO_CHROME_V2: 'not-a-boolean',
    })

    expect(resolved.ventilationLearnV2).toBe(true)
    expect(resolved.ecmoChromeV2).toBe(false)
    expect(criticalCareFeatureFlagNames).toHaveLength(7)
  })
})
