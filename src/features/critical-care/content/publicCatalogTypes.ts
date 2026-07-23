import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'

import type { CriticalCareCatalogModuleDefinition, CriticalCareModuleDefinition } from './modules'

export interface PublicCriticalCarePathwayDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly moduleIds: readonly string[]
  readonly competencyIds: readonly string[]
}

export interface PublicCriticalCareCompetencyDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
}

export interface PublicCriticalCareRelatedActivity {
  readonly id: string
  readonly title: string
  readonly kind: CriticalCareActivityDefinition['kind']
  readonly href: string
}

export type PublicCriticalCareReferenceItemKind = 'reference' | 'asset'

export interface PublicCriticalCareReferenceItem {
  readonly id: string
  readonly kind: PublicCriticalCareReferenceItemKind
  readonly title: string
  readonly summary: string
  readonly moduleIds: readonly string[]
  readonly competencyIds: readonly string[]
  readonly category: string
  readonly assetType?: string
  readonly deviceVersion?: string
  readonly evidenceIds: readonly string[]
  readonly relatedActivities: readonly PublicCriticalCareRelatedActivity[]
}

export interface CriticalCarePublicClientCatalog {
  readonly launcherModules: readonly CriticalCareModuleDefinition[]
  readonly modules: readonly CriticalCareCatalogModuleDefinition[]
  readonly activities: readonly CriticalCareActivityDefinition[]
  readonly pathways: readonly PublicCriticalCarePathwayDefinition[]
  readonly competencies: readonly PublicCriticalCareCompetencyDefinition[]
  readonly referenceItems: readonly PublicCriticalCareReferenceItem[]
  readonly referenceCategories: readonly string[]
}
