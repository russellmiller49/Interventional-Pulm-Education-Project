import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { PatientMonitor } from '../components/CircuitAndMonitors'
import { ArterialPressureTrace } from '../components/monitor/ArterialPressureTrace'
import {
  ARTERIAL_TRACE_AXIS,
  ARTERIAL_TRACE_MEAN_FRACTION,
  ARTERIAL_TRACE_SECONDS,
  LOW_PULSATILITY_BELOW_MMHG,
  arterialTraceDescription,
  arterialTracePath,
  arterialTracePoints,
  arterialTraceY,
  type ArterialTraceInput,
} from '../components/monitor/arterialTrace'
import { cardiohelpScenarios } from '../content/scenarios'
import { LV_UNLOADING_RESPONSE, createInitialSimulationState } from '../engine'
import type { EcmoSimulationState } from '../engine/types'

// The monitor's module reaches next-intl navigation through the launch gate; Jest cannot parse it.
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

/**
 * The arterial line on the bedside monitor (November 2026).
 *
 * Loss of pulsatility on VA support was a number and a sentence. It is now a trace, and the whole
 * contract is that the trace says nothing the patient model does not: its mean is the model's mean
 * arterial pressure, its height is the model's pulse pressure, its beats are the model's heart
 * rate, and the notch follows the model's aortic-valve row.
 */

const ejecting: ArterialTraceInput = {
  meanArterialPressure: 70,
  pulsePressure: 18,
  heartRate: 92,
  aorticValveOpening: true,
}

function pressures(input: ArterialTraceInput): number[] {
  return arterialTracePoints(input).map((point) => point.pressure)
}

/** Time-weighted mean over whole beats only, so a part beat at the strip's end does not bias it. */
function meanOverWholeBeats(input: ArterialTraceInput): number {
  const beat = 60 / input.heartRate
  const whole = Math.floor(ARTERIAL_TRACE_SECONDS / beat) * beat
  const points = arterialTracePoints(input).filter((point) => point.seconds < whole - 1e-9)
  return points.reduce((sum, point) => sum + point.pressure, 0) / points.length
}

/** Local minima strictly inside one beat: an ejecting beat has one, at its notch. */
function notchesPerBeat(input: ArterialTraceInput): number {
  const beat = 60 / input.heartRate
  const values = arterialTracePoints(input).filter((point) => point.seconds < beat - 1e-9)
  let count = 0
  for (let index = 1; index < values.length - 1; index += 1) {
    if (
      values[index].pressure < values[index - 1].pressure &&
      values[index].pressure < values[index + 1].pressure
    ) {
      count += 1
    }
  }
  return count
}

const vaScenarios = cardiohelpScenarios.filter((scenario) => scenario.supportMode === 'va')

describe('the trace is the patient model, drawn', () => {
  const cases: ArterialTraceInput[] = [
    ejecting,
    { ...ejecting, pulsePressure: 35, meanArterialPressure: 80 },
    { ...ejecting, pulsePressure: 5, meanArterialPressure: 65, aorticValveOpening: false },
    { ...ejecting, pulsePressure: 12, meanArterialPressure: 62, heartRate: 124 },
  ]

  it.each(cases)('is as tall as the pulse pressure ($pulsePressure mmHg)', (input) => {
    const values = pressures(input)
    expect(Math.max(...values) - Math.min(...values)).toBeCloseTo(input.pulsePressure, 6)
  })

  it.each(cases)(
    'has the mean arterial pressure as its mean ($meanArterialPressure mmHg)',
    (input) => {
      expect(meanOverWholeBeats(input)).toBeCloseTo(input.meanArterialPressure, 6)
    },
  )

  it.each(cases)('beats at the heart rate ($heartRate per minute)', (input) => {
    const values = arterialTracePoints(input)
    const peak = Math.max(...values.map((point) => point.pressure))
    const peaks = values.filter((point) => Math.abs(point.pressure - peak) < 1e-9)
    // One peak per beat begun inside the strip.
    const beatsBegun = Math.ceil((ARTERIAL_TRACE_SECONDS * input.heartRate) / 60 - 1e-9)
    expect(Math.abs(peaks.length - beatsBegun)).toBeLessThanOrEqual(1)
    const spacing = peaks[1].seconds - peaks[0].seconds
    expect(spacing).toBeCloseTo(60 / input.heartRate, 6)
  })

  it.each(cases)(
    'sits a third of the way up: the trough is the mean less a third of the pulse pressure',
    (input) => {
      const values = pressures(input)
      expect(ARTERIAL_TRACE_MEAN_FRACTION).toBeCloseTo(1 / 3, 12)
      // The convention mean = diastolic + pulse pressure / 3, read off the drawing.
      expect(Math.min(...values)).toBeCloseTo(
        input.meanArterialPressure - input.pulsePressure / 3,
        3,
      )
      expect(Math.max(...values)).toBeCloseTo(
        input.meanArterialPressure + (2 * input.pulsePressure) / 3,
        3,
      )
    },
  )

  it('covers the strip exactly, start to end', () => {
    const values = arterialTracePoints(ejecting)
    expect(values[0].seconds).toBe(0)
    expect(values[values.length - 1].seconds).toBe(ARTERIAL_TRACE_SECONDS)
    expect(arterialTracePath(ejecting).startsWith('M0.0,')).toBe(true)
  })

  it('draws the notch only while the monitor reports the aortic valve opening', () => {
    expect(notchesPerBeat(ejecting)).toBe(1)
    expect(notchesPerBeat({ ...ejecting, aorticValveOpening: false })).toBe(0)
  })

  it('is flat when there is no pulse pressure, and sits on the mean', () => {
    const values = pressures({ ...ejecting, pulsePressure: 0, aorticValveOpening: false })
    expect(new Set(values.map((value) => value.toFixed(6)))).toEqual(new Set(['70.000000']))
  })

  it('keeps one pressure axis, so the same pulse is the same height in every state', () => {
    expect(arterialTraceY(ARTERIAL_TRACE_AXIS.max)).toBeLessThan(
      arterialTraceY(ARTERIAL_TRACE_AXIS.min),
    )
    const height = (input: ArterialTraceInput) => {
      const values = pressures(input)
      return arterialTraceY(Math.min(...values)) - arterialTraceY(Math.max(...values))
    }
    // The same pulse pressure at two different mean pressures.
    expect(height({ ...ejecting, meanArterialPressure: 60 })).toBeCloseTo(
      height({ ...ejecting, meanArterialPressure: 80 }),
      6,
    )
    // A pressure off the axis is held at its edge, never drawn outside the strip.
    expect(arterialTraceY(400)).toBe(arterialTraceY(ARTERIAL_TRACE_AXIS.max))
    expect(arterialTraceY(-50)).toBe(arterialTraceY(ARTERIAL_TRACE_AXIS.min))
  })

  it.each(vaScenarios.map((scenario) => [scenario.id] as const))(
    'holds for the opening state of %s',
    (scenarioId) => {
      const { patient } = createInitialSimulationState(scenarioId)
      const values = pressures(patient)
      expect(Math.max(...values) - Math.min(...values)).toBeCloseTo(patient.pulsePressure, 6)
      expect(meanOverWholeBeats(patient)).toBeCloseTo(patient.meanArterialPressure, 6)
      // Every opening state fits the strip's axis.
      expect(Math.max(...values)).toBeLessThanOrEqual(ARTERIAL_TRACE_AXIS.max)
      expect(Math.min(...values)).toBeGreaterThanOrEqual(ARTERIAL_TRACE_AXIS.min)
    },
  )
})

describe('a ventricle that is not ejecting', () => {
  const loading = createInitialSimulationState('va-lv-loading')

  it('opens the LV-loading lesson on a nearly flat trace with no notch', () => {
    expect(loading.patient.pulsePressure).toBe(
      LV_UNLOADING_RESPONSE.settledByMoves[0].pulsePressure,
    )
    expect(loading.patient.pulsePressure).toBeLessThan(LOW_PULSATILITY_BELOW_MMHG)
    expect(loading.patient.aorticValveOpening).toBe(false)
    render(<ArterialPressureTrace patient={loading.patient} />)
    const figure = document.querySelector('[data-arterial-trace]')!
    expect(figure).toHaveAttribute('data-low-pulsatility', 'true')
    expect(figure).not.toHaveAttribute('data-notch')
    expect(screen.getByRole('img')).toHaveAccessibleName(arterialTraceDescription(loading.patient))
    expect(arterialTraceDescription(loading.patient)).toContain('nearly flat: low pulsatility')
    expect(arterialTraceDescription(loading.patient)).toContain(
      'No notch is drawn, because aortic-valve opening is not observed.',
    )
  })

  it('opens as the model moves through the lesson: 5, then 8, then 12 mmHg', () => {
    const heights = LV_UNLOADING_RESPONSE.settledByMoves.map((settled) => {
      const values = pressures({
        ...loading.patient,
        pulsePressure: settled.pulsePressure,
        aorticValveOpening: settled.pulsePressure >= LV_UNLOADING_RESPONSE.ejectingPulsePressure,
      })
      return Math.max(...values) - Math.min(...values)
    })
    expect(heights).toEqual(
      LV_UNLOADING_RESPONSE.settledByMoves.map((settled) =>
        expect.closeTo(settled.pulsePressure, 6),
      ),
    )
    expect(heights[0]).toBeLessThan(heights[1])
    expect(heights[1]).toBeLessThan(heights[2])
  })

  it('uses the monitor row\'s own line for "low pulsatility"', () => {
    const at = (pulsePressure: number) => arterialTraceDescription({ ...ejecting, pulsePressure })
    expect(at(LOW_PULSATILITY_BELOW_MMHG - 1)).toContain('low pulsatility')
    expect(at(LOW_PULSATILITY_BELOW_MMHG)).toContain('The trace is pulsatile.')
  })
})

describe('on the bedside monitor', () => {
  function monitor(state: EcmoSimulationState) {
    return render(<PatientMonitor state={state} />)
  }

  it("is drawn on VA support, above the readings, with the monitor's own numbers", () => {
    const state = createInitialSimulationState('va-lv-loading')
    const { container } = monitor(state)
    const trace = container.querySelector('[data-arterial-trace]')!
    expect(trace).not.toBeNull()
    expect(trace).toHaveTextContent(
      `MAP ${state.patient.meanArterialPressure} mmHg · pulse pressure ${state.patient.pulsePressure} mmHg`,
    )
    // Above the grid of readings, inside the monitor.
    const grid = container.querySelector('[data-patient-signal="map"]')!.parentElement!
    expect(trace.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('#cardiohelp-patient-monitor')!.contains(trace)).toBe(true)
    // The same path the arithmetic gives for this patient.
    expect(trace.querySelector('[data-trace-line]')).toHaveAttribute(
      'd',
      arterialTracePath(state.patient),
    )
  })

  it('is not drawn on VV support, where the monitor reports no pulse pressure', () => {
    const { container } = monitor(createInitialSimulationState('preload-drainage-collapse'))
    expect(container.querySelector('[data-arterial-trace]')).toBeNull()
    expect(container).not.toHaveTextContent('Pulse pressure')
  })

  it('adds no caveat, score word or builder word to the monitor', () => {
    const { container } = monitor(createInitialSimulationState('va-lv-loading'))
    const text = container.querySelector('[data-arterial-trace]')!.textContent ?? ''
    expect(text).not.toMatch(/model|simulat|schematic|illustrat|not to scale|score|points/i)
  })
})
