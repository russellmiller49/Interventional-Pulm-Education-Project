import {
  createSyntheticPressureLocalizationResult,
  isPressureLocalizationCombinationSupported,
  pressureLocalizationCandidateSourceIds,
  type PressureLocalizationSite,
} from '../pressureLocalizationLabModel'

function directions(fault: 'obstruction' | 'disconnection', site: PressureLocalizationSite) {
  return Object.fromEntries(
    createSyntheticPressureLocalizationResult(fault, site).signals.map((signal) => [
      signal.id,
      signal.direction,
    ]),
  )
}

describe('reviewer-only pressure localization model', () => {
  it('reuses deterministic blood-circuit and device-display math for its synthetic baseline', () => {
    const result = createSyntheticPressureLocalizationResult('obstruction', 'filter')

    expect(result.baseline).toEqual({
      accessPressureMmHg: -15,
      filterPressureMmHg: 50,
      returnPressureMmHg: 20,
      effluentPressureMmHg: -20,
      tmpMmHg: 37,
      filterPressureDropMmHg: 5,
    })
    expect(result.revealed).toEqual({
      accessPressureMmHg: -15,
      filterPressureMmHg: 80,
      returnPressureMmHg: 20,
      effluentPressureMmHg: -20,
      tmpMmHg: 52,
      filterPressureDropMmHg: 35,
    })
  })

  it.each([
    [
      'access-catheter',
      {
        access: 'lower',
        filter: 'unchanged',
        return: 'unchanged',
        effluent: 'unchanged',
        tmp: 'unchanged',
        'filter-drop': 'unchanged',
      },
    ],
    [
      'access-line',
      {
        access: 'lower',
        filter: 'unchanged',
        return: 'unchanged',
        effluent: 'unchanged',
        tmp: 'unchanged',
        'filter-drop': 'unchanged',
      },
    ],
    [
      'filter',
      {
        access: 'unchanged',
        filter: 'higher',
        return: 'unchanged',
        effluent: 'unchanged',
        tmp: 'higher',
        'filter-drop': 'higher',
      },
    ],
    [
      'return-line',
      {
        access: 'unchanged',
        filter: 'higher',
        return: 'higher',
        effluent: 'unchanged',
        tmp: 'higher',
        'filter-drop': 'unchanged',
      },
    ],
    [
      'effluent-line',
      {
        access: 'unchanged',
        filter: 'unchanged',
        return: 'unchanged',
        effluent: 'higher',
        tmp: 'lower',
        'filter-drop': 'unchanged',
      },
    ],
  ] as const)('derives the obstruction pattern at %s', (site, expected) => {
    expect(directions('obstruction', site)).toEqual(expected)
  })

  it('keeps catheter and access-line placements distinct while sharing generic access math', () => {
    const catheter = createSyntheticPressureLocalizationResult('obstruction', 'access-catheter')
    const line = createSyntheticPressureLocalizationResult('obstruction', 'access-line')

    expect(catheter.signals).toEqual(line.signals)
    expect(catheter.siteLabel).toBe('Access catheter')
    expect(line.siteLabel).toBe('Access line')
    expect(catheter.locationExplanation).toMatch(/access catheter/i)
    expect(line.locationExplanation).toMatch(/extracorporeal access line/i)
  })

  it('fails every disconnection location closed until a device-reviewed pattern exists', () => {
    for (const site of [
      'access-catheter',
      'access-line',
      'filter',
      'return-line',
      'effluent-line',
    ] as const) {
      expect(isPressureLocalizationCombinationSupported('disconnection', site)).toBe(false)
      expect(() => createSyntheticPressureLocalizationResult('disconnection', site)).toThrow(
        /not included in this exercise/i,
      )
    }
  })

  it('exposes only the exact pending candidate-source set used by the lab', () => {
    expect(pressureLocalizationCandidateSourceIds).toEqual([
      'DEV-PM-009',
      'DEV-PM-010',
      'MATH-PM-002',
      'SYNTH-LAB-PRESSURE-001',
    ])
  })
})
