import type {
  literatureAbstractDisplayPolicies,
  literatureManifestStatuses,
  literaturePublicationDatePrecisions,
  literatureRelevanceStates,
  literatureSourceKinds,
  literatureTopicAssignmentSources,
  literatureTopicAssignmentStates,
  literatureVisibilityStates,
} from './constants'

export type LiteratureSourceKind = (typeof literatureSourceKinds)[number]
export type LiteratureManifestStatus = (typeof literatureManifestStatuses)[number]
export type LiteratureRelevanceState = (typeof literatureRelevanceStates)[number]
export type LiteratureVisibilityState = (typeof literatureVisibilityStates)[number]
export type LiteratureAbstractDisplayPolicy = (typeof literatureAbstractDisplayPolicies)[number]
export type LiteraturePublicationDatePrecision =
  (typeof literaturePublicationDatePrecisions)[number]
export type LiteratureTopicAssignmentSource = (typeof literatureTopicAssignmentSources)[number]
export type LiteratureTopicAssignmentState = (typeof literatureTopicAssignmentStates)[number]

export interface RawNbibRecord {
  recordNumber: number
  tags: Record<string, string[]>
}

export type NbibIssueCode =
  | 'CONFLICTING_DOI'
  | 'FIELD_TOO_LARGE'
  | 'INVALID_PMID'
  | 'LINE_TOO_LONG'
  | 'MALFORMED_LINE'
  | 'MISSING_PMID'
  | 'MISSING_TITLE'
  | 'RECORD_TOO_LARGE'
  | 'TOO_MANY_FIELDS'
  | 'UNMATCHED_JOURNAL'

export interface NbibIssue {
  code: NbibIssueCode
  message: string
  recordNumber: number
  tag?: string
}

export interface ParsedNbibRecord {
  issues: NbibIssue[]
  record: RawNbibRecord
}

export interface LiteratureAuthor {
  fullName: string
  abbreviatedName: string | null
}

export interface LiteratureJournalMatch {
  id: string
  canonicalName: string
  sourceTier: string
  matchedBy: 'nlm_id' | 'pubmed_abbreviation' | 'canonical_name' | 'issn'
}

export interface ParsedPublicationDate {
  raw: string | null
  year: number | null
  month: number | null
  day: number | null
  precision: LiteraturePublicationDatePrecision
}

export interface NormalizedLiteratureArticle {
  pmid: string
  doi: string | null
  doiCandidates: string[]
  pmcid: string | null
  title: string
  abstract: string | null
  abstractDisplayPolicy: LiteratureAbstractDisplayPolicy
  journalId: string | null
  journalTitle: string | null
  journalAbbreviation: string | null
  nlmJournalId: string | null
  issnValues: string[]
  publicationDateRaw: string | null
  publicationYear: number | null
  publicationMonth: number | null
  publicationDay: number | null
  publicationDatePrecision: LiteraturePublicationDatePrecision
  publicationTypes: string[]
  meshTerms: string[]
  authorKeywords: string[]
  languages: string[]
  authors: LiteratureAuthor[]
  collectiveAuthors: string[]
  affiliations: string[]
  volume: string | null
  issue: string | null
  pages: string | null
  articleNumber: string | null
  placeOfPublication: string | null
  citationSource: string | null
  conflictOfInterest: string | null
  pubmedStatus: string | null
  pubmedLastRevisedAt: string | null
  pubmedCreatedAt: string | null
  rawNbibTags: Record<string, string[]>
  metadataHash: string
  normalizedTitle: string
  normalizedTitleHash: string
  isRetracted: boolean
  isCorrection: boolean
  isConferenceAbstract: boolean
}

export interface NormalizationResult {
  article: NormalizedLiteratureArticle | null
  issues: NbibIssue[]
  journalMatch: LiteratureJournalMatch | null
}

export interface LiteratureTopicSuggestion {
  topicId: string
  confidence: number
  assignmentSource: Extract<LiteratureTopicAssignmentSource, 'query' | 'rule'>
  assignmentState: Extract<LiteratureTopicAssignmentState, 'suggested'>
  modelOrRuleVersion: string
  evidence: {
    queryId?: string
    ruleId?: string
    matchedTerms?: string[]
    matchedFields?: string[]
  }
}

export interface LiteratureValidationReport {
  reportVersion: '1.0.0'
  generatedAt: string
  elapsedMs: number
  filesScanned: number
  recordsParsed: number
  uniquePmids: number
  duplicateRecordOccurrences: number
  recordsWithoutPmids: number
  recordsWithoutTitles: number
  recordsWithoutAbstracts: number
  insertCandidates: number
  updateCandidates: number
  unchangedRecords: number
  unmatchedJournals: Record<string, number>
  conflictingDoiCandidates: number
  sourceQueryMappings: Record<string, number>
  parseErrors: Array<{
    sourceFilename: string
    recordNumber: number
    pmid: string | null
    code: NbibIssueCode
    message: string
  }>
  files: Array<{
    path: string
    sourceKind: LiteratureSourceKind
    sourceId: string | null
    queryId: string | null
    status: LiteratureManifestStatus
    recordsParsed: number
    sha256: string
  }>
}
