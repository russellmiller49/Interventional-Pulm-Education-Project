/**
 * MV-PRE-REVIEW-01 — repairs after the independent sanity review.
 *
 * Seven findings, each with its reproduction encoded as the assertion. Every test here fails on
 * the reviewed head `4ee81a50` for the reason the review gave, not because a symbol is missing:
 * the projection, the gas view and the trigger helper all existed there, and each assertion below
 * describes behaviour they got wrong.
 */
import { fireEvent, render, screen } from '@testing-library/react'

import { BedsidePanel } from '../components/BedsidePanel'
import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import { MechanicalVentilationTeachingPanel } from '../components/MechanicalVentilationTeachingPanel'
import { mechanicalVentilationCaseById } from '../content'
import { plateauAcquisition } from '../content/plateauAcquisition'
import {
  capturePostActionBaseline,
  coachingReadingSnapshot,
  postActionObservation,
  ventilationPostActionCoaching,
} from '../content/postActionCoaching'
import {
  advanceSimulation,
  applyIntervention,
  createInitialSimulationState,
  ventilatorDeviceIds,
} from '../engine'
import { arterialGasSampleIsPending, arterialGasView } from '../engine/arterialGas'
import { createLabSimulation } from '../engine/learningLab'
import { ventilationSimulationReducer } from '../engine/reducer'
import { triggerDelayEvidence } from '../engine/triggerEvidence'
import type { VentilationSimulationState } from '../engine/types'

const DEVICE = 'hamilton-c6' as const
const hold = (state: VentilationSimulationState) =>
  ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })

/* ------------------------------------------------------------------------------------------------
 * R1 — an acquired identity and its value travel together
 * ---------------------------------------------------------------------------------------------- */

describe('R1 · acquired plateau identity and value', () => {
  /** An active patient, where the acquired reading and the live estimate genuinely differ. */
  function acquiredOnActivePatient() {
    const base = advanceSimulation(
      { ...createInitialSimulationState('MV-13', 'practice', 1, DEVICE), paused: false },
      20,
    )
    return advanceSimulation(hold(base), 6)
  }

  it('reports the acquisition record’s own value, never the live estimate beside its label', () => {
    const held = acquiredOnActivePatient()
    const record = held.holdRecords.at(-1)!
    const acquisition = plateauAcquisition(held)
    // The precondition: the two numbers are not the same, so a mix-up is visible.
    expect(record.valueCmH2O).not.toBeCloseTo(held.measurements.plateauPressureCmH2O, 1)
    expect(acquisition.acquired).toBe(true)
    expect(acquisition.valueCmH2O).toBe(record.valueCmH2O)
    expect(acquisition.acquiredValueCmH2O).toBe(record.valueCmH2O)
    expect(acquisition.estimateCmH2O).toBe(held.measurements.plateauPressureCmH2O)
  })

  it('prints the acquired number on the console that claims the acquisition', () => {
    const base = createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)
    const held = advanceSimulation(hold(base), 8)
    const acquisition = plateauAcquisition(held)
    expect(acquisition.status).toBe('acquired-valid')
    expect(acquisition.valueCmH2O).not.toBeCloseTo(held.measurements.plateauPressureCmH2O, 1)

    const { container } = render(
      <MechanicalVentilatorConsole
        state={{ ...held, paused: true }}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    const text = container.textContent ?? ''
    const acquired = acquisition.valueCmH2O!.toFixed(0)
    const estimate = held.measurements.plateauPressureCmH2O.toFixed(0)
    expect(text).toContain(`Pplateau ${acquired}`)
    if (acquired !== estimate) expect(text).not.toContain(`Pplateau ${estimate}`)
    expect(text).toMatch(/measured Pplateau/i)
  })

  it('withdraws the mechanics claim from a stale acquisition everywhere it was made', () => {
    const held = advanceSimulation(
      hold(createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)),
      8,
    )
    expect(plateauAcquisition(held).supportsMechanicsClaim).toBe(true)
    const changed = ventilationSimulationReducer(held, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: held.ventilator.settings.peepCmH2O + 4,
    })
    const stale = plateauAcquisition(changed)
    expect(stale.status).toBe('stale')
    expect(stale.supportsMechanicsClaim).toBe(false)
    // The record is kept and still readable — withholding the claim is not deleting the number.
    expect(stale.valueCmH2O).toBe(held.holdRecords.at(-1)!.valueCmH2O)

    // The load panel stops offering a peak-minus-plateau row off that stale hold.
    const { container } = render(
      <MechanicalVentilationTeachingPanel lessonId="dyssynchrony-mechanisms" state={changed} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Load$/i }))
    const text = container.textContent ?? ''
    expect(text).toMatch(/No acquired plateau/i)
    expect(text).not.toContain(
      `${(held.measurements.peakPressureCmH2O - stale.valueCmH2O!).toFixed(1)} cmH₂O`,
    )
  })

  it('does not let a consumer rebuild validity from a non-null value or from passivity alone', () => {
    // An occlusion the patient pulled through: a value exists, the patient may be quiet *now*.
    const active = advanceSimulation(
      { ...createInitialSimulationState('MV-13', 'practice', 1, DEVICE), paused: false },
      20,
    )
    const held = advanceSimulation(hold(active), 6)
    const acquisition = plateauAcquisition(held)
    expect(acquisition.valueCmH2O).not.toBeNull()
    expect(acquisition.status).toBe('acquired-invalid')
    expect(acquisition.supportsMechanicsClaim).toBe(false)
    expect(coachingReadingSnapshot(held)['peak-plateau-gap']).toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * R2 — the occlusion's own evidence, not the display buffer
 * ---------------------------------------------------------------------------------------------- */

describe('R2 · hold acquisition uses occlusion evidence', () => {
  function integrationBase() {
    return advanceSimulation(
      { ...createLabSimulation('high-peak-pressure-integration', 0, DEVICE), paused: false },
      6,
    )
  }

  it('records the same value whether or not the display waveform is frozen', () => {
    const base = integrationBase()
    const unfrozen = advanceSimulation(hold(base), 6)
    const frozen = advanceSimulation(
      hold({ ...base, ventilator: { ...base.ventilator, frozen: true } }),
      6,
    )
    const a = plateauAcquisition(unfrozen)
    const b = plateauAcquisition(frozen)
    expect(a.status).toBe('acquired-valid')
    expect(b.status).toBe('acquired-valid')
    // Freezing the screen recorded 5.2 against the unfrozen maneuver's 13.6 before this repair.
    expect(b.valueCmH2O).toBeCloseTo(a.valueCmH2O!, 1)
    expect(frozen.holdRecords.at(-1)!.sampleCount).toBeGreaterThan(0)
  })

  it('invalidates a maneuver whose conditions changed during the occlusion, even if reverted', () => {
    const base = createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)
    const peep = base.ventilator.settings.peepCmH2O
    let state = hold(base)
    state = advanceSimulation(state, 1)
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: peep + 4,
    })
    state = advanceSimulation(state, 1)
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: peep,
    })
    state = advanceSimulation(state, 6)

    const record = state.holdRecords.at(-1)!
    expect(record.completedAtSeconds).not.toBeNull()
    expect(record.conditionsChangedDuringHold).toBe(true)
    expect(record.invalidReason).toBe('conditions-changed')
    const acquisition = plateauAcquisition(state)
    // The end-to-end fingerprints match again, and that is exactly what must not rescue it.
    expect(record.conditions).toBe(state.holdRecords.at(-1)!.conditions)
    expect(acquisition.supportsMechanicsClaim).toBe(false)
    expect(acquisition.status).toBe('acquired-invalid')
    expect(acquisition.detail).toMatch(/changed while the valves were shut/i)
  })

  it('leaves an undisturbed hold valid, so the guard is not simply refusing everything', () => {
    const state = advanceSimulation(
      hold(createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)),
      8,
    )
    expect(state.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(false)
    expect(plateauAcquisition(state).status).toBe('acquired-valid')
  })
})

/* ------------------------------------------------------------------------------------------------
 * R3 / R4 — specimen identity in every consumer, and per-specimen availability
 * ---------------------------------------------------------------------------------------------- */

describe('R3 · every ABG consumer reads a specimen', () => {
  function twoOrders() {
    const definition = mechanicalVentilationCaseById.get('MV-07')!
    let state = advanceSimulation(
      { ...createInitialSimulationState('MV-07', 'practice', 1, DEVICE), paused: false },
      30,
    )
    state = applyIntervention(state, definition, 'order-abg')
    state = advanceSimulation(state, 2.5)
    state = applyIntervention(state, definition, 'order-abg')
    return state
  }

  it('reports the resulted specimen in coaching, not the live gas state', () => {
    const resulted = advanceSimulation(twoOrders(), 60)
    const view = arterialGasView(resulted.arterialGasSamples, resulted.simulationTime)
    const specimen = view.current
    expect(specimen.kind).toBe('repeat')
    // The precondition: the model has moved on since the specimen was drawn.
    expect(resulted.patient.gasExchange.paCO2MmHg).not.toBeCloseTo(specimen.values.paCO2MmHg, 1)
    expect(coachingReadingSnapshot(resulted).paco2).toBe(specimen.values.paCO2MmHg)
  })

  it('keeps an already available result while a later order is still processing', () => {
    const resulted = advanceSimulation(twoOrders(), 60)
    const view = arterialGasView(resulted.arterialGasSamples, resulted.simulationTime)
    expect(view.pendingAll.length).toBeGreaterThan(0)
    expect(view.current.kind).toBe('repeat')
    // A second order used to overwrite `lastAbgAt` and blank the reading the learner already had.
    expect(coachingReadingSnapshot(resulted).paco2).not.toBeNull()
  })

  it('does not put the specimen an action drew into that action’s own before column', () => {
    const definition = mechanicalVentilationCaseById.get('MV-07')!
    const before = advanceSimulation(
      { ...createInitialSimulationState('MV-07', 'practice', 1, DEVICE), paused: false },
      30,
    )
    const ordered = applyIntervention(before, definition, 'order-abg')
    const baseline = capturePostActionBaseline(ordered, definition, ordered.interventions.at(-1)!)
    expect(baseline.readings.paco2).toBeNull()
  })
})

describe('R4 · overlapping orders disclose nothing early', () => {
  function twoPending() {
    const definition = mechanicalVentilationCaseById.get('MV-07')!
    let state = advanceSimulation(
      { ...createInitialSimulationState('MV-07', 'practice', 1, DEVICE), paused: false },
      30,
    )
    state = applyIntervention(state, definition, 'order-abg')
    state = advanceSimulation(state, 2.5)
    state = applyIntervention(state, definition, 'order-abg')
    return state
  }

  it('marks every outstanding specimen pending, not only the first', () => {
    const state = twoPending()
    const view = arterialGasView(state.arterialGasSamples, state.simulationTime)
    const repeats = state.arterialGasSamples.filter((sample) => sample.kind === 'repeat')
    expect(repeats).toHaveLength(2)
    expect(view.pendingAll.map((sample) => sample.id)).toEqual(repeats.map((sample) => sample.id))
    for (const sample of repeats)
      expect(arterialGasSampleIsPending(sample, state.simulationTime)).toBe(true)
  })

  it('withholds the values and the result time of every pending specimen on screen', () => {
    const state = twoPending()
    const { container } = render(
      <BedsidePanel state={state} definition={mechanicalVentilationCaseById.get('MV-07')!} />,
    )
    const history = container.querySelector('[data-abg-history]')!
    const text = history.textContent ?? ''
    const repeats = state.arterialGasSamples.filter((sample) => sample.kind === 'repeat')
    for (const sample of repeats) {
      const row = container.querySelector(`[data-abg-history-sample="${sample.id}"]`)!
      expect(row.textContent).toMatch(/not resulted yet/i)
      expect(row.textContent).not.toContain(sample.values.paCO2MmHg.toFixed(0))
      // The future result time is a disclosure too.
      expect(row.textContent).not.toMatch(/resulted at/i)
      expect(row.textContent).toMatch(/result due at/i)
    }
    expect(text).toMatch(/Baseline gas supplied with the case/i)
  })

  it('releases each specimen at its own availability time and no earlier', () => {
    const state = twoPending()
    const [first, second] = state.arterialGasSamples.filter((sample) => sample.kind === 'repeat')
    const afterFirst = advanceSimulation(
      state,
      first.availableAtSeconds - state.simulationTime + 0.5,
    )
    const viewA = arterialGasView(afterFirst.arterialGasSamples, afterFirst.simulationTime)
    expect(viewA.current.id).toBe(first.id)
    expect(viewA.pendingAll.map((sample) => sample.id)).toEqual([second.id])

    const afterSecond = advanceSimulation(
      afterFirst,
      second.availableAtSeconds - afterFirst.simulationTime + 0.5,
    )
    const viewB = arterialGasView(afterSecond.arterialGasSamples, afterSecond.simulationTime)
    expect(viewB.current.id).toBe(second.id)
    expect(viewB.pendingAll).toHaveLength(0)
    // Neither specimen was rewritten while it waited.
    expect(JSON.stringify(afterSecond.arterialGasSamples)).toBe(
      JSON.stringify(state.arterialGasSamples),
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * R5 — coaching needs evidence coverage, not a clock
 * ---------------------------------------------------------------------------------------------- */

describe('R5 · post-action coaching proves its evidence', () => {
  function actedOn(caseId: string, effectId: string, frozen: boolean) {
    const definition = mechanicalVentilationCaseById.get(caseId)!
    const settled = advanceSimulation(
      {
        ...createInitialSimulationState(caseId, 'practice', 1, DEVICE),
        paused: false,
        prediction: { committed: true, mechanismId: 'a', priorityId: 'b', responseId: 'c' },
      },
      60,
    )
    const base = frozen
      ? { ...settled, ventilator: { ...settled.ventilator, frozen: true } }
      : settled
    const acted = applyIntervention(base, definition, effectId)
    return {
      definition,
      acted,
      baseline: capturePostActionBaseline(acted, definition, acted.interventions.at(-1)!),
    }
  }

  it('stays pending while the display is frozen, however long the clock runs', () => {
    const { definition, acted, baseline } = actedOn('MV-14', 'decompress-pneumothorax', true)
    const later = advanceSimulation(acted, 30)
    const observation = postActionObservation(later, baseline)
    // The clock condition is met; the evidence condition is not.
    expect(observation.intervalElapsed).toBe(true)
    expect(observation.evidenceCovered).toBe(false)
    expect(observation.evidenceGap).not.toBeNull()
    expect(observation.complete).toBe(false)
    expect(ventilationPostActionCoaching(later, definition, baseline)).toBeNull()
  })

  it('completes once the trace is unfrozen and real post-action samples arrive', () => {
    const { definition, acted, baseline } = actedOn('MV-14', 'decompress-pneumothorax', true)
    const stuck = advanceSimulation(acted, 30)
    expect(ventilationPostActionCoaching(stuck, definition, baseline)).toBeNull()

    const thawed = advanceSimulation(
      { ...stuck, ventilator: { ...stuck.ventilator, frozen: false } },
      20,
    )
    const observation = postActionObservation(thawed, baseline)
    expect(observation.evidenceCovered).toBe(true)
    const coaching = ventilationPostActionCoaching(thawed, definition, baseline)!
    expect(coaching).not.toBeNull()
    const peak = coaching.observed.find((reading) => reading.id === 'peak-pressure')!
    expect(peak.after).toBe(thawed.measurements.peakPressureCmH2O)
    expect(peak.after).toBeLessThan(peak.before!)
  })

  it('still completes normally on an ordinary unfrozen decompression', () => {
    const { definition, acted, baseline } = actedOn('MV-14', 'decompress-pneumothorax', false)
    const settled = advanceSimulation(
      acted,
      baseline.effectiveAtSeconds - acted.simulationTime + baseline.settleSeconds + 1,
    )
    const coaching = ventilationPostActionCoaching(settled, definition, baseline)!
    expect(coaching).not.toBeNull()
    const peak = coaching.observed.find((reading) => reading.id === 'peak-pressure')!
    expect(peak.before).toBeGreaterThan(peak.after)
    expect(peak.after).toBe(settled.measurements.peakPressureCmH2O)
  })

  it('still completes normally on a second, different intervention', () => {
    const { definition, acted, baseline } = actedOn('MV-13', 'suction-airway', false)
    const settled = advanceSimulation(
      acted,
      baseline.effectiveAtSeconds - acted.simulationTime + baseline.settleSeconds + 1,
    )
    const coaching = ventilationPostActionCoaching(settled, definition, baseline)
    expect(coaching).not.toBeNull()
    const peak = coaching!.observed.find((reading) => reading.id === 'peak-pressure')!
    expect(peak.after).toBe(settled.measurements.peakPressureCmH2O)
  })
})

/* ------------------------------------------------------------------------------------------------
 * R6 — a delay needs an event associated with this inspiration
 * ---------------------------------------------------------------------------------------------- */

describe('R6 · trigger delay needs an associated event', () => {
  function latestOnset(state: VentilationSimulationState) {
    const waveforms = state.waveforms
    for (let index = waveforms.length - 1; index > 0; index -= 1) {
      if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration')
        return index
    }
    return -1
  }

  it('does not borrow an effort from the previous cycle', () => {
    const state = advanceSimulation(
      { ...createInitialSimulationState('MV-01', 'learn', 1, DEVICE), paused: false },
      20,
    )
    const onset = latestOnset(state)
    expect(onset).toBeGreaterThan(0)
    // An old effort is on the trace, and it is not at this breath's door.
    expect(state.waveforms.slice(0, onset).some((s) => -s.pmusCmH2O >= 1.5)).toBe(true)
    expect(-state.waveforms[onset - 1].pmusCmH2O).toBeLessThan(1.5)

    const evidence = triggerDelayEvidence(state)
    expect(evidence.precedingEffortCmH2O).toBe(0)
    expect(evidence.status).not.toBe('measured')
    expect(evidence.display).not.toBe('80 ms')
  })

  it('says not applicable where the breath carries no effort at all', () => {
    const passive = advanceSimulation(
      { ...createLabSimulation('expiration-and-air-trapping', 0, DEVICE), paused: false },
      8,
    )
    const evidence = triggerDelayEvidence(passive)
    expect(evidence.status).toBe('not-applicable')
    expect(evidence.delayMs).toBeNull()
    expect(evidence.display).toBe('—')
    // The analytic default is still in the engine; it is simply not reported as an interval.
    expect(passive.measurements.triggerDelayMs).toBeGreaterThan(0)
  })

  it('never renders a measured trigger delay without a preceding effort, on any live case', () => {
    for (const caseId of mechanicalVentilationCaseById.keys()) {
      const state = advanceSimulation(
        { ...createInitialSimulationState(caseId, 'practice', 1, DEVICE), paused: false },
        18,
      )
      const evidence = triggerDelayEvidence(state)
      if (evidence.status === 'measured')
        expect(evidence.precedingEffortCmH2O).toBeGreaterThanOrEqual(1.5)
      if (evidence.delayMs === null) expect(evidence.display).toBe('—')
    }
  })

  it('keeps the number out of the Timing view’s measured wording', () => {
    const passive = advanceSimulation(
      { ...createLabSimulation('expiration-and-air-trapping', 0, DEVICE), paused: false },
      8,
    )
    const { container } = render(
      <MechanicalVentilationTeachingPanel lessonId="triggering-and-cycling" state={passive} />,
    )
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/Measured trigger delay is \d/)
    expect(text).toMatch(/not applicable/i)
  })
})

/* ------------------------------------------------------------------------------------------------
 * R7 — the four facsimiles are actually four
 * ---------------------------------------------------------------------------------------------- */

describe('R7 · the device list', () => {
  it('names four real facsimiles and renders each of them', () => {
    expect([...ventilatorDeviceIds]).toEqual([
      'hamilton-c6',
      'drager-evita-v800-v600',
      'puritan-bennett-980',
      'carefusion-avea',
    ])
    const state = createInitialSimulationState('MV-01', 'practice', 1, DEVICE)
    const seen = new Set<string>()
    for (const device of ventilatorDeviceIds) {
      const { container, unmount } = render(
        <MechanicalVentilatorConsole
          state={{ ...state, deviceId: device }}
          dispatch={jest.fn()}
          controlsEnabled
        />,
      )
      seen.add(container.querySelector('[data-device]')?.getAttribute('data-device') ?? '')
      unmount()
    }
    expect(seen).toEqual(new Set(ventilatorDeviceIds))
  })
})
