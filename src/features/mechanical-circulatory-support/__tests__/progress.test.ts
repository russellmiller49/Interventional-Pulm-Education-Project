import {
  createDefaultMcsProgress,
  readMcsProgress,
  recordMcsLessonComplete,
  writeMcsProgress,
} from '../engine'
import { isMcsCapstoneUnlocked, remainingMcsCapstoneRequirements } from '../content'

describe('MCS versioned local progress', () => {
  beforeEach(() => window.localStorage.clear())

  it('falls back safely when a future or malformed version is present', () => {
    window.localStorage.setItem(
      'interventionalpulm:mcs-progress:v1',
      JSON.stringify({ version: 99, completedLessonIds: ['unsafe'] }),
    )
    expect(readMcsProgress()).toEqual(createDefaultMcsProgress())
    window.localStorage.setItem('interventionalpulm:mcs-progress:v1', '{bad')
    expect(readMcsProgress()).toEqual(createDefaultMcsProgress())
  })

  it('round-trips allowlisted progress and unlocks only the completed device track', () => {
    let progress = createDefaultMcsProgress()
    for (const lesson of [
      'mcs-foundations-signals',
      'mcs-foundations-mechanisms',
      'iabp-timing-triggering',
      'iabp-efficacy-limits',
    ]) {
      progress = recordMcsLessonComplete(progress, lesson, 'iabp')
    }
    progress = { ...progress, masteredCaseIds: ['IABP-01', 'IABP-02', 'IABP-03'] }
    writeMcsProgress(progress)
    const saved = readMcsProgress()
    expect(isMcsCapstoneUnlocked(saved, 'iabp')).toBe(true)
    expect(isMcsCapstoneUnlocked(saved, 'impella')).toBe(false)
    expect(remainingMcsCapstoneRequirements(saved, 'iabp')).toEqual([])
  })
})
