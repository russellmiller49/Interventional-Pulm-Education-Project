/** @jest-environment node */

import {
  SOURCE_COMPLETE_PREFIX,
  SOURCE_IDENTITY_PREFIX,
  SOURCE_RECORD_PREFIX,
} from '../literature-production-ingest/source'
import { OVERLAY_EXPECTED_RECORD_COUNT, OVERLAY_NOTE_CORRECTIONS } from './constants'
import {
  OVERLAY_FORBIDDEN_PROJECTION_COLUMNS,
  buildCohortSql,
  collectCohort,
  summarizeCohort,
} from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'

describe('the cohort projection SQL', () => {
  const sql = buildCohortSql()

  it('selects the development cohort positively and only positively', () => {
    expect(sql).toContain("batch.name = 'gold-set-v1'")
    expect(sql).toContain("batch.kind = 'gold_standard'")
    expect(sql).toContain("item.dataset_split = 'development'")
    // The split literal appears exactly once: as the positive predicate.
    expect(sql.match(/dataset_split/gu)).toHaveLength(1)
  })

  it('contains no complement construct', () => {
    expect(sql).not.toMatch(/\bnot\s+in\b/iu)
    expect(sql).not.toMatch(/\bexcept\b/iu)
    expect(sql).not.toMatch(/dataset_split\s*(?:!=|<>)/iu)
    expect(sql).not.toMatch(/requested_size|test_percent/iu)
  })

  it('projects no forbidden column', () => {
    const projectionSection = sql.slice(0, sql.indexOf('from public.literature_gold_set_items'))
    for (const forbidden of OVERLAY_FORBIDDEN_PROJECTION_COLUMNS) {
      expect(projectionSection).not.toContain(`'${forbidden}'`)
    }
  })

  it('is a read-only transaction with the shared attestation frames and terminal rollback', () => {
    expect(sql).toContain('begin transaction isolation level repeatable read read only;')
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true)
    expect(sql).toContain(SOURCE_IDENTITY_PREFIX)
    expect(sql).toContain(SOURCE_RECORD_PREFIX)
    expect(sql).toContain(SOURCE_COMPLETE_PREFIX)
  })

  it('reaches the head only through the current-review pointer', () => {
    expect(sql).toContain('review.id = item.current_review_id')
  })
})

describe('collectCohort', () => {
  const validPayloads = () => buildFixtureTruth().cohortPayloads

  it('accepts exactly the expected cohort and summarizes it', () => {
    const rows = collectCohort(validPayloads())
    expect(rows).toHaveLength(OVERLAY_EXPECTED_RECORD_COUNT)
    const aggregates = summarizeCohort(rows)
    expect(aggregates.count).toBe(OVERLAY_EXPECTED_RECORD_COUNT)
    expect(aggregates.persistedHeadCount).toBe(9)
    expect(aggregates.pendingCount).toBe(621)
    expect(aggregates.correctionHeadRevisions).toEqual([2, 2])
  })

  it.each([
    ['629', (payloads: Array<Record<string, unknown>>) => payloads.slice(0, 629)],
    ['631', (payloads: Array<Record<string, unknown>>) => [...payloads, { ...payloads[0] }]],
    ['zero', () => []],
  ])('refuses a cohort of %s records', (_label, mutate) => {
    const payloads = mutate(validPayloads())
    expect(() => collectCohort(payloads)).toThrow(/exactly 630|duplicate/u)
  })

  it('refuses 730 records outright', () => {
    const payloads = validPayloads()
    const extra = Array.from({ length: 100 }, (_, index) => ({
      pmid: String(200000001 + index),
      reviewStatus: 'pending',
      hasHead: false,
      relevanceLabel: null,
      headRevision: null,
      revisionKind: 'standard',
      lifecycleState: 'effective',
    }))
    expect(() => collectCohort([...payloads, ...extra])).toThrow(/630/u)
  })

  it('refuses duplicate PMIDs without echoing them', () => {
    const payloads = validPayloads()
    const duplicated = [...payloads]
    duplicated[1] = { ...(duplicated[0] as Record<string, unknown>) }
    let message = ''
    try {
      collectCohort(duplicated)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('duplicate')
    expect(message).not.toMatch(/\d{6,}/u)
  })

  it('refuses an unknown relevance label, including uncertain', () => {
    for (const bad of ['uncertain', 'maybe', '']) {
      const payloads = validPayloads()
      const head = payloads.find((payload) => payload.reviewStatus === 'completed')
      ;(head as Record<string, unknown>).relevanceLabel = bad
      expect(() => collectCohort(payloads)).toThrow(/unknown relevance label/u)
    }
  })

  it('refuses an unstable review status', () => {
    for (const bad of ['in_progress', 'return_later', 'unknown']) {
      const payloads = validPayloads()
      ;(payloads[0] as Record<string, unknown>).reviewStatus = bad
      ;(payloads[0] as Record<string, unknown>).hasHead = false
      ;(payloads[0] as Record<string, unknown>).relevanceLabel = null
      ;(payloads[0] as Record<string, unknown>).headRevision = null
      expect(() => collectCohort(payloads)).toThrow(/unstable review status/u)
    }
  })

  it('refuses a non-effective or non-standard head', () => {
    const withdrawn = validPayloads()
    const head = withdrawn.find((payload) => payload.reviewStatus === 'completed')
    ;(head as Record<string, unknown>).lifecycleState = 'withdrawn'
    expect(() => collectCohort(withdrawn)).toThrow(/not effective/u)

    const imported = validPayloads()
    const head2 = imported.find((payload) => payload.reviewStatus === 'completed')
    ;(head2 as Record<string, unknown>).revisionKind = 'import'
    expect(() => collectCohort(imported)).toThrow(/not a standard physician revision/u)
  })

  it('refuses a pending item that carries head fields', () => {
    const payloads = validPayloads()
    const pending = payloads.find((payload) => payload.reviewStatus === 'pending')
    ;(pending as Record<string, unknown>).hasHead = true
    expect(() => collectCohort(payloads)).toThrow(/pending but carries persisted head fields/u)
  })

  it('refuses a forbidden cohort field wherever it appears', () => {
    for (const forbidden of ['dataset_split', 'notes', 'requested_size', 'sample_stratum']) {
      const payloads = validPayloads()
      ;(payloads[3] as Record<string, unknown>)[forbidden] = 'anything'
      expect(() => collectCohort(payloads)).toThrow(new RegExp(`"${forbidden}"`, 'u'))
    }
  })

  it('requires exactly nine persisted heads — a tenth head refuses', () => {
    const payloads = validPayloads()
    const pending = payloads.find((payload) => payload.reviewStatus === 'pending')
    ;(pending as Record<string, unknown>).reviewStatus = 'completed'
    ;(pending as Record<string, unknown>).hasHead = true
    ;(pending as Record<string, unknown>).relevanceLabel = 'include_core'
    ;(pending as Record<string, unknown>).headRevision = 1
    expect(() => collectCohort(payloads)).toThrow(/exactly 9 heads with 7 ordinary/u)
  })

  it('refuses an ordinary head above revision one', () => {
    const payloads = validPayloads()
    const ordinary = payloads.find(
      (payload) =>
        payload.reviewStatus === 'completed' &&
        !OVERLAY_NOTE_CORRECTIONS.some((c) => c.pmid === payload.pmid),
    )
    ;(ordinary as Record<string, unknown>).headRevision = 3
    expect(() => collectCohort(payloads)).toThrow(/not at revision one/u)
  })

  it('requires the two corrections at exactly their checksum-bound revisions', () => {
    const missing = validPayloads().filter(
      (payload) => payload.pmid !== OVERLAY_NOTE_CORRECTIONS[0].pmid,
    )
    missing.push({
      pmid: '200999999',
      reviewStatus: 'pending',
      hasHead: false,
      relevanceLabel: null,
      headRevision: null,
      revisionKind: 'standard',
      lifecycleState: 'effective',
    })
    expect(() => collectCohort(missing)).toThrow(/correction PMID is missing/u)

    const wrongRevision = validPayloads()
    const correction = wrongRevision.find(
      (payload) => payload.pmid === OVERLAY_NOTE_CORRECTIONS[0].pmid,
    )
    ;(correction as Record<string, unknown>).headRevision = 1
    expect(() => collectCohort(wrongRevision)).toThrow(/checksum-bound revision/u)
  })

  it('never echoes a PMID in a refusal', () => {
    const payloads = validPayloads()
    ;(payloads[0] as Record<string, unknown>).pmid = 'not-a-pmid'
    let message = ''
    try {
      collectCohort(payloads)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('was not a 1-12 digit numeric string')
    expect(message).not.toContain('not-a-pmid')
  })
})
