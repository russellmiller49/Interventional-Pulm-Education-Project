import {
  flattenLiteratureTaxonomy,
  literatureQueryRegistry,
  literatureTaxonomy,
  validateLiteratureConfigRelations,
} from '@/features/literature/config'

import { assertKnownArguments, hasFlag, parseCliArguments } from './lib/cli'
import { executeDatabaseCall, resolveLiteratureWriteMode } from './lib/database'

const HELP = `
Seed the versioned literature journal registry and topic taxonomy.

Usage:
  npm run literature:seed-taxonomy -- [--dry-run]
  npm run literature:seed-taxonomy -- --commit --target local
  npm run literature:seed-taxonomy -- --commit --target remote --confirm-remote
`.trim()

function journalRows() {
  const pubmedJournals = [
    ...literatureQueryRegistry.core_journals,
    ...literatureQueryRegistry.optional_continuity_journals,
    ...literatureQueryRegistry.expanded_journals,
  ].map((journal) => ({
    id: journal.id,
    canonical_name: journal.display_name,
    pubmed_abbreviation: journal.pubmed_abbreviation,
    nlm_id: journal.nlm_id,
    issn_print: journal.issn_print,
    issn_electronic: journal.issn_online,
    aliases: [journal.display_name, journal.pubmed_abbreviation],
    source_tier: journal.tier,
    active_from: null,
    active_to: null,
    notes: journal.notes ?? null,
    registry_version: literatureQueryRegistry.registry_version,
  }))

  const nonPubmedJournals = literatureQueryRegistry.non_pubmed_sources.map((journal) => ({
    id: journal.id,
    canonical_name: journal.display_name,
    pubmed_abbreviation: null,
    nlm_id: journal.nlm_id ?? null,
    issn_print: journal.issn_print ?? null,
    issn_electronic: journal.issn_online ?? null,
    aliases: [journal.display_name],
    source_tier: journal.tier === 'core' ? 'core_non_pubmed' : journal.tier,
    active_from: journal.start_year ?? null,
    active_to: journal.end_year ?? null,
    notes: journal.notes ?? null,
    registry_version: literatureQueryRegistry.registry_version,
  }))

  return [...pubmedJournals, ...nonPubmedJournals]
}

function topicRows() {
  return flattenLiteratureTaxonomy().map((topic) => ({
    id: topic.id,
    parent_id: topic.parentId,
    label_en: topic.labelEn,
    label_es: topic.labelEs,
    label_zh_cn: topic.labelZhCn,
    description_en: topic.descriptionEn,
    synonyms: topic.synonyms,
    taxonomy_version: topic.taxonomyVersion,
    sort_order: topic.sortOrder,
    active: true,
  }))
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, ['dry-run', 'commit', 'target', 'confirm-remote', 'help'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const relationCounts = validateLiteratureConfigRelations()
  const journals = journalRows()
  const topics = topicRows()
  const writeMode = resolveLiteratureWriteMode(arguments_, journals.length + topics.length)

  console.log(`Registry version: ${literatureQueryRegistry.registry_version}`)
  console.log(`Taxonomy version: ${literatureTaxonomy.taxonomy_version}`)
  console.log(`Journals/sources: ${journals.length}`)
  console.log(`Topics: ${relationCounts.topicCount}`)
  console.log(`Rules validated: ${relationCounts.ruleCount}`)

  if (!writeMode.commit || !writeMode.client) {
    return
  }

  const client = writeMode.client
  await executeDatabaseCall('Journal seed', () =>
    client.from('literature_journals').upsert(journals, { onConflict: 'id' }),
  )

  const parents = topics.filter((topic) => topic.parent_id === null)
  const children = topics.filter((topic) => topic.parent_id !== null)
  await executeDatabaseCall('Parent topic seed', () =>
    client.from('literature_topics').upsert(parents, { onConflict: 'id' }),
  )
  await executeDatabaseCall('Child topic seed', () =>
    client.from('literature_topics').upsert(children, { onConflict: 'id' }),
  )

  console.log('Journal registry and taxonomy seed completed.')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
