import { ventilationLiveReviewQueue } from '../engine/learningReview'
import { emptyVentilationLearningProgress } from '../engine/learningProgress'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationLearningExperiments } from '../content/learningExperiments'
import { mechanicalVentilationCases } from '../content/runtimeCases'
import { ventilatorDeviceIds } from '../engine/types'
import {
  createLabSession,
  labCheckpoint,
  labReadyToCompare,
  labSnapshot,
  learningLabReducer,
  parseLabProgress,
} from '../engine/learningLab'
import { completeLabUnit, performLabRound } from '../test-support/live-learning'

const change = (
  session: ReturnType<typeof createLabSession>,
  control: 'vtMl' | 'peakFlowLMin',
  value: number,
) =>
  learningLabReducer(session, { type: 'ENGINE', action: { type: 'SET_CONTROL', control, value } })

describe('live experiments as the course completion contract', () => {
  it('covers the whole curriculum while preserving all 15 original clinical patients', () => {
    expect(ventilationLearningExperiments.map((e) => e.unitId)).toEqual(
      ventilationLearningUnits.map((u) => u.id),
    )
    expect(mechanicalVentilationCases).toHaveLength(15)
    expect(mechanicalVentilationCases.some((c) => c.id === 'MV-LAB')).toBe(false)
    const patient = createLabSession(ventilationLearningUnits[0].id).simulation
    expect(patient.paused).toBe(false)
    expect(patient.waveforms.length).toBeGreaterThan(500)
    expect(patient.waveforms.every((sample) => sample.pmusCmH2O === 0)).toBe(true)
  })

  it.each(ventilatorDeviceIds)(
    'allows every live experiment to complete through the real engine on %s',
    (device) => {
      for (const unit of ventilationLearningUnits) {
        const session = completeLabUnit(unit.id, device)
        expect(session.phase).toBe('complete')
        expect(
          session.evidence.every((e) => e.baseline && e.response && e.reflection && e.completedAt),
        ).toBe(true)
        const checkpoint = labCheckpoint(session)
        const persisted = parseLabProgress(
          JSON.stringify({ version: 1, units: { [unit.id]: checkpoint } }),
        )
        expect(persisted.units[unit.id]).toEqual(JSON.parse(JSON.stringify(checkpoint)))
      }
    },
  )

  it('resets free exploration for prediction, keeps the baseline moving, and locks only treatment changes', () => {
    let session = change(createLabSession('waveform-anatomy'), 'peakFlowLMin', 80)
    session = learningLabReducer(session, { type: 'PREDICT' })
    expect(session.simulation.ventilator.settings).toMatchObject({ peakFlowLMin: 40 })
    expect(change(session, 'peakFlowLMin', 60)).toBe(session)
    const ticked = learningLabReducer(session, {
      type: 'ENGINE',
      action: { type: 'TICK', seconds: 1 },
    })
    expect(ticked.simulation.simulationTime).toBeGreaterThan(session.simulation.simulationTime)
    expect(ticked.simulation.waveforms).not.toEqual(session.simulation.waveforms)
    session = learningLabReducer(ticked, { type: 'COMMIT', choice: 2, confidence: 'unsure' })
    expect(session.evidence[0].baseline).toBeDefined()
    expect(change(session, 'peakFlowLMin', 60).simulation.ventilator.settings).toMatchObject({
      peakFlowLMin: 60,
    })
  })

  it('requires actual actions and response time; a click, paused clock, or reflection alone cannot finish', () => {
    let session = createLabSession('waveform-anatomy')
    session = learningLabReducer(session, { type: 'PREDICT' })
    session = learningLabReducer(session, { type: 'COMMIT', choice: 0, confidence: 'sure' })
    session = learningLabReducer(session, { type: 'ENGINE', action: { type: 'TICK', seconds: 20 } })
    expect(labReadyToCompare(session)).toBe(false)
    session = change(session, 'peakFlowLMin', 60)
    session = learningLabReducer(session, {
      type: 'ENGINE',
      action: { type: 'SET_PAUSED', paused: true },
    })
    const paused = learningLabReducer(session, {
      type: 'ENGINE',
      action: { type: 'TICK', seconds: 60 },
    })
    expect(paused.simulation.simulationTime).toBe(session.simulation.simulationTime)
    expect(labReadyToCompare(paused)).toBe(false)
    expect(learningLabReducer(paused, { type: 'COMPARE' }).phase).toBe('experiment')
    expect(
      learningLabReducer(paused, { type: 'CONTINUE', now: new Date().toISOString() }).completedAt,
    ).toBeUndefined()
  })

  it('reconstructs the changed patient after a hold, preserving the first prediction and snapshots', () => {
    let session = performLabRound(createLabSession('mechanics-load-and-pressure'), 1)
    const checkpoint = labCheckpoint(session)
    const restored = createLabSession(session.unitId, session.device, checkpoint)
    expect(restored.simulation.paused).toBe(true)
    expect(restored.simulation.simulationTime).toBeCloseTo(session.simulation.simulationTime, 5)
    expect(restored.simulation.teachingMechanics).toEqual(session.simulation.teachingMechanics)
    expect(restored.simulation.measurements.peakPressureCmH2O).toBeCloseTo(
      session.simulation.measurements.peakPressureCmH2O,
      0,
    )
    expect(restored.evidence).toEqual(session.evidence)
    session = learningLabReducer(restored, { type: 'RESET' })
    expect(session.phase).toBe('experiment')
    expect(session.evidence[0].prediction).toBe(1)
    expect(session.evidence[0].response).toBeUndefined()
    expect(session.completedAt).toBeUndefined()
  })

  it('rejects incomplete, malformed, or incompatible saved completion', () => {
    const s = labCheckpoint(createLabSession('waveform-anatomy'))
    for (const value of [
      { ...s, version: 2 },
      { ...s, phase: 'complete', completedAt: new Date().toISOString() },
      { ...s, time: Infinity },
      { ...s, events: [{ at: 50, action: { type: 'SELECT_MODE', mode: 'volume-ac' } }] },
    ]) {
      expect(
        parseLabProgress(JSON.stringify({ version: 1, units: { [s.unitId]: value } })).units,
      ).toEqual({})
    }
    expect(parseLabProgress('not JSON').units).toEqual({})
  })
})

describe('the observed physiology supports the lesson', () => {
  const units = new Map(ventilationLearningUnits.map((unit) => [unit.id, completeLabUnit(unit.id)]))
  const observed = (id: string, round: 0 | 1 = 0) => {
    const e = units.get(id)!.evidence[round]
    return { before: e.baseline!.values, after: e.response!.values }
  }
  it('shows faster flow delivering a similar volume in less time', () => {
    const { before, after } = observed('waveform-anatomy')
    expect(after.ti).toBeLessThan(before.ti)
    expect(Math.abs(after.volume - before.volume)).toBeLessThan(15)
  })
  it('shows stiffness as pressure under volume control and volume under pressure control', () => {
    const vc = observed('modes-and-breath-delivery'),
      pc = observed('modes-and-breath-delivery', 1)
    expect(vc.after.peak - vc.before.peak).toBeGreaterThan(5)
    expect(Math.abs(vc.after.volume - vc.before.volume)).toBeLessThan(15)
    expect(pc.after.volume).toBeLessThan(pc.before.volume * 0.75)
    expect(Math.abs(pc.after.peak - pc.before.peak)).toBeLessThan(1)
  })
  it('separates the resistive and elastic pressure patterns using real holds', () => {
    const resistance = observed('mechanics-load-and-pressure'),
      stiffness = observed('mechanics-load-and-pressure', 1)
    expect(resistance.after.peak - resistance.before.peak).toBeGreaterThan(4)
    expect(Math.abs(resistance.after.plateau - resistance.before.plateau)).toBeLessThan(1)
    expect(stiffness.after.plateau - stiffness.before.plateau).toBeGreaterThan(5)
    expect(
      units.get('mechanics-load-and-pressure')!.evidence.every((e) => e.response!.plateauValid),
    ).toBe(true)
    expect(units.get('lung-protection')!.evidence[1].response!.plateauValid).toBe(false)
  })
  it('shows timing, triggering, and cycling consequences in the original patients', () => {
    const lessTime = observed('expiration-and-air-trapping'),
      moreTime = observed('expiration-and-air-trapping', 1)
    expect(lessTime.after.expiratoryFlow).toBeLessThan(lessTime.before.expiratoryFlow - 5)
    expect(moreTime.after.ti).toBeLessThan(moreTime.before.ti)
    expect(moreTime.after.intrinsicPeep).toBeLessThan(moreTime.before.intrinsicPeep)
    const trigger = observed('triggering-and-cycling'),
      cycle = observed('triggering-and-cycling', 1)
    expect(trigger.after.missed).toBeLessThan(trigger.before.missed)
    expect(cycle.after.ti).toBeGreaterThan(cycle.before.ti)
  })
  it('starts oxygenation near equilibrium so an oxygen increase does not misleadingly lower SpO₂', () => {
    const session = createLabSession('controls-and-goals')
    const initial = labSnapshot(session.simulation).values.spo2
    const baseline = learningLabReducer(session, {
      type: 'ENGINE',
      action: { type: 'TICK', seconds: 60 },
    })
    expect(Math.abs(labSnapshot(baseline.simulation).values.spo2 - initial)).toBeLessThan(0.1)
    const oxygen = observed('controls-and-goals', 1),
      peep = observed('oxygenation-response')
    expect(oxygen.after.spo2).toBeGreaterThan(oxygen.before.spo2)
    expect(peep.after.spo2).toBeGreaterThan(peep.before.spo2 + 5)
    expect(observed('ventilation-and-co2').after.co2).toBeLessThan(
      observed('ventilation-and-co2').before.co2,
    )
    const smallerBreath = observed('ventilation-and-co2', 1)
    expect(smallerBreath.after.volume).toBeLessThan(smallerBreath.before.volume)
    expect(smallerBreath.after.co2).toBeGreaterThan(smallerBreath.before.co2)
  })
  it('retains the original intervention latency and waits for changed patient findings', () => {
    const pain = observed('safety-reassessment-and-human-factors', 1)
    const record = units.get('safety-reassessment-and-human-factors')!.evidence[1]
    expect(record.response!.at - record.baseline!.at).toBeGreaterThanOrEqual(270)
    expect(pain.after.pain).toBeLessThan(pain.before.pain)
    expect(pain.after.dyspnea).toBeLessThan(pain.before.dyspnea)
  })
})

describe('spaced retrieval after live practice', () => {
  it('revisits uncertain observations immediately and confident observations after a week', () => {
    const session = completeLabUnit('waveform-anatomy')
    const lab = { version: 1 as const, units: { [session.unitId]: labCheckpoint(session) } }
    const learning = emptyVentilationLearningProgress()
    const completed = Date.parse(session.completedAt!)
    expect(ventilationLiveReviewQueue(lab, learning, completed)).toHaveLength(0)
    expect(ventilationLiveReviewQueue(lab, learning, completed + 8 * 86400000)).toHaveLength(1)
    const uncertain = {
      ...lab,
      units: {
        [session.unitId]: {
          ...lab.units[session.unitId],
          evidence: [
            { ...session.evidence[0], confidence: 'unsure' as const },
            session.evidence[1],
          ] as const,
        },
      },
    }
    expect(ventilationLiveReviewQueue(uncertain, learning, completed)).toHaveLength(1)
    expect(uncertain.units[session.unitId].evidence[0].prediction).toBe(
      session.evidence[0].prediction,
    )
  })
})
