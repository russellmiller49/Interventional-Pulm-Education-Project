import { act, fireEvent, render, screen, within } from '@testing-library/react'

import IcuHemodynamicsLab from '../components/IcuHemodynamicsLab'

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
        matches: false,
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
  })

  it('advances the PAC by waveform and exposes wedge and keyboard-capable thermodilution controls', async () => {
    render(<IcuHemodynamicsLab />)
    expect(await screen.findByText(/Tip: INTRODUCER · 12 cm/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: RA · 25 cm/i)).toBeInTheDocument()
    expect(screen.getByText(/tip is in the right atrium/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: RV · 35 cm/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    expect(screen.getByText(/Tip: PA · 45 cm/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inflate + capture' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Hold to inject · Space is timed/i })).toBeEnabled()
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
