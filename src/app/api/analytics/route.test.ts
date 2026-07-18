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
    ['full learner case registry', { ...validCrrtCaseCompletion(), caseId: 'CRRT-01' }],
    [
      'operational Prismaflex identity',
      { ...validCrrtCaseCompletion(), device: 'prismaflex-g5036003-6xx' },
    ],
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
})

function validCrrtCaseCompletion() {
  return {
    interaction: 'case_completed',
    caseId: 'CRRT-04',
    pathway: 'practice',
    device: 'prismax-aw8035-2xx',
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
