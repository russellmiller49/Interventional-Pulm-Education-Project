/**
 * C2 §4 — the CRRT Learn pathway follows the recommended novice progression, and nothing about
 * that progression is bought with a persistent identifier, a route, a storage key, or a gate.
 *
 * The progression is nine steps over eight sections: `crrt-prescription-dosing` carries both
 * "prescription construction" and "prescribed versus delivered dose", which is exactly the split
 * the staged builder inside it makes visible.
 */
import {
  criticalCareActivities,
  criticalCareActivityById,
  validateCriticalCareCatalogs,
} from '@/features/critical-care/content/activities'
import {
  criticalCareLearningPathway,
  validateCriticalCareLearningPathways,
} from '@/features/critical-care/content/learningPathways'
import { getCriticalCareRecommendations } from '@/features/critical-care/progress/recommendation'
import type { CriticalCareProgressEnvelope } from '@/features/learning-module/activity/types'

import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { baxterCrrtLearnLessons } from '../content/learnLessons'
import { baxterCrrtLessonClinicalAnchors } from '../content/lessonClinicalAnchors'
import { nextRecommendedCrrtActivity } from '../content/curriculum'
import { createDefaultProgress } from '../engine/progress'

/**
 * The authored order, written once here as the thing every other surface is compared against.
 * A step label is attached to each id so a future reader can see which of the nine progression
 * steps a section is carrying.
 */
const NOVICE_PROGRESSION = [
  { step: 'treatment trajectory', id: 'crrt-indications-modality' },
  { step: 'universal circuit', id: 'crrt-circuit-pressures' },
  { step: 'transport mechanisms', id: 'crrt-solute-transport' },
  {
    step: 'prescription construction and prescribed versus delivered dose',
    id: 'crrt-prescription-dosing',
  },
  { step: 'pressure localization', id: 'crrt-alarms-troubleshooting' },
  { step: 'citrate', id: 'crrt-anticoagulation' },
  { step: 'fluid management', id: 'crrt-fluid-liberation' },
  { step: 'integration', id: 'crrt-pressure-profile-integration' },
] as const

/** Every section id and activity id that existed before this package. None may disappear. */
const PERSISTENT_SECTION_IDS = [
  'crrt-indications-modality',
  'crrt-circuit-pressures',
  'crrt-solute-transport',
  'crrt-prescription-dosing',
  'crrt-anticoagulation',
  'crrt-alarms-troubleshooting',
  'crrt-fluid-liberation',
  'crrt-pressure-profile-integration',
] as const

const EMPTY_ENVELOPE: CriticalCareProgressEnvelope = {
  version: 1,
  activities: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
}

const pathway = criticalCareLearningPathway('baxter-crrt')
const crrtLearnActivities = criticalCareActivities.filter((activity) =>
  activity.id.startsWith('crrt:learn:'),
)

describe('CRRT Learn pathway sequencing', () => {
  it('follows trajectory, circuit, transport, prescription and delivered dose, pressures, citrate, fluid, integration', () => {
    expect(pathway.sections.map((section) => section.id)).toEqual(
      NOVICE_PROGRESSION.map((entry) => entry.id),
    )
  })

  it('keeps every pre-existing section id present and unique', () => {
    const ids = pathway.sections.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...PERSISTENT_SECTION_IDS].sort())
  })

  it('keeps every pre-existing activity id present and unique', () => {
    const ids = crrtLearnActivities.map((activity) => activity.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(
      [...PERSISTENT_SECTION_IDS].map((id) => `crrt:learn:${id}`).sort(),
    )
  })

  /**
   * The catalog-metadata proof. `validateCriticalCareLearningPathways` requires a pathway to
   * visit each `curriculumStage` in ascending `stageOrder`; the pathway cannot carry an ordinal
   * of its own. So the progression above is not representable through the pathway and the
   * CRRT-local surfaces alone: with the pre-existing application ordinals
   * (anticoagulation 1, alarms 2) the reordered pathway reports an out-of-order stage and the
   * whole critical-care catalog throws at import.
   */
  it('is representable only because the CRRT application ordinals follow the pathway', () => {
    expect(validateCriticalCareLearningPathways(criticalCareActivities)).toEqual([])
    expect(validateCriticalCareCatalogs()).toEqual([])

    const applicationOrdinals = pathway.sections
      .map((section) => criticalCareActivityById.get(section.activityId))
      .filter((activity) => activity?.curriculumStage === 'application')
      .map((activity) => activity!.stageOrder)
    expect(applicationOrdinals).toEqual([...applicationOrdinals].sort((a, b) => a - b))

    // The defect this pins: restoring the previous ordinals reintroduces the error the
    // pathway-order rule exists to catch.
    const regressed = criticalCareActivities.map((activity) =>
      activity.id === 'crrt:learn:crrt-alarms-troubleshooting'
        ? { ...activity, stageOrder: 2 }
        : activity.id === 'crrt:learn:crrt-anticoagulation'
          ? { ...activity, stageOrder: 1 }
          : activity,
    )
    expect(validateCriticalCareLearningPathways(regressed)).toEqual([
      'baxter-crrt::/crrt-anticoagulation: stageOrder 1 is out of order within application',
    ])
  })

  it('keeps the catalog seed order equal to the pathway order, which is what the hub reads', () => {
    expect(crrtLearnActivities.map((activity) => activity.id)).toEqual(
      pathway.sections.map((section) => section.activityId),
    )
  })

  it('agrees with the module recommender and the shared hub on where a novice begins', () => {
    const pathwayStart = pathway.sections[0]?.activityId
    expect(pathwayStart).toBe('crrt:learn:crrt-indications-modality')

    // CRRT-local recommendation.
    expect(nextRecommendedCrrtActivity(createDefaultProgress())).toMatchObject({
      kind: 'lesson',
      id: 'crrt-indications-modality',
    })

    // Shared hub recommendation, restricted to this module.
    const hubStart = getCriticalCareRecommendations(criticalCareActivities, EMPTY_ENVELOPE, {
      allowedReviewStatuses: ['released', 'sme-review'],
      preferredModuleIds: ['baxter-crrt'],
      limit: 200,
    }).find((item) => item.activity.moduleId === 'baxter-crrt')?.activity.id
    expect(hubStart).toBe(pathwayStart)
  })

  it('walks the lesson registry, the lessons, and the anchors in the same new order', () => {
    expect([...BAXTER_CRRT_LEARN_LESSON_IDS]).toEqual(NOVICE_PROGRESSION.map((entry) => entry.id))
    expect(baxterCrrtLearnLessons.map((lesson) => lesson.id)).toEqual([
      ...BAXTER_CRRT_LEARN_LESSON_IDS,
    ])
    expect(Object.keys(baxterCrrtLessonClinicalAnchors)).toEqual([...BAXTER_CRRT_LEARN_LESSON_IDS])
  })

  it('keeps the integration capstone last and alone', () => {
    expect(pathway.sections.at(-1)?.id).toBe('crrt-pressure-profile-integration')
    expect(pathway.sections.at(-1)?.stage).toBe('integration')
    expect(pathway.sections.filter((section) => section.stage === 'integration')).toHaveLength(1)
    expect(crrtLearnActivities.at(-1)?.id).toBe('crrt:learn:crrt-pressure-profile-integration')
  })

  it('leaves every route, query, storage envelope, and publication field untouched', () => {
    expect(
      crrtLearnActivities.map((activity) => ({
        id: activity.id,
        pathname: activity.pathname,
        query: activity.query,
        contentVersion: activity.contentVersion,
        reviewStatus: activity.reviewStatus,
      })),
    ).toEqual([
      {
        id: 'crrt:learn:crrt-indications-modality',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-indications-modality' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-circuit-pressures',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-circuit-pressures' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-solute-transport',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-solute-transport' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-prescription-dosing',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-prescription-dosing' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-alarms-troubleshooting',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-alarms-troubleshooting' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-anticoagulation',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-anticoagulation' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-fluid-liberation',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-fluid-liberation' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
      {
        id: 'crrt:learn:crrt-pressure-profile-integration',
        pathname: '/baxter-crrt/learn',
        query: { lesson: 'crrt-pressure-profile-integration' },
        contentVersion: 'crrt-recovery.1',
        reviewStatus: 'sme-review',
      },
    ])
  })

  it('gates nothing: every section stays directly selectable from a cold start', () => {
    const reachable = getCriticalCareRecommendations(criticalCareActivities, EMPTY_ENVELOPE, {
      allowedReviewStatuses: ['released', 'sme-review'],
      preferredModuleIds: ['baxter-crrt'],
      limit: 200,
    }).map((item) => item.activity.id)

    for (const activity of crrtLearnActivities) {
      expect(reachable).toContain(activity.id)
    }
  })

  it('keeps prerequisites advisory: the integration capstone still lists all seven earlier sections', () => {
    const integration = criticalCareActivityById.get('crrt:learn:crrt-pressure-profile-integration')
    expect([...(integration?.prerequisiteActivityIds ?? [])].sort()).toEqual(
      PERSISTENT_SECTION_IDS.filter((id) => id !== 'crrt-pressure-profile-integration')
        .map((id) => `crrt:learn:${id}`)
        .sort(),
    )
  })
})
