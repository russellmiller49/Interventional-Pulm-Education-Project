/**
 * The case as the last task of its section (owner, 2026-10-17, carrying the ICU hemodynamics
 * change of 2026-10-14).
 *
 * A section paired to a case ends on it: the case runs inside the section's task card on its own
 * engine, with no module frame of its own and a one-line strip naming it and its section; Exit
 * case, the end of the case and Skip the case all bring the section's completion card up, and the
 * way on is the next section. One engine at a time: the section's patient stops ticking and its
 * simulator is not mounted while the case is the current task. Practice still opens every case on
 * its own page.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { McsWorkbench } from '../components/McsWorkbench'
import { nextIncompleteMcsSectionLink } from '../content/pathwayResolver'
import { mcsPracticeScenarios } from '../content/scenarios'
import { mcsSectionCase } from '../content/sectionSpecs'
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import { readMcsLearningProgress } from '../engine/learningProgress'
import {
  continueStep,
  currentStepId,
  mountSection,
  nowCard,
  nowPrimary,
  nowStatus,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'
import { mockRouterPush } from '../test-support/mcsWorkbenchStubs'

beforeEach(() => setupMcsStage())
afterEach(() => teardownMcsStage())

const PAIRINGS: Readonly<Record<string, string | null>> = {
  'mcs-foundations-signals': null,
  'mcs-foundations-mechanisms': null,
  'iabp-timing-triggering': 'IABP-01',
  'iabp-efficacy-limits': 'IABP-03',
  'impella-unloading-placement': 'IMP-02',
  'impella-suction-purge-rv': 'IMP-01',
  'lvad-parameters-assessment': 'LVAD-01',
  'lvad-alarms-emergencies': 'LVAD-03',
  'mcs-device-selection-integration': 'LVAD-02',
}

/** Each section's teaching, without its case. */
const TEACHING_MINUTES: Readonly<Record<string, number>> = {
  'mcs-foundations-signals': 10,
  'mcs-foundations-mechanisms': 11,
  'iabp-timing-triggering': 11,
  'iabp-efficacy-limits': 11,
  'impella-unloading-placement': 11,
  'impella-suction-purge-rv': 10,
  'lvad-parameters-assessment': 10,
  'lvad-alarms-emergencies': 10,
  'mcs-device-selection-integration': 17,
}

/** The task list's button for the section's last task. */
function openLastTask() {
  const rows = document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')
  fireEvent.click(rows[rows.length - 1])
}

function secondary(): HTMLButtonElement | null {
  return nowCard().querySelector<HTMLButtonElement>('[data-now-secondary]')
}

function sectionCase(): HTMLElement {
  const root = document.querySelector<HTMLElement>('[data-section-case]')
  if (!root) throw new Error('No case running in the section')
  return root
}

/** Works the case through its visible controls to its worked explanation. */
function workTheCase(caseId: string) {
  const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === caseId)!
  const root = sectionCase()
  fireEvent.click(within(root).getByRole('button', { name: /Arterial waveform/ }))
  const keyed = scenario.predictionOptions.find(
    (option) => option.id === scenario.correctPredictionId,
  )!
  fireEvent.click(within(root).getByRole('radio', { name: keyed.label }))
  fireEvent.click(within(root).getByRole('button', { name: 'Compare prediction' }))
  fireEvent.click(within(root).getByRole('button', { name: 'Open worked explanation' }))
  expect(root.querySelector('[data-worked-explanation]')).not.toBeNull()
}

describe('which sections end on a case', () => {
  it.each(mcsStageLessonIds)(
    '%s ends on its paired case, after its transfer, or on its transfer',
    (id) => {
      const lesson = buildMcsStageLesson(id)
      const caseSteps = lesson.steps.filter((step) => step.interaction.kind === 'case')
      const expected = PAIRINGS[id]
      if (expected === null) {
        expect(caseSteps).toHaveLength(0)
        expect(lesson.caseStepIndex).toBe(-1)
        expect(lesson.steps.at(-1)?.interaction.kind).toBe('transfer')
        return
      }
      expect(caseSteps).toHaveLength(1)
      expect(lesson.caseStepIndex).toBe(lesson.steps.length - 1)
      const transferIndex = lesson.steps.findIndex((step) => step.interaction.kind === 'transfer')
      expect(lesson.caseStepIndex).toBe(transferIndex + 1)
      const step = lesson.steps[lesson.caseStepIndex]
      expect(step.interaction.kind === 'case' && step.interaction.sectionCase.caseId).toBe(expected)
      expect(step.id).toBe(`${id}-case`)
      expect(step.presentation).toBe('section-case')
      // The task list names no case: several case titles name the section's first answer.
      expect(step.title).toBe('Apply it in a patient case')
    },
  )

  it('counts each case in its section’s minutes', () => {
    const pathway = criticalCareLearningPathway('mechanical-circulatory-support')
    for (const section of pathway.sections) {
      const paired = mcsSectionCase(section.id)
      const lesson = buildMcsStageLesson(section.id)
      expect(lesson.minutes).toBe(section.minutes)
      // The teaching alone, as timed after the November 2026 text cut.
      const teaching = TEACHING_MINUTES[section.id]
      expect(teaching).toBeGreaterThan(0)
      if (!paired) {
        expect(section.minutes).toBe(teaching)
        continue
      }
      expect(paired.minutes).toBe(10)
      expect(section.minutes).toBe(teaching + paired.minutes)
    }
    expect(pathway.sections.reduce((sum, section) => sum + section.minutes, 0)).toBe(171)
  })

  it('places each case in at most one section, and Practice keeps all nine', () => {
    const placed = mcsStageLessonIds.flatMap((id) => mcsSectionCase(id)?.caseId ?? [])
    expect(new Set(placed).size).toBe(placed.length)
    expect(placed).toHaveLength(7)
    expect(mcsPracticeScenarios).toHaveLength(9)
  })
})

describe('the case step, before the case', () => {
  it('runs one engine: the section patient stops and its simulator is not mounted', () => {
    jest.useFakeTimers()
    mountSection('iabp-efficacy-limits')
    const lesson = buildMcsStageLesson('iabp-efficacy-limits')
    // Reach the transfer with the card's own Continue, as a learner who answers nothing.
    for (let guard = 0; guard < 20 && currentStepId() !== 'iabp-efficacy-limits-transfer'; guard++)
      continueStep()
    const sectionClock = document.querySelector<HTMLElement>('[data-mcs-visual] [data-clock-bar]')!
    // Observe pauses the section's patient; run it again, so there is a clock to stop.
    if (sectionClock.getAttribute('data-clock-state') !== 'running')
      fireEvent.click(within(sectionClock).getByRole('button', { name: 'Run' }))
    expect(sectionClock).toHaveAttribute('data-clock-state', 'running')
    const onTransfer = jest.getTimerCount()
    expect(onTransfer).toBeGreaterThan(0)
    expect(nowPrimary()?.textContent).toMatch(/^Continue to the case/)
    continueStep()

    expect(currentStepId()).toBe(lesson.steps[lesson.caseStepIndex].id)
    // No section simulator, no clock: the task takes the full width.
    expect(document.querySelector('[data-flow-visual]')).toBeNull()
    expect(document.querySelector('[data-clock-bar]')).toBeNull()
    expect(document.querySelector('[data-single-column]')).toHaveAttribute(
      'data-single-column',
      'case',
    )
    // The section's clock is the interval that stopped.
    expect(jest.getTimerCount()).toBe(onTransfer - 1)

    expect(nowCard().querySelector('h2')).toHaveTextContent(
      'Apply it: Correct timing, inadequate circulation',
    )
    expect(nowPrimary()).toHaveTextContent('Start the case')
    expect(secondary()).toHaveTextContent('Skip the case · finish the section')
    expect(document.querySelector('[data-stage-completion]')).toBeNull()

    fireEvent.click(nowPrimary()!)
    // The case's own clock is now the one running, in the one clock bar.
    expect(jest.getTimerCount()).toBe(onTransfer)
    const clocks = document.querySelectorAll('[data-clock-bar]')
    expect(clocks).toHaveLength(1)
    expect(sectionCase().contains(clocks[0])).toBe(true)
    const time = () =>
      Number.parseFloat(
        (clocks[0].querySelector('[data-clock-time]')?.textContent ?? '').replace(/[^\d.]/g, ''),
      )
    const started = time()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(time()).toBeGreaterThan(started)
    fireEvent.click(within(clocks[0] as HTMLElement).getByRole('button', { name: 'Pause' }))
    expect(jest.getTimerCount()).toBe(onTransfer - 1)
  })
})

describe('the case, run inside the section', () => {
  it('treats a double-click on Continue to the case as one intent, not a start', () => {
    mountSection('iabp-efficacy-limits')
    for (let guard = 0; guard < 20 && currentStepId() !== 'iabp-efficacy-limits-transfer'; guard++)
      continueStep()
    fireEvent.click(nowPrimary()!, { detail: 1 })
    // The second click of the pair lands on the same pinned button, now Start the case.
    fireEvent.click(nowPrimary()!, { detail: 2 })
    expect(currentStepId()).toBe('iabp-efficacy-limits-case')
    expect(document.querySelector('[data-section-case]')).toBeNull()
    expect(nowPrimary()).toHaveTextContent('Start the case')
  })

  it('runs embedded: a strip, no module frame, and no way out but its own', () => {
    mountSection('iabp-timing-triggering')
    openLastTask()
    fireEvent.click(nowPrimary()!)
    const root = sectionCase()
    expect(root).toHaveAttribute('data-section-case', 'IABP-01')
    expect(nowCard().contains(root)).toBe(true)
    expect(root.querySelector('[data-case-strip]')).toHaveTextContent(
      'Case · The balloon that stays inflated too long · the last task of Section 3',
    )
    // No Practice chrome: no second frame, no breadcrumb, no kicker title, no device tabs.
    expect(document.querySelectorAll('[data-mcs-workbench-scope]')).toHaveLength(0)
    expect(within(root).queryByText(/GUIDED CASE/)).toBeNull()
    expect(within(root).queryByRole('navigation', { name: 'Choose device track' })).toBeNull()
    expect(root.querySelector('[data-case-identity]')).not.toBeNull()
    // While it runs the card names it and nothing else moves the learner.
    expect(nowCard().querySelector('[data-now-primary]')).toBeNull()
    expect(nowCard().querySelector('[data-now-back]')).toBeNull()
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')) {
      expect(button).toBeDisabled()
    }
    expect(document.querySelector('[data-section-recap]')).toBeNull()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('returns to the section at the end of the case, whose completion card then shows', () => {
    mountSection('iabp-timing-triggering')
    openLastTask()
    fireEvent.click(nowPrimary()!)
    workTheCase('IABP-01')
    const back = within(sectionCase()).getByRole('button', {
      name: /Back to Section 3: Is the balloon inflating at the right moment\?/,
    })
    expect(document.querySelector('[data-case-finished]')).toHaveTextContent('Case finished.')
    fireEvent.click(back)

    expect(document.querySelector('[data-section-case]')).toBeNull()
    const completion = document.querySelector<HTMLElement>('[data-stage-completion]')!
    expect(completion).not.toBeNull()
    expect(document.activeElement).toBe(completion)
    expect(completion.querySelector('[data-case-outcome]')).toHaveAttribute(
      'data-case-outcome',
      'ran',
    )
    expect(nowStatus()).toBe('Section finished.')
    expect(secondary()).toHaveTextContent('Run the case again')
    expect(nowPrimary()).toHaveTextContent(
      'Continue to the next section: Timed correctly, still not perfusing',
    )
    expect(document.querySelector('[data-section-recap]')).not.toBeNull()
    fireEvent.click(nowPrimary()!)
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/mechanical-circulatory-support/learn',
      query: { lesson: 'iabp-efficacy-limits' },
    })
  })

  it('finishes the section on Exit case, and runs a fresh case again on request', () => {
    jest.useFakeTimers()
    mountSection('impella-unloading-placement')
    openLastTask()
    fireEvent.click(nowPrimary()!)
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    fireEvent.click(within(sectionCase()).getByRole('button', { name: /Exit case/ }))
    expect(document.querySelector('[data-section-case]')).toBeNull()
    expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
    expect(nowStatus()).toBe('Section finished.')

    fireEvent.click(secondary()!)
    const again = sectionCase()
    expect(again).toHaveAttribute('data-section-case', 'IMP-02')
    expect(again.querySelector('[data-clock-time]')?.textContent).toMatch(/0\.0 s/)
    expect(document.querySelector('[data-stage-completion]')).toBeNull()
  })

  it('finishes the section on Skip the case, with nothing run', () => {
    mountSection('lvad-parameters-assessment')
    openLastTask()
    fireEvent.click(secondary()!)
    expect(document.querySelector('[data-section-case]')).toBeNull()
    expect(document.querySelector('[data-case-outcome]')).toHaveAttribute(
      'data-case-outcome',
      'skipped',
    )
    expect(nowPrimary()).toHaveTextContent(/^Continue to the next section/)
    expect(secondary()).toHaveTextContent('Start the case')
  })

  it('says what a case on another mechanism applies instead', () => {
    mountSection('lvad-alarms-emergencies')
    openLastTask()
    fireEvent.click(nowPrimary()!)
    expect(sectionCase().querySelector('[data-case-strip]')).toHaveTextContent(
      'Case · Controller alarm after power interruption · the last task of Section 8, on its power check, not its thrombosis pattern',
    )
  })

  it('ends the last section on its case, then the Learn page', () => {
    mountSection('mcs-device-selection-integration')
    openLastTask()
    fireEvent.click(nowPrimary()!)
    expect(sectionCase()).toHaveAttribute('data-section-case', 'LVAD-02')
    fireEvent.click(within(sectionCase()).getByRole('button', { name: /Exit case/ }))
    expect(nowPrimary()).toHaveTextContent('Back to the Learn page')
  })

  it('records the case as opened and keeps the location on the section', () => {
    mountSection('iabp-efficacy-limits')
    openLastTask()
    fireEvent.click(nowPrimary()!)
    const progress = readMcsLearningProgress()
    expect(progress.visitedCaseIds).toContain('IABP-03')
    expect(progress.lastActivityId).toBe('iabp-efficacy-limits')
    expect(progress.lastSection).toBe('learn')
    expect(nextIncompleteMcsSectionLink(progress).href).toMatch(
      /\/learn\?lesson=iabp-efficacy-limits/,
    )
  })
})

describe('Practice keeps every case on its own page', () => {
  it('opens a paired case at /practice?case= with its Practice frame and no section strip', () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    const workflow = document.querySelector<HTMLElement>('[data-case-workflow]')!
    expect(workflow).not.toBeNull()
    expect(within(workflow).getByText(/GUIDED CASE · IABP-01/)).toBeInTheDocument()
    expect(workflow.querySelector('[data-case-strip]')).toBeNull()
    expect(within(workflow).queryByRole('button', { name: /Exit case/ })).toBeNull()
    expect(document.querySelector('[data-case-finished]')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Choose device track' })).toBeInTheDocument()
  })
})
