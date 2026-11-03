import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { INSTRUMENT_CLIPS } from './clips'
import {
  CLEAR_MM,
  LAB_FAULTS,
  LAB_STEPS,
  TARGET_MM,
  initialLabState,
  labComplete,
  labReducer,
  BRUSH_TARGET_MM,
  BRISTLE_LENGTH_MM,
  REACH_MM,
  atTarget,
  maxOutMm,
  type InstrumentId,
  type LabAction,
  type LabState,
} from './instrument-model'

const run = (instrument: InstrumentId, actions: readonly LabAction[]): LabState =>
  actions.reduce(labReducer, initialLabState(instrument))

const move = (outMm: number): LabAction => ({ type: 'move', outMm })
const control = (value: number): LabAction => ({ type: 'control', value })
const suction = (on: boolean): LabAction => ({ type: 'suction', on })

describe('the instrument lab model', () => {
  it('completes the forceps sequence with no faults', () => {
    const state = run('forceps', [
      move(6),
      control(1),
      move(TARGET_MM),
      control(0),
      move(4),
      move(-2),
    ])
    expect(state.memory.done).toEqual(['pass-closed', 'open', 'seat', 'bite', 'withdraw'])
    expect(state.memory.faults).toEqual([])
    expect(labComplete(state)).toBe(true)
  })

  it('flags forceps opened inside the channel and brought back open', () => {
    const opened = run('forceps', [move(1), control(1)])
    expect(opened.memory.faults).toContain('opened-in-channel')
    const back = run('forceps', [move(6), control(1), move(0)])
    expect(back.memory.faults).toContain('withdrawn-open')
  })

  it('loses the bite if the cups open again before withdrawal', () => {
    const state = run('forceps', [move(6), control(1), move(TARGET_MM), control(0), control(1)])
    expect(state.memory.faults).toContain('opened-after-bite')
    expect(state.memory.specimen).toBe(false)
  })

  it('takes steps only in order', () => {
    // Opening before the cups are clear does not count as the open step.
    const state = run('forceps', [control(1)])
    expect(state.memory.done).toEqual([])
  })

  it('completes the brush sequence: out, sweep along the plaque, sheathe, withdraw', () => {
    const state = run('brush', [
      move(CLEAR_MM + 1),
      control(1),
      move(6),
      move(3),
      move(6),
      move(3),
      control(0),
      move(-3),
    ])
    expect(state.memory.done).toEqual([
      'sheath-out',
      'brush-out',
      'brush-target',
      'brush-in',
      'withdraw',
    ])
    expect(state.memory.faults).toEqual([])
  })

  it('sweeps the brush along the plaque beside its path, not into a wall ahead', () => {
    // No wall stops the brush catheter; it runs on past the plaque.
    expect(maxOutMm('brush')).toBeGreaterThan(BRUSH_TARGET_MM.to - REACH_MM.brush)
    const out = (outMm: number) => ({ instrument: 'brush' as const, outMm, control: 1 })
    // The bristled span overlaps the plaque across the whole to-and-fro range used above.
    for (const outMm of [3, 6]) expect(atTarget(out(outMm))).toBe(true)
    // Short of the plaque, or with the bristles carried past it, there is no contact.
    expect(atTarget(out(BRUSH_TARGET_MM.from - REACH_MM.brush - 1))).toBe(false)
    expect(atTarget(out(BRUSH_TARGET_MM.to + BRISTLE_LENGTH_MM - REACH_MM.brush + 1))).toBe(false)
    // A sheathed brush touches nothing.
    expect(atTarget({ instrument: 'brush', outMm: 6, control: 0 })).toBe(false)
  })

  it('flags a brush pushed out in the channel or pulled back unsheathed', () => {
    expect(run('brush', [move(0), control(1)]).memory.faults).toContain('brush-in-channel')
    expect(run('brush', [move(4), control(1), move(-1)]).memory.faults).toContain(
      'withdrawn-unsheathed',
    )
  })

  it('completes the needle sequence with suction only inside the target', () => {
    const state = run('needle', [
      move(6),
      move(TARGET_MM),
      control(1),
      suction(true),
      move(TARGET_MM - 2),
      move(TARGET_MM),
      move(TARGET_MM - 2),
      suction(false),
      control(0),
      move(-4),
    ])
    expect(state.memory.done).toEqual([
      'catheter-out',
      'catheter-on-wall',
      'needle-out',
      'aspirate',
      'suction-off',
      'needle-in',
      'withdraw',
    ])
    expect(state.memory.faults).toEqual([])
  })

  it('flags the needle errors that damage the scope or spoil the sample', () => {
    expect(run('needle', [move(0), control(1)]).memory.faults).toContain('needle-in-channel')
    expect(run('needle', [move(6), suction(true)]).memory.faults).toContain('suction-off-target')
    expect(
      run('needle', [move(TARGET_MM), control(1), suction(true), control(0)]).memory.faults,
    ).toContain('suction-on-withdrawal')
    expect(run('needle', [move(6), control(1), move(0)]).memory.faults).toContain(
      'withdrawn-needle-out',
    )
  })

  it('keeps every step and message within the shared learner-copy gate', () => {
    const texts = [
      ...Object.values(LAB_STEPS).flatMap((steps) => steps.flatMap((s) => [s.label, s.result])),
      ...Object.values(LAB_FAULTS),
      ...Object.values(INSTRUMENT_CLIPS).flatMap((c) => [c.hand.caption, c.tip.caption]),
    ]
    for (const text of texts) expect(flaggedLearnerCopyTerms(text)).toEqual([])
  })

  it('stops the catheter at the target and resets on a new instrument', () => {
    const state = run('forceps', [move(40)])
    expect(state.outMm).toBe(TARGET_MM)
    const next = labReducer(state, { type: 'select', instrument: 'needle' })
    expect(next.instrument).toBe('needle')
    expect(next.memory.done).toEqual([])
  })
})
