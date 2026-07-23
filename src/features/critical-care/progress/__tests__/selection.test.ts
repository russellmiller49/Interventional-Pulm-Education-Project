import { deriveCriticalCareDashboard } from '@/features/critical-care/dashboard'

import {
  getCriticalCareResumeTarget,
  readMergedCriticalCareProgress,
  recordCriticalCareActivitySelection,
} from '../index'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('critical-care explicit activity selection', () => {
  it('gives a selected MCS case an exact, bounded global Continue target', () => {
    const storage = new MemoryStorage()
    expect(
      recordCriticalCareActivitySelection(
        storage,
        {
          activityId: 'mcs:practice:IMP-02',
          mode: 'practice',
          query: { case: 'IMP-02' },
          scenarioId: 'IMP-02',
          deviceId: 'impella',
          payloadVersion: 'mcs-selection-v1',
        },
        '2026-07-22T12:00:00.000Z',
      ),
    ).toBe(true)

    expect(getCriticalCareResumeTarget(storage)).toMatchObject({
      href: '/mechanical-circulatory-support/practice?case=IMP-02',
      pointer: {
        activityId: 'mcs:practice:IMP-02',
        scenarioId: 'IMP-02',
        deviceId: 'impella',
      },
    })
    expect(deriveCriticalCareDashboard(readMergedCriticalCareProgress(storage)).resume?.href).toBe(
      '/mechanical-circulatory-support/practice?case=IMP-02',
    )
  })

  it('gives selected CRRT lessons and cases exact global Continue targets without changing V3', () => {
    const storage = new MemoryStorage()
    expect(
      recordCriticalCareActivitySelection(
        storage,
        {
          activityId: 'crrt:learn:crrt-circuit-pressures',
          mode: 'guided',
          query: { lesson: 'crrt-circuit-pressures' },
          payloadVersion: 'crrt-selection-v1',
        },
        '2026-07-22T12:00:00.000Z',
      ),
    ).toBe(true)
    expect(
      recordCriticalCareActivitySelection(
        storage,
        {
          activityId: 'crrt:practice:CRRT-13',
          mode: 'practice',
          query: { case: 'CRRT-13' },
          scenarioId: 'CRRT-13',
          deviceId: 'prismax-aw8035-2xx',
          payloadVersion: 'crrt-selection-v1',
        },
        '2026-07-22T12:01:00.000Z',
      ),
    ).toBe(true)

    expect(
      deriveCriticalCareDashboard(readMergedCriticalCareProgress(storage)).resume,
    ).toMatchObject({
      href: '/baxter-crrt/practice?case=CRRT-13',
      pointer: { activityId: 'crrt:practice:CRRT-13' },
    })
  })

  it('fails closed for an unsupported mode or a query that changes the catalog identity', () => {
    const storage = new MemoryStorage()
    expect(
      recordCriticalCareActivitySelection(storage, {
        activityId: 'mcs:learn:iabp-timing-triggering',
        mode: 'challenge',
        query: { lesson: 'iabp-timing-triggering' },
        payloadVersion: 'mcs-selection-v1',
      }),
    ).toBe(false)
    expect(
      recordCriticalCareActivitySelection(storage, {
        activityId: 'crrt:practice:CRRT-13',
        mode: 'practice',
        query: { case: 'CRRT-14' },
        payloadVersion: 'crrt-selection-v1',
      }),
    ).toBe(false)
    expect(storage.values.size).toBe(0)
  })
})
