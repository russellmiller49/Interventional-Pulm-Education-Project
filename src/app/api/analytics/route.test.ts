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

  it('rejects an unbounded legacy payload for a focused critical-care module', async () => {
    const legacyPayload = {
      interaction: 'legacy_interaction',
      moduleSpecificValue: 'preserved',
    }

    const response = await POST(analyticsRequest('cardiohelp-ecmo', legacyPayload))

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it.each([
    [
      'icu-hemodynamics',
      {
        caseId: 'HD-02',
        pathway: 'practice',
        workspace: 'cases',
        completion: false,
        score: null,
        criticalErrorCount: 0,
        contentVersion: '1.0.0-preview.1',
      },
      { section: 'cases', percentComplete: 25, routePath: '/en/icu-hemodynamics' },
    ],
    [
      'mechanical-ventilation',
      {
        interaction: 'device_changed',
        fromDeviceId: 'hamilton-c6',
        deviceId: 'drager-evita-v800-v600',
        caseId: 'MV-02',
        pathway: 'practice',
      },
      {
        section: 'lung-protection-demand',
        routePath: '/en/mechanical-ventilation/practice',
      },
    ],
    [
      'mechanical-circulatory-support',
      {
        deviceTrack: 'impella',
        station: 'IMP-01',
        completion: 'in-progress',
      },
      {
        section: 'practice',
        percentComplete: 34,
        routePath: '/en/mechanical-circulatory-support/practice',
      },
    ],
    [
      'cardiohelp-ecmo',
      {
        interaction: 'guided_lesson_loaded',
        scenarioId: 'preload-drainage-collapse',
        supportMode: 'vv',
        experience: 'learn',
      },
      { section: 'learn', routePath: '/en/cardiohelp-ecmo/learn' },
    ],
  ])('accepts a strict bounded %s event', async (moduleId, body, overrides) => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(analyticsRequest(moduleId, body, overrides))

    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        module_id: moduleId,
        event_payload: expect.objectContaining(body),
      }),
    )
  })

  it.each([
    [
      'icu-hemodynamics',
      {
        caseId: 'HD-02',
        pathway: 'practice',
        workspace: 'cases',
        completion: false,
        score: null,
        criticalErrorCount: 0,
        contentVersion: '1.0.0-preview.1',
      },
      { section: 'cases', percentComplete: 25, routePath: '/en/icu-hemodynamics' },
    ],
    [
      'mechanical-ventilation',
      {
        interaction: 'device_changed',
        fromDeviceId: 'hamilton-c6',
        deviceId: 'drager-evita-v800-v600',
        caseId: 'MV-02',
        pathway: 'practice',
      },
      {
        section: 'lung-protection-demand',
        routePath: '/en/mechanical-ventilation/practice',
      },
    ],
    [
      'mechanical-circulatory-support',
      {
        deviceTrack: 'impella',
        station: 'IMP-01',
        completion: 'in-progress',
      },
      {
        section: 'practice',
        percentComplete: 34,
        routePath: '/en/mechanical-circulatory-support/practice',
      },
    ],
    [
      'cardiohelp-ecmo',
      {
        interaction: 'guided_lesson_loaded',
        scenarioId: 'preload-drainage-collapse',
        supportMode: 'vv',
        experience: 'learn',
      },
      { section: 'learn', routePath: '/en/cardiohelp-ecmo/learn' },
    ],
  ])(
    'rejects unbounded nested state for %s before authentication',
    async (moduleId, body, overrides) => {
      const response = await POST(
        analyticsRequest(moduleId, { ...body, note: 'patient-specific free text' }, overrides),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid focused critical-care analytics payload.',
      })
      expect(supabaseServerMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    'icu-hemodynamics',
    'mechanical-ventilation',
    'mechanical-circulatory-support',
    'cardiohelp-ecmo',
  ])('preserves bounded lifecycle telemetry for %s', async (moduleId) => {
    const database = authenticatedLifecycleDatabase()
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(
      analyticsRequest(moduleId, undefined, {
        durationSeconds: 0,
        eventType: 'session_start',
        routePath: `/en/${moduleId}`,
        sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729',
      }),
    )

    expect(response.status).toBe(200)
    expect(database.sessionUpsert).toHaveBeenCalled()
  })

  it('rejects payload data attached to focused-module lifecycle telemetry', async () => {
    const response = await POST(
      analyticsRequest(
        'icu-hemodynamics',
        { note: 'not a lifecycle field' },
        {
          durationSeconds: 0,
          eventType: 'session_start',
          routePath: '/en/icu-hemodynamics',
          sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729',
        },
      ),
    )

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
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

  it('stores a bounded critical-care dashboard event using an existing event class', async () => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)
    const eventPayload = {
      interaction: 'critical_care_dashboard_viewed',
      schemaVersion: 1,
    }

    const response = await POST(
      analyticsRequest('critical-care', eventPayload, {
        eventType: 'module_opened',
        routePath: '/en/critical-care',
      }),
    )

    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_payload: eventPayload,
        event_type: 'module_opened',
        module_id: 'critical-care',
        route_path: '/en/critical-care',
      }),
    )
    expect(database.from).not.toHaveBeenCalledWith('site_module_progress')
    expect(database.from).not.toHaveBeenCalledWith('site_module_sessions')
  })

  it('accepts a strict V2 activity event from its canonical module route', async () => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)
    const eventPayload = {
      interaction: 'critical_care_goal_met',
      moduleId: 'mechanical-ventilation',
      activityId: 'ventilation:practice:MV-01',
      mode: 'practice',
      schemaVersion: 1,
    }

    const response = await POST(
      analyticsRequest('critical-care', eventPayload, {
        eventType: 'quiz_submitted',
        routePath: '/en/mechanical-ventilation/practice',
      }),
    )

    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_payload: eventPayload,
        event_type: 'quiz_submitted',
        module_id: 'critical-care',
      }),
    )
  })

  it.each([
    ['free text', { note: 'patient-specific free text' }],
    ['waveform array', { waveforms: [1, 2, 3] }],
    ['physiology', { patient: { map: 62 } }],
    ['device settings', { settings: { peep: 12 } }],
    ['command history', { commands: ['set-peep'] }],
    ['replay state', { replay: { commands: [] } }],
  ])('rejects critical-care %s before authentication or storage', async (_, extra) => {
    const response = await POST(
      analyticsRequest(
        'critical-care',
        {
          interaction: 'critical_care_activity_opened',
          moduleId: 'mechanical-ventilation',
          activityId: 'ventilation:practice:MV-01',
          schemaVersion: 1,
          ...extra,
        },
        {
          eventType: 'module_opened',
          routePath: '/en/mechanical-ventilation/practice',
        },
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid critical-care analytics payload.',
    })
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it.each([
    ['module without activity', { moduleId: 'mechanical-ventilation' }],
    ['activity without module', { activityId: 'ventilation:practice:MV-01' }],
  ])('rejects an activity-qualified start with %s', async (_, identity) => {
    const response = await POST(
      analyticsRequest(
        'critical-care',
        {
          interaction: 'critical_care_qualified_start',
          qualification: 'meaningful-interaction',
          schemaVersion: 1,
          ...identity,
        },
        {
          eventType: 'module_opened',
          routePath: '/en/mechanical-ventilation/practice',
        },
      ),
    )

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it.each([
    ['mismatched event class', { eventType: 'module_completed' }],
    ['generic percentage', { eventType: 'module_opened', percentComplete: 40 }],
    ['generic section', { eventType: 'module_opened', section: 'free text' }],
    ['route mismatch', { eventType: 'module_opened', routePath: '/en/baxter-crrt' }],
    ['unknown top-level state', { eventType: 'module_opened', mapMmHg: 62 }],
  ])('rejects a critical-care event with %s', async (_, overrides) => {
    const response = await POST(
      analyticsRequest(
        'critical-care',
        { interaction: 'critical_care_dashboard_viewed', schemaVersion: 1 },
        { routePath: '/en/critical-care', ...overrides },
      ),
    )

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })

  it('rejects generic critical-care lifecycle telemetry without a bounded event payload', async () => {
    const response = await POST(
      analyticsRequest('critical-care', undefined, {
        eventType: 'session_start',
        routePath: '/en/critical-care',
        sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729',
      }),
    )

    expect(response.status).toBe(400)
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })
})

/**
 * The MCS workbench sends one aggregate module event per state change, and the accepted privacy
 * contract for that event is exactly three nested fields:
 *
 *   - the device track,
 *   - the station,
 *   - a coarse completion state.
 *
 * No physiology, no detailed action history, no free text, and no performance band.
 *
 * The fixtures below are the payload asserted by the landed M5 workbench analytics test —
 * `src/features/mechanical-circulatory-support/__tests__/m5-persistence-analytics.test.tsx`,
 * "sends only the device track, the station, and a coarse completion state" — so this suite fails
 * whenever the server contract drifts away from the shape the client actually sends.
 */
describe('site analytics API mechanical circulatory support aggregate contract', () => {
  const supabaseServerMock = supabaseServer as jest.Mock

  beforeEach(() => {
    supabaseServerMock.mockReset()
  })

  it.each([
    ['learn', 'iabp', 'IAB-01', 12],
    ['practice', 'impella', 'IMP-01', 34],
    ['assess', 'lvad', 'CAP-LVAD-01', 88],
  ])(
    'accepts an in-progress %s event carrying only the three contract fields',
    async (section, deviceTrack, station, percentComplete) => {
      const database = authenticatedAnalyticsDatabase()
      supabaseServerMock.mockResolvedValue(database.client)

      const response = await POST(
        mcsAnalyticsRequest(
          { deviceTrack, station, completion: 'in-progress' },
          { section, percentComplete, routePath: `/en/mechanical-circulatory-support/${section}` },
        ),
      )

      expect(response.status).toBe(200)
      expect(database.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          module_id: 'mechanical-circulatory-support',
          event_type: 'module_interaction',
          event_payload: expect.objectContaining({
            deviceTrack,
            station,
            completion: 'in-progress',
          }),
        }),
      )
    },
  )

  it('accepts the completed event the workbench sends as a section completion', async () => {
    const database = authenticatedLifecycleDatabase()
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(
      mcsAnalyticsRequest(mcsCompletedAggregateEvent(), {
        eventType: 'section_completed',
        percentComplete: 40,
      }),
    )

    expect(response.status).toBe(200)
    expect(database.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'section_completed',
        event_payload: expect.objectContaining(mcsCompletedAggregateEvent()),
      }),
    )
  })

  it('stores the validated contract as exactly the three nested fields', async () => {
    const database = authenticatedAnalyticsDatabase()
    supabaseServerMock.mockResolvedValue(database.client)

    const response = await POST(mcsAnalyticsRequest(mcsInProgressAggregateEvent()))

    expect(response.status).toBe(200)
    const stored = database.insert.mock.calls.at(-1)?.[0] as {
      event_payload: Record<string, unknown>
    }
    // The shared writer stamps the top-level analytics context — percentComplete and section —
    // onto every stored envelope, for every module. Everything else in that envelope is the
    // validated nested payload, and it is exactly the three contract fields.
    const { percentComplete, section, ...nested } = stored.event_payload
    expect(nested).toEqual(mcsInProgressAggregateEvent())
    // percentComplete stays a top-level analytics field: the strict nested schema rejects it
    // outright (see the privacy table below), so validation never folds it into the contract.
    expect(percentComplete).toBe(34)
    expect(section).toBe('practice')
  })

  it.each([
    ['a performance band', { scoreBand: '80-100' }],
    ['a raw score', { score: 92 }],
    ['a mastery flag', { mastery: true }],
    ['a mean arterial pressure', { mapMmHg: 62 }],
    ['a wedge pressure', { pcwpMmHg: 24 }],
    ['a pulmonary artery pulsatility index', { papi: 0.9 }],
    ['a cardiac power output', { cardiacPowerOutputW: 0.51 }],
    ['a mixed venous saturation', { svo2Percent: 48 }],
    ['waveform data', { waveform: [12, 14, 11] }],
    ['a trend array', { trends: [34, 36, 39] }],
    ['an action history', { actionHistory: ['increased p-level', 'gave volume'] }],
    ['prediction text', { prediction: 'right ventricular failure' }],
    ['free text', { note: 'patient-specific free text' }],
    ['an unknown device track', { deviceTrack: 'ecmo' }],
    ['an invalid station identifier', { station: 'IMP 01 free text' }],
    ['an unknown completion state', { completion: 'partial' }],
    ['a nested percent complete', { percentComplete: 34 }],
    ['any other unknown key', { replayState: { actions: [] } }],
  ])(
    'rejects an MCS aggregate payload containing %s before authentication or storage',
    async (_, extra) => {
      const response = await POST(
        mcsAnalyticsRequest({ ...mcsInProgressAggregateEvent(), ...extra }),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid focused critical-care analytics payload.',
      })
      expect(supabaseServerMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'a completed state on an interaction event',
      mcsCompletedAggregateEvent(),
      { eventType: 'module_interaction' },
    ],
    [
      'an in-progress state on a section completion',
      mcsInProgressAggregateEvent(),
      { eventType: 'section_completed' },
    ],
    ['no percent complete', mcsInProgressAggregateEvent(), { percentComplete: undefined }],
    ['an unsupported section', mcsInProgressAggregateEvent(), { section: 'debrief' }],
    [
      'a route outside the MCS module',
      mcsInProgressAggregateEvent(),
      { routePath: '/en/cardiohelp-ecmo/learn' },
    ],
    ['generic session duration', mcsInProgressAggregateEvent(), { durationSeconds: 60 }],
    [
      'a generic session identifier',
      mcsInProgressAggregateEvent(),
      { sessionId: '3cf4a73a-d143-4ed4-874a-e494e5d2e729' },
    ],
  ])('rejects an MCS aggregate event with %s', async (_, body, overrides) => {
    const response = await POST(mcsAnalyticsRequest(body, overrides))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid focused critical-care analytics payload.',
    })
    expect(supabaseServerMock).not.toHaveBeenCalled()
  })
})

/** The exact nested payload the landed M5 workbench emits while a station is in progress. */
function mcsInProgressAggregateEvent() {
  return {
    deviceTrack: 'impella',
    station: 'IMP-01',
    completion: 'in-progress',
  }
}

/** The same three-field contract once the station is complete. */
function mcsCompletedAggregateEvent() {
  return {
    deviceTrack: 'impella',
    station: 'IMP-01',
    completion: 'complete',
  }
}

function mcsAnalyticsRequest(
  eventPayload: Record<string, unknown> | undefined,
  overrides: Record<string, unknown> = {},
) {
  return analyticsRequest('mechanical-circulatory-support', eventPayload, {
    eventType: 'module_interaction',
    percentComplete: 34,
    routePath: '/en/mechanical-circulatory-support/practice',
    section: 'practice',
    ...overrides,
  })
}

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

function authenticatedLifecycleDatabase() {
  const insert = jest.fn().mockResolvedValue({ error: null })
  const sessionUpsert = jest.fn().mockResolvedValue({ error: null })
  const progressUpsert = jest.fn().mockResolvedValue({ error: null })
  const progressQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
  progressQuery.select.mockReturnValue(progressQuery)
  progressQuery.eq.mockReturnValue(progressQuery)
  const from = jest.fn((table: string) => {
    if (table === 'site_module_sessions') return { upsert: sessionUpsert }
    if (table === 'site_module_progress') {
      return { ...progressQuery, upsert: progressUpsert }
    }
    return { insert }
  })
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
    progressUpsert,
    sessionUpsert,
  }
}
