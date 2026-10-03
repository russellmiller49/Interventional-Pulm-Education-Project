import type { ComponentProps, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { standardTechnique } from '../engine/stageRuntime'
import { installDom, mountSection } from '../test-support/stageHarness'

let mockStageState: HemodynamicSimulationState
let mockStageDispatch: (action: HemodynamicAction) => void
let mockCaseState: HemodynamicSimulationState
let mockCaseDispatch: (action: HemodynamicAction) => void
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<ComponentProps<'a'>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('../components/stage/HemodynamicsSimulatorPane', () => ({
  HemodynamicsSimulatorPane: (
    props: ComponentProps<
      typeof import('../components/stage/HemodynamicsSimulatorPane').HemodynamicsSimulatorPane
    >,
  ) => {
    mockStageState = props.state
    mockStageDispatch = props.dispatch
    const Real = jest.requireActual(
      '../components/stage/HemodynamicsSimulatorPane',
    ).HemodynamicsSimulatorPane
    return <Real {...props} />
  },
}))
jest.mock('../components/BedsideMonitor', () => ({
  BedsideMonitor: (
    props: ComponentProps<typeof import('../components/BedsideMonitor').BedsideMonitor>,
  ) => {
    mockCaseState = props.state
    mockCaseDispatch = props.dispatch
    const Real = jest.requireActual('../components/BedsideMonitor').BedsideMonitor
    return <Real {...props} />
  },
}))
beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function nontrivial(
  dispatch: (action: HemodynamicAction) => void,
  state: () => HemodynamicSimulationState,
) {
  act(() => dispatch({ type: 'SET_TRANSDUCER_LEVEL', levelCm: -4 }))
  act(() => dispatch({ type: 'ZERO_TRANSDUCER' }))
  act(() => dispatch({ type: 'GENERATE_THERMODILUTION_TRIAL', technique: standardTechnique() }))
  const trial = state().thermodilutionTrials.at(-1)!
  act(() => dispatch({ type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id }))
  act(() => dispatch({ type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true }))
  act(() => dispatch({ type: 'SET_PRESSURE_SCALE', maximum: 80 }))
  act(() => dispatch({ type: 'TOGGLE_FREEZE' }))
  expect(state().thermodilutionTrials).toHaveLength(1)
}
it('Help and Sources preserve the entire nontrivial engine and learner record and return focus', () => {
  mountSection('pac-signal-validation')
  nontrivial(mockStageDispatch, () => mockStageState)
  const before = JSON.stringify(mockStageState)
  const work = JSON.stringify(localStorage)
  const help = screen.getByRole('button', { name: 'What do I do now?' })
  help.focus()
  fireEvent.click(help)
  expect(document.querySelector('[data-stage-help-dialog]')).toHaveAttribute('open')
  fireEvent(
    document.querySelector('[data-stage-help-dialog]')!,
    new Event('cancel', { bubbles: true, cancelable: true }),
  )
  expect(help).toHaveFocus()
  const details = document.querySelector<HTMLDetailsElement>('[data-stage-sources]')!
  const summary = details.querySelector('summary')!
  summary.focus()
  details.open = true
  fireEvent(details, new Event('toggle', { bubbles: true }))
  expect(details).toHaveAttribute('open')
  fireEvent.keyDown(details, { key: 'Escape' })
  expect(details.open).toBe(false)
  expect(summary).toHaveFocus()
  details.open = true
  fireEvent.click(screen.getByRole('button', { name: 'Close sources' }))
  expect(details.open).toBe(false)
  expect(summary).toHaveFocus()
  expect(JSON.stringify(mockStageState)).toBe(before)
  expect(JSON.stringify(localStorage)).toBe(work)
})
it('the visible observation return keeps the patient, trials and reusable tool drafts', async () => {
  render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Orient to the patient and signals' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
  )
  nontrivial(mockCaseDispatch, () => mockCaseState)
  const tools = document.querySelector('[aria-label="Measurement tools"]')!
  const trialDetails = [...tools.querySelectorAll('details')].find(
    (d) => d.querySelector('summary')?.textContent === 'Cardiac-output trials',
  )!
  trialDetails.open = true
  const field = within(trialDetails).getByLabelText('Volume')
  fireEvent.change(field, { target: { value: '15' } })
  const before = JSON.stringify(mockCaseState)
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name: /Compare the response and reassess/,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Return to actions and measurement tools' }))
  expect(JSON.stringify(mockCaseState)).toBe(before)
  expect(document.querySelector('[aria-label="Measurement tools"]')).toBe(tools)
  expect(field).toHaveValue('15')
  expect(trialDetails.open).toBe(true)
})
