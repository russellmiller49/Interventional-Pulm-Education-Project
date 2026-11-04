/**
 * The blueprint crosswalk: a versioned map from the AABIP IP board blueprint to the Navigator's
 * domains and topics. The two domain weights are the published 2024 figures; topic weights are not
 * entered until they are read from the blueprint itself, so nothing here is a guessed percentage.
 * A new blueprint year is a new version of this file, not an edit to a learner's history.
 */
export const BLUEPRINT_VERSION = {
  id: 'aabip-2024',
  label: 'AABIP IP Board Examination Blueprint, 2024',
  sourceId: 'aabip-blueprint-2024',
  retrievedOn: '2026-11-03',
} as const

export type DomainId = 'disease' | 'procedural'

export interface BlueprintDomain {
  readonly id: DomainId
  readonly title: string
  readonly short: string
  /** Published share of the examination, as a percentage. */
  readonly weightPercent: number
  readonly description: string
}

export const BLUEPRINT_DOMAINS: readonly BlueprintDomain[] = [
  {
    id: 'disease',
    title: 'Disease-specific knowledge',
    short: 'Disease',
    weightPercent: 50.4,
    description:
      'Thoracic oncology and staging, airway obstruction, physiology and sedation, pleural disease, transplant and other lung disease, ethics, palliative care, statistics and surgical interfaces.',
  },
  {
    id: 'procedural',
    title: 'Procedural knowledge',
    short: 'Procedural',
    weightPercent: 49.6,
    description:
      'EBUS, advanced diagnostic bronchoscopy, rigid bronchoscopy, pleural procedures, airway ablation and dilation, stenting, lung-volume reduction, tracheostomy and other procedural concepts.',
  },
]

export type TopicId =
  | 'thoracic-oncology-staging'
  | 'malignant-airway-obstruction'
  | 'nonmalignant-airway-obstruction'
  | 'physiology-anesthesia-sedation'
  | 'pleural-disease'
  | 'transplant-other-lung-disease'
  | 'ethics-palliative-statistics-surgery'
  | 'ebus'
  | 'advanced-diagnostic-bronchoscopy'
  | 'rigid-bronchoscopy'
  | 'pleural-procedures'
  | 'airway-ablation-dilation'
  | 'airway-stenting'
  | 'lung-volume-reduction'
  | 'tracheostomy'

export interface BlueprintTopic {
  readonly id: TopicId
  readonly domainId: DomainId
  readonly title: string
  /** Blueprint topic weight, once read from the blueprint. Null until then; never guessed. */
  readonly weightPercent: number | null
  /** Where this topic sits in the pilot: objectives authored, or not yet. */
  readonly pilot: boolean
}

export const BLUEPRINT_TOPICS: readonly BlueprintTopic[] = [
  {
    id: 'thoracic-oncology-staging',
    domainId: 'disease',
    title: 'Thoracic oncology and staging',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'malignant-airway-obstruction',
    domainId: 'disease',
    title: 'Malignant central airway obstruction',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'nonmalignant-airway-obstruction',
    domainId: 'disease',
    title: 'Non-malignant airway obstruction',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'physiology-anesthesia-sedation',
    domainId: 'disease',
    title: 'Physiology, anesthesia and sedation',
    weightPercent: null,
    pilot: false,
  },
  {
    id: 'pleural-disease',
    domainId: 'disease',
    title: 'Pleural disease',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'transplant-other-lung-disease',
    domainId: 'disease',
    title: 'Transplant and other lung disease',
    weightPercent: null,
    pilot: false,
  },
  {
    id: 'ethics-palliative-statistics-surgery',
    domainId: 'disease',
    title: 'Ethics, palliative care, statistics and surgical interfaces',
    weightPercent: null,
    pilot: false,
  },
  {
    id: 'ebus',
    domainId: 'procedural',
    title: 'Endobronchial ultrasound',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'advanced-diagnostic-bronchoscopy',
    domainId: 'procedural',
    title: 'Advanced diagnostic bronchoscopy',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'rigid-bronchoscopy',
    domainId: 'procedural',
    title: 'Rigid bronchoscopy',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'pleural-procedures',
    domainId: 'procedural',
    title: 'Pleural procedures',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'airway-ablation-dilation',
    domainId: 'procedural',
    title: 'Airway ablation and dilation',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'airway-stenting',
    domainId: 'procedural',
    title: 'Airway stenting',
    weightPercent: null,
    pilot: true,
  },
  {
    id: 'lung-volume-reduction',
    domainId: 'procedural',
    title: 'Bronchoscopic lung-volume reduction',
    weightPercent: null,
    pilot: false,
  },
  {
    id: 'tracheostomy',
    domainId: 'procedural',
    title: 'Tracheostomy',
    weightPercent: null,
    pilot: false,
  },
]

const domainById = new Map(BLUEPRINT_DOMAINS.map((domain) => [domain.id, domain]))
const topicById = new Map(BLUEPRINT_TOPICS.map((topic) => [topic.id, topic]))

export function blueprintDomain(id: DomainId): BlueprintDomain {
  const domain = domainById.get(id)
  if (!domain) throw new Error(`board-navigator: no blueprint domain "${id}"`)
  return domain
}

export function blueprintTopic(id: TopicId): BlueprintTopic {
  const topic = topicById.get(id)
  if (!topic) throw new Error(`board-navigator: no blueprint topic "${id}"`)
  return topic
}

export function topicsInDomain(domainId: DomainId): readonly BlueprintTopic[] {
  return BLUEPRINT_TOPICS.filter((topic) => topic.domainId === domainId)
}
