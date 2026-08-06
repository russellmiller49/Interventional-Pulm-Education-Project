/**
 * Evidence-ID resolution and claim support are different questions.
 *
 * The C0/C1 citrate first-use terms were the case that made the difference concrete. All seven
 * cited `REVIEW-CKRT-CORE-2025`, `TEXT-CRRT-NEYRA-2026`, and `GUID-RRT-ICU-2026`; all three ids
 * resolved; the syntactic closure check passed; and the circuit printed all three under each
 * definition as "Sources:". It was still wrong, because those records' registered claims are about
 * transport mechanisms, modality concepts, treatment goals, delivered therapy, access,
 * fluid-removal tolerance, and the prescribed-versus-delivered gap — never about where citrate
 * enters a circuit, what it binds, or which sample describes which compartment.
 *
 * This suite pins the separation, so a citation cannot become "supported" merely by existing.
 */
import {
  crrtCitrateCalciumTerms,
  crrtCitrateSourceGapTermIds,
  unresolvedCrrtCircuitSourceIds,
  unsupportedCrrtCitrateTermCitations,
} from '../content/circuitModel'
import {
  CRRT_CLAIM_TOPICS,
  crrtSourceSupportsClaim,
  crrtSourcesSupportingClaim,
  isResolvableCrrtSourceId,
  resolveCrrtLearnerFacingSource,
  unresolvableCrrtSourceIds,
  unsupportedCrrtClaimCitations,
} from '../content/learnerSourceMap'

const CLINICAL_CONTEXT_IDS = [
  'REVIEW-CKRT-CORE-2025',
  'TEXT-CRRT-NEYRA-2026',
  'GUID-RRT-ICU-2026',
] as const

describe('an evidence ID that resolves is not thereby a supporting ID', () => {
  it('resolves all three clinical-context records', () => {
    for (const id of CLINICAL_CONTEXT_IDS) {
      expect(isResolvableCrrtSourceId(id)).toBe(true)
      expect(resolveCrrtLearnerFacingSource(id).claim.length).toBeGreaterThan(0)
    }
    expect(unresolvableCrrtSourceIds(CLINICAL_CONTEXT_IDS)).toEqual([])
  })

  it('still refuses them as support for circuit topology or citrate pharmacology', () => {
    for (const id of CLINICAL_CONTEXT_IDS) {
      expect(crrtSourceSupportsClaim(id, 'circuit-topology')).toBe(false)
      expect(crrtSourceSupportsClaim(id, 'citrate-pharmacology')).toBe(false)
    }
  })

  it('accepts them only for the topics their own registered claim names', () => {
    expect(crrtSourceSupportsClaim('REVIEW-CKRT-CORE-2025', 'solute-transport-mechanisms')).toBe(
      true,
    )
    expect(crrtSourceSupportsClaim('TEXT-CRRT-NEYRA-2026', 'fluid-removal-tolerance')).toBe(true)
    expect(crrtSourceSupportsClaim('GUID-RRT-ICU-2026', 'prescribed-versus-delivered')).toBe(true)

    // And not for each other's topics.
    expect(crrtSourceSupportsClaim('REVIEW-CKRT-CORE-2025', 'prescribed-versus-delivered')).toBe(
      false,
    )
    expect(crrtSourceSupportsClaim('GUID-RRT-ICU-2026', 'solute-transport-mechanisms')).toBe(false)
  })

  it('supports nothing for an id that is not in the audited map', () => {
    // Resolves, but has never been audited into the claim map, so it supports nothing.
    expect(isResolvableCrrtSourceId('DEV-PM-009')).toBe(true)
    for (const topic of CRRT_CLAIM_TOPICS) {
      expect(crrtSourceSupportsClaim('DEV-PM-009', topic)).toBe(false)
    }
    // And an id that resolves nowhere supports nothing either.
    expect(isResolvableCrrtSourceId('SYNTH-LAB-CITRATE-999')).toBe(false)
    expect(crrtSourceSupportsClaim('SYNTH-LAB-CITRATE-999', 'circuit-topology')).toBe(false)
  })

  it('reports the citation that resolves but does not support, rather than passing it', () => {
    const unsupported = unsupportedCrrtClaimCitations([
      { label: 'audit fixture', sourceId: 'REVIEW-CKRT-CORE-2025', topic: 'circuit-topology' },
      { label: 'audit fixture', sourceId: 'SYNTH-LAB-CITRATE-001', topic: 'circuit-topology' },
    ])
    expect(unsupported.map((citation) => citation.sourceId)).toEqual(['REVIEW-CKRT-CORE-2025'])
  })

  it('leaves citrate pharmacology unmapped, so no record can be pressed into supporting it', () => {
    expect(CRRT_CLAIM_TOPICS).toContain('citrate-pharmacology')
    expect(crrtSourcesSupportingClaim('citrate-pharmacology')).toEqual([])
  })
})

describe('the seven citrate first-use terms', () => {
  it('presents none of the three clinical-context records as support for any definition', () => {
    for (const term of crrtCitrateCalciumTerms) {
      for (const id of CLINICAL_CONTEXT_IDS) {
        expect(term.claimSupport.supportingSourceIds).not.toContain(id)
      }
    }
  })

  it('classifies every term as authored topology or a declared source gap', () => {
    expect(crrtCitrateCalciumTerms).toHaveLength(7)

    const byKind = crrtCitrateCalciumTerms.reduce<Record<string, string[]>>((acc, term) => {
      ;(acc[term.claimSupport.kind] ??= []).push(term.id)
      return acc
    }, {})

    expect(byKind['module-authored-topology']).toEqual([
      'citrate-entry-point',
      'circuit-sample',
      'systemic-sample',
      'calcium-replacement',
      'blood-returns-to-patient',
    ])
    // The two statements that need a pharmacology claim the registered set does not carry.
    expect(byKind['registered-source-gap']).toEqual([
      'circuit-anticoagulation',
      'citrate-calcium-in-effluent',
    ])
    expect(crrtCitrateSourceGapTermIds()).toEqual(byKind['registered-source-gap'])
  })

  it('grounds every topology term on circuit parts a reviewer can actually find', () => {
    for (const term of crrtCitrateCalciumTerms) {
      if (term.claimSupport.kind !== 'module-authored-topology') continue
      expect(term.claimSupport.requiredTopic).toBe('circuit-topology')
      expect(term.claimSupport.supportingSourceIds).toEqual(['SYNTH-LAB-CITRATE-001'])
      expect(
        term.claimSupport.readOffNodeIds.length + term.claimSupport.readOffPathIds.length,
      ).toBeGreaterThan(0)
      expect(term.claimSupport.basis).toMatch(/circuit drawing/i)
    }
  })

  it('names no supporting record for a gap term, and says why in words', () => {
    for (const term of crrtCitrateCalciumTerms) {
      if (term.claimSupport.kind !== 'registered-source-gap') continue
      expect(term.claimSupport.requiredTopic).toBe('citrate-pharmacology')
      expect(term.claimSupport.supportingSourceIds).toEqual([])
      expect(term.claimSupport.readOffNodeIds).toEqual([])
      expect(term.claimSupport.readOffPathIds).toEqual([])
      expect(term.claimSupport.basis).toMatch(/No source registered for this module supports/i)
      // The gap is declared, not closed: nothing here invents the missing mechanism.
      expect(term.claimSupport.basis).toMatch(/needs a source an expert adds/i)
    }
  })

  it('keeps both closures green, and keeps them different checks', () => {
    // Syntactic: every id that is presented resolves.
    expect(unresolvedCrrtCircuitSourceIds()).toEqual([])
    // Semantic: every id that is presented also supports what it is attached to.
    expect(unsupportedCrrtCitrateTermCitations()).toEqual([])
    // They are not the same check: the old citations would pass the first and fail the second.
    expect(unresolvableCrrtSourceIds(CLINICAL_CONTEXT_IDS)).toEqual([])
    expect(
      unsupportedCrrtClaimCitations(
        CLINICAL_CONTEXT_IDS.map((sourceId) => ({
          label: 'the citation this closeout removed',
          sourceId,
          topic: 'circuit-topology' as const,
        })),
      ),
    ).toHaveLength(CLINICAL_CONTEXT_IDS.length)
  })
})
