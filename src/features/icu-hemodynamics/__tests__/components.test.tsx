import { fireEvent, render, screen, within } from '@testing-library/react'

import { hemodynamicCases } from '../content'
import { FormulaDrawer } from '../components/FormulaDrawer'
import { PacActionDock } from '../components/PacActionDock'
import { ResizablePacWorkspace } from '../components/ResizablePacWorkspace'
import { createInitialHemodynamicState, icuHemodynamicsReducer } from '../engine'

/**
 * The Practice workspace parts: the resizable three-panel workspace, the PAC action dock, and the
 * derived-values drawer. The monolithic lab that once composed them into one page was retired when
 * Learn moved onto the shared lesson stage (2026-09-05); the case activity composes these now.
 */
describe('ICU Hemodynamics Practice workspace components', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    })
  })

  it('switches narrow workspaces to full-width accessible panel tabs', async () => {
    const boundsSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function mockWorkspaceBounds(this: HTMLElement) {
        const width = this.hasAttribute('data-pac-resize-handle') ? 12 : 900
        return {
          bottom: 600,
          height: 600,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }
      })

    try {
      render(
        <ResizablePacWorkspace
          monitor={<div>Monitor content</div>}
          physiology={<div>Anatomy content</div>}
          controls={<div>Activity content</div>}
        />,
      )

      fireEvent(window, new Event('resize'))

      expect(
        await screen.findByRole('tablist', { name: 'Workspace panel views' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Monitor' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Anatomy content').closest('[role="region"]')).toHaveAttribute(
        'hidden',
      )

      fireEvent.click(screen.getByRole('tab', { name: 'Activity' }))

      expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true')
      expect(
        screen.getByRole('region', { name: 'PAC controls and waveform-teaching panel' }),
      ).not.toHaveAttribute('hidden')
      expect(screen.getByText('Monitor content').closest('[role="region"]')).toHaveAttribute(
        'hidden',
      )
    } finally {
      boundsSpy.mockRestore()
    }
  })

  it('progresses wedge guidance from sampling through cursor, storage, and deflation', () => {
    const initial = icuHemodynamicsReducer(
      createInitialHemodynamicState(hemodynamicCases[0], 'learn', 8),
      { type: 'SET_CATHETER_POSITION', position: 'pa' },
    )
    const sampling = icuHemodynamicsReducer(initial, { type: 'START_WEDGE' })
    const dispatch = jest.fn()
    const { rerender } = render(<PacActionDock state={sampling} dispatch={dispatch} />)
    const wedgeStatus = () =>
      within(screen.getByRole('group', { name: 'Brief end-expiratory PAWP capture' })).getByRole(
        'status',
      )

    expect(wedgeStatus()).toHaveTextContent(/Sampling the respiratory cycle/i)

    const ready = {
      ...sampling,
      catheter: { ...sampling.catheter, wedgeCaptureReady: true },
    }
    rerender(<PacActionDock state={ready} dispatch={dispatch} />)
    expect(wedgeStatus()).toHaveTextContent(/Place the end-expiratory cursor/i)

    const cursor = icuHemodynamicsReducer(ready, { type: 'PLACE_WEDGE_CURSOR' })
    rerender(<PacActionDock state={cursor} dispatch={dispatch} />)
    expect(wedgeStatus()).toHaveTextContent(/Store PAWP, then deflate/i)
    expect(screen.getByRole('button', { name: 'End-exp cursor' })).toBeDisabled()

    const stored = icuHemodynamicsReducer(cursor, { type: 'STORE_WEDGE' })
    rerender(<PacActionDock state={stored} dispatch={dispatch} />)
    expect(wedgeStatus()).toHaveTextContent(/PAWP stored. Deflate now/i)

    const deflated = icuHemodynamicsReducer(stored, { type: 'DEFLATE_WEDGE' })
    rerender(<PacActionDock state={deflated} dispatch={dispatch} />)
    // H3 §7. The dock used to announce that the PA waveform had been restored, which answered the
    // question the sequence ends on before the learner could ask it. It now says the balloon is
    // down and hands the observation back.
    expect(wedgeStatus()).toHaveTextContent(/PAWP stored and balloon deflated/i)
    expect(wedgeStatus()).toHaveTextContent(/Confirm the return of the PA waveform yourself/i)
    expect(wedgeStatus()).not.toHaveTextContent(/PA waveform restored/i)
  })

  it('requires an explicit derived-value review action rather than awarding credit for disclosure', () => {
    const state = createInitialHemodynamicState(hemodynamicCases[0], 'learn', 18)
    const dispatch = jest.fn()
    render(<FormulaDrawer state={state} dispatch={dispatch} />)

    fireEvent.click(
      screen.getByText('Derived hemodynamics and interpretation limits', {
        selector: 'summary',
      }),
    )
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm input validity and interpretation limits reviewed',
      }),
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'VALIDATE_SIGNAL',
      check: 'derived-reviewed',
    })
  })
})
