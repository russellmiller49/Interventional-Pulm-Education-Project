import { criticalCareConceptById } from '@/features/critical-care/content/concepts'
import { criticalCareEvidenceById } from '@/features/critical-care/content/evidenceRegistry'

import {
  HEMODYNAMIC_CLINICAL_THRESHOLDS,
  hemodynamicDerivedValueGuides,
  hemodynamicDerivedValueIds,
} from '../content'
import { calculateDerivedHemodynamics } from '../engine'

describe('hemodynamics content-engine consistency', () => {
  it('pairs every displayed derived value with interpretation, evidence, and concepts', () => {
    const calculated = calculateDerivedHemodynamics({
      measurements: {},
      inputsStale: true,
    })

    expect(Object.keys(hemodynamicDerivedValueGuides).sort()).toEqual(
      [...hemodynamicDerivedValueIds].sort(),
    )
    expect(Object.keys(calculated).sort()).toEqual([...hemodynamicDerivedValueIds].sort())

    for (const id of hemodynamicDerivedValueIds) {
      const guide = hemodynamicDerivedValueGuides[id]
      expect(guide.normalRange.length).toBeGreaterThan(20)
      expect(guide.caveats.length).toBeGreaterThan(20)
      expect(guide.evidenceIds.length).toBeGreaterThan(0)
      expect(guide.conceptIds.length).toBeGreaterThan(0)
      expect(
        guide.evidenceIds.every((evidenceId) => criticalCareEvidenceById.has(evidenceId)),
      ).toBe(true)
      expect(guide.conceptIds.every((conceptId) => criticalCareConceptById.has(conceptId))).toBe(
        true,
      )
    }
  })

  it('keeps pulmonary-hypertension classification boundaries in one constants object', () => {
    expect(HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension).toEqual({
      meanPapMmHg: 20,
      preCapillaryPawpMaxMmHg: 15,
      elevatedPvrWoodUnits: 2,
    })
  })
})
