/**
 * @jest-environment node
 */

import { supabaseServer } from '@/lib/supabase/server'

import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

describe('site analytics API Baxter CRRT privacy boundary', () => {
  const supabaseServerMock = supabaseServer as jest.Mock

  beforeEach(() => {
    supabaseServerMock.mockReset()
  })

  it('accepts and stores only a validated CRRT summary payload', async () => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)

    const eventPayload = validCrrtCaseCompletion()
    const response = await POST(
      analyticsRequest('baxter-crrt', eventPayload, { eventType: 'quiz_submitted' }),
    )

    expect(response.status).toBe(200)
    expect(database.from).toHaveBeenCalledWith('site_module_events')
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_payload: eventPayload,
        event_type: 'quiz_submitted',
        module_id: 'baxter-crrt',
        route_path: '/en/baxter-crrt',
        user_id: 'user-1',
      }),
    )
    expect(database.from).not.toHaveBeenCalledWith('site_module_progress')
    expect(database.from).not.toHaveBeenCalledWith('site_module_sessions')
  })

  it.each([
    ['missing summary payload', undefined],
    ['unknown key', { ...validCrrtCaseCompletion(), prediction: 'free text' }],
    ['retired device identity', { ...validCrrtCaseCompletion(), device: 'prismax-aw8035-2xx' }],
    ['retired pathway key', { ...validCrrtCaseCompletion(), pathway: 'practice' }],
    ['action history', { ...validCrrtCaseCompletion(), actionHistory: ['changed flow'] }],
    ['laboratory array', { ...validCrrtCaseCompletion(), laboratories: [{ potassium: 6.5 }] }],
    ['trend array', { ...validCrrtCaseCompletion(), trends: [1, 2, 3] }],
    ['unknown interaction', { ...validCrrtCaseCompletion(), interaction: 'case_replayed' }],
    ['invalid score', { ...validCrrtCaseCompletion(), score: 101 }],
    ['invalid case ID', { ...validCrrtCaseCompletion(), caseId: 'patient-123' }],
  ])(
    'rejects a CRRT payload containing an %s before authentication or storage',
    async (_, body) => {
      const response = await POST(
        analyticsRequest('baxter-crrt', body, { eventType: 'quiz_submitted' }),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid Baxter CRRT analytics payload.',
      })
      expect(supabaseServerMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['first core case', { ...validCrrtCaseCompletion(), caseId: 'CRRT-01' }],
    ['last optional case', { ...validCrrtCaseCompletion(), caseId: 'CRRT-18' }],
  ])('accepts %s summary events', async (_, body) => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)
    const response = await POST(
      analyticsRequest('baxter-crrt', body, { eventType: 'quiz_submitted' }),
    )
    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(expect.objectContaining({ event_payload: body }))
  })

  it.each([
    ['mismatched event type', validCrrtCaseCompletion(), { eventType: 'module_completed' }],
    [
      'generic percent completion',
      validCrrtCaseCompletion(),
      { eventType: 'quiz_submitted', percentComplete: 100 },
    ],
    [
      'generic session metadata',
      validCrrtCaseCompletion(),
      {
        durationSeconds: 60,
        eventType: 'quiz_submitted',
        sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729',
      },
    ],
    [
      'route outside the CRRT module',
      validCrrtCaseCompletion(),
      { eventType: 'quiz_submitted', routePath: '/en/cardiohelp-ecmo' },
    ],
  ])('rejects CRRT %s before authentication or storage', async (_, body, overrides) => {
    const response = await POST(analyticsRequest('baxter-crrt', body, overrides))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid Baxter CRRT analytics payload.',
    })
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it('rejects generic CRRT lifecycle events without a learner interaction payload', async () => {
    const response = await POST(
      analyticsRequest('baxter-crrt', undefined, {
        eventType: 'session_start',
        sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729',
      }),
    )

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it('preserves the existing open event-payload behavior for non-CRRT modules', async () => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)
    const legacyPayload = {
      interaction: 'legacy_interaction',
      moduleSpecificValue: 'preserved',
    }

    const response = await POST(analyticsRequest('cardiohelp-ecmo', legacyPayload))

    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_payload: legacyPayload,
        module_id: 'cardiohelp-ecmo',
      }),
    )
  })

  it('accepts and stores only a validated ICU Simulator outcome summary', async () => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)
    const eventPayload = validIcuScenarioCompletion()

    const response = await POST(
      analyticsRequest('icu-simulation', eventPayload, {
        eventType: 'quiz_submitted',
        routePath: '/en/icu-simulation/practice',
      }),
    )

    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_payload: eventPayload,
        event_type: 'quiz_submitted',
        module_id: 'icu-simulation',
        route_path: '/en/icu-simulation/practice',
      }),
    )
    expect(database.from).not.toHaveBeenCalledWith('site_module_progress')
    expect(database.from).not.toHaveBeenCalledWith('site_module_sessions')
  })

  it.each([
    ['missing payload', undefined],
    ['physiology', { ...validIcuScenarioCompletion(), mapMmHg: 62 }],
    ['device setting', { ...validIcuScenarioCompletion(), rpm: 3_500 }],
    ['action history', { ...validIcuScenarioCompletion(), commands: ['start-va-ecmo'] }],
    ['free text', { ...validIcuScenarioCompletion(), note: 'patient-specific text' }],
    ['unknown case', { ...validIcuScenarioCompletion(), scenarioId: 'patient-42' }],
  ])('rejects ICU Simulator %s before authentication or storage', async (_, body) => {
    const response = await POST(
      analyticsRequest('icu-simulation', body, {
        eventType: 'quiz_submitted',
        routePath: '/en/icu-simulation/practice',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid ICU Simulator analytics payload.',
    })
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it.each([
    ['top-level physiology', { mapMmHg: 62 }],
    ['top-level free text', { note: 'patient-specific text' }],
    ['top-level trend data', { trends: [1, 2, 3] }],
  ])('rejects ICU Simulator %s outside the summary envelope', async (_, extra) => {
    const response = await POST(
      analyticsRequest('icu-simulation', validIcuScenarioCompletion(), {
        eventType: 'quiz_submitted',
        routePath: '/en/icu-simulation/practice',
        ...extra,
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid ICU Simulator analytics payload.',
    })
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it('rejects generic ICU Simulator lifecycle telemetry during private review', async () => {
    const response = await POST(
      analyticsRequest('icu-simulation', undefined, {
        eventType: 'session_start',
        routePath: '/en/icu-simulation',
        sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729',
      }),
    )

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })
})

function validCrrtCaseCompletion() {
  return {
    interaction: 'case_completed',
    caseId: 'CRRT-04',
    section: 'practice',
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

function validIcuScenarioCompletion() {
  return {
    interaction: 'scenario_completed',
    section: 'practice',
    scenarioId: 'septic-ards-aki',
    scoreBand: 'mastery',
    elapsedBand: '31-to-60-minutes',
    criticalErrorCount: 0,
    completed: true,
    mastered: true,
  }
}

function analyticsRequest(
  moduleId: string,
  eventPayload: Record<string, unknown> | undefined,
  overrides: Record<string, unknown> = {},
) {
  return new Request('http://localhost/api/analytics', {
    body: JSON.stringify({
      eventType: 'module_interaction',
      moduleId,
      routePath: moduleId === 'baxter-crrt' ? '/en/baxter-crrt' : '/en/cardiohelp-ecmo',
      ...(eventPayload === undefined ? {} : { eventPayload }),
      ...overrides,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
}

function authenticatedAnalyticsDatabase() {
  const insert = jest.fn().mockResolvedValue({ error: null })
  const from = jest.fn().mockReturnValue({ insert })
  return {
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from,
    },
    from,
    insert,
  }
}
