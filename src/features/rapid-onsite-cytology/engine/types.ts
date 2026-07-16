export type CytologyMode = 'learn' | 'quiz'

export type AnnotationCategory =
  | 'adenocarcinoma'
  | 'squamous-cell-carcinoma'
  | 'small-cell-carcinoma'
  | 'granuloma'
  | 'infection'
  | 'adequacy'
  | 'background'

export interface PercentPoint {
  xPct: number
  yPct: number
}

export interface ImageDimensions {
  width: number
  height: number
}

export interface CytologyAnnotationShape {
  type: 'ellipse'
  xPct: number
  yPct: number
  radiusXPct: number
  radiusYPct: number
}

export interface CytologyQuizChoice {
  id: string
  label: string
}

export interface CytologyQuizPrompt {
  prompt: string
  choices: CytologyQuizChoice[]
  correctChoiceId: string
}

export interface CytologyAnnotation {
  id: string
  label: string
  cellType: string
  category: AnnotationCategory
  shape: CytologyAnnotationShape
  featureTags: string[]
  explanation: string
  diagnosticSignificance: string
  pitfall: string
  quiz: CytologyQuizPrompt
}

export interface CytologySlideSource {
  articleTitle: string
  articleUrl: string
  license: string
  licenseUrl: string
  attribution: string
  modificationNote: string
}

export interface CytologySlide {
  id: string
  title: string
  quizTitle: string
  shortTitle: string
  diagnosisTheme: string
  stain: string
  preparation: string
  imageUrl: string
  imageAlt: string
  quizImageAlt: string
  source: CytologySlideSource
  learningObjectives: string[]
  annotations: CytologyAnnotation[]
}
