import { render } from '@testing-library/react'
import { McsPressureFlowTrend, mcsMonitorTrendSeries } from '../components/McsPressureFlowTrend'
import { ecgDisplayPoints, trendWindow, fixedTrendAxis } from '../components/monitorDisplay'
import { createInitialMcsState, mcsReducer } from '../engine'
import type { McsSimulationState } from '../engine'

function tick(state: McsSimulationState, seconds: number) {
  return mcsReducer(state, { type: 'TICK', seconds })
}
function rate(state: McsSimulationState, value: number) {
  return mcsReducer(state, { type: 'SET_PATIENT_CONTROL', control: 'heartRateBpm', value })
}

it.each([
  [80, 120, 60],
  [138, 96, 180],
  [60, 138, 80],
])('preserves old displayed ECG geometry across rate changes %s → %s → %s', (a, b, c) => {
  let state = tick(rate(createInitialMcsState('learn', 'iabp'), a), 3)
  let samples = state.waveforms
  let points = ecgDisplayPoints(samples, a)
  for (const next of [b, c, a]) {
    const oldEnd = samples.at(-1)!.time
    const before = JSON.stringify(state)
    // Rate change before any new sample must not redraw a past beat.
    expect(ecgDisplayPoints(samples, next)).toEqual(points)
    expect(JSON.stringify(state)).toBe(before)
    state = tick(rate(state, next), 0.6)
    samples = state.waveforms
    const after = ecgDisplayPoints(samples, next)
    expect(after.filter((point) => point.time <= oldEnd)).toEqual(points)
    const stored = new Map(after.map((point) => [point.time, point.value]))
    for (const sample of samples) expect(stored.get(sample.time)).toBe(sample.ecgMv)
    points = after
  }
  // Retention/resize uses the same grid within each interval, not a new window-wide grid.
  const tail = samples.slice(27)
  expect(ecgDisplayPoints(tail, a)).toEqual(points.filter((p) => p.time >= tail[0].time))
})

it('does not reconstruct a known rate boundary even when its rounded end samples coincide', () => {
  let state = tick(rate(createInitialMcsState('learn', 'iabp'), 80), 0.74)
  const oldEnd = state.waveforms.at(-1)!.time
  ecgDisplayPoints(state.waveforms, 80)
  state = tick(rate(state, 120), 0.04)
  const firstNew = state.waveforms.find((sample) => sample.time > oldEnd)!.time
  const points = ecgDisplayPoints(state.waveforms, 120)
  expect(points.filter((point) => point.time > oldEnd && point.time < firstNew)).toEqual([])
})

it('does not imply a ten-second history when fewer seconds have been recorded', () => {
  const state = tick(createInitialMcsState('learn', 'iabp'), 2)
  const window = trendWindow(state.trends, 40)
  expect(window.start).toBeGreaterThanOrEqual(state.trends[0].time)
})

it.each([0.04, 0.06, 0.08])('preserves a QRS when rate changes at %s seconds', (seconds) => {
  let state = tick(rate(createInitialMcsState('learn', 'iabp'), 80), seconds)
  const previous = ecgDisplayPoints(state.waveforms, 80)
  const end = state.waveforms.at(-1)!.time
  state = tick(rate(state, 120), 0.08)
  expect(ecgDisplayPoints(state.waveforms, 120).filter((p) => p.time <= end)).toEqual(previous)
})

it.each([
  [70, 0],
  [70, 4],
  [201, 11],
])('keeps flat pressure %s and flow %s inside separate frames', (pressure, flow) => {
  const base = tick(createInitialMcsState('learn', 'impella'), 2).trends.at(-1)!
  const samples = [0, 1, 2].map((time) => ({
    ...base,
    time,
    mapMmHg: pressure,
    effectiveFlowLMin: flow,
  }))
  const { container, unmount } = render(
    <McsPressureFlowTrend
      samples={samples}
      windowSeconds={40}
      series={mcsMonitorTrendSeries('iabp')}
    />,
  )
  for (const [id, min, max] of [
    ['map', 24, 118],
    ['effective-flow', 150, 244],
  ] as const) {
    const path = container.querySelector(`[data-series="${id}"]`)!.getAttribute('d')!
    const ys = [...path.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((match) => Number(match[1]))
    expect(ys.length).toBe(3)
    expect(new Set(ys).size).toBe(1)
    expect(ys.every((y) => y > min && y < max)).toBe(true)
  }
  expect(container.querySelector('tbody tr:last-child')?.textContent).toContain(flow.toFixed(1))
  expect(container.textContent).toContain(`${pressure.toFixed(0)} mm Hg`)
  unmount()
})

it('reverts extended scales only when the high sample leaves the displayed window', () => {
  const base = tick(createInitialMcsState('learn', 'iabp'), 2).trends.at(-1)!
  const samples = [0, 1, 41].map((time, index) => ({
    ...base,
    time,
    mapMmHg: index === 0 ? 201 : 70,
  }))
  const window = trendWindow(samples, 40)
  expect(window.start).toBe(1)
  expect(
    fixedTrendAxis(
      window.samples.map((sample) => sample.mapMmHg),
      160,
      40,
    ).max,
  ).toBe(160)
  expect(
    fixedTrendAxis(
      samples.map((sample) => sample.mapMmHg),
      160,
      40,
    ).max,
  ).toBe(240)
})
