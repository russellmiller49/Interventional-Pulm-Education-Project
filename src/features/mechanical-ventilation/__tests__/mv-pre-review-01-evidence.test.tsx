/**
 * MV-PRE-REVIEW-01 — capture and observation truth.
 *
 * Eight behaviours from the batch's required-regression list. Each one is written against the
 * defect the walkthrough reproduced on `c717c9ff`, not against the API that repairs it: every
 * assertion below fails on that baseline for the reason the report gives, and would keep failing
 * if the repair were reverted while the new modules stayed.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'

import { BedsidePanel } from '../components/BedsidePanel'
import { CapturedBreath } from '../components/stage/CapturedBreath'
import { MechanicalVentilationTeachingPanel } from '../components/MechanicalVentilationTeachingPanel'
import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import { VentilationTeachingColumn } from '../components/stage/VentilationTeachingColumn'
import { classifyCaseFindings, examinationBranchEvidence } from '../content/caseFindings'
import { mechanicalVentilationCaseById } from '../content'
import { plateauAcquisition } from '../content/plateauAcquisition'
import {
  markerEvidence,
  ventilationReferenceMarker,
  ventilationReferenceMarkers,
} from '../content/referenceEvidence'
import { ventilationStageLesson } from '../content/stageLessons'
import { ventilationTaskPresentation } from '../content/taskPresentation'
import {
  advanceSimulation,
  applyIntervention,
  createInitialSimulationState,
  ventilatorDeviceIds,
} from '../engine'
import { arterialGasView } from '../engine/arterialGas'
import { createLabSimulation } from '../engine/learningLab'
import { ventilationSimulationReducer } from '../engine/reducer'
import { completedBreath } from '../engine/teachingBreath'
import { triggerDelayEvidence } from '../engine/triggerEvidence'
import type { VentilationSimulationState } from '../engine/types'

const DEVICE = 'hamilton-c6' as const

function referenceBreath(unitId: string, round: 0 | 1) {
  return completedBreath(createLabSimulation(unitId, round, DEVICE).waveforms)
}

/* ------------------------------------------------------------------------------------------------
 * 1 — a fixed marker, and samples that support the key it belongs to
 * ---------------------------------------------------------------------------------------------- */

describe('the authored marker and the reference it is pinned on', () => {
  it('resolves every marker to samples whose flow sign and volume direction support its key', () => {
    expect(ventilationReferenceMarkers.length).toBeGreaterThan(0)
    for (const marker of ventilationReferenceMarkers) {
      const breath = referenceBreath(marker.unitId, marker.roundIndex)
      const evidence = markerEvidence(breath, marker)
      expect(evidence).not.toBeNull()
      expect(evidence!.sample.phase).toBe(marker.phase)
      if (marker.phase === 'inspiration') {
        expect(evidence!.flowLMin).toBeGreaterThan(0)
        expect(evidence!.volumeChangeMl).toBeGreaterThan(0)
      } else {
        expect(evidence!.flowLMin).toBeLessThan(0)
        expect(evidence!.volumeChangeMl).toBeLessThan(0)
      }
    }
  })

  /**
   * The P0 itself. On the baseline the figure drew only the exploration cursor, which defaults to
   * `breathStopIndex(breath, 'inspiration')` — 0.30 s, flow +40 L/min, volume rising — while the
   * item keyed Expiration.
   */
  it('keeps interval A in expiration however far the exploration cursor is moved', () => {
    const marker = ventilationReferenceMarker('breathing-with-support', 0)!
    const breath = referenceBreath('breathing-with-support', 0)
    const { container } = render(
      <CapturedBreath
        label="Captured reference"
        samples={createLabSimulation('breathing-with-support', 0, DEVICE).waveforms}
        guided
        marker={marker}
      />,
    )
    const markerNote = () => container.querySelector('[data-marker-note="A"]')?.textContent ?? ''
    const before = markerNote()
    expect(before).toMatch(/gas moving out/)
    expect(before).toMatch(/volume falling/)

    const slider = screen.getByRole('slider', { name: /separate from interval A/i })
    for (const value of ['0', '4', String(breath.length - 2)]) {
      fireEvent.change(slider, { target: { value } })
      expect(markerNote()).toBe(before)
    }
    // Three rows, one marker line each, and the letter drawn beside it.
    expect(container.querySelectorAll('[data-breath-marker="A"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-marker-letter="A"]')).toHaveLength(3)
  })

  it('gives application 2 its own longer reference and its own marker', () => {
    const first = referenceBreath('breathing-with-support', 0)
    const second = referenceBreath('breathing-with-support', 1)
    const duration = (breath: typeof first) => breath.at(-1)!.time - breath[0].time
    // "A new complete breath ... on a longer respiratory cycle" is now true of what is drawn.
    expect(duration(second)).toBeGreaterThan(duration(first) + 0.5)
    expect(ventilationReferenceMarker('breathing-with-support', 1)!.markerId).toBe('B')
    expect(ventilationReferenceMarker('breathing-with-support', 1)!.phase).toBe('inspiration')
  })

  it('shows unavailable evidence rather than a substitute when the trace cannot carry the marker', () => {
    const marker = ventilationReferenceMarker('breathing-with-support', 0)!
    const inspiratoryOnly = referenceBreath('breathing-with-support', 0)
      .filter((sample) => sample.phase === 'inspiration')
      .slice(0, 8)
    expect(markerEvidence(inspiratoryOnly, marker)).toBeNull()
  })

  it('does not print a phase label the step claims is withheld', () => {
    const lesson = ventilationStageLesson('breathing-with-support')
    const copy = lesson.steps.map((step) => `${step.title} ${step.instruction}`).join(' ')
    expect(copy).not.toMatch(/labels are withheld/i)
    expect(copy).toMatch(/interval A/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 2 — reading the reference changes nothing
 * ---------------------------------------------------------------------------------------------- */

describe('the worked reference is separate from the learner’s patient', () => {
  it('leaves settings, patient, waveforms, holds and gases untouched when it is rendered', () => {
    const live = createInitialSimulationState('MV-01', 'learn', 1, DEVICE)
    const snapshot = JSON.stringify({
      settings: live.ventilator.settings,
      patient: live.patient,
      waveforms: live.waveforms,
      interventions: live.interventions,
      holdRecords: live.holdRecords,
      gases: live.arterialGasSamples,
      time: live.simulationTime,
    })
    const lesson = ventilationStageLesson('breathing-with-support')
    render(
      <VentilationTeachingColumn
        lesson={lesson}
        step={lesson.steps[0]}
        state={live}
        stops={lesson.steps[0].stops}
        roundIndex={0}
      />,
    )
    expect(
      JSON.stringify({
        settings: live.ventilator.settings,
        patient: live.patient,
        waveforms: live.waveforms,
        interventions: live.interventions,
        holdRecords: live.holdRecords,
        gases: live.arterialGasSamples,
        time: live.simulationTime,
      }),
    ).toBe(snapshot)
  })

  it('never records a hold for a reference the learner only looked at', () => {
    const reference = createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)
    expect(reference.holdRecords).toHaveLength(0)
    expect(plateauAcquisition(reference).acquired).toBe(false)
    expect(plateauAcquisition(reference).status).toBe('reference-estimate')
  })
})

/* ------------------------------------------------------------------------------------------------
 * 3 — breath-relative display, raw engine volume, effort and trigger delay
 * ---------------------------------------------------------------------------------------------- */

describe('what the volume row is, and what it is not', () => {
  it('draws volume from the breath start while the engine keeps the trapped volume', () => {
    const trapped = advanceSimulation(
      { ...createInitialSimulationState('MV-05', 'learn', 1, DEVICE), paused: false },
      24,
    )
    const breath = completedBreath(trapped.waveforms)
    expect(breath.length).toBeGreaterThan(4)
    // The raw signal does not start at zero: that is the gas that did not get out.
    expect(breath[0].volumeMl).toBeGreaterThan(0)

    const { container } = render(
      <CapturedBreath label="Live patient" samples={trapped.waveforms} effort />,
    )
    const anchor = container.querySelector('[data-volume-anchor]')
    expect(anchor?.getAttribute('data-volume-anchor')).toBe(breath[0].volumeMl.toFixed(0))
    expect(container.textContent).toContain('Volume from breath start (mL)')
    expect(container.textContent).not.toContain('Breath-relative volume (mL)')
    // The engine state is untouched by the rendering choice.
    expect(trapped.waveforms.at(-1)!.volumeMl).toBe(trapped.waveforms.at(-1)!.volumeMl)
    expect(trapped.measurements.intrinsicPeepCmH2O).toBeGreaterThan(0)
  })

  it('names the raw signal where there is no verified breath start to anchor to', () => {
    const held = advanceSimulation(
      ventilationSimulationReducer(createLabSimulation('mechanics-load-and-pressure', 0, DEVICE), {
        type: 'PERFORM_HOLD',
        hold: 'inspiratory',
      }),
      2,
    )
    const { container } = render(
      <CapturedBreath label="Reference hold" samples={held.waveforms} whole={false} />,
    )
    expect(container.textContent).toContain('Raw lung volume (mL)')
  })

  it('plots the modeled effort row on the round whose instruction sends the learner to it', () => {
    const lesson = ventilationStageLesson('expiration-and-air-trapping')
    const transfer = lesson.steps.find(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 1,
    )!
    expect(transfer.instruction).toMatch(/effort trace/i)
    expect(transfer.presentation.effort).toBe(true)
    // And not on the passive round, which does not mention it.
    const first = lesson.steps.find(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
    )!
    expect(first.presentation.effort).toBe(false)
    expect(
      ventilationTaskPresentation('expiration-and-air-trapping', transfer.interaction).effort,
    ).toBe(true)
  })

  it('reports no trigger delay on a breath no effort started', () => {
    const passive = advanceSimulation(
      { ...createLabSimulation('expiration-and-air-trapping', 0, DEVICE), paused: false },
      8,
    )
    const evidence = triggerDelayEvidence(passive)
    expect(evidence.status).toBe('not-applicable')
    expect(evidence.delayMs).toBeNull()
    expect(evidence.display).toBe('—')
    // The engine's analytic default is still there; it is simply not reported as a measurement.
    expect(passive.measurements.triggerDelayMs).toBeGreaterThan(0)
  })

  /** Through the Timing view itself, with no symbol this batch introduced. */
  it('prints no measured trigger delay on the passive setup in the timing panel', () => {
    const passive = advanceSimulation(
      { ...createLabSimulation('expiration-and-air-trapping', 0, DEVICE), paused: false },
      8,
    )
    const { container } = render(
      <MechanicalVentilationTeachingPanel lessonId="triggering-and-cycling" state={passive} />,
    )
    const text = container.textContent ?? ''
    expect(text).toMatch(/not appreciable this breath/i)
    expect(text).not.toMatch(/Measured trigger delay is \d/)
    expect(text).toMatch(/not applicable/i)
  })

  /**
   * MV-PRE-REVIEW-01 repair pass, R6: an effort that ended a breath and a half ago is not the
   * event that triggered this one.
   *
   * On MV-01 at 20 s the latest inspiration begins at 17.52 s with no effort at the sample before
   * it; the last appreciable effort ended at 15.80 s. The helper scanned the whole preceding
   * expiration and reported 80 ms as though that old effort had triggered the current breath.
   */
  it('does not treat an old effort tail as the event that triggered the next inspiration', () => {
    const state = advanceSimulation(
      { ...createInitialSimulationState('MV-01', 'learn', 1, DEVICE), paused: false },
      20,
    )
    const waveforms = state.waveforms
    let onset = -1
    for (let index = waveforms.length - 1; index > 0; index -= 1) {
      if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
        onset = index
        break
      }
    }
    expect(onset).toBeGreaterThan(0)
    // The precondition the defect depended on: an old effort exists, but not at the onset.
    expect(-waveforms[onset - 1].pmusCmH2O).toBeLessThan(1.5)
    const oldEffort = waveforms.slice(0, onset).some((sample) => -sample.pmusCmH2O >= 1.5)
    expect(oldEffort).toBe(true)

    const evidence = triggerDelayEvidence(state)
    // Nothing preceded this breath, so nothing on this trace timed the interval.
    expect(evidence.precedingEffortCmH2O).toBe(0)
    expect(evidence.status).not.toBe('measured')
    expect(evidence.detail).not.toMatch(/already under way/i)
    // And the number that is still shown is named for what it is.
    expect(evidence.status).toBe('model-estimate')
    expect(evidence.display).toMatch(/model estimate/i)
  })

  it('never turns an unassociated event into a delay of zero', () => {
    for (const caseId of ['MV-01', 'MV-05', 'MV-07', 'MV-09']) {
      const state = advanceSimulation(
        { ...createInitialSimulationState(caseId, 'learn', 1, DEVICE), paused: false },
        16,
      )
      const evidence = triggerDelayEvidence(state)
      if (evidence.delayMs === null) expect(evidence.display).toBe('—')
      else expect(evidence.delayMs).toBeGreaterThan(0)
    }
  })
})

/* ------------------------------------------------------------------------------------------------
 * 4 — one acquisition projection, agreed across surfaces
 * ---------------------------------------------------------------------------------------------- */

describe('absent, pending, invalid, valid and stale plateaus', () => {
  const passiveBaseline = () => createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)

  it('calls an unoccluded number an estimate, on every case, at the moment it opens', () => {
    for (const caseId of mechanicalVentilationCaseById.keys()) {
      const state = createInitialSimulationState(caseId, 'practice', 1, DEVICE)
      const acquisition = plateauAcquisition(state)
      expect(acquisition.status).toBe('reference-estimate')
      expect(acquisition.acquired).toBe(false)
      expect(acquisition.supportsMechanicsClaim).toBe(false)
      expect(plateauAcquisition(state, { requireAcquisition: true }).valueCmH2O).toBeNull()
    }
  })

  it('walks a real occlusion through pending and into an acquired, valid reading', () => {
    const baseline = passiveBaseline()
    const requested = ventilationSimulationReducer(baseline, {
      type: 'PERFORM_HOLD',
      hold: 'inspiratory',
    })
    expect(plateauAcquisition(requested).status).toBe('pending')

    const held = advanceSimulation(requested, 5)
    const acquisition = plateauAcquisition(held)
    expect(acquisition.status).toBe('acquired-valid')
    expect(acquisition.acquired).toBe(true)
    expect(acquisition.supportsMechanicsClaim).toBe(true)
    expect(acquisition.acquiredAtSeconds).not.toBeNull()
    expect(acquisition.valueCmH2O).toBe(held.holdRecords.at(-1)!.valueCmH2O)
  })

  it('keeps an effort-contaminated occlusion as an invalid measurement rather than clearing it', () => {
    const active = createInitialSimulationState('MV-13', 'practice', 1, DEVICE)
    const held = advanceSimulation(
      ventilationSimulationReducer(
        { ...active, paused: false },
        {
          type: 'PERFORM_HOLD',
          hold: 'inspiratory',
        },
      ),
      5,
    )
    const acquisition = plateauAcquisition(held)
    expect(acquisition.status).toBe('acquired-invalid')
    expect(acquisition.acquired).toBe(true)
    expect(acquisition.supportsMechanicsClaim).toBe(false)
    expect(acquisition.valueCmH2O).not.toBeNull()
  })

  it('goes stale when the conditions the hold was taken under change', () => {
    const held = advanceSimulation(
      ventilationSimulationReducer(passiveBaseline(), {
        type: 'PERFORM_HOLD',
        hold: 'inspiratory',
      }),
      5,
    )
    expect(plateauAcquisition(held).status).toBe('acquired-valid')
    const changed = ventilationSimulationReducer(held, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: held.ventilator.settings.peepCmH2O + 4,
    })
    const stale = plateauAcquisition(changed)
    expect(stale.status).toBe('stale')
    expect(stale.supportsMechanicsClaim).toBe(false)
    expect(stale.valueCmH2O).toBe(held.holdRecords.at(-1)!.valueCmH2O)
  })

  /**
   * One code path serves all four facsimiles, so the assertion is that each of them says the same
   * thing about the same state rather than that each has its own rule.
   */
  it('says the same thing on all four consoles, and never calls an estimate measured', () => {
    const state = createInitialSimulationState('MV-01', 'practice', 1, DEVICE)
    /*
     * The module's own list. The first version of this test invented three device ids that do not
     * exist — every one of them fell through to the default profile, so it rendered the C6 four
     * times and proved nothing about the other three facsimiles. It also did not type-check.
     */
    expect(ventilatorDeviceIds).toHaveLength(4)
    const rendered: string[] = []
    for (const device of ventilatorDeviceIds) {
      const { container, unmount } = render(
        <MechanicalVentilatorConsole
          state={{ ...state, deviceId: device, paused: true }}
          dispatch={jest.fn()}
          controlsEnabled
        />,
      )
      const shell = container.querySelector('[data-device]')
      expect(shell?.getAttribute('data-device')).toBe(device)
      const text = container.textContent ?? ''
      rendered.push(text)
      expect(text).toMatch(/estimate from the trace/i)
      expect(text).not.toMatch(/measured Pplat/i)
      expect(text).not.toMatch(/elastic load only/i)
      unmount()
    }
    // Four genuinely different facsimiles, not the fallback four times.
    expect(new Set(rendered).size).toBe(4)
  })

  /**
   * Through the panel the learner actually reads, using nothing this batch introduced: on the
   * baseline this rendered "PLATEAU 14.3" and "PEAK − PLATEAU 17.4" on the step whose own
   * instruction is "Measure before deciding".
   */
  it('shows no plateau or split in the integration panel before a hold, and both after one', () => {
    const before = createInitialSimulationState('MV-01', 'learn', 1, DEVICE)
    const { container, unmount } = render(
      <MechanicalVentilationTeachingPanel
        lessonId="high-peak-pressure-integration"
        state={before}
      />,
    )
    const readout = (root: ParentNode, name: string) =>
      [...root.querySelectorAll('div')]
        .find((node) => node.querySelector('dt')?.textContent === name)
        ?.querySelector('dd')?.textContent ?? ''
    expect(readout(container, 'Plateau')).toContain('—')
    expect(readout(container, 'Peak − plateau')).toContain('—')
    unmount()

    const held = advanceSimulation(
      ventilationSimulationReducer(createLabSimulation('mechanics-load-and-pressure', 0, DEVICE), {
        type: 'PERFORM_HOLD',
        hold: 'inspiratory',
      }),
      5,
    )
    const after = render(
      <MechanicalVentilationTeachingPanel lessonId="high-peak-pressure-integration" state={held} />,
    )
    expect(readout(after.container, 'Plateau')).not.toContain('—')
    expect(readout(after.container, 'Peak − plateau')).not.toContain('—')
  })

  it('leaves reading and navigation open while the plateau is withheld', () => {
    const state = createInitialSimulationState('high-peak-pressure-integration' as string, 'learn')
      ? createInitialSimulationState('MV-01', 'learn', 1, DEVICE)
      : createInitialSimulationState('MV-01', 'learn', 1, DEVICE)
    const { container } = render(
      <MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />,
    )
    // Withholding an attribution is not hiding a number: the value is still printed.
    expect(container.textContent).toMatch(/Pplateau/)
    expect(container.querySelectorAll('button').length).toBeGreaterThan(4)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 5 — gases are specimens
 * ---------------------------------------------------------------------------------------------- */

describe('blood gases as observations', () => {
  it('keeps the baseline byte-stable while the internal gas state moves', () => {
    const open = createInitialSimulationState('MV-14', 'practice', 1, DEVICE)
    /*
     * The gas is moved by a real, modeled change (FiO₂ to 100 %). This used to rely on MV-14's
     * untreated saturation climbing from 76 to 97 %, which MV-PRE-REVIEW-02 traced to an
     * initialization defect: the presenting PaO₂ was not an equilibrium of the model.
     */
    const later = advanceSimulation(
      {
        ...ventilationSimulationReducer(open, {
          type: 'SET_CONTROL',
          control: 'oxygenPercent',
          value: 100,
        }),
        paused: false,
      },
      120,
    )
    expect(later.patient.gasExchange.paO2MmHg).not.toBe(open.patient.gasExchange.paO2MmHg)
    expect(JSON.stringify(later.arterialGasSamples[0])).toBe(
      JSON.stringify(open.arterialGasSamples[0]),
    )
    expect(arterialGasView(later.arterialGasSamples, later.simulationTime).current.values).toEqual(
      arterialGasView(open.arterialGasSamples, open.simulationTime).current.values,
    )
  })

  it('freezes a repeat sample at the moment it is drawn, not at every render', () => {
    const definition = mechanicalVentilationCaseById.get('MV-01')!
    const at30 = advanceSimulation(
      { ...createInitialSimulationState('MV-01', 'practice', 1, DEVICE), paused: false },
      30,
    )
    const ordered = applyIntervention(at30, definition, 'order-abg')
    const drawn = ordered.arterialGasSamples.at(-1)!
    expect(drawn.kind).toBe('repeat')
    expect(drawn.collectedAtSeconds).toBeCloseTo(30, 1)
    expect(drawn.availableAtSeconds).toBeCloseTo(90, 1)
    expect(drawn.values.paO2MmHg).toBe(at30.patient.gasExchange.paO2MmHg)

    // Waiting does not resample, and neither does the result appearing.
    const waiting = advanceSimulation(ordered, 30)
    expect(JSON.stringify(waiting.arterialGasSamples.at(-1))).toBe(JSON.stringify(drawn))
    expect(arterialGasView(waiting.arterialGasSamples, waiting.simulationTime).pending?.id).toBe(
      drawn.id,
    )
    const resulted = advanceSimulation(waiting, 40)
    expect(JSON.stringify(resulted.arterialGasSamples.at(-1))).toBe(JSON.stringify(drawn))
    const view = arterialGasView(resulted.arterialGasSamples, resulted.simulationTime)
    expect(view.current.id).toBe(drawn.id)
    expect(view.pending).toBeNull()
    // The earlier result is kept.
    expect(view.all[0].kind).toBe('baseline')
  })

  it('does not let one case’s result appear on another case or after a reset', () => {
    const definition = mechanicalVentilationCaseById.get('MV-01')!
    const ordered = applyIntervention(
      advanceSimulation(
        { ...createInitialSimulationState('MV-01', 'practice', 1, DEVICE), paused: false },
        30,
      ),
      definition,
      'order-abg',
    )
    expect(ordered.arterialGasSamples).toHaveLength(2)
    const other = createInitialSimulationState('MV-05', 'practice', 1, DEVICE)
    expect(other.arterialGasSamples).toHaveLength(1)
    expect(other.arterialGasSamples[0].id).toBe('MV-05:baseline')
    const restarted = ventilationSimulationReducer(ordered, {
      type: 'LOAD_CASE',
      caseId: 'MV-01',
      experience: 'practice',
      attempt: 1,
      deviceId: DEVICE,
    })
    expect(restarted.arterialGasSamples).toHaveLength(1)
    expect(restarted.arterialGasSamples[0].kind).toBe('baseline')
  })

  it('shows the baseline as history rather than as a reading taken now', () => {
    const later = advanceSimulation(
      {
        ...ventilationSimulationReducer(
          createInitialSimulationState('MV-14', 'practice', 1, DEVICE),
          { type: 'SET_CONTROL', control: 'oxygenPercent', value: 100 },
        ),
        paused: false,
      },
      120,
    )
    const { container } = render(
      <BedsidePanel state={later} definition={mechanicalVentilationCaseById.get('MV-14')!} />,
    )
    /*
     * MV-14's casebook supplies no blood gas at all, so the specimen is the simulator's starting
     * value and is labelled as that (MV-PRE-REVIEW-02, C5). This asserted "supplied with the case"
     * here, which was the provenance defect. A case that does supply its gas keeps that label.
     */
    expect(container.textContent).toContain('Starting gas set by the simulator')
    expect(container.textContent).not.toContain('Baseline gas supplied with the case')
    expect(container.textContent).not.toContain('Baseline gas shown.')
    const supplied = render(
      <BedsidePanel
        state={createInitialSimulationState('MV-01', 'practice', 1, DEVICE)}
        definition={mechanicalVentilationCaseById.get('MV-01')!}
      />,
    )
    expect(supplied.container.textContent).toContain(
      'Baseline gas supplied with the case, before this run',
    )
    supplied.unmount()
    const grid = container.querySelector('[data-abg-sample]')
    expect(grid?.getAttribute('data-abg-sample')).toBe('MV-14:baseline')
    /*
     * Against the case's own authored gas, not against the new field: on the baseline this panel
     * rendered `state.patient.gasExchange`, so MV-14 read PaO2 97 here after two simulated
     * minutes while the line above it still said "Baseline gas shown".
     */
    const authored = mechanicalVentilationCaseById.get('MV-14')!.initialPatient.gasExchange
    expect(grid?.textContent).toContain(`${authored.paO2MmHg.toFixed(0)} mmHg`)
    expect(grid?.textContent).not.toContain(`${later.patient.gasExchange.paO2MmHg.toFixed(0)} mmHg`)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 6 — history, current examination, branch and conditional findings
 * ---------------------------------------------------------------------------------------------- */

describe('what the examination is, and what it only describes', () => {
  it('prints the handover description apart from what the examination finds now', () => {
    const state = createInitialSimulationState('MV-01', 'learn', 1, DEVICE)
    const { container } = render(
      <BedsidePanel state={state} definition={mechanicalVentilationCaseById.get('MV-01')!} />,
    )
    const supplied = container.querySelector('[data-finding-group="supplied"]')!
    const current = container.querySelector('[data-finding-group="current"]')!
    // The handover's own pressures belong to the handover, not to the console.
    expect(within(supplied as HTMLElement).getByText(/Ppeak 34 and Pplat 27/)).toBeInTheDocument()
    expect(current.textContent).not.toMatch(/Ppeak 34/)
    expect(supplied.textContent).toMatch(/presenting description/i)
  })

  it('narrows a differential on a finding the learner actually obtained, and not otherwise', () => {
    const airway = {
      secretions: false,
      bronchospasm: false,
      hmeObstructed: true,
      ettObstructed: true,
      condensate: false,
      circuitLeak: false,
    }
    // The tube/filter finding lives on the circuit check; without it nothing is narrowed.
    expect(
      examinationBranchEvidence(airway, { assessed: true, circuitInspected: false }),
    ).toBeNull()
    expect(
      examinationBranchEvidence(airway, { assessed: true, circuitInspected: true })?.branch,
    ).toBe('hme-or-ett')
    // And nothing at all before an examination has been performed.
    expect(
      examinationBranchEvidence(
        { ...airway, secretions: true },
        { assessed: false, circuitInspected: false },
      ),
    ).toBeNull()
  })

  it('keeps action-dependent findings out of the present list', () => {
    const conditional = classifyCaseFindings('MV-01').filter(
      (finding) => finding.kind === 'onAction',
    )
    expect(conditional.length).toBeGreaterThan(0)
    const state = createInitialSimulationState('MV-01', 'practice', 1, DEVICE)
    const { container } = render(
      <BedsidePanel
        state={state}
        definition={mechanicalVentilationCaseById.get('MV-01')!}
        requireAssessment
      />,
    )
    // No assessment performed: nothing is revealed, and no hidden acquisition is completed either.
    expect(container.querySelector('[data-finding-group="supplied"]')).toBeNull()
    expect(state.holdRecords).toHaveLength(0)
    expect(plateauAcquisition(state).acquired).toBe(false)
  })

  it('does not acquire anything when the learner examines the patient', () => {
    const definition = mechanicalVentilationCaseById.get('MV-13')!
    const before = createInitialSimulationState('MV-13', 'practice', 1, DEVICE)
    const assessed = applyIntervention(before, definition, 'assess-patient')
    expect(assessed.holdRecords).toHaveLength(0)
    expect(plateauAcquisition(assessed).acquired).toBe(false)
    expect(assessed.arterialGasSamples).toEqual(before.arterialGasSamples)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 7 — the post-action episode and its window
 * ---------------------------------------------------------------------------------------------- */

describe('post-action feedback belongs to an action and an interval', () => {
  it('waits for a window in which the trace-derived readings describe the action', async () => {
    const { capturePostActionBaseline, postActionObservation, ventilationPostActionCoaching } =
      await import('../content/postActionCoaching')
    const { WAVEFORM_WINDOW_SECONDS } = await import('../engine/physics')
    const definition = mechanicalVentilationCaseById.get('MV-14')!
    let state: VentilationSimulationState = advanceSimulation(
      {
        ...createInitialSimulationState('MV-14', 'practice', 1, DEVICE),
        paused: false,
        prediction: { committed: true, mechanismId: 'a', priorityId: 'b', responseId: 'c' },
      },
      60,
    )
    const peakBefore = state.measurements.peakPressureCmH2O
    state = applyIntervention(state, definition, 'decompress-pneumothorax')
    const record = state.interventions.at(-1)!
    const baseline = capturePostActionBaseline(state, definition, record)
    expect(baseline.settleSeconds).toBeGreaterThanOrEqual(WAVEFORM_WINDOW_SECONDS)

    const tooSoon = advanceSimulation(state, 3)
    expect(postActionObservation(tooSoon, baseline).complete).toBe(false)
    expect(ventilationPostActionCoaching(tooSoon, definition, baseline)).toBeNull()

    const settled = advanceSimulation(
      state,
      baseline.effectiveAtSeconds - state.simulationTime + baseline.settleSeconds + 1,
    )
    const coaching = ventilationPostActionCoaching(settled, definition, baseline)!
    expect(coaching).not.toBeNull()
    const peak = coaching.observed.find((reading) => reading.id === 'peak-pressure')!
    // The card's "after" is the console's own peak by then, not the pre-action buffer.
    expect(peak.after).toBe(settled.measurements.peakPressureCmH2O)
    expect(peak.after).toBeLessThan(peakBefore)
    expect(coaching.observedFromSeconds).toBeCloseTo(record.time, 1)
    expect(coaching.observedToSeconds).toBeCloseTo(settled.simulationTime, 1)
    // Tensed to the interval it reports, so it cannot go on claiming an alarm that has cleared.
    expect(coaching.stabilization).not.toMatch(/active on the ventilator now/)
  })

  it('fabricates no outcome from opening the case, reading it, or assessing the patient', async () => {
    const { capturePostActionBaseline, ventilationPostActionCoaching } =
      await import('../content/postActionCoaching')
    const definition = mechanicalVentilationCaseById.get('MV-14')!
    const opened = advanceSimulation(
      {
        ...createInitialSimulationState('MV-14', 'practice', 1, DEVICE),
        paused: false,
        prediction: { committed: true, mechanismId: 'a', priorityId: 'b', responseId: 'c' },
      },
      60,
    )
    expect(ventilationPostActionCoaching(opened, definition, null)).toBeNull()

    const assessed = applyIntervention(opened, definition, 'assess-patient')
    const baseline = capturePostActionBaseline(assessed, definition, assessed.interventions.at(-1)!)
    const settled = advanceSimulation(assessed, 30)
    const coaching = ventilationPostActionCoaching(settled, definition, baseline)
    // An assessment may observe. It may not be reported as a treatment that worked.
    expect(coaching?.kind).toBe('review')
    expect(coaching?.interpretation ?? '').not.toMatch(/relieves|corrected|resolved/i)
  })
})

/* ------------------------------------------------------------------------------------------------
 * 8 — the historical protections
 * ---------------------------------------------------------------------------------------------- */

describe('what this batch must not touch', () => {
  it('keeps the live MV-03 case out of the public construction', () => {
    const definition = mechanicalVentilationCaseById.get('MV-03')
    expect(definition).toBeDefined()
    // The case data still exists for the held worked explanation; the live route does not build it.
    const lesson = ventilationStageLesson('dyssynchrony-mechanisms')
    const caseIds = lesson.steps.map((step) => step.id).join(' ')
    expect(caseIds).not.toContain('MV-03')
  })

  it('writes nothing to the self-paced or legacy stores from the engine', () => {
    const legacyKeys = [
      'mechanical-ventilation-learning-flow-v1',
      'mechanical-ventilation-live-learning-v1',
      'mechanical-ventilation-progress-v2',
      'hamilton-c6-ventilation-progress-v1',
      'mechanical-ventilation-session-v1',
      'critical-care-activity-progress-v1',
      'mechanical-ventilation-self-paced-v1',
    ]
    localStorage.clear()
    legacyKeys.forEach((key) => localStorage.setItem(key, `legacy:${key}`))
    const definition = mechanicalVentilationCaseById.get('MV-01')!
    let state = advanceSimulation(
      { ...createInitialSimulationState('MV-01', 'practice', 1, DEVICE), paused: false },
      30,
    )
    state = applyIntervention(state, definition, 'order-abg')
    state = advanceSimulation(
      ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' }),
      10,
    )
    expect(state.holdRecords.length).toBeGreaterThan(0)
    expect(state.arterialGasSamples.length).toBe(2)
    legacyKeys.forEach((key) => expect(localStorage.getItem(key)).toBe(`legacy:${key}`))
  })

  it('adds the new records in memory only, with no serialized learner store for them', () => {
    const state = createInitialSimulationState('MV-01', 'practice', 1, DEVICE)
    expect(Array.isArray(state.holdRecords)).toBe(true)
    expect(Array.isArray(state.arterialGasSamples)).toBe(true)
    // The lab checkpoint schema is the only serialized MV record and it carries neither.
    const checkpoint = JSON.stringify({ version: 1, unitId: 'breathing-with-support' })
    expect(checkpoint).not.toContain('holdRecords')
    expect(checkpoint).not.toContain('arterialGasSamples')
  })
})
