import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

import { OpenFdaClient } from '../ip-preference-cards/openfda/client'
import {
  RECALL_NUMBER_PATTERN,
  statusOverlayArtifactSchema,
} from '../../src/features/device-intelligence/domain/status-overlay-schema'
import { safetyRecordLinksSchema } from '../../src/features/device-intelligence/domain/safety-notice-schema'

export const SAFETY_LINKS_PATH =
  'data/ip-device-intelligence/research/safety/fda-recall-record-links.json'
const ROOT = path.resolve(__dirname, '../..')
const recordSchema = z.object({
  product_res_number: z.string(),
  cfres_id: z.string().regex(/^\d+$/),
  res_event_number: z.string().regex(/^\d+$/),
})

/** Resolve only known recall numbers. This is citation acquisition, never a status refresh. */
export async function acquireSafetyRecordLinks(
  recallNumbers: string[],
  request: Pick<OpenFdaClient, 'request'>,
) {
  const records = []
  z.array(z.string().regex(RECALL_NUMBER_PATTERN)).parse(recallNumbers)
  for (const recallNumber of [...new Set(recallNumbers)].sort()) {
    const response = await request.request({
      search: `product_res_number:"${recallNumber}"`,
      limit: 2,
      refresh: true,
    })
    if (response.resultTotal !== 1 || response.records.length !== 1) {
      throw new Error(`${recallNumber}: expected one complete FDA record; previous links retained.`)
    }
    const record = recordSchema.parse(response.records[0])
    if (record.product_res_number !== recallNumber)
      throw new Error(`${recallNumber}: FDA identifier mismatch.`)
    records.push({
      recall_number: recallNumber,
      event_id: record.res_event_number,
      cfres_id: record.cfres_id,
      dataset_as_of: response.datasetLastUpdated,
      retrieved_at: response.retrievedAt,
      response_sha256: response.responseSha256,
    })
  }
  return safetyRecordLinksSchema.parse({
    format_version: 1,
    purpose: 'exact_recall_record_links_only',
    records,
  })
}

async function main() {
  if (!process.argv.includes('--refresh'))
    throw new Error(
      'Pass --refresh to resolve the known FDA recall links. This does not refresh safety status.',
    )
  const statusBytes = readFileSync(
    path.join(ROOT, 'data/ip-device-intelligence/generated/product-status-overlay.json'),
  )
  const statuses = statusOverlayArtifactSchema.parse(JSON.parse(statusBytes.toString()))
  const client = new OpenFdaClient({
    apiKey: '',
    endpoint: 'https://api.fda.gov/device/recall.json',
    cacheDir: path.join(ROOT, 'local-data/ip-device-intelligence/safety-record-links'),
    apiSchemaVersion: 'safety-record-links-v1',
    requestsPerSecond: 2,
    maxAttempts: 3,
  })
  const result = await acquireSafetyRecordLinks(
    statuses.rows.flatMap((row) => row.safety_reference_codes),
    client,
  )
  const target = path.join(ROOT, SAFETY_LINKS_PATH)
  mkdirSync(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`)
  renameSync(temporary, target)
  process.stdout.write(
    `Resolved ${result.records.length} exact recall links. Status snapshot unchanged (${createHash('sha256').update(statusBytes).digest('hex').slice(0, 12)}).\n`,
  )
}

if (require.main === module)
  main().catch((error) => {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  })
