import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  calculateMastery,
  createDefaultProgress,
  parseProgress,
  readProgress,
  recordScenarioResult,
} from '../engine/progress'

describe('CARDIOHELP ECMO progress', () => {
  it('preserves the Practice-only v1 storage contract', () => {
    expect(CARDIOHELP_PROGRESS_STORAGE_KEY).toBe('cardiohelp-ecmo-progress-v1')
    expect(Object.keys(createDefaultProgress())).toEqual([
      'version',
      'lastStation',
      'completedLabs',
      'scenarioAttempts',
      'bestScores',
      'criticalErrorStatus',
      'mastery',
    ])
  })

  it('parses only versioned non-PHI progress', () => {
    const valid = createDefaultProgress()
    expect(parseProgress(JSON.stringify(valid))).toEqual(valid)
    expect(parseProgress('{"version":2}')).toBeNull()
    expect(parseProgress('{"version":1,"lastStation":"bad"}')).toBeNull()
    expect(parseProgress('not-json')).toBeNull()
  })

  it('tracks attempts, best scores, critical status, and mastery', () => {
    let progress = createDefaultProgress()
    progress = recordScenarioResult(progress, {
      scenarioId: 'scenario-a',
      score: 88,
      criticalError: false,
      completed: true,
    })
    progress = recordScenarioResult(progress, {
      scenarioId: 'scenario-a',
      score: 72,
      criticalError: false,
      completed: true,
    })

    expect(progress.scenarioAttempts['scenario-a']).toBe(2)
    expect(progress.bestScores['scenario-a']).toBe(88)
    expect(progress.completedLabs).toEqual(['scenario-a'])
    expect(calculateMastery(progress, ['scenario-a'])).toBe(true)

    progress = recordScenarioResult(progress, {
      scenarioId: 'scenario-a',
      score: 100,
      criticalError: true,
      completed: true,
    })
    expect(calculateMastery(progress, ['scenario-a'])).toBe(true)

    let unsafeOnly = recordScenarioResult(createDefaultProgress(), {
      scenarioId: 'scenario-a',
      score: 100,
      criticalError: true,
      completed: true,
    })
    expect(calculateMastery(unsafeOnly, ['scenario-a'])).toBe(false)
    unsafeOnly = recordScenarioResult(unsafeOnly, {
      scenarioId: 'scenario-a',
      score: 86,
      criticalError: false,
      completed: true,
    })
    expect(calculateMastery(unsafeOnly, ['scenario-a'])).toBe(true)
  })

  it('falls back safely when browser storage access is denied', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError')
    })

    expect(readProgress()).toEqual(createDefaultProgress())
    getItem.mockRestore()
  })

  it('records VA outcomes under namespaced IDs without changing legacy VV results', () => {
    let progress = recordScenarioResult(createDefaultProgress(), {
      scenarioId: 'startup-sensor-orientation',
      score: 92,
      criticalError: false,
      completed: true,
    })
    const vvSnapshot = JSON.stringify({
      score: progress.bestScores['startup-sensor-orientation'],
      attempts: progress.scenarioAttempts['startup-sensor-orientation'],
      critical: progress.criticalErrorStatus['startup-sensor-orientation'],
    })

    progress = recordScenarioResult(progress, {
      scenarioId: 'va-startup-sensor-orientation',
      score: 84,
      criticalError: false,
      completed: true,
    })

    expect(
      JSON.stringify({
        score: progress.bestScores['startup-sensor-orientation'],
        attempts: progress.scenarioAttempts['startup-sensor-orientation'],
        critical: progress.criticalErrorStatus['startup-sensor-orientation'],
      }),
    ).toBe(vvSnapshot)
    expect(progress.bestScores['va-startup-sensor-orientation']).toBe(84)
    expect(progress.completedLabs).toEqual([
      'startup-sensor-orientation',
      'va-startup-sensor-orientation',
    ])
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress)
  })
})
