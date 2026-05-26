export type PleuralSection =
  | 'anatomy'
  | 'ultrasound'
  | 'fluid'
  | 'thoracentesis'
  | 'chest-tube'
  | 'infection'
  | 'pneumothorax'
  | 'malignant'
  | 'outpatient'
  | 'algorithms'

export interface ClinicalStatement {
  id: string
  statement: string
  referenceIds: string[]
  lastReviewed: string
  reviewer: string
}

export interface PleuralLesson {
  id: string
  title: string
  timeMinutes: number
  objectives: string[]
  statements: ClinicalStatement[]
}

export type PleuralSourceType =
  | 'guideline'
  | 'peer-reviewed'
  | 'trial'
  | 'textbook'
  | 'web-standard'
  | 'asset-catalog'
  | 'educational-model'

export interface PleuralReference {
  id: string
  citation: string
  sourceType: PleuralSourceType
  url?: string
  useNote: string
}

export interface PleuralAsset {
  id: string
  kind: 'image' | 'clip' | 'diagram'
  path: string
  alt: string
  sourceType: 'repo' | 'creative-commons' | 'educational-diagram'
  attribution: string
  referenceIds?: string[]
  tags: string[]
}

export interface PleuralModule {
  id: string
  title: string
  route: string
  section: PleuralSection
  minutes: number
  status: 'live' | 'planned'
}
