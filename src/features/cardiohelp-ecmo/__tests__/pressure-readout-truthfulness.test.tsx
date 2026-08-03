import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
  type EcmoSimulationState,
} from '../engine'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { UNAVAILABLE_INDICATION } from '../components/channelReadout'

/**
 * A1 — pressure-readout truthfulness.
 *
 * The engine has always known when pVen, pInt, pArt and ΔP are not numerically supported. These
 * tests pin the other half of that claim: that no learner-facing surface prints the model's
 * zero-flow intercepts as though the console had measured them, that the reason is available to a
 * screen reader, and that the console and the circuit map never disagree about a channel.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

const PRESSURE_CHANNELS = ['pVen', 'pInt', 'pArt'] as const

function settle(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId)
  for (let step = 0; step < steps; step += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

/** The console tile for a channel, found by its label rather than by DOM position. */
function tileFor(container: HTMLElement, label: string): HTMLElement {
  const tile = [...container.querySelectorAll<HTMLElement>('[data-readout-status]')].find((node) =>
    node.textContent?.trim().startsWith(label),
  )
  if (!tile) throw new Error(`No readout tile found for ${label}`)
  return tile
}

describe('A1: pressure readouts on a stopped circuit', () => {
  it.each([['startup-sensor-orientation'], ['arterial-bubble-stop'], ['transport-power-loss']])(
    '%s reaches a frame whose pressure channels are unmodeled or flowing, never both',
    (id) => {
      const state = settle(id)
      for (const channel of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
        const readout = state.circuit.readouts[channel]
        if (state.circuit.bloodFlow === 0 && !state.device.pumpRunning) {
          expect(readout.status).not.toBe('valid')
          expect(readout.displayed).toBeNull()
        }
      }
    },
  )

  it.each([['startup-sensor-orientation'], ['arterial-bubble-stop']])(
    'shows dashes rather than the zero-flow intercept on the %s console',
    (id) => {
      const state = settle(id)
      expect(state.device.pumpRunning).toBe(false)
      expect(state.circuit.readouts.pVen.status).toBe('simulation-unmodeled')
      // The raw intercept still exists — it just must not reach the screen.
      expect(state.circuit.pVen).toBe(-25)

      const { container } = render(
        <CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />,
      )

      for (const channel of PRESSURE_CHANNELS) {
        const tile = tileFor(container, channel)
        expect(tile).toHaveAttribute('data-readout-status', 'simulation-unmodeled')
        expect(tile.textContent).toContain(UNAVAILABLE_INDICATION)
      }
      // -25 / 146 are the intercepts; neither may appear anywhere on the console.
      expect(container.textContent).not.toContain('-25')
      expect(container.textContent).not.toContain('146')
    },
  )

  it('keeps the transport screen honest as well as the startup and parameter screens', () => {
    const stopped = settle('transport-power-loss', 40)
    if (stopped.device.pumpRunning) {
      // The authored fault only moves this case to battery; if the pump is still running the
      // channels are genuinely modeled and there is nothing to suppress.
      expect(stopped.circuit.readouts.pVen.status).toBe('valid')
      return
    }

    for (const screenId of ['startup', 'parameters', 'transport'] as const) {
      const state = ecmoSimulationReducer(stopped, { type: 'SET_SCREEN', screen: screenId })
      const { container, unmount } = render(
        <CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />,
      )
      const tile = tileFor(container, 'pVen')
      expect(tile.textContent).toContain(UNAVAILABLE_INDICATION)
      expect(tile).toHaveAttribute('data-readout-status', 'simulation-unmodeled')
      unmount()
    }
  })

  it('explains in accessible text why a number is absent, and which kind of absence it is', () => {
    const state = settle('startup-sensor-orientation')
    const { container } = render(
      <CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />,
    )

    const tile = tileFor(container, 'pVen')
    const spoken = tile.querySelector('.sr-only')?.textContent ?? ''
    expect(spoken).toMatch(/pVen not available/i)
    // The distinction A1 exists to protect: this is a limit of the model, not a claim about the
    // device. The device-unavailable wording talks about the console's display range instead.
    expect(spoken).toMatch(/not modeled/i)
    expect(spoken).toMatch(/simulation/i)
    expect(spoken).not.toMatch(/range this console displays/i)
    expect(spoken).toBe(`pVen not available. ${state.circuit.readouts.pVen.reason}`)
  })

  it('raises no pressure alarm from a channel that is not reporting', () => {
    const state = settle('startup-sensor-orientation')
    expect(state.circuit.readouts.pVen.status).toBe('simulation-unmodeled')
    expect(
      state.alarms.filter((alarm) => ['pVen', 'pInt', 'pArt'].includes(alarm.parameter ?? '')),
    ).toHaveLength(0)

    // Scoping: suppressing pressure alarms must not silence anything else on a stopped circuit.
    const bubble = settle('arterial-bubble-stop')
    expect(bubble.alarms.some((alarm) => alarm.code === 'ART_BUBBLE')).toBe(true)
  })
})

describe('A1: console and circuit-map parity', () => {
  it.each([['startup-sensor-orientation'], ['arterial-bubble-stop']])(
    'renders the same availability on both surfaces for %s',
    (id) => {
      const state = settle(id)
      const consoleRender = render(
        <CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />,
      )
      const consoleText = tileFor(consoleRender.container, 'pVen').textContent ?? ''
      consoleRender.unmount()

      const map = render(
        <CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />,
      )
      const mapTile = map.container.querySelector<HTMLElement>('[data-channel="pVen"]')
      expect(mapTile).not.toBeNull()

      const bothUnavailable =
        consoleText.includes(UNAVAILABLE_INDICATION) &&
        (mapTile?.textContent ?? '').includes(UNAVAILABLE_INDICATION)
      expect(bothUnavailable).toBe(true)
      expect(mapTile).toHaveAttribute('data-readout-status', state.circuit.readouts.pVen.status)
    },
  )

  it('shows the number on both surfaces when the circuit is flowing', () => {
    const state = createReferenceSimulationState('vv-reference')
    expect(state.circuit.readouts.pVen.status).toBe('valid')
    const expected = String(state.circuit.readouts.pVen.displayed)

    const consoleRender = render(
      <CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />,
    )
    expect(tileFor(consoleRender.container, 'pVen').textContent).toContain(expected)
    consoleRender.unmount()

    const map = render(
      <CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    const mapTile = map.container.querySelector<HTMLElement>('[data-channel="pVen"]')
    expect(mapTile?.textContent).toContain(expected)
  })

  it('gives the circuit map a spoken reason rather than a bare dash', () => {
    const state = settle('startup-sensor-orientation')
    const { container } = render(
      <CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    const tile = container.querySelector<HTMLElement>('[data-channel="pVen"]')
    expect(within(tile as HTMLElement).getByText(/pVen not available/i).textContent).toContain(
      state.circuit.readouts.pVen.reason,
    )
  })

  it('refuses to read a pressure pattern off an uninterpretable frame', () => {
    const state = settle('startup-sensor-orientation')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    expect(
      screen.getByText(/pressure zones are not reporting an interpretable value/i),
    ).toBeInTheDocument()
  })
})

describe('A1: trend records only what was reportable', () => {
  it('stores null rather than the intercept for frames the model could not report', () => {
    const state = settle('startup-sensor-orientation')
    expect(state.trends.some((sample) => sample.pVen === null)).toBe(true)
    for (const sample of state.trends) {
      if (sample.pVen === null) continue
      expect(sample.pVen).not.toBe(-25)
    }
  })

  it('does not plot an unreported frame as a value, and says so', () => {
    const state = settle('startup-sensor-orientation')
    const { container } = render(
      <CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    const panel = container.querySelector<HTMLElement>('#cardiohelp-trend-panel') as HTMLElement
    // The trend panel opens on flow, which is always reportable; switch it to a pressure channel.
    fireEvent.click(within(panel).getByRole('tab', { name: 'pVen' }))

    // No polyline may be drawn from frames the model could not report.
    expect(panel.querySelectorAll('polyline')).toHaveLength(0)
    expect(within(panel).getByText(/not values of zero/i)).toBeInTheDocument()
    // And the headline value is the unavailable indication, not a number.
    expect(panel.querySelector('[data-readout-status]')?.textContent).toContain(
      UNAVAILABLE_INDICATION,
    )
  })

  it('still plots a channel the circuit is reporting', () => {
    const state = createReferenceSimulationState('vv-reference')
    const { container } = render(
      <CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />,
    )
    const panel = container.querySelector<HTMLElement>('#cardiohelp-trend-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('tab', { name: 'pVen' }))

    expect(panel.querySelectorAll('polyline').length).toBeGreaterThan(0)
    expect(within(panel).queryByText(/not values of zero/i)).toBeNull()
  })
})
