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
  | 'dataset'
  | 'asset-catalog'
  | 'educational-model'

export type PleuralLicenseLabel =
  | 'CC BY 4.0'
  | 'CC BY-NC 4.0'
  | 'CC BY-NC-SA 4.0'
  | 'CC BY-NC-ND 4.0'
  | 'AGPL-3.0'
  | 'All rights reserved'
  | 'Mixed or row-level'
  | 'Unknown'
  | 'Repository-derived educational asset'

export type PleuralReusePolicy =
  | 'embeddable'
  | 'audit-required'
  | 'reference-only'
  | 'permission-required'

export type PleuralTransformPolicy =
  | 'derivatives-allowed'
  | 'derivatives-restricted'
  | 'no-derivatives'
  | 'not-reviewed'
  | 'not-applicable'

export type PleuralPermissionStatus =
  | 'granted-by-license'
  | 'permission-granted'
  | 'audit-required'
  | 'permission-needed'
  | 'reference-only'

export type PleuralReviewStatus = 'reviewed' | 'pending-audit' | 'reference-only'

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
  sourceType: 'repo' | 'creative-commons' | 'dataset' | 'educational-diagram'
  attribution: string
  sourceUrl: string
  license: PleuralLicenseLabel
  licenseUrl?: string
  reusePolicy: PleuralReusePolicy
  transformPolicy: PleuralTransformPolicy
  attributionRequired: boolean
  permissionStatus: PleuralPermissionStatus
  reviewStatus: PleuralReviewStatus
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
