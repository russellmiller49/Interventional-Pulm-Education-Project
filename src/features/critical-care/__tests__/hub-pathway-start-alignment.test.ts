import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity/progress'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '@/features/icu-hemodynamics/engine/progress'

import { criticalCareActivities } from '../content/activities'
import { criticalCareLearningPathway } from '../content/learningPathways'
import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { getCriticalCareRecommendations } from '../progress/recommendation'
import { derivePublicCriticalCareDashboard } from '../publicDashboard'
import type { CriticalCareProgressReadResult } from '../progress/types'

/**
 * H1.1 — the shared hub and the hemodynamics pathway must name the same first activity.
 *
 * H0/H1 reordered the hemodynamics runway to open on signal validity, but the shared Critical Care
 * hub kept recommending `catheter-advancement`. Nothing in the hub was wrong on its own terms: it
 * asks `getCriticalCareRecommendations` for a single unblocked start with no module or pathway
 * preference, and that function breaks ties on *catalog index* — the position a seed occupies in
 * `content/activities`. H0/H1 moved `stageOrder`, the prerequisite chain, and the pathway, and left
 * the seed array alone, so the hub went on offering catheter manipulation as a novice's first
 * activity while the module's own entry said "start here: can I trust this pressure signal?".
 *
 * The correction is the seed order, not a new recommendation framework. That leaves the hub
 * *validating* its agreement with the pathway rather than deriving from it, so the agreement is
 * pinned here explicitly: these compare the two surfaces against each other, not against a
 * hard-coded string, so moving either one alone fails.
 */

const NEW_LEARNER: CriticalCareProgressReadResult = {
  envelope: { version: 1, activities: [], updatedAt: '1970-01-01T00:00:00.000Z' },
  normalizedSource: {
    moduleId: 'critical-care',
    storageKey: CRITICAL_CARE_PROGRESS_STORAGE_KEY,
    status: 'empty',
  },
  legacySources: [],
  notices: [],
}

/** The hub's own call: one start, no module or pathway preference, reviewed content only. */
const HUB_RECOMMENDATION_OPTIONS = {
  allowedReviewStatuses: ['released', 'sme-review'],
} as const

const catalog = buildCriticalCarePublicClientCatalog()
const hemodynamicsPathway = criticalCareLearningPathway('icu-hemodynamics')

const hemodynamicsLearnActivities = criticalCareActivities.filter((activity) =>
  activity.id.startsWith('hemodynamics:learn:'),
)

function firstRecommendationFor(moduleId: string): string | undefined {
  return getCriticalCareRecommendations(catalog.activities, NEW_LEARNER.envelope, {
    ...HUB_RECOMMENDATION_OPTIONS,
    preferredModuleIds: [moduleId],
    limit: 200,
  }).find((item) => item.activity.moduleId === moduleId)?.activity.id
}

describe('Critical Care hub start agrees with the hemodynamics pathway', () => {
  /**
   * The flow rebuild (2026-09-05) put one orientation section — why a pressure line is placed at
   * all — ahead of the pressure system. The hub's start moves with the pathway's first section.
   */
  it('recommends the orientation section as a new learner’s first activity', () => {
    const model = derivePublicCriticalCareDashboard(catalog, NEW_LEARNER)

    expect(model.audienceState).toBe('new')
    expect(model.recommendation?.activity.id).toBe('hemodynamics:learn:why-measure')
    expect(model.recommendation?.href).toBe('/icu-hemodynamics/learn?activity=why-measure')
    expect(model.recommendation?.activity.moduleId).toBe('icu-hemodynamics')
  })

  /**
   * The drift detector. Neither side is asserted against a literal here: the hub is compared with
   * whatever the pathway currently opens on, so reordering one without the other fails.
   */
  it('names the same activity the hemodynamics pathway opens on', () => {
    const hubStart = derivePublicCriticalCareDashboard(catalog, NEW_LEARNER).recommendation
      ?.activity.id
    const pathwayStart = hemodynamicsPathway.sections[0]?.activityId

    expect(pathwayStart).toBeDefined()
    expect(hubStart).toBe(pathwayStart)
    // And the catalog agrees with both: seed order is what the hub actually reads.
    expect(hemodynamicsLearnActivities[0]?.id).toBe(pathwayStart)
  })

  it('keeps the hemodynamics catalog order equal to the pathway order', () => {
    expect(hemodynamicsLearnActivities.map((activity) => activity.id)).toEqual(
      hemodynamicsPathway.sections.map((section) => section.activityId),
    )
  })

  /**
   * Requirement 8, run inside the suite as well as by hand: rebuild the catalog with the previous
   * advancement-first seed order and confirm the hub goes straight back to recommending catheter
   * manipulation. If this ever stops reproducing, the assertions above have stopped being
   * sensitive to the thing they claim to pin.
   */
  it('would recommend catheter advancement again under the previous seed order', () => {
    const previousOrder = [
      'hemodynamics:learn:catheter-advancement',
      'hemodynamics:learn:pressure-system',
      'hemodynamics:learn:waveform-interpretation',
      'hemodynamics:learn:pawp-capture',
      'hemodynamics:learn:thermodilution-series',
      'hemodynamics:learn:derived-hemodynamics',
      'hemodynamics:learn:pac-signal-validation',
    ]
    const byId = new Map(catalog.activities.map((activity) => [activity.id, activity]))
    const regressed = [
      ...previousOrder.map((id) => byId.get(id)!),
      ...catalog.activities.filter((activity) => !previousOrder.includes(activity.id)),
    ]
    expect(regressed).toHaveLength(catalog.activities.length)

    const [regressedStart] = getCriticalCareRecommendations(regressed, NEW_LEARNER.envelope, {
      ...HUB_RECOMMENDATION_OPTIONS,
      limit: 1,
    })
    expect(regressedStart?.activity.id).toBe('hemodynamics:learn:catheter-advancement')
    expect(regressedStart?.activity.id).not.toBe(hemodynamicsPathway.sections[0]?.activityId)
  })
})

describe('what H1.1 must not have moved', () => {
  it('keeps the capstone last on the pathway and in the catalog', () => {
    expect(hemodynamicsPathway.sections.at(-1)?.activityId).toBe(
      'hemodynamics:learn:pac-signal-validation',
    )
    expect(hemodynamicsPathway.sections.at(-1)?.stage).toBe('integration')
    expect(hemodynamicsLearnActivities.at(-1)?.id).toBe('hemodynamics:learn:pac-signal-validation')
    expect(
      hemodynamicsLearnActivities.filter((activity) => activity.curriculumStage === 'integration'),
    ).toHaveLength(1)
  })

  it('keeps waveform interpretation before catheter advancement', () => {
    const order = hemodynamicsLearnActivities.map((activity) => activity.id)
    expect(order.indexOf('hemodynamics:learn:waveform-interpretation')).toBeLessThan(
      order.indexOf('hemodynamics:learn:catheter-advancement'),
    )
    const pathwayOrder = hemodynamicsPathway.sections.map((section) => section.id)
    expect(pathwayOrder.indexOf('waveform-interpretation')).toBeLessThan(
      pathwayOrder.indexOf('catheter-advancement'),
    )
  })

  it('keeps the complete hemodynamics activity-ID set unchanged and unique', () => {
    const ids = criticalCareActivities
      .filter((activity) => activity.moduleId === 'icu-hemodynamics')
      .map((activity) => activity.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([
      'hemodynamics:assess:masked-seeded',
      'hemodynamics:learn:catheter-advancement',
      'hemodynamics:learn:derived-hemodynamics',
      'hemodynamics:learn:pac-signal-validation',
      'hemodynamics:learn:pawp-capture',
      'hemodynamics:learn:pressure-system',
      'hemodynamics:learn:thermodilution-series',
      'hemodynamics:learn:waveform-components',
      'hemodynamics:learn:waveform-interpretation',
      'hemodynamics:learn:why-measure',
      'hemodynamics:practice:HD-01',
      'hemodynamics:practice:HD-02',
      'hemodynamics:practice:HD-03',
      'hemodynamics:practice:HD-04',
      'hemodynamics:practice:HD-05',
      'hemodynamics:practice:HD-06',
      'hemodynamics:practice:HD-07',
      'hemodynamics:practice:HD-08',
    ])
  })

  it('leaves every other module’s first recommendation where it was', () => {
    expect(firstRecommendationFor('mechanical-ventilation')).toBe('ventilation:practice:MV-01')
    expect(firstRecommendationFor('mechanical-circulatory-support')).toBe(
      'mcs:learn:mcs-foundations-signals',
    )
    expect(firstRecommendationFor('baxter-crrt')).toBe('crrt:learn:crrt-indications-modality')
    // ECMO is draft, so the hub's reviewed-only filter still offers nothing from it.
    expect(firstRecommendationFor('cardiohelp-ecmo')).toBeUndefined()
  })

  it('leaves open navigation and direct URL selection alone', () => {
    expect(
      hemodynamicsLearnActivities.map((activity) => ({
        id: activity.id,
        pathname: activity.pathname,
        query: activity.query,
      })),
    ).toEqual([
      {
        id: 'hemodynamics:learn:why-measure',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'why-measure' },
      },
      {
        id: 'hemodynamics:learn:pressure-system',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'pressure-system' },
      },
      {
        id: 'hemodynamics:learn:waveform-interpretation',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'waveform-interpretation' },
      },
      {
        id: 'hemodynamics:learn:waveform-components',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'waveform-components' },
      },
      {
        id: 'hemodynamics:learn:catheter-advancement',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'catheter-advancement' },
      },
      {
        id: 'hemodynamics:learn:pawp-capture',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'pawp-capture' },
      },
      {
        id: 'hemodynamics:learn:thermodilution-series',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'thermodilution-series' },
      },
      {
        id: 'hemodynamics:learn:derived-hemodynamics',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'derived-hemodynamics' },
      },
      {
        id: 'hemodynamics:learn:pac-signal-validation',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'pac-signal-validation' },
      },
    ])
  })

  it('gates nothing: every station is recommendable on its own from a cold start', () => {
    const reachable = getCriticalCareRecommendations(catalog.activities, NEW_LEARNER.envelope, {
      ...HUB_RECOMMENDATION_OPTIONS,
      preferredModuleIds: ['icu-hemodynamics'],
      limit: 200,
    }).map((item) => item.activity.id)

    for (const activity of hemodynamicsLearnActivities) {
      // A prerequisite chain orders and signposts; it never removes a station from the catalog or
      // from what a learner with no progress may open.
      expect(reachable).toContain(activity.id)
    }
  })

  it('changes no storage key and no progress payload shape', () => {
    expect(CRITICAL_CARE_PROGRESS_STORAGE_KEY).toBe('critical-care-activity-progress-v1')
    expect(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY).toBe('icu-hemodynamics-progress-v2')
    expect(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY).toBe('icu-hemodynamics-progress-v1')

    for (const activity of criticalCareActivities.filter(
      (candidate) => candidate.moduleId === 'icu-hemodynamics',
    )) {
      expect(activity.contentVersion).toBe('hemodynamics-recovery.1')
      expect(activity.completionRuleId).toBe(
        `hemodynamics:completion:${activity.id.split(':')[1]}-existing`,
      )
    }
  })
})
