/** @jest-environment node */
import { buildAuditSample, journalFamilyOf } from './audit'
import type { RoutedRecord } from './routing'

function candidate(recordId: string, profile: RoutedRecord['evidenceProfile']): RoutedRecord {
  return {
    recordId,
    route: 'deprioritization_candidate',
    routeReasons: ['high_confidence_negative_with_negative_only_reasons_and_no_risk_flag'],
    terminalState: 'valid_prediction',
    evidenceProfile: profile,
    riskFlags: [],
    mandatoryPhysicianReview: false,
  }
}

function id(index: number): string {
  return index.toString(16).padStart(64, '0')
}

describe('journal families', () => {
  it('takes the first significant token', () => {
    expect(journalFamilyOf('The Journal of Synthetic Results')).toBe('synthetic')
    expect(journalFamilyOf('Chest')).toBe('chest')
    expect(journalFamilyOf(null)).toBe('(none)')
  })
})

describe('deterministic stratified audit sampling', () => {
  const candidates = Array.from({ length: 40 }, (_, index) =>
    candidate(id(index), index % 4 === 0 ? 'metadata_without_abstract' : 'metadata_with_abstract'),
  )
  const contexts = new Map(
    candidates.map((record, index) => [
      record.recordId,
      {
        journal: index % 2 === 0 ? 'Journal Alpha' : 'Journal Beta',
        publicationYear: index % 3 === 0 ? 1995 : 2021,
        primaryPublicationType: 'Journal Article',
      },
    ]),
  )
  const primaryReasonCodes = new Map(
    candidates.map((record) => [record.recordId, 'clearly_nonpulmonary_domain']),
  )

  it('samples the requested size proportionally across strata, deterministically', () => {
    const first = buildAuditSample({ candidates, contexts, sampleSize: 12, primaryReasonCodes })
    const second = buildAuditSample({ candidates, contexts, sampleSize: 12, primaryReasonCodes })
    expect(first.entries).toEqual(second.entries)
    expect(first.entries).toHaveLength(12)
    expect(first.poolSize).toBe(40)
    const sampledTotal = Object.values(first.strataCounts).reduce(
      (sum, entry) => sum + entry.sampled,
      0,
    )
    expect(sampledTotal).toBe(12)
    for (const entry of Object.values(first.strataCounts)) {
      expect(entry.sampled).toBeLessThanOrEqual(entry.pool)
    }
  })

  it('caps the sample at the pool size', () => {
    const sample = buildAuditSample({
      candidates,
      contexts,
      sampleSize: 500,
      primaryReasonCodes,
    })
    expect(sample.entries).toHaveLength(40)
  })

  it('refuses risk-flagged or advancing records: those are mandatory review, not samples', () => {
    const flagged: RoutedRecord = {
      ...candidate(id(99), 'metadata_with_abstract'),
      riskFlags: ['signal_pleural'],
    }
    expect(() =>
      buildAuditSample({
        candidates: [flagged],
        contexts: new Map([
          [
            flagged.recordId,
            { journal: null, publicationYear: null, primaryPublicationType: null },
          ],
        ]),
        sampleSize: 1,
        primaryReasonCodes: new Map(),
      }),
    ).toThrow(/mandatory-review/u)
    const advancing: RoutedRecord = {
      ...candidate(id(98), 'metadata_with_abstract'),
      route: 'advance_to_full_relevance_classification',
    }
    expect(() =>
      buildAuditSample({
        candidates: [advancing],
        contexts: new Map([
          [
            advancing.recordId,
            { journal: null, publicationYear: null, primaryPublicationType: null },
          ],
        ]),
        sampleSize: 1,
        primaryReasonCodes: new Map(),
      }),
    ).toThrow(/low-risk deprioritization candidates/u)
  })

  it('rejects invalid sample sizes and missing contexts', () => {
    expect(() =>
      buildAuditSample({ candidates, contexts, sampleSize: -1, primaryReasonCodes }),
    ).toThrow(/non-negative integer/u)
    expect(() =>
      buildAuditSample({
        candidates: [candidate(id(1), 'metadata_with_abstract')],
        contexts: new Map(),
        sampleSize: 1,
        primaryReasonCodes,
      }),
    ).toThrow(/no bibliographic context/u)
  })
})
