import { cleanup, render, screen } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { describeObservedSystemState, observedSystemState } from '../engine/decisionRecord'
import { capstoneState, cleanState, reduceAll } from '../engine/stageRuntime'
import type { HemodynamicSimulationState } from '../engine/types'

afterEach(cleanup)

/**
 * Sanity-review repair, blocker 3 (independent review of `78a4bdcb`).
 *
 * The provenance adapter called its pressures "displayed" while reading `state.measurements`, which
 * is the model's own derivation. The monitor prints something else: the arterial mean is the mean
 * of the most recent displayed cardiac cycle, and the right-atrial number is the end-expiratory
 * sample at the base of the c wave. On `capstoneState(808)` eight seconds in, the monitor showed 69
 * while the record certified 68 as the displayed value.
 *
 * `monitorPressureReadouts` is now the one place either of them is computed, so a divergence like
 * that cannot be reintroduced without changing what the monitor itself prints. These tests read the
 * number off the rendered rail rather than recomputing it.
 */
/** The mean arterial pressure exactly as the monitor's rail prints it. */
function monitorArterialMean(): number {
  const printed =
    screen.getByRole('group', { name: 'Systemic arterial pressure' }).textContent ?? ''
  const match = /trace MAP (-?\d+)/.exec(printed)
  if (!match) throw new Error(`No trace MAP in "${printed}"`)
  return Number(match[1])
}

/** The central venous / right-atrial number exactly as the monitor's rail prints it. */
function monitorRightAtrialMean(): number {
  const printed =
    screen.getByRole('group', { name: 'Central venous pressure' }).querySelector('strong')
      ?.textContent ?? ''
  const parsed = Number(printed)
  if (!Number.isFinite(parsed)) throw new Error(`No numeric in "${printed}" for CVP / RAP`)
  return parsed
}

describe('a record of a displayed pressure is the pressure that was displayed', () => {
  const cases: readonly [string, () => HemodynamicSimulationState][] = [
    [
      'the capstone eight seconds in — the reviewer’s own reproduction',
      () => reduceAll(capstoneState(808), [{ type: 'TICK', seconds: 8 }]),
    ],
    [
      'a levelled, zeroed teaching patient',
      () => reduceAll(cleanState(510, 'pa'), [{ type: 'TICK', seconds: 8 }]),
    ],
    [
      'a damped line, where the trace mean and the model estimate separate',
      () =>
        reduceAll(cleanState(611, 'pa'), [
          { type: 'SET_DAMPING', dampingRatio: 1.15 },
          { type: 'TICK', seconds: 8 },
        ]),
    ],
    [
      'a right-atrial position',
      () => reduceAll(cleanState(540, 'ra'), [{ type: 'TICK', seconds: 8 }]),
    ],
  ]

  it.each(cases)('matches the monitor for %s', (_name, build) => {
    const state = build()
    render(<BedsideMonitor state={state} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)

    const observed = observedSystemState(state)
    expect(observed.arterialMean.displayedMmHg).toBe(monitorArterialMean())
    expect(observed.rightAtrialMean.displayedMmHg).toBe(monitorRightAtrialMean())

    const sentence = describeObservedSystemState(observed)
    expect(sentence).toContain(`MAP ${observed.arterialMean.displayedMmHg} mmHg`)
    expect(sentence).toContain(`right atrial mean ${observed.rightAtrialMean.displayedMmHg} mmHg`)
  })

  it('names the sampling window and the validation state, and acquires no cardiac output', () => {
    const state = reduceAll(capstoneState(808), [{ type: 'TICK', seconds: 8 }])
    const sentence = describeObservedSystemState(observedSystemState(state))
    expect(sentence).toMatch(/MAP \d+ mmHg \(monitor, last cardiac cycle; line not yet zeroed\)/)
    expect(sentence).toMatch(
      /right atrial mean \d+ mmHg \(monitor, end-expiratory c-wave base; line not yet zeroed\)/,
    )
    expect(sentence).toMatch(/cardiac index not acquired/)

    const zeroed = reduceAll(state, [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'ZERO_TRANSDUCER' },
      { type: 'TICK', seconds: 2 },
    ])
    expect(describeObservedSystemState(observedSystemState(zeroed))).toMatch(
      /monitor, last cardiac cycle; levelled and zeroed/,
    )
  })
})
