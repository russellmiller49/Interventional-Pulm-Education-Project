import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

import { literatureGoldSetLabels, literatureTaxonomy } from '@/features/literature/config'
import {
  DEFAULT_LITERATURE_GOLD_SET_SEED,
  DEFAULT_LITERATURE_GOLD_SET_SIZE,
  DEFAULT_LITERATURE_GOLD_TEST_PERCENT,
  LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
} from '@/features/literature/gold-set/constants'
import {
  assertLiteratureGoldPmidExclusionManifestUnchanged,
  loadLiteratureGoldPmidExclusionManifest,
} from '@/features/literature/gold-set/exclusion-manifest'
import {
  assertLiteratureGoldPriorAutomaticSamplesUnchanged,
  sampleLiteratureGoldSet,
} from '@/features/literature/gold-set/sampling'
import type {
  LiteratureGoldSamplingCandidate,
  LiteratureGoldSamplingExclusionSource,
  LiteratureGoldSetKind,
} from '@/features/literature/gold-set/types'
import { literatureGoldCreateOptionsSchema } from '@/features/literature/schemas/gold-set'

import {
  assertKnownArguments,
  hasFlag,
  nonNegativeIntegerArgument,
  numberArgument,
  parseCliArguments,
  stringArgument,
} from './lib/cli'
import {
  createLiteratureReadClient,
  executeDatabaseCall,
  resolveLiteratureWriteMode,
} from './lib/database'

const HELP = `
Create a reproducible, stratified gold-set batch from unique imported PMIDs.

Usage:
  npm run literature:create-gold-set -- --kind pilot --size 100 --seed 20260727 --name pilot-v1
  npm run literature:create-gold-set -- --size 900 --seed 20260727 --name gold-set-v1
  npm run literature:create-gold-set -- --kind landmark_regression --pmids landmark-pmids.txt --size 50

Options:
  --name <slug>          Batch name (default gold-set-v1).
  --kind <value>         pilot, gold_standard (default), landmark_regression, or
                         hard_negative_regression.
  --size <n>             Requested unique PMID count (default 900; maximum 5000).
  --seed <n>             Fixed deterministic seed (default 20260727).
  --test-percent <n>     Locked-test percentage, 0-50 (default 30). Pilot and regression
                         sets are always development-only.
  --pmids <path>         JSON string array or text list of explicit PMIDs. Required for
                         regression sets.
  --exclude-pmids <path> Numeric, unique PMID manifest to exclude from automatic pilot or
                         gold-standard sampling. The report records its absolute path and SHA-256.
  --allow-resample       Allow a pilot/gold-standard PMID to appear in another automatic batch.
                         By default, prior pilot and gold-standard PMIDs are excluded.
  --output <path>        Sampling report JSON path.
  --dry-run              Read candidates and write a report only (default).
  --commit               Create the batch after the report is written.
  --target <value>       local (default) or remote.
  --confirm-remote       Additional required acknowledgement for remote writes.
  --help                 Show this help.
`.trim()

interface CandidateRow {
  pmid: string
  journal_id: string | null
  journal_label: string
  publication_year: number | null
  has_abstract: boolean
  is_conference_abstract: boolean
  is_landmark: boolean
  source_kinds: string[] | null
  source_count: number | string
  source_file_count: number | string
  query_ids: string[] | null
  suggested_topic_ids: string[] | null
  suggestion_count: number | string
  max_suggestion_confidence: number | string
}

const GOLD_CANDIDATE_PAGE_SIZE = 1_000
const GOLD_BATCH_ITEM_PAGE_SIZE = 1_000

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function reportPath(requested: string) {
  const absolute = resolve(requested)
  if (!(await exists(absolute))) return absolute
  const suffix = new Date().toISOString().replaceAll(/[:.]/gu, '-')
  const extension = extname(absolute)
  return `${absolute.slice(0, -extension.length)}.proposed-${suffix}${extension || '.json'}`
}

async function explicitPmids(path: string | undefined) {
  if (!path) return undefined
  const input = await readFile(resolve(path), 'utf8')
  let values: unknown
  if (extname(path).toLocaleLowerCase('en-US') === '.json') {
    values = JSON.parse(input) as unknown
  } else {
    values = input.split(/[\s,;]+/u).filter(Boolean)
  }
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== 'string' || !/^[0-9]{1,12}$/u.test(value))
  ) {
    throw new Error('The PMID file must contain only PMID strings.')
  }
  return [...new Set(values)]
}

async function fetchCandidates(
  client: ReturnType<typeof createLiteratureReadClient>,
): Promise<LiteratureGoldSamplingCandidate[]> {
  const candidates: LiteratureGoldSamplingCandidate[] = []
  let afterPmid: string | null = null

  for (;;) {
    const data = await executeDatabaseCall<CandidateRow[]>(
      'Gold-set candidate page',
      () =>
        client.rpc('list_literature_gold_sampling_candidates_v1', {
          p_after_pmid: afterPmid,
          p_limit: GOLD_CANDIDATE_PAGE_SIZE,
        }),
      3,
    )
    const rows = data ?? []
    candidates.push(
      ...rows.map((row) => ({
        pmid: row.pmid,
        journalId: row.journal_id,
        journalLabel: row.journal_label,
        publicationYear: row.publication_year,
        hasAbstract: row.has_abstract,
        isConferenceAbstract: row.is_conference_abstract,
        isLandmark: row.is_landmark,
        sourceKinds: row.source_kinds ?? [],
        sourceCount: Number(row.source_count) || 0,
        sourceFileCount: Number(row.source_file_count) || 0,
        queryIds: row.query_ids ?? [],
        suggestedTopicIds: row.suggested_topic_ids ?? [],
        suggestionCount: Number(row.suggestion_count) || 0,
        maxSuggestionConfidence: Number(row.max_suggestion_confidence) || 0,
      })),
    )
    if (rows.length < GOLD_CANDIDATE_PAGE_SIZE) break
    afterPmid = rows.at(-1)?.pmid ?? null
    if (!afterPmid) break
  }
  return candidates
}

async function fetchPreviouslySampledPmids(client: ReturnType<typeof createLiteratureReadClient>) {
  const batches = await executeDatabaseCall<Array<{ id: string; name: string; kind: string }>>(
    'Prior automatic gold-set batch lookup',
    () =>
      client
        .from('literature_gold_set_batches')
        .select('id,name,kind')
        .in('kind', ['pilot', 'gold_standard']),
  )
  if (!batches?.length) return { batchNames: [], pmids: [] }

  const pmids = new Set<string>()
  const batchIds = batches.map((batch) => batch.id)
  for (let start = 0; ; start += GOLD_BATCH_ITEM_PAGE_SIZE) {
    const rows = await executeDatabaseCall<Array<{ pmid: string }>>(
      'Prior automatic gold-set item page',
      () =>
        client
          .from('literature_gold_set_items')
          .select('pmid')
          .in('batch_id', batchIds)
          .order('batch_id', { ascending: true })
          .order('pmid', { ascending: true })
          .range(start, start + GOLD_BATCH_ITEM_PAGE_SIZE - 1),
    )
    for (const row of rows ?? []) pmids.add(row.pmid)
    if ((rows?.length ?? 0) < GOLD_BATCH_ITEM_PAGE_SIZE) break
  }
  return {
    batchNames: batches.map((batch) => batch.name).sort(),
    pmids: [...pmids],
  }
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'name',
    'kind',
    'size',
    'seed',
    'test-percent',
    'pmids',
    'exclude-pmids',
    'allow-resample',
    'output',
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

  const kind = stringArgument(arguments_, 'kind', 'gold_standard') as LiteratureGoldSetKind
  const options = literatureGoldCreateOptionsSchema.parse({
    name: stringArgument(arguments_, 'name', 'gold-set-v1'),
    kind,
    size: numberArgument(arguments_, 'size', DEFAULT_LITERATURE_GOLD_SET_SIZE),
    seed: numberArgument(arguments_, 'seed', DEFAULT_LITERATURE_GOLD_SET_SEED),
    testPercent: nonNegativeIntegerArgument(
      arguments_,
      'test-percent',
      DEFAULT_LITERATURE_GOLD_TEST_PERCENT,
    ),
  })
  if ((arguments_.values.get('exclude-pmids')?.length ?? 0) > 1) {
    throw new Error('--exclude-pmids may be supplied only once.')
  }
  const pmids = await explicitPmids(stringArgument(arguments_, 'pmids'))
  const regression =
    options.kind === 'landmark_regression' || options.kind === 'hard_negative_regression'
  const excludePmidsPath = stringArgument(arguments_, 'exclude-pmids')
  if (regression && excludePmidsPath) {
    throw new Error(
      '--exclude-pmids is supported only for automatic pilot and gold-standard sampling.',
    )
  }
  const exclusionManifest = excludePmidsPath
    ? await loadLiteratureGoldPmidExclusionManifest(excludePmidsPath)
    : null
  const client = createLiteratureReadClient(arguments_)
  console.log('Loading unique PMID candidates…')
  const candidates = await fetchCandidates(client)
  if (candidates.length === 0) {
    throw new Error('No imported literature candidates were found.')
  }
  const excludePriorAutomaticSamples = !regression && !hasFlag(arguments_, 'allow-resample')
  const priorSamples = excludePriorAutomaticSamples
    ? await fetchPreviouslySampledPmids(client)
    : { batchNames: [], pmids: [] }
  if (priorSamples.pmids.length > 0) {
    console.log(
      `Excluding ${priorSamples.pmids.length} PMIDs from prior automatic batches: ${priorSamples.batchNames.join(', ')}`,
    )
  }

  const exclusionSources: LiteratureGoldSamplingExclusionSource[] = []
  if (excludePriorAutomaticSamples) {
    exclusionSources.push({
      sourceType: 'prior_automatic_batches',
      pmids: priorSamples.pmids,
      batchNames: priorSamples.batchNames,
    })
  }
  if (exclusionManifest) {
    exclusionSources.push({
      sourceType: 'pmid_manifest',
      pmids: exclusionManifest.pmids,
      path: exclusionManifest.path,
      sha256: exclusionManifest.sha256,
    })
  }

  const report = sampleLiteratureGoldSet(candidates, {
    ...options,
    explicitPmids: pmids,
    exclusionSources,
  })
  if (exclusionManifest) {
    await assertLiteratureGoldPmidExclusionManifestUnchanged(exclusionManifest)
  }
  const output = await reportPath(
    stringArgument(
      arguments_,
      'output',
      `local-data/literature/gold-sets/${options.name}-sampling-report.json`,
    ),
  )
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })
  // Report publication is part of dry-run behavior, so detect a path replacement before success.
  if (exclusionManifest) {
    await assertLiteratureGoldPmidExclusionManifestUnchanged(exclusionManifest)
  }

  console.log(`Sampling report: ${output}`)
  console.log(`Candidates: ${report.candidateCount}`)
  console.log(`Excluded candidates: ${report.excludedCandidateCount}`)
  report.exclusionSources.forEach((source) => {
    console.log(
      `Exclusion source ${source.sourceType}: supplied=${source.suppliedCount}, corpus-present=${source.corpusPresentCount}, eligible=${source.eligibleCount}, excluded=${source.excludedCount}`,
    )
  })
  console.log(`Selected: ${report.selectedCount}/${report.requestedSize}`)
  console.log(`Development: ${report.developmentCount}`)
  console.log(`Test: ${report.testCount}`)
  console.log(`Strata: ${JSON.stringify(report.countsByStratum)}`)
  report.warnings.forEach((warning) => console.warn(`Warning: ${warning}`))

  const writeMode = resolveLiteratureWriteMode(arguments_, report.selectedCount)
  if (!writeMode.commit || !writeMode.client) return
  if (report.selectedCount !== report.requestedSize) {
    throw new Error('Refusing to create a partial batch; resolve sampling warnings first.')
  }
  if (excludePriorAutomaticSamples) {
    const currentPriorSamples = await fetchPreviouslySampledPmids(client)
    assertLiteratureGoldPriorAutomaticSamplesUnchanged(priorSamples, currentPriorSamples)
  }
  if (exclusionManifest) {
    await assertLiteratureGoldPmidExclusionManifestUnchanged(exclusionManifest)
  }

  const { items, ...storedReport } = report
  const result = await executeDatabaseCall<Record<string, unknown>>('Create gold-set batch', () =>
    writeMode.client!.rpc('create_literature_gold_set_batch_v1', {
      p_batch: {
        name: options.name,
        kind: options.kind,
        taxonomyVersion: literatureTaxonomy.taxonomy_version,
        labelSchemaVersion: literatureGoldSetLabels.label_schema_version,
        relevanceDefinitionVersion: literatureGoldSetLabels.relevance_definition_version,
        samplingAlgorithmVersion: LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
        samplingSeed: options.seed,
        requestedSize: options.size,
        testPercent: options.kind === 'gold_standard' ? options.testPercent : 0,
        samplingReport: storedReport,
      },
      p_items: items,
      p_actor_user_id: null,
      p_actor_email: process.env.LITERATURE_REVIEW_ACTOR_EMAIL ?? 'literature-gold-set-cli',
    }),
  )
  console.log(`Created batch: ${JSON.stringify(result)}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
