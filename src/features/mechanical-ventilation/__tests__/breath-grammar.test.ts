import { breathGrammarRow, breathGrammarRows, breathGrammarRowsFor } from '../content/breathGrammar'
import { breathStopIds } from '../content/breathSpine'
import { VENTILATION_CONTROL_PANEL } from '../content/controlPanel'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationSectionSpec } from '../content/sectionSpecs'
import {
  createLabSession,
  labSnapshot,
  learningLabReducer,
  type LabSession,
} from '../engine/learningLab'
import type { VentilationAction } from '../engine/types'

/**
 * The grammar's direction claims are run, not asserted from intention. Each row names what moves
 * on the breath; here the passive teaching patient is changed the way the row's section changes it
 * and the readings are checked for the direction the row states.
 */

function run(session: LabSession, seconds: number): LabSession {
  let next = session
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.1) {
    next = learningLabReducer(next, { type: 'ENGINE', action: { type: 'TICK', seconds: 0.1 } })
  }
  return next
}

function engine(session: LabSession, action: VentilationAction): LabSession {
  return learningLabReducer(session, { type: 'ENGINE', action })
}

function opened(unitId: string): LabSession {
  // Past the prediction, so the controls accept changes.
  let session = createLabSession(unitId)
  session = learningLabReducer(session, { type: 'PREDICT' })
  session = learningLabReducer(session, { type: 'COMMIT', choice: 0, confidence: 'unsure' })
  return run(session, 2)
}

function holdAndSettle(session: LabSession): LabSession {
  let next = engine(session, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
  next = run(next, 8)
  return next
}

describe('the breath grammar, against the engine', () => {
  it('resistive load: the peak rises while a valid plateau stays close, at the same volume', () => {
    const baseline = labSnapshot(holdAndSettle(opened('mechanics-load-and-pressure')).simulation)
    let session = opened('mechanics-load-and-pressure')
    session = engine(session, { type: 'SET_TEACHING_MECHANICS', overrides: { resistanceScale: 2 } })
    const after = labSnapshot(holdAndSettle(session).simulation)
    expect(after.values.peak).toBeGreaterThan(baseline.values.peak + 2)
    expect(Math.abs(after.values.plateau - baseline.values.plateau)).toBeLessThan(2)
    expect(Math.abs(after.values.volume - baseline.values.volume)).toBeLessThan(30)
    expect(after.plateauValid).toBe(true)
  })

  it('elastic load: the peak and a valid plateau rise together at the same volume', () => {
    const baseline = labSnapshot(holdAndSettle(opened('mechanics-load-and-pressure')).simulation)
    let session = opened('mechanics-load-and-pressure')
    session = engine(session, {
      type: 'SET_TEACHING_MECHANICS',
      overrides: { complianceScale: 0.5 },
    })
    const after = labSnapshot(holdAndSettle(session).simulation)
    expect(after.values.peak).toBeGreaterThan(baseline.values.peak + 2)
    expect(after.values.plateau).toBeGreaterThan(baseline.values.plateau + 2)
    expect(Math.abs(after.values.volume - baseline.values.volume)).toBeLessThan(30)
  })

  it('incomplete emptying: a higher rate in a resistive system leaves expiratory flow running at the next breath', () => {
    const session = opened('expiration-and-air-trapping')
    const baseline = labSnapshot(run(session, 10).simulation)
    const faster = labSnapshot(
      run(engine(session, { type: 'SET_CONTROL', control: 'ratePerMin', value: 26 }), 20)
        .simulation,
    )
    expect(faster.values.expiratoryFlow).toBeLessThan(baseline.values.expiratoryFlow - 1)
    expect(faster.values.intrinsicPeep).toBeGreaterThanOrEqual(baseline.values.intrinsicPeep)
  })

  it('the oxygenation axis: more oxygen moves the saturation and nothing on the breath', () => {
    const session = opened('controls-and-goals')
    // A control run of the same length separates the change from the patient's own drift.
    const control = labSnapshot(run(session, 40).simulation)
    const after = labSnapshot(
      run(engine(session, { type: 'SET_CONTROL', control: 'oxygenPercent', value: 60 }), 40)
        .simulation,
    )
    expect(after.values.spo2).toBeGreaterThanOrEqual(control.values.spo2)
    expect(Math.abs(after.values.volume - control.values.volume)).toBeLessThan(10)
    expect(Math.abs(after.values.rate - control.values.rate)).toBeLessThan(1)
    expect(Math.abs(after.values.peak - control.values.peak)).toBeLessThan(1)
    expect(Math.abs(after.values.co2 - control.values.co2)).toBeLessThan(1.5)
  })

  it('the ventilation axis: a higher rate moves minute ventilation at once and carbon dioxide over time', () => {
    const session = opened('ventilation-and-co2')
    const control = labSnapshot(run(session, 90).simulation)
    const soon = labSnapshot(
      run(engine(session, { type: 'SET_CONTROL', control: 'ratePerMin', value: 20 }), 10)
        .simulation,
    )
    const later = labSnapshot(
      run(engine(session, { type: 'SET_CONTROL', control: 'ratePerMin', value: 20 }), 90)
        .simulation,
    )
    expect(soon.values.minute).toBeGreaterThan(control.values.minute + 0.5)
    expect(later.values.co2).toBeLessThan(control.values.co2 - 1)
    // Raising the oxygen for a high carbon dioxide moves nothing that matters here.
    const oxygen = labSnapshot(
      run(engine(session, { type: 'SET_CONTROL', control: 'oxygenPercent', value: 80 }), 90)
        .simulation,
    )
    expect(Math.abs(oxygen.values.co2 - control.values.co2)).toBeLessThan(1.5)
    expect(Math.abs(oxygen.values.minute - control.values.minute)).toBeLessThan(0.3)
  })

  it('is one table: every row sits on a stop or an axis, every mechanism section highlights a row, and knobs resolve', () => {
    for (const row of breathGrammarRows) {
      if (row.where.kind === 'stop') expect(breathStopIds).toContain(row.where.stopId)
      if (row.knob && row.knob !== 'shaping') {
        expect(VENTILATION_CONTROL_PANEL.knobs.some((knob) => knob.id === row.knob)).toBe(true)
      }
    }
    for (const unit of ventilationLearningUnits) {
      if (unit.stage === 'orientation' || unit.stage === 'foundation') continue
      expect(breathGrammarRowsFor(unit.id).length).toBeGreaterThan(0)
      // And the section's strip agrees with the row about which knob reaches it.
      const spec = ventilationSectionSpec(unit.id)
      for (const row of breathGrammarRowsFor(unit.id)) {
        if (row.knob && row.knob !== 'shaping' && spec.knobStrip[row.knob].state === 'no-knob') {
          throw new Error(
            `${unit.id}: row ${row.id} says ${row.knob} reaches it; the strip says no knob does`,
          )
        }
      }
    }
    expect(breathGrammarRow('resistive-load').knob).toBeNull()
  })
})
