import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { WaveformStrip } from '../components/WaveformStrip'
import { hemodynamicCases } from '../content'
import { displaySeamWords } from '../engine/displaySeams'
import { monitorPressureReadouts } from '../engine/monitorDisplay'
import { createInitialHemodynamicState } from '../engine/simulation'
import { cleanState, reduceAll } from '../engine/stageRuntime'
import type { HemodynamicSimulationState, HemodynamicWaveformSample } from '../engine/types'

afterEach(cleanup)

/**
 * HD-PRE-REVIEW-03 — the sanity-review repair.
 *
 * Three of the independent review's four defects are in what the monitor draws and says, and are
 * asserted here from the DOM: which samples a trace segment joins, whether a held copy keeps the
 * break the live strip drew, and what a refitted axis claims about the pressure. Each test fails on
 * the reviewed head (`cf34ce14`). The fourth defect is a layout measurement and lives in
 * `e2e/icu-hemodynamics-pre-review-03-repair.spec.ts`.
 */

const VIEW_WIDTH = 1000
const TRACE_TOP = 6
const TRACE_BOTTOM = 98

type Point = readonly [x: number, y: number]

function pointsOf(polyline: Element): Point[] {
  return polyline
    .getAttribute('points')!
    .split(' ')
    .map((pair) => pair.split(',').map(Number) as unknown as Point)
}

function traces(scope: ParentNode, kind: 'earlier' | 'current'): Point[][] {
  return [...scope.querySelectorAll(`polyline[data-strip-trace="${kind}"]`)].map(pointsOf)
}

/** The strip's own mapping, restated so a point can be traced back to the sample it was drawn from. */
function expectedPoint(
  sample: HemodynamicWaveformSample,
  window: readonly HemodynamicWaveformSample[],
  axis: { readonly minimum: number; readonly maximum: number },
  field: 'papMmHg' | 'artMmHg' = 'papMmHg',
): Point {
  const first = window[0].time
  const duration = Math.max(0.02, window.at(-1)!.time - first)
  const x = ((sample.time - first) / duration) * VIEW_WIDTH
  const y =
    TRACE_BOTTOM -
    ((sample[field] - axis.minimum) / (axis.maximum - axis.minimum)) * (TRACE_BOTTOM - TRACE_TOP)
  return [Number(x.toFixed(1)), Number(y.toFixed(1))]
}

function sweepWindow(state: HemodynamicSimulationState, seconds = state.sweepSeconds) {
  const latest = state.waveforms.at(-1)!.time
  return state.waveforms.filter((sample) => sample.time >= latest - seconds)
}

/** A transducer lowered 10 cm, then just long enough for the change to be on the strip. */
function leveledMidSweep() {
  const before = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 1 }])
  const changed = reduceAll(before, [{ type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 }])
  const after = reduceAll(changed, [{ type: 'TICK', seconds: 0.2 }])
  return { before, changed, after }
}

function stripWithStateSeams(
  state: HemodynamicSimulationState,
  axis: { readonly minimum: number; readonly maximum: number },
) {
  return render(
    <WaveformStrip
      samples={state.waveforms}
      field="papMmHg"
      label="PAP"
      unit="mmHg"
      minimum={axis.minimum}
      maximum={axis.maximum}
      color="#ffd166"
      sweepSeconds={state.sweepSeconds}
      showScale
      seams={(state.displaySeams ?? []).map((seam) => ({
        fromTime: seam.fromSeconds,
        untilTime: seam.untilSeconds,
        label: displaySeamWords(seam),
      }))}
    />,
  )
}

/* ------------------------------------------------------------------ *
 * 1 · L2-06 — the sample on the boundary belongs to the earlier setting
 * ------------------------------------------------------------------ */

describe('the sample acquired before an action is not drawn as the action’s result (L2-06)', () => {
  const axis = { minimum: -10, maximum: 60 }

  it('the engine’s boundary sample is the last one generated under the earlier setting', () => {
    const { before, changed, after } = leveledMidSweep()
    const seam = after.displaySeams!.at(-1)!
    // The action takes no model time: the newest sample in the buffer predates it.
    expect(changed.timeSeconds).toBe(before.timeSeconds)
    expect(seam.untilSeconds).toBe(before.waveforms.at(-1)!.time)
    expect(changed.waveforms.at(-1)).toEqual(before.waveforms.at(-1))
    const boundary = after.waveforms.find((sample) => sample.time === seam.untilSeconds)!
    expect(boundary.papMmHg).toBe(before.waveforms.at(-1)!.papMmHg)
  })

  it('ends the earlier trace on the boundary sample and starts the current one after it', () => {
    const { after } = leveledMidSweep()
    const seamTime = after.displaySeams!.at(-1)!.untilSeconds
    const window = sweepWindow(after)
    const { container } = stripWithStateSeams(after, axis)

    const earlier = traces(container, 'earlier')
    const current = traces(container, 'current')
    expect(earlier).toHaveLength(1)
    expect(current).toHaveLength(1)

    const old = window.filter((sample) => sample.time <= seamTime)
    const fresh = window.filter((sample) => sample.time > seamTime)
    // Every sample is drawn once, on its own side of the change.
    expect(earlier[0]).toEqual(old.map((sample) => expectedPoint(sample, window, axis)))
    expect(current[0]).toEqual(fresh.map((sample) => expectedPoint(sample, window, axis)))
    // The reviewed head began the current trace on the boundary sample: one point too many, and a
    // line from the earlier setting's last pressure to the new setting's first.
    expect(current[0][0][0]).toBeGreaterThan(expectedPoint(old.at(-1)!, window, axis)[0])
  })

  it('draws no line across the step the change produced', () => {
    const { before, after } = leveledMidSweep()
    const seamTime = after.displaySeams!.at(-1)!.untilSeconds
    const lastOld = before.waveforms.at(-1)!
    const firstNew = after.waveforms.find((sample) => sample.time > seamTime)!
    // Lowering the transducer 10 cm raises every reading by about 7 mmHg: a real step in the data.
    expect(firstNew.papMmHg - lastOld.papMmHg).toBeGreaterThan(5)
    const stepPx = Math.abs(
      expectedPoint(firstNew, [lastOld, firstNew], axis)[1] -
        expectedPoint(lastOld, [lastOld, firstNew], axis)[1],
    )
    const { container } = stripWithStateSeams(after, axis)
    for (const trace of [...traces(container, 'earlier'), ...traces(container, 'current')]) {
      for (let index = 1; index < trace.length; index += 1) {
        // One 20 ms sample apart inside a setting; the instrument's step is several times that.
        expect(Math.abs(trace[index][1] - trace[index - 1][1])).toBeLessThan(stepPx * 0.75)
      }
    }
  })

  it('holds for the monitor’s own strip, on the arterial line as well', () => {
    const { before, after } = leveledMidSweep()
    const seamTime = after.displaySeams!.at(-1)!.untilSeconds
    for (const focus of ['pac', 'arterial'] as const) {
      const { container } = render(
        <BedsideMonitor
          state={after}
          dispatch={jest.fn()}
          focus={focus}
          comparisonBaseline={before}
        />,
      )
      const field = focus === 'pac' ? 'papMmHg' : 'artMmHg'
      const strip = container.querySelector(`[data-waveform-strip="${field}"]`)!
      const window = sweepWindow(after)
      const fresh = window.filter((sample) => sample.time > seamTime)
      const current = traces(strip, 'current')
      expect(current).toHaveLength(1)
      expect(current[0]).toHaveLength(fresh.length)
      const firstFreshX =
        ((fresh[0].time - window[0].time) / (window.at(-1)!.time - window[0].time)) * VIEW_WIDTH
      expect(current[0][0][0]).toBeCloseTo(firstFreshX, 1)
      cleanup()
    }
  })

  it('leaves out every sample drawn while a control was still being moved', () => {
    const start = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 1 }])
    const dragged = reduceAll(start, [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -4 },
      { type: 'TICK', seconds: 0.3 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -8 },
      { type: 'TICK', seconds: 0.3 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -12 },
      { type: 'TICK', seconds: 0.4 },
    ])
    expect(dragged.displaySeams).toHaveLength(1)
    const seam = dragged.displaySeams![0]
    expect(seam.untilSeconds - seam.fromSeconds).toBeCloseTo(0.6, 5)
    const window = sweepWindow(dragged)
    const { container } = stripWithStateSeams(dragged, axis)
    const earlier = traces(container, 'earlier')
    const current = traces(container, 'current')
    // Before the first change, and after the last: nothing from the two settings in between,
    // including the sample that was on the screen when the last change was made.
    expect(earlier[0]).toEqual(
      window
        .filter((sample) => sample.time <= seam.fromSeconds)
        .map((sample) => expectedPoint(sample, window, axis)),
    )
    expect(current[0]).toEqual(
      window
        .filter((sample) => sample.time > seam.untilSeconds)
        .map((sample) => expectedPoint(sample, window, axis)),
    )
  })

  it('still draws an unbroken trace when nothing changed', () => {
    const state = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 2 }])
    const { container } = stripWithStateSeams(state, axis)
    expect(traces(container, 'earlier')).toHaveLength(0)
    expect(traces(container, 'current')).toEqual([
      sweepWindow(state).map((sample) => expectedPoint(sample, sweepWindow(state), axis)),
    ])
  })
})

/* ------------------------------------------------------------------ *
 * 2 · L5-05 — a held copy keeps the break the live strip drew
 * ------------------------------------------------------------------ */

describe('a held copy keeps the seam of the samples it copied (L5-05)', () => {
  function hold() {
    fireEvent.click(screen.getByRole('button', { name: 'Hold and enlarge the last two beats' }))
    return document.querySelector('[data-held-view]') as HTMLElement
  }

  it('breaks, dims and names the change inside the two held beats', () => {
    const { before, after } = leveledMidSweep()
    const seam = after.displaySeams!.at(-1)!
    render(
      <BedsideMonitor state={after} dispatch={jest.fn()} focus="pac" comparisonBaseline={before} />,
    )
    // The live strip shows the change …
    expect(
      document.querySelectorAll('[data-waveform-strip="papMmHg"] [data-strip-seam]'),
    ).toHaveLength(1)
    const held = hold()
    // … and so does the copy of those samples.
    expect(held.querySelectorAll('[data-strip-seam]')).toHaveLength(1)
    expect(held.querySelector('[data-strip-marker="seam"]')?.textContent).toBe(
      'transducer height changed',
    )
    const earlier = traces(held, 'earlier')
    const current = traces(held, 'current')
    expect(earlier).toHaveLength(1)
    expect(current).toHaveLength(1)

    const heldAt = after.waveforms.at(-1)!.time
    const cycle = 60 / after.measurements.heartRateBpm
    const window = after.waveforms.filter((sample) => sample.time >= heldAt - 2 * cycle)
    // Nothing is lost to the break: every held sample is still drawn, on its own side of it.
    expect(earlier[0]).toHaveLength(
      window.filter((sample) => sample.time <= seam.untilSeconds).length,
    )
    expect(current[0]).toHaveLength(
      window.filter((sample) => sample.time > seam.untilSeconds).length,
    )
    expect(earlier[0].length + current[0].length).toBe(window.length)
    // Said in words as well as drawn: in the note and in the image's own description.
    expect(held.querySelector('[data-held-view-seam]')?.textContent).toMatch(
      /These two beats cross a change.*transducer height changed at \d+\.\d s.*not joined/,
    )
    expect(held.querySelector('svg')?.getAttribute('aria-label')).toMatch(
      /transducer height changed; the tracing before that marker was drawn under the earlier setting/,
    )
  })

  it('says a copy taken at the moment of the change ends there, and holds nothing drawn after it', () => {
    const { before, changed } = leveledMidSweep()
    // No model time has passed since the transducer was moved: every sample predates it.
    expect(changed.waveforms.at(-1)!.time).toBe(changed.displaySeams!.at(-1)!.untilSeconds)
    render(
      <BedsideMonitor
        state={changed}
        dispatch={jest.fn()}
        focus="pac"
        comparisonBaseline={before}
      />,
    )
    const held = hold()
    expect(held.querySelectorAll('[data-strip-seam]')).toHaveLength(1)
    expect(traces(held, 'earlier')).toHaveLength(1)
    expect(traces(held, 'current')).toHaveLength(0)
    const note = held.querySelector('[data-held-view-seam]')!.textContent!
    expect(note).toMatch(/These two beats end at a change in the measurement system/)
    expect(note).toMatch(/All of this copy was drawn under the earlier setting/)
    expect(note).not.toMatch(/the part after/)
  })

  it('keeps the seam after the live monitor has scrolled it away, and takes none it did not copy', () => {
    const { before, after } = leveledMidSweep()
    const dispatch = jest.fn()
    const { rerender } = render(
      <BedsideMonitor state={after} dispatch={dispatch} focus="pac" comparisonBaseline={before} />,
    )
    const held = hold()
    const drawn = [...held.querySelectorAll('polyline[data-strip-trace]')].map((node) =>
      node.getAttribute('points'),
    )
    // Twenty seconds on, with a second change the copy never saw.
    const later = reduceAll(after, [
      { type: 'TICK', seconds: 20 },
      { type: 'SET_DAMPING', dampingRatio: 1.4 },
      { type: 'TICK', seconds: 0.5 },
    ])
    // The engine has dropped the first seam and recorded only the one the copy predates.
    expect(later.displaySeams!.map((seam) => seam.kind)).toEqual(['line-response'])
    rerender(
      <BedsideMonitor state={later} dispatch={dispatch} focus="pac" comparisonBaseline={before} />,
    )
    const still = document.querySelector('[data-held-view]') as HTMLElement
    expect(still.querySelectorAll('[data-strip-seam]')).toHaveLength(1)
    expect(still.querySelector('[data-strip-marker="seam"]')?.textContent).toBe(
      'transducer height changed',
    )
    expect(
      [...still.querySelectorAll('polyline[data-strip-trace]')].map((node) =>
        node.getAttribute('points'),
      ),
    ).toEqual(drawn)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('copies the arterial strip’s seams for an arterial hold, and only those', () => {
    const start = reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 1 }])
    const arterialOnly = reduceAll(start, [
      { type: 'SET_DAMPING', dampingRatio: 1.4, line: 'systemic-arterial' },
      { type: 'TICK', seconds: 0.2 },
    ])
    expect(arterialOnly.displaySeams?.map((seam) => seam.scope)).toEqual(['systemic-arterial-line'])
    render(<BedsideMonitor state={arterialOnly} dispatch={jest.fn()} focus="arterial" />)
    expect(hold().querySelector('[data-strip-marker="seam"]')?.textContent).toBe(
      'arterial line response changed',
    )
    cleanup()
    // The catheter's channel was not touched by that change, live or held.
    render(<BedsideMonitor state={arterialOnly} dispatch={jest.fn()} focus="pac" />)
    expect(
      document.querySelectorAll('[data-waveform-strip="papMmHg"] [data-strip-seam]'),
    ).toHaveLength(0)
    const held = hold()
    expect(held.querySelectorAll('[data-strip-seam]')).toHaveLength(0)
    expect(held.querySelector('[data-held-view-seam]')).toBeNull()
  })

  it('says nothing about a change when the held beats hold none', () => {
    const state = reduceAll(cleanState(510, 'ra'), [{ type: 'TICK', seconds: 2 }])
    render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
    const held = hold()
    expect(held.querySelectorAll('[data-strip-seam]')).toHaveLength(0)
    expect(held.querySelector('[data-held-view-seam]')).toBeNull()
    expect(traces(held, 'earlier')).toHaveLength(0)
    // A change that had already left the two held beats is not reported on them either.
    cleanup()
    const { before, after } = leveledMidSweep()
    const settled = reduceAll(after, [{ type: 'TICK', seconds: 4 }])
    render(
      <BedsideMonitor
        state={settled}
        dispatch={jest.fn()}
        focus="pac"
        comparisonBaseline={before}
      />,
    )
    expect(
      document.querySelectorAll('[data-waveform-strip="papMmHg"] [data-strip-seam]'),
    ).toHaveLength(1)
    const later = hold()
    expect(later.querySelectorAll('[data-strip-seam]')).toHaveLength(0)
    expect(later.querySelector('[data-held-view-seam]')).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * 3 · L2-06 — a refitted axis makes no claim about the pressure
 * ------------------------------------------------------------------ */

describe('the axis-change notice does not say what the pressure did (L2-06)', () => {
  const notice = () => document.querySelector('[data-scale-change-note]')?.textContent ?? null

  it('reports a refit after a case intervention that moved the pressure, without denying it', () => {
    const rows: { id: string; notice: string; displayedMoved: boolean }[] = []
    for (const definition of hemodynamicCases) {
      for (const intervention of definition.interventions) {
        const before = createInitialHemodynamicState(definition, 'practice', 501)
        const after = reduceAll(before, [
          { type: 'APPLY_INTERVENTION', intervention },
          { type: 'TICK', seconds: 45 },
        ])
        const { rerender, unmount } = render(<BedsideMonitor state={before} dispatch={jest.fn()} />)
        rerender(<BedsideMonitor state={after} dispatch={jest.fn()} />)
        const text = notice()
        if (text) {
          const was = monitorPressureReadouts(before)
          const now = monitorPressureReadouts(after)
          rows.push({
            id: `${definition.id}:${intervention.id}`,
            notice: text,
            displayedMoved:
              was.rightAtrial.displayedMmHg !== now.rightAtrial.displayedMmHg ||
              before.measurements.papSystolicMmHg !== after.measurements.papSystolicMmHg ||
              before.measurements.rapMmHg !== after.measurements.rapMmHg,
          })
        }
        unmount()
      }
    }
    // The reviewed head produced these notices too, each ending "the pressure did not".
    expect(rows.map((row) => row.id)).toEqual(
      expect.arrayContaining(['HD-02:fluid-250', 'HD-07:pericardial-drainage']),
    )
    for (const row of rows) {
      // In every one of them the model's pressure had in fact moved.
      expect(row.displayedMoved).toBe(true)
      expect(row.notice).toMatch(/Axis changed from -?\d+ to \d+ mmHg to -?\d+ to \d+ mmHg\./)
      expect(row.notice).not.toMatch(/pressure did not|did not change|unchanged/i)
    }
  })

  it('makes the same statement when only the transducer moved', () => {
    const state = cleanState(510, 'pa')
    const { rerender } = render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
    expect(notice()).toBeNull()
    const lowered = reduceAll(state, [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -14 },
      { type: 'TICK', seconds: 2 },
    ])
    rerender(<BedsideMonitor state={lowered} dispatch={jest.fn()} focus="pac" />)
    expect(notice()).toBe(
      'Axis changed from 0 to 40 mmHg to 0 to 80 mmHg. The monitor refits this axis to the pressure it is displaying, so the same height on the strip now stands for a different pressure. Read a change from the axis numbers and the readout, not from the size of the tracing.',
    )
  })

  it('tells the learner how to read the strip instead: by its numbers', () => {
    const definition = hemodynamicCases.find((entry) => entry.id === 'HD-07')!
    const drainage = definition.interventions.find((entry) => entry.id === 'pericardial-drainage')!
    const before = createInitialHemodynamicState(definition, 'practice', 501)
    const after = reduceAll(before, [
      { type: 'APPLY_INTERVENTION', intervention: drainage },
      { type: 'TICK', seconds: 45 },
    ])
    // A real fall in right-atrial pressure, which the reviewed head described as no change.
    expect(before.measurements.rapMmHg - after.measurements.rapMmHg).toBeGreaterThan(10)
    const { rerender } = render(<BedsideMonitor state={before} dispatch={jest.fn()} />)
    rerender(<BedsideMonitor state={after} dispatch={jest.fn()} />)
    expect(notice()).toMatch(/^CVP: Axis changed from -5 to 40 mmHg to -5 to 20 mmHg\./)
    expect(notice()).toMatch(/Read a change from the axis numbers and the readout/)
  })
})
