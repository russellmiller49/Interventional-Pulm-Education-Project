import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { hemodynamicCases } from '../content'
import IcuHemodynamicsLab from '../components/IcuHemodynamicsLab'
import { PacActionDock } from '../components/PacActionDock'
import { createInitialHemodynamicState, icuHemodynamicsReducer } from '../engine'

describe('ICU Hemodynamics Lab learner interface', () => {
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

  it('renders the visible safety boundary, original monitor, accessible traces, and text-equivalent physiology', async () => {
    render(<IcuHemodynamicsLab />)
    expect(screen.getByRole('heading', { name: 'ICU Hemodynamics Lab' })).toBeInTheDocument()
    expect(screen.getByText('unlisted preview')).toBeInTheDocument()
    expect(screen.getByText(/Educational model—not a clinical device/i)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: /Vendor-neutral simulated ICU bedside monitor/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ECG II waveform over/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ART waveform over/i })).toBeInTheDocument()
    expect(screen.getByText(/Waveform text: ART waveform/i)).toBeInTheDocument()
    expect(screen.getByText(/Visual text equivalent:/i)).toBeInTheDocument()
    expect(await screen.findByText(/Tip: INTRODUCER · 12 cm/i)).toBeInTheDocument()
    expect(screen.getByText(/superior vena cava entry/i)).toBeInTheDocument()
    expect(screen.getByText(/Aortic cusps are segmented/i)).toBeInTheDocument()
    expect(screen.getByText(/route\/orifice proxies only/i)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Advance by waveform and route gate' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tricuspid and pulmonic gates orient the CT-derived route/i),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Advance' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Inflate briefly' })).toHaveLength(1)
  })

  it('advances the PAC by waveform and exposes wedge and keyboard-capable thermodilution controls', async () => {
    render(<IcuHemodynamicsLab />)
    expect(await screen.findByText(/Tip: INTRODUCER · 12 cm/i)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Introducer / SVC' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: RA · 25 cm/i)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Right atrium' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByText(/tip is in the right atrium/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: RV · 35 cm/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: PA · 45 cm/i)).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Brief end-expiratory PAWP capture' }),
    ).toBeInTheDocument()
    const inflate = screen.getByRole('button', { name: 'Inflate briefly' })
    expect(inflate).toBeEnabled()
    fireEvent.click(inflate)
    expect(screen.getByText(/Tip: WEDGE · 45 cm/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retract' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deflate now' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Hold to inject · Space is timed/i })).toBeEnabled()
  })

  it('keeps one canonical PAC dock available while switching compact workspace surfaces', async () => {
    render(<IcuHemodynamicsLab />)
    expect(await screen.findByText(/Tip: INTRODUCER · 12 cm/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'physiology' }))
    expect(screen.getByRole('button', { name: 'physiology' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: RA · 25 cm/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'tasks' }))
    expect(screen.getByRole('button', { name: 'tasks' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: 'Advance' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Inflate briefly' })).toHaveLength(1)
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
    expect(wedgeStatus()).toHaveTextContent(/Balloon deflated and PA waveform restored/i)
  })

  it('requires commit-before-intervention in Practice and reveals scored workflow only after selection', async () => {
    render(<IcuHemodynamicsLab />)
    fireEvent.click(screen.getByRole('tab', { name: 'Eight cases' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }))
    expect(
      screen.queryByRole('region', { name: /Case score and debrief/i }),
    ).not.toBeInTheDocument()

    const plr = screen.getByRole('button', { name: /PLR/i })
    expect(plr).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Suspected hemodynamic mechanism'), {
      target: { value: 'underfilled' },
    })
    fireEvent.change(screen.getByLabelText('Immediate management priority'), {
      target: { value: 'validate-preload' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit phenotype + priority' }))
    expect(screen.getByRole('button', { name: 'Prediction locked' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /PLR/i })).toBeEnabled()
  })

  it('uses only the aggregate analytics contract and persists no physiologic trace data', async () => {
    render(<IcuHemodynamicsLab />)
    fireEvent.click(screen.getByRole('tab', { name: 'Eight cases' }))
    await act(async () => Promise.resolve())
    const fetchMock = global.fetch as jest.Mock
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string)
    expect(body.moduleId).toBe('icu-hemodynamics')
    expect(body.eventPayload).toEqual(
      expect.objectContaining({
        caseId: 'HD-01',
        workspace: 'cases',
        pathway: 'learn',
      }),
    )
    expect(JSON.stringify(body)).not.toMatch(
      /waveform|pressure|cardiacOutput|presentation|freeText/i,
    )
  })

  it('shows an explicit English fallback for non-English routes', () => {
    render(<IcuHemodynamicsLab locale="es" />)
    const fallback = screen.getByText(/Reviewed-English fallback:/i).closest('section')
    expect(fallback).toBeInTheDocument()
    expect(within(fallback!).getByText(/localized clinical review is pending/i)).toBeInTheDocument()
  })
})
