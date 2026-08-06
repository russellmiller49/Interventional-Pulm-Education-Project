import goldSetLabelsJson from '../../../../config/literature/gold-set-labels.v1.json'
import enrichmentLabelsV2Json from '../../../../config/literature/enrichment-labels.v2.json'
import enrichmentTaxonomyAdoptionV2Json from '../../../../config/literature/enrichment-taxonomy-adoption.v2.json'
import queryRegistryJson from '../../../../config/literature/pubmed-query-registry.v1.json'
import taxonomyJson from '../../../../config/literature/taxonomy.v1.json'
import taxonomyV2Json from '../../../../config/literature/taxonomy.v2.json'
import topicRulesJson from '../../../../config/literature/topic-rules.v1.json'

import {
  literatureEnrichmentLabelsV2Schema,
  literatureEnrichmentTaxonomyAdoptionV2Schema,
  literatureQueryRegistrySchema,
  literatureGoldSetLabelsSchema,
  literatureTaxonomySchema,
  literatureTaxonomyV2Schema,
  literatureTopicRulesSchema,
  type LiteratureEnrichmentField,
  type LiteratureEnrichmentLabelsV2,
  type LiteratureEnrichmentTaxonomyAdoptionV2,
  type LiteratureTaxonomy,
  type LiteratureTaxonomyV1,
  type LiteratureTaxonomyV2,
} from '@/features/literature/schemas/config'

export const literatureQueryRegistry = literatureQueryRegistrySchema.parse(queryRegistryJson)
export const literatureTaxonomy = literatureTaxonomySchema.parse(taxonomyJson)
export const literatureTopicRules = literatureTopicRulesSchema.parse(topicRulesJson)
export const literatureGoldSetLabels = literatureGoldSetLabelsSchema.parse(goldSetLabelsJson)

export function loadLiteratureTaxonomy(version: '1.1.0'): LiteratureTaxonomyV1
export function loadLiteratureTaxonomy(version: '2.0.0'): LiteratureTaxonomyV2
export function loadLiteratureTaxonomy(
  version: '1.1.0' | '2.0.0',
): LiteratureTaxonomyV1 | LiteratureTaxonomyV2 {
  if (version === '1.1.0') {
    return literatureTaxonomySchema.parse(taxonomyJson) as LiteratureTaxonomyV1
  }
  if (version === '2.0.0') {
    return literatureTaxonomyV2Schema.parse(taxonomyV2Json)
  }
  throw new Error(`Unsupported literature taxonomy version: ${String(version)}`)
}

export function loadLiteratureEnrichmentLabels(version: '2.0.0'): LiteratureEnrichmentLabelsV2 {
  if (version !== '2.0.0') {
    throw new Error(`Unsupported literature enrichment label schema version: ${String(version)}`)
  }
  const labels = literatureEnrichmentLabelsV2Schema.parse(enrichmentLabelsV2Json)
  const taxonomy = loadLiteratureTaxonomy('2.0.0')
  const expectedIds = {
    topic_ids: taxonomy.topics.map((topic) => topic.id),
    clinical_purposes: taxonomy.facets.clinical_purpose,
    disease_tags: taxonomy.facets.disease,
    study_design: taxonomy.facets.study_design,
    publication_status: taxonomy.facets.publication_class,
  } as const
  for (const [field, expected] of Object.entries(expectedIds) as [
    keyof typeof expectedIds,
    readonly string[],
  ][]) {
    const actual = labels.fields[field].map((term) => term.id)
    if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
      throw new Error(`V2 enrichment labels for ${field} do not match taxonomy v2 ordering.`)
    }
  }
  return labels
}

export function loadLiteratureEnrichmentTaxonomyAdoption(
  version: '2.0.0',
): LiteratureEnrichmentTaxonomyAdoptionV2 {
  if (version !== '2.0.0') {
    throw new Error(`Unsupported literature taxonomy adoption report version: ${String(version)}`)
  }

  const report = literatureEnrichmentTaxonomyAdoptionV2Schema.parse(
    enrichmentTaxonomyAdoptionV2Json,
  )
  const labels = loadLiteratureEnrichmentLabels('2.0.0')
  const controlledIds = Object.fromEntries(
    Object.entries(labels.fields).map(([field, terms]) => [
      field,
      new Set(terms.map((term) => term.id)),
    ]),
  ) as Record<LiteratureEnrichmentField, Set<string>>

  report.proposals.forEach((proposal) => {
    if (proposal.decision === 'adopt' && !controlledIds[proposal.field].has(proposal.proposed_id)) {
      throw new Error(
        `Adopted proposal ${proposal.proposal_id} is missing from ${proposal.field} labels.`,
      )
    }
    proposal.replacement_ids.forEach((replacementId) => {
      if (!controlledIds[proposal.field].has(replacementId)) {
        throw new Error(
          `Proposal ${proposal.proposal_id} points to unsupported ${proposal.field} value: ${replacementId}`,
        )
      }
    })
  })
  report.migration_mappings.forEach((mapping) => {
    mapping.replacement_ids.forEach((replacementId) => {
      if (!controlledIds[mapping.field].has(replacementId)) {
        throw new Error(
          `Migration ${mapping.field}:${mapping.source_id} points to unsupported value: ${replacementId}`,
        )
      }
    })
  })

  return report
}

type EnrichmentLabelLocale = 'en' | 'es' | 'zh_cn' | 'ar' | 'ko'

function enrichmentLabelLocale(locale: string): EnrichmentLabelLocale {
  const normalized = locale.trim().toLowerCase().replaceAll('_', '-')
  if (normalized === 'es' || normalized.startsWith('es-')) return 'es'
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh_cn'
  if (normalized === 'ar' || normalized.startsWith('ar-')) return 'ar'
  if (normalized === 'ko' || normalized.startsWith('ko-')) return 'ko'
  return 'en'
}

export interface LiteratureEnrichmentLabelLookup {
  id: string
  label: string
  description: string
  requestedLocale: string
  resolvedLocale: EnrichmentLabelLocale
  usedEnglishFallback: boolean
}

/** Looks up a label from an explicitly loaded schema and falls back to English. */
export function lookupLiteratureEnrichmentLabel(
  labels: LiteratureEnrichmentLabelsV2,
  field: LiteratureEnrichmentField,
  id: string,
  locale: string,
): LiteratureEnrichmentLabelLookup {
  const term = labels.fields[field].find((candidate) => candidate.id === id)
  if (!term) {
    throw new Error(`Unsupported ${field} value: ${id}`)
  }

  const requestedKey = enrichmentLabelLocale(locale)
  const localizedLabel =
    requestedKey === 'en' ? term.label_en : term[`label_${requestedKey}` as keyof typeof term]
  const localizedDescription =
    requestedKey === 'en'
      ? term.description_en
      : term[`description_${requestedKey}` as keyof typeof term]
  let label = term.label_en
  let description = term.description_en
  let resolvedLocale: EnrichmentLabelLocale = 'en'
  if (typeof localizedLabel === 'string' && typeof localizedDescription === 'string') {
    label = localizedLabel
    description = localizedDescription
    resolvedLocale = requestedKey
  }

  return {
    id: term.id,
    label,
    description,
    requestedLocale: locale,
    resolvedLocale,
    usedEnglishFallback: resolvedLocale === 'en' && !locale.trim().toLowerCase().startsWith('en'),
  }
}

export interface FlattenedLiteratureTopic {
  id: string
  parentId: string | null
  labelEn: string
  labelEs: string | null
  labelZhCn: string | null
  descriptionEn: string | null
  synonyms: string[]
  taxonomyVersion: string
  sortOrder: number
}

export function flattenLiteratureTaxonomy(
  taxonomy: LiteratureTaxonomy = literatureTaxonomy,
): FlattenedLiteratureTopic[] {
  const flattened: FlattenedLiteratureTopic[] = []
  let sortOrder = 0

  for (const topic of taxonomy.topics) {
    flattened.push({
      id: topic.id,
      parentId: null,
      labelEn: topic.label_en,
      labelEs: topic.label_es ?? null,
      labelZhCn: topic.label_zh_cn ?? null,
      descriptionEn: topic.description_en ?? null,
      synonyms: topic.synonyms ?? [],
      taxonomyVersion: taxonomy.taxonomy_version,
      sortOrder,
    })
    sortOrder += 1

    for (const child of topic.children ?? []) {
      flattened.push({
        id: child.id,
        parentId: topic.id,
        labelEn: child.label_en,
        labelEs: child.label_es ?? null,
        labelZhCn: child.label_zh_cn ?? null,
        descriptionEn: child.description_en ?? null,
        synonyms: child.synonyms ?? [],
        taxonomyVersion: taxonomy.taxonomy_version,
        sortOrder,
      })
      sortOrder += 1
    }
  }

  return flattened
}

export function validateLiteratureConfigRelations() {
  const topicIds = new Set(flattenLiteratureTaxonomy().map((topic) => topic.id))
  const queryIds = new Set(literatureQueryRegistry.discovery_queries.map((query) => query.id))
  const errors: string[] = []

  for (const [queryId, topicId] of Object.entries(literatureTopicRules.query_topic_aliases)) {
    if (!queryIds.has(queryId)) {
      errors.push(`Unknown discovery query alias: ${queryId}`)
    }
    if (!topicIds.has(topicId)) {
      errors.push(`Query alias ${queryId} points to unknown topic ${topicId}`)
    }
  }

  for (const rule of literatureTopicRules.rules) {
    if (!topicIds.has(rule.topic_id)) {
      errors.push(`Rule ${rule.id} points to unknown topic ${rule.topic_id}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid literature configuration:\n${errors.join('\n')}`)
  }

  return {
    queryCount: queryIds.size,
    ruleCount: literatureTopicRules.rules.length,
    topicCount: topicIds.size,
  }
}
