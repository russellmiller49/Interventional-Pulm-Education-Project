import { cleanup, fireEvent, screen } from '@testing-library/react'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { BRONCH_STORAGE_KEY, parseBronchRecord } from '../engine/learnProgress'
import { performFiveControlsLearn } from '../test-support/fiveControlsLearnHarness'
import { SCOPE_RECIPES } from '../test-support/scopeRecipes'
import {
  answerLedger,
  clickPrimary,
  commitById,
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
      if (step.course?.demonstration)
        fireEvent.click(screen.getByRole('button', { name: 'Try with guidance' }))
      switch (step.interaction.kind) {
        case 'prediction':
          expect(document.querySelector('[data-course-teaching]')).toBeNull()
          expect(document.querySelector('[data-normal-airway-tour]')).toBeNull()
          expect(document.querySelector('[data-answer-verdict]')).toBeNull()
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
          SCOPE_RECIPES[id]!.act(scopePilot())
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
  expect(
    parseBronchRecord(localStorage.getItem(BRONCH_STORAGE_KEY))?.completedSectionIds,
  ).toContain(id)
})

it('shows a storage failure without blocking learning', async () => {
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota')
  })
  await mountSection('pre-use-check')
  expect(screen.getByRole('alert')).toHaveTextContent('Progress could not be saved')
  expect(nowPrimary()).not.toBeDisabled()
  fireEvent.click(nowPrimary()!)
  expect(currentStepId()).toContain('readiness')
  write.mockRestore()
})

it('isolates the protected exchange demonstration from the learner attempt and record', async () => {
  const { lesson } = await mountSection('protected-accessories')
  const practice = lesson.steps.find((step) => step.course?.demonstration)!
  while (currentStepId() !== practice.id) {
    clickPrimary()
    await settle()
  }
  fireEvent.click(screen.getByRole('button', { name: 'Watch the example' }))
  for (let index = 1; index < practice.course!.demonstration!.length; index++)
    fireEvent.click(screen.getByRole('button', { name: 'Next demonstration movement' }))
  expect(document.querySelector('[data-demonstration-caption]')).toHaveTextContent(
    'no learner credit',
  )
  const before = parseBronchRecord(localStorage.getItem(BRONCH_STORAGE_KEY))!
  expect(before.completedSectionIds).toEqual([])
  expect(before.firstAttempts).toEqual({})
  expect(before.inspectionSnapshot).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try with guidance' }))
  expect(document.querySelector('[data-demonstration-caption]')).toBeNull()
  expect(nowPrimary()).toBeDisabled()
  expect(goalStates()).toContain('false')
  SCOPE_RECIPES['protected-accessories']!.act(scopePilot())
  expect(goalStates().every((state) => state === 'true')).toBe(true)
  expect(parseBronchRecord(localStorage.getItem(BRONCH_STORAGE_KEY))!.completedSectionIds).toEqual(
    [],
  )
})
