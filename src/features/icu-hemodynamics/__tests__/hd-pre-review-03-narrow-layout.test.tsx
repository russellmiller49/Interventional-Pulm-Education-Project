import { cleanup, render } from '@testing-library/react'

import { WaveformAtlasFigure } from '../components/WaveformAtlasFigure'
import { WaveformStrip } from '../components/WaveformStrip'
import { waveformAtlasById } from '../content/waveformAtlas'
import { cleanState } from '../engine/stageRuntime'

/**
 * HD-PRE-REVIEW-03 — the reference figure at the sizes a browser actually gives it.
 *
 * The figure lays its labels out from two measurements: the width it is drawn at and the reader's
 * text size. A test's DOM measures neither, so these tests supply them — a phone-width card, a card
 * under enlarged text — and read the layout the figure computes from them. The real-browser spec
 * (`e2e/icu-hemodynamics-pre-review-03.spec.ts`) measures the same properties on rendered boxes.
 */
const mockMetrics = { current: { widthPx: 825, remPx: 16 } }
jest.mock('../components/useRenderedMetrics', () => ({
  useRenderedMetrics: () => mockMetrics.current,
  DEFAULT_RENDERED_METRICS: { widthPx: 825, remPx: 16 },
}))

afterEach(() => {
  cleanup()
  mockMetrics.current = { widthPx: 825, remPx: 16 }
})

const percent = (value: string) => Number.parseFloat(value)

function geometry(container: HTMLElement) {
  const svg = container.querySelector('svg')!
  const [, , viewWidth, viewHeight] = svg.getAttribute('viewBox')!.split(' ').map(Number)
  const clip = container.querySelector('clipPath rect')!
  const lane = container.querySelector('g[data-atlas-lane="pressure"]')!
  const plotShift = Number(/translate\(0 (-?[\d.]+)\)/.exec(lane.getAttribute('transform')!)![1])
  return {
    viewWidth,
    viewHeight,
    plotLeft: Number(clip.getAttribute('x')),
    plotWidth: Number(clip.getAttribute('width')),
    plotTop: Number(clip.getAttribute('y')),
    plotHeight: Number(clip.getAttribute('height')),
    plotShift,
  }
}

/** Every label's slot, in the figure's units: where it starts and how wide it was allowed to be. */
function slots(container: HTMLElement, selector: string, viewWidth: number) {
  return [...container.querySelectorAll<HTMLElement>(selector)].map((label) => ({
    text: label.textContent,
    left: (percent(label.style.left) / 100) * viewWidth,
    width: label.style.width
      ? (percent(label.style.width) / 100) * viewWidth
      : label.style.maxWidth
        ? (percent(label.style.maxWidth) / 100) * viewWidth
        : null,
    top: label.style.top,
  }))
}

describe('at a phone-width card', () => {
  it('draws one unit to the pixel, so the plot keeps its height under full-size labels', () => {
    mockMetrics.current = { widthPx: 210, remPx: 16 }
    const { container } = render(
      <WaveformAtlasFigure entry={waveformAtlasById.get('ra-normal')!} ecgLandmarks />,
    )
    const figure = geometry(container)
    // It used to stop at a 360-unit view box: 0.58 px per unit here, a 73 px plot.
    expect(figure.viewWidth).toBe(210)
    expect(figure.plotHeight).toBe(126)
    // The display-range contract's own coordinates are where they were.
    expect(figure.plotTop).toBe(66)
    expect(figure.plotLeft).toBe(54)
  })

  it('spreads the ECG names so QRS and T do not print on each other', () => {
    mockMetrics.current = { widthPx: 210, remPx: 16 }
    const { container } = render(
      <WaveformAtlasFigure entry={waveformAtlasById.get('ra-normal')!} ecgLandmarks />,
    )
    const { viewWidth, plotLeft, plotWidth } = geometry(container)
    const names = slots(container, '[data-atlas-ecg-name]', viewWidth)
    expect(names.map((name) => name.text).sort()).toEqual(['P', 'QRS', 'T'])
    for (const name of names) {
      expect(name.left).toBeGreaterThanOrEqual(plotLeft - 0.01)
      expect(name.left + name.width!).toBeLessThanOrEqual(plotLeft + plotWidth + 0.01)
    }
    for (const a of names) {
      for (const b of names) {
        if (a === b || a.top !== b.top) continue
        const apart = a.left + a.width! <= b.left + 0.01 || b.left + b.width! <= a.left + 0.01
        expect(apart).toBe(true)
      }
    }
    // Each name keeps a tie to its own line: the leader starts on the line and ends under the name.
    for (const name of names) {
      const line = container.querySelector(`line[data-atlas-ecg-landmark="${name.text}"]`)!
      const leader = container.querySelector(`line[data-atlas-ecg-leader="${name.text}"]`)!
      expect(leader.getAttribute('x1')).toBe(line.getAttribute('x1'))
      const end = Number(leader.getAttribute('x2'))
      expect(end).toBeGreaterThanOrEqual(name.left - 0.01)
      expect(end).toBeLessThanOrEqual(name.left + name.width! + 0.01)
    }
  })

  it('keeps every wave label inside the plot’s width, whichever track it lands on', () => {
    for (const widthPx of [210, 280, 330]) {
      mockMetrics.current = { widthPx, remPx: 16 }
      for (const id of ['ra-normal', 'rv-normal', 'pa-normal', 'wedge-normal']) {
        const { container, unmount } = render(
          <WaveformAtlasFigure entry={waveformAtlasById.get(id)!} ecgLandmarks />,
        )
        const { viewWidth, plotLeft, plotWidth } = geometry(container)
        for (const label of slots(container, '[data-atlas-label]', viewWidth)) {
          expect(label.left).toBeGreaterThanOrEqual(plotLeft - 0.01)
          expect(label.left).toBeLessThanOrEqual(plotLeft + plotWidth)
        }
        unmount()
      }
    }
  })
})

describe('under enlarged text', () => {
  it('widens the gutter to the text in it, and moves the plot, clip and landmarks together', () => {
    mockMetrics.current = { widthPx: 400, remPx: 32 }
    const entry = waveformAtlasById.get('ra-normal')!
    const { container } = render(
      <WaveformAtlasFigure
        entry={entry}
        ecgLandmarks
        respiration={{
          swingMmHg: 3,
          cyclesPerStrip: 1,
          endExpirationPhase: 0.5,
          modeLabel: 'spontaneous breathing',
        }}
      />,
    )
    const figure = geometry(container)
    expect(figure.plotLeft).toBeGreaterThan(54)
    // The trace begins at the plot's left edge, wherever that now is.
    const path = container.querySelector('path[class*="atlasTrace"]:not([class*="Fill"])')!
    const firstX = Number(/^M ([\d.]+)/.exec(path.getAttribute('d')!)![1])
    expect(firstX).toBeCloseTo(figure.plotLeft, 1)
    // Landmarks are still inside the plot.
    for (const circle of container.querySelectorAll('circle[data-atlas-landmark]')) {
      const x = Number(circle.getAttribute('cx'))
      expect(x).toBeGreaterThanOrEqual(figure.plotLeft)
      expect(x).toBeLessThanOrEqual(figure.plotLeft + figure.plotWidth)
    }
  })

  it('wraps a label that is wider than the whole plot instead of running it out of the card', () => {
    mockMetrics.current = { widthPx: 400, remPx: 32 }
    const { container } = render(
      <WaveformAtlasFigure entry={waveformAtlasById.get('rv-normal')!} ecgLandmarks />,
    )
    const { viewWidth, plotLeft, plotWidth } = geometry(container)
    const labels = slots(container, '[data-atlas-label]', viewWidth)
    const long = labels.find((label) => label.text === 'up-sloping diastole')!
    expect(
      container.querySelector('[data-atlas-label="diastole"]')!.getAttribute('data-wrapped'),
    ).toBe('true')
    expect(long.width).toBeLessThanOrEqual(plotWidth + 0.01)
    expect(long.left).toBeGreaterThanOrEqual(plotLeft - 0.01)
    expect(long.left + long.width!).toBeLessThanOrEqual(plotLeft + plotWidth + 0.01)
  })

  it('names fewer axis values rather than overlapping them, and keeps every gridline', () => {
    mockMetrics.current = { widthPx: 400, remPx: 64 }
    const { container } = render(
      <WaveformAtlasFigure entry={waveformAtlasById.get('pa-normal')!} />,
    )
    const gridlines = container.querySelectorAll('line[class*="atlasGridline"]').length
    const named = [...container.querySelectorAll('[class*="atlasTick"]')].map((n) => n.textContent)
    expect(gridlines).toBe(5)
    expect(named).toEqual(['0', '20', '40'])
  })

  it('at ordinary text every axis value is named', () => {
    const { container } = render(
      <WaveformAtlasFigure entry={waveformAtlasById.get('pa-normal')!} />,
    )
    expect(
      [...container.querySelectorAll('[class*="atlasTick"]')].map((node) => node.textContent),
    ).toEqual(['0', '10', '20', '30', '40'])
  })

  it('lets the reading marker’s name take the figure’s width when the plot cannot hold it', () => {
    mockMetrics.current = { widthPx: 200, remPx: 32 }
    const { container } = render(
      <WaveformAtlasFigure
        entry={waveformAtlasById.get('ra-normal')!}
        respiration={{
          swingMmHg: 3,
          cyclesPerStrip: 1,
          endExpirationPhase: 0.5,
          modeLabel: 'spontaneous breathing',
        }}
      />,
    )
    const name = container.querySelector<HTMLElement>('[data-atlas-read-name]')!
    expect(name.getAttribute('data-wrapped')).toBe('true')
    expect(name.style.width).toBe('100%')
    expect(percent(name.style.left)).toBe(0)
  })
})

describe('figures compared side by side', () => {
  const ventricle = waveformAtlasById.get('rv-normal')!
  const artery = waveformAtlasById.get('pa-normal')!
  const shiftOf = (entry: typeof ventricle, aligned: boolean) => {
    const { container, unmount } = render(
      <WaveformAtlasFigure
        entry={entry}
        scaleMaxMmHg={40}
        ecgLandmarks
        showLegend={false}
        alignLabelRowsWith={aligned ? [ventricle, artery] : undefined}
      />,
    )
    const figure = geometry(container)
    unmount()
    return { shift: figure.plotShift, height: figure.viewHeight }
  }

  it('put their plots at one height at every width, where on their own they would not', () => {
    let differedAlone = false
    for (const widthPx of [210, 280, 330, 400, 480, 560, 825]) {
      mockMetrics.current = { widthPx, remPx: 16 }
      const alone = [shiftOf(ventricle, false), shiftOf(artery, false)]
      if (alone[0].shift !== alone[1].shift || alone[0].height !== alone[1].height) {
        differedAlone = true
      }
      const aligned = [shiftOf(ventricle, true), shiftOf(artery, true)]
      expect(aligned[0].shift).toBe(aligned[1].shift)
      expect(aligned[0].height).toBe(aligned[1].height)
    }
    // The alignment is doing something: at some width the two needed different label tracks.
    expect(differedAlone).toBe(true)
  })

  it('reserves nothing extra for a figure drawn alone', () => {
    const alone = shiftOf(ventricle, false)
    const { container } = render(
      <WaveformAtlasFigure entry={ventricle} scaleMaxMmHg={40} ecgLandmarks showLegend={false} />,
    )
    expect(geometry(container).plotShift).toBe(alone.shift)
  })
})

describe('the live strip’s frame', () => {
  it('is the size container, so the body’s columns can answer to its width', () => {
    const state = cleanState(510, 'pa')
    const { container } = render(
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
        referenceValue={16}
        referenceLabel="model mPAP"
      />,
    )
    const figure = container.querySelector('figure')!
    const frame = figure.querySelector(':scope > .frame')!
    // Caption, then the frame: the frame holds the body, and the body holds plot, axis and tags.
    expect(frame.querySelector(':scope > .body')).not.toBeNull()
    expect(frame.querySelector('[data-strip-plot]')).not.toBeNull()
    expect(frame.querySelector('[data-strip-axis]')).not.toBeNull()
    expect(frame.querySelector('[data-strip-tags]')).not.toBeNull()
  })
})
