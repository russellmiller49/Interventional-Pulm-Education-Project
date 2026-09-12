/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildSafetyEvidence,
  generateSafetyEvidence,
  SAFETY_EVIDENCE_PATH,
} from '../build-safety-evidence'
import { acquireSafetyRecordLinks, SAFETY_LINKS_PATH } from '../acquire-safety-record-links'
import type { OpenFdaClientResult } from '../../ip-preference-cards/openfda/client'
import { usStatusEvidenceArtifactSchema } from '../../ip-preference-cards/us-status/proposal-schemas'
import { statusOverlayArtifactSchema } from '../../../src/features/device-intelligence/domain/status-overlay-schema'
import { safetyRecordLinksSchema } from '../../../src/features/device-intelligence/domain/safety-notice-schema'

const root = path.resolve(__dirname, '../../..')
const read = (file: string) => JSON.parse(readFileSync(path.join(root, file), 'utf8'))
const research = usStatusEvidenceArtifactSchema.parse(
  read('data/ip-preference-cards/research/us-status/2026-08-13/us-status-evidence-proposals.json'),
)
const statuses = statusOverlayArtifactSchema.parse(
  read('data/ip-device-intelligence/generated/product-status-overlay.json'),
)
const links = safetyRecordLinksSchema.parse(read(SAFETY_LINKS_PATH))

describe('compact safety evidence generation', () => {
  it('reproduces the committed artifact and includes every cited exact notice', () => {
    expect(generateSafetyEvidence(root)).toBe(
      readFileSync(path.join(root, SAFETY_EVIDENCE_PATH), 'utf8'),
    )
    const rows = buildSafetyEvidence(research, statuses, links)
    expect(rows).toHaveLength(578)
    for (const status of statuses.rows) {
      const row = rows.find((row) => row.product_id === status.product_id)!
      for (const recall of status.safety_reference_codes) {
        const notice = row.notices.find((notice) => notice.recall_number === recall)
        expect(notice?.official_record_url).toMatch(/res\.cfm\?id=\d+$/)
      }
    }
    expect(
      new Set(rows.flatMap((row) => row.notices.map((notice) => notice.recall_number))).size,
    ).toBe(28)
    expect(JSON.stringify(rows)).not.toMatch(
      /code_info|raw_cache|exact_query|factual_summary|source_ids|request_search/,
    )
  })

  it('fails a recall/event identity conflict instead of attaching the wrong instructions', () => {
    const corrupt = {
      ...links,
      records: links.records.map((link) => ({ ...link, event_id: '99999999' })),
    }
    expect(() => buildSafetyEvidence(research, statuses, corrupt)).toThrow(
      'Recall/event identity conflict',
    )
  })

  it('preserves a known notice during a failed search and never promotes family records', () => {
    const one = structuredClone(research)
    const product = one.products.find(
      (product) => product.canonical_identity.product_id === 'PRD-05670F1B5F',
    )!
    product.layer_results.safety_action.search_status = 'query_error'
    const row = buildSafetyEvidence(one, statuses, links).find(
      (row) => row.product_id === 'PRD-05670F1B5F',
    )!
    expect(row.search_status).toBe('query_error')
    expect(row.notices.map((notice) => notice.recall_number)).toEqual(['Z-1568-2026'])
    expect(
      product.layer_results.safety_action.records.some(
        (record) => record.match_scope === 'family_or_proprietary_name',
      ),
    ).toBe(true)
  })
})

describe('FDA record-link acquisition', () => {
  const response: OpenFdaClientResult = {
    records: [{ product_res_number: 'Z-1568-2026', cfres_id: '218710', res_event_number: '98429' }],
    resultTotal: 1,
    datasetLastUpdated: '2026-09-02',
    retrievedAt: '2026-09-11T12:00:00.000Z',
    responseSha256: 'a'.repeat(64),
    fromCache: false,
    httpStatus: 200,
    attemptCount: 1,
    apiRequestsMade: 1,
    retryCount: 0,
    requestUrl: '',
    requestSearch: '',
    requestLimit: 2,
    requestSkip: 0,
    rawCacheReference: '',
  }

  it('keeps only record identifiers and provenance, deduplicating requests', async () => {
    const request = jest.fn().mockResolvedValue(response)
    const result = await acquireSafetyRecordLinks(['Z-1568-2026', 'Z-1568-2026'], { request })
    expect(request).toHaveBeenCalledTimes(1)
    expect(result.records[0].cfres_id).toBe('218710')
    expect(result).not.toHaveProperty('recall_status')
  })

  it.each([
    { ...response, resultTotal: 2 },
    { ...response, records: [], resultTotal: 0, httpStatus: 404 },
    { ...response, records: [{ ...response.records[0], product_res_number: 'Z-1567-2026' }] },
  ])('rejects missing, ambiguous, or mismatched FDA results', async (result) => {
    await expect(
      acquireSafetyRecordLinks(['Z-1568-2026'], { request: jest.fn().mockResolvedValue(result) }),
    ).rejects.toThrow()
  })

  it('does not convert an API failure into an empty published receipt', async () => {
    await expect(
      acquireSafetyRecordLinks(['Z-1568-2026'], {
        request: jest.fn().mockRejectedValue(new Error('HTTP 503')),
      }),
    ).rejects.toThrow('HTTP 503')
  })
})
