import { criticalCareActivities } from './activities'
import { criticalCareAssets } from './assets'
import { criticalCareCompetencies } from './competencies'
import { criticalCareModuleCatalog, criticalCareModules } from './modules'
import { criticalCarePathways } from './pathways'
import {
  criticalCarePublicModuleIdsForReference,
  isCriticalCareActivityPubliclyCataloged,
  isCriticalCareAssetPubliclyCataloged,
  isCriticalCareModulePubliclyCataloged,
  presentCriticalCareActivityPublicly,
  sanitizeCriticalCareActivityForPublicCatalog,
} from './publicVisibility'
import { criticalCareReferenceCategories, criticalCareReferences } from './references'
import type {
  CriticalCarePublicClientCatalog,
  PublicCriticalCarePathwayDefinition,
  PublicCriticalCareReferenceItem,
} from './publicCatalogTypes'

const publicPathwayDescriptionOverrides: Readonly<Record<string, string>> = {
  'acute-respiratory-failure':
    'Progress from mechanics and ventilator interaction to reviewed multisystem support skills.',
  'cardiogenic-and-rv-shock':
    'Link hemodynamic phenotype to modeled circulatory-support decisions and reassessment.',
  'multiorgan-critical-illness':
    'Combine reviewed focused skills across hemodynamic, ventilation, circulatory, and renal support activities.',
}

function titleFromAssetId(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * The only bridge from the complete authoring catalog to public Critical Care client components.
 * Keep this module server-owned: its return value intentionally omits draft/private module data,
 * private scenario fields, and authoring-only metadata before React serializes client props.
 */
export function buildCriticalCarePublicClientCatalog(): CriticalCarePublicClientCatalog {
  const modules = criticalCareModuleCatalog.filter((module) =>
    isCriticalCareModulePubliclyCataloged(module.id),
  )
  const moduleIds = new Set<string>(modules.map((module) => module.id))
  const activities = criticalCareActivities
    .filter(isCriticalCareActivityPubliclyCataloged)
    .map(sanitizeCriticalCareActivityForPublicCatalog)
  const activityById = new Map(activities.map((activity) => [activity.id, activity]))
  const competencyIds = new Set(activities.flatMap((activity) => activity.competencyIds))
  const competencies = criticalCareCompetencies
    .filter((competency) => competencyIds.has(competency.id))
    .map(({ id, title, description }) => ({ id, title, description }))

  const referenceRecords: readonly PublicCriticalCareReferenceItem[] =
    criticalCareReferences.flatMap((reference) => {
      const publicModuleIds = criticalCarePublicModuleIdsForReference(reference)
      if (publicModuleIds.length === 0) return []
      return [
        {
          id: reference.id,
          kind: 'reference' as const,
          title: reference.title,
          summary: reference.summary,
          moduleIds: publicModuleIds,
          competencyIds: reference.competencyIds.filter((id) => competencyIds.has(id)),
          category: reference.category,
          evidenceIds: reference.evidenceIds,
          relatedActivities: reference.relatedActivityIds.flatMap((activityId) => {
            const activity = activityById.get(activityId)
            if (!activity) return []
            const presentation = presentCriticalCareActivityPublicly(activity)
            return [
              {
                id: activity.id,
                title: presentation.title,
                kind: activity.kind,
                href: presentation.href,
              },
            ]
          }),
        },
      ]
    })

  const assetRecords: readonly PublicCriticalCareReferenceItem[] = criticalCareAssets
    .filter(isCriticalCareAssetPubliclyCataloged)
    .map((asset) => ({
      id: asset.id,
      kind: 'asset' as const,
      title: titleFromAssetId(asset.id),
      summary: asset.accessibilityAlternative,
      moduleIds: [asset.moduleId],
      competencyIds: asset.competencyIds.filter((id) => competencyIds.has(id)),
      category: 'asset',
      assetType: asset.kind,
      ...(asset.deviceVersion ? { deviceVersion: asset.deviceVersion } : {}),
      evidenceIds: asset.evidenceIds,
      relatedActivities: [],
    }))

  const referenceItems = [...referenceRecords, ...assetRecords]
  const categoriesInUse = new Set(referenceItems.map((item) => item.category))
  const pathways: readonly PublicCriticalCarePathwayDefinition[] = criticalCarePathways.flatMap(
    (pathway) => {
      const publicModuleIds = pathway.moduleIds.filter((moduleId) => moduleIds.has(moduleId))
      if (publicModuleIds.length === 0) return []
      return [
        {
          id: pathway.id,
          title: pathway.title,
          description: publicPathwayDescriptionOverrides[pathway.id] ?? pathway.description,
          stage:
            publicModuleIds.length === pathway.moduleIds.length ? 'released' : ('preview' as const),
          moduleIds: publicModuleIds,
          competencyIds: pathway.competencyIds.filter((competencyId) =>
            competencyIds.has(competencyId),
          ),
        },
      ]
    },
  )

  return {
    launcherModules: criticalCareModules.filter((module) => moduleIds.has(module.slug)),
    modules,
    activities,
    pathways,
    competencies,
    referenceItems,
    referenceCategories: criticalCareReferenceCategories.filter((category) =>
      categoriesInUse.has(category),
    ),
  }
}
