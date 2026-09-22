import { fireEvent, render, screen, within } from '@testing-library/react'
jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)
import { McsMonitor } from '../components/McsMonitor'
import { createInitialMcsState, mcsReducer } from '../engine'
import { mcsScenarioById } from '../content/scenarios'
import {
  renderWorkbench,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

beforeEach(setupMcsWorkbenchEnvironment)
afterEach(teardownMcsWorkbenchEnvironment)

it('does not render a green all-clear badge for a quiet held AF trigger alarm', () => {
  let state = createInitialMcsState('learn', 'iabp', null, 417)
  state = mcsReducer(state, { type: 'SET_RHYTHM', rhythm: 'atrial-fibrillation' })
  state = mcsReducer(state, {
    type: 'SET_IABP_CONTROL',
    control: 'triggerSource',
    value: 'pressure',
  })
  expect(state.alarms.some((alarm) => alarm.active)).toBe(false)
  const view = render(<McsMonitor state={state} />)
  const bar = view.container.querySelector('[data-monitor-target="monitor:alarms"]')!
  expect(bar.querySelector('[data-priority="clear"]')).toBeNull()
  expect(bar).not.toHaveTextContent('NO ACTIVE MODEL ALARMS')
  expect(bar).toHaveTextContent('Model limit held')
})

it.each(['IABP-02', 'CAP-IABP-01'])(
  '%s keeps its patient-context alarm summary on hold after pressure selection',
  async (id) => {
    await renderWorkbench({
      section: id.startsWith('CAP') ? 'assess' : 'practice',
      initialActivityId: id,
    })
    for (const name of ['Inflation vs notch', 'Deflation vs systole']) {
      fireEvent.change(screen.getByRole('slider', { name }), { target: { value: '0' } })
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger source' }), {
      target: { value: 'pressure' },
    })
    const label = screen.getByText('Active alarm / limitation')
    expect(label.parentElement).toHaveTextContent('Model limit held')
    expect(label.parentElement).not.toHaveTextContent('No active modeled alarm')
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(label.parentElement).toHaveTextContent('Model limit held')
    const condition = document.querySelector('[data-condition-held="true"]')!
    expect(condition).toHaveTextContent('not treated as an outcome')
    expect(condition).toHaveTextContent('MCS-03-05')
    // Actual alarms are still inspectable and selecting ECG still raises the model warning.
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger source' }), {
      target: { value: 'ecg' },
    })
    expect(screen.getByText('Active alarm / limitation').parentElement).toHaveTextContent(
      'Trigger reliability reduced',
    )
    expect(
      within(
        document.querySelector('[data-monitor-target="monitor:alarms"]') as HTMLElement,
      ).getByText(/WARNING.*Trigger reliability reduced/),
    ).toBeInTheDocument()
    expect(mcsScenarioById.get(id)?.initialPatient.rhythm).toBe('atrial-fibrillation')
  },
)

it('preserves the quiet sinus-rhythm monitor indicator', () => {
  const view = render(<McsMonitor state={createInitialMcsState('learn', 'iabp', null, 417)} />)
  expect(view.container.querySelector('[data-priority="clear"]')).toHaveTextContent(
    'NO ACTIVE MODEL ALARMS',
  )
  expect(view.container.querySelector('[data-af-trigger-held]')).toBeNull()
})
