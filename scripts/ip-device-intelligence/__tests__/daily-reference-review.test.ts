/** @jest-environment node */
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acquireDailyIdentityEvidence,
  dailyAcquisitionSchema,
  dailyIdentityQuery,
  writeImmutableSnapshot,
} from '../acquire-daily-reference-evidence'
import {
  buildDailyReferenceReview,
  DAILY_REVIEW_PATH,
  writeDailyReferenceReview,
} from '../build-daily-reference-review'

describe('Daily reference evidence review batch', () => {
  it('publishes a complete snapshot once and rejects replacement without leaving temporary files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'device-evidence-'))
    try {
      const destination = join(directory, 'snapshot.json')
      writeImmutableSnapshot(destination, { receipt: 'first' })
      expect(() => writeImmutableSnapshot(destination, { receipt: 'second' })).toThrow()
      expect(JSON.parse(readFileSync(destination, 'utf8'))).toEqual({ receipt: 'first' })
      expect(readdirSync(directory)).toEqual(['snapshot.json'])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
  it('reproduces 50 cohort rows, with every recorded active-notice product first and no implicit approvals', () => {
    const batch = buildDailyReferenceReview()
    expect(batch.products).toHaveLength(50)
    expect(new Set(batch.products.map((row) => row.product_id)).size).toBe(50)
    expect(batch.products.slice(0, 23).every((row) => row.priority === 0)).toBe(true)
    expect(
      batch.products.every((row) => row.review_status === 'pending_clinical_owner_review'),
    ).toBe(true)
    expect(batch.procedures).toHaveLength(3)
    expect(() => writeDailyReferenceReview(true)).not.toThrow()
  })
  it('pins the committed acquisition to the exact review batch and preserves unresolved identities', () => {
    const acquisition = dailyAcquisitionSchema.parse(
      JSON.parse(
        readFileSync(
          'docs/ip-device-intelligence/daily-reference-review/udi-candidates-2026-09-12.json',
          'utf8',
        ),
      ),
    )
    expect(acquisition.batch_sha256).toBe(
      createHash('sha256').update(readFileSync(DAILY_REVIEW_PATH)).digest('hex'),
    )
    expect(acquisition.products.filter((row) => row.candidates.length)).toHaveLength(33)
    expect(
      acquisition.products.every((row) => row.review_status === 'pending_clinical_owner_review'),
    ).toBe(true)
    expect(
      acquisition.products
        .flatMap((row) => row.candidates)
        .every((row) => row.manufacturer_match === 'not_adjudicated'),
    ).toBe(true)
  })
  it('preserves leading zeros and configuration suffixes and prevents query injection', () => {
    expect(dailyIdentityQuery('0012-O')).toContain('"0012-O"')
    expect(dailyIdentityQuery('0012-F')).not.toBe(dailyIdentityQuery('0012-O'))
    expect(dailyIdentityQuery('123" OR *')).toBeNull()
  })
  it('retains completeness and manufacturer uncertainty, excludes non-exact and package DI fallback', async () => {
    const rows = await acquireDailyIdentityEvidence(
      [{ product_id: 'PRD-EXAMPLE', catalog_number: '0012-O' }],
      {
        request: jest.fn().mockResolvedValue({
          records: [
            {
              catalog_number: '0012-O',
              company_name: 'Other manufacturer',
              identifiers: [{ type: 'Package', id: '111' }],
            },
            { catalog_number: '12-O' },
            { catalog_number: '0012-F' },
          ],
          resultTotal: 40,
          retrievedAt: '2026-09-12T00:00:00Z',
          datasetLastUpdated: '2026-09-01',
          responseSha256: 'a'.repeat(64),
        }),
      },
    )
    expect(rows[0].query_status).toBe('bounded')
    expect(rows[0].candidates).toHaveLength(1)
    expect(rows[0].candidates[0]).toMatchObject({
      primary_di: null,
      source_url: null,
      manufacturer_match: 'not_adjudicated',
    })
  })
  it('records failed requests without claiming an absence of FDA records', async () => {
    const rows = await acquireDailyIdentityEvidence(
      [{ product_id: 'PRD-EXAMPLE', catalog_number: '0012-O' }],
      { request: jest.fn().mockRejectedValue(new Error('503')) },
    )
    expect(rows[0]).toMatchObject({
      query_status: 'failed',
      dataset_as_of: null,
      response_sha256: null,
      candidates: [],
      review_status: 'pending_clinical_owner_review',
    })
  })
})
