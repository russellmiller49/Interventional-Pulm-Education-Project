import { describe, expect, it } from 'vitest'
import {
  emptyLinkedSweep,
  stepLinkedSweep,
  type LinkedSweep,
} from '../../../../../src/lib/ebus-linked-contract'
import { describeLinkedSweep } from './sweepStatus'

const base = { frameReady: true, contact: 1, targetName: 'The node' }
const step = (sweep: LinkedSweep, roll: number, visible: boolean, contact = 1) =>
  stepLinkedSweep(sweep, { roll, frameId: `f${roll}:${visible}:${contact}`, visible, contact })

describe('rotation sweep', () => {
  it('asks for rotation before anything has been sampled', () => {
    const s = describeLinkedSweep({ ...base, sweep: emptyLinkedSweep(), targetVisible: false })
    expect(s.state).toBe('start')
    expect(s.next).toMatch(/Scope rotation slider/)
  })
  it('completes after 20° of rotation with the node seen, however large the steps', () => {
    let sweep = step(emptyLinkedSweep(), 85, false).sweep
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).state).toBe('sweeping')
    // One drag of the slider: a single large step onto the node.
    const done = step(sweep, 55, true)
    expect(done.event).toBe('complete')
    sweep = done.sweep
    expect(sweep).toMatchObject({ phase: 'complete', span: 30, samples: 1 })
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: true }).state).toBe('complete')
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).state).toBe(
      'complete-off-target',
    )
  })
  it('counts rotation in either direction and says how much is left', () => {
    let sweep = step(emptyLinkedSweep(), 10, true).sweep
    sweep = step(sweep, 18, true).sweep
    sweep = step(sweep, 4, true).sweep
    expect(sweep).toMatchObject({ phase: 'crossing', span: 14, startRoll: 4 })
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: true }).next).toMatch(/6° more/)
    expect(step(sweep, 24, true).sweep.phase).toBe('complete')
  })
  it('does not complete on rotation that never showed the node', () => {
    let sweep = step(emptyLinkedSweep(), 90, false).sweep
    sweep = step(sweep, 60, false).sweep
    expect(sweep.phase).toBe('find-edge')
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).next).toMatch(
      /comes into the image/,
    )
  })
  it('ignores frames without tissue contact instead of restarting', () => {
    let sweep = step(emptyLinkedSweep(), 10, true).sweep
    const lost = step(sweep, 40, true, 0.2)
    expect(lost.event).toBe('no-contact')
    expect(lost.sweep).toMatchObject({ span: 0, samples: 1 })
    sweep = lost.sweep
    expect(describeLinkedSweep({ ...base, sweep, contact: 0.2, targetVisible: false }).state).toBe(
      'no-window',
    )
  })
})
