import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  calculateMastery,
  createDefaultProgress,
  parseProgress,
  readProgress,
  recordLearnLessonCompleted,
  recordScenarioResult,
  setLastCaseForMode,
  setLastLessonForMode,
  setLastVisited,
} from '../engine/progress'

describe('CARDIOHELP ECMO progress', () => {
  it('keeps the original storage key and the v2 non-PHI shape', () => {
    expect(CARDIOHELP_PROGRESS_STORAGE_KEY).toBe('cardiohelp-ecmo-progress-v1')
    expect(Object.keys(createDefaultProgress())).toEqual([
      'version',
      'lastStation',
      'completedLabs',
      'scenarioAttempts',
      'bestScores',
      'criticalErrorStatus',
      'mastery',
      'completedLearnLessonIds',
      'lastLessonScenarioIdByMode',
      'lastCaseScenarioIdByMode',
    ])
    expect(createDefaultProgress().version).toBe(2)
  })

  it('parses only versioned non-PHI progress', () => {
    const valid = createDefaultProgress()
    expect(parseProgress(JSON.stringify(valid))).toEqual(valid)
    expect(parseProgress('{"version":3}')).toBeNull()
    expect(parseProgress('{"version":1,"lastStation":"bad"}')).toBeNull()
    expect(parseProgress('{"version":2,"lastStation":"orientation"}')).toBeNull()
    expect(parseProgress('not-json')).toBeNull()
  })

  it('migrates a stored v1 payload without losing Practice history', () => {
    const v1Payload = JSON.stringify({
      version: 1,
      lastStation: 'troubleshooting',
      completedLabs: ['clinical-vv-occult-hemorrhage', 'clinical-vv-gas-disconnection'],
      scenarioAttempts: { 'clinical-vv-occult-hemorrhage': 3 },
      bestScores: { 'clinical-vv-occult-hemorrhage': 85 },
      criticalErrorStatus: { 'clinical-vv-occult-hemorrhage': false },
      mastery: false,
    })

    const migrated = parseProgress(v1Payload)
    expect(migrated).not.toBeNull()
    expect(migrated?.version).toBe(2)
    expect(migrated?.lastStation).toBe('troubleshooting')
    expect(migrated?.completedLabs).toEqual([
      'clinical-vv-occult-hemorrhage',
      'clinical-vv-gas-disconnection',
    ])
    expect(migrated?.scenarioAttempts['clinical-vv-occult-hemorrhage']).toBe(3)
    expect(migrated?.bestScores['clinical-vv-occult-hemorrhage']).toBe(85)
    expect(migrated?.completedLearnLessonIds).toEqual([])
    expect(migrated?.lastLessonScenarioIdByMode).toEqual({})
    expect(migrated?.lastVisited).toBeUndefined()
  })

  it('persists Learn completion and last-visited context', () => {
    let progress = createDefaultProgress()
    progress = recordLearnLessonCompleted(progress, 'acute-hypercapnia')
    progress = recordLearnLessonCompleted(progress, 'acute-hypercapnia')
    progress = recordLearnLessonCompleted(progress, 'vv-recirculation')
    progress = setLastLessonForMode(progress, 'vv', 'vv-recirculation')
    progress = setLastCaseForMode(progress, 'va', 'va-clinical-tamponade')
    progress = setLastVisited(progress, {
      section: 'learn',
      scenarioId: 'vv-recirculation',
      supportMode: 'vv',
    })

    expect(progress.completedLearnLessonIds).toEqual(['acute-hypercapnia', 'vv-recirculation'])
    expect(progress.lastLessonScenarioIdByMode.vv).toBe('vv-recirculation')
    expect(progress.lastCaseScenarioIdByMode.va).toBe('va-clinical-tamponade')
    expect(progress.lastVisited).toEqual({
      section: 'learn',
      scenarioId: 'vv-recirculation',
      supportMode: 'vv',
    })
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress)
  })

  it('rejects malformed v2 lesson fields', () => {
    const base = createDefaultProgress()
    expect(parseProgress(JSON.stringify({ ...base, completedLearnLessonIds: [42] }))).toBeNull()
    expect(
      parseProgress(JSON.stringify({ ...base, lastLessonScenarioIdByMode: { xx: 'nope' } })),
    ).toBeNull()
    expect(parseProgress(JSON.stringify({ ...base, lastVisited: { section: 'bogus' } }))).toBeNull()
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
