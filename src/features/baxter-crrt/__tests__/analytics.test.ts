import { buildBaxterCrrtAnalyticsEvent, buildBaxterCrrtAnalyticsPayload } from '../analytics'
import type { BaxterCrrtAnalyticsEventPayload } from '@/lib/baxter-crrt-analytics'

function completedCasePayload(): BaxterCrrtAnalyticsEventPayload {
  return {
    interaction: 'case_completed',
    section: 'practice',
    caseId: 'CRRT-04',
    role: 'operator',
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
  it('builds a bounded outcome without device, drill, tool, action, laboratory, or trend data', () => {
    const payload = buildBaxterCrrtAnalyticsPayload(completedCasePayload())

    expect(payload).toEqual(completedCasePayload())
    expect(Object.keys(payload).sort()).toEqual(
      [
        'caseId',
        'completed',
        'criticalErrorCount',
        'elapsedSeconds',
        'hintCount',
        'interaction',
        'reassessmentCompleted',
        'role',
        'score',
        'section',
        'timeToFirstSafeActionSeconds',
      ].sort(),
    )
    expect(JSON.stringify(payload)).not.toMatch(
      /device|drill|tool|prediction|actionHistory|laborator|trend/i,
    )
  })

  it('derives the generic event type and always fixes the module ID', () => {
    expect(buildBaxterCrrtAnalyticsEvent({ eventPayload: completedCasePayload() })).toEqual({
      eventType: 'quiz_submitted',
      moduleId: 'baxter-crrt',
      eventPayload: completedCasePayload(),
    })

    expect(
      buildBaxterCrrtAnalyticsEvent({
        eventPayload: {
          interaction: 'station_completed',
          section: 'practice',
          completed: true,
        },
      }).eventType,
    ).toBe('section_completed')
  })

  it('accepts the seven stable Learn lesson identifiers with clean section semantics', () => {
    expect(
      buildBaxterCrrtAnalyticsPayload({
        interaction: 'lesson_completed',
        lessonId: 'crrt-circuit-pressures',
        section: 'learn',
        completed: true,
        elapsedSeconds: 300,
      }),
    ).toMatchObject({ lessonId: 'crrt-circuit-pressures', section: 'learn' })

    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        interaction: 'lesson_opened',
        lessonId: 'crrt-circuit-pressures',
        section: 'practice',
      }),
    ).toThrow()
  })

  it('accepts curated Practice cases and the Assess capstone but rejects CRRT-16 as practice', () => {
    expect(
      buildBaxterCrrtAnalyticsPayload({ ...completedCasePayload(), caseId: 'CRRT-18' }),
    ).toEqual({
      ...completedCasePayload(),
      caseId: 'CRRT-18',
    })
    expect(
      buildBaxterCrrtAnalyticsPayload({
        interaction: 'capstone_completed',
        section: 'assess',
        masteryId: 'MASTERY-PRISMAX-01',
        role: 'integrated',
        score: 84,
        criticalErrorCount: 0,
        hintCount: 0,
        completed: true,
        reassessmentCompleted: true,
      }),
    ).toMatchObject({ masteryId: 'MASTERY-PRISMAX-01', section: 'assess' })
    expect(() =>
      buildBaxterCrrtAnalyticsPayload({
        ...completedCasePayload(),
        caseId: 'CRRT-16',
      } as unknown as BaxterCrrtAnalyticsEventPayload),
    ).toThrow()
  })

  it('rejects out-of-range metrics, unstable IDs, and privacy-sensitive or retired keys', () => {
    expect(() =>
      buildBaxterCrrtAnalyticsPayload({ ...completedCasePayload(), score: 101 }),
    ).toThrow()
    expect(() =>
      buildBaxterCrrtAnalyticsPayload({ ...completedCasePayload(), elapsedSeconds: 86_401 }),
    ).toThrow()

    const unsafe = {
      ...completedCasePayload(),
      device: 'prismax-aw8035-2xx',
      pathway: 'practice',
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
    } as unknown as Parameters<typeof buildBaxterCrrtAnalyticsEvent>[0]

    expect(() => buildBaxterCrrtAnalyticsEvent(unsafeEvent)).toThrow()
  })
})
