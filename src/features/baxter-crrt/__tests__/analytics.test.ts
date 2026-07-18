import {
  buildBaxterCrrtAnalyticsEvent,
  buildBaxterCrrtAnalyticsEventForSession,
  buildBaxterCrrtAnalyticsPayload,
} from '../analytics'
import type { BaxterCrrtAnalyticsEventPayload } from '@/lib/baxter-crrt-analytics'

const context = {
  device: 'prismax-aw8035-2xx',
  role: 'operator',
} as const

function completedCasePayload(): BaxterCrrtAnalyticsEventPayload {
  return {
    interaction: 'case_completed',
    caseId: 'CRRT-04',
    pathway: 'practice',
    ...context,
    score: 86,
    criticalErrorCount: 0,
    hintCount: 1,
    elapsedSeconds: 720,
    timeToFirstSafeActionSeconds: 45,
    completed: true,
    reassessmentCompleted: true,
  }
}

describe('Baxter CRRT analytics builders', () => {
  it('builds a bounded case outcome without prediction, action, laboratory, or trend data', () => {
    const payload = buildBaxterCrrtAnalyticsPayload(completedCasePayload())

    expect(payload).toEqual(completedCasePayload())
    expect(Object.keys(payload).sort()).toEqual(
      [
        'caseId',
        'completed',
        'criticalErrorCount',
        'device',
        'elapsedSeconds',
        'hintCount',
        'interaction',
        'pathway',
        'reassessmentCompleted',
        'role',
        'score',
        'timeToFirstSafeActionSeconds',
      ].sort(),
    )
    expect(JSON.stringify(payload)).not.toMatch(/prediction|actionHistory|laborator|trend/i)
  })

  it('derives the generic event type and always fixes the module ID', () => {
    expect(
      buildBaxterCrrtAnalyticsEvent({
        eventPayload: completedCasePayload(),
      }),
    ).toEqual({
      eventType: 'quiz_submitted',
      moduleId: 'baxter-crrt',
      eventPayload: completedCasePayload(),
    })

    expect(
      buildBaxterCrrtAnalyticsEvent({
        eventPayload: {
          interaction: 'station_completed',
          pathway: 'practice',
          ...context,
          completed: true,
        },
      }).eventType,
    ).toBe('section_completed')
  })

  it('accepts stable Learn lesson identifiers and requires clean pathway semantics', () => {
    expect(
      buildBaxterCrrtAnalyticsPayload({
        interaction: 'lesson_completed',
        lessonId: 'crrt-04.learn',
        pathway: 'learn',
        ...context,
        completed: true,
        elapsedSeconds: 300,
      }),
    ).toMatchObject({ lessonId: 'crrt-04.learn', pathway: 'learn' })

    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        interaction: 'lesson_opened',
        lessonId: 'crrt-04.learn',
        pathway: 'practice',
        ...context,
      }),
    ).toThrow()
  })

  it('rejects out-of-range metrics, unstable IDs, and unknown privacy-sensitive keys', () => {
    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        ...completedCasePayload(),
        score: 101,
      }),
    ).toThrow()
    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        ...completedCasePayload(),
        elapsedSeconds: 86_401,
      }),
    ).toThrow()
    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        ...completedCasePayload(),
        caseId: 'CRRT-99',
      } as unknown as BaxterCrrtAnalyticsEventPayload),
    ).toThrow()

    const unsafe = {
      ...completedCasePayload(),
      prediction: 'Free-text clinical reasoning must never leave the browser.',
      actionHistory: [{ action: 'changed prescription' }],
      laboratories: [{ potassium: 6.5 }],
      trends: [1, 2, 3],
    } as unknown as BaxterCrrtAnalyticsEventPayload
    expect(() => buildBaxterCrrtAnalyticsPayload(unsafe)).toThrow()
  })

  it('rejects generic progress metadata at the feature event boundary', () => {
    const unsafeEvent = {
      eventPayload: completedCasePayload(),
      percentComplete: 100,
      section: 'Patient potassium remained high',
    } as unknown as Parameters<typeof buildBaxterCrrtAnalyticsEvent>[0]

    expect(() => buildBaxterCrrtAnalyticsEvent(unsafeEvent)).toThrow()
  })

  it('accepts the full case registry, Mastery, and both device identities', () => {
    for (const validPayload of [
      { ...completedCasePayload(), caseId: 'CRRT-01' },
      { ...completedCasePayload(), pathway: 'mastery' },
      { ...completedCasePayload(), device: 'prismaflex-g5036003-6xx' },
    ]) {
      expect(
        buildBaxterCrrtAnalyticsPayload(validPayload as unknown as BaxterCrrtAnalyticsEventPayload),
      ).toEqual(validPayload)
    }
  })

  it('suppresses event creation in final-SME review-preview sessions', () => {
    expect(
      buildBaxterCrrtAnalyticsEventForSession('review-preview', {
        eventPayload: completedCasePayload(),
      }),
    ).toBeNull()
    expect(
      buildBaxterCrrtAnalyticsEventForSession('learner', {
        eventPayload: completedCasePayload(),
      }),
    ).toMatchObject({ moduleId: 'baxter-crrt' })
  })
})
