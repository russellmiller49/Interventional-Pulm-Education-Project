import goldSetLabelsJson from '../../../../config/literature/gold-set-labels.v1.json'
import queryRegistryJson from '../../../../config/literature/pubmed-query-registry.v1.json'
import taxonomyJson from '../../../../config/literature/taxonomy.v1.json'
import topicRulesJson from '../../../../config/literature/topic-rules.v1.json'

import {
  literatureQueryRegistrySchema,
  literatureGoldSetLabelsSchema,
  literatureTaxonomySchema,
  literatureTopicRulesSchema,
  type LiteratureTaxonomy,
} from '@/features/literature/schemas/config'

export const literatureQueryRegistry = literatureQueryRegistrySchema.parse(queryRegistryJson)
export const literatureTaxonomy = literatureTaxonomySchema.parse(taxonomyJson)
export const literatureTopicRules = literatureTopicRulesSchema.parse(topicRulesJson)
export const literatureGoldSetLabels = literatureGoldSetLabelsSchema.parse(goldSetLabelsJson)

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
