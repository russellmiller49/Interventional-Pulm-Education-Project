import { fireEvent, render, screen } from '@testing-library/react'
import { WaveformAtlasFigure } from '../components/WaveformAtlasFigure'
import { WaveformStrip } from '../components/WaveformStrip'
import { BedsideMonitor } from '../components/BedsideMonitor'
import { FastFlushTrace } from '../components/PressureSystemTeachingVisual'
import { LineDock } from '../components/stage/StageDocks'
import { NormalWaveformReference } from '../components/NormalWaveformReference'
import { displayNumber } from '../components/displayNumber'
import { waveformAtlasById, waveformValueAt } from '../content/waveformAtlas'
import { generateFastFlushWaveform } from '../content/pressureSystemVisuals'
import { cleanState } from '../engine/stageRuntime'
import { icuHemodynamicsReducer } from '../engine'

it.each(['ra-cannon-a-wave', 'ra-atrial-fibrillation'])(
  '%s omits a misleading sinus ECG and discloses the repeated pressure model',
  (id) => {
    const { container } = render(<WaveformAtlasFigure entry={waveformAtlasById.get(id)!} />)
    expect(container.querySelector('.atlasEcgTrace')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/does not model.*rhythm-specific ECG/)
  },
)

it.each(['ra-normal', 'rv-normal', 'pa-normal', 'ra-tricuspid-regurgitation'])(
  'numbered %s leaders point to canonical samples and words stay outside the trace',
  (id) => {
    const entry = waveformAtlasById.get(id)!
    const { container } = render(<WaveformAtlasFigure entry={entry} beats={1} scaleMaxMmHg={40} />)
    for (const g of container.querySelectorAll('[data-annotation-label]')) {
      const a = entry.annotations.find((a) => a.label === g.getAttribute('data-annotation-label'))!
      const point = g.querySelector('circle')!
      expect(Number(point.getAttribute('cx'))).toBeCloseTo(54 + a.phase * (646 - 54), 6)
      expect(Number(point.getAttribute('cy'))).toBeCloseTo(
        192 - (waveformValueAt(entry.trace, a.phase) * 126) / 40,
        6,
      )
      expect(g.querySelector('path')).toHaveAttribute('data-annotation-leader')
      expect(g.querySelector('text')!.textContent).toMatch(/^\d+$/)
      expect(Number(g.querySelector('text')!.getAttribute('y'))).toBeGreaterThan(192)
    }
    expect(screen.getByRole('list', { name: 'Waveform callouts' })).toHaveTextContent(
      entry.annotations[0].label,
    )
  },
)

it('keeps current/cursor tags out of clipped raw pressure geometry', () => {
  const state = cleanState()
  const { container } = render(
    <WaveformStrip
      samples={state.waveforms}
      field="papMmHg"
      label="PAP"
      unit="mmHg"
      minimum={0}
      maximum={10}
      color="#ffd166"
      sweepSeconds={6}
      showScale
      referenceValue={16}
      referenceLabel="model mPAP"
      phaseCursor={{ time: state.waveforms.at(-1)!.time, label: 'cursor selected', value: 25 }}
    />,
  )
  expect(screen.getByText('model mPAP 16 mmHg')).toBeVisible()
  expect(container.querySelector('svg')).not.toHaveTextContent('model mPAP')
  expect(container.querySelector('polyline')).toHaveAttribute('clip-path')
  const points = container
    .querySelector('polyline')!
    .getAttribute('points')!
    .split(' ')
    .map((p) => Number(p.split(',')[1]))
  expect(Math.min(...points)).toBeLessThan(10)
  expect(container.querySelector('[data-strip-range-note]')).toBeVisible()
})

it('explains fixed reference indicators and keeps browsable tabs functional', () => {
  const { rerender } = render(<NormalWaveformReference fixedPosition="ra" />)
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.getByRole('list', { name: /in insertion order/ })).toHaveTextContent('1. RA')
  rerender(<NormalWaveformReference />)
  fireEvent.click(screen.getByRole('tab', { name: /PA$/ }))
  expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('PA')
})

it('hides an ART scale when no ART channel is shown', () => {
  const state = cleanState()
  const { rerender } = render(
    <LineDock state={state} dispatch={jest.fn()} enabled showArterialScale={false} />,
  )
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  rerender(<LineDock state={state} dispatch={jest.fn()} enabled showArterialScale />)
  expect(screen.getByRole('combobox')).toHaveValue('160')
})

it('frozen inspection changes the time window, never samples or acquisition identity', () => {
  const state = icuHemodynamicsReducer(cleanState(), { type: 'TOGGLE_FREEZE' })
  const before = JSON.stringify(state)
  const { container } = render(
    <BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" inspectionEnabled />,
  )
  expect(container.querySelector('[data-trace-inspection]')).toHaveTextContent(
    /Frozen trace.*retained sample.*model time/,
  )
  const points = container.querySelector('polyline')!.getAttribute('points')!
  fireEvent.click(screen.getByRole('button', { name: 'View one retained beat' }))
  expect(container.querySelector('polyline')!.getAttribute('points')).not.toBe(points)
  expect(container.querySelector('[data-trace-inspection]')).toHaveTextContent(
    /readouts still use the full retained sweep/,
  )
  expect(JSON.stringify(state)).toBe(before)
})

it('auto-ranges pathological RA pressure rather than silently clipping it', () => {
  let state = icuHemodynamicsReducer(cleanState(), {
    type: 'SET_CATHETER_POSITION',
    position: 'ra',
  })
  state = {
    ...state,
    measurements: { ...state.measurements, rapMmHg: 45 },
    waveforms: state.waveforms.map((s) => ({ ...s, cvpMmHg: s.cvpMmHg + 45 })),
  }
  render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
  expect(screen.getByText(/axis -5–80/)).toBeVisible()
  expect(screen.queryByText(/Trace exceeds this axis/)).not.toBeInTheDocument()
})

it('erases a prior leveling setting and holds a compatible 80 mmHg view', () => {
  const state = cleanState()
  const after = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: -10 })
  const { container, rerender } = render(
    <BedsideMonitor
      state={state}
      dispatch={jest.fn()}
      focus="pac"
      pacScaleMaximum={80}
      displaySettingKey="0"
    />,
  )
  rerender(
    <BedsideMonitor
      state={after}
      dispatch={jest.fn()}
      focus="pac"
      pacScaleMaximum={80}
      displaySettingKey="-10"
    />,
  )
  expect(container.querySelector('[data-trace-inspection]')).toHaveTextContent(
    /earlier sweep erased.*physiology is unchanged/,
  )
  expect(screen.getByText(/axis 0–80/)).toBeVisible()
  expect(container.querySelector('polyline')).toHaveAttribute('points', '')
})

it.each(['acceptable', 'overdamped', 'underdamped'] as const)(
  'flush %s clips the real off-axis plateau and release magnification reuses the same samples',
  (response) => {
    const wave = generateFastFlushWaveform('pulmonary-artery', response)
    const original = JSON.stringify(wave)
    const { container, rerender } = render(
      <FastFlushTrace response={response} lineType="pulmonary-artery" revealLabel />,
    )
    const path = container.querySelector('path.flushTrace')!
    expect(path).toHaveAttribute('clip-path')
    expect(
      Math.min(
        ...[...path.getAttribute('d')!.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((m) =>
          Number(m[2]),
        ),
      ),
    ).toBeLessThan(28)
    rerender(
      <FastFlushTrace response={response} lineType="pulmonary-artery" revealLabel view="release" />,
    )
    expect(container.querySelector('[data-flush-view]')).toHaveAttribute(
      'data-flush-view',
      'release',
    )
    expect(screen.getByText(/same retained samples/)).toBeVisible()
    expect(JSON.stringify(generateFastFlushWaveform('pulmonary-artery', response))).toBe(original)
  },
)

it.each([
  [-0.1, 0, '0'],
  [-0.01, 1, '0.0'],
  [null, 0, '—'],
  [-1.3, 1, '-1.3'],
] as const)('display-only rounding %s at %s places', (value, digits, expected) =>
  expect(displayNumber(value, digits)).toBe(expected),
)

it('the static RA cardiac guide remains a canonical c-base point, separate from respiration', () => {
  const { container } = render(<NormalWaveformReference fixedPosition="ra" />)
  const marker = container.querySelector('[data-ra-c-base-marker]')!
  expect(Number(marker.getAttribute('cx'))).toBeCloseTo(54 + (1.14 / 3) * 592, 6)
  expect(screen.getByText(/Open circle: c-wave base/)).toBeVisible()
  expect(container.querySelector('[class*="atlasReadMarker"] line')).not.toHaveAttribute(
    'x1',
    marker.getAttribute('cx'),
  )
})
