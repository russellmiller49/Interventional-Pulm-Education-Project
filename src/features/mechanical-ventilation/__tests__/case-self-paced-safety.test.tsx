/** The public case replaces graded CaseWorkflow orchestration, preserving actual action timing. */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import CaseActivity from '../components/MechanicalVentilationCaseActivityV2'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { createInitialSimulationState } from '../engine/simulation'
import type { VentilationSimulationState } from '../engine/types'

let state: VentilationSimulationState
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
}))
jest.mock('../components/MechanicalVentilatorConsole', () => ({
  MechanicalVentilatorConsole: (props: { state: VentilationSimulationState }) => {
    state = props.state
    return <p>Console observed by test</p>
  },
}))
beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})
const tick = (seconds: number) => act(() => jest.advanceTimersByTime(seconds * 1000))
function action(id: string) {
  const label = mechanicalVentilationCaseById
    .get('MV-08')!
    .interventions.find((item) => item.id === id)!.label
  return screen.getByRole('button', { name: label })
}

it.each(['practice', 'assess'] as const)(
  '%s preserves actual prerequisites and delayed coaching without answering',
  (section) => {
    render(
      <CaseActivity caseId="MV-08" deviceId="hamilton-c6" mode="challenge" section={section} />,
    )
    tick(0.01)
    expect(action('drain-condensate')).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
    expect(action('drain-condensate')).toBeDisabled()
    expect(state.interventions).toEqual([])
    fireEvent.click(action('inspect-circuit'))
    expect(action('drain-condensate')).toBeEnabled()
    fireEvent.click(action('drain-condensate'))
    expect(state.prediction.committed).toBe(false)
    expect(state.interventions.map((item) => item.interventionId)).toEqual([
      'inspect-circuit',
      'drain-condensate',
    ])
    expect(document.querySelector('[data-mv-post-action-coaching]')).toBeNull()
    tick(30)
    expect(state.simulationTime).toBe(0)
    expect(document.querySelector('[data-mv-post-action-coaching]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Run physiology' }))
    tick(5)
    expect(document.querySelector('[data-mv-post-action-coaching]')).toBeNull()
    tick(30)
    expect(document.querySelector('[data-mv-post-action-coaching]')).not.toBeNull()
    expect(state.prediction.committed).toBe(false)
    expect(screen.getAllByRole('link', { name: 'Continue to another case' })).toHaveLength(2)
  },
)

it('starts another transient patient variation and restarts that same variation without saving an attempt', () => {
  render(<CaseActivity caseId="MV-01" deviceId="hamilton-c6" mode="practice" section="practice" />)
  tick(0.01)
  const secondVariation = createInitialSimulationState('MV-01', 'practice', 2)
  fireEvent.click(screen.getByRole('button', { name: 'Try another variation' }))
  expect(state.seed).toBe(secondVariation.seed)
  expect(state.simulationTime).toBe(0)
  expect(state.paused).toBe(true)
  expect(state.interventions).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'One breath' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restart patient' }))
  expect(state.seed).toBe(secondVariation.seed)
  expect(state.simulationTime).toBe(0)
  expect(state.prediction.committed).toBe(false)
  expect(localStorage.getItem('mechanical-ventilation-progress-v2')).toBeNull()
  expect(localStorage.getItem('mechanical-ventilation-session-v1')).toBeNull()
})

it('shows an immediate safety interruption without an answer or a delayed coaching result', () => {
  render(<CaseActivity caseId="MV-15" deviceId="hamilton-c6" mode="practice" section="practice" />)
  tick(0.01)
  const intervention = mechanicalVentilationCaseById
    .get('MV-15')!
    .interventions.find((item) => item.id === 'deepen-sedation')!
  fireEvent.click(screen.getByRole('button', { name: intervention.label }))
  expect(screen.getByRole('alert', { name: 'Safety interruption' })).toHaveTextContent(
    'Deep sedation before assessing pain, dyspnea, and delirium',
  )
  expect(state.prediction.committed).toBe(false)
  expect(document.querySelector('[data-mv-post-action-coaching]')).toBeNull()
  expect(screen.getAllByRole('link', { name: 'Continue to another case' })).toHaveLength(2)
})
