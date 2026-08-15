import type {
  LiteratureAbstractDisplayPolicy,
  LiteratureRelevanceState,
  LiteratureSourceKind,
  LiteratureTopicAssignmentSource,
  LiteratureTopicAssignmentState,
  LiteratureVisibilityState,
} from '@/features/literature/types'

import type { LiteratureCapability } from './runtime-capability'

export interface LiteratureDisplayTopic {
  id: string
  labelEn: string
  labelEs: string | null
  labelZhCn: string | null
}

export interface LiteratureSearchResult {
  pmid: string
  doi: string | null
  title: string
  authors: Array<{ fullName: string; abbreviatedName: string | null }>
  journalId: string | null
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  volume: string | null
  issue: string | null
  pages: string | null
  abstractSnippet: string | null
  publicationTypes: string[]
  isLandmark: boolean
  isRetracted: boolean
  isCorrection: boolean
  isConferenceAbstract: boolean
  relevanceState: LiteratureRelevanceState
  visibilityState: LiteratureVisibilityState
  confirmedTopics: LiteratureDisplayTopic[]
  suggestedTopics: LiteratureDisplayTopic[]
  matchedBy: string[]
  rankScore: number
}

export interface LiteratureSearchResponse {
  items: LiteratureSearchResult[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  adminPreview: boolean
}

export interface LiteratureSourceDisplay {
  batchId: string
  sourceKind: LiteratureSourceKind
  sourceId: string | null
  queryId: string | null
  sourceFilename: string
  firstSeenAt: string
}

export interface LiteratureTopicAssignmentDisplay extends LiteratureDisplayTopic {
  confidence: number | null
  assignmentSource: LiteratureTopicAssignmentSource
  assignmentState: LiteratureTopicAssignmentState
  modelOrRuleVersion: string
  evidence: Record<string, unknown> | null
}

export interface LiteratureCurationEventDisplay {
  id: string
  eventType: string
  actorEmail: string | null
  beforeValue: unknown
  afterValue: unknown
  reason: string | null
  createdAt: string
}

export interface LiteratureArticleDetail {
  pmid: string
  doi: string | null
  pmcid: string | null
  title: string
  abstract: string | null
  abstractDisplayPolicy: LiteratureAbstractDisplayPolicy
  journalId: string | null
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationDateRaw: string | null
  publicationYear: number | null
  publicationTypes: string[]
  meshTerms: string[]
  authorKeywords: string[]
  languages: string[]
  authors: Array<{ fullName: string; abbreviatedName: string | null }>
  collectiveAuthors: string[]
  volume: string | null
  issue: string | null
  pages: string | null
  articleNumber: string | null
  citationSource: string | null
  relevanceState: LiteratureRelevanceState
  visibilityState: LiteratureVisibilityState
  curationReason: string | null
  isLandmark: boolean
  isRetracted: boolean
  isCorrection: boolean
  isConferenceAbstract: boolean
  sources: LiteratureSourceDisplay[]
  topics: LiteratureTopicAssignmentDisplay[]
  curationEvents: LiteratureCurationEventDisplay[]
}

export interface LiteratureReviewQueueItem {
  pmid: string
  doi: string | null
  title: string
  abstractSnippet: string | null
  authors: Array<{ fullName: string; abbreviatedName: string | null }>
  journalId: string | null
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  publicationTypes: string[]
  relevanceState: LiteratureRelevanceState
  visibilityState: LiteratureVisibilityState
  isLandmark: boolean
  sources: LiteratureSourceDisplay[]
  topics: LiteratureTopicAssignmentDisplay[]
}

interface LiteratureImportSummary {
  id: string
  source_filename: string
  source_kind: string
  status: string
  records_read: number
  inserted_count: number
  updated_count: number
  error_count: number
  record_limit: number | null
  started_at: string
  completed_at: string | null
}

export interface LiteratureAdminStats {
  totalArticles: number
  withAbstract: number
  withoutAbstract: number
  relevanceCounts: Record<string, number>
  visibilityCounts: Record<string, number>
  sourceKindCounts: Record<string, number>
  journalCounts: Record<string, number>
  topicSuggestionCount: number
  importErrorCount: number
  unmappedFileCount: number
  lastImport: LiteratureImportSummary | null
  lastSuccessfulImport: LiteratureImportSummary | null
}

export type LiteratureServerResult<T> = { data: T; error: null } | { data: null; error: string }

/**
 * A server result that also states the runtime capability it was produced under.
 *
 * Used by every surface that renders counts. Carrying the capability alongside the data is what
 * lets a view distinguish "the corpus is empty" from "the query failed" without inspecting an error
 * string, which is how the misleading `?? 0` fallbacks got written in the first place.
 */
export type LiteratureCapabilityResult<T> = LiteratureServerResult<T> & {
  capability: LiteratureCapability
}
