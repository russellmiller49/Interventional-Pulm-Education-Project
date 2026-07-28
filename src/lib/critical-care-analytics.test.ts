import {
  criticalCareAnalyticsEventPayloadSchema,
  expectedCriticalCareAnalyticsEventType,
} from './critical-care-analytics'

describe('critical-care analytics privacy boundary', () => {
  it.each([
    ['dashboard view', 'critical_care_dashboard_viewed', 'module_opened'],
    ['phase completion', 'critical_care_phase_completed', 'section_completed'],
    ['prediction', 'critical_care_prediction_submitted', 'quiz_submitted'],
    ['activity completion', 'critical_care_activity_completed', 'module_completed'],
  ] as const)('maps %s to a database-compatible event class', (_, interaction, expected) => {
    expect(expectedCriticalCareAnalyticsEventType(interaction)).toBe(expected)
  })

  it('accepts bounded stable IDs and enums', () => {
    expect(
      criticalCareAnalyticsEventPayloadSchema.parse({
        interaction: 'critical_care_phase_completed',
        moduleId: 'icu-hemodynamics',
        activityId: 'hemodynamics:practice:HD-01',
        phase: 'predict',
        mode: 'practice',
        schemaVersion: 1,
      }),
    ).toEqual({
      interaction: 'critical_care_phase_completed',
      moduleId: 'icu-hemodynamics',
      activityId: 'hemodynamics:practice:HD-01',
      phase: 'predict',
      mode: 'practice',
      schemaVersion: 1,
    })
  })

  it('requires activity and module identities together for activity-qualified starts', () => {
    const base = {
      interaction: 'critical_care_qualified_start' as const,
      qualification: 'meaningful-interaction' as const,
      schemaVersion: 1 as const,
    }

    expect(criticalCareAnalyticsEventPayloadSchema.safeParse(base).success).toBe(true)
    expect(
      criticalCareAnalyticsEventPayloadSchema.safeParse({
        ...base,
        moduleId: 'icu-hemodynamics',
      }).success,
    ).toBe(false)
    expect(
      criticalCareAnalyticsEventPayloadSchema.safeParse({
        ...base,
        activityId: 'hemodynamics:practice:HD-01',
      }).success,
    ).toBe(false)
    expect(
      criticalCareAnalyticsEventPayloadSchema.safeParse({
        ...base,
        moduleId: 'icu-hemodynamics',
        activityId: 'hemodynamics:practice:HD-01',
      }).success,
    ).toBe(true)
  })

  it.each([
    ['free text', { note: 'real patient note' }],
    ['patient identity', { patient: { name: 'Example' } }],
    ['waveform samples', { waveforms: [1, 2, 3] }],
    ['physiology trends', { trends: [{ map: 62 }] }],
    ['device settings', { settings: { rpm: 3_500 } }],
    ['command history', { commands: ['increase-support'] }],
    ['semantic replay', { replay: { seed: 42, commands: [] } }],
  ])('rejects %s', (_, prohibited) => {
    expect(
      criticalCareAnalyticsEventPayloadSchema.safeParse({
        interaction: 'critical_care_activity_opened',
        moduleId: 'icu-hemodynamics',
        activityId: 'hemodynamics:practice:HD-01',
        schemaVersion: 1,
        ...prohibited,
      }).success,
    ).toBe(false)
  })

  it('records a search category and result count without accepting query text', () => {
    expect(
      criticalCareAnalyticsEventPayloadSchema.safeParse({
        interaction: 'critical_care_reference_no_results',
        searchCategory: 'waveform-patterns',
        resultCount: 0,
        query: 'patient-specific free text',
        schemaVersion: 1,
      }).success,
    ).toBe(false)
  })
})
