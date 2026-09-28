/**
 * MV-PRE-REVIEW-03 — workbench, waveforms and experiment flow.
 *
 * One describe per assigned finding. Where an assertion is marked "fails on the base", it was
 * written with symbols that exist on `756c9aee` and fails there for the defect the walkthrough
 * reported, not for a missing import; the handoff lists which ones and why.
 */
import { readFileSync } from 'fs'
import path from 'path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { MechanicalVentilationLearnLanding } from '../components/MechanicalVentilationLearnLanding'
import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import { VentilationWaveformReadingSequence } from '../components/MechanicalVentilationTeachingPanel'
import { RecordedBreathComparison } from '../components/stage/RecordedBreathComparison'
import { VentilationExperimentPanel } from '../components/stage/VentilationExperimentPanel'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { headingNeedsReveal, requestTaskHeadingReveal } from '../components/stage/revealTaskHeading'
import { IDEAL_REFERENCE, IdealizedComparison } from '../components/teaching/IdealizedComparison'
import { deliveredVolumeStepNote } from '../content/deliveredVolume'
import { ventilationExperimentStatus } from '../content/experimentStatus'
import { mechanicalVentilationCaseById } from '../content'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { plateauAcquisition } from '../content/plateauAcquisition'
import { ventilationStageLesson } from '../content/stageLessons'
import { advanceSimulation, createInitialSimulationState, ventilatorDeviceIds } from '../engine'
import {
  idealBreaths,
  idealComparisonAxes,
  idealPairAxes,
  idealSeriesPath,
} from '../engine/idealComparison'
import {
  createLabSession,
  createLabSimulation,
  labSnapshot,
  learningLabReducer,
  type LabAction,
  type LabSession,
} from '../engine/learningLab'
import { ventilationSimulationReducer } from '../engine/reducer'
import { VENTILATION_SELF_PACED_KEY } from '../engine/selfPacedProgress'
import { completedBreath } from '../engine/teachingBreath'
import type { VentilationAction } from '../engine/types'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/mechanical-ventilation/learn',
}))

const DEVICE = 'hamilton-c6' as const
const scrollIntoView = jest.fn()

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  scrollIntoView.mockClear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const boot = () => act(() => jest.advanceTimersByTime(10))
function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  boot()
  return ventilationStageLesson(unitId)
}
function taskStepIndex(unitId: string) {
  return ventilationStageLesson(unitId).steps.findIndex(
    (step) => step.interaction.kind === 'simulator-task',
  )
}
function chooseStep(index: number) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
    target: { value: index },
  })
}
const heading = () => document.querySelector<HTMLElement>('[data-step-heading]')!

/* A lab session driven the way the Learn host drives it. */
function session(unitId: string, ...actions: LabAction[]): LabSession {
  let current = createLabSession(unitId, DEVICE)
  for (const action of actions) current = learningLabReducer(current, action)
  return current
}
const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })
function runFor(current: LabSession, seconds: number): LabSession {
  let next = learningLabReducer(current, engine({ type: 'SET_PAUSED', paused: false }))
  for (let t = 0; t < seconds - 1e-9; t += 0.1)
    next = learningLabReducer(next, engine({ type: 'TICK', seconds: 0.1 }))
  return next
}

/* ------------------------------------------------------------------------------------------------
 * N7 — the experiment is operated where it is described, in the learner's words
 * ---------------------------------------------------------------------------------------------- */

describe('N7: explicit, truthful experiment operation', () => {
  it('names each stage from the existing gates, and a setting edit never starts the run', () => {
    const started = session('waveform-anatomy', { type: 'START_EXPERIMENT' })
    const opening = ventilationExperimentStatus(started)
    expect(opening.stage).toBe('awaiting-action')
    expect(opening.running).toBe(false)
    expect(opening.canCapture).toBe(false)
    expect(opening.headline).toMatch(/Paused\. Next: set the inspiratory flow to 60 L\/min/)

    const changed = learningLabReducer(
      started,
      engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 }),
    )
    // The edit is in place; nothing ran, no time passed, nothing was captured.
    expect(changed.simulation.paused).toBe(true)
    expect(changed.simulation.simulationTime).toBe(started.simulation.simulationTime)
    expect(changed.evidence[0].response).toBeUndefined()
    const waiting = ventilationExperimentStatus(changed)
    expect(waiting.stage).toBe('awaiting-interval')
    expect(waiting.elapsedSeconds).toBe(0)
    expect(waiting.headline).toMatch(/Run the experiment/)

    const partway = runFor(changed, 4)
    const partStatus = ventilationExperimentStatus(partway)
    expect(partStatus.stage).toBe('awaiting-interval')
    expect(partStatus.elapsedSeconds).toBeGreaterThan(3.5)
    expect(partStatus.elapsedSeconds).toBeLessThan(12)
    // Announced on transitions, not per tick: the phrase is the same a few seconds later.
    expect(ventilationExperimentStatus(runFor(partway, 3)).announcement).toBe(
      partStatus.announcement,
    )

    const ready = runFor(changed, 12.2)
    expect(ventilationExperimentStatus(ready).stage).toBe('ready')
    expect(ventilationExperimentStatus(ready).canCapture).toBe(true)

    // Undoing the requested change stops the interval rather than keeping its credit.
    const undone = learningLabReducer(
      ready,
      engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 40 }),
    )
    expect(ventilationExperimentStatus(undone).stage).toBe('awaiting-action')
    expect(ventilationExperimentStatus(undone).canCapture).toBe(false)

    const captured = learningLabReducer(ready, { type: 'COMPARE' })
    expect(ventilationExperimentStatus(captured).stage).toBe('captured')
  })

  it('reports a requested hold as a measurement in progress, not as a completed action', () => {
    const requested = session(
      'high-peak-pressure-integration',
      { type: 'START_EXPERIMENT' },
      engine({ type: 'PERFORM_HOLD', hold: 'inspiratory' }),
    )
    const status = ventilationExperimentStatus(requested)
    expect(status.stage).toBe('awaiting-measurement')
    expect(status.goals[0].state).toBe('in-progress')
    expect(status.canCapture).toBe(false)
    expect(status.headline).toMatch(/only while the experiment runs/)
  })

  it('has no interval to wait for when a round asks for none', () => {
    const started = session('breathing-with-support', { type: 'START_EXPERIMENT' })
    const breath = completedBreath(started.evidence[0].baseline!.waveforms)
    const expiratory = breath.findIndex((sample, i) => i > 1 && sample.phase === 'expiration') + 3
    const inspected = learningLabReducer(started, {
      type: 'INSPECT',
      sampleTime: breath[expiratory].time,
    })
    const status = ventilationExperimentStatus(inspected)
    expect(status.intervalSeconds).toBe(0)
    expect(status.stage).toBe('ready')
  })

  it.each(ventilationLearningUnits.map((unit) => unit.id))(
    '%s puts Run beside the task and drops the engine-language copy',
    (unitId) => {
      mount(unitId)
      chooseStep(taskStepIndex(unitId))
      const card = document.querySelector('[data-current-step]')!
      expect(card.querySelector('[data-experiment-panel]')).not.toBeNull()
      expect(
        within(card as HTMLElement).getByRole('button', { name: 'Run experiment' }),
      ).toBeEnabled()
      expect(
        within(card as HTMLElement).getByRole('button', { name: 'Capture result' }),
      ).toBeDisabled()
      // One clock control for one patient.
      expect(screen.getAllByRole('button', { name: /^(Run|Run experiment|Pause)$/ })).toHaveLength(
        1,
      )
      const text = document.body.textContent ?? ''
      expect(text).not.toMatch(/Observe for 0 simulated seconds/)
      expect(text).not.toMatch(/requested action is present/)
    },
  )

  it('captures automatically only when opted in, and only once the gate is actually met', () => {
    mount('waveform-anatomy')
    chooseStep(taskStepIndex('waveform-anatomy'))
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    fireEvent.change(document.getElementById('mv-quick-peakFlowLMin')!, { target: { value: '60' } })
    // Opting in and changing the setting runs nothing.
    act(() => jest.advanceTimersByTime(3000))
    expect(
      document.querySelector('[data-experiment-panel]')!.getAttribute('data-experiment-stage'),
    ).toBe('awaiting-interval')
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    act(() => jest.advanceTimersByTime(6000))
    expect(document.querySelector('[data-captured-result]')).toBeNull()
    act(() => jest.advanceTimersByTime(8000))
    expect(
      document.querySelector('[data-experiment-panel]')!.getAttribute('data-experiment-stage'),
    ).toBe('captured')
    expect(document.querySelector('[data-captured-result]')).not.toBeNull()
  })

  it('without the option, a ready result waits for the learner', () => {
    mount('waveform-anatomy')
    chooseStep(taskStepIndex('waveform-anatomy'))
    fireEvent.change(document.getElementById('mv-quick-peakFlowLMin')!, { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run experiment' }))
    act(() => jest.advanceTimersByTime(14000))
    expect(
      document.querySelector('[data-experiment-panel]')!.getAttribute('data-experiment-stage'),
    ).toBe('ready')
    expect(screen.getByRole('button', { name: 'Capture result' })).toBeEnabled()
  })

  it('holds automatic capture on a comparison that no longer isolates one change', () => {
    const ready = runFor(
      session(
        'waveform-anatomy',
        { type: 'START_EXPERIMENT' },
        engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 }),
      ),
      12.2,
    )
    const confounded: LabSession = { ...ready, confounds: ['Additional input changed: ratePerMin'] }
    const lab = jest.fn()
    render(<VentilationExperimentPanel session={confounded} lab={lab} engine={jest.fn()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Capture automatically/ }))
    expect(lab).not.toHaveBeenCalledWith({ type: 'COMPARE' })
    expect(document.querySelector('[data-auto-capture-held]')).not.toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * N4 — explicit navigation brings the new task into view; nothing else moves the page
 * ---------------------------------------------------------------------------------------------- */

describe('N4: navigation, focus and scroll', () => {
  it('reveals and focuses the new heading on Continue, Back and step choice', () => {
    mount('waveform-anatomy')
    const [top] = screen.getAllByRole('button', { name: 'Continue' })
    fireEvent.click(top)
    expect(document.activeElement).toBe(heading())
    expect(heading()).toHaveTextContent(ventilationStageLesson('waveform-anatomy').steps[1].title)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    // The bottom Continue — the one the walkthrough pressed.
    const buttons = screen.getAllByRole('button', { name: 'Continue' })
    fireEvent.click(buttons[buttons.length - 1])
    expect(document.activeElement).toBe(heading())
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(document.activeElement).toBe(heading())
    chooseStep(5)
    expect(document.activeElement).toBe(heading())
    expect(scrollIntoView).toHaveBeenCalledTimes(4)
    // The step count is the heading's description, so it is read with it.
    const describedBy = heading().getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)).toHaveTextContent(/Step 6 of 10/)
  })

  it('does not move focus or the page on ticks, Run/Pause, control changes or disclosures', () => {
    mount('waveform-anatomy')
    chooseStep(taskStepIndex('waveform-anatomy'))
    const calls = scrollIntoView.mock.calls.length
    const run = screen.getByRole('button', { name: 'Run experiment' })
    run.focus()
    fireEvent.click(run)
    act(() => jest.advanceTimersByTime(5000))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.change(document.getElementById('mv-quick-peakFlowLMin')!, { target: { value: '60' } })
    fireEvent.click(screen.getAllByText('More detail')[0])
    act(() => jest.advanceTimersByTime(2000))
    expect(scrollIntoView.mock.calls.length).toBe(calls)
    expect(document.activeElement).not.toBe(heading())
  })

  it('uses no global focus listener to do it', () => {
    const documentSpy = jest.spyOn(document, 'addEventListener')
    const windowSpy = jest.spyOn(window, 'addEventListener')
    mount('waveform-anatomy')
    fireEvent.click(screen.getAllByRole('button', { name: 'Continue' })[0])
    for (const spy of [documentSpy, windowSpy])
      expect(spy.mock.calls.some(([type]) => type === 'focusin' || type === 'focus')).toBe(false)
    documentSpy.mockRestore()
    windowSpy.mockRestore()
  })

  it('focuses a new section’s heading only when a section change asked for it', () => {
    requestTaskHeadingReveal()
    mount('waveform-anatomy')
    expect(document.activeElement).toBe(heading())
    cleanup()
    mount('breathing-with-support')
    expect(document.activeElement).not.toBe(heading())
  })

  it('keeps a section’s arrival quiet when its heading is already comfortably in view', () => {
    // 81 px of pinned chrome in a 900 px viewport: the lower half starts at 490 px.
    expect(headingNeedsReveal({ top: 430, bottom: 462 }, 81, 900)).toBe(false)
    expect(headingNeedsReveal({ top: -801, bottom: -769 }, 81, 900)).toBe(true)
    expect(headingNeedsReveal({ top: 60, bottom: 92 }, 81, 900)).toBe(true)
    expect(headingNeedsReveal({ top: 620, bottom: 652 }, 81, 900)).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------------
 * T1 / S6-2 — one lesson shape in every section
 * ---------------------------------------------------------------------------------------------- */

describe('T1 and S6-2: the lesson is shown, in one shape, in all fourteen sections', () => {
  const ALLOWED = ['Worked example', 'More detail', 'Model limits']
  it.each(ventilationLearningUnits.map((unit) => unit.id))('%s', (unitId) => {
    const lesson = mount(unitId)
    const kinds = new Set<string>()
    for (const [index, step] of lesson.steps.entries()) {
      if (kinds.has(step.interaction.kind)) continue
      kinds.add(step.interaction.kind)
      chooseStep(index)
      expect(screen.queryByText('Teaching and worked references')).toBeNull()
      const lessons = document.querySelectorAll('[data-lesson]')
      expect(lessons).toHaveLength(1)
      const block = lessons[0]
      expect(block.closest('details')).toBeNull()
      expect(block.querySelector('[data-lesson-part="idea"]')?.textContent).toMatch(/The idea:/)
      expect(block.querySelector('[data-lesson-part="task"]')?.textContent?.length).toBeGreaterThan(
        20,
      )
      const names = [...block.querySelectorAll(':scope > details > summary')].map(
        (summary) => summary.textContent,
      )
      expect(names.every((name) => ALLOWED.includes(name ?? ''))).toBe(true)
      expect(names).toEqual(ALLOWED.filter((name) => names.includes(name)))
      // The unit's model boundary is on the page exactly once: shown, or in Model limits.
      const boundary = lesson.unit.boundary
      const occurrences = (block.textContent ?? '').split(boundary).length - 1
      expect(occurrences).toBe(1)
    }
  })

  it('shows a foundation section’s worked figure by default where the step reads it', () => {
    mount('modes-and-breath-delivery')
    const figure = document.querySelector('[data-lesson] [data-idealized-comparison]')!
    expect(figure).not.toBeNull()
    expect(figure.closest('details')).toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * V1 — one readable physical scale for the VC/PC comparison
 * ---------------------------------------------------------------------------------------------- */

describe('V1: the idealized VC/PC comparison', () => {
  const pair = idealBreaths(IDEAL_REFERENCE)
  it('reproduces the report: the all-settings flow axis is ±400 L/min', () => {
    expect(idealComparisonAxes(IDEAL_REFERENCE).flow).toEqual([-400, 400])
  })

  it('fits one shared scale to the pair, so the square and decelerating flows are readable', () => {
    const axes = idealPairAxes(pair)
    expect(axes.flow[0]).toBe(-axes.flow[1])
    const vcPeak = Math.max(...pair.volumeTargeted.flow)
    const pcPeak = Math.max(...pair.pressureTargeted.flow)
    expect(vcPeak).toBeCloseTo(24, 5)
    expect(vcPeak / axes.flow[1]).toBeGreaterThan(0.3)
    expect(pcPeak).toBeLessThanOrEqual(axes.flow[1])
    // One axes object for both modes: their amplitudes keep their ratio on screen.
    const top = (d: string) => Math.min(...d.match(/ -?\d+\.\d+/g)!.map(Number))
    const zero = 35
    const vcHeight = zero - top(idealSeriesPath(pair.volumeTargeted, 'flow', axes))
    const pcHeight = zero - top(idealSeriesPath(pair.pressureTargeted, 'flow', axes))
    expect(pcHeight / vcHeight).toBeCloseTo(pcPeak / vcPeak, 1)
  })

  it('labels rows with units, marks zero, and keeps the fixed scale one press away', () => {
    render(<IdealizedComparison />)
    const svg = document.querySelector('[data-idealized-comparison] svg')!
    const texts = [...svg.querySelectorAll('text')].map((node) => node.textContent)
    expect(texts).toEqual(
      expect.arrayContaining(['Pressure (cmH₂O)', 'Flow (L/min)', 'Volume (mL)']),
    )
    expect(texts).toEqual(expect.arrayContaining(['60', '-60', '0']))
    fireEvent.click(screen.getByRole('button', { name: 'Fixed across every offered setting' }))
    expect([...svg.querySelectorAll('text')].map((node) => node.textContent)).toContain('400')
  })
})

/* ------------------------------------------------------------------------------------------------
 * Sampling integrity (S1-4, V3) and S2-1
 * ---------------------------------------------------------------------------------------------- */

describe('sampling: a captured record keeps what the engine sampled', () => {
  it('keeps every 20 ms sample, extrema and boundaries (fails on the base)', () => {
    const simulation = createLabSimulation('waveform-anatomy', 0, DEVICE)
    const snapshot = labSnapshot(simulation)
    expect(snapshot.waveforms).toHaveLength(simulation.waveforms.length)
    const gaps = snapshot.waveforms.slice(1).map((s, i) => s.time - snapshot.waveforms[i].time)
    expect(Math.max(...gaps)).toBeCloseTo(0.02, 6)
    const peak = (samples: readonly { pawCmH2O: number }[]) =>
      Math.max(...samples.map((s) => s.pawCmH2O))
    expect(peak(snapshot.waveforms)).toBe(peak(simulation.waveforms))
    // Onset-to-onset on a 20 ms grid is within one sample of the 3.75-s cycle, not 3.68 s.
    const breath = completedBreath(snapshot.waveforms)
    const period = 60 / simulation.ventilator.settings.ratePerMin
    expect(Math.abs(breath.at(-1)!.time - breath[0].time - period)).toBeLessThanOrEqual(0.0201)
  })

  it('labels a measured duration with the spacing it was measured at', () => {
    const ready = runFor(
      session(
        'waveform-anatomy',
        { type: 'START_EXPERIMENT' },
        engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 }),
      ),
      12.2,
    )
    const captured = learningLabReducer(ready, { type: 'COMPARE' })
    render(<RecordedBreathComparison evidence={captured.evidence[0]} />)
    const notes = [...document.querySelectorAll('[data-breath-duration]')]
    expect(notes).toHaveLength(2)
    for (const note of notes) {
      expect(note.getAttribute('data-sample-spacing')).toBe('0.020')
      expect(note.textContent).toMatch(/samples every 20 ms/)
    }
  })

  it('S2-1: explains 413 or 427 mL beside 420 mL from the delivery steps, without forcing equality', () => {
    const baseline = createLabSimulation('waveform-anatomy', 0, DEVICE)
    expect(baseline.ventilator.settings.vtMl).toBe(420)
    expect([413, 427]).toContain(baseline.measurements.exhaledVtMl)
    expect(deliveredVolumeStepNote(baseline)).toMatch(/31 or 32 steps — about 413 or 427 mL/)
    // Breath to breath the engine alternates; the display does not round either one to 420.
    const volumes = new Set<number>()
    let running = { ...baseline, paused: false }
    for (let t = 0; t < 30; t += 0.5) {
      running = advanceSimulation(running, 0.5)
      volumes.add(running.measurements.exhaledVtMl)
    }
    expect([...volumes].sort()).toEqual([413, 427])
    let faster = ventilationSimulationReducer(baseline, {
      type: 'SET_CONTROL',
      control: 'peakFlowLMin',
      value: 60,
    })
    faster = advanceSimulation({ ...faster, paused: false }, 12)
    expect(faster.measurements.exhaledVtMl).toBe(420)
    expect(deliveredVolumeStepNote(faster)).toBeNull()
  })

  it('S2-1: the worked "at the cursor in the inspiratory interval" sentence sits beside such a cursor', () => {
    mount('waveform-anatomy')
    const worked = () => document.querySelector('[data-worked-reading]')
    const cursor = () =>
      [...document.querySelectorAll('[data-lesson] [data-captured-breath] p')]
        .map((node) => node.textContent ?? '')
        .find((text) => text.startsWith('Cursor at'))
    // The walk opens on Trigger, cursor 0.00 s: the sentence is not printed beside it.
    expect(cursor()).toMatch(/^Cursor at 0\.00 s/)
    expect(worked()).toBeNull()
    expect(document.querySelector('[data-worked-reading-stop="inspiration"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Inspiration/ }))
    expect(worked()?.textContent).toMatch(/At the cursor in the inspiratory interval/)
    expect(cursor()).not.toMatch(/^Cursor at 0\.00 s/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * V3 — overlay and inspiration zoom as display operations
 * ---------------------------------------------------------------------------------------------- */

describe('V3: baseline and result, overlaid or zoomed without retiming', () => {
  const captured = () => {
    const ready = runFor(
      session(
        'waveform-anatomy',
        { type: 'START_EXPERIMENT' },
        engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 }),
      ),
      12.2,
    )
    return learningLabReducer(ready, { type: 'COMPARE' }).evidence[0]
  }

  it('zooms both breaths to the same seconds and says so', () => {
    const evidence = captured()
    render(<RecordedBreathComparison evidence={evidence} />)
    const durations = [...document.querySelectorAll('[data-breath-duration]')].map((node) =>
      node.getAttribute('data-breath-duration'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    expect(screen.getByRole('button', { name: 'Show the whole breath' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const windows = [...document.querySelectorAll('[data-zoom-window]')].map(
      (node) => node.textContent,
    )
    expect(windows).toHaveLength(2)
    expect(new Set(windows.map((text) => text?.match(/Showing ([\d.]+–[\d.]+) s/)?.[1])).size).toBe(
      1,
    )
    // A crop, not a stretch: each breath still reports its own measured duration.
    expect(
      [...document.querySelectorAll('[data-breath-duration]')].map((node) =>
        node.getAttribute('data-breath-duration'),
      ),
    ).toEqual(durations)
    expect(document.querySelector('[data-zoom-bounds]')?.textContent).toMatch(/nothing is retimed/)
  })

  it('overlays on shared axes with a named, non-colour legend and a numerical description', () => {
    const evidence = captured()
    render(<RecordedBreathComparison evidence={evidence} />)
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    const overlay = document.querySelector('[data-breath-overlay]')!
    expect(overlay.querySelectorAll('[data-overlay-trace="baseline"]')).toHaveLength(3)
    expect(overlay.querySelectorAll('[data-overlay-trace="result"]')).toHaveLength(3)
    expect(overlay.textContent).toMatch(/Baseline \(dashed\) and result \(solid\)/)
    const description = document.querySelector('[data-comparison-description]')!.textContent
    expect(description).toMatch(
      /Baseline breath drawn above: inspiratory flow over 3[12] samples \(0\.6[24] s\)/,
    )
    expect(description).toMatch(
      /Result breath drawn above: inspiratory flow over 21 samples \(0\.42 s\)/,
    )
    expect(description).toMatch(/not all taken from the drawn\s+breath/)
  })

  it('changes no evidence when the view changes', () => {
    const evidence = captured()
    const before = JSON.stringify(evidence)
    render(<RecordedBreathComparison evidence={evidence} />)
    fireEvent.click(screen.getByRole('button', { name: 'Overlay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to inspiration' }))
    expect(JSON.stringify(evidence)).toBe(before)
  })
})

/* ------------------------------------------------------------------------------------------------
 * S7-2 — the effort row where the instruction reads it
 * ---------------------------------------------------------------------------------------------- */

describe('S7-2: the model effort row is drawn and named where the task reads it', () => {
  it.each([5, 6])('Section 7 step %i', (index) => {
    mount('expiration-and-air-trapping')
    chooseStep(index)
    const figure = document.querySelector('[data-task-workbench] [data-captured-breath] svg')!
    const labels = [...figure.querySelectorAll('text')].map((node) => node.textContent)
    expect(labels).toContain('Effort · model (cmH₂O)')
    expect(labels).toContain('Airway pressure (cmH₂O)')
  })
})

/* ------------------------------------------------------------------------------------------------
 * V4 — the plateau's state in words, and two-digit values on one line, on all four facsimiles
 * ---------------------------------------------------------------------------------------------- */

describe('V4: plateau status and two-digit PEEP on the four consoles', () => {
  const passive = () => createLabSimulation('mechanics-load-and-pressure', 0, DEVICE)
  const hold = (state: ReturnType<typeof passive>) =>
    ventilationSimulationReducer(
      { ...state, paused: false },
      { type: 'PERFORM_HOLD', hold: 'inspiratory' },
    )
  const valid = () => advanceSimulation(hold(passive()), 5)
  const states = {
    estimate: () => createInitialSimulationState('MV-01', 'practice', 1, DEVICE),
    'hold running': () => hold(passive()),
    measured: valid,
    'not valid': () =>
      advanceSimulation(hold(createInitialSimulationState('MV-13', 'practice', 1, DEVICE)), 5),
    outdated: () =>
      ventilationSimulationReducer(valid(), {
        type: 'SET_CONTROL',
        control: 'peepCmH2O',
        value: valid().ventilator.settings.peepCmH2O + 4,
      }),
  } as const

  it.each(Object.keys(states) as (keyof typeof states)[])(
    'prints "%s" from the acquisition projection on every console, never a bare "?"',
    (word) => {
      const state = states[word]()
      for (const device of ventilatorDeviceIds) {
        const shown = { ...state, deviceId: device, paused: true }
        const before = JSON.stringify(shown)
        const { container, unmount } = render(
          <MechanicalVentilatorConsole state={shown} dispatch={jest.fn()} controlsEnabled />,
        )
        expect(container.querySelector('[data-device]')!.getAttribute('data-device')).toBe(device)
        const row = container.querySelector(`[data-readout-status="${word}"]`)
        expect(row).not.toBeNull()
        expect(row!.querySelector('dd[title]')?.getAttribute('title')).toBe(
          plateauAcquisition(shown).detail,
        )
        expect(container.querySelector('dd em')).toBeNull()
        expect(container.textContent).not.toMatch(/\d\?/)
        // Rendering a facsimile changes nothing about the patient.
        expect(JSON.stringify(shown)).toBe(before)
        unmount()
      }
    },
  )

  it('keeps a two-digit PEEP value on one line and lets the label column grow with root text', () => {
    const state = createInitialSimulationState('MV-14', 'practice', 1, DEVICE)
    expect(state.ventilator.settings.peepCmH2O).toBeGreaterThanOrEqual(10)
    const css = readFileSync(
      path.join(__dirname, '..', 'components', 'mechanical-ventilation.module.css'),
      'utf8',
    )
    const rule = css.slice(css.indexOf('.waveformReadouts dd {'))
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/white-space:\s*nowrap/)
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/overflow-wrap:\s*normal/)
    const figure = css.slice(css.indexOf('.waveformFigure {'))
    expect(figure.slice(0, figure.indexOf('}'))).toMatch(/grid-template-columns:\s*5\.75rem/)
  })
})

/* ------------------------------------------------------------------------------------------------
 * V2 — module-local dark surfaces; a labelled reading-sequence figure
 * ---------------------------------------------------------------------------------------------- */

describe('V2: no bright islands in the dark Learn flow', () => {
  const read = (...parts: string[]) =>
    readFileSync(path.join(__dirname, '..', 'components', ...parts), 'utf8')
  const luminance = (hex: string) => {
    const full = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  it('paints every mechanism-panel surface dark', () => {
    const css = read('mechanical-ventilation-teaching.module.css')
    // Surfaces only: a pressed toggle keeps its bright fill (with dark text) as the selection cue.
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(
      ([, selector]) => !selector.includes("aria-pressed='true'"),
    )
    const backgrounds = rules.flatMap(([, , body]) =>
      [...body.matchAll(/background:\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => m[1]),
    )
    expect(backgrounds.length).toBeGreaterThan(10)
    for (const hex of backgrounds) expect(luminance(hex)).toBeLessThan(0.45)
  })

  it('gives the question, patient-status and reference cards dark values inside the flow', () => {
    const css = read('stage', 'task-flow.module.css')
    const block = (selector: string) => {
      const start = css.indexOf(selector + ' {')
      return css.slice(start, css.indexOf('}', start))
    }
    expect(block('.flow [data-reinforcement]')).toMatch(/color-scheme:\s*dark/)
    expect(block('.flow [data-reinforcement]')).toMatch(/background:\s*#0f2429/)
    expect(block('.flow [data-bedside-panel]')).toMatch(/--surface:\s*#10262b/)
    expect(block(".flow [aria-label='Adult ARDS guideline reference']")).toMatch(
      /background:\s*#10262b/,
    )
  })

  it('names every row of the reading-sequence figure with its unit and scale', () => {
    const state = createInitialSimulationState('MV-02', 'learn', 1, DEVICE)
    render(<VentilationWaveformReadingSequence state={state} />)
    const figure = document.querySelector('[data-reading-sequence-figure]')!
    const texts = [...figure.querySelectorAll('svg text')].map((node) => node.textContent)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Pressure (cmH₂O)',
        'Flow (L/min)',
        'Volume (mL)',
        'Patient effort · model (cmH₂O)',
        '45',
        '-80',
        '800',
      ]),
    )
    expect(figure.querySelectorAll('[data-reading-row]')).toHaveLength(4)
  })
})

/* ------------------------------------------------------------------------------------------------
 * B2 — the pathway accordion does not move under the pointer after hydration
 * ---------------------------------------------------------------------------------------------- */

describe('B2: the pathway accordion before and after stored progress is read', () => {
  it('opens nothing and marks nothing until progress is read, then never collapses a group', () => {
    localStorage.setItem(
      VENTILATION_SELF_PACED_KEY,
      JSON.stringify({
        version: 1,
        visited: ventilationLearningUnits.slice(0, 5).map((unit) => unit.id),
        location: { section: 'learn', id: ventilationLearningUnits[4].id, step: 3 },
      }),
    )
    render(<MechanicalVentilationLearnLanding />)
    const open = () =>
      [...document.querySelectorAll('[data-pathway-accordion] details')].map((d) =>
        (d as HTMLDetailsElement).open ? 1 : 0,
      )
    // Fails on the base: stage 1 opened with Section 1 marked "Up next" before storage was read.
    expect(open().every((value) => value === 0)).toBe(true)
    expect(document.querySelector('[data-pathway-accordion] [data-recommended="true"]')).toBeNull()
    boot()
    const afterRead = open()
    expect(afterRead.filter(Boolean)).toHaveLength(1)
    expect(afterRead[0]).toBe(0)
    // A later progress change does not collapse the group under the learner's pointer.
    act(() => {
      localStorage.setItem(
        VENTILATION_SELF_PACED_KEY,
        JSON.stringify({
          version: 1,
          visited: ventilationLearningUnits.slice(0, 9).map((unit) => unit.id),
          location: { section: 'learn', id: ventilationLearningUnits[8].id, step: 1 },
        }),
      )
      window.dispatchEvent(new Event(VENTILATION_SELF_PACED_KEY))
    })
    expect(open()).toEqual(afterRead)
  })
})

/* ------------------------------------------------------------------------------------------------
 * Batch 01 / 02 identities are consumed, not rebuilt
 * ---------------------------------------------------------------------------------------------- */

describe('earlier contracts survive the new workbench', () => {
  it('reading, revealing and navigating record no run, capture or action', () => {
    mount('mechanics-load-and-pressure')
    for (const button of screen.getAllByRole('button', { name: 'Show explanation' }))
      fireEvent.click(button)
    fireEvent.click(screen.getAllByText('More detail')[0])
    chooseStep(ventilationStageLesson('mechanics-load-and-pressure').steps.length - 1)
    expect(screen.getByText(/No response has been captured/)).toBeInTheDocument()
    expect(document.querySelector('[data-captured-result]')).toBeNull()
  })

  it('every live case still opens on an estimate, never an acquired plateau', () => {
    for (const caseId of mechanicalVentilationCaseById.keys())
      expect(
        plateauAcquisition(createInitialSimulationState(caseId, 'practice', 1, DEVICE)).status,
      ).toBe('reference-estimate')
  })
})
