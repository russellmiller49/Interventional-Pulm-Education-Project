import { QUERY_SUGGESTION_CONFIDENCE } from '@/features/literature/constants'
import type { LiteratureTopicRules } from '@/features/literature/schemas/config'
import type {
  LiteratureTopicSuggestion,
  NormalizedLiteratureArticle,
} from '@/features/literature/types'

import { normalizeSearchableText, stableUnique } from './text'

interface SearchableArticleFields {
  title: string
  abstract: string
  mesh: string
  keywords: string
}

function buildSearchableFields(
  article: Pick<NormalizedLiteratureArticle, 'title' | 'abstract' | 'meshTerms' | 'authorKeywords'>,
): SearchableArticleFields {
  return {
    title: normalizeSearchableText(article.title),
    abstract: normalizeSearchableText(article.abstract ?? ''),
    mesh: normalizeSearchableText(article.meshTerms.join(' ')),
    keywords: normalizeSearchableText(article.authorKeywords.join(' ')),
  }
}

function containsNormalizedTerm(value: string, term: string) {
  if (!value || !term) {
    return false
  }
  return ` ${value} `.includes(` ${term} `)
}

function fieldsContainingTerm(fields: SearchableArticleFields, rawTerm: string) {
  const term = normalizeSearchableText(rawTerm)
  return Object.entries(fields)
    .filter(([, value]) => containsNormalizedTerm(value, term))
    .map(([field]) => field)
}

export function suggestLiteratureTopics(
  article: Pick<NormalizedLiteratureArticle, 'title' | 'abstract' | 'meshTerms' | 'authorKeywords'>,
  queryIds: string[],
  rules: LiteratureTopicRules,
  queryRegistryVersion: string,
): LiteratureTopicSuggestion[] {
  const suggestions: LiteratureTopicSuggestion[] = []
  const fields = buildSearchableFields(article)

  for (const queryId of stableUnique(queryIds)) {
    const topicId = rules.query_topic_aliases[queryId]
    if (!topicId) {
      continue
    }

    suggestions.push({
      topicId,
      confidence: QUERY_SUGGESTION_CONFIDENCE,
      assignmentSource: 'query',
      assignmentState: 'suggested',
      modelOrRuleVersion: `query-registry-${queryRegistryVersion}:${queryId}`,
      evidence: { queryId },
    })
  }

  for (const rule of rules.rules) {
    const matchingAnyTerms = rule.any_terms.filter(
      (term) => fieldsContainingTerm(fields, term).length > 0,
    )
    if (matchingAnyTerms.length === 0) {
      continue
    }

    const satisfiesEveryGroup = rule.all_term_groups.every((group) =>
      group.some((term) => fieldsContainingTerm(fields, term).length > 0),
    )
    if (!satisfiesEveryGroup) {
      continue
    }

    const hasExcludedTerm = rule.none_terms.some(
      (term) => fieldsContainingTerm(fields, term).length > 0,
    )
    if (hasExcludedTerm) {
      continue
    }

    const matchingContextTerms = rule.all_term_groups.flatMap((group) =>
      group.filter((term) => fieldsContainingTerm(fields, term).length > 0),
    )
    const matchedTerms = stableUnique([...matchingAnyTerms, ...matchingContextTerms])
    const matchedFields = stableUnique(
      matchedTerms.flatMap((term) => fieldsContainingTerm(fields, term)),
    )

    suggestions.push({
      topicId: rule.topic_id,
      confidence: rule.confidence,
      assignmentSource: 'rule',
      assignmentState: 'suggested',
      modelOrRuleVersion: `${rules.rule_version}:${rule.id}`,
      evidence: {
        ruleId: rule.id,
        matchedTerms,
        matchedFields,
      },
    })
  }

  return suggestions
}
