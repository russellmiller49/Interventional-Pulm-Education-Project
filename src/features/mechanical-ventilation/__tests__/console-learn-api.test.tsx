/**
 * The console's Learn-facing props (October 2026): observe mode, the "Show me where" mark, the
 * frozen breath drawn in place of the live traces, and the pending-edit report. A console without
 * any of them renders as it always has.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import { ventilationReferenceMarker } from '../content/referenceEvidence'
import { createLabSimulation, openLabRound } from '../engine/learningLab'
import { ventilationSimulationReducer } from '../engine/reducer'

afterEach(cleanup)

const state = (device: Parameters<typeof createLabSimulation>[2] = 'hamilton-c6') =>
  ({ ...createLabSimulation('controls-and-goals', 0, device), paused: true }) as const

describe('MechanicalVentilatorConsole Learn props', () => {
  it('observe mode disables every therapy change but keeps the screens navigable', () => {
    const dispatch = jest.fn()
    const controls = ventilationSimulationReducer(state(), {
      type: 'SET_SCREEN',
      screen: 'controls',
    })
    render(
      <MechanicalVentilatorConsole
        state={controls}
        dispatch={dispatch}
        controlsEnabled
        mode="observe"
      />,
    )
    expect(document.querySelector('[data-console-mode="observe"]')).not.toBeNull()
    expect(document.getElementById('mv-control-vtMl')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Increase selected control' })).toBeDisabled()
    fireEvent.click(document.getElementById('mv-screen-tools')!)
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'tools' })
  })

  it('marks only the control "Show me where" names', () => {
    render(
      <MechanicalVentilatorConsole
        state={state()}
        dispatch={jest.fn()}
        controlsEnabled
        guidedControlId="mv-screen-controls"
      />,
    )
    const marked = document.querySelectorAll('[data-guided-help="true"]')
    expect(marked).toHaveLength(1)
    expect(marked[0].id).toBe('mv-screen-controls')
  })

  it('draws a frozen breath in place of the live traces, on the main screen only', () => {
    const opening = openLabRound('breathing-with-support', 0, 'hamilton-c6')
    const marker = ventilationReferenceMarker('breathing-with-support', 0)!
    const inspection = {
      samples: opening.baselineRecord,
      label: 'Baseline breath · interval A',
      marker,
      revealMarkerEvidence: false,
      effort: false,
    }
    const { rerender } = render(
      <MechanicalVentilatorConsole
        state={{ ...opening.simulation, paused: true }}
        dispatch={jest.fn()}
        controlsEnabled
        inspection={inspection}
      />,
    )
    const figure = document.querySelector('[data-frozen-breath] [data-captured-breath]')!
    expect(figure).not.toBeNull()
    expect(document.querySelector('[data-waveform-strip]')).toBeNull()
    // Before the prediction: the letter is drawn, the evidence is not said.
    expect(figure.getAttribute('data-marker-evidence')).toBe('withheld')
    expect(figure.querySelector('[data-marker-note="A"]')?.textContent).toBe(
      'Interval A is marked on this breath.',
    )
    expect(figure.querySelector('svg')?.getAttribute('aria-label')).not.toMatch(
      /gas moving|volume (rising|falling)/,
    )
    expect(figure.querySelectorAll('[data-marker-letter="A"]')).toHaveLength(3)
    // The provenance paragraphs are folded under the console, not printed on its screen.
    expect(figure.querySelector('[data-volume-anchor]')).toBeNull()
    rerender(
      <MechanicalVentilatorConsole
        state={{ ...opening.simulation, paused: true }}
        dispatch={jest.fn()}
        controlsEnabled
        inspection={{ ...inspection, revealMarkerEvidence: true }}
      />,
    )
    expect(document.querySelector('[data-marker-note="A"]')?.textContent).toMatch(
      /gas moving out\) and volume falling/,
    )
    const tools = ventilationSimulationReducer(
      { ...opening.simulation, paused: true },
      { type: 'SET_SCREEN', screen: 'tools' },
    )
    rerender(
      <MechanicalVentilatorConsole
        state={tools}
        dispatch={jest.fn()}
        controlsEnabled
        inspection={inspection}
      />,
    )
    expect(document.querySelector('[data-frozen-breath]')).toBeNull()
  })

  it('takes the Evita’s light palette for a frozen breath on its white screen', () => {
    const opening = openLabRound('breathing-with-support', 0, 'drager-evita-v800-v600')
    render(
      <MechanicalVentilatorConsole
        state={{ ...opening.simulation, paused: true }}
        dispatch={jest.fn()}
        controlsEnabled
        inspection={{
          samples: opening.baselineRecord,
          label: 'Your last breath',
          revealMarkerEvidence: true,
          effort: false,
        }}
      />,
    )
    expect(document.querySelector('[data-captured-breath]')?.getAttribute('data-palette')).toBe(
      'light',
    )
  })

  it('reports a pending edit on a knob-and-confirm console, and clears it once confirmed', () => {
    const onPendingChange = jest.fn()
    const controls = ventilationSimulationReducer(state('puritan-bennett-980'), {
      type: 'SET_SCREEN',
      screen: 'controls',
    })
    const dispatch = jest.fn()
    render(
      <MechanicalVentilatorConsole
        state={controls}
        dispatch={dispatch}
        controlsEnabled
        onPendingChange={onPendingChange}
      />,
    )
    fireEvent.click(document.getElementById('mv-control-vtMl')!)
    fireEvent.keyDown(document.getElementById('mv-control-vtMl')!, { key: 'ArrowUp' })
    expect(onPendingChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'vtMl', nativeNumeric: true }),
    )
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_CONTROL' }))
    fireEvent.click(document.getElementById('mv-pending-confirm')!)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_CONTROL' }))
    expect(onPendingChange).toHaveBeenLastCalledWith(null)
  })
})
