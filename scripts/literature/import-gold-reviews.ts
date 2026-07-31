import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import {
  parseLiteratureGoldReviewImportCsv,
  type LiteratureGoldReviewImportDecision,
} from '@/features/literature/gold-set/import'
import type { LiteratureGoldReviewPayload } from '@/features/literature/gold-set/types'
import {
  literatureGoldCompleteReviewSchema,
  literatureGoldReviewPayloadSchema,
} from '@/features/literature/schemas/gold-set'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { executeDatabaseCall, resolveLiteratureWriteMode } from './lib/database'

const HELP = `
Validate and restore offline gold-set decisions. Existing identical decisions are skipped;
changed completed decisions become a new immutable revision.

Usage:
  npm run literature:import-gold-reviews -- --input pilot-v1-all.csv --batch pilot-v1
  npm run literature:import-gold-reviews -- --input pilot-v1-all.csv --batch pilot-v1 --commit --target local

Options:
  --input <path>        Required JSON or CSV gold-set export.
  --batch <id-or-name>  Batch UUID or name. Optional when the export identifies one.
  --dry-run             Validate only (default).
  --commit              Save drafts and completed decisions.
  --target <value>      local (default) or remote.
  --confirm-remote      Additional required acknowledgement for remote writes.
  --help                Show this help.
`.trim()

function parseJsonExport(input: string): {
  batchId: string | null
  decisions: LiteratureGoldReviewImportDecision[]
} {
  const value = JSON.parse(input) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON import must contain a gold-set export object.')
  }
  const exported = value as Record<string, unknown>
  const batch =
    exported.batch && typeof exported.batch === 'object' && !Array.isArray(exported.batch)
      ? (exported.batch as Record<string, unknown>)
      : null
  if (!Array.isArray(exported.records)) {
    throw new Error('JSON import is missing the records array.')
  }
  const decisions = exported.records.flatMap((record): LiteratureGoldReviewImportDecision[] => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return []
    const row = record as Record<string, unknown>
    if (!row.review || typeof row.review !== 'object' || Array.isArray(row.review)) return []
    const source = row.reviewSource === 'draft' ? 'draft' : 'completed'
    const parsed =
      source === 'completed'
        ? literatureGoldCompleteReviewSchema.parse(row.review)
        : literatureGoldReviewPayloadSchema.parse(row.review)
    const review = row.review as Record<string, unknown>
    return [
      {
        batchId: typeof batch?.id === 'string' ? batch.id : null,
        itemId: String(row.itemId ?? ''),
        pmid: String(row.pmid ?? ''),
        reviewSource: source,
        sourceReviewId: typeof review.id === 'string' ? review.id : null,
        review: parsed,
      },
    ]
  })
  return {
    batchId: typeof batch?.id === 'string' ? batch.id : null,
    decisions,
  }
}

function comparableReview(review: LiteratureGoldReviewPayload) {
  return JSON.stringify({
    ...review,
    topicIds: [...review.topicIds].sort(),
    technologyTags: [...review.technologyTags].sort(),
    clinicalPurposes: [...review.clinicalPurposes].sort(),
    diseaseTags: [...review.diseaseTags].sort(),
  })
}

function databaseReview(row: Record<string, unknown>): LiteratureGoldReviewPayload {
  return literatureGoldReviewPayloadSchema.parse({
    relevanceLabel: row.relevance_label,
    metadataSufficiency: row.metadata_sufficiency,
    reviewerConfidence: row.reviewer_confidence,
    topicIds: row.topic_ids,
    technologyTags: row.technology_tags,
    clinicalPurposes: row.clinical_purposes,
    diseaseTags: row.disease_tags,
    studyDesign: row.study_design,
    publicationStatus: row.publication_status,
    categorizationFromFullText: row.categorization_from_full_text,
    notes: row.notes,
    usedSupplementalMetadata: row.used_supplemental_metadata,
    reviewSeconds: row.review_seconds,
  })
}

function chunks<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  )
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'input',
    'batch',
    'dry-run',
    'commit',
    'target',
    'confirm-remote',
    'help',
  ])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const inputPath = stringArgument(arguments_, 'input')
  if (!inputPath) throw new Error('--input is required.')
  const input = await readFile(resolve(inputPath), 'utf8')
  const requestedBatch = stringArgument(arguments_, 'batch')
  const parsed =
    extname(inputPath).toLocaleLowerCase('en-US') === '.csv'
      ? parseLiteratureGoldReviewImportCsv(input, {
          expectedBatchReference: requestedBatch,
        })
      : parseJsonExport(input)
  if (parsed.decisions.length === 0) {
    throw new Error('The import contains no draft or completed review decisions.')
  }
  const duplicateItems = parsed.decisions.filter(
    (decision, index, values) =>
      values.findIndex((candidate) => candidate.itemId === decision.itemId) !== index,
  )
  if (duplicateItems.length > 0) {
    throw new Error('The import contains duplicate gold-set item IDs.')
  }
  for (const decision of parsed.decisions) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        decision.itemId,
      ) ||
      !/^[0-9]{1,12}$/u.test(decision.pmid)
    ) {
      throw new Error('Every import row needs a valid item UUID and PMID.')
    }
  }

  console.log(`Validated decisions: ${parsed.decisions.length}`)
  console.log(
    `Completed: ${parsed.decisions.filter((decision) => decision.reviewSource === 'completed').length}`,
  )
  console.log(
    `Drafts: ${parsed.decisions.filter((decision) => decision.reviewSource === 'draft').length}`,
  )

  const writeMode = resolveLiteratureWriteMode(arguments_, parsed.decisions.length)
  if (!writeMode.commit || !writeMode.client) return
  const client = writeMode.client
  const batchReference = requestedBatch ?? parsed.batchId
  if (!batchReference) throw new Error('--batch is required when the export has no batch ID.')

  let batchQuery = client.from('literature_gold_set_batches').select('id,name,status').limit(2)
  batchQuery = /^[0-9a-f-]{36}$/iu.test(batchReference)
    ? batchQuery.eq('id', batchReference)
    : batchQuery.eq('name', batchReference)
  const batches = await executeDatabaseCall<Array<{ id: string; name: string; status: string }>>(
    'Gold-set batch lookup',
    () => batchQuery,
  )
  const batch = batches?.[0]
  if (!batch) throw new Error(`Gold-set batch not found: ${batchReference}`)
  if (batch.status !== 'active') throw new Error('Only an active gold-set batch can be imported.')

  const itemRows: Array<Record<string, unknown>> = []
  for (const itemIds of chunks(
    parsed.decisions.map((decision) => decision.itemId),
    200,
  )) {
    const data = await executeDatabaseCall<Array<Record<string, unknown>>>(
      'Gold-set item lookup',
      () =>
        client
          .from('literature_gold_set_items')
          .select(
            'id,pmid,current_review_id,supplemental_metadata_revealed_at,automated_signals_revealed_at',
          )
          .eq('batch_id', batch.id)
          .in('id', itemIds),
    )
    itemRows.push(...(data ?? []))
  }
  const itemById = new Map(itemRows.map((row) => [String(row.id), row]))
  if (itemById.size !== parsed.decisions.length) {
    throw new Error('One or more imported items do not belong to the selected batch.')
  }
  for (const decision of parsed.decisions) {
    if (String(itemById.get(decision.itemId)?.pmid) !== decision.pmid) {
      throw new Error(`Item/PMID mismatch for ${decision.itemId}.`)
    }
  }

  const currentReviewIds = itemRows
    .map((row) => (typeof row.current_review_id === 'string' ? row.current_review_id : null))
    .filter((id): id is string => Boolean(id))
  const currentReviewRows: Array<Record<string, unknown>> = []
  for (const ids of chunks(currentReviewIds, 200)) {
    const data = await executeDatabaseCall<Array<Record<string, unknown>>>(
      'Current gold-set review lookup',
      () => client.from('literature_gold_set_reviews').select('*').in('id', ids),
    )
    currentReviewRows.push(...(data ?? []))
  }
  const currentReviewById = new Map(
    currentReviewRows.map((row) => [String(row.id), databaseReview(row)]),
  )
  const pending = parsed.decisions.filter((decision) => {
    if (decision.reviewSource !== 'completed') return true
    const currentId = itemById.get(decision.itemId)?.current_review_id
    const current = typeof currentId === 'string' ? currentReviewById.get(currentId) : null
    return !current || comparableReview(current) !== comparableReview(decision.review)
  })
  console.log(`Identical current reviews skipped: ${parsed.decisions.length - pending.length}`)
  console.log(`Decisions to save: ${pending.length}`)

  let saved = 0
  for (const group of chunks(pending, 10)) {
    await Promise.all(
      group.map(async (decision) => {
        const item = itemById.get(decision.itemId)
        if (decision.review.usedSupplementalMetadata && !item?.supplemental_metadata_revealed_at) {
          await executeDatabaseCall('Restore supplemental reveal state', () =>
            client.rpc('update_literature_gold_item_v1', {
              p_item_id: decision.itemId,
              p_actor_user_id: null,
              p_actor_email:
                process.env.LITERATURE_REVIEW_ACTOR_EMAIL ?? 'literature-gold-review-import-cli',
              p_action: 'reveal_supplemental',
            }),
          )
        }
        await executeDatabaseCall('Import gold-set review', () =>
          client.rpc('save_literature_gold_review_v1', {
            p_item_id: decision.itemId,
            p_actor_user_id: null,
            p_actor_email:
              process.env.LITERATURE_REVIEW_ACTOR_EMAIL ?? 'literature-gold-review-import-cli',
            p_review: decision.review,
            p_complete: decision.reviewSource === 'completed',
          }),
        )
        saved += 1
      }),
    )
    console.log(`Saved ${saved}/${pending.length}`)
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
