import {
  cardiohelpCurriculum,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
} from '@/features/cardiohelp-ecmo/content/curriculum'
import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'
import {
  ecmoInteractiveFoundationSectionIds,
  ecmoSharedFoundationSectionIds,
  ecmoVaOnlyFoundationSectionIds,
  ecmoVvOnlyFoundationSectionIds,
} from '@/features/cardiohelp-ecmo/content/foundationLessonRuntime'
import type { SupportMode } from '@/features/cardiohelp-ecmo/engine/types'
import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareCatalogActivityHref } from '@/features/critical-care/content/activityRoutes'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

/**
 * The redesign baseline contract.
 *
 * It replaces the B5/B6 byte-freeze, which pinned twenty-eight files by SHA-256 so that the build
 * under human test could not move. That study concluded without codable findings and the freeze was
 * retired for flow work (`docs/cardiohelp-ecmo/redesign/r0-redesign-baseline-decision.md`), which
 * would otherwise leave the identifiers and ordering it protected incidentally with no guard at all.
 *
 * So this pins identity and order rather than bytes: what a learner's stored progress, a bookmark,
 * an analytics row, or a deep link depends on. Copy, layout, and framing are deliberately outside
 * it — those are exactly what the redesign is allowed to change.
 *
 * Behaviour already proven elsewhere is referenced, not restated: the storage key and envelope
 * version live in `progress.test.ts`, activity-id shape in `critical-care/__tests__/catalogs.test.ts`,
 * engine response curves in `cross-surface-consistency.test.ts`. Duplicating them here would create
 * two places to update and a false impression of coverage. The full map is
 * `docs/cardiohelp-ecmo/redesign/r0-protected-main-inventory.md`.
 */

const VV_SECTION_IDS = [
  'why-extracorporeal-support',
  'circuit-flow-path',
  'pump-and-pressure-zones',
  'blood-flow-versus-sweep',
  'vv-normal-state',
  'vv-series-physiology',
  'startup-sensor-orientation',
  'preload-drainage-collapse',
  'afterload-return-obstruction',
  'afterload-oxygenator-resistance',
  'vv-recirculation',
  'acute-hypercapnia',
  'compensated-hypercapnia',
  'gas-source-interruption',
  'arterial-bubble-stop',
  'transport-power-loss',
  'vv-integration-capstone',
] as const

const VA_SECTION_IDS = [
  'why-extracorporeal-support',
  'circuit-flow-path',
  'pump-and-pressure-zones',
  'blood-flow-versus-sweep',
  'va-normal-state',
  'va-parallel-physiology',
  'va-startup-sensor-orientation',
  'va-preload-drainage-collapse',
  'va-afterload-arterial-return-obstruction',
  'va-afterload-oxygenator-resistance',
  'va-differential-hypoxemia',
  'va-lv-loading',
  'va-acute-hypercapnia',
  'va-gas-source-interruption',
  'va-arterial-bubble-stop',
  'va-transport-power-loss',
  'va-integration-capstone',
] as const

const SECTION_IDS_BY_TRACK: Readonly<Record<SupportMode, readonly string[]>> = {
  vv: VV_SECTION_IDS,
  va: VA_SECTION_IDS,
}

const DRILL_SCENARIO_IDS_BY_TRACK: Readonly<Record<SupportMode, readonly string[]>> = {
  vv: [
    'startup-sensor-orientation',
    'preload-drainage-collapse',
    'afterload-return-obstruction',
    'afterload-oxygenator-resistance',
    'vv-recirculation',
    'acute-hypercapnia',
    'compensated-hypercapnia',
    'gas-source-interruption',
    'arterial-bubble-stop',
    'transport-power-loss',
  ],
  va: [
    'va-startup-sensor-orientation',
    'va-preload-drainage-collapse',
    'va-afterload-arterial-return-obstruction',
    'va-afterload-oxygenator-resistance',
    'va-differential-hypoxemia',
    'va-lv-loading',
    'va-acute-hypercapnia',
    'va-gas-source-interruption',
    'va-arterial-bubble-stop',
    'va-transport-power-loss',
  ],
}

const CASE_SCENARIO_IDS_BY_TRACK: Readonly<Record<SupportMode, readonly string[]>> = {
  vv: [
    'clinical-vv-initiation-ards',
    'clinical-vv-occult-hemorrhage',
    'clinical-vv-tension-pneumothorax',
    'clinical-vv-oxygenator-thrombosis',
    'clinical-vv-recirculation-migration',
    'clinical-vv-gas-disconnection',
    'clinical-vv-circuit-air-embolism',
  ],
  va: [
    'va-clinical-initiation-shock',
    'va-clinical-tamponade',
    'va-clinical-vasoplegia',
    'va-clinical-oxygenator-thrombosis',
    'va-clinical-differential-hypoxemia',
    'va-clinical-limb-ischemia',
    'va-clinical-circuit-air-embolism',
  ],
}

const CAPSTONE_SCENARIO_ID_BY_TRACK: Readonly<Record<SupportMode, string>> = {
  vv: 'vv-off-sweep-capstone',
  va: 'va-mixed-circulation-capstone',
}

const TRACKS: readonly SupportMode[] = ['vv', 'va']

describe('ECMO redesign baseline — canonical section order', () => {
  it.each(TRACKS)('pins the %s track to its seventeen sections, in order', (track) => {
    const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
    expect(pathway.sections.map((section) => section.id)).toEqual(SECTION_IDS_BY_TRACK[track])
  })

  it.each(TRACKS)('opens the %s track on the oxygen-delivery section', (track) => {
    // The redesign's whole premise: a fresh learner starts here, not at the console tour. Every
    // primary entry CTA resolves through the shared resolver, and for empty progress the resolver
    // returns this section. If this id ever moves, the entry copy and its tests move with it.
    const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
    expect(pathway.sections[0]?.id).toBe('why-extracorporeal-support')
  })

  it('shares its first four sections between the two tracks, by identity', () => {
    // Shared means the same section, not a copy of it: completion is recorded against one id, so a
    // learner who works these on VV has worked them on VA. Duplicating the ids would silently make
    // the shared runway track-specific.
    expect(VV_SECTION_IDS.slice(0, 4)).toEqual(VA_SECTION_IDS.slice(0, 4))
  })

  it('keeps console orientation seventh on both tracks', () => {
    for (const track of TRACKS) {
      const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
      const consoleIndex = pathway.sections.findIndex((section) =>
        section.id.endsWith('startup-sensor-orientation'),
      )
      expect(consoleIndex).toBe(6)
    }
  })
})

describe('ECMO redesign baseline — scenario identifiers', () => {
  it.each(TRACKS)('pins the %s drill scenario ids and their order', (track) => {
    expect(orderedLessonScenarioIds(track)).toEqual(DRILL_SCENARIO_IDS_BY_TRACK[track])
  })

  it.each(TRACKS)('pins the %s Practice case scenario ids and their order', (track) => {
    expect(orderedCaseScenarioIds(track)).toEqual(CASE_SCENARIO_IDS_BY_TRACK[track])
  })

  it.each(TRACKS)('pins the %s capstone scenario id', (track) => {
    const capstones = cardiohelpCurriculum[track]
      .map((unit) => unit.capstoneScenarioId)
      .filter((id): id is string => id !== undefined)
    expect(capstones).toEqual([CAPSTONE_SCENARIO_ID_BY_TRACK[track]])
  })

  it('pins the ten interactive foundation section ids and their four/three/three split', () => {
    // Membership, deliberately not order. These arrays are registration sets — the track-only ones
    // list their physiology section before their normal-state section, which is the reverse of how
    // a learner meets them. Learner order is pinned above, against the pathway, which is the only
    // place it means anything.
    const sorted = (ids: readonly string[]) => [...ids].sort()

    expect(sorted(ecmoSharedFoundationSectionIds)).toEqual(
      sorted([
        'why-extracorporeal-support',
        'circuit-flow-path',
        'pump-and-pressure-zones',
        'blood-flow-versus-sweep',
      ]),
    )
    expect(sorted(ecmoVvOnlyFoundationSectionIds)).toEqual(
      sorted(['vv-normal-state', 'vv-series-physiology', 'vv-integration-capstone']),
    )
    expect(sorted(ecmoVaOnlyFoundationSectionIds)).toEqual(
      sorted(['va-normal-state', 'va-parallel-physiology', 'va-integration-capstone']),
    )
    expect(ecmoInteractiveFoundationSectionIds).toHaveLength(10)
  })

  it('accounts for every pathway section as either a foundation section or a drill', () => {
    // No third kind. The resolver splits on exactly this predicate, and a section that is neither
    // would be silently unreachable by it.
    for (const track of TRACKS) {
      const foundations = new Set<string>(ecmoInteractiveFoundationSectionIds)
      const drills = new Set(DRILL_SCENARIO_IDS_BY_TRACK[track])
      for (const id of SECTION_IDS_BY_TRACK[track]) {
        expect(foundations.has(id) || drills.has(id)).toBe(true)
      }
    }
  })
})

describe('ECMO redesign baseline — deep links and release posture', () => {
  it('builds the canonical first-section deep link with unchanged route and query names', () => {
    // Pins the route path and both query parameter names. Existing bookmarks, the resume pointer,
    // and every entry CTA depend on this exact shape.
    const activity = criticalCareActivityById.get('ecmo:learn:why-extracorporeal-support')
    expect(activity).toBeDefined()
    expect(criticalCareCatalogActivityHref(activity!)).toBe(
      '/cardiohelp-ecmo/learn?lesson=why-extracorporeal-support&track=vv',
    )
  })

  it('keeps every pathway section addressable through a registered catalog activity', () => {
    for (const track of TRACKS) {
      const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
      for (const section of pathway.sections) {
        const activity = criticalCareActivityById.get(section.activityId)
        expect(activity).toBeDefined()
        expect(criticalCareCatalogActivityHref(activity!)).toContain(
          `/cardiohelp-ecmo/learn?lesson=${section.id}`,
        )
      }
    }
  })

  it('leaves the module draft and non-credit-eligible', () => {
    expect(cardiohelpEcmoPublicationStatus).toBe('draft')
  })
})
