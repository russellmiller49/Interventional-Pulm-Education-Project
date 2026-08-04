import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { MCS_PROGRESS_STORAGE_KEY } from '@/features/critical-care/progress/adapters/mcs'

import { mcsLessons } from '../content/lessons'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import {
  MCS_COMPLETABLE_ITEM_COUNT,
  createDefaultMcsProgress,
  mcsProgressPercent,
  readMcsProgress,
  recordMcsLessonComplete,
  writeMcsProgress,
  type McsProgressV1,
} from '../engine'

/**
 * The progress-percentage correction, proved in isolation.
 *
 * `mcsProgressPercent` divided by a hard-coded 20. The real ceiling is 21 — nine guided sections,
 * nine practice cases, and three challenge cases, because `masteredCaseIds` accumulates both kinds
 * of case. The 20 was correct for an eight-section pathway and silently became wrong when the ninth
 * landed, so a learner reached a reported hundred with one activity still untouched, every
 * intermediate value was over-reported, and the same inflated figure was sent to analytics as
 * `percentComplete`.
 *
 * This is an authorized defect fix to a percentage calculation and nothing else. The tests below
 * are written to prove the second half of that sentence as carefully as the first: the storage key,
 * the payload shape, the payload version, every persisted id, and every existing completion record
 * survive the change untouched, and nothing is migrated or discarded.
 */

const STORAGE_KEY = 'interventionalpulm:mcs-progress:v1'

const allLessonIds = mcsLessons.map((lesson) => lesson.id)
const allPracticeIds = mcsPracticeScenarios.map((scenario) => scenario.id)
const allCapstoneIds = mcsCapstoneScenarios.map((scenario) => scenario.id)

function progressWith(overrides: Partial<McsProgressV1>): McsProgressV1 {
  return { ...createDefaultMcsProgress(), ...overrides }
}

describe('the progress percentage counts every completable item exactly once', () => {
  it('derives its denominator from the content catalogue rather than a literal', () => {
    expect(MCS_COMPLETABLE_ITEM_COUNT).toBe(
      allLessonIds.length + allPracticeIds.length + allCapstoneIds.length,
    )
    expect(MCS_COMPLETABLE_ITEM_COUNT).toBe(21)
  })

  it('cannot report a hundred at twenty of twenty-one', () => {
    // Everything except the last challenge case. Under the old denominator of 20 this returned 100.
    const twentyOfTwentyOne = progressWith({
      completedLessonIds: allLessonIds,
      masteredCaseIds: [...allPracticeIds, ...allCapstoneIds.slice(0, -1)],
    })
    const counted =
      twentyOfTwentyOne.completedLessonIds.length + twentyOfTwentyOne.masteredCaseIds.length
    expect(counted).toBe(20)

    expect(mcsProgressPercent(twentyOfTwentyOne)).toBeLessThan(100)
    expect(mcsProgressPercent(twentyOfTwentyOne)).toBe(95)
    expect(Math.round((20 / 20) * 100)).toBe(100) // what the old calculation returned here
  })

  it('reports a hundred at twenty-one of twenty-one, and nothing above it', () => {
    const everything = progressWith({
      completedLessonIds: allLessonIds,
      masteredCaseIds: [...allPracticeIds, ...allCapstoneIds],
    })
    const counted = everything.completedLessonIds.length + everything.masteredCaseIds.length
    expect(counted).toBe(21)
    expect(counted).toBe(MCS_COMPLETABLE_ITEM_COUNT)

    expect(mcsProgressPercent(everything)).toBe(100)
    expect(mcsProgressPercent(everything)).toBeLessThanOrEqual(100)
  })

  it('still reports zero for an untouched learner and rises monotonically', () => {
    expect(mcsProgressPercent(createDefaultMcsProgress())).toBe(0)

    let previous = -1
    for (let completed = 0; completed <= MCS_COMPLETABLE_ITEM_COUNT; completed += 1) {
      const partial = progressWith({ completedLessonIds: allLessonIds.slice(0, completed) })
      const value = mcsProgressPercent(
        completed <= allLessonIds.length
          ? partial
          : progressWith({
              completedLessonIds: allLessonIds,
              masteredCaseIds: [...allPracticeIds, ...allCapstoneIds].slice(
                0,
                completed - allLessonIds.length,
              ),
            }),
      )
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeLessThanOrEqual(100)
      previous = value
    }
    expect(previous).toBe(100)
  })
})

describe('the correction changes a percentage and nothing else', () => {
  beforeEach(() => window.localStorage.clear())

  it('writes to the same storage key it always used', () => {
    writeMcsProgress(createDefaultMcsProgress())
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(Object.keys(window.localStorage)).toEqual([STORAGE_KEY])
    // The read-only mirror in the locked critical-care adapter still points at the same key.
    expect(MCS_PROGRESS_STORAGE_KEY).toBe(STORAGE_KEY)
  })

  it('keeps the payload shape and version exactly as they were', () => {
    const written = createDefaultMcsProgress()
    writeMcsProgress(written)
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')

    expect(raw.version).toBe(1)
    expect(Object.keys(raw).sort()).toEqual(
      [
        'bestScores',
        'completedCapstoneIds',
        'completedCaseIds',
        'completedLessonIds',
        'criticalErrorStatus',
        'lastActivityId',
        'lastDevice',
        'lastSection',
        'masteredCaseIds',
        'version',
      ].sort(),
    )
    // No field was added for the correction — the denominator is derived at read time, not stored.
    expect(raw).not.toHaveProperty('completableItemCount')
    expect(raw).not.toHaveProperty('percentComplete')
    expect(raw).not.toHaveProperty('total')
  })

  it('does not discard or migrate a completion record written before the fix', () => {
    // A payload as an existing learner's browser would hold it, including the ninth section that
    // the old denominator did not account for.
    const existing = {
      version: 1,
      completedLessonIds: ['mcs-foundations-signals', 'iabp-timing-triggering'],
      completedCaseIds: ['IABP-01', 'IABP-02'],
      masteredCaseIds: ['IABP-01'],
      completedCapstoneIds: ['CAP-IABP-01'],
      bestScores: { 'IABP-01': 88, 'CAP-IABP-01': 91 },
      criticalErrorStatus: { 'IABP-01': false },
      lastDevice: 'iabp',
      lastSection: 'practice',
      lastActivityId: 'IABP-02',
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

    const read = readMcsProgress()
    expect(read).toEqual(existing)

    // Reading and writing it back is byte-identical: no migration step runs.
    writeMcsProgress(read)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(existing)

    // And a subsequent completion appends rather than replacing.
    const next = recordMcsLessonComplete(read, 'mcs-foundations-mechanisms', 'iabp')
    expect(next.completedLessonIds).toEqual([
      'mcs-foundations-signals',
      'iabp-timing-triggering',
      'mcs-foundations-mechanisms',
    ])
    expect(next.bestScores).toEqual(existing.bestScores)
    expect(next.completedCapstoneIds).toEqual(existing.completedCapstoneIds)
    expect(next.masteredCaseIds).toEqual(existing.masteredCaseIds)
  })

  it('leaves every section id, activity id, and route untouched', () => {
    const pathway = criticalCareLearningPathway('mechanical-circulatory-support')

    // Section ids, in order, exactly as the locked pathway declares them.
    expect(pathway.sections.map((section) => section.id)).toEqual([
      'mcs-foundations-signals',
      'mcs-foundations-mechanisms',
      'iabp-timing-triggering',
      'iabp-efficacy-limits',
      'impella-unloading-placement',
      'impella-suction-purge-rv',
      'lvad-parameters-assessment',
      'lvad-alarms-emergencies',
      'mcs-device-selection-integration',
    ])
    expect(mcsLessons.map((lesson) => lesson.id)).toEqual(
      pathway.sections.map((section) => section.id),
    )

    // Case ids, unchanged.
    expect(allPracticeIds).toEqual([
      'IABP-01',
      'IABP-02',
      'IABP-03',
      'IMP-01',
      'IMP-02',
      'IMP-03',
      'LVAD-01',
      'LVAD-02',
      'LVAD-03',
    ])
    expect(allCapstoneIds).toEqual(['CAP-IABP-01', 'CAP-IMP-01', 'CAP-LVAD-01'])

    // Catalogue activity ids and the routes they resolve to, unchanged.
    const mcsActivities = criticalCareActivities.filter((activity) =>
      activity.id.startsWith('mcs:'),
    )
    expect(mcsActivities).toHaveLength(21)
    expect(mcsActivities.filter((activity) => activity.id.startsWith('mcs:learn:'))).toHaveLength(9)
    for (const activity of mcsActivities) {
      expect(activity.pathname).toMatch(
        /^\/mechanical-circulatory-support\/(learn|practice|assess)$/,
      )
    }
  })
})
