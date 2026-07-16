import {
  airwayGeometryOptions,
  benchDesignChecklist,
  forceTaxonomy,
  ginaDumonBenchData,
  mechanicsScenarios,
  tissueMechanisms,
} from '../content/curriculum'
import { stentMechanicsReferences } from '../content/references'
import { stentArchitecturePresets } from '../content/stentProfiles'

describe('airway stent mechanics curriculum integrity', () => {
  it('offers multiple genuinely different 3D architecture families', () => {
    expect(stentArchitecturePresets).toHaveLength(8)
    expect(new Set(stentArchitecturePresets.map((preset) => preset.id)).size).toBe(
      stentArchitecturePresets.length,
    )
    expect(new Set(stentArchitecturePresets.map((preset) => preset.renderKind))).toEqual(
      new Set(['silicone', 'braid', 'laser-cut', 'y']),
    )
    for (const preset of stentArchitecturePresets) {
      expect(preset.strengths.length).toBeGreaterThanOrEqual(3)
      expect(preset.tradeoffs.length).toBeGreaterThanOrEqual(3)
      expect(preset.sourceRefs.length).toBeGreaterThan(0)
      expect(preset.sourceRefs.every((reference) => reference >= 1 && reference <= 43)).toBe(true)
    }
  })

  it('keeps prediction questions answerable before reveal', () => {
    expect(mechanicsScenarios).toHaveLength(4)
    for (const scenario of mechanicsScenarios) {
      expect(scenario.choices).toHaveLength(3)
      expect(scenario.choices.some((choice) => choice.id === scenario.bestChoiceId)).toBe(true)
      expect(scenario.explanation.length).toBeGreaterThan(80)
      expect(scenario.sourceRefs.length).toBeGreaterThan(0)
    }
  })

  it('separates radial metrics, airway geometry, tissue pathways, and test design', () => {
    expect(forceTaxonomy.map((item) => item.term)).toEqual(
      expect.arrayContaining([
        'Chronic outward force (COF)',
        'Radial resistive force (RRF)',
        'Radial stiffness',
        'Apparent contact pressure',
        'Hysteresis',
      ]),
    )
    expect(airwayGeometryOptions.map((item) => item.id)).toEqual([
      'straight',
      'curved',
      'tapered',
      'asymmetric',
    ])
    expect(tissueMechanisms).toHaveLength(6)
    expect(benchDesignChecklist.length).toBeGreaterThanOrEqual(8)
  })

  it('preserves the sourced GINA-Dumon result and method context', () => {
    const migration = ginaDumonBenchData.find((row) => row.metric === 'Anti-migration force')
    expect(migration).toMatchObject({
      dumon: '12.83 ± 0.23 N',
      gina: '15.21 ± 0.59 N forward; 18.40 ± 0.51 N backward',
    })
    expect(migration?.method).toContain('16-mm-ID Teflon jig')
  })

  it('keeps selected references unique and evidence-typed', () => {
    expect(new Set(stentMechanicsReferences.map((reference) => reference.id)).size).toBe(
      stentMechanicsReferences.length,
    )
    expect(
      stentMechanicsReferences.some((reference) => reference.sourceType === 'peer-reviewed'),
    ).toBe(true)
    expect(
      stentMechanicsReferences.some((reference) => reference.sourceType === 'regulatory'),
    ).toBe(true)
    expect(stentMechanicsReferences.some((reference) => reference.sourceType === 'standard')).toBe(
      true,
    )
    expect(
      stentMechanicsReferences.some((reference) => reference.sourceType === 'manufacturer'),
    ).toBe(true)
  })
})
