import { buildBaxterCrrtAnalyticsEvent, buildBaxterCrrtAnalyticsPayload } from '../analytics'
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
        percentComplete: 33,
        section: 'build-prescription',
      }),
    ).toEqual({
      eventType: 'quiz_submitted',
      moduleId: 'baxter-crrt',
      eventPayload: completedCasePayload(),
      percentComplete: 33,
      section: 'build-prescription',
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
        lessonId: 'learn-crrt-04-prescription',
        pathway: 'learn',
        ...context,
        completed: true,
        elapsedSeconds: 300,
      }),
    ).toMatchObject({ lessonId: 'learn-crrt-04-prescription', pathway: 'learn' })

    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        interaction: 'lesson_opened',
        lessonId: 'learn-crrt-04-prescription',
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
      }),
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

  it('rejects free-text section labels at the feature event boundary', () => {
    expect(() =>
      buildBaxterCrrtAnalyticsEvent({
        eventPayload: completedCasePayload(),
        section: 'Patient potassium remained high',
      }),
    ).toThrow()
  })
})
