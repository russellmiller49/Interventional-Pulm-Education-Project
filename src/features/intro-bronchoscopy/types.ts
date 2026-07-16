import type { QuizQuestion } from '@/components/training/Quiz'

export type IntroBronchoscopySectionKey = 'learn' | 'practice' | 'assessment'

export interface IntroLearnBlock {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  visual?: 'value-equation' | 'scope-anatomy' | 'airway-map' | 'icu-physiology' | 'bleeding'
}

export interface IntroSafetyNote {
  title: string
  text: string
}

export interface CaseTriageChoice {
  id: string
  label: string
  verdict: 'scope' | 'defer' | 'alternative' | 'stabilize'
  feedback: string
}

export interface CaseTriageActivity {
  type: 'case-triage'
  id: string
  title: string
  prompt: string
  cases: {
    id: string
    title: string
    scenario: string
    choices: CaseTriageChoice[]
    bestChoiceId: string
  }[]
}

export interface HotspotDiagramActivity {
  type: 'hotspot-diagram'
  id: string
  title: string
  prompt: string
  diagram: 'scope' | 'upper-airway' | 'team' | 'scope-photo-atlas'
  photoAtlas?: {
    manifestUrl: string
  }
  hotspots?: {
    id: string
    label: string
    x: number
    y: number
    teaching: string
  }[]
}

export interface SimulatorActivity {
  type: 'simulator'
  id: string
  title: string
  prompt: string
  simulator: 'ett-occlusion' | 'bal-quality' | 'stenosis' | 'ventilator' | 'suction' | 'bleeding'
}

export interface ImageDescriptionActivity {
  type: 'image-description'
  id: string
  title: string
  prompt: string
  patterns: {
    id: string
    label: string
    finding: string
    description: string
    correctDescriptors: string[]
  }[]
}

export interface MatchingActivity {
  type: 'drag-drop'
  id: string
  title: string
  prompt: string
  pairs: {
    id: string
    left: string
    right: string
  }[]
}

export interface SequenceBuilderActivity {
  type: 'sequence-builder'
  id: string
  title: string
  prompt: string
  steps: {
    id: string
    label: string
    rationale: string
  }[]
}

export interface ReportBuilderActivity {
  type: 'report-builder'
  id: string
  title: string
  prompt: string
  requiredElements: string[]
  exampleFinding: string
}

export interface ScopeExplorerActivity {
  type: 'scope-size-explorer'
  id: string
  title: string
  prompt: string
}

export type IntroPracticeActivity =
  | CaseTriageActivity
  | HotspotDiagramActivity
  | SimulatorActivity
  | ImageDescriptionActivity
  | MatchingActivity
  | SequenceBuilderActivity
  | ReportBuilderActivity
  | ScopeExplorerActivity

export interface IntroBronchoscopyModule {
  id: string
  slug: string
  title: string
  shortTitle: string
  summary: string
  estimatedMinutes: number
  objectives: string[]
  syllabusSections: string[]
  learnBlocks: IntroLearnBlock[]
  practiceActivities: IntroPracticeActivity[]
  assessmentItems: QuizQuestion[]
  assets: string[]
  safetyNotes: IntroSafetyNote[]
}
