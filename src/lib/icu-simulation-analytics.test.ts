import {
  expectedIcuSimulationAnalyticsEventType,
  icuSimulationElapsedBand,
  icuSimulationScoreBand,
  validateIcuSimulationAnalyticsEventPayload,
} from './icu-simulation-analytics'

describe('ICU Simulator analytics privacy boundary', () => {
  const completion = {
    interaction: 'scenario_completed',
    section: 'practice',
    scenarioId: 'septic-ards-aki',
    scoreBand: 'mastery',
    elapsedBand: '31-to-60-minutes',
    criticalErrorCount: 0,
    completed: true,
    mastered: true,
  } as const

  it('accepts a bounded scenario outcome summary', () => {
    expect(validateIcuSimulationAnalyticsEventPayload(completion).success).toBe(true)
    expect(expectedIcuSimulationAnalyticsEventType(completion.interaction)).toBe('quiz_submitted')
  })

  it.each([
    ['patient physiology', { ...completion, mapMmHg: 64 }],
    ['ventilator setting', { ...completion, peepCmH2O: 12 }],
    ['device identity', { ...completion, deviceId: 'cardiohelp' }],
    ['laboratory data', { ...completion, labs: { lactate: 5.2 } }],
    ['trend array', { ...completion, trends: [1, 2, 3] }],
    ['action history', { ...completion, commands: ['increase-rpm'] }],
    ['free text', { ...completion, note: 'patient-specific note' }],
  ])('rejects %s', (_, payload) => {
    expect(validateIcuSimulationAnalyticsEventPayload(payload).success).toBe(false)
  })

  it('requires bounded outcome fields only at scenario completion', () => {
    expect(
      validateIcuSimulationAnalyticsEventPayload({
        interaction: 'scenario_completed',
        section: 'practice',
        scenarioId: 'septic-ards-aki',
        completed: true,
      }).success,
    ).toBe(false)
    expect(
      validateIcuSimulationAnalyticsEventPayload({
        interaction: 'scenario_opened',
        section: 'practice',
        scenarioId: 'septic-ards-aki',
        scoreBand: 'mastery',
      }).success,
    ).toBe(false)
  })

  it('derives non-identifying score and elapsed bands', () => {
    expect(icuSimulationScoreBand(81)).toBe('mastery')
    expect(icuSimulationScoreBand(65)).toBe('approaching-mastery')
    expect(icuSimulationScoreBand(null, true)).toBe('not-scored')
    expect(icuSimulationElapsedBand(1_800)).toBe('15-to-30-minutes')
    expect(icuSimulationElapsedBand(4_000)).toBe('over-60-minutes')
  })
})
