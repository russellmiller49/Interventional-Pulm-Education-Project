import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { DynamicResponseComparison, FastFlushTrace } from '../components/FastFlushTrace'
import { LevelingVisual } from '../components/LevelingVisual'
import { NormalWaveformReference } from '../components/NormalWaveformReference'
import { PacComponentSchematic } from '../components/NormalWaveformAnatomyFigure'
import { WaveformAtlasFigure } from '../components/WaveformAtlasFigure'
import { WaveformStrip } from '../components/WaveformStrip'
import { estimateLabelWidthPx, layoutLabels } from '../components/waveformLabelLayout'
import { waveformAtlasById } from '../content/waveformAtlas'
import {
  fittedPressureAxis,
  mixedVenousAvailability,
  referenceComparisonAxis,
  RIGHT_ATRIAL_C_WAVE_BASE_PHASE,
} from '../engine/monitorDisplay'
import { fixedWithoutNegativeZero } from '../engine/numberFormat'
import { END_EXPIRATION_TOLERANCE_PHASE, unroundedModelEstimates } from '../engine/simulation'
import { capstoneState, cleanState, reduceAll } from '../engine/stageRuntime'
import type { HemodynamicSimulationState } from '../engine/types'

afterEach(cleanup)

/**
 * HD-PRE-REVIEW-03 — the renderers.
 *
 * Geometry is asserted from the DOM the components produce: the coordinates a path is drawn at,
 * where a label is placed, which landmark a leader line starts from. A screenshot can look right
 * while a label points at the wrong sample; these cannot.
 */

function percent(value: string | undefined): number {
  return Number((value ?? '').replace('%', ''))
}

/* ------------------------------------------------------------------ *
 * Screen-space label layout
 * ------------------------------------------------------------------ */

describe('label layout', () => {
  const labels = (texts: readonly [string, number][], fontPx = 13.6) =>
    texts.map(([text, anchorPx]) => ({
      id: text,
      anchorPx,
      widthPx: estimateLabelWidthPx(text, fontPx),
    }))

  it('never overlaps two labels in a track and keeps every label inside the plot', () => {
    for (const available of [900, 520, 300, 230, 180]) {
      const requests = labels([
        ['rapid fall', available * 0.49],
        ['up-sloping diastole', available * 0.58],
        ['RVEDP', available * 0.66],
      ])
      const { labels: placed, rows } = layoutLabels(requests, available)
      expect(placed).toHaveLength(3)
      for (let row = 0; row < rows; row += 1) {
        const inRow = placed
          .filter((label) => label.row === row)
          .sort((a, b) => a.leftPx - b.leftPx)
        inRow.forEach((label, index) => {
          expect(label.leftPx).toBeGreaterThanOrEqual(0)
          if (label.widthPx <= available) {
            expect(label.leftPx + label.widthPx).toBeLessThanOrEqual(available + 0.001)
          }
          if (index > 0) {
            const previous = inRow[index - 1]
            expect(label.leftPx).toBeGreaterThanOrEqual(previous.leftPx + previous.widthPx)
          }
        })
      }
    }
  })

  it('uses one track when there is room and adds tracks only when there is not', () => {
    const wide = layoutLabels(
      labels([
        ['a', 100],
        ['c', 160],
        ['v', 400],
      ]),
      800,
    )
    expect(wide.rows).toBe(1)
    const narrow = layoutLabels(
      labels([
        ['rapid fall', 90],
        ['up-sloping diastole', 110],
        ['RVEDP', 130],
      ]),
      200,
    )
    expect(narrow.rows).toBeGreaterThan(1)
  })

  it('leaves a label on its landmark when nothing crowds it', () => {
    const [request] = labels([['RVSP', 300]])
    const { labels: placed } = layoutLabels([request], 800)
    expect(placed[0].leftPx + placed[0].widthPx / 2).toBeCloseTo(300, 5)
  })
})

/* ------------------------------------------------------------------ *
 * Reference figures
 * ------------------------------------------------------------------ */

function figureGeometry(container: HTMLElement) {
  const svg = container.querySelector('svg')!
  const [, , viewWidth, viewHeight] = svg.getAttribute('viewBox')!.split(' ').map(Number)
  const lane = container.querySelector('g[data-atlas-lane="pressure"]')!
  const plotShift = Number(/translate\(0 (-?[\d.]+)\)/.exec(lane.getAttribute('transform')!)![1])
  return {
    svg,
    viewWidth,
    viewHeight,
    plotShift,
    plotTop: 66 + plotShift,
    plotBottom: 192 + plotShift,
  }
}

describe('a reference figure’s labels point at the features they name', () => {
  it.each(['rv-normal', 'pa-normal', 'ra-normal', 'wedge-normal', 'ra-tricuspid-regurgitation'])(
    '%s: every label is outside the plot, joined to its own landmark',
    (id) => {
      const entry = waveformAtlasById.get(id)!
      const { container } = render(<WaveformAtlasFigure entry={entry} ecgLandmarks />)
      const { viewWidth, viewHeight, plotShift, plotTop, plotBottom } = figureGeometry(container)
      expect(container.querySelectorAll('svg text')).toHaveLength(0)
      for (const annotation of entry.annotations) {
        const landmark = container.querySelector(`circle[data-atlas-landmark="${annotation.id}"]`)!
        const leader = container.querySelector(`line[data-atlas-leader="${annotation.id}"]`)!
        const label = container.querySelector<HTMLElement>(`[data-atlas-label="${annotation.id}"]`)!
        expect(label.textContent).toBe(annotation.label)
        // The leader starts on the landmark itself…
        expect(Number(leader.getAttribute('x1'))).toBeCloseTo(
          Number(landmark.getAttribute('cx')),
          5,
        )
        expect(Number(leader.getAttribute('y1'))).toBeCloseTo(
          Number(landmark.getAttribute('cy')) + plotShift,
          5,
        )
        // …and ends at this label: inside its width, at the edge that faces the plot.
        const labelLeft = (percent(label.style.left) / 100) * viewWidth
        const labelEdge = (percent(label.style.top) / 100) * viewHeight
        expect(Number(leader.getAttribute('x2'))).toBeGreaterThanOrEqual(labelLeft - 0.01)
        expect(Number(leader.getAttribute('y2'))).toBeCloseTo(labelEdge, 1)
        // The label's track is outside the plot: above its top or below its bottom.
        if (annotation.placement === 'above') expect(labelEdge).toBeLessThan(plotTop)
        else expect(labelEdge).toBeGreaterThan(plotBottom)
      }
    },
  )

  it('keeps the landmark on the sample the generator draws', () => {
    const entry = waveformAtlasById.get('pa-normal')!
    const { container } = render(<WaveformAtlasFigure entry={entry} />)
    const path = container.querySelector('path.atlasTrace')!.getAttribute('d')!
    const points = [...path.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    }))
    for (const circle of container.querySelectorAll('circle[data-atlas-landmark]')) {
      const cx = Number(circle.getAttribute('cx'))
      const nearest = points.reduce((best, point) =>
        Math.abs(point.x - cx) < Math.abs(best.x - cx) ? point : best,
      )
      expect(Number(circle.getAttribute('cy'))).toBeCloseTo(nearest.y, 0)
    }
  })

  it('reserves no ECG lane when no ECG is drawn', () => {
    const entry = waveformAtlasById.get('ra-cannon-a-wave')!
    const withEcg = render(<WaveformAtlasFigure entry={entry} />)
    const tall = figureGeometry(withEcg.container)
    cleanup()
    const without = render(<WaveformAtlasFigure entry={entry} showEcg={false} />)
    const short = figureGeometry(without.container)
    expect(without.container.querySelector('[data-atlas-lane="ecg"]')).toBeNull()
    expect(screen.queryByText('ECG')).toBeNull()
    // The plot moves up into the space the lane would have held.
    expect(short.plotTop).toBeLessThan(tall.plotTop - 30)
    expect(short.viewHeight).toBeLessThan(tall.viewHeight - 30)
  })

  it('says what a rhythm-defined schematic does not draw, but only beside a labelled figure', () => {
    for (const id of ['ra-cannon-a-wave', 'ra-atrial-fibrillation']) {
      const entry = waveformAtlasById.get(id)!
      expect(entry.renderingLimit).toMatch(/even|evenly/)
      const labelled = render(<WaveformAtlasFigure entry={entry} showEcg={false} />)
      expect(labelled.container.querySelector('[data-waveform-rendering-limit]')?.textContent).toBe(
        entry.renderingLimit,
      )
      expect(labelled.container.querySelector('svg')?.getAttribute('aria-label')).toContain(
        entry.renderingLimit!,
      )
      cleanup()
      // An unlabelled question tracing must not be named by its own caveat.
      const unlabelled = render(<WaveformAtlasFigure entry={entry} annotated={false} />)
      expect(unlabelled.container.querySelector('[data-waveform-rendering-limit]')).toBeNull()
      expect(unlabelled.container.querySelector('svg')?.getAttribute('aria-label')).not.toContain(
        entry.renderingLimit!,
      )
      cleanup()
    }
  })

  it('marks the right-atrial reading point at the base of the c wave, inside end expiration', () => {
    const { container } = render(<NormalWaveformReference fixedPosition="ra" />)
    const figure = container.querySelector('figure.atlasFigure') as HTMLElement
    const { viewWidth } = figureGeometry(figure)
    const mark = figure.querySelector('circle[data-atlas-landmark="reading-point"]')!
    const label = figure.querySelector('[data-atlas-label="reading-point"]')!
    expect(label.textContent).toBe('read here')
    expect(figure.querySelector('[data-legend-reading-point] dd')?.textContent).toMatch(
      /end expiration, at the base of the c wave/,
    )
    // Three beats across a plot from x = 54 to x = viewWidth − 14, one breath across the strip.
    const stripFraction = (Number(mark.getAttribute('cx')) - 54) / (viewWidth - 14 - 54)
    const cardiacPhase = (stripFraction * 3) % 1
    expect(cardiacPhase).toBeCloseTo(RIGHT_ATRIAL_C_WAVE_BASE_PHASE, 2)
    // End expiration is drawn at the middle of the strip.
    expect(Math.abs(stripFraction - 0.5)).toBeLessThanOrEqual(
      END_EXPIRATION_TOLERANCE_PHASE + 0.005,
    )
  })

  it('draws the walk-fixed reference as an indicator, not as disabled tabs', () => {
    render(<NormalWaveformReference fixedPosition="rv" concise />)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    const progress = document.querySelector('[data-reference-progress]')!
    expect(progress.querySelectorAll('button')).toHaveLength(0)
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain('RV')
    expect(progress.textContent).toMatch(/Next stop and Previous stop/)
    cleanup()
    // Free browsing keeps real, working tabs.
    render(<NormalWaveformReference />)
    const pa = screen.getByRole('tab', { name: /PA/ })
    expect(pa).toBeEnabled()
    fireEvent.click(pa)
    expect(pa).toHaveAttribute('aria-selected', 'true')
  })
})

/* ------------------------------------------------------------------ *
 * The live strip
 * ------------------------------------------------------------------ */

function strip(
  state: HemodynamicSimulationState,
  props: Partial<React.ComponentProps<typeof WaveformStrip>> = {},
) {
  return render(
    <WaveformStrip
      samples={state.waveforms}
      field="papMmHg"
      label="PAP"
      unit="mmHg"
      minimum={0}
      maximum={40}
      color="#ffd166"
      sweepSeconds={6}
      showScale
      heartRateBpm={state.measurements.heartRateBpm}
      {...props}
    />,
  )
}

describe('the live strip', () => {
  it('clips an out-of-range trace instead of flattening it, and says so once', () => {
    const state = cleanState(510, 'pa')
    const { container } = strip(state, { maximum: 20 })
    const polylines = [...container.querySelectorAll('polyline[data-strip-trace]')]
    const ys = polylines
      .flatMap((polyline) => polyline.getAttribute('points')!.split(' '))
      .map((pair) => Number(pair.split(',')[1]))
    // Samples above the axis keep heights above the plot's top edge (y = 6 in the strip's units).
    expect(Math.min(...ys)).toBeLessThan(6)
    expect(polylines[0].parentElement).toHaveAttribute('clip-path')
    expect(container.querySelectorAll('[data-strip-off-scale="above"]').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-strip-off-scale="below"]')).toBeNull()
    const note = container.querySelector('[data-waveform-range-note]')!
    expect(note.textContent).toMatch(/clipped, not flattened/)
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain(note.textContent!)
    // In range: no mark, no note.
    cleanup()
    const inRange = strip(state)
    expect(inRange.container.querySelector('[data-strip-off-scale]')).toBeNull()
    expect(inRange.container.querySelector('[data-waveform-range-note]')).toBeNull()
  })

  it('does not draw a landmark for a wave that is off the axis', () => {
    const state = cleanState(510, 'pa')
    const landmarks = [{ id: 'peak', label: 'PASP', phase: 0.18, placement: 'above' as const }]
    const visible = strip(state, { landmarks, sweepSeconds: 2 })
    expect(
      visible.container.querySelectorAll('[data-strip-landmark="PASP"]').length,
    ).toBeGreaterThan(0)
    cleanup()
    const clipped = strip(state, { landmarks, sweepSeconds: 2, maximum: 15 })
    expect(clipped.container.querySelectorAll('[data-strip-landmark="PASP"]')).toHaveLength(0)
  })

  it('puts the reference value in a gutter and the cursor’s name in a track, not on the trace', () => {
    const state = cleanState(510, 'pa')
    const { container } = strip(state, {
      referenceValue: 16,
      referenceLabel: 'model mPAP',
      phaseCursor: { time: state.timeSeconds - 1, label: 'end-exp', value: 14 },
    })
    const plot = container.querySelector('[data-strip-plot]')!
    const tag = container.querySelector('[data-strip-tag="reference"]')!
    const marker = container.querySelector('[data-strip-marker="cursor"]')!
    expect(tag.textContent).toBe('model mPAP 16')
    expect(marker.textContent).toBe('end-exp')
    expect(plot.contains(tag)).toBe(false)
    expect(plot.contains(marker)).toBe(false)
    expect(plot.querySelectorAll('text')).toHaveLength(0)
    // Ticks are outside the plot too.
    const axis = container.querySelector('[data-strip-axis]')!
    expect(plot.contains(axis)).toBe(false)
    expect([...axis.querySelectorAll('span')].map((node) => node.textContent)).toEqual([
      '40',
      '20',
      '0',
    ])
  })

  it('says a reference value is off the axis rather than drawing it at the edge', () => {
    const state = cleanState(510, 'pa')
    const { container } = strip(state, { referenceValue: 46, referenceLabel: 'model mPAP' })
    expect(container.querySelector('[data-strip-reference-line]')).toBeNull()
    expect(container.querySelector('[data-strip-tag="reference"]')?.textContent).toBe(
      'model mPAP 46 · off this axis',
    )
  })

  it('opens the trace where the measurement system changed and dims what was drawn before', () => {
    const before = cleanState(510, 'pa')
    const state = reduceAll(before, [
      { type: 'TICK', seconds: 2 },
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 },
      { type: 'TICK', seconds: 2 },
    ])
    const seam = state.displaySeams![0]
    const { container } = strip(state, {
      maximum: 60,
      seams: [
        {
          fromTime: seam.fromSeconds,
          untilTime: seam.untilSeconds,
          label: 'transducer height changed',
        },
      ],
    })
    expect(container.querySelectorAll('[data-strip-seam]')).toHaveLength(1)
    const traces = [...container.querySelectorAll('polyline[data-strip-trace]')]
    expect(traces.map((trace) => trace.getAttribute('data-strip-trace'))).toEqual([
      'earlier',
      'current',
    ])
    // No segment joins a sample from before the change to one from after it.
    const lastEarlier = traces[0].getAttribute('points')!.split(' ').at(-1)!
    const firstCurrent = traces[1].getAttribute('points')!.split(' ')[0]
    expect(Number(firstCurrent.split(',')[0])).toBeGreaterThan(Number(lastEarlier.split(',')[0]))
    expect(container.querySelector('[data-strip-marker="seam"]')?.textContent).toBe(
      'transducer height changed',
    )
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toMatch(
      /the step there is not a change in the patient/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * The monitor's statements about its own view
 * ------------------------------------------------------------------ */

describe('the monitor says when its view changed', () => {
  it('announces an axis that was refitted under the same channel', () => {
    const state = cleanState(510, 'pa')
    const { rerender } = render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
    expect(document.querySelector('[data-scale-change-note]')).toBeNull()
    const lowered = reduceAll(state, [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -14 },
      { type: 'TICK', seconds: 2 },
    ])
    rerender(<BedsideMonitor state={lowered} dispatch={jest.fn()} focus="pac" />)
    expect(document.querySelector('[data-scale-change-note]')?.textContent).toBe(
      'Axis changed from 0 to 40 mmHg to 0 to 80 mmHg. The axis changed; the pressure did not.',
    )
  })

  it('announces nothing when the channel itself changed', () => {
    const atrium = cleanState(510, 'ra')
    const { rerender } = render(<BedsideMonitor state={atrium} dispatch={jest.fn()} focus="pac" />)
    rerender(<BedsideMonitor state={cleanState(510, 'rv')} dispatch={jest.fn()} focus="pac" />)
    expect(document.querySelector('[data-scale-change-note]')).toBeNull()
  })

  it('keeps one axis for a whole reference comparison, at every transducer height', () => {
    const baseline = cleanState(510, 'pa')
    const axis = referenceComparisonAxis(baseline, 'papMmHg')!
    const ticks = () =>
      [...document.querySelectorAll('[data-waveform-strip="papMmHg"] [data-strip-axis] span')].map(
        (node) => node.textContent,
      )
    const { rerender } = render(
      <BedsideMonitor
        state={baseline}
        dispatch={jest.fn()}
        focus="pac"
        comparisonBaseline={baseline}
      />,
    )
    const opening = ticks()
    expect(opening[0]).toBe(String(axis.maximum))
    expect(opening.at(-1)).toBe(String(axis.minimum))
    for (const levelCm of [-20, -10, 6, 20]) {
      const moved = reduceAll(baseline, [
        { type: 'SET_TRANSDUCER_LEVEL', levelCm },
        { type: 'TICK', seconds: 3 },
      ])
      rerender(
        <BedsideMonitor
          state={moved}
          dispatch={jest.fn()}
          focus="pac"
          comparisonBaseline={baseline}
        />,
      )
      expect(ticks()).toEqual(opening)
      expect(document.querySelector('[data-scale-change-note]')).toBeNull()
      // Sufficient as well as stable: nothing the moved line draws leaves the pinned axis.
      const values = moved.waveforms.filter((sample) => sample.time > 12.1).map((s) => s.papMmHg)
      expect(Math.min(...values)).toBeGreaterThanOrEqual(axis.minimum)
      expect(Math.max(...values)).toBeLessThanOrEqual(axis.maximum)
      expect(
        document.querySelector('[data-waveform-strip="papMmHg"][data-out-of-range]'),
      ).toBeNull()
    }
    expect(document.querySelector('[data-pinned-axis]')?.textContent).toContain(
      `${axis.minimum} to ${axis.maximum} mmHg`,
    )
  })

  it('says a frozen tracing is frozen, when it stopped, and that the model has moved on', () => {
    const frozen = reduceAll(cleanState(510, 'pa'), [
      { type: 'TICK', seconds: 1 },
      { type: 'TOGGLE_FREEZE' },
      { type: 'TICK', seconds: 3 },
    ])
    const stoppedAt = frozen.waveforms.at(-1)!.time
    expect(frozen.timeSeconds - stoppedAt).toBeCloseTo(3, 1)
    for (const focus of ['pac', 'all'] as const) {
      render(<BedsideMonitor state={frozen} dispatch={jest.fn()} focus={focus} />)
      const note = document.querySelector('[data-frozen-note]')!
      expect(note.textContent).toContain(`stopped at ${stoppedAt.toFixed(1)} s`)
      expect(note.textContent).toContain(`continued to ${frozen.timeSeconds.toFixed(1)} s`)
      expect(note.textContent).toMatch(/not live/)
      cleanup()
    }
    render(<BedsideMonitor state={cleanState(510, 'pa')} dispatch={jest.fn()} focus="pac" />)
    expect(document.querySelector('[data-frozen-note]')).toBeNull()
  })

  it('holds an enlarged still copy without dispatching anything or losing a sample', () => {
    const dispatch = jest.fn()
    const state = reduceAll(cleanState(510, 'ra'), [{ type: 'TICK', seconds: 2 }])
    const { rerender } = render(<BedsideMonitor state={state} dispatch={dispatch} focus="pac" />)
    fireEvent.click(screen.getByRole('button', { name: 'Hold and enlarge the last two beats' }))
    expect(dispatch).not.toHaveBeenCalled()
    const held = document.querySelector('[data-held-view]') as HTMLElement
    const heldAt = state.waveforms.at(-1)!.time
    expect(within(held).getByText(/Held copy · not live/)).toBeInTheDocument()
    expect(held.textContent).toContain(`ended at ${heldAt.toFixed(1)} s`)
    const cycle = 60 / state.measurements.heartRateBpm
    const expected = state.waveforms.filter((sample) => sample.time >= heldAt - 2 * cycle)
    const drawn = held
      .querySelector('polyline[data-strip-trace]')!
      .getAttribute('points')!
      .split(' ')
    // Every sample of the last two beats is drawn: none filtered, smoothed or resampled away.
    expect(drawn).toHaveLength(expected.length)
    // The live strip keeps running; the held copy does not move with it.
    const later = reduceAll(state, [{ type: 'TICK', seconds: 2 }])
    rerender(<BedsideMonitor state={later} dispatch={dispatch} focus="pac" />)
    expect((document.querySelector('[data-held-view]') as HTMLElement).textContent).toContain(
      `ended at ${heldAt.toFixed(1)} s`,
    )
    expect(
      document
        .querySelector('[data-held-view] polyline[data-strip-trace]')!
        .getAttribute('points')!
        .split(' '),
    ).toEqual(drawn)
    fireEvent.click(screen.getByRole('button', { name: 'Release the held copy' }))
    expect(document.querySelector('[data-held-view]')).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('labels the held atrial waves, and withholds them when the chamber is withheld', () => {
    const state = reduceAll(cleanState(510, 'ra'), [{ type: 'TICK', seconds: 2 }])
    render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
    fireEvent.click(screen.getByRole('button', { name: 'Hold and enlarge the last two beats' }))
    const names = new Set(
      [...document.querySelectorAll('[data-held-view] [data-strip-landmark]')].map((node) =>
        node.getAttribute('data-strip-landmark'),
      ),
    )
    expect([...names].sort()).toEqual(['a', 'c', 'v', 'x', 'y'])
    cleanup()
    render(
      <BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" chamberLabel="withheld" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hold and enlarge the last two beats' }))
    expect(document.querySelectorAll('[data-held-view] [data-strip-landmark]')).toHaveLength(0)
    expect(document.querySelector('[data-held-view]')?.textContent).not.toMatch(/\bRA\b/)
  })
})

describe('an alarm under a one-channel monitor says which channel it is about (L2-06)', () => {
  const raised = reduceAll(cleanState(510, 'pa'), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 },
    { type: 'TICK', seconds: 2 },
  ])
  const lowered = reduceAll(cleanState(510, 'pa'), [
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 },
    { type: 'TICK', seconds: 2 },
  ])

  it('names the arterial line beside a monitor that draws only the catheter’s channel', () => {
    expect(raised.alarms.find((alarm) => alarm.id === 'low-map')?.active).toBe(true)
    const { container } = render(<BedsideMonitor state={raised} dispatch={jest.fn()} focus="pac" />)
    // No arterial tracing is on this monitor…
    expect(container.querySelector('[data-waveform-strip="artMmHg"]')).toBeNull()
    // …so the arterial alarm is reported with the channel it belongs to, not as a bare label.
    const note = container.querySelector('[data-alarm-other-channel]')!
    expect(note.textContent).toContain('On the arterial line')
    expect(note.textContent).toContain('does not show')
    expect(note.textContent).toContain('ART MAP LOW')
  })

  it('leaves an alarm about the channel on screen as it was', () => {
    expect(lowered.alarms.find((alarm) => alarm.id === 'high-pap')?.active).toBe(true)
    const { container } = render(
      <BedsideMonitor state={lowered} dispatch={jest.fn()} focus="pac" />,
    )
    expect(container.querySelector('[data-alarm-other-channel]')).toBeNull()
    expect(within(container).getByText('PAP HIGH')).toBeInTheDocument()
  })

  it('does the same the other way round, and changes nothing on the full monitor', () => {
    const arterial = render(
      <BedsideMonitor state={lowered} dispatch={jest.fn()} focus="arterial" />,
    )
    expect(arterial.container.querySelector('[data-alarm-other-channel]')!.textContent).toContain(
      'On the catheter’s channel',
    )
    arterial.unmount()
    const full = render(<BedsideMonitor state={raised} dispatch={jest.fn()} />)
    expect(full.container.querySelector('[data-alarm-other-channel]')).toBeNull()
    expect(within(full.container).getByText('ART MAP LOW')).toBeInTheDocument()
  })
})

describe('axes and availability', () => {
  it('fits an enlarged axis to a raised venous pressure instead of clipping it', () => {
    const raised = Array.from({ length: 60 }, (_, index) => 22 + 3 * Math.sin(index / 5))
    const axis = fittedPressureAxis(raised)!
    expect(axis.minimum).toBeLessThanOrEqual(Math.min(...raised))
    expect(axis.maximum).toBeGreaterThanOrEqual(Math.max(...raised))
    expect(axis.maximum).toBeGreaterThan(20)
    expect(fittedPressureAxis([])).toBeNull()
    // The live venous axis also grows with a raised pressure rather than staying at 20.
    const base = cleanState(510, 'ra')
    const congested: HemodynamicSimulationState = {
      ...base,
      measurements: { ...base.measurements, rapMmHg: 23 },
    }
    render(<BedsideMonitor state={congested} dispatch={jest.fn()} />)
    const ticks = [
      ...document.querySelectorAll('[data-waveform-strip="cvpMmHg"] [data-strip-axis] span'),
    ].map((node) => Number(node.textContent))
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(33)
  })

  it('gives the reason a mixed-venous sample is unavailable and never a value', () => {
    const artery = cleanState(510, 'pa')
    expect(mixedVenousAvailability(artery)).toEqual({ available: true, reason: '' })
    expect(mixedVenousAvailability(cleanState(510, 'ra')).reason).toBe('not available before PA')
    expect(mixedVenousAvailability(capstoneState(808)).reason).toBe(
      'no valid mixed-venous sample · tip in an occluding position',
    )
    const occluding = reduceAll(artery, [{ type: 'START_WEDGE' }])
    expect(mixedVenousAvailability(occluding)).toEqual({
      available: false,
      reason: 'no mixed-venous sample during a balloon occlusion',
    })
    const moving = reduceAll(cleanState(510, 'ra'), [{ type: 'ADVANCE_CATHETER' }])
    expect(mixedVenousAvailability(moving).reason).toBe('not available while the tip is moving')
    render(<BedsideMonitor state={occluding} dispatch={jest.fn()} />)
    const rail = screen.getByRole('group', { name: 'Mixed venous oxygen saturation' })
    expect(rail.querySelector('strong')?.textContent).toBe('—')
  })

  it('never prints a signed zero', () => {
    expect(fixedWithoutNegativeZero(-0.3)).toBe('0')
    expect(fixedWithoutNegativeZero(-0.04, 1)).toBe('0.0')
    expect(fixedWithoutNegativeZero(-0.6)).toBe('-1')
    expect(fixedWithoutNegativeZero(-0.06, 1)).toBe('-0.1')
    expect(fixedWithoutNegativeZero(0.4)).toBe('0')
    expect(fixedWithoutNegativeZero(12.34, 1)).toBe('12.3')
  })
})

/* ------------------------------------------------------------------ *
 * Leveling, fast flush, catheter parts
 * ------------------------------------------------------------------ */

describe('the leveling drawing', () => {
  it('draws the reference point midway between the front and the back of the chest', () => {
    render(<LevelingVisual state={cleanState(510, 'pa')} channel="pac" />)
    const point = document.querySelector('[data-leveling-axis-point]')!
    const anterior = Number(point.getAttribute('data-anterior-y'))
    const posterior = Number(point.getAttribute('data-posterior-y'))
    expect(posterior).toBeGreaterThan(anterior)
    expect(Number(point.getAttribute('cy'))).toBeCloseTo((anterior + posterior) / 2, 5)
    // The level line passes through the same point.
    const line = document.querySelector('[data-leveling-axis-line]')!
    expect(line.getAttribute('y1')).toBe(point.getAttribute('cy'))
    const depth = document.querySelector('[data-leveling-chest-depth]')!
    expect(depth.getAttribute('y1')).toBe(String(anterior))
    expect(depth.getAttribute('y2')).toBe(String(posterior))
    expect(screen.getByRole('img', { name: /midway between the front and the back/ })).toBeTruthy()
  })

  it('reports the channel on the monitor, from the same unrounded estimates as the table', () => {
    const baseline = cleanState(510, 'pa')
    const lowered = reduceAll(baseline, [{ type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 }])
    render(<LevelingVisual state={lowered} channel="pac" />)
    expect(document.querySelector('[data-leveling-reference]')?.textContent).toContain(
      `${unroundedModelEstimates(baseline).meanPapMmHg.toFixed(1)} mmHg`,
    )
    expect(document.querySelector('[data-leveling-current]')?.textContent).toContain(
      `${unroundedModelEstimates(lowered).meanPapMmHg.toFixed(1)} mmHg`,
    )
    expect(document.querySelector('[data-leveling-current]')?.textContent).toMatch(
      /mean pulmonary-artery pressure/,
    )
    expect(document.querySelector('[data-leveling-direction]')?.textContent).toBe('Reads high')
    expect(document.querySelector('[data-leveling-label="height"]')?.textContent).toBe('−10 cm')
    expect(document.body.textContent).not.toMatch(/MmHg/)
    cleanup()
    render(<LevelingVisual state={lowered} />)
    expect(document.querySelector('[data-leveling-current]')?.textContent).toMatch(
      /mean arterial pressure/,
    )
  })
})

describe('the fast-flush figure', () => {
  it('keeps the flush and the ringing at their own heights and names the flush above the plot', () => {
    const { container } = render(
      <FastFlushTrace response="underdamped" lineType="pulmonary-artery" revealLabel />,
    )
    const ys = [
      ...container
        .querySelector('[data-flush-path]')!
        .getAttribute('d')!
        .matchAll(/[ML] [\d.-]+ ([\d.-]+)/g),
    ].map((match) => Number(match[1]))
    // The plot runs from y = 8 (40 mmHg) to y = 192 (0 mmHg). 300 mmHg is far above it; the
    // ringing falls below zero. Neither is drawn at an edge.
    expect(Math.min(...ys)).toBeLessThan(-1000)
    expect(Math.max(...ys)).toBeGreaterThan(192)
    expect(container.querySelector('[data-flush-path]')).toHaveAttribute('clip-path')
    const plot = container.querySelector('[data-flush-plot]')!
    const label = container.querySelector('[data-flush-off-scale-label]')!
    expect(label.textContent).toMatch(/off this scale, about 300 mmHg/)
    expect(plot.contains(label)).toBe(false)
    expect(plot.querySelectorAll('text')).toHaveLength(0)
    expect(container.querySelector('[data-waveform-range-note]')?.textContent).toMatch(
      /clipped there, not flattened/,
    )
  })

  it('states the source and the drawn values only once the response is labelled', () => {
    const labelled = render(
      <FastFlushTrace response="underdamped" lineType="pulmonary-artery" revealLabel />,
    )
    expect(labelled.container.querySelector('[data-flush-displayed]')?.textContent).toBe(
      'Source 25/10 mmHg, drawn here as 28/7 mmHg',
    )
    cleanup()
    const withheld = render(
      <FastFlushTrace response="underdamped" lineType="pulmonary-artery" revealLabel={false} />,
    )
    expect(withheld.container.querySelector('[data-flush-displayed]')?.textContent).toBe(
      'Classification withheld',
    )
    expect(withheld.container.textContent).not.toMatch(/Underdamped|28\/7/)
  })

  it('compares the three responses on one source, one axis and one time base', () => {
    render(<DynamicResponseComparison lineType="pulmonary-artery" />)
    const comparison = document.querySelector('[data-dynamic-response-comparison]')!
    expect(comparison.querySelector('h3')?.textContent).toMatch(/the fast-flush test/)
    const articles = [...comparison.querySelectorAll('article[data-response]')]
    expect(articles.map((article) => article.getAttribute('data-response'))).toEqual([
      'acceptable',
      'overdamped',
      'underdamped',
    ])
    for (const article of articles) {
      const windows = [...article.querySelectorAll('[data-fast-flush-trace]')].map((figure) =>
        figure.getAttribute('data-window'),
      )
      expect(windows).toEqual(['whole', 'release'])
      const ticks = [...article.querySelectorAll('[data-fast-flush-trace]')].map((figure) =>
        [...figure.querySelectorAll('[class*="tick"]')].map((node) => node.textContent).join(','),
      )
      expect(new Set(ticks)).toEqual(new Set(['0,10,20,30,40']))
    }
    expect(
      articles.map((article) => article.querySelector('[data-response-displayed]')?.textContent),
    ).toEqual(['25/10 mmHg · mean 15', '21/12 mmHg · mean 15', '28/7 mmHg · mean 15'])
  })
})

describe('the catheter’s parts', () => {
  it('names four parts on the existing schematic and gives no distance', () => {
    render(<PacComponentSchematic />)
    const figure = document.querySelector('[data-pac-component-schematic]')!
    expect(
      [...figure.querySelectorAll('[data-pac-part]')].map((part) =>
        part.getAttribute('data-pac-part'),
      ),
    ).toEqual(['distal-opening', 'balloon', 'thermistor', 'proximal-port'])
    expect(figure.querySelectorAll('[data-pac-part-mark]')).toHaveLength(4)
    expect(figure.textContent).toMatch(/pulmonary artery catheter \(PAC\)/)
    // No length, in any unit, anywhere on it.
    expect(figure.textContent).not.toMatch(/\d\s*(cm|mm|mL|ml|cc)\b/)
    expect(figure.querySelector('svg')?.getAttribute('aria-label')).not.toMatch(
      /\d\s*(cm|mm|mL|ml|cc)\b/,
    )
    expect(figure.textContent).toMatch(/gives\s+no distances/)
  })
})
