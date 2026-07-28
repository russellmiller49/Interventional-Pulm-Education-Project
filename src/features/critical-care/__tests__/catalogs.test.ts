import rawAssetInventory from '../../../../docs/critical-care/asset-inventory.json'
import { baxterCrrtLearnLessons } from '@/features/baxter-crrt/content/learnLessons'
import { baxterCrrtPracticeCaseIds } from '@/features/baxter-crrt/content/curriculum'
import { baxterCrrtMasteryManifest } from '@/features/baxter-crrt/content/mastery'
import { clinicalPracticeScenarios } from '@/features/cardiohelp-ecmo/content/clinicalCases'
import { ecmoFoundationSections } from '@/features/cardiohelp-ecmo/content/foundationLessons'
import { cardiohelpLearnLessons } from '@/features/cardiohelp-ecmo/content/learnLessons'
import { cardiohelpScenarios } from '@/features/cardiohelp-ecmo/content/scenarios'
import {
  criticalCareActivities,
  validateCriticalCareActivityCatalog,
  validateCriticalCareCatalogs,
} from '@/features/critical-care/content/activities'
import {
  criticalCareAssetInventorySchema,
  criticalCareAssets,
} from '@/features/critical-care/content/assets'
import { criticalCareCompetencies } from '@/features/critical-care/content/competencies'
import {
  criticalCareModuleCatalog,
  criticalCareModules,
} from '@/features/critical-care/content/modules'
import {
  criticalCareIcuScenarioPreparation,
  criticalCarePathways,
} from '@/features/critical-care/content/pathways'
import { criticalCareReferences } from '@/features/critical-care/content/references'
import { hemodynamicCases } from '@/features/icu-hemodynamics/content/cases'
import { icuScenarios } from '@/features/icu-simulation/content/scenarios'
import { criticalCareActivityDefinitionSchema } from '@/features/learning-module/activity'
import { allMcsScenarios } from '@/features/mechanical-circulatory-support/content/scenarios'
import { mcsLessons } from '@/features/mechanical-circulatory-support/content/lessons'
import { mechanicalVentilationCases } from '@/features/mechanical-ventilation/content/runtimeCases'
import {
  MECHANICAL_VENTILATION_ASSESSMENT_ID,
  mechanicalVentilationLessonIds,
} from '@/features/mechanical-ventilation/content/lessons'
import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'

function sourceIds(moduleId: string, section: 'learn' | 'practice' | 'assess'): string[] {
  return criticalCareActivities
    .filter((activity) => activity.moduleId === moduleId && activity.id.split(':')[1] === section)
    .map((activity) => activity.id.split(':').slice(2).join(':'))
}

describe('critical-care catalogs', () => {
  it('preserves the five-card launcher order while cataloging all six modules', () => {
    expect(criticalCareModules.map((module) => module.href)).toEqual([
      '/icu-hemodynamics',
      '/mechanical-ventilation',
      '/mechanical-circulatory-support',
      '/cardiohelp-ecmo',
      '/baxter-crrt',
    ])
    expect(criticalCareModuleCatalog.map((module) => module.id)).toEqual([
      'icu-hemodynamics',
      'mechanical-ventilation',
      'mechanical-circulatory-support',
      'cardiohelp-ecmo',
      'baxter-crrt',
      'icu-simulation',
    ])
    expect(criticalCareModuleCatalog.map((module) => module.activityIdPrefix)).toEqual([
      'hemodynamics',
      'ventilation',
      'mcs',
      'ecmo',
      'crrt',
      'icu',
    ])
  })

  it('parses lightweight activity definitions with stable unique IDs', () => {
    expect(criticalCareActivities.length).toBeGreaterThanOrEqual(132)
    expect(new Set(criticalCareActivities.map((activity) => activity.id))).toHaveProperty(
      'size',
      criticalCareActivities.length,
    )

    for (const activity of criticalCareActivities) {
      expect(criticalCareActivityDefinitionSchema.safeParse(activity).success).toBe(true)
      const moduleDefinition = criticalCareModuleCatalog.find(
        (candidate) => candidate.id === activity.moduleId,
      )
      expect(moduleDefinition).toBeDefined()
      expect(activity.id).toMatch(
        new RegExp(`^${moduleDefinition?.activityIdPrefix}:(learn|practice|assess):[^:]+$`),
      )
      expect(activity.pathname).toBe(`${moduleDefinition?.href}/${activity.id.split(':')[1]}`)
      if (activity.kind === 'assessment') expect(activity.masteryRuleId).toBeTruthy()
      if (activity.reviewStatus === 'released')
        expect(activity.evidenceIds.length).toBeGreaterThan(0)
    }
  })

  it('keeps draft ventilation lessons non-credit and competency-specific during recovery', () => {
    const lessons = criticalCareActivities.filter(
      (activity) =>
        activity.moduleId === 'mechanical-ventilation' && activity.id.includes(':learn:'),
    )

    expect(lessons).toHaveLength(mechanicalVentilationLessonIds.length)
    expect(
      lessons.every(
        (activity) =>
          activity.reviewStatus === 'draft' &&
          activity.creditPolicy === 'non-credit' &&
          activity.completionEvidenceAuthority === 'none',
      ),
    ).toBe(true)
    expect(new Set(lessons.flatMap((activity) => activity.competencyIds)).size).toBeGreaterThan(2)
    expect(lessons.every((activity) => activity.competencyIds.length < 5)).toBe(true)
  })

  it('covers every requested source registry without importing those registries in production', () => {
    expect(sourceIds('icu-hemodynamics', 'learn')).toEqual([
      'catheter-advancement',
      'pressure-system',
      'waveform-interpretation',
      'pawp-capture',
      'thermodilution-series',
      'derived-hemodynamics',
      'pac-signal-validation',
    ])
    expect(sourceIds('icu-hemodynamics', 'practice')).toEqual(
      hemodynamicCases.map((definition) => definition.id),
    )
    expect(sourceIds('icu-hemodynamics', 'assess')).toEqual(['masked-seeded'])
    expect(sourceIds('mechanical-ventilation', 'learn')).toEqual(mechanicalVentilationLessonIds)
    expect(sourceIds('mechanical-ventilation', 'practice')).toEqual(
      mechanicalVentilationCases.map((definition) => definition.id),
    )
    expect(sourceIds('mechanical-ventilation', 'assess')).toEqual([
      MECHANICAL_VENTILATION_ASSESSMENT_ID,
    ])
    expect(sourceIds('mechanical-circulatory-support', 'learn')).toEqual(
      mcsLessons.map((definition) => definition.id),
    )
    expect(sourceIds('mechanical-circulatory-support', 'practice')).toEqual(
      allMcsScenarios
        .filter((definition) => definition.kind === 'practice')
        .map((definition) => definition.id),
    )
    expect(sourceIds('mechanical-circulatory-support', 'assess')).toEqual(
      allMcsScenarios
        .filter((definition) => definition.kind === 'capstone')
        .map((definition) => definition.id),
    )
    // ECMO Learn is the authored physiology sections followed by the guided drill lessons.
    expect(sourceIds('cardiohelp-ecmo', 'learn')).toEqual([
      ...ecmoFoundationSections
        .map((section) => section.id)
        .filter((id) => !id.endsWith('-capstone')),
      ...cardiohelpLearnLessons.map((definition) => definition.scenarioId),
      ...ecmoFoundationSections
        .map((section) => section.id)
        .filter((id) => id.endsWith('-capstone')),
    ])
    expect(sourceIds('cardiohelp-ecmo', 'practice')).toEqual(
      clinicalPracticeScenarios.map((definition) => definition.id),
    )
    expect(sourceIds('cardiohelp-ecmo', 'assess')).toEqual(
      cardiohelpScenarios
        .filter((definition) =>
          ['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'].includes(definition.id),
        )
        .map((definition) => definition.id),
    )
    expect(sourceIds('baxter-crrt', 'learn')).toEqual(
      baxterCrrtLearnLessons.map((definition) => definition.id),
    )
    expect(sourceIds('baxter-crrt', 'practice')).toEqual(baxterCrrtPracticeCaseIds)
    expect(sourceIds('baxter-crrt', 'assess')).toEqual([baxterCrrtMasteryManifest.id])
    expect(sourceIds('icu-simulation', 'practice')).toEqual(
      icuScenarios.map((definition) => definition.id),
    )
    expect(sourceIds('icu-simulation', 'assess')).toEqual(
      icuScenarios.map((definition) => definition.id),
    )
  })

  it('preserves the seeded hemodynamics ID while exposing its named Challenge', () => {
    const serializedCatalog = JSON.stringify(criticalCareActivities)

    expect(serializedCatalog).toContain('hemodynamics:assess:masked-seeded')
    expect(serializedCatalog).toContain('HD-07 pressure-equalization challenge')
  })

  it('uses the query keys consumed by each rebuilt module route', () => {
    const byModule = (moduleId: string) =>
      criticalCareActivities.filter((activity) => activity.moduleId === moduleId)

    for (const activity of byModule('mechanical-circulatory-support')) {
      const section = activity.id.split(':')[1]
      expect(activity.query).toEqual({
        [section === 'learn' ? 'lesson' : 'case']: activity.id.split(':').at(-1),
      })
    }
    for (const activity of byModule('baxter-crrt')) {
      const section = activity.id.split(':')[1]
      expect(activity.query).toEqual(
        section === 'assess'
          ? undefined
          : { [section === 'learn' ? 'lesson' : 'case']: activity.id.split(':').at(-1) },
      )
    }
    const ventilationAssessment = criticalCareActivities.find(
      (activity) => activity.id === 'ventilation:assess:masked-seeded',
    )
    expect(ventilationAssessment?.query).toEqual({
      case: 'masked-seeded',
      seed: 'catalog-challenge-v1',
      device: 'hamilton-c6',
    })
  })

  it('parses the documented asset inventory and enforces lightweight heavy-asset alternatives', () => {
    expect(criticalCareAssetInventorySchema.safeParse(rawAssetInventory).success).toBe(true)
    const assetIds = new Set(criticalCareAssets.map((asset) => asset.id))
    for (const asset of criticalCareAssets.filter(
      (candidate) => candidate.bandwidthClass === 'heavy',
    )) {
      expect(asset.lightweightAlternativeAssetId).toBeTruthy()
      expect(assetIds.has(asset.lightweightAlternativeAssetId ?? '')).toBe(true)
    }

    const invalid = JSON.parse(JSON.stringify(rawAssetInventory)) as Array<Record<string, unknown>>
    const heavy = invalid.find((asset) => asset.bandwidthClass === 'heavy')
    if (!heavy) throw new Error('Representative inventory must contain a heavy asset.')
    delete heavy.lightweightAlternativeAssetId
    expect(criticalCareAssetInventorySchema.safeParse(invalid).success).toBe(false)
  })

  it('resolves module, pathway, competency, asset, prerequisite, and reference links', () => {
    expect(validateCriticalCareCatalogs()).toEqual([])
    expect(new Set(criticalCarePathways.map((pathway) => pathway.id)).size).toBe(
      criticalCarePathways.length,
    )
    expect(new Set(criticalCareCompetencies.map((competency) => competency.id)).size).toBe(
      criticalCareCompetencies.length,
    )
    expect(new Set(criticalCareReferences.map((reference) => reference.id)).size).toBe(
      criticalCareReferences.length,
    )
  })

  it('maps every pathway and ICU preparation group to stable catalog targets', () => {
    const scenarioIds = new Set(icuScenarios.map((scenario) => scenario.id))
    const activityIds = new Set(criticalCareActivities.map((activity) => activity.id))
    const pathwayIds = new Set<string>(criticalCarePathways.map((pathway) => pathway.id))

    expect(criticalCareIcuScenarioPreparation.map((item) => item.scenarioId)).toEqual(
      icuScenarios.map((scenario) => scenario.id),
    )
    for (const pathway of criticalCarePathways) {
      expect(pathway.recommendedIcuScenarioIds.length).toBeGreaterThan(0)
      expect(
        pathway.recommendedIcuScenarioIds.every((scenarioId) => scenarioIds.has(scenarioId)),
      ).toBe(true)
      expect(
        criticalCareIcuScenarioPreparation
          .filter((preparation) =>
            (preparation.pathwayIds as readonly string[]).includes(pathway.id),
          )
          .map((preparation) => preparation.scenarioId),
      ).toEqual(pathway.recommendedIcuScenarioIds)
    }
    for (const preparation of criticalCareIcuScenarioPreparation) {
      expect(preparation.pathwayIds.every((pathwayId) => pathwayIds.has(pathwayId))).toBe(true)
      expect(preparation.assessRequirements.length).toBeGreaterThan(0)
      for (const requirement of preparation.assessRequirements) {
        expect(requirement.rationale.length).toBeGreaterThan(20)
        expect(requirement.anyOfActivityIds.length).toBeGreaterThan(0)
        expect(
          requirement.anyOfActivityIds.every((activityId) => activityIds.has(activityId)),
        ).toBe(true)
        expect(
          requirement.anyOfActivityIds.every((activityId) => !activityId.startsWith('icu:')),
        ).toBe(true)
      }
    }
  })

  it('reports every required activity invariant when a definition is malformed', () => {
    const base = criticalCareActivities[0]
    if (!base) throw new Error('Expected at least one critical-care activity.')
    const malformed = [
      base,
      { ...base },
      { ...base, id: 'hemodynamics:learn:unknown-module', moduleId: 'missing-module' },
      { ...base, id: 'hemodynamics:learn:unknown-pathway', pathwayIds: ['missing-pathway'] },
      {
        ...base,
        id: 'hemodynamics:learn:unknown-competency',
        competencyIds: ['missing-competency'],
      },
      { ...base, id: 'hemodynamics:learn:unknown-asset', assetIds: ['missing-asset'] },
      {
        ...base,
        id: 'hemodynamics:learn:unknown-prerequisite',
        prerequisiteActivityIds: ['missing:learn:activity'],
      },
      {
        ...base,
        id: 'hemodynamics:learn:released-without-evidence',
        reviewStatus: 'released',
        evidenceIds: [],
      },
      {
        ...base,
        id: 'hemodynamics:assess:missing-mastery',
        kind: 'assessment',
        masteryRuleId: undefined,
      },
    ] as readonly CriticalCareActivityDefinition[]

    const errors = validateCriticalCareActivityCatalog(malformed).join('\n')
    expect(errors).toMatch(/unique/)
    expect(errors).toMatch(/unknown module/)
    expect(errors).toMatch(/unknown pathway/)
    expect(errors).toMatch(/unknown competency/)
    expect(errors).toMatch(/unknown asset/)
    expect(errors).toMatch(/unknown prerequisite/)
    expect(errors).toMatch(/released activity requires evidence/)
    expect(errors).toMatch(/assessment requires a mastery rule/)
  })
})
