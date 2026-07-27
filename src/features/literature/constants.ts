export const literatureSourceKinds = [
  'core_journal',
  'expanded_journal',
  'all_pubmed_discovery',
  'manual_landmark',
  'publisher_supplement',
  'unmapped',
] as const

export const literatureManifestStatuses = ['mapped', 'needs_mapping'] as const

export const literatureRelevanceStates = [
  'unreviewed',
  'candidate',
  'included',
  'excluded',
] as const

export const literatureVisibilityStates = ['draft', 'published', 'hidden'] as const

export const literatureAbstractDisplayPolicies = ['hidden', 'snippet_only', 'full_allowed'] as const

export const literaturePublicationDatePrecisions = [
  'day',
  'month',
  'year',
  'season',
  'unknown',
] as const

export const literatureTopicAssignmentSources = ['query', 'rule', 'ai', 'human'] as const

export const literatureTopicAssignmentStates = ['suggested', 'confirmed', 'rejected'] as const

export const literatureSortValues = ['relevance', 'newest', 'oldest', 'journal'] as const

export const DEFAULT_LITERATURE_PAGE_SIZE = 20
export const MAX_LITERATURE_PAGE_SIZE = 50
export const MAX_LITERATURE_QUERY_LENGTH = 300
export const MAX_LITERATURE_REASON_LENGTH = 2_000
export const DEFAULT_LITERATURE_IMPORT_BATCH_SIZE = 300
export const MAX_LITERATURE_IMPORT_BATCH_SIZE = 500

export const NBIB_RULE_VERSION = 'nbib-normalization-v1'
export const QUERY_SUGGESTION_CONFIDENCE = 0.55

export const supportedNbibTags = new Set([
  'PMID',
  'PMC',
  'OWN',
  'STAT',
  'DCOM',
  'LR',
  'IS',
  'VI',
  'IP',
  'DP',
  'TI',
  'PG',
  'LID',
  'AB',
  'CI',
  'FAU',
  'AU',
  'CN',
  'AD',
  'LA',
  'PT',
  'PL',
  'TA',
  'JT',
  'JID',
  'SB',
  'MH',
  'OT',
  'COIS',
  'EDAT',
  'MHDA',
  'CRDT',
  'PHST',
  'AID',
  'PST',
  'SO',
  'RIN',
  'ROF',
  'CRI',
  'SI',
])
