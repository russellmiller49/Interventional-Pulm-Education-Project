import { baxterCrrtLearnLessons } from '../content/learnLessons'
import { baxterCrrtLessonClinicalAnchors } from '../content/lessonClinicalAnchors'
import {
  baxterCrrtLearnerFacingSourceById,
  crrtLearnerFacingSourceIds,
  isResolvableCrrtSourceId,
  resolveCrrtLearnerFacingSource,
  unresolvableCrrtSourceIds,
} from '../content/learnerSourceMap'
import { baxterCrrtSupplementalSourceReferences } from '../content/phase7ReviewSources'
import {
  baxterCrrtEngineSourceRecords,
  baxterCrrtPilotSourceReferences,
} from '../content/provenance'
import {
  crrtCircuitOverlays,
  crrtCitrateCalciumTerms,
  crrtPressureSignalDetails,
  unresolvedCrrtCircuitSourceIds,
} from '../content/circuitModel'

/**
 * Every id that reaches a learner as a citation, gathered from each authoring
 * surface. If a new surface starts citing sources it belongs in this list — that
 * is the point of collecting them in one place rather than testing per surface.
 */
function everyLearnerFacingCitation(): readonly string[] {
  const ids = new Set<string>()

  for (const lesson of baxterCrrtLearnLessons) {
    for (const id of lesson.sourceRecordIds) ids.add(id)
  }
  for (const anchor of Object.values(baxterCrrtLessonClinicalAnchors)) {
    for (const id of anchor.applicationItem.evidenceIds ?? []) ids.add(id)
  }
  for (const overlay of crrtCircuitOverlays) {
    for (const id of overlay.sourceIds) ids.add(id)
  }
  for (const detail of crrtPressureSignalDetails) {
    for (const id of detail.sourceIds) ids.add(id)
  }
  for (const term of crrtCitrateCalciumTerms) {
    for (const id of term.sourceIds) ids.add(id)
  }

  return [...ids].sort()
}

describe('CRRT learner-facing source map', () => {
  it('resolves every citation any learner-facing surface makes', () => {
    const citations = everyLearnerFacingCitation()

    expect(citations.length).toBeGreaterThan(20)
    // Named explicitly rather than counted, so a failure says which id is lost.
    expect(unresolvableCrrtSourceIds(citations)).toEqual([])
  })

  it('merges all three registries, not two', () => {
    // The defect this guards: MATH-PM-002 and FLUID-PM-002 live only in the
    // device-math registry, so a two-registry merge dropped them silently.
    for (const id of ['MATH-PM-002', 'FLUID-PM-002', 'MATH-PM-004', 'MATH-PM-006']) {
      expect(isResolvableCrrtSourceId(id)).toBe(true)
    }

    const known = new Set(crrtLearnerFacingSourceIds())
    for (const registry of [
      baxterCrrtPilotSourceReferences,
      baxterCrrtSupplementalSourceReferences,
      baxterCrrtEngineSourceRecords,
    ]) {
      for (const reference of registry) {
        expect(known).toContain(reference.id)
      }
    }
  })

  it('renders the TMP citation rather than dropping it', () => {
    const tmp = resolveCrrtLearnerFacingSource('MATH-PM-002')

    expect(tmp.id).toBe('MATH-PM-002')
    expect(tmp.sourceTitle.length).toBeGreaterThan(0)
    expect(tmp.pageOrSection.length).toBeGreaterThan(0)
    // The pressure view cites it, so it must survive the merge.
    const pressureOverlay = crrtCircuitOverlays.find((overlay) => overlay.id === 'pressure-profile')
    expect(pressureOverlay?.sourceIds).toContain('MATH-PM-002')
  })

  it('fails closed on an unknown id instead of returning nothing', () => {
    expect(() => resolveCrrtLearnerFacingSource('MATH-PM-999')).toThrow(
      /resolves in no registered source registry/i,
    )
    expect(isResolvableCrrtSourceId('MATH-PM-999')).toBe(false)
    expect(unresolvableCrrtSourceIds(['MATH-PM-002', 'MATH-PM-999', 'NOPE-1'])).toEqual([
      'MATH-PM-999',
      'NOPE-1',
    ])
  })

  it('proves an unknown id cannot silently disappear from a citation list', () => {
    // Simulates the old failure mode directly: a surface cites something the
    // registry does not carry. The detector must name it, not skip it.
    const withGhost = [...everyLearnerFacingCitation(), 'GHOST-SOURCE-001']

    expect(unresolvableCrrtSourceIds(withGhost)).toEqual(['GHOST-SOURCE-001'])
    expect(withGhost.filter((id) => isResolvableCrrtSourceId(id))).not.toContain('GHOST-SOURCE-001')
  })

  it('keeps one record per id, preferring the registry the module already rendered', () => {
    const ids = crrtLearnerFacingSourceIds()

    expect(new Set(ids).size).toBe(ids.length)
    // DEV-PM-010 appears in both the supplemental and device-math registries.
    // The supplemental record is the one the module has always shown.
    const supplemental = baxterCrrtSupplementalSourceReferences.find(
      (reference) => reference.id === 'DEV-PM-010',
    )
    expect(supplemental).toBeDefined()
    expect(baxterCrrtLearnerFacingSourceById.get('DEV-PM-010')).toBe(supplemental)
  })

  it('leaves the circuit with no unresolved citation at import', () => {
    expect(unresolvedCrrtCircuitSourceIds()).toEqual([])
  })
})
