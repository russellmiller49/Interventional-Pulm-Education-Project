export const literatureGoldSetKinds = [
  'pilot',
  'gold_standard',
  'landmark_regression',
  'hard_negative_regression',
] as const

export const literatureGoldSetStatuses = ['active', 'frozen', 'archived'] as const

export const literatureGoldSetStrata = [
  'strong_likely_ip',
  'likely_non_ip',
  'ambiguous_boundary',
  'discovery_only',
  'challenging_metadata',
  'landmark_regression',
  'hard_negative_regression',
] as const

export const literatureGoldSetDatasetSplits = ['development', 'test'] as const

export const literatureGoldSetReviewStatuses = [
  'pending',
  'in_progress',
  'return_later',
  'completed',
] as const

export const literatureGoldSetRelevanceLabels = [
  'include_core',
  'include_adjacent',
  'exclude',
  'uncertain',
] as const

export const literatureGoldSetMetadataSufficiencyLabels = [
  'adequate_abstract',
  'limited_abstract',
  'no_abstract',
  'conflicting_metadata',
] as const

export const literatureGoldSetConfidenceLabels = ['high', 'moderate', 'low'] as const

export const literatureGoldSetItemActions = [
  'return_later',
  'resume',
  'reveal_supplemental',
  'reveal_automated',
] as const

export const LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION = 'stratified-v2'
export const LITERATURE_GOLD_LOW_SCORE_THRESHOLD = 0.1
export const LITERATURE_GOLD_HIGH_SCORE_THRESHOLD = 0.75
export const DEFAULT_LITERATURE_GOLD_SET_SIZE = 900
export const DEFAULT_LITERATURE_GOLD_SET_SEED = 20_260_727
export const DEFAULT_LITERATURE_GOLD_TEST_PERCENT = 30
export const MAX_LITERATURE_GOLD_SET_SIZE = 5_000
export const MAX_LITERATURE_GOLD_REVIEW_SECONDS = 86_400
export const MAX_LITERATURE_GOLD_NOTES_LENGTH = 4_000
