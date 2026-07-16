import { buildSeededEventQueue, deriveDeterministicSeed, nextSeededFraction } from '../seededRandom'
import type { CrrtScheduledEventDefinition } from '../types'

const event: CrrtScheduledEventDefinition = {
  id: 'synthetic-event',
  atSeconds: 600,
  jitterSeconds: { minimum: -30, maximum: 30 },
  action: { type: 'SET_FAULT', fault: 'access-obstruction', active: true },
  reviewStatus: 'pending',
  sourceIds: ['TEST-P2-001'],
}

describe('CRRT seeded deterministic events', () => {
  it('derives stable nonzero clinical seeds without using Math.random', () => {
    const randomSpy = jest.spyOn(Math, 'random')
    const first = deriveDeterministicSeed('CRRT-04', 'practice', 1)
    const second = deriveDeterministicSeed('CRRT-04', 'practice', 1)
    expect(first).toBe(second)
    expect(first).not.toBe(0)
    expect(nextSeededFraction(first)).toEqual(nextSeededFraction(second))
    expect(randomSpy).not.toHaveBeenCalled()
    randomSpy.mockRestore()
  })

  it('schedules bounded jitter reproducibly and orders ties by ID', () => {
    const seed = deriveDeterministicSeed('fixture', 'learn', 1)
    const first = buildSeededEventQueue(
      [
        { ...event, id: 'z-event' },
        { ...event, id: 'a-event', jitterSeconds: null },
      ],
      seed,
    )
    const replay = buildSeededEventQueue(
      [
        { ...event, id: 'z-event' },
        { ...event, id: 'a-event', jitterSeconds: null },
      ],
      seed,
    )
    expect(replay).toEqual(first)
    expect(first[0].scheduledAtSeconds).toBeGreaterThanOrEqual(570)
    expect(first[0].scheduledAtSeconds).toBeLessThanOrEqual(630)
    expect(first.map((item) => item.id)).toEqual(
      [...first]
        .sort((left, right) =>
          left.scheduledAtSeconds === right.scheduledAtSeconds
            ? left.id.localeCompare(right.id)
            : left.scheduledAtSeconds - right.scheduledAtSeconds,
        )
        .map((item) => item.id),
    )
  })

  it('rejects duplicate IDs, negative event time, and invalid jitter', () => {
    expect(() => buildSeededEventQueue([event, event], 1)).toThrow(/unique/i)
    expect(() => buildSeededEventQueue([{ ...event, atSeconds: -1 }], 1)).toThrow(/nonnegative/i)
    expect(() =>
      buildSeededEventQueue([{ ...event, jitterSeconds: { minimum: 10, maximum: -10 } }], 1),
    ).toThrow(/jitter/i)
  })
})
