import { idealBreaths, idealComparisonAxes, idealSeriesPath } from '../engine/idealComparison'
import { IDEAL_REFERENCE } from '../components/teaching/IdealizedComparison'
import {
  createLabSession,
  labCheckpoint,
  labGoalMet,
  labReadyToCompare,
  labUnitComplete,
  learningLabReducer,
  parseLabProgress,
  labSnapshot,
  type LabSession,
} from '../engine/learningLab'
import { observationFor } from '../engine/learningObservation'
import { completedBreath, breathStopIndex, inspectionWindow } from '../engine/teachingBreath'
import { holdStatus } from '../engine/learningMeasurements'
import { completeLabUnit, performLabRound, finishLabRound } from '../test-support/live-learning'
import { foundationUnitIds } from '../content/foundations'
import { ventilatorDeviceIds, type VentilationAction } from '../engine/types'

const engine = (s: LabSession, action: VentilationAction) =>
  learningLabReducer(s, { type: 'ENGINE', action })
function start(id = 'mechanics-load-and-pressure') {
  return learningLabReducer(learningLabReducer(createLabSession(id), { type: 'PREDICT' }), {
    type: 'COMMIT',
    choice: 2,
    confidence: 'unsure',
  })
}
const hold = { type: 'hold', hold: 'inspiratory' } as const
function acquire(s: LabSession) {
  s = engine(s, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
  return engine(s, { type: 'TICK', seconds: 5 })
}

describe('idealized comparison: finite-time delivery on common physical axes', () => {
  it.each(
    [0.025, 0.05, 0.1].flatMap((c) =>
      [5, 10, 40].flatMap((r) => [0.4, 1, 2].map((ti) => [c, r, ti])),
    ),
  )('continuous volume at C=%s R=%s Ti=%s', (compliance, resistance, ti) => {
    const input = { ...IDEAL_REFERENCE, compliance, resistance, ti, duration: ti + 3 }
    const { pressureTargeted: pc, volumeTargeted: vc } = idealBreaths(input)
    expect(pc.volume[120]).toBeCloseTo(
      input.pressure * compliance * (1 - Math.exp(-ti / (resistance * compliance))) * 1000,
      9,
    )
    for (const breath of [pc, vc]) {
      expect(breath.time[120]).toBe(ti)
      expect(breath.time[121]).toBe(ti)
      expect(breath.volume[120]).toBeCloseTo(breath.volume[121], 10)
      expect(breath.deliveredVolume).toBeCloseTo(breath.volume[120], 10)
      expect(breath.time.at(-1)).toBe(ti + 3)
      expect(breath.volume.every(Number.isFinite)).toBe(true)
    }
  })
  it('repairs the exact review example, with 345.866 rather than 400 mL entering expiration', () => {
    const pc = idealBreaths({ ...IDEAL_REFERENCE, pressure: 8 }).pressureTargeted
    expect(pc.deliveredVolume).toBeCloseTo(345.8658867, 5)
    expect(pc.volume[121]).toBeCloseTo(345.8658867, 5)
  })
  it('holds reference targets and duration while a smaller dependent volume has a lower plotted peak', () => {
    const reference = idealBreaths(IDEAL_REFERENCE)
    const stiff = idealBreaths({ ...IDEAL_REFERENCE, compliance: IDEAL_REFERENCE.compliance / 2 })
    const axes = idealComparisonAxes(IDEAL_REFERENCE)
    expect(reference.pressureTargeted.deliveredVolume).toBeCloseTo(
      reference.volumeTargeted.deliveredVolume,
      8,
    )
    expect(stiff.pressureTargeted.deliveredVolume).toBeLessThan(
      reference.pressureTargeted.deliveredVolume,
    )
    expect(stiff.volumeTargeted.deliveredVolume).toBe(reference.volumeTargeted.deliveredVolume)
    expect(stiff.pressureTargeted.time).toEqual(reference.pressureTargeted.time)
    const y = (b: typeof reference.pressureTargeted) =>
      Number(idealSeriesPath(b, 'volume', axes).split(' ')[241])
    expect(y(stiff.pressureTargeted)).toBeGreaterThan(y(reference.pressureTargeted))
    for (const input of [
      IDEAL_REFERENCE,
      { ...IDEAL_REFERENCE, compliance: 0.025, resistance: 40 },
    ]) {
      for (const b of Object.values(idealBreaths(input)))
        for (const key of ['pressure', 'flow', 'volume'] as const) {
          expect(Math.min(...b[key])).toBeGreaterThanOrEqual(axes[key][0])
          expect(Math.max(...b[key])).toBeLessThanOrEqual(axes[key][1])
        }
    }
  })
})

describe('measurement occurrence, acquisition, current conditions and validity', () => {
  it('does not award a pre-change hold, and preserves it as historical until a fresh maneuver completes', () => {
    let s = acquire(start())
    expect(labGoalMet(hold, s)).toBe(true)
    const old = s.holds![0]
    s = engine(s, { type: 'SET_TEACHING_MECHANICS', overrides: { resistanceScale: 2 } })
    expect(labGoalMet(hold, s)).toBe(false)
    expect(holdStatus(s.simulation, s.holds!, s.conditionRevision!)).toMatch(/Historical/)
    expect(s.holds![0]).toEqual(old)
    const historical = labSnapshot(s.simulation, s.holds, s.conditionRevision)
    expect(historical.plateauSource).toBe('historical')
    expect(historical.values.plateau).toBe(old.value)
    expect(historical.plateauValid).toBe(false)
    s = engine(s, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
    expect(labGoalMet(hold, s)).toBe(false)
    s = engine(s, { type: 'TICK', seconds: 5 })
    expect(labGoalMet(hold, s)).toBe(true)
    expect(s.holds).toHaveLength(2)
    expect(s.holds![1].startedAt).toBeGreaterThan(old.capturedAt)
  })
  it('preserves a current acquisition through playback and rejects a mode change or an aborted hold', () => {
    let s = acquire(start())
    for (const action of [
      { type: 'SET_PAUSED', paused: true },
      { type: 'SET_SPEED', speed: 5 },
      { type: 'SET_SCREEN', screen: 'main' },
    ] as VentilationAction[])
      s = engine(s, action)
    expect(labGoalMet(hold, s)).toBe(true)
    s = engine(s, { type: 'SELECT_MODE', mode: 'pressure-ac' })
    s = engine(s, { type: 'CONFIRM_MODE' })
    expect(labGoalMet(hold, s)).toBe(false)
    let aborted = engine(start(), { type: 'PERFORM_HOLD', hold: 'inspiratory' })
    aborted = engine(aborted, { type: 'SET_TEACHING_MECHANICS', overrides: { resistanceScale: 2 } })
    aborted = engine(aborted, { type: 'TICK', seconds: 6 })
    expect(aborted.holds).toHaveLength(0)
  })
  it('records an effort-contaminated maneuver as performed without making it interpretable', () => {
    const later = completeLabUnit('lung-protection')
    expect(later.phase).toBe('complete')
    expect(later.holds!.at(-1)!.interpretable).toBe(false)
    expect(later.holds!.at(-1)!.reason).toMatch(/effort/)
    expect(labGoalMet(hold, later)).toBe(true)
    expect(later.evidence[1].response!.plateauValid).toBe(false)
  })
  it('does not count a queued hold, then records its actual conditions when it completes', () => {
    let s = finishLabRound(performLabRound(createLabSession('lung-protection')))
    s = learningLabReducer(s, { type: 'PREDICT' })
    s = learningLabReducer(s, { type: 'COMMIT', choice: 2, confidence: 'sure' })
    s = engine(s, { type: 'PERFORM_INTERVENTION', interventionId: 'inspiratory-hold' })
    expect(s.simulation.ventilator.pendingHold).toBe('inspiratory')
    expect(labGoalMet(hold, s)).toBe(false)
    expect(holdStatus(s.simulation, s.holds!, s.conditionRevision!)).toMatch(/queued/)
    s = engine(s, { type: 'TICK', seconds: 12 })
    expect(labGoalMet(hold, s)).toBe(true)
    expect(s.holds!.at(-1)!.inputs.mode).toBe(s.simulation.ventilator.settings.mode)
    expect(s.holds!.at(-1)!.interpretable).toBe(false)
  })
  it('captures a settled hold through one-breath stepping as well as normal clock ticks', () => {
    const held = engine(start(), { type: 'PERFORM_HOLD', hold: 'inspiratory' })
    let stepped = engine(held, { type: 'STEP_BREATH' })
    stepped = engine(stepped, { type: 'STEP_BREATH' })
    const ticked = engine(held, { type: 'TICK', seconds: 8 })
    expect(stepped.holds![0].value).toBeCloseTo(ticked.holds![0].value, 1)
    expect(stepped.holds![0].capturedAt).toBe(ticked.holds![0].capturedAt)
  })
})

describe('independent learning evidence and compatibility', () => {
  it('retains the actual manual-pause trace independently of the older baseline', () => {
    const s = performLabRound(createLabSession('breathing-with-support'))
    const inspection = s.evidence[0].inspection!
    expect(inspection.sample.time).toBeGreaterThan(0)
    expect(inspection.waveforms!.at(-1)!.time).toBe(inspection.sample.time)
    const trace = inspectionWindow(inspection.waveforms!, inspection)
    expect(trace.at(-1)).toBe(inspection.sample)
    expect(trace.every((sample, i) => i === 0 || sample.time - trace[i - 1].time < 0.09)).toBe(true)
  })
  it('supports captured phase inspection with a paused clock and no timed click', () => {
    let s = start('breathing-with-support')
    s = engine(s, { type: 'SET_PAUSED', paused: true })
    const before = s.simulation
    const breath = completedBreath(s.evidence[0].baseline!.waveforms)
    s = learningLabReducer(s, {
      type: 'INSPECT',
      sampleTime: breath[breathStopIndex(breath, 'expiration')].time,
    })
    expect(s.simulation).toBe(before)
    const inspected = inspectionWindow(s.evidence[0].baseline!.waveforms, s.evidence[0].inspection!)
    expect(inspected.at(-1)).toBe(s.evidence[0].inspection!.sample)
    expect(inspected.at(-2)).toBe(s.evidence[0].inspection!.previous)
    expect(labReadyToCompare(s)).toBe(true)
    s = learningLabReducer(s, { type: 'COMPARE' })
    expect(observationFor(s).correct).toBe('outward-falling')
    expect(learningLabReducer(s, { type: 'CONTINUE', now: '2026-09-13T01:00:00.000Z' })).toBe(s)
    s = learningLabReducer(s, {
      type: 'INTERPRET',
      choice: 'inward-rising',
      now: '2026-09-13T01:00:00.000Z',
    })
    expect(s.evidence[0].observation?.correct).toBe(false)
    s = learningLabReducer(s, { type: 'CONTINUE', now: '2026-09-13T01:00:00.000Z' })
    expect(s.round).toBe(1) // Learn records and explains mistakes; it does not require a correct prediction.
    expect(s.evidence[0].prediction).toBe(2)
  })
  it('reports actual unchanged results and confounding without substituting expected directions', () => {
    let s = start('waveform-anatomy')
    s = engine(s, { type: 'SET_CONTROL', control: 'vtMl', value: 500 })
    s = engine(s, { type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 })
    s = engine(s, { type: 'TICK', seconds: 15 })
    s = learningLabReducer(s, { type: 'COMPARE' })
    expect(observationFor(s).correct).toBe('indeterminate')
    expect(s.evidence[0].response?.issues?.join()).toMatch(/vtMl/)
    const oxygen = completeLabUnit('controls-and-goals')
    expect(observationFor(oxygen).correct).toBe('similar')
  })
  it('flags a pressure-limited run instead of substituting the intended direction', () => {
    let s = start('waveform-anatomy')
    s = engine(s, { type: 'SET_CONTROL', control: 'highPressureLimitCmH2O', value: 20 })
    s = engine(s, { type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 })
    s = engine(s, { type: 'TICK', seconds: 15 })
    s = learningLabReducer(s, { type: 'COMPARE' })
    expect(s.evidence[0].response?.issues?.join()).toMatch(/Pressure alarm or limitation/)
    expect(observationFor(s).correct).toBe('indeterminate')
  })
  it.each(ventilatorDeviceIds)(
    'completes both revised rounds through actual supported actions on %s',
    (device) => {
      for (const id of foundationUnitIds) {
        const s = completeLabUnit(id, device)
        expect(labUnitComplete(s)).toBe(true)
        expect(s.evidence.every((e) => e.observation && e.baseline && e.response)).toBe(true)
        const parsed = parseLabProgress(
          JSON.stringify({ version: 1, units: { [id]: labCheckpoint(s) } }),
        )
        expect(parsed.units[id]).toBeDefined()
        const restored = createLabSession(id, device, parsed.units[id])
        expect(restored.simulation.paused).toBe(true)
        expect(restored.round).toBe(1)
      }
    },
  )
  it('keeps legacy completion historical, with no new independent evidence or final-check eligibility', () => {
    const s = completeLabUnit('waveform-anatomy')
    const legacy = {
      ...labCheckpoint(s),
      evidenceVersion: undefined,
      evidence: [
        { ...s.evidence[0], observation: undefined },
        { ...s.evidence[1], observation: undefined },
      ] as const,
    }
    const p = parseLabProgress(JSON.stringify({ version: 1, units: { [s.unitId]: legacy } }))
    expect(p.units[s.unitId].completedAt).toBe(s.completedAt)
    expect(labUnitComplete(p.units[s.unitId])).toBe(false)
    const restored = createLabSession(s.unitId, s.device, p.units[s.unitId])
    expect(restored.phase).toBe('explore')
    expect(restored.history![0].completedAt).toBe(s.completedAt)
    expect(restored.evidence).toEqual([{}, {}])
  })
  it('archives resets and restarts, keeps the first prediction on reset, and never reuses its observation', () => {
    let s = performLabRound(createLabSession('mechanics-load-and-pressure'), 1)
    s = learningLabReducer(s, {
      type: 'INTERPRET',
      choice: observationFor(s).correct,
      now: '2026-09-13T01:00:00.000Z',
    })
    const response = s.evidence[0].response
    s = learningLabReducer(s, { type: 'RESET' })
    expect(s.evidence[0].prediction).toBe(1)
    expect(s.evidence[0].observation).toBeUndefined()
    expect(s.holds).toEqual([])
    expect(s.history!.at(-1)!.evidence[0].response).toEqual(response)
    expect(s.history!.at(-1)!.holds!.length).toBeGreaterThan(0)
    s = learningLabReducer(s, { type: 'RESTART' })
    expect(s.evidence[0].prediction).toBeUndefined()
    expect(s.history!.length).toBeGreaterThan(1)
  })
})
