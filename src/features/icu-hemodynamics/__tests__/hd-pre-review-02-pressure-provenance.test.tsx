import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { NormalWaveformValidityChallenges } from '../components/NormalWaveformValidityChallenges'
import { HemodynamicsStoryProblems } from '../components/stage/HemodynamicsStoryProblems'
import { WedgeCursorPicker } from '../components/stage/WedgeCursorPicker'
import { derivedInputConventionLabels } from '../content/derivedMetrics'
import { derivedMeasurementEpisodes } from '../content/derivedMeasurementEpisodes'
import {
  normalWaveformValidityChallenges,
  validityWithheldHeading,
} from '../content/normalWaveformValidityChallenges'
import { routeStops } from '../content/routeSpine'
import { signalGrammarRows } from '../content/signalGrammar'
import {
  evaluateDerivedMetric,
  icuHemodynamicsReducer,
  isEndExpiration,
  recentTracePressureMetrics,
  respiratoryPhaseAt,
  wedgeCaptureDelaySeconds,
  WEDGE_AUTO_DEFLATION_SECONDS,
} from '../engine'
import {
  assistedWedgeCursorTime,
  occlusionCapture,
  storedWedgeProvenance,
  wedgeCursorReadingAt,
} from '../engine/measurementProvenance'
import { lineMeasurementSystem } from '../engine/measurementLines'
import { unroundedModelEstimates } from '../engine/simulation'
import {
  ARTERIAL_FAST_FLUSH_CHECK,
  cleanState,
  dampedArterialState,
  reduceAll,
  sectionRuntime,
  stageGoalLabel,
  stageGoalMet,
  stageWatchValue,
} from '../engine/stageRuntime'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine/types'
import { MMHG_PER_CM_H2O } from '../engine/waveformMorphology'

afterEach(cleanup)

const reduce = (state: HemodynamicSimulationState, action: HemodynamicAction) =>
  icuHemodynamicsReducer(state, action)

/* ------------------------------------------------------------------ *
 * C. compatible pressure observations
 * ------------------------------------------------------------------ */

describe('C. every compared pressure says which quantity it is', () => {
  it('L2-02: the PA rail is the last beat and the dashed line is the model mean', () => {
    const state = reduce(cleanState(510, 'pa'), { type: 'TICK', seconds: 6 })
    render(<BedsideMonitor state={state} dispatch={jest.fn()} />)
    const rail = screen.getByRole('group', { name: 'Current PAC pressure' })
    const beat = recentTracePressureMetrics(state.waveforms, 'papMmHg', 82)!
    expect(rail.textContent).toContain(`last beat · mPAP ${beat.mean.toFixed(0)}, that beat’s mean`)
    // The strip's reference is the model's own mean, which carries no respiratory swing.
    const strip = screen
      .getAllByRole('img')
      .find((node) => /PAP waveform/.test(node.getAttribute('aria-label') ?? ''))!
    expect(strip.getAttribute('aria-label')).toContain(
      `model mPAP ${state.measurements.meanPapMmHg}`,
    )
    // They are different quantities and are allowed to differ; they are not forced equal.
    expect(Math.round(beat.mean)).not.toBe(state.measurements.meanPapMmHg)
  })

  it('L2-14: the story table shows one change on every offset row and none on the pulse pressure', () => {
    render(<HemodynamicsStoryProblems sectionId="pressure-system" />)
    const story = document.querySelector('[data-story="story-relevel-for-flat"]')!
    fireEvent.click(
      [...story.querySelectorAll('button')].find((button) =>
        /Show what happens/.test(button.textContent ?? ''),
      )!,
    )
    const rows = [...story.querySelectorAll('[data-story-run] tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent),
    )
    const offset = `+${(8 * MMHG_PER_CM_H2O).toFixed(1)}`
    expect(rows[0][2]).toBe(offset)
    expect(rows[1][2]).toBe(offset)
    expect(rows[2][2]).toBe('none')
    expect(rows[2][0]).toBe(rows[2][1])
    expect(story.querySelector('[data-story-provenance]')?.textContent).toMatch(
      /not two different beats/,
    )
  })

  it('L2-14: the before-and-after table subtracts unrounded values', () => {
    const before = cleanState(510, 'pa')
    const after = reduce(before, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 })
    const shift = (key: 'papSystolic' | 'papDiastolic' | 'meanPap') =>
      (stageWatchValue(key, after) as number) - (stageWatchValue(key, before) as number)
    for (const key of ['papSystolic', 'papDiastolic', 'meanPap'] as const) {
      expect(shift(key)).toBeCloseTo(-10 * MMHG_PER_CM_H2O, 9)
    }
    expect(
      (stageWatchValue('pulsePressure', after) as number) -
        (stageWatchValue('pulsePressure', before) as number),
    ).toBeCloseTo(0, 9)
  })

  it('L6-03: the wedge rail, the model line and the stored value are three named quantities', () => {
    let state = reduce(cleanState(550, 'pa'), { type: 'START_WEDGE' })
    state = reduce(state, {
      type: 'TICK',
      seconds: wedgeCaptureDelaySeconds(state.parameters.respiratoryRateBpm) + 0.2,
    })
    state = reduceAll(state, [{ type: 'PLACE_WEDGE_CURSOR' }, { type: 'STORE_WEDGE' }])
    render(<BedsideMonitor state={state} dispatch={jest.fn()} />)
    expect(screen.getByRole('group', { name: 'Current PAC pressure' }).textContent).toMatch(
      /live mean, last beat, any breath phase/,
    )
    expect(screen.getByRole('group', { name: 'PAWP measurement' }).textContent).toMatch(
      /stored end-exp · assisted cursor · mmHg/,
    )
    const strip = screen
      .getAllByRole('img')
      .find((node) => /PAWP waveform/.test(node.getAttribute('aria-label') ?? ''))!
    expect(strip.getAttribute('aria-label')).toMatch(/model end-exp mean/)
    expect(strip.getAttribute('aria-label')).toMatch(/assisted cursor · cycle mean/)
  })

  it('L3-04: the RA stop names one reading point and keeps the monitor mean distinct', () => {
    const ra = routeStops.find((stop) => stop.id === 'ra')!
    expect(ra.checklist).toContain('read at the base of the c wave, not a peak')
    expect(ra.checklist.join(' ')).not.toMatch(/read the mean/)
    expect(ra.precise).toMatch(/not a digital mean averaged across the breath/)
    expect(ra.wiggle.watch).toMatch(/end expiration/)
    expect(ra.wiggle.watch).toMatch(/base of the c wave/)
    const atrial = signalGrammarRows.find((row) => row.id === 'atrial-shape')!
    expect(atrial.shortlist).toContain('read at the c-wave base')
  })

  it('L3-09: chamber identity and numeric usability are judged separately, per fault', () => {
    const identifiable = normalWaveformValidityChallenges
      .filter((challenge) => challenge.readout.chamber.identifiable)
      .map((challenge) => challenge.faultKind)
      .sort()
    expect(identifiable).toEqual(['level-or-zero', 'motion-artifact', 'respiratory-phase-mismatch'])
    for (const challenge of normalWaveformValidityChallenges) {
      expect(challenge.readout.value.length).toBeGreaterThan(0)
      expect(validityWithheldHeading(challenge)).toBe(
        challenge.readout.chamber.identifiable
          ? 'Why the number cannot be used as displayed'
          : 'Why no chamber can be named',
      )
    }
    // The motion-artifact item keeps its notch and runoff: the chamber is named, the peak is not used.
    render(<NormalWaveformValidityChallenges />)
    const motion = normalWaveformValidityChallenges.find(
      (challenge) => challenge.faultKind === 'motion-artifact',
    )!
    fireEvent.click(screen.getAllByRole('button', { name: motion.label })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Show the reasoning' }))
    const readout = screen.getByText(/Chamber readout/i).closest('p')!
    expect(
      readout.querySelector('[data-chamber-reading]')?.getAttribute('data-chamber-reading'),
    ).toBe('named')
    expect(readout.textContent).toMatch(/pulmonary-artery pattern/)
    expect(readout.textContent).toMatch(/Value: no single beat’s systolic or diastolic value/)
  })

  it('L8-02: the PVR ledger says which cycle "mean" is taken over', () => {
    expect(derivedInputConventionLabels['mean-over-cycle']).toBe(
      'mean over the cardiac cycle (respiratory phase not stated)',
    )
    const episode = derivedMeasurementEpisodes.find((candidate) => candidate.role === 'workbench')!
    const flow = episode.flowResults[0]
    const pvr = evaluateDerivedMetric('pulmonaryVascularResistance', episode, flow)
    const rows = Object.fromEntries(pvr.ledger.map((row) => [row.inputId, row.display]))
    expect(rows.meanPapMmHg).toMatch(/mean over the cardiac cycle \(respiratory phase not stated\)/)
    expect(rows.pawpMeanMmHg).toMatch(/mean at end expiration/)
    // The formulas' accepted conventions are unchanged: this is a label, not a new rule.
    expect(pvr.status).not.toBe('withheld')
  })
})

/* ------------------------------------------------------------------ *
 * D. manual and assisted cursor agency
 * ------------------------------------------------------------------ */

function occludedAndReady(seed = 550): HemodynamicSimulationState {
  let state = reduce(cleanState(seed, 'pa'), { type: 'START_WEDGE' })
  state = reduce(state, {
    type: 'TICK',
    seconds: wedgeCaptureDelaySeconds(state.parameters.respiratoryRateBpm) + 0.6,
  })
  expect(state.catheter.wedgeCaptureReady).toBe(true)
  return state
}

describe('D. the wedge cursor is placed on captured samples, by someone', () => {
  it('a manual placement records the chosen sample, its value and its respiratory phase', () => {
    const state = occludedAndReady()
    const capture = occlusionCapture(state)!
    const midInspiration =
      capture.samples.find(
        (sample) =>
          sample.time >= capture.cursorMin &&
          sample.time <= capture.cursorMax &&
          Math.abs(respiratoryPhaseAt(sample.time, 18) - 0.25) < 0.02,
      ) ?? capture.samples[Math.floor(capture.samples.length / 2)]
    const placed = reduce(state, {
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'manual',
      time: midInspiration.time,
    })
    const cursor = placed.catheter.wedgeCursor!
    expect(cursor.placement).toBe('manual')
    expect(cursor.time).toBe(midInspiration.time)
    expect(placed.catheter.wedgeCursorTime).toBe(cursor.time)
    expect(cursor.sampleMmHg).toBe(midInspiration.pcwpMmHg)
    // The value is the mean of the cardiac cycle centred on the sample, computed independently here.
    const half = capture.cycleSeconds / 2
    const window = capture.samples.filter(
      (sample) => sample.time >= cursor.time - half && sample.time <= cursor.time + half,
    )
    const expected = window.reduce((total, sample) => total + sample.pcwpMmHg, 0) / window.length
    expect(cursor.cycleMeanMmHg).toBeCloseTo(expected, 12)
    expect(cursor.withinModeledEndExpiratoryWindow).toBe(
      isEndExpiration(respiratoryPhaseAt(cursor.time, 18)),
    )
    // Stored away from end expiration: kept, and not recorded as an end-expiratory wedge.
    const stored = reduce(placed, { type: 'STORE_WEDGE' })
    expect(stored.catheter.storedWedgeMmHg).toBeCloseTo(cursor.cycleMeanMmHg, 12)
    expect(stored.catheter.storedAtEndExpiration).toBe(cursor.withinModeledEndExpiratoryWindow)
    if (!cursor.withinModeledEndExpiratoryWindow) {
      expect(stageGoalMet({ type: 'wedge-stored' }, stored)).toBe(false)
      expect(stored.responseMessage).toMatch(/not recorded as an end-expiratory wedge/)
    }
  })

  it('the assisted placement is the modeled end expiration, and is recorded as assisted', () => {
    const state = occludedAndReady()
    const placed = reduce(state, { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })
    const cursor = placed.catheter.wedgeCursor!
    expect(cursor.placement).toBe('assisted')
    expect(cursor.time).toBe(assistedWedgeCursorTime(state))
    expect(cursor.withinModeledEndExpiratoryWindow).toBe(true)
    const capture = occlusionCapture(state)!
    const distance = (time: number) => {
      const phase = respiratoryPhaseAt(time, 18)
      return Math.min(phase, 1 - phase)
    }
    for (const sample of capture.samples) {
      if (sample.time < capture.cursorMin || sample.time > capture.cursorMax) continue
      expect(distance(cursor.time)).toBeLessThanOrEqual(distance(sample.time) + 1e-12)
    }
    const stored = reduce(placed, { type: 'STORE_WEDGE' })
    expect(stageGoalMet({ type: 'wedge-stored' }, stored)).toBe(true)
    expect(storedWedgeProvenance(stored)?.record?.cursor.placement).toBe('assisted')
    expect(placed.responseMessage).toMatch(/not as a point you identified/)
  })

  it('refuses a cursor or a store with nothing captured, and keeps the Task-01 guards', () => {
    const inflated = reduce(cleanState(550, 'pa'), { type: 'START_WEDGE' })
    const forced = {
      ...inflated,
      catheter: { ...inflated.catheter, wedgeCaptureReady: true },
    }
    const refused = reduce(forced, { type: 'PLACE_WEDGE_CURSOR' })
    expect(refused.catheter.wedgeCursor ?? null).toBeNull()
    expect(refused.responseMessage).toMatch(/not yet a full cardiac cycle/)
    expect(reduce(forced, { type: 'STORE_WEDGE' }).catheter.storedWedgeMmHg).toBeNull()

    // The simulation's own occlusion cutoff still ends it, clears the cursor, and credits nothing.
    let state = reduce(occludedAndReady(), { type: 'PLACE_WEDGE_CURSOR', placement: 'assisted' })
    state = reduce(state, { type: 'TICK', seconds: WEDGE_AUTO_DEFLATION_SECONDS })
    expect(state.catheter.forcedSafetyRecovery).toBe(true)
    expect(state.catheter.wedgeCursor ?? null).toBeNull()
    expect(reduce(state, { type: 'STORE_WEDGE' }).catheter.storedWedgeMmHg).toBeNull()
    expect(stageGoalMet({ type: 'balloon-down' }, state)).toBe(false)
  })

  it('the slider, its text and the drawn cursor read the same sample', () => {
    const state = occludedAndReady()
    const dispatch = jest.fn()
    render(<WedgeCursorPicker state={state} dispatch={dispatch} enabled controlId="cursor-test" />)
    const slider = document.getElementById('cursor-test') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '7' } })
    const capture = occlusionCapture(state)!
    const expected = wedgeCursorReadingAt(state, capture.cursorMin + 0.7, 'manual')!
    expect(slider.getAttribute('aria-valuetext')).toContain(
      `mean of the cardiac cycle centred here ${expected.cycleMeanMmHg.toFixed(1)} mmHg`,
    )
    expect(document.querySelector('[data-cursor-preview]')?.textContent).toBe(
      `${expected.cycleMeanMmHg.toFixed(1)} mmHg`,
    )
    expect(document.querySelector('[data-cursor-preview-text]')?.textContent).toContain(
      `${(expected.time - capture.start).toFixed(1)} s into the occlusion`,
    )
    expect(document.querySelector('[data-respiratory-reference-label]')?.textContent).toMatch(
      /not a measured ventilator, airway-pressure or impedance trace/,
    )
    fireEvent.click(document.querySelector('[data-cursor-action="manual"]')!)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'manual',
      time: capture.cursorMin + 0.7,
    })
    // Dispatched on the engine, the same time resolves to the same sample the preview showed.
    const placed = reduce(state, dispatch.mock.calls[0][0])
    expect(placed.catheter.wedgeCursor?.time).toBe(expected.time)
    expect(placed.catheter.wedgeCursor?.cycleMeanMmHg).toBe(expected.cycleMeanMmHg)
  })

  it('after a manual placement, says where it sits and how the value differs — no tolerance claimed', () => {
    const state = occludedAndReady()
    const capture = occlusionCapture(state)!
    const placed = reduce(state, {
      type: 'PLACE_WEDGE_CURSOR',
      placement: 'manual',
      time: capture.cursorMin,
    })
    render(<WedgeCursorPicker state={placed} dispatch={jest.fn()} enabled controlId="c2" />)
    const feedback = document.querySelector('[data-cursor-placed="manual"]')!
    expect(feedback.textContent).toMatch(/Your cursor/)
    expect(feedback.textContent).toMatch(/At the modeled end expiration the same capture reads/)
    expect(feedback.textContent).toMatch(/model, not a clinical tolerance|inside the simulation/)
    // The live strip no longer shows an automatic end-expiration marker during the occlusion.
    cleanup()
    render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
    const strip = screen
      .getAllByRole('img')
      .find((node) => /PAWP waveform/.test(node.getAttribute('aria-label') ?? ''))!
    expect(strip.getAttribute('aria-label')).not.toMatch(/end-exp cursor/)
  })
})

/* ------------------------------------------------------------------ *
 * F. line-specific repair
 * ------------------------------------------------------------------ */

describe('F. the arterial line has its own dynamic response', () => {
  it('repairing the arterial line restores the arterial tracing and nothing else', () => {
    const damped = reduce(dampedArterialState(616), { type: 'TICK', seconds: 3 })
    const repaired = reduceAll(damped, [
      { type: 'FAST_FLUSH', lineType: 'systemic-arterial' },
      { type: 'SET_DAMPING', dampingRatio: 0.65, line: 'systemic-arterial' },
      { type: 'SET_ARTIFACT', artifact: 'none', line: 'systemic-arterial' },
    ])
    expect(damped.measurementSystem.lastFastFlushFinding ?? '').toBe('')
    expect(repaired.measurementSystem.lastFastFlushFinding).toMatch(/overdamping suspected/)
    expect(repaired.signalValidationChecks).toContain(ARTERIAL_FAST_FLUSH_CHECK)
    const before = unroundedModelEstimates(damped)
    const after = unroundedModelEstimates(repaired)
    expect(after.artSystolicMmHg - after.artDiastolicMmHg).toBeGreaterThan(
      before.artSystolicMmHg - before.artDiastolicMmHg,
    )
    expect(after.papSystolicMmHg).toBe(before.papSystolicMmHg)
    expect(after.papDiastolicMmHg).toBe(before.papDiastolicMmHg)
    expect(after.rapMmHg).toBe(before.rapMmHg)
    expect(lineMeasurementSystem(repaired.measurementSystem, 'pulmonary-artery').dampingRatio).toBe(
      0.65,
    )
  })

  it('keeps the old shared default: a line-less repair still acts on every channel', () => {
    const shared = reduceAll(cleanState(611, 'pa'), [{ type: 'SET_DAMPING', dampingRatio: 1.15 }])
    expect(shared.measurementSystem.arterialLine ?? null).toBeNull()
    const estimates = unroundedModelEstimates(shared)
    const clean = unroundedModelEstimates(cleanState(611, 'pa'))
    expect(estimates.papSystolicMmHg).toBeLessThan(clean.papSystolicMmHg)
    expect(estimates.artSystolicMmHg).toBeLessThan(clean.artSystolicMmHg)
  })

  it('the capstone transfer names, flushes and reports the arterial line', () => {
    const runtime = sectionRuntime('pac-signal-validation')
    expect(runtime.transferGoals[0]).toEqual({ type: 'check', id: ARTERIAL_FAST_FLUSH_CHECK })
    expect(stageGoalLabel(runtime.transferGoals[0])).toBe('Run a fast flush on the arterial line')
    expect(runtime.transferWatch).toEqual([
      'artSystolic',
      'artDiastolic',
      'artPulsePressure',
      'pulsePressure',
      'rap',
    ])
    const flushedOtherLine = reduce(dampedArterialState(616), {
      type: 'FAST_FLUSH',
      lineType: 'pulmonary-artery',
    })
    expect(stageGoalMet(runtime.transferGoals[0], flushedOtherLine)).toBe(false)
  })
})
