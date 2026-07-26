import type {
  CriticalCareActivityDefinition,
  CriticalCareReviewStatus,
} from '@/features/learning-module/activity'

import type { CriticalCareAssetDefinition } from './assets'
import { criticalCareCatalogModuleIds, type CriticalCareCatalogModuleId } from './modules'
import type { CriticalCareReferenceDefinition } from './references'
import { criticalCareCatalogActivityHref } from './activityRoutes'

export type CriticalCarePublicCatalogStage = 'public-unlisted' | 'draft' | 'private'

/**
 * Content-publication policy for the unlisted parent. This is deliberately separate from route
 * authorization and from showing a stable module launcher: a module can remain reachable by an
 * audited direct URL without publishing its draft activity catalog. Release-boundary tests lock
 * this map to each module's source-owned release constant.
 */
export const criticalCarePublicCatalogStageByModule: Readonly<
  Record<CriticalCareCatalogModuleId, CriticalCarePublicCatalogStage>
> = Object.freeze({
  'icu-hemodynamics': 'public-unlisted',
  'mechanical-ventilation': 'public-unlisted',
  'mechanical-circulatory-support': 'public-unlisted',
  'cardiohelp-ecmo': 'draft',
  'baxter-crrt': 'public-unlisted',
  'icu-simulation': 'private',
})

export const criticalCarePublicReviewStatuses = Object.freeze([
  'released',
  'sme-review',
] as const satisfies readonly CriticalCareReviewStatus[])

const publicReviewStatuses = new Set<CriticalCareReviewStatus>(criticalCarePublicReviewStatuses)

export function isCriticalCareModulePubliclyCataloged(
  moduleId: CriticalCareCatalogModuleId,
): boolean {
  return criticalCarePublicCatalogStageByModule[moduleId] === 'public-unlisted'
}

export const criticalCarePublicCatalogModuleIds: readonly CriticalCareCatalogModuleId[] =
  Object.freeze(criticalCareCatalogModuleIds.filter(isCriticalCareModulePubliclyCataloged))

const publicCatalogModuleIds = new Set<string>(criticalCarePublicCatalogModuleIds)

/**
 * The Critical Care center is itself an unlisted, noindex route. Focused draft modules may retain
 * a launcher there without publishing their draft activities, references, or assets into the
 * reviewed catalog. Private-development modules remain excluded.
 */
export function isCriticalCareModuleVisibleInUnlistedCenter(
  moduleId: CriticalCareCatalogModuleId,
): boolean {
  return criticalCarePublicCatalogStageByModule[moduleId] !== 'private'
}

export const criticalCareUnlistedCenterModuleIds: readonly CriticalCareCatalogModuleId[] =
  Object.freeze(criticalCareCatalogModuleIds.filter(isCriticalCareModuleVisibleInUnlistedCenter))

export function isCriticalCareReferencePubliclyCataloged(
  reference: CriticalCareReferenceDefinition,
): boolean {
  return reference.moduleIds.some(isCriticalCareModulePubliclyCataloged)
}

export function criticalCarePublicModuleIdsForReference(
  reference: CriticalCareReferenceDefinition,
): readonly CriticalCareCatalogModuleId[] {
  return reference.moduleIds.filter(isCriticalCareModulePubliclyCataloged)
}

export function isCriticalCareAssetPubliclyCataloged(asset: CriticalCareAssetDefinition): boolean {
  return publicCatalogModuleIds.has(asset.moduleId)
}

export function isCriticalCareActivityPubliclyCataloged(
  activity: CriticalCareActivityDefinition,
): boolean {
  return (
    isCriticalCareModulePubliclyCataloged(activity.moduleId as CriticalCareCatalogModuleId) &&
    publicReviewStatuses.has(activity.reviewStatus)
  )
}

export interface PublicCriticalCareActivityPresentation {
  readonly title: string
  readonly description: string
  readonly href: string
  readonly maskedAssessment: boolean
}

/**
 * Public challenge cards keep the stable activity identity and direct route. Publication review
 * remains separate from learner preparation; no progress state is consulted here.
 */
export function presentCriticalCareActivityPublicly(
  activity: CriticalCareActivityDefinition,
): PublicCriticalCareActivityPresentation {
  if (activity.kind === 'assessment') {
    return {
      title: activity.title,
      description:
        'A harder case with less help. Feedback comes at the end so you can work through it uninterrupted.',
      href: criticalCareCatalogActivityHref(activity),
      maskedAssessment: false,
    }
  }

  return {
    title: activity.title,
    description: activity.description,
    href: criticalCareCatalogActivityHref(activity),
    maskedAssessment: false,
  }
}

export function sanitizeCriticalCareActivityForPublicCatalog(
  activity: CriticalCareActivityDefinition,
): CriticalCareActivityDefinition {
  const presentation = presentCriticalCareActivityPublicly(activity)
  return {
    ...activity,
    title: presentation.title,
    description: presentation.description,
  }
}
