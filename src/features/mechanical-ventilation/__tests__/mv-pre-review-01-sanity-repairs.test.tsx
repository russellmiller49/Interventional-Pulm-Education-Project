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
import { plateauReadingValidity } from '../content/plateauValidity'
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
import { measurementConditionsFingerprint } from '../engine/measurementConditions'
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
 * R1 (second pass) — the pressure-decomposition teaching path
 * ---------------------------------------------------------------------------------------------- */

describe('R1 · pressure decomposition honours the acquisition contract', () => {
  /** A passive patient, so effort never confounds what is being tested here. */
  const passiveBase = () => createLabSimulation('lung-protection', 0, DEVICE)
  const decomposition = (state: VentilationSimulationState) =>
    render(
      <MechanicalVentilationTeachingPanel lessonId="mechanics-load-and-pressure" state={state} />,
    )
  const figureLabel = (container: HTMLElement) =>
    container.querySelector('svg[role="img"]')?.getAttribute('aria-label') ?? ''

  it('withholds the split on a quiet patient who has never been occluded', () => {
    const state = passiveBase()
    expect(plateauReadingValidity(state).interpretable).toBe(true)
    expect(plateauAcquisition(state).supportsMechanicsClaim).toBe(false)

    const { container } = decomposition(state)
    const panel = container.querySelector('[data-split-separable]')!
    expect(panel.getAttribute('data-split-separable')).toBe('false')
    const label = figureLabel(container)
    expect(label).toMatch(/not separated into elastic and resistive components/i)
    expect(label).not.toMatch(/an elastic component of/i)
    // And it says the true reason rather than blaming an effort that is not there.
    expect(label).not.toMatch(/breathing against this measurement/i)
    expect(label).toMatch(/hold/i)
  })

  it('allows the split once a valid hold has been acquired, using the acquired value', () => {
    const held = advanceSimulation(hold(passiveBase()), 8)
    const acquisition = plateauAcquisition(held)
    expect(acquisition.status).toBe('acquired-valid')
    // The precondition that makes a substitution visible.
    expect(acquisition.valueCmH2O).not.toBeCloseTo(held.measurements.plateauPressureCmH2O, 1)

    const { container } = decomposition(held)
    expect(
      container.querySelector('[data-split-separable]')!.getAttribute('data-split-separable'),
    ).toBe('true')
    const label = figureLabel(container)
    expect(label).toMatch(/an elastic component of/i)
    expect(label).toMatch(/a resistive component of/i)
    // The resistive band is peak minus the *acquired* plateau, not peak minus the live estimate.
    const acquiredGap = held.measurements.peakPressureCmH2O - acquisition.valueCmH2O!
    const estimateGap = held.measurements.peakPressureCmH2O - held.measurements.plateauPressureCmH2O
    const readouts = container.querySelector('[aria-label="Live derived mechanics"]')!
    const gap = [...readouts.querySelectorAll('div')].find(
      (node) => node.querySelector('dt')?.textContent === 'Peak − plateau',
    )!
    expect(gap.textContent).toContain(acquiredGap.toFixed(1))
    expect(gap.textContent).not.toContain(estimateGap.toFixed(1))
  })

  it('withdraws the split when a PEEP change makes the acquisition stale', () => {
    const held = advanceSimulation(hold(passiveBase()), 8)
    const stale = advanceSimulation(
      ventilationSimulationReducer(held, {
        type: 'SET_CONTROL',
        control: 'peepCmH2O',
        value: held.ventilator.settings.peepCmH2O + 4,
      }),
      4,
    )
    const acquisition = plateauAcquisition(stale)
    expect(acquisition.status).toBe('stale')
    expect(acquisition.supportsMechanicsClaim).toBe(false)
    // The patient is still quiet: passivity alone must not carry the claim.
    expect(plateauReadingValidity(stale).interpretable).toBe(true)
    // And the live estimate has moved on.
    expect(stale.measurements.plateauPressureCmH2O).not.toBeCloseTo(
      held.measurements.plateauPressureCmH2O,
      1,
    )

    const { container } = decomposition(stale)
    expect(
      container.querySelector('[data-split-separable]')!.getAttribute('data-split-separable'),
    ).toBe('false')
    const label = figureLabel(container)
    expect(label).toMatch(/not separated into elastic and resistive components/i)
    expect(label).not.toMatch(/an elastic component of/i)
    expect(label).not.toMatch(/a resistive component of/i)

    const readouts = container.querySelector('[aria-label="Live derived mechanics"]')!
    const gap = [...readouts.querySelectorAll('div')].find(
      (node) => node.querySelector('dt')?.textContent === 'Peak − plateau',
    )!
    expect(gap.getAttribute('data-state')).toBe('unavailable')
    // Neither the stale acquired value nor the drifting estimate is substituted for it.
    const staleGap = stale.measurements.peakPressureCmH2O - acquisition.acquiredValueCmH2O!
    const estimateGap =
      stale.measurements.peakPressureCmH2O - stale.measurements.plateauPressureCmH2O
    expect(gap.textContent).not.toContain(staleGap.toFixed(1))
    expect(gap.textContent).not.toContain(estimateGap.toFixed(1))
    // Static compliance is a plateau claim too and travels with the same gate.
    const compliance = [...readouts.querySelectorAll('div')].find(
      (node) => node.querySelector('dt')?.textContent === 'Static compliance',
    )!
    expect(compliance.getAttribute('data-state')).toBe('unavailable')
  })

  it('still blames effort, not acquisition, when the patient is the one pulling', () => {
    const active = advanceSimulation(
      { ...createInitialSimulationState('MV-13', 'practice', 1, DEVICE), paused: false },
      20,
    )
    expect(plateauReadingValidity(active).interpretable).toBe(false)
    const { container } = decomposition(active)
    expect(figureLabel(container)).toMatch(/breathing against this measurement/i)
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

  /**
   * Second pass: the latch ran only inside `advanceSimulation`, so a change made while the
   * simulation was paused was never compared against anything. PEEP 5 → 9 → 5 with no timestep at
   * all finished `acquired-valid` with `conditionsChangedDuringHold: false`.
   */
  it('latches a condition change made with no time advance at all', () => {
    const base = createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)
    const peep = base.ventilator.settings.peepCmH2O
    const opened = hold(base)
    expect(opened.holdRecords.at(-1)!.completedAtSeconds).toBeNull()
    expect(opened.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(false)

    // Two mutations, zero elapsed simulated time between or after them.
    const raised = ventilationSimulationReducer(opened, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: peep + 4,
    })
    expect(raised.simulationTime).toBe(opened.simulationTime)
    expect(raised.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(true)

    const reverted = ventilationSimulationReducer(raised, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: peep,
    })
    expect(reverted.simulationTime).toBe(opened.simulationTime)
    // Reverting restores the fingerprint and must not clear the latch.
    expect(reverted.ventilator.settings.peepCmH2O).toBe(peep)
    expect(reverted.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(true)

    const finished = advanceSimulation(reverted, 8)
    const record = finished.holdRecords.at(-1)!
    expect(record.completedAtSeconds).not.toBeNull()
    expect(record.conditionsChangedDuringHold).toBe(true)
    expect(record.invalidReason).toBe('conditions-changed')
    const acquisition = plateauAcquisition(finished)
    expect(acquisition.status).not.toBe('acquired-valid')
    expect(acquisition.supportsMechanicsClaim).toBe(false)
  })

  it('latches through applyIntervention as well as through the reducer', () => {
    /*
     * `applyIntervention` is reachable directly, not only through the reducer, so it asks the same
     * latch. An assessment is effective at the instant it is recorded, so it enters the measurement
     * fingerprint immediately and the open hold sees it.
     */
    const definition = mechanicalVentilationCaseById.get('MV-13')!
    const base = advanceSimulation(
      { ...createInitialSimulationState('MV-13', 'practice', 1, DEVICE), paused: false },
      20,
    )
    const opened = hold(base)
    expect(opened.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(false)
    const acted = applyIntervention(opened, definition, 'assess-patient')
    expect(acted.simulationTime).toBe(opened.simulationTime)
    expect(acted.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(true)
  })

  it('does not latch an action that has not yet reached the model', () => {
    /*
     * The latch follows the measurement fingerprint exactly, and that fingerprint counts only
     * interventions whose `effectiveAt` has arrived. An action still in its latency has not changed
     * the conditions the occlusion is being taken under, so it does not invalidate the maneuver —
     * and `advanceSimulation` will catch it if it lands while the valves are still shut.
     */
    const definition = mechanicalVentilationCaseById.get('MV-13')!
    const base = advanceSimulation(
      { ...createInitialSimulationState('MV-13', 'practice', 1, DEVICE), paused: false },
      20,
    )
    const opened = hold(base)
    const queued = applyIntervention(opened, definition, 'suction-airway')
    const record = queued.interventions.at(-1)!
    expect(record.effectiveAt).toBeGreaterThan(queued.simulationTime)
    expect(queued.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(false)
  })

  it('does not invalidate a hold for playback, screen or waveform-freeze changes', () => {
    const opened = hold(createLabSimulation('mechanics-load-and-pressure', 0, DEVICE))
    const fingerprint = opened.holdRecords.at(-1)!.conditions
    let state = opened
    for (const action of [
      { type: 'SET_PAUSED', paused: true },
      { type: 'SET_SPEED', speed: 30 },
      { type: 'TOGGLE_FREEZE' },
      { type: 'SET_SCREEN', screen: 'graphics' },
    ] as const) {
      state = ventilationSimulationReducer(state, action as never)
      expect(state.holdRecords.at(-1)!.conditionsChangedDuringHold).toBe(false)
    }
    // The fingerprint itself is unchanged — these are outside the measurement contract by design.
    expect(measurementConditionsFingerprint(state)).toBe(fingerprint)
    const finished = advanceSimulation({ ...state, paused: false }, 8)
    expect(plateauAcquisition(finished).status).toBe('acquired-valid')
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

  /**
   * Second pass: the look-back window was the model's own `triggerDelayMs`, and on MV-05 at 8 s
   * that reached back far enough to catch the *tail* of the previous breath's effort as it decayed
   * to zero at 7.28 s — 240 ms before the inspiration at 7.52 s — and reported "measured 415 ms".
   */
  it('does not promote a decaying effort tail to a measured interval on MV-05', () => {
    const state = advanceSimulation(
      { ...createInitialSimulationState('MV-05', 'learn', 1, DEVICE), paused: false },
      8,
    )
    const onset = latestOnset(state)
    expect(onset).toBeGreaterThan(0)
    const waveforms = state.waveforms
    // The precondition: an effort ended shortly before this breath and nothing is left at the door.
    expect(waveforms.slice(0, onset).some((sample) => -sample.pmusCmH2O >= 1.5)).toBe(true)
    expect(-waveforms[onset - 1].pmusCmH2O).toBeLessThan(1.5)
    expect(state.measurements.triggerDelayMs).toBeGreaterThan(0)

    const evidence = triggerDelayEvidence(state)
    expect(evidence.status).not.toBe('measured')
    expect(evidence.display).not.toBe(`${state.measurements.triggerDelayMs.toFixed(0)} ms`)
    expect(evidence.precedingEffortCmH2O).toBe(0)
  })

  it('refuses an effort that is already falling away as the breath arrives', () => {
    /*
     * A synthetic trace: effort above the floor at the sample before the onset, but on its way
     * down. That is a tail crossing the boundary, not an effort the machine answered.
     */
    const base = advanceSimulation(
      { ...createInitialSimulationState('MV-01', 'learn', 1, DEVICE), paused: false },
      20,
    )
    const onset = latestOnset(base)
    const falling = base.waveforms.map((sample, index) =>
      index === onset - 1
        ? { ...sample, pmusCmH2O: -6 }
        : index === onset
          ? { ...sample, pmusCmH2O: -2 }
          : sample,
    )
    const evidence = triggerDelayEvidence({ ...base, waveforms: falling })
    expect(evidence.precedingEffortCmH2O).toBeCloseTo(6, 1)
    expect(evidence.status).not.toBe('measured')
  })

  it('still reports measured where an effort is genuinely building into the onset', () => {
    /*
     * The branch stays reachable and honest. No live case currently produces this shape — the
     * model's effort rises at the same sample the breath begins — so it is demonstrated on a
     * fixture rather than manufactured in the engine. See the D5 note in the handoff.
     */
    const base = advanceSimulation(
      { ...createInitialSimulationState('MV-01', 'learn', 1, DEVICE), paused: false },
      20,
    )
    const onset = latestOnset(base)
    const building = base.waveforms.map((sample, index) =>
      index === onset - 1
        ? { ...sample, pmusCmH2O: -4 }
        : index === onset
          ? { ...sample, pmusCmH2O: -7 }
          : sample,
    )
    const evidence = triggerDelayEvidence({ ...base, waveforms: building })
    expect(evidence.status).toBe('measured')
    expect(evidence.delayMs).toBe(base.measurements.triggerDelayMs)
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
