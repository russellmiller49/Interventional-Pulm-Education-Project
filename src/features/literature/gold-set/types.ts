import type {
  literatureGoldSetConfidenceLabels,
  literatureGoldSetDatasetSplits,
  literatureGoldSetItemActions,
  literatureGoldSetKinds,
  literatureGoldSetMetadataSufficiencyLabels,
  literatureGoldSetRelevanceLabels,
  literatureGoldSetReviewStatuses,
  literatureGoldSetStatuses,
  literatureGoldSetStrata,
} from './constants'

export type LiteratureGoldSetKind = (typeof literatureGoldSetKinds)[number]
export type LiteratureGoldSetStatus = (typeof literatureGoldSetStatuses)[number]
export type LiteratureGoldSetStratum = (typeof literatureGoldSetStrata)[number]
export type LiteratureGoldSetDatasetSplit = (typeof literatureGoldSetDatasetSplits)[number]
export type LiteratureGoldSetReviewStatus = (typeof literatureGoldSetReviewStatuses)[number]
export type LiteratureGoldSetItemAction = (typeof literatureGoldSetItemActions)[number]
export type LiteratureGoldSetRelevanceLabel = (typeof literatureGoldSetRelevanceLabels)[number]
export type LiteratureGoldSetMetadataSufficiency =
  (typeof literatureGoldSetMetadataSufficiencyLabels)[number]
export type LiteratureGoldSetConfidence = (typeof literatureGoldSetConfidenceLabels)[number]

export interface LiteratureGoldSamplingCandidate {
  pmid: string
  journalId: string | null
  journalLabel: string
  publicationYear: number | null
  hasAbstract: boolean
  isConferenceAbstract: boolean
  isLandmark: boolean
  sourceKinds: string[]
  sourceCount: number
  sourceFileCount: number
  queryIds: string[]
  suggestedTopicIds: string[]
  suggestionCount: number
  maxSuggestionConfidence: number
}

export type LiteratureGoldDeterministicBand = 'high' | 'intermediate' | 'low'

export interface LiteratureGoldSampledItem {
  pmid: string
  sampleStratum: LiteratureGoldSetStratum
  samplingReason: string
  samplingMetadata: {
    deterministicBand: LiteratureGoldDeterministicBand
    deterministicScore: number
    hasAbstract: boolean
    isConferenceAbstract: boolean
    journal: string
    queryIds: string[]
    rareTopicIds: string[]
    sourceFileCount: number
    sourceKinds: string[]
    sourceTier: string
    suggestedTopicIds: string[]
    yearBand: string
  }
  datasetSplit: LiteratureGoldSetDatasetSplit
  displayOrder: number
}

export interface LiteratureGoldSamplingReport {
  reportVersion: '1.1.0'
  generatedAt: string
  name: string
  kind: LiteratureGoldSetKind
  samplingSeed: number
  samplingAlgorithmVersion: string
  requestedSize: number
  originalCandidateCount: number
  excludedCandidateCount: number
  candidateCount: number
  selectedCount: number
  developmentCount: number
  testCount: number
  countsByStratum: Record<string, number>
  countsBySourceTier: Record<string, number>
  countsByYearBand: Record<string, number>
  countsByAbstractAvailability: Record<string, number>
  countsByJournal: Record<string, number>
  countsByDeterministicBand: Record<string, number>
  broadTopicsRepresented: string[]
  broadTopicsUnavailable: string[]
  warnings: string[]
  items: LiteratureGoldSampledItem[]
}

export type LiteratureGoldStoredSamplingReport =
  | Omit<LiteratureGoldSamplingReport, 'items'>
  | (Omit<
      LiteratureGoldSamplingReport,
      'reportVersion' | 'originalCandidateCount' | 'excludedCandidateCount' | 'items'
    > & {
      reportVersion: '1.0.0'
    })

export interface LiteratureGoldReviewPayload {
  relevanceLabel: LiteratureGoldSetRelevanceLabel | null
  metadataSufficiency: LiteratureGoldSetMetadataSufficiency | null
  reviewerConfidence: LiteratureGoldSetConfidence | null
  topicIds: string[]
  technologyTags: string[]
  clinicalPurposes: string[]
  diseaseTags: string[]
  studyDesign: string | null
  publicationStatus: string | null
  categorizationFromFullText: boolean
  notes: string
  usedSupplementalMetadata: boolean
  reviewSeconds: number
}

export interface LiteratureGoldSetBatchSummary {
  id: string
  name: string
  kind: LiteratureGoldSetKind
  status: LiteratureGoldSetStatus
  requestedSize: number
  totalCount: number
  completedCount: number
  remainingCount: number
  returnLaterCount: number
  developmentCount: number
  developmentCompletedCount: number
  testCount: number
  testCompletedCount: number
  testUnlockedAt: string | null
  testUnlockedByEmail: string | null
  samplingSeed: number
  samplingReport: LiteratureGoldStoredSamplingReport | null
  createdAt: string
  frozenAt: string | null
}

export interface LiteratureGoldReviewRecord extends LiteratureGoldReviewPayload {
  id: string
  revision: number
  reviewerEmail: string | null
  isBlinded: boolean
  completedAt: string
}

export interface LiteratureGoldReviewArticle {
  pmid: string
  title: string
  abstract: string | null
  authors: Array<{ fullName: string; abbreviatedName: string | null }>
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  publicationTypes: string[]
  meshTerms?: string[]
  authorKeywords?: string[]
}

export interface LiteratureGoldAutomatedSignals {
  sampleStratum: LiteratureGoldSetStratum
  samplingReason: string
  samplingMetadata: Record<string, unknown>
  sources: Array<{
    sourceKind: string
    sourceId: string | null
    queryId: string | null
    sourceFilename: string
  }>
  suggestions: Array<{
    topicId: string
    confidence: number | null
    assignmentSource: string
    evidence: Record<string, unknown> | null
  }>
}

export interface LiteratureGoldReviewItem {
  id: string
  batchId: string
  batchName: string
  batchStatus: LiteratureGoldSetStatus
  displayOrder: number
  totalCount: number
  completedCount: number
  remainingCount: number
  reviewStatus: LiteratureGoldSetReviewStatus
  article: LiteratureGoldReviewArticle
  draft: LiteratureGoldReviewPayload | null
  currentReview: LiteratureGoldReviewRecord | null
  reviewHistory: LiteratureGoldReviewRecord[]
  supplementalMetadataRevealed: boolean
  automatedSignalsRevealed: boolean
  automatedSignals: LiteratureGoldAutomatedSignals | null
  previousItemId: string | null
  nextItemId: string | null
  nextUnresolvedItemId: string | null
}
