export enum ToolCategory {
  Clinical = 'clinical',
  Research = 'research',
  Education = 'education',
  Mobile = 'mobile',
}

export enum ProjectStatus {
  Active = 'active',
  Beta = 'beta',
  Incubating = 'incubating',
  Archived = 'archived',
}

export const toolCategoryLabels: Record<ToolCategory, string> = {
  [ToolCategory.Clinical]: 'Clinical',
  [ToolCategory.Research]: 'Research',
  [ToolCategory.Education]: 'Education',
  [ToolCategory.Mobile]: 'Mobile',
}

export const projectStatusLabels: Record<ProjectStatus, string> = {
  [ProjectStatus.Active]: 'Production Ready',
  [ProjectStatus.Beta]: 'Public Beta',
  [ProjectStatus.Incubating]: 'Incubating',
  [ProjectStatus.Archived]: 'Archived',
}

export interface GitHubRepoStats {
  stars: number
  forks: number
  openIssues: number
  watchers: number
  updatedAt: string
  defaultBranch?: string
}

export interface RepositoryReference {
  owner: string
  name: string
  url: string
  defaultBranch?: string
}

export interface ExternalLink {
  label: string
  href: string
  description?: string
}

export interface GitHubProject {
  slug: string
  name: string
  tagline: string
  description: string
  repository: RepositoryReference
  website?: string
  documentation?: string
  demoUrl?: string
  categories: ToolCategory[]
  status: ProjectStatus
  techStack: string[]
  features: string[]
  keywords: string[]
  accentColor?: string
  logo?: string
  heroImage?: string
  stats?: GitHubRepoStats
}

export type DownloadFormat = 'stl' | 'glb' | 'gltf' | 'obj' | 'zip' | 'pdf' | 'usdz' | 'tar.gz'

export type DownloadCategory = 'anatomy-model' | 'guide' | 'dataset' | 'curriculum'

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface DownloadFile {
  id: string
  slug: string
  name: string
  description: string
  category: DownloadCategory
  format: DownloadFormat
  sizeMB: number
  url: string
  thumbnail?: string
  version: string
  updatedAt: string
  estimatedPrintTime?: string
  estimatedMaterialUsage?: string
  estimatedCostUSD?: number
  difficulty: DifficultyLevel
  tags: string[]
}

export type TrainingCategory = 'rigid-bronchoscopy' | 'ebus' | 'navigation' | 'ablation' | 'stents'

export type ModuleFormat = 'theory' | 'video' | 'hands-on' | 'simulation' | 'assessment'

export interface TrainingModuleSection {
  title: string
  format: ModuleFormat
  description: string
  durationMinutes?: number
  resources?: ExternalLink[]
  checklistItems?: string[]
  videoUrl?: string
}

export interface TrainingModule {
  slug: string
  title: string
  category: TrainingCategory
  difficulty: DifficultyLevel
  durationMinutes: number
  summary: string
  objectives: string[]
  prerequisites: string[]
  equipment: string[]
  tags: string[]
  outcomes: string[]
  sections: TrainingModuleSection[]
  quiz?: {
    title: string
    questions: Array<{
      prompt: string
      options: string[]
      answerIndex: number
      explanation: string
    }>
  }
}

export type AnatomyCategory = 'airway' | 'vasculature' | 'lobes' | 'lymph-nodes'

export interface AnatomySegment {
  id: string
  name: string
  description: string
  color: string
  visibleByDefault?: boolean
  assetUrl?: string
  materialUrl?: string
}

export interface AnatomyModelAsset {
  format: DownloadFormat
  url: string
  sizeMB?: number
}

export interface AnatomyModel {
  id: string
  slug: string
  name: string
  category: AnatomyCategory
  description: string
  clinicalRelevance: string
  relatedProcedures: string[]
  downloads: AnatomyModelAsset[]
  thumbnail: string
  gallery?: string[]
  defaultCamera: {
    position: [number, number, number]
    target: [number, number, number]
  }
  orientation?: {
    rotation?: [number, number, number]
  }
  segments: AnatomySegment[]
  source?: string
  notes?: string
}

export interface BuildMaterial {
  name: string
  quantity: string
  cost?: string
  notes?: string
}

export interface BuildStep {
  title: string
  description: string
  image?: string
}

export interface BuildGuideContent {
  overview: string
  objectives: string[]
  materials: BuildMaterial[]
  printing?: {
    description?: string
    steps: string[]
  }
  assembly: BuildStep[]
  usageTips: string[]
  maintenance?: string[]
}

export interface DownloadResource {
  id: string
  name: string
  description: string
  format: DownloadFormat
  sizeMB?: number
  estimatedPrintTime?: string
  estimatedMaterialCost?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  version: string
  updatedAt: string
  previewImage?: string
}

export interface MakeProject {
  slug: string
  title: string
  tagline: string
  summary: string
  heroImage?: string
  license: string
  disclaimers: string[]
  downloads: DownloadResource[]
  buildGuide: BuildGuideContent
  resources?: Array<{ label: string; href: string; description?: string }>
}

export interface ToolDetail {
  slug: GitHubProject['slug']
  summary: string
  features: Array<{ title: string; description: string }>
  useCases: string[]
  gettingStarted: {
    requirements: string[]
    steps: string[]
  }
  demoLinks?: ExternalLink[]
  documentationLinks?: ExternalLink[]
  supportLinks?: ExternalLink[]
}

export interface GitHubContributor {
  login: string
  contributions: number
  avatarUrl: string
  profileUrl: string
  type: string
}

export interface GitHubIssueLabel {
  id: number
  name: string
  color: string
  description?: string | null
}

export interface GitHubIssue {
  id: number
  number: number
  title: string
  htmlUrl: string
  labels: GitHubIssueLabel[]
  createdAt: string
  updatedAt: string
  comments: number
  author: {
    login: string
    avatarUrl: string
    profileUrl: string
  }
}

export interface GitHubRelease {
  id: number
  tagName: string
  name?: string | null
  htmlUrl: string
  publishedAt: string
  draft: boolean
  prerelease: boolean
  body?: string | null
}
