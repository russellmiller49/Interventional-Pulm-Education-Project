import {
  assertEvidenceRefsResolve,
  evidenceRegistry,
  findMissingEvidenceRefs,
  getEvidenceReference,
  resolveEvidenceReferences,
  validateEvidenceRefs,
} from '../content/evidenceRegistry'
import { forceLabMissions, guidedForceScenes, stentModuleCopy } from '../content/learningLabCopy'

function collectEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectEvidenceRefs)
  if (!value || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, nested]) => {
    if (key === 'evidenceRefs' && Array.isArray(nested)) {
      return nested.filter((item): item is string => typeof item === 'string')
    }
    return collectEvidenceRefs(nested)
  })
}

describe('airway stent learning-lab evidence registry', () => {
  it('uses unique stable string IDs and complete linked citations', () => {
    const ids = evidenceRegistry.map((reference) => reference.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(true)

    for (const reference of evidenceRegistry) {
      expect(reference.citation.length).toBeGreaterThan(40)
      expect(reference.url).toMatch(/^https:\/\//)
      expect(reference.claimScope).toMatch(
        /^(clinical-guideline|clinical-observational|clinical-trial|review-mechanistic|airway-bench|preclinical|transferred-engineering|regulatory-construction|manufacturer-construction)$/,
      )
      expect(reference.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(reference.clinicalReviewNote.length).toBeGreaterThan(40)
      expect(reference.transferLimitation.length).toBeGreaterThan(40)
    }
  })

  it('contains every required clinical, mechanics, regulatory, and official source', () => {
    expect(evidenceRegistry.map((reference) => reference.id)).toEqual(
      expect.arrayContaining([
        'chest-cao-guideline-2024',
        'wabip-malignant-stenting-2024',
        'wabip-benign-stenting-2025',
        'jung-gina-2021',
        'ratnovsky-airway-mechanics-2015',
        'fda-bonastent-k140472',
        'fda-ultraflex-k230269',
        'merit-aero-official',
        'ost-infection-granulation-2012',
        'hu-granulation-diameter-2011',
        'gupta-granulation-review-2025',
      ]),
    )
    expect(new Set(evidenceRegistry.map((reference) => reference.sourceType))).toEqual(
      new Set(['clinical-guideline', 'peer-reviewed', 'regulatory', 'manufacturer']),
    )
  })

  it('resolves every reference used anywhere in the module copy', () => {
    const refs = collectEvidenceRefs({ forceLabMissions, guidedForceScenes, stentModuleCopy })
    expect(refs.length).toBeGreaterThan(30)
    expect(validateEvidenceRefs(refs)).toEqual({ valid: true, missing: [] })
    expect(() => assertEvidenceRefsResolve(refs)).not.toThrow()
    expect(resolveEvidenceReferences(refs)).toHaveLength(refs.length)
  })

  it('reports unknown references deterministically', () => {
    expect(findMissingEvidenceRefs(['not-real', 'not-real', 'also-not-real'])).toEqual([
      'not-real',
      'also-not-real',
    ])
    expect(validateEvidenceRefs(['not-real'])).toEqual({
      valid: false,
      missing: ['not-real'],
    })
    expect(() => getEvidenceReference('not-real')).toThrow('Unknown airway-stent evidence')
    expect(() => assertEvidenceRefsResolve(['not-real'])).toThrow('not-real')
  })
})
