import { fireEvent, render, screen, within } from '@testing-library/react'

import CardiohelpEcmoLab from '../components/CardiohelpEcmoLab'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import { createInitialSimulationState } from '../engine'

describe('CARDIOHELP VV and VA pathway isolation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
  })

  it('offers four isolated combinations: VV Learn, VV Practice, VA Learn, and VA Practice', () => {
    render(<CardiohelpEcmoLab />)

    const vvMode = screen.getByRole('radio', { name: /VV ECMO/i })
    const vaMode = screen.getByRole('radio', { name: /Peripheral VA ECMO/i })
    expect(vvMode).toHaveAttribute('aria-checked', 'true')
    expect(vvMode).toHaveAttribute('tabindex', '0')
    expect(vaMode).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: /VV Learn/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('progressbar', { name: /VV Learn progress/i })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(
      cardiohelpLearnLessonsBySupportMode.vv.length,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
    expect(
      screen.getByRole('img', { name: /VV ECMO femoral-femoral circuit schematic/i }),
    ).toBeInTheDocument()

    fireEvent.keyDown(vvMode, { key: 'ArrowRight' })
    expect(vaMode).toHaveAttribute('aria-checked', 'true')
    expect(vaMode).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /VA Learn/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(
      cardiohelpLearnLessonsBySupportMode.va.length,
    )
    expect(
      screen.getByRole('img', { name: /VA ECMO femoral-femoral circuit schematic/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Femoral artery return')).toBeInTheDocument()
    expect(screen.getAllByText('Right-arm SpO₂').length).toBeGreaterThan(0)

    fireEvent.keyDown(screen.getByRole('tab', { name: /VA Learn/i }), {
      key: 'ArrowRight',
    })
    expect(screen.getByRole('tab', { name: /VA Practice/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('progressbar', { name: /VA Practice progress/i })).toBeInTheDocument()
    const vaControl = screen.getByLabelText('First priority')
    expect(
      within(vaControl).queryByRole('option', { name: /VV off-sweep trial/i }),
    ).not.toBeInTheDocument()
    expect(
      within(vaControl).getByRole('option', { name: /right-arm oxygenation/i }),
    ).toBeInTheDocument()

    fireEvent.keyDown(vaMode, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: /VV Practice/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByRole('img', { name: /VV ECMO femoral-femoral circuit schematic/i }),
    ).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('tab', { name: /VV Practice/i }), {
      key: 'ArrowLeft',
    })
    expect(screen.getByRole('tab', { name: /VV Learn/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('reloads a clean walkthrough when support mode changes', () => {
    render(<CardiohelpEcmoLab />)
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Peripheral VA ECMO/i }))
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /VV ECMO/i }))
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()
    expect(window.localStorage.getItem('cardiohelp-ecmo-progress-v1')).toBeNull()
  })

  it('renders mode-specific cannulation and supports keyboard panning of the schematic', () => {
    const state = createInitialSimulationState('va-differential-hypoxemia')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    expect(screen.getByText(/femoral artery → arterial circulation/i)).toBeInTheDocument()
    expect(screen.getByText(/MIXING REGION VARIES/i)).toBeInTheDocument()
    expect(screen.getByText(/DISTAL LIMB CHECK/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Circuit pArt is post-oxygenator circuit pressure/i),
    ).toBeInTheDocument()

    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    const scrollBy = jest.fn()
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'smooth' })
  })

  it('uses non-animated keyboard panning when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    const state = createInitialSimulationState('startup-sensor-orientation')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    const scrollBy = jest.fn()
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'auto' })
  })
})
