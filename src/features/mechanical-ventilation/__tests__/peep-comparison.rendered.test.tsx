import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { MechanicalVentilationTeachingPanel } from '../components/MechanicalVentilationTeachingPanel'
import { ventilationStageLesson } from '../content/stageLessons'
import { createPeepComparisonBaseline } from '../engine/peepComparison'
import { VENTILATION_SELF_PACED_KEY } from '../engine/selfPacedProgress'

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

const legacyKeys = [
  'mechanical-ventilation-learning-flow-v1',
  'mechanical-ventilation-live-learning-v1',
  'mechanical-ventilation-progress-v2',
  'hamilton-c6-ventilation-progress-v1',
  'mechanical-ventilation-session-v1',
  'critical-care-activity-progress-v1',
]
beforeEach(() => {
  localStorage.clear()
  legacyKeys.forEach((key) => localStorage.setItem(key, `legacy:${key}`))
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})
function mount() {
  const rendered = render(<VentilationStageHost unitId="oxygenation-response" />)
  act(() => jest.advanceTimersByTime(10))
  return rendered
}
function expectNoInventedEvidence() {
  expect(document.querySelector('[data-task-workbench]')).toHaveAttribute('data-session-time', '0')
  expect(document.querySelector('[data-recorded-breath-comparison]')).toBeNull()
  legacyKeys.forEach((key) => expect(localStorage.getItem(key)).toBe(`legacy:${key}`))
  const stored = JSON.parse(localStorage.getItem(VENTILATION_SELF_PACED_KEY)!)
  expect(Object.keys(stored).sort()).toEqual(['location', 'version', 'visited'])
  expect(document.body.textContent).not.toMatch(/passed|mastered|first.attempt|\d+% correct/i)
}

it('runs and replays before any answer or hold, while keeping the learner patient untouched', () => {
  mount()
  expect(screen.queryAllByRole('radio')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
  const table = screen.getByRole('table', {
    name: 'Engine-generated example values · no hold acquired',
  })
  const first = table.textContent
  expect(within(table).getByRole('columnheader', { name: /Wait only.*75 s/ })).toBeInTheDocument()
  expect(
    within(table).getByRole('columnheader', { name: /PEEP changed.*10.*75 s/ }),
  ).toBeInTheDocument()
  expect(
    within(table).getByRole('row', { name: /Model-assigned compliance.*25 25 32/ }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Replay comparison' }))
  expect(table.textContent).toBe(first)
  fireEvent.change(screen.getByRole('combobox', { name: /Example PEEP/ }), {
    target: { value: '15' },
  })
  expect(screen.queryByRole('columnheader', { name: /PEEP changed/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
  expect(
    within(table).getByRole('row', { name: /Model-assigned compliance.*25 25 18/ }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reset comparison' }))
  expect(screen.getByRole('combobox', { name: /Example PEEP/ })).toHaveValue('10')
  expect(screen.getByRole('combobox', { name: /Matched interval/ })).toHaveValue('45')
  expect(screen.queryByRole('columnheader', { name: /PEEP changed/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
  expect(table.textContent).toBe(first)
  expectNoInventedEvidence()
})

it('reveals the explanation without an answer, run or hold; keeps wrong-choice feedback and Continue optional', () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Explain this comparison' }))
  expect(screen.getByRole('heading', { name: 'How to read the comparison' })).toBeInTheDocument()
  expect(document.querySelector('[data-peep-time-control]')?.textContent).toMatch(
    /wait-only arm is the control/,
  )
  expect(screen.queryByRole('columnheader', { name: /PEEP changed/ })).toBeNull()
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Step navigation' })).getByRole('button', {
      name: 'Continue',
    }),
  )
  expect(screen.getAllByRole('radio')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' }).at(-1)!)
  expect(screen.getAllByRole('radio').every((item) => !(item as HTMLInputElement).checked)).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('radio', { name: 'SpO₂ rises with unchanged exhaled volume' }))
  fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
  expect(
    screen.getAllByText('Stable delivery adds context but does not identify a circulatory cost.')
      .length,
  ).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Step navigation' })).getByRole('button', {
      name: 'Continue',
    }),
  )
  expect(screen.getByRole('button', { name: 'Capture observed response' })).toBeDisabled()
  expect(
    within(screen.getByRole('navigation', { name: 'Step navigation' })).getByRole('button', {
      name: 'Continue',
    }),
  ).toBeEnabled()
  expectNoInventedEvidence()
})

it('restarts the comparison and resumes only reading location, including an older step index', () => {
  localStorage.setItem(
    VENTILATION_SELF_PACED_KEY,
    JSON.stringify({
      version: 1,
      visited: ['oxygenation-response'],
      location: { section: 'learn', id: 'oxygenation-response', step: 7 },
    }),
  )
  const mounted = mount()
  expect(screen.getByRole('combobox', { name: 'Choose step' })).toHaveValue('3')
  fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))
  expect(screen.queryByRole('columnheader', { name: /PEEP changed/ })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
    target: { value: '2' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
  mounted.unmount()
  mount()
  expect(screen.getByRole('combobox', { name: 'Choose step' })).toHaveValue('2')
  expect(screen.queryByRole('columnheader', { name: /PEEP changed/ })).toBeNull()
  expect(
    ventilationStageLesson('oxygenation-response').steps.filter(
      (s) => s.interaction.kind === 'prediction',
    ),
  ).toHaveLength(1)
  expectNoInventedEvidence()
})

it('labels live estimates and never borrows another variable’s trend arrow', () => {
  render(
    <MechanicalVentilationTeachingPanel
      lessonId="oxygenation-response"
      state={createPeepComparisonBaseline()}
    />,
  )
  expect(screen.getByText('Plateau estimate')).toBeInTheDocument()
  expect(screen.getByText(/Patient effort makes this pressure unsuitable/)).toBeInTheDocument()
  for (const label of ['Arterial oxygen tension', 'Model-assigned shunt fraction']) {
    expect(screen.getByText(label).parentElement!.querySelector('[data-trend]')).toBeNull()
  }
  expect(
    screen
      .getByText('Mean airway pressure', { selector: 'span' })
      .parentElement!.querySelector('[data-trend]'),
  ).toBeNull()
  expect(
    screen.getByText('Oxygen saturation').parentElement!.querySelector('[data-trend]'),
  ).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Mean airway pressure' }))
  expect(
    screen.getByText(/does not independently model an oxygenation benefit/),
  ).toBeInTheDocument()
})
