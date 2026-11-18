import {
  DRIVE_MAX_FRAME_S,
  DRIVE_QUEUE_LIMIT_MM,
  DRIVE_SPEED_MM_PER_S,
  ScopeDriveQueue,
} from './drive-queue'

/** Pumps the queue at each time in `timesMs` and returns the millimetres released in total. */
function pumpAt(queue: ScopeDriveQueue, timesMs: number[]): number {
  return timesMs.reduce((total, now) => total + queue.pump(now), 0)
}

/** Frame times every `stepMs` from `fromMs` to `toMs` inclusive. */
function frames(fromMs: number, toMs: number, stepMs: number): number[] {
  const times: number[] = []
  for (let t = fromMs; t <= toMs + 1e-9; t += stepMs) times.push(t)
  return times
}

describe('ScopeDriveQueue', () => {
  it('releases queued advance at the drive speed and stops at what was pressed', () => {
    const queue = new ScopeDriveQueue()
    queue.pump(0)
    queue.push(3)
    // 50 ms of 60 Hz frames at 24 mm/s releases 1.2 mm.
    expect(pumpAt(queue, frames(1000 / 60, 50, 1000 / 60))).toBeCloseTo(
      DRIVE_SPEED_MM_PER_S * 0.05,
      6,
    )
    // Given time, all 3 mm arrive and no more.
    expect(pumpAt(queue, frames(60, 1000, 1000 / 60))).toBeCloseTo(3 - 1.2, 6)
    expect(queue.pending).toBe(0)
    expect(queue.pump(1100)).toBe(0)
  })

  it('withdraws with negative insertion', () => {
    const queue = new ScopeDriveQueue()
    queue.pump(0)
    queue.push(-3)
    expect(pumpAt(queue, frames(10, 2000, 10))).toBeCloseTo(-3, 6)
  })

  it('banks no more than the queue limit in either direction', () => {
    const queue = new ScopeDriveQueue()
    for (let i = 0; i < 20; i += 1) queue.push(3)
    expect(queue.pending).toBe(DRIVE_QUEUE_LIMIT_MM)
    queue.clear()
    for (let i = 0; i < 20; i += 1) queue.push(-3)
    expect(queue.pending).toBe(-DRIVE_QUEUE_LIMIT_MM)
  })

  it('ignores a non-finite press', () => {
    const queue = new ScopeDriveQueue()
    queue.push(Number.NaN)
    queue.push(Number.POSITIVE_INFINITY)
    expect(queue.pending).toBe(0)
  })

  it('drops queued insertion on clear', () => {
    const queue = new ScopeDriveQueue()
    queue.pump(0)
    queue.push(9)
    queue.clear()
    expect(pumpAt(queue, frames(10, 500, 10))).toBe(0)
  })

  it('moves no faster when two frame loops pump it (page frames and the VR scene)', () => {
    const single = new ScopeDriveQueue()
    single.pump(0)
    single.push(15)
    const alone = pumpAt(single, frames(16, 400, 16))

    const shared = new ScopeDriveQueue()
    shared.pump(0)
    shared.push(15)
    // The page loop on 16 ms frames and the scene loop 8 ms out of phase, plus a duplicate pump
    // in the same instant.
    const page = frames(16, 400, 16)
    const scene = frames(8, 392, 16)
    const times = [...page, ...scene, 200].sort((a, b) => a - b)
    const together = pumpAt(shared, times)

    expect(together).toBeCloseTo(alone, 6)
    expect(together).toBeCloseTo(DRIVE_SPEED_MM_PER_S * 0.4, 6)
  })

  it('drives a stalled frame no further than one ordinary frame', () => {
    const queue = new ScopeDriveQueue()
    queue.pump(0)
    queue.push(15)
    expect(queue.pump(5000)).toBeCloseTo(DRIVE_SPEED_MM_PER_S * DRIVE_MAX_FRAME_S, 6)
  })

  it('releases nothing for a pump that is not later than the last one', () => {
    const queue = new ScopeDriveQueue()
    queue.pump(100)
    queue.push(3)
    expect(queue.pump(100)).toBe(0)
    expect(queue.pump(90)).toBe(0)
    expect(queue.pump(110)).toBeCloseTo(DRIVE_SPEED_MM_PER_S * 0.01, 6)
  })
})
