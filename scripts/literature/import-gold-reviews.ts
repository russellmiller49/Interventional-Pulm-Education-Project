import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import {
  parseLiteratureGoldReviewImportCsv,
  type LiteratureGoldReviewImportDecision,
} from '@/features/literature/gold-set/import'
import {
  literatureGoldCompleteReviewSchema,
  literatureGoldReviewPayloadSchema,
} from '@/features/literature/schemas/gold-set'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { resolveLiteratureWriteMode } from './lib/database'

const HELP = `
Validate legacy offline gold-set decisions. The legacy multi-request commit path is retired because
it cannot provide failed-import atomicity or safe handling of ambiguous commit responses.

Usage:
  npm run literature:import-gold-reviews -- --input pilot-v1-all.csv --batch pilot-v1

Options:
  --input <path>        Required JSON or CSV gold-set export.
  --batch <id-or-name>  Batch UUID or name. Optional when the export identifies one.
  --dry-run             Validate only (default).
  --commit              Retired; always fails before database access or mutation.
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

  if (hasFlag(arguments_, 'commit')) {
    throw new Error(
      'The legacy multi-request import commit path is retired. Use the checksum-bound gold import-compensation executor, which submits one atomic database RPC.',
    )
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
  resolveLiteratureWriteMode(arguments_, parsed.decisions.length)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
