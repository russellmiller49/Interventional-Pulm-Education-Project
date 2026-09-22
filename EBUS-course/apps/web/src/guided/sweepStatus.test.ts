import { describe, expect, it } from 'vitest'
import {
  emptyLinkedSweep,
  LINKED_SWEEP_TOLERANCES,
  stepLinkedSweep,
  type LinkedSweep,
} from '../../../../../src/lib/ebus-linked-contract'
import { describeLinkedSweep, SWEEP_TOLERANCE_NOTE } from './sweepStatus'

const base = {
  frameReady: true,
  contact: 1,
  lastEvent: null,
  lastResetProgress: null,
  targetName: 'The example node',
}
describe('sweep status is derived from sampler state only (EBUS-PRE-REVIEW-03)', () => {
  it('tells a learner who starts inside the target that frames do not count yet', () => {
    const s = describeLinkedSweep({ ...base, sweep: emptyLinkedSweep(), targetVisible: true })
    expect(s.state).toBe('inside-start')
    expect(s.inPlane).toContain('is in this plane now')
    expect(s.waiting).toMatch(/begin from a plane without the target/)
    expect(s.progress).toBeNull()
  })
  it('reports outside, crossing with remaining requirements, and complete', () => {
    let sweep: LinkedSweep = emptyLinkedSweep()
    sweep = stepLinkedSweep(sweep, { roll: 85, frameId: 'f1', visible: false, contact: 1 }).sweep
    expect(describeLinkedSweep({ ...base, sweep, targetVisible: false }).state).toBe('outside')
    sweep = stepLinkedSweep(sweep, { roll: 80, frameId: 'f2', visible: true, contact: 1 }).sweep
    const crossing = describeLinkedSweep({ ...base, sweep, targetVisible: true })
    expect(crossing.state).toBe('crossing')
    expect(crossing.progress).toEqual({ samples: 1, minSamples: 5, span: 0, minSpanDeg: 20 })
    expect(crossing.waiting).toContain('4 more paused frames with the target')
    expect(crossing.waiting).toContain('20° more rotation')
    for (const [roll, id] of [
      [70, 'f3'],
      [60, 'f4'],
      [50, 'f5'],
      [40, 'f6'],
    ] as const)
      sweep = stepLinkedSweep(sweep, { roll, frameId: id, visible: true, contact: 1 }).sweep
    const enough = describeLinkedSweep({ ...base, sweep, targetVisible: true })
    expect(enough.waiting).toContain('enough frames and rotation')
    const done = stepLinkedSweep(sweep, { roll: 30, frameId: 'f7', visible: false, contact: 1 })
    expect(done.event).toBe('complete')
    expect(describeLinkedSweep({ ...base, sweep: done.sweep, targetVisible: false }).state).toBe(
      'complete',
    )
  })
  it('names every reset cause with its numbers', () => {
    const reset = (event: Parameters<typeof describeLinkedSweep>[0]['lastEvent']) =>
      describeLinkedSweep({
        ...base,
        sweep: { ...emptyLinkedSweep(), outside: true },
        targetVisible: false,
        lastEvent: event,
        lastResetProgress: { samples: 3, span: 10 },
      }).resetReason
    expect(reset('reset-reversed')).toMatch(/direction reversed/)
    expect(reset('reset-step')).toContain(`larger than ${LINKED_SWEEP_TOLERANCES.maxStepDeg}°`)
    expect(reset('reset-contact')).toContain(`below ${LINKED_SWEEP_TOLERANCES.minContact}`)
    expect(reset('reset-early-exit')).toContain('after 3 paused frames over 10°')
    expect(reset('sample')).toBeNull()
  })
  it('explains a too-fast entry and a lost window without touching the sweep', () => {
    const fast = describeLinkedSweep({
      ...base,
      sweep: emptyLinkedSweep(),
      targetVisible: true,
      lastEvent: 'entered-too-fast',
    })
    expect(fast.state).toBe('entered-too-fast')
    const lost = describeLinkedSweep({
      ...base,
      sweep: emptyLinkedSweep(),
      targetVisible: false,
      contact: 0.2,
    })
    expect(lost.state).toBe('no-window')
    expect(lost.waiting).toContain('0.20')
  })
  it('states the tolerances as authored exercise tolerances, not clinical thresholds', () => {
    expect(SWEEP_TOLERANCE_NOTE).toContain('at least 5 times')
    expect(SWEEP_TOLERANCE_NOTE).toContain('at least 20°')
    expect(SWEEP_TOLERANCE_NOTE).toContain('12° or less')
    expect(SWEEP_TOLERANCE_NOTE).toContain('not clinical thresholds')
  })
})
