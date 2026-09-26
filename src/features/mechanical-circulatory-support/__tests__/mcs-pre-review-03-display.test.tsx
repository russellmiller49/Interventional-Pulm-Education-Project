/**
 * MCS-PRE-REVIEW-03 — the display arithmetic added by this slice.
 *
 * These helpers decide where an existing value is drawn. The tests hold them to that: the ECG
 * expression the monitor now draws between samples is the model's own, number for number; the fill
 * passes through every stored sample; the trend's scales start at zero, grow only in whole steps and
 * say when they did; and no plotted value is transformed.
 */
import { render } from '@testing-library/react'

import { McsPressureFlowTrend, mcsMonitorTrendSeries } from '../components/McsPressureFlowTrend'
import {
  ecgDisplayPoints,
  fixedTrendAxis,
  trendTimeStep,
  trendWindow,
} from '../components/monitorDisplay'
import { createInitialMcsState, mcsReducer } from '../engine'
import { MCS_ECG_DEFLECTION_PHASES, mcsEcgMillivolts } from '../engine/model'
import type { McsSimulationState, McsWaveformSample } from '../engine/types'

function settle(state: McsSimulationState, seconds = 8): McsSimulationState {
  let next = state
  for (let step = 0; step < seconds * 5; step += 1)
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  return next
}

/** The expression `generateMcsWaveformSample` used before it was named, copied verbatim. */
function originalEcg(time: number, heartRateBpm: number): number {
  const cycle = 60 / Math.max(25, heartRateBpm)
  const phase = (((time % cycle) + cycle) % cycle) / cycle
  const p = (center: number, width: number) => {
    const normalized = (phase - center) / width
    return Math.exp(-0.5 * normalized * normalized)
  }
  return p(0.08, 0.012) - 0.22 * p(0.105, 0.014) + 0.42 * p(0.3, 0.045)
}

describe('the ECG the monitor draws is the model’s own', () => {
  it('is the original expression, exactly, across rates and times', () => {
    for (const rate of [40, 60, 80, 96, 128, 138, 180])
      for (let time = 0; time < 12; time += 0.0137)
        expect(mcsEcgMillivolts(time, rate)).toBe(originalEcg(time, rate))
  })

  it('regenerates every stored sample of a live run to the sample’s own rounding', () => {
    const state = settle(createInitialMcsState('learn', 'iabp'))
    expect(state.waveforms.length).toBeGreaterThan(100)
    for (const sample of state.waveforms)
      expect(
        Math.round(mcsEcgMillivolts(sample.time, state.patient.heartRateBpm) * 1000) / 1000,
      ).toBe(sample.ecgMv)
  })

  it('draws through every stored sample and at every deflection peak', () => {
    const state = settle(createInitialMcsState('learn', 'iabp'))
    const window = state.waveforms.slice(-250)
    const points = ecgDisplayPoints(window, state.patient.heartRateBpm)
    const byTime = new Map(points.map((point) => [point.time, point.value]))
    for (const sample of window) expect(byTime.get(sample.time)).toBe(sample.ecgMv)
    const cycle = 60 / state.patient.heartRateBpm
    const start = window[0].time
    const end = window[window.length - 1].time
    for (let beat = Math.ceil(start / cycle); (beat + 0.08) * cycle < end; beat += 1)
      for (const phase of MCS_ECG_DEFLECTION_PHASES) {
        const time = (beat + phase) * cycle
        if (time > start && time < end) expect(byTime.has(time)).toBe(true)
      }
    expect(points.every((point, index) => index === 0 || point.time > points[index - 1].time)).toBe(
      true,
    )
  })

  it('draws stored samples as they are before a change of rate inside the window', () => {
    const before = settle(createInitialMcsState('learn', 'iabp'), 3)
    const changed = settle(
      mcsReducer(before, { type: 'SET_PATIENT_CONTROL', control: 'heartRateBpm', value: 120 }),
      3,
    )
    const window = changed.waveforms.slice(-250)
    const points = ecgDisplayPoints(window, changed.patient.heartRateBpm)
    const byTime = new Map(points.map((point) => [point.time, point.value]))
    // Every stored sample is still a point on the line, whichever rate generated it.
    for (const sample of window as readonly McsWaveformSample[])
      expect(byTime.get(sample.time)).toBe(sample.ecgMv)
  })
})

describe('the trend’s scales and window', () => {
  it('starts at zero, keeps its default ceiling, and grows only in whole steps, saying so', () => {
    expect(fixedTrendAxis([71, 78], 160, 40)).toEqual({
      min: 0,
      max: 160,
      ticks: [0, 40, 80, 120, 160],
      extended: false,
    })
    const grown = fixedTrendAxis([150, 171], 160, 40)
    expect(grown.max).toBe(200)
    expect(grown.extended).toBe(true)
    expect(fixedTrendAxis([4.5, 4.5], 8, 2).ticks).toEqual([0, 2, 4, 6, 8])
  })

  it('spans the retained trend, at least ten and at most the window’s seconds', () => {
    const samples = Array.from({ length: 9 }, (_, index) => ({
      time: 2 + index * 0.5,
      mapMmHg: 70,
      effectiveFlowLMin: 4,
      deviceFlowLMin: 0,
      leftDeviceFlowLMin: 0,
      rightDeviceFlowLMin: 0,
      pcwpMmHg: 10,
      rapMmHg: 5,
    }))
    expect(trendWindow(samples, 40).span).toBe(10)
    const long = Array.from({ length: 400 }, (_, index) => ({ ...samples[0], time: index * 0.25 }))
    expect(trendWindow(long, 40).span).toBe(40)
    expect(trendTimeStep(10)).toBe(2)
    expect(trendTimeStep(40)).toBe(10)
    expect(trendTimeStep(120)).toBe(20)
  })

  it('prints the values it draws, untransformed, with their units', () => {
    const state = settle(createInitialMcsState('practice', 'impella'))
    render(
      <McsPressureFlowTrend
        samples={state.trends}
        windowSeconds={40}
        series={mcsMonitorTrendSeries('impella')}
      />,
    )
    const latest = state.trends[state.trends.length - 1]
    expect(document.querySelector('[data-trend-legend-item="left-pump"]')?.textContent).toContain(
      `now ${latest.leftDeviceFlowLMin.toFixed(1)} L/min`,
    )
    expect(document.querySelector('[data-trend-legend-item="map"]')?.textContent).toContain(
      `now ${latest.mapMmHg.toFixed(0)} mm Hg`,
    )
    expect(document.body.textContent).not.toMatch(/×\s?\d/)
  })

  it('draws only the channels a device has', () => {
    expect(mcsMonitorTrendSeries('iabp').map((series) => series.id)).toEqual([
      'map',
      'effective-flow',
    ])
    expect(mcsMonitorTrendSeries('lvad').map((series) => series.id)).toEqual([
      'map',
      'effective-flow',
      'durable-pump',
    ])
    expect(mcsMonitorTrendSeries('impella').map((series) => series.id)).toEqual([
      'map',
      'effective-flow',
      'left-pump',
      'right-pump',
    ])
  })
})
