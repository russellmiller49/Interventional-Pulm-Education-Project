/**
 * The old "Simplified dynamic lung panel" on the console's Graphics screen prints static
 * compliance, the resistive gap and the patient's effort, so a case could be solved by reading it.
 * The author's ruling of 2026-11-12: "Hide it in cases, keep it in the lab". Every case host — a
 * Practice case, an Assess case and a case run as a section's last task — opens the console
 * without it; the open lab keeps it. The Learn console never showed it.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import MechanicalVentilationLabRoute from '@/app/[locale]/mechanical-ventilation/practice/lab/page'

import MechanicalVentilationCaseActivityV2 from '../components/MechanicalVentilationCaseActivityV2'
import MechanicalVentilationLab from '../components/MechanicalVentilationLab'
import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import { MechanicalVentilationPracticePicker } from '../components/MechanicalVentilationPracticePicker'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { MECHANICAL_VENTILATION_LAB_HREF } from '../content/ventilationLab'
import { createInitialSimulationState } from '../engine'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const PANEL = 'Simplified dynamic lung panel'
const panel = () => screen.queryByRole('region', { name: PANEL })

/** Open the Graphics screen on every console on the page. */
function openGraphics() {
  for (const button of screen.getAllByRole('button', { name: 'Graphics' })) {
    act(() => {
      fireEvent.click(button)
    })
  }
  act(() => jest.advanceTimersByTime(10))
}

describe('the old lung panel', () => {
  it('is off unless a host asks for it', () => {
    const state = createInitialSimulationState('MV-14', 'practice')
    render(<MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />)
    openGraphics()
    expect(panel()).toBeNull()
  })

  it.each(['practice', 'assess'] as const)('is not shown in a %s case', (section) => {
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-01"
        deviceId="hamilton-c6"
        mode="practice"
        section={section}
      />,
    )
    act(() => jest.advanceTimersByTime(10))
    openGraphics()
    expect(screen.getAllByRole('button', { name: 'Graphics' }).length).toBeGreaterThan(0)
    expect(panel()).toBeNull()
    expect(document.body.textContent).not.toMatch(/Resistive gap/)
  })

  it('is not shown in a case run as a section’s last task', () => {
    render(<VentilationStageHost unitId="expiration-and-air-trapping" />)
    act(() => jest.advanceTimersByTime(10))
    const rows = [...document.querySelectorAll<HTMLLIElement>('[data-step-list] li')].filter(
      (row) => !row.hasAttribute('data-case-row'),
    )
    act(() => {
      fireEvent.click(rows.at(-1)!.querySelector('button')!)
    })
    act(() => jest.advanceTimersByTime(10))
    const card = document.querySelector<HTMLElement>('[data-now-card]')!
    act(() => {
      fireEvent.click(within(card).getByRole('button', { name: 'Continue to the case' }))
    })
    act(() => jest.advanceTimersByTime(10))
    expect(document.querySelector('[data-section-case]')).not.toBeNull()
    openGraphics()
    expect(panel()).toBeNull()
  })

  it('is still shown in the open lab', () => {
    render(<MechanicalVentilationLab />)
    act(() => jest.advanceTimersByTime(10))
    openGraphics()
    expect(panel()).not.toBeNull()
  })
})

/*
 * "Link the lab from Practice" (author's ruling, 2026-11-15): the lab has a route under Practice,
 * Practice links to it, and the route shows the panel the cases leave off.
 */
describe('the lab’s route under Practice', () => {
  it('is linked from the Practice landing', () => {
    render(<MechanicalVentilationPracticePicker />)
    act(() => jest.advanceTimersByTime(10))
    const entry = document.querySelector<HTMLElement>('[data-practice-lab]')!
    expect(within(entry).getByRole('heading', { name: 'Ventilator lab' })).toBeInTheDocument()
    expect(within(entry).getByRole('link', { name: 'Open the ventilator lab' })).toHaveAttribute(
      'href',
      MECHANICAL_VENTILATION_LAB_HREF,
    )
    expect(MECHANICAL_VENTILATION_LAB_HREF).toBe('/mechanical-ventilation/practice/lab')
  })

  it('renders the lab in the module frame, with the panel on its Graphics screen', async () => {
    render(await MechanicalVentilationLabRoute({ params: Promise.resolve({ locale: 'en' }) }))
    act(() => jest.advanceTimersByTime(10))
    expect(screen.getByRole('heading', { level: 1, name: 'Ventilator lab' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Mechanical ventilation module' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Practice' })).toHaveAttribute(
      'href',
      '/mechanical-ventilation/practice',
    )
    // The stand-alone lab's own header, release badge and build labels stay off this route.
    for (const text of [
      'Learn & Practice simulator',
      'Unlisted tester preview',
      'Calibration case',
      'Training only.',
    ])
      expect([text, document.body.textContent?.includes(text)]).toEqual([text, false])
    openGraphics()
    expect(panel()).not.toBeNull()
  })
})
