import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { OpenFdaClient } from '../../ip-preference-cards/openfda/client'
import { acquireD2DEvidence, normalizeAcquisitionCandidate } from '../d2d/acquire-evidence'
import { D2D_SNAPSHOT_DATE } from '../d2d/paths'
import { acquisitionManifestSchema, pilotCohortArtifactSchema } from '../d2d/schemas'

const REPO_ROOT = join(__dirname, '../../..')
const COHORT_PATH = join(REPO_ROOT, 'data/ip-device-intelligence/reviewed/d2d-pilot-cohort.json')
const ACQUISITION_PATH = join(
  REPO_ROOT,
  'data/ip-device-intelligence/research/d2d/2026-08-24/acquisition-manifest.json',
)

describe('D2D-A bounded evidence acquisition', () => {
  it('pins complete page-level provenance for exactly the frozen pilot queries', () => {
    const cohort = pilotCohortArtifactSchema.parse(JSON.parse(readFileSync(COHORT_PATH, 'utf8')))
    const manifest = acquisitionManifestSchema.parse(
      JSON.parse(readFileSync(ACQUISITION_PATH, 'utf8')),
    )
    const configuredQueryIds = cohort.products
      .flatMap((product) => product.acquisition_queries.map((query) => query.query_id))
      .sort()

    expect(manifest.snapshot_date).toBe(D2D_SNAPSHOT_DATE)
    expect(manifest.results.map((result) => result.query_id)).toEqual(configuredQueryIds)
    expect(manifest.results).toHaveLength(12)
    for (const result of manifest.results) {
      expect(result.complete).toBe(true)
      expect(result.response_content_type).toBe('application/json')
      expect(result.normalization_method_version).toBe('d2d-acquisition-candidate-normalization-v1')
      expect(result.pages.length).toBeGreaterThan(0)
      expect(result.response_sha256s).toEqual(
        [...new Set(result.pages.map((page) => page.response_sha256))].sort(),
      )
      expect(result.raw_cache_references).toEqual(
        [...new Set(result.pages.map((page) => page.raw_cache_reference))].sort(),
      )
      expect(result.http_statuses).toEqual(
        [...new Set(result.pages.map((page) => page.http_status))].sort(),
      )
      for (const page of result.pages) {
        expect(page.request_url).toMatch(/^https:\/\/api\.fda\.gov\/device\//)
        expect(page.request_url).not.toMatch(/api_key=/i)
        expect(page.request_skip % page.request_limit).toBe(0)
        expect(page.raw_cache_reference).toMatch(
          /^local-data\/ip-device-intelligence\/d2d\/2026-08-24\/openfda\//,
        )
      }
    }
  })

  it('normalizes only compact candidate fields and reads the openFDA product-code field', () => {
    const candidate = normalizeAcquisitionCandidate({
      record_key: 'RK-TEST',
      company_name: 'Example Manufacturer',
      version_or_model_number: '0001-A',
      openfda: { product_code: ['GEH'], device_name: ['Not a product code'] },
      device_description: 'Fixture device',
    })
    expect(candidate).toMatchObject({
      record_key: 'RK-TEST',
      company_name: 'Example Manufacturer',
      model_number: '0001-A',
      product_code: 'GEH',
    })
    expect(Object.keys(candidate).sort()).toEqual(
      [
        'brand_name',
        'catalog_number',
        'commercial_distribution_status',
        'company_name',
        'decision_code',
        'decision_date',
        'device_name',
        'k_number',
        'model_number',
        'package_dis',
        'pma_number',
        'primary_di',
        'product_code',
        'publish_date',
        'record_key',
        'regulation_number',
      ].sort(),
    )
  })

  it('is fixture-injectable and performs no live fetch when a client is supplied', async () => {
    const cohortBytes = readFileSync(COHORT_PATH)
    const cohort = pilotCohortArtifactSchema.parse(JSON.parse(cohortBytes.toString('utf8')))
    let requests = 0
    const artifact = await acquireD2DEvidence({
      cohort,
      cohortBytes,
      clientFactory: (dataset) =>
        ({
          request: async ({
            search,
            limit,
            skip = 0,
          }: {
            search: string
            limit: number
            skip?: number
          }) => {
            requests += 1
            const cacheHash = String(requests).padStart(64, '0')
            return {
              records: [],
              datasetLastUpdated: '2026-08-03',
              resultTotal: 0,
              retrievedAt: '2026-08-24T00:00:00.000Z',
              fromCache: true,
              httpStatus: 404,
              attemptCount: 1,
              apiRequestsMade: 0,
              retryCount: 0,
              requestUrl: `https://api.fda.gov/device/${dataset}.json?search=${encodeURIComponent(search)}&limit=${limit}&skip=${skip}`,
              requestSearch: search,
              requestLimit: limit,
              requestSkip: skip,
              responseSha256: 'a'.repeat(64),
              rawCacheReference: `local-data/ip-device-intelligence/d2d/2026-08-24/openfda/${dataset}/${cacheHash}.json`,
            }
          },
        }) as unknown as OpenFdaClient,
    })
    expect(requests).toBe(12)
    expect(artifact.results).toHaveLength(12)
    expect(artifact.results.every((result) => result.http_statuses[0] === 404)).toBe(true)
  })

  it('cannot address D2B/D2E safety sources and keeps raw cache ignored', () => {
    const source = readFileSync(
      join(REPO_ROOT, 'scripts/ip-device-intelligence/d2d/acquire-evidence.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/device\/(?:enforcement|event|recall)\.json/i)
    expect(source).not.toMatch(/adverse[_-]?event/i)
    expect(source).toMatch(/if \(existsSync\(target\)\)/)

    const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/^\/local-data\/$/m)
  })
})
