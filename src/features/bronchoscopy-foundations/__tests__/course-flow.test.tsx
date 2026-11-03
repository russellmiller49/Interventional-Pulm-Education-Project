import { cleanup, fireEvent, screen } from '@testing-library/react'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { BRONCH_STORAGE_KEY } from '../engine/learnProgress'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  parseBronchSelfPacedRecord,
} from '../engine/selfPacedProgress'
import { performFiveControlsLearn } from '../test-support/fiveControlsLearnHarness'
import { SCOPE_RECIPES, scopeRecipe } from '../test-support/scopeRecipes'
import {
  answerFindRows,
  answerLedger,
  clickPrimary,
  commitById,
  controlsFieldset,
  currentStepId,
  decideAllFrames,
  fillLedgerEntries,
  fillReport,
  goalStates,
  installDom,
  keyedChoiceId,
  mountSection,
  nameIdentifyRows,
  nowPrimary,
  orderSequence,
  placeSortRows,
  scopePilot,
  settle,
} from '../test-support/stageHarness'
jest.mock(
  '../components/scope/ScopePane',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopePaneDouble,
)
jest.mock('../components/stage/scopeCaseLoader', () => ({
  loadStageScopeCase: () =>
    Promise.resolve(
      jest
        .requireActual<
          typeof import('../test-support/teachingCase')
        >('../test-support/teachingCase')
        .teachingCase(),
    ),
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const selfPaced = () =>
  parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))

it.each(BRONCH_SECTION_IDS)('walks the content-led %s lesson through real handlers', async (id) => {
  const { lesson } = await mountSection(id)
  expect(document.querySelector('[data-course-presentation]')).not.toBeNull()
  expect(document.querySelector('[data-step-list]')).toBeNull()
  expect(document.querySelector('[data-prediction-choices]')).toBeNull()
  if (id === 'five-controls') await performFiveControlsLearn(lesson)
  else
    for (const step of lesson.steps) {
      expect(currentStepId()).toBe(step.id)
      expect(document.body.textContent).not.toMatch(/(?:Steps|Teaching|Simulator) panel/i)
      for (const blockId of step.course!.blocks)
        expect(document.querySelector(`[data-block-id="${blockId}"]`)).not.toBeNull()
      switch (step.interaction.kind) {
        case 'prediction':
          expect(document.querySelector('[data-course-teaching]')).toBeNull()
          expect(document.querySelector('[data-normal-airway-tour]')).toBeNull()
          expect(document.querySelector('[data-answer-verdict]')).toBeNull()
          expect(document.querySelector('[data-show-explanation]')).not.toBeNull()
          commitById(keyedChoiceId(step))
          break
        case 'sort':
          placeSortRows(step)
          clickPrimary()
          break
        case 'identify':
          nameIdentifyRows(step)
          clickPrimary()
          break
        case 'find':
          answerFindRows(step)
          expect(document.querySelector('[data-find-verdict="held"]')).not.toBeNull()
          break
        case 'sequence':
          orderSequence(step)
          clickPrimary()
          break
        case 'ledger':
          fillLedgerEntries(step)
          answerLedger(step, 'best')
          break
        case 'report':
          fillReport(step)
          break
        case 'scenario':
          decideAllFrames(step)
          break
        case 'scope-task':
          scopeRecipe(id, step.course?.act)(scopePilot())
          expect(goalStates().every((state) => state === 'true')).toBe(true)
          break
        case 'observe':
          SCOPE_RECIPES[id]!.observe!(scopePilot())
          expect(goalStates().every((state) => state === 'true')).toBe(true)
          break
      }
      clickPrimary()
      await settle()
    }
  expect(document.querySelector('[data-section-completion]')).not.toBeNull()
  expect(selfPaced()?.reviewedSectionIds).toContain(id)
  expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
})

it('shows a storage failure without blocking learning', async () => {
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota')
  })
  await mountSection('pre-use-check')
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
  expect(nowPrimary()).not.toBeDisabled()
  fireEvent.click(nowPrimary()!)
  expect(currentStepId()).toContain('pre-use-check-flow-v1-check')
  write.mockRestore()
})

it('isolates the protected exchange demonstration from the learner attempt and record', async () => {
  const { lesson } = await mountSection('biopsy-and-specimens')
  const practice = lesson.steps.find((step) => step.course?.demonstration)!
  // Every card on the way can be left: the prediction and the picture questions come first.
  while (currentStepId() !== practice.id) {
    const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
    if (skip) fireEvent.click(skip)
    else clickPrimary()
    await settle()
  }
  fireEvent.click(screen.getByRole('button', { name: 'Watch the example' }))
  for (let index = 1; index < practice.course!.demonstration!.length; index++)
    fireEvent.click(screen.getByRole('button', { name: 'Next demonstration movement' }))
  expect(document.querySelector('[data-demonstration-caption]')).toHaveTextContent(
    'not your own attempt',
  )
  expect(selfPaced()).toMatchObject({
    visitedSectionIds: ['biopsy-and-specimens'],
    reviewedSectionIds: [],
    surveySnapshot: null,
  })
  expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try with guidance' }))
  expect(document.querySelector('[data-demonstration-caption]')).toBeNull()
  expect(nowPrimary()).toBeDisabled()
  expect(goalStates()).toContain('false')
  SCOPE_RECIPES['biopsy-and-specimens']!.act(scopePilot())
  expect(goalStates().every((state) => state === 'true')).toBe(true)
  expect(selfPaced()?.reviewedSectionIds).toEqual([])
})

/*
 * Owner feedback, 2026-11-03: the brush exchange hid how to load the brush (a drop-down named
 * "Accessory position") and its controls were dead until "Try with guidance". The tool now sits on
 * labelled buttons that send the same commands, the controls are live from the start, and an
 * unsafe request says at once that this attempt cannot meet its goals and how to start again.
 */
describe('the brush exchange on its buttons, without the example first', () => {
  async function reachExchange() {
    const { lesson } = await mountSection('biopsy-and-specimens')
    const practice = lesson.steps.find((step) => step.course?.demonstration)!
    while (currentStepId() !== practice.id) {
      const skip = document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
      await settle()
    }
  }
  const button = (name: string) => screen.getByRole('button', { name })
  const reply = () => document.querySelector('[data-accessory-reply]')?.textContent ?? ''

  it('runs the whole exchange from the buttons, and the example stays one optional button', async () => {
    await reachExchange()
    expect(controlsFieldset()).not.toBeDisabled()
    expect(button('Watch the example')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Try with guidance' })).toBeNull()
    // No builder words beside the controls, and no drop-downs for the tool.
    expect(document.querySelector('[data-scope-controls] select')).toBeNull()
    expect(document.querySelector('[data-scope-controls]')?.textContent).not.toMatch(
      /accessory|scripted|commands the assistant/i,
    )
    expect(document.querySelector('[data-model-boundary]')?.textContent).toBe(
      'Your assistant’s replies are part of the exercise.',
    )
    // Where the brush is: the button for its place is the pressed one.
    expect(button('Not loaded')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button('In the channel'))
    expect(button('In the channel')).toHaveAttribute('aria-pressed', 'true')
    expect(goalStates()).toEqual(['true', 'false', 'false'])
    fireEvent.click(button('Beyond the tip'))
    fireEvent.click(button('Push the brush out'))
    expect(goalStates()).toEqual(['true', 'true', 'false'])
    // The assistant's false report is printed beside the controls; only the check settles it.
    fireEvent.click(button('Brush back into its sheath'))
    expect(reply()).toContain('back in its sheath')
    fireEvent.click(button('Check it on the scope view'))
    expect(reply()).toContain('disagree')
    fireEvent.click(button('Brush back into its sheath'))
    fireEvent.click(button('Check it on the scope view'))
    expect(reply()).toContain('Checked on the scope view')
    fireEvent.click(button('In the channel'))
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    expect(nowPrimary()).not.toBeDisabled()
    expect(selfPaced()?.reviewedSectionIds).toEqual([])
  })

  it('says when an unsafe request rules the goals out, and points at Reset', async () => {
    await reachExchange()
    fireEvent.click(button('In the channel'))
    // Exposing it inside the channel is refused, and recorded as unsafe.
    fireEvent.click(button('Push the brush out'))
    expect(reply()).toMatch(/^Not done/)
    expect(goalStates()).toEqual(['false', 'false', 'false'])
    expect(document.querySelector('[data-goal-blocked]')?.textContent).toContain(
      'Select Reset the scope to start again.',
    )
    expect(document.querySelector('[data-spotlight="true"]')).toHaveAttribute(
      'data-control',
      'reset',
    )
    fireEvent.click(button('Reset the scope'))
    expect(document.querySelector('[data-goal-blocked]')).toBeNull()
    expect(button('Not loaded')).toHaveAttribute('aria-pressed', 'true')
  })
})
