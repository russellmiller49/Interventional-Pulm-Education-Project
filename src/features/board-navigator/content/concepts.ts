/**
 * Cross-cutting concept tags. A misconception often lives in more than one blueprint topic; the tag
 * lets the map show the same idea wherever it appears, and lets a learner search by the kind of
 * reasoning rather than the exam heading.
 */
export type ConceptTag =
  | 'anatomy'
  | 'imaging-interpretation'
  | 'mechanism'
  | 'strategy-selection'
  | 'contraindication'
  | 'complication'
  | 'rescue'
  | 'evidence-interpretation'
  | 'cognitive-error'
  | 'team-decision'

export const CONCEPT_TAG_LABELS: Readonly<Record<ConceptTag, string>> = {
  anatomy: 'Anatomy',
  'imaging-interpretation': 'Imaging interpretation',
  mechanism: 'Mechanism',
  'strategy-selection': 'Strategy selection',
  contraindication: 'Contraindications',
  complication: 'Complications',
  rescue: 'Rescue',
  'evidence-interpretation': 'Evidence interpretation',
  'cognitive-error': 'Cognitive errors',
  'team-decision': 'Team decisions',
}

export const CONCEPT_TAGS = Object.keys(CONCEPT_TAG_LABELS) as readonly ConceptTag[]
