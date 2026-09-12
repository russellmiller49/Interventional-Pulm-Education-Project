import { createHash, randomUUID } from 'node:crypto'
import { existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { OpenFdaClient } from '../ip-preference-cards/openfda/client'
import { DAILY_REVIEW_PATH, writeDailyReferenceReview } from './build-daily-reference-review'

const ROOT = path.resolve(__dirname, '../..')
export const dailyAcquisitionSchema = z
  .object({
    format_version: z.literal(1),
    purpose: z.literal('identity_candidates_only_no_runtime_publication'),
    batch_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    products: z
      .array(
        z
          .object({
            product_id: z.string(),
            review_status: z.literal('pending_clinical_owner_review'),
            query_status: z.enum([
              'complete',
              'bounded',
              'unknown_completeness',
              'failed',
              'not_searched',
            ]),
            query: z.string().nullable(),
            retrieved_at: z.string().nullable(),
            dataset_as_of: z.string().nullable(),
            response_sha256: z.string().nullable(),
            result_total: z.number().nullable(),
            returned_count: z.number(),
            candidates: z.array(
              z
                .object({
                  primary_di: z.string().nullable(),
                  company_name: z.string().nullable(),
                  brand_name: z.string().nullable(),
                  catalog_number: z.string().nullable(),
                  model_number: z.string().nullable(),
                  device_record_version_date: z.string().nullable(),
                  source_url: z.string().url().nullable(),
                  exact_catalog_or_model_string: z.literal(true),
                  manufacturer_match: z.literal('not_adjudicated'),
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .length(50),
  })
  .strict()

export function dailyIdentityQuery(catalogNumber: string | null): string | null {
  // No operators or meaningful suffix/leading-zero normalization enter this query builder.
  if (!catalogNumber || !/^[\p{L}\p{N} ._()/+-]{2,80}$/u.test(catalogNumber)) return null
  return `catalog_number.exact:"${catalogNumber}" OR version_or_model_number.exact:"${catalogNumber}"`
}

const normalize = (value: string) => value.normalize('NFKC').trim().toUpperCase()
const string = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

export async function acquireDailyIdentityEvidence(
  products: { product_id: string; catalog_number: string | null }[],
  client: Pick<OpenFdaClient, 'request'>,
) {
  const rows: z.infer<typeof dailyAcquisitionSchema>['products'] = []
  for (const product of products) {
    const query = dailyIdentityQuery(product.catalog_number)
    const row: z.infer<typeof dailyAcquisitionSchema>['products'][number] = {
      product_id: product.product_id,
      review_status: 'pending_clinical_owner_review',
      query_status: 'not_searched',
      query,
      retrieved_at: null,
      dataset_as_of: null,
      response_sha256: null,
      result_total: null,
      returned_count: 0,
      candidates: [],
    }
    if (query) {
      try {
        const response = await client.request({ search: query, limit: 25 })
        row.query_status =
          response.resultTotal === null
            ? 'unknown_completeness'
            : response.resultTotal > response.records.length
              ? 'bounded'
              : 'complete'
        row.retrieved_at = response.retrievedAt
        row.dataset_as_of = response.datasetLastUpdated
        row.response_sha256 = response.responseSha256
        row.result_total = response.resultTotal
        row.returned_count = response.records.length
        row.candidates = response.records
          .filter((record) =>
            [record.catalog_number, record.version_or_model_number].some(
              (value) =>
                typeof value === 'string' &&
                normalize(value) === normalize(product.catalog_number!),
            ),
          )
          .map((record) => {
            const identifiers = Array.isArray(record.identifiers) ? record.identifiers : []
            const primary = identifiers.find(
              (identifier) => String(identifier.type).toLowerCase() === 'primary',
            )
            const di = string(primary?.id)
            return {
              primary_di: di,
              company_name: string(record.company_name),
              brand_name: string(record.brand_name),
              catalog_number: string(record.catalog_number),
              model_number: string(record.version_or_model_number),
              device_record_version_date: string(record.public_version_date),
              source_url: di
                ? `https://accessgudid.nlm.nih.gov/devices/${encodeURIComponent(di)}`
                : null,
              exact_catalog_or_model_string: true as const,
              manufacturer_match: 'not_adjudicated' as const,
            }
          })
      } catch {
        row.query_status = 'failed'
      }
    }
    rows.push(row)
  }
  return rows
}

/** Publish a complete snapshot atomically and refuse replacement even under concurrent runs. */
export function writeImmutableSnapshot(destination: string, artifact: unknown) {
  mkdirSync(path.dirname(destination), { recursive: true })
  const temp = `${destination}.${randomUUID()}.tmp`
  writeFileSync(temp, `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' })
  try {
    // A hard link fails with EEXIST if another acquisition published this snapshot first.
    linkSync(temp, destination)
  } finally {
    unlinkSync(temp)
  }
}

async function main() {
  const snapshot = process.argv[process.argv.indexOf('--snapshot') + 1]
  if (!process.argv.includes('--snapshot') || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot))
    throw new Error('Pass --snapshot YYYY-MM-DD for a new immutable acquisition')
  if (new Date(`${snapshot}T00:00:00Z`).toISOString().slice(0, 10) !== snapshot)
    throw new Error('Invalid snapshot date')
  const destination = path.join(
    ROOT,
    `docs/ip-device-intelligence/daily-reference-review/udi-candidates-${snapshot}.json`,
  )
  if (existsSync(destination))
    throw new Error(
      'Snapshot already exists; choose a new snapshot rather than overwriting evidence',
    )
  const batch = writeDailyReferenceReview(true)
  const client = new OpenFdaClient({
    apiKey: '',
    cacheDir: path.join(ROOT, `local-data/ip-device-intelligence/daily-reference/${snapshot}`),
    endpoint: 'https://api.fda.gov/device/udi.json',
    requestsPerSecond: 2,
    maxAttempts: 3,
    timeoutMs: 15_000,
  })
  const artifact = dailyAcquisitionSchema.parse({
    format_version: 1,
    purpose: 'identity_candidates_only_no_runtime_publication',
    snapshot,
    batch_sha256: createHash('sha256')
      .update(readFileSync(path.join(ROOT, DAILY_REVIEW_PATH)))
      .digest('hex'),
    products: await acquireDailyIdentityEvidence(batch.products, client),
  })
  writeImmutableSnapshot(destination, artifact)
  console.log(
    JSON.stringify({
      snapshot,
      products: artifact.products.length,
      productsWithCandidates: artifact.products.filter((row) => row.candidates.length).length,
      queryStates: Object.fromEntries(
        ['complete', 'bounded', 'unknown_completeness', 'failed', 'not_searched'].map((state) => [
          state,
          artifact.products.filter((row) => row.query_status === state).length,
        ]),
      ),
      publication: 'Pending owner review; no runtime evidence changed',
    }),
  )
}

if (require.main === module)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Acquisition failed')
    process.exitCode = 1
  })
