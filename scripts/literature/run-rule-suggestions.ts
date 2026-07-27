import {
  literatureQueryRegistry,
  literatureTopicRules,
  validateLiteratureConfigRelations,
} from '@/features/literature/config'
import {
  literatureRelevanceStates,
  MAX_LITERATURE_IMPORT_BATCH_SIZE,
} from '@/features/literature/constants'
import { suggestLiteratureTopics } from '@/features/literature/domain/topic-suggestions'
import type { LiteratureRelevanceState } from '@/features/literature/types'

import {
  assertKnownArguments,
  hasFlag,
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
Create query- and rule-derived topic suggestions. Suggestions are never human confirmations.

Usage:
  npm run literature:suggest-topics -- --state unreviewed --limit 100 --dry-run
  npm run literature:suggest-topics -- --state unreviewed --limit 100 --commit --target local
`.trim()

interface ArticleRow {
  pmid: string
  title: string
  abstract: string | null
  mesh_terms: string[]
  author_keywords: string[]
}

interface SourceRow {
  pmid: string
  query_id: string | null
}

function parseState(raw: string): LiteratureRelevanceState {
  if (!literatureRelevanceStates.includes(raw as LiteratureRelevanceState)) {
    throw new Error(`--state must be one of: ${literatureRelevanceStates.join(', ')}`)
  }
  return raw as LiteratureRelevanceState
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'state',
    'limit',
    'batch-size',
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

  validateLiteratureConfigRelations()
  const state = parseState(stringArgument(arguments_, 'state', 'unreviewed'))
  const limit = numberArgument(arguments_, 'limit', 100) ?? 100
  const batchSize = numberArgument(arguments_, 'batch-size', 100) ?? 100
  if (batchSize > MAX_LITERATURE_IMPORT_BATCH_SIZE) {
    throw new Error(`--batch-size must not exceed ${MAX_LITERATURE_IMPORT_BATCH_SIZE}.`)
  }

  const writeMode = resolveLiteratureWriteMode(arguments_, limit)
  const client = writeMode.client ?? createLiteratureReadClient(arguments_)
  let offset = 0
  let processed = 0
  let suggestionCount = 0

  while (processed < limit) {
    const take = Math.min(batchSize, limit - processed)
    const articles =
      (await executeDatabaseCall<ArticleRow[]>('Article suggestion query', () =>
        client
          .from('literature_articles')
          .select('pmid,title,abstract,mesh_terms,author_keywords')
          .eq('relevance_state', state)
          .order('pmid', { ascending: true })
          .range(offset, offset + take - 1),
      )) ?? []

    if (articles.length === 0) {
      break
    }

    const pmids = articles.map((article) => article.pmid)
    const sources =
      (await executeDatabaseCall<SourceRow[]>('Article source query', () =>
        client
          .from('literature_article_sources')
          .select('pmid,query_id')
          .in('pmid', pmids)
          .not('query_id', 'is', null),
      )) ?? []
    const queryIdsByPmid = new Map<string, string[]>()

    for (const source of sources) {
      if (!source.query_id) {
        continue
      }
      queryIdsByPmid.set(source.pmid, [...(queryIdsByPmid.get(source.pmid) ?? []), source.query_id])
    }

    const suggestionRows = articles.flatMap((article) =>
      suggestLiteratureTopics(
        {
          title: article.title,
          abstract: article.abstract,
          meshTerms: article.mesh_terms ?? [],
          authorKeywords: article.author_keywords ?? [],
        },
        queryIdsByPmid.get(article.pmid) ?? [],
        literatureTopicRules,
        literatureQueryRegistry.registry_version,
      ).map((suggestion) => ({
        pmid: article.pmid,
        topic_id: suggestion.topicId,
        confidence: suggestion.confidence,
        assignment_source: suggestion.assignmentSource,
        assignment_state: suggestion.assignmentState,
        model_or_rule_version: suggestion.modelOrRuleVersion,
        evidence: suggestion.evidence,
      })),
    )

    suggestionCount += suggestionRows.length
    if (writeMode.commit && suggestionRows.length > 0) {
      await executeDatabaseCall('Topic suggestion upsert', () =>
        client.from('literature_article_topics').upsert(suggestionRows, {
          onConflict: 'pmid,topic_id,assignment_source,model_or_rule_version',
        }),
      )
    }

    processed += articles.length
    offset += articles.length
    if (articles.length < take) {
      break
    }
  }

  console.log(`Articles examined: ${processed}`)
  console.log(`Suggestions produced: ${suggestionCount}`)
  console.log(
    writeMode.commit
      ? 'Suggestions committed as assignment_state=suggested.'
      : 'Dry-run complete; no topic assignments were written.',
  )
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
