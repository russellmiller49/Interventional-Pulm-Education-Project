import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)
import { McsWorkbench } from '../components/McsWorkbench'
import { McsStageHost } from '../components/stage/McsStageHost'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import { mcsPresentationTitle } from '../content/casePresentation'
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import {
  answerIdentification,
  commitPrediction,
  continueFromVerdict,
  mountSection,
  nowCard,
  setupMcsStage,
  teardownMcsStage,
  continueStep,
} from '../test-support/mcsStage'

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

it.each(mcsStageLessonIds)(
  '%s explicitly maps every original task and keeps a single task surface',
  (id) => {
    const lesson = buildMcsStageLesson(id)
    mountSection(id)
    expect(lesson.steps.every((step) => Boolean(step.presentation))).toBe(true)
    expect(document.querySelectorAll('[data-now-card]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-pane]')).toHaveLength(0)
    expect(document.querySelector('[data-now-card] [data-presentation]')).not.toBeNull()
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(0)
  },
)

it('switches only the conceptual mechanism drawing without changing the patient or recording work', () => {
  mountSection('mcs-foundations-mechanisms')
  const before = document.querySelector('[data-session-identity]')?.textContent
  const storedBefore = window.localStorage.getItem('interventionalpulm:mcs-progress:v1')
  fireEvent.click(screen.getByRole('button', { name: 'Existing durable LVAD' }))
  expect(document.querySelector('[data-pathway="durable-continuous-flow-lvad"]')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'LV-to-aorta microaxial pump' }))
  expect(document.querySelector('[data-session-identity]')?.textContent).toBe(before)
  expect(window.localStorage.getItem('interventionalpulm:mcs-progress:v1')).toBe(storedBefore)
})

it('repeats one captured mechanism without erasing the other two', () => {
  const id = 'mcs-foundations-mechanisms'
  mountSection(id)
  answerIdentification(id)
  continueStep()
  commitPrediction(id)
  continueFromVerdict()
  for (const name of [
    /Select the durable/,
    /Select the transvalvular/,
    /Select the counterpulsation/,
  ])
    fireEvent.click(within(nowCard()).getByRole('button', { name }))
  const before = document.querySelector('[data-retained-comparison]')?.textContent
  fireEvent.click(within(nowCard()).getByRole('button', { name: /Select the transvalvular/ }))
  expect(document.querySelector('[data-retained-comparison]')?.textContent).toBe(before)
  expect(document.querySelectorAll('[data-comparison-device]')).toHaveLength(3)
})

it('orients to serial right support before presenting a separate map question', () => {
  render(<McsStageHost sectionId="impella-suction-purge-rv" />)
  expect(document.querySelector('[data-prerequisite-reference]')).not.toBeNull()
  expect(document.querySelector('[data-map-answer-prompt]')).toBeNull()
  for (let i = 0; i < 3; i++)
    fireEvent.click(screen.getByRole('button', { name: 'Next reference' }))
  expect(
    screen.getByText(/There is no interactive purge-management lesson here/),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Begin the patient example' }))
  expect(document.querySelector('[data-prerequisite-reference]')).toBeNull()
  expect(document.querySelector('[data-map-answer-prompt]')).not.toBeNull()
})

it('opens Practice on a choice of exploration or clinical cases with no earned case evidence', () => {
  render(<McsWorkbench section="practice" />)
  expect(screen.getByRole('heading', { name: 'Work a clinical case' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Open causal debrief' })).toBeNull()
  expect(document.querySelector('[data-optional-anatomy]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Explore mechanisms' }))
  expect(screen.getByRole('region', { name: 'Mechanism Studio instructions' })).toBeInTheDocument()
  expect(document.querySelector('[data-case-identity]')).toBeNull()
  expect(window.localStorage.getItem('interventionalpulm:mcs-progress:v1')).toBeNull()
})

it.each([...mcsPracticeScenarios, ...mcsCapstoneScenarios])(
  '$id shows clinical identity and teaching before an optional answer',
  (scenario) => {
    render(
      <McsWorkbench
        section={scenario.kind === 'capstone' ? 'assess' : 'practice'}
        initialActivityId={scenario.id}
      />,
    )
    expect(
      screen.getAllByRole('heading', { name: mcsPresentationTitle(scenario) }).length,
    ).toBeGreaterThan(0)
    expect(document.querySelector('[data-case-observations]')).not.toBeNull()
    expect(document.querySelector('[data-case-identity]')?.textContent).toContain(
      scenario.learningObjectives[0],
    )
    expect(screen.getByRole('button', { name: 'Optional three-dimensional view' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByText(/Why the display changed/)).toBeInTheDocument()
  },
)
