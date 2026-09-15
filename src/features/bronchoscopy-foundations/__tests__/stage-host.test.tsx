import { completeCourseStep, reachCourseStep } from '../test-support/courseHarness'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { BRONCH_SECTION_IDS, type BronchSectionId } from '../content/pathway'
import type { BronchStageLesson, BronchStageStep } from '../content/stageLessons'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  parseBronchSelfPacedRecord,
} from '../engine/selfPacedProgress'
import { performFiveControlsLearn } from '../test-support/fiveControlsLearnHarness'
import { SCOPE_RECIPES } from '../test-support/scopeRecipes'
import {
  answerLedger,
  chooseReportOption,
  clickPrimary,
  commitById,
  controlsFieldset,
  currentStepId,
  decideAllFrames,
  decideFrame,
  fillLedgerEntries,
  fillReport,
  installDom,
  keyedChoiceId,
  mountSection,
  nameIdentifyRows,
  nowPrimary,
  nowStatus,
  orderSequence,
  otherChoiceId,
  placeSortRows,
  settle,
  verdictOutcome,
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

const SELF_PACED_KEYS = [
  'lastSectionId',
  'reviewLaterSectionIds',
  'reviewedSectionIds',
  'surveySnapshot',
  'updatedAt',
  'version',
  'visitedSectionIds',
]

function storedRecord() {
  return parseBronchSelfPacedRecord(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY))
}

function skipButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-now-card] [data-now-skip]')
}

function clickSkip() {
  const button = skipButton()
  if (!button) throw new Error(`No way on without doing step ${currentStepId()}`)
  fireEvent.click(button)
}

function nowButton(name: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
    (button) => button.textContent === name,
  )
}

function stepOfKind(lesson: BronchStageLesson, kind: BronchStageStep['interaction']['kind']) {
  const step = lesson.steps.find((candidate) => candidate.interaction.kind === kind)
  if (!step) throw new Error(`${lesson.sectionId} has no ${kind} step`)
  return step
}

/** Reach the existing activity through the authored teaching sequence. */
async function reachAct(lesson: BronchStageLesson) {
  await reachCourseStep(
    lesson,
    stepOfKind(
      lesson,
      lesson.section.act.kind === 'scope-lab' ? 'scope-task' : lesson.section.act.kind,
    ),
  )
}
async function performAct(lesson: BronchStageLesson) {
  const step = lesson.steps.find((entry) => entry.id === currentStepId())!
  await completeCourseStep(lesson, step)
}
async function finishSection(lesson: BronchStageLesson) {
  await reachCourseStep(lesson, lesson.steps.at(-1)!)
  await completeCourseStep(lesson, lesson.steps.at(-1)!)
  expect(nowStatus()).toMatch(/end of this section/)
  expect(document.querySelector('[data-section-completion]')).toHaveAttribute(
    'data-reviewed',
    'true',
  )
  expect(storedRecord()?.reviewedSectionIds).toContain(lesson.sectionId)
}

async function walkByLeavingEveryStep(lesson: BronchStageLesson) {
  for (
    let guard = 0;
    !document.querySelector('[data-section-completion]') && guard <= lesson.steps.length + 1;
    guard++
  ) {
    if (skipButton()) clickSkip()
    else clickPrimary()
    await settle()
  }
  expect(document.querySelector('[data-section-completion]')).not.toBeNull()
}

/**
 * A sort section, the way a learner walks it: the read, an optional question with a stated
 * verdict, the set placed and checked, the review with the recap, the transfer, and the learner's
 * own reviewed mark — with no answer saved anywhere.
 */
describe('a sort section on the stage', () => {
  it('walks the first section from the read to the reviewed mark, saving no answer', async () => {
    const { lesson } = await mountSection('shared-airway')
    const steps = lesson.steps
    expect(currentStepId()).toBe(steps[0].id)
    expect(screen.getByRole('heading', { name: steps[0].title })).toBeInTheDocument()
    expect(document.querySelector('[data-monitor]')).toBeNull()
    expect(document.querySelector('[data-course-teaching]')).not.toBeNull()
    expect(document.querySelector('[data-step-list]')).toBeNull()
    expect(storedRecord()).toMatchObject({
      lastSectionId: 'shared-airway',
      visitedSectionIds: ['shared-airway'],
      reviewedSectionIds: [],
    })

    await reachCourseStep(lesson, lesson.steps[lesson.predictionStepIndex])
    expect(currentStepId()).toBe(steps[lesson.predictionStepIndex].id)
    expect(nowPrimary()?.disabled).toBe(true)
    expect(skipButton()?.textContent).toBe('Continue without answering')
    expect(verdictOutcome()).toBeNull()
    expect(document.querySelector('[data-item-situation]')).not.toBeNull()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    expect(document.querySelector('[data-course-teaching]')).toBeNull()
    const predictStep = steps[lesson.predictionStepIndex]
    commitById(keyedChoiceId(predictStep))
    expect(verdictOutcome()).toBe('correct')
    expect(skipButton()).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
    expect(Object.keys(storedRecord()!).sort()).toEqual(SELF_PACED_KEYS)
    clickPrimary()
    await settle()

    const act = stepOfKind(lesson, 'sort')
    expect(currentStepId()).toBe(act.id)
    expect(nowPrimary()?.disabled).toBe(true)
    expect(skipButton()?.textContent).toBe('Continue without checking')
    placeSortRows(act)
    expect(nowPrimary()?.disabled).toBe(false)
    clickPrimary()
    expect(document.querySelectorAll('[data-sort-verdict="held"]').length).toBe(
      act.interaction.kind === 'sort' ? act.interaction.sort.rows.length : -1,
    )
    expect(nowButton('Try the set again')).toBeDefined()
    clickPrimary()
    await settle()

    expect(currentStepId()).toBe(stepOfKind(lesson, 'explain').id)
    expect(document.querySelector('[data-explain-recap] [data-answer-verdict]')).not.toBeNull()
    expect(document.querySelector('[data-teaching-block="anchor"]')).not.toBeNull()
    expect(document.querySelector('[data-new-concept]')).not.toBeNull()
    expect(document.querySelector('[data-teaching-block="boundary"]')).not.toBeNull()
    clickPrimary()
    await settle()

    const transfer = steps[lesson.transferStepIndex]
    expect(currentStepId()).toBe(transfer.id)
    commitById(otherChoiceId(transfer))
    expect(verdictOutcome()).toBe('not-correct')
    while (nowPrimary()) {
      clickPrimary()
      await settle()
    }
    expect(nowStatus()).toMatch(/end of this section/)
    const completion = document.querySelector('[data-section-completion]')!
    expect(completion).toHaveAttribute('data-reviewed', 'true')
    expect(completion.querySelector('[data-completion-moved-past]')).toBeNull()
    expect(completion.textContent).toContain(
      'Self-paced online learning does not establish procedural competence.',
    )
    expect(completion.querySelector('[data-next-section]')).toHaveAttribute(
      'data-next-section',
      BRONCH_SECTION_IDS[1],
    )
    expect(storedRecord()?.reviewedSectionIds).toEqual(['shared-airway'])
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()

    fireEvent.click(completion.querySelector('[data-toggle-reviewed]')!)
    expect(storedRecord()?.reviewedSectionIds).toEqual([])
    expect(document.querySelector('[data-section-completion]')).toHaveAttribute(
      'data-reviewed',
      'false',
    )
  })

  it('lets a learner look back without losing the live step, and restarts with nothing kept', async () => {
    const { lesson } = await mountSection('shared-airway')
    await reachCourseStep(lesson, lesson.steps[lesson.predictionStepIndex])
    commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
    clickPrimary()
    await settle()
    const actId = lesson.steps[lesson.predictionStepIndex + 1].id
    expect(currentStepId()).toBe(actId)

    fireEvent.click(nowButton('Back')!)
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    expect(nowStatus()).toMatch(/looking back/)
    expect(verdictOutcome()).toBe('correct')
    clickPrimary()
    expect(currentStepId()).toBe(actId)

    fireEvent.click(screen.getByRole('button', { name: /Restart section/ }))
    await settle()
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(verdictOutcome()).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
    expect(storedRecord()?.reviewedSectionIds).toEqual([])
  })

  it('opens at the first step whatever phase the address names, and restores no answer after a reload', async () => {
    const { lesson } = await mountSection('shared-airway')
    await reachCourseStep(lesson, lesson.steps[lesson.predictionStepIndex])
    commitById(otherChoiceId(lesson.steps[lesson.predictionStepIndex]))
    cleanup()

    window.history.replaceState(
      null,
      '',
      '/bronchoscopy-foundations/learn?section=shared-airway&phase=explain',
    )
    await mountSection('shared-airway')
    expect(currentStepId()).toBe(lesson.steps[0].id)
    await reachCourseStep(lesson, lesson.steps[lesson.predictionStepIndex])
    expect(verdictOutcome()).toBeNull()
    expect(document.querySelector('[data-prediction-choices] input:checked')).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
  })
})

/** Self-paced contract (BF-01): explanation first, back to teaching, on without answering. */
describe('optional questions and activities', () => {
  it('opens a question’s explanation before an answer, returns to the teaching, and moves on without answering', async () => {
    const { lesson } = await mountSection('shared-airway')
    const check = lesson.steps[lesson.predictionStepIndex]
    await reachCourseStep(lesson, check)
    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    expect(document.querySelector('[data-explanation-reveal]')).not.toBeNull()
    expect(verdictOutcome()).toBeNull()
    expect(currentStepId()).toBe(check.id)

    fireEvent.click(screen.getByRole('button', { name: 'Review the teaching' }))
    expect(nowStatus()).toMatch(/looking back/)
    clickPrimary()
    expect(currentStepId()).toBe(check.id)
    expect(document.querySelector('[data-explanation-reveal]')).not.toBeNull()

    clickSkip()
    await settle()
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex + 1].id)
    fireEvent.click(nowButton('Back')!)
    expect(currentStepId()).toBe(check.id)
    expect(document.querySelector('[data-step-review]')?.textContent).toMatch(
      /Moved on without answering/,
    )
    clickPrimary()

    // The later review still teaches the question's reasoning.
    await reachCourseStep(lesson, stepOfKind(lesson, 'explain'))
    expect(document.querySelector('[data-explain-recap] [data-explanation-reveal]')).not.toBeNull()
    expect(document.querySelector('[data-explain-recap] [data-answer-verdict]')).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
  })

  it('lets every step of the survey be left; nothing is claimed and no survey is saved', async () => {
    const { lesson } = await mountSection('systematic-survey')
    await walkByLeavingEveryStep(lesson)
    expect(document.querySelector('[data-completion-moved-past]')).not.toBeNull()
    expect(storedRecord()).toMatchObject({
      reviewedSectionIds: ['systematic-survey'],
      surveySnapshot: null,
    })
    cleanup()

    const report = await mountSection('honest-report')
    const yourRecord = report.lesson.steps.find((step) => step.course?.learnerRecord)!
    await reachCourseStep(report.lesson, yourRecord)
    expect(
      document.querySelector('[data-report-field="survey-source"] [data-report-field-evidence]')
        ?.textContent,
    ).toMatch(/No completed survey record/)
  })

  it('saves the survey only when its goals were met on the learner’s controls, leaving the earlier record untouched', async () => {
    const earlier = JSON.stringify({
      ...createEmptyBronchRecord(),
      completedSectionIds: ['systematic-survey'],
      updatedAt: '2026-09-12T00:00:00.000Z',
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    const { lesson } = await mountSection('systematic-survey')
    await reachAct(lesson)
    await performAct(lesson)
    await finishSection(lesson)
    expect(storedRecord()?.surveySnapshot?.sectionId).toBe('systematic-survey')
    cleanup()

    const report = await mountSection('honest-report')
    const yourRecord = report.lesson.steps.find((step) => step.course?.learnerRecord)!
    await reachCourseStep(report.lesson, yourRecord)
    expect(
      document.querySelector('[data-report-field="survey-source"] [data-report-field-evidence]')
        ?.textContent,
    ).toMatch(/saved inspection record is available/)
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })
})

/** Non-target lessons retain their activity and safety boundaries. */
describe('a scope section on the stage', () => {
  it('introduces entry with teaching and opens the controls for practice before the check', async () => {
    const { lesson } = await mountSection('branch-entry')
    expect(controlsFieldset()).toBeNull()
    expect(document.querySelector('[data-normal-airway-tour]')).not.toBeNull()
    expect(storedRecord()?.visitedSectionIds).toEqual(['branch-entry'])
    await reachAct(lesson)
    expect(controlsFieldset()).not.toBeDisabled()
    expect(nowPrimary()).toBeDisabled()
    expect(document.querySelector('[data-now-disabled-reason]')?.textContent).toMatch(
      /continue without completing them/,
    )
    expect(skipButton()?.textContent).toBe('Continue without completing')
    await performAct(lesson)
    await finishSection(lesson)
  })

  it.each(Object.keys(SCOPE_RECIPES).filter((id) => id !== 'five-controls') as BronchSectionId[])(
    '%s: every authored goal is met through the host with the learner’s controls',
    async (sectionId) => {
      const { lesson } = await mountSection(sectionId)
      await reachAct(lesson)
      await performAct(lesson)
      await finishSection(lesson)
      expect(document.querySelector('[data-completion-moved-past]')).toBeNull()
    },
  )

  it('stores nothing about how the scope was driven or which assists were used', async () => {
    const { lesson } = await mountSection('branch-entry')
    await reachAct(lesson)
    await performAct(lesson)
    await finishSection(lesson)
    expect(Object.keys(storedRecord()!).sort()).toEqual(SELF_PACED_KEYS)
    expect(document.querySelector('[data-completion-performance]')).toBeNull()
    expect(document.querySelector('[data-scope-performance]')).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
  })
})

/**
 * The other Act kinds, each with the rule that makes it honest: an unknown line blocks a total
 * (A10); an unsupported report statement is refused (A08); an unsafe scenario move is refused and
 * does not move the case on (A13, A32); a misplaced critical step is named a safety error. Each can
 * be explained on request, and left.
 */
describe('the accounting ledger (A10)', () => {
  it('needs every measured line, refuses an unsafe total, opens the worked arithmetic on request, and holds the answer the record allows', async () => {
    const { lesson } = await mountSection('sedation-and-monitoring')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'ledger')
    expect(document.querySelector('[data-ledger-unknown]')).not.toBeNull()
    expect(document.querySelector<HTMLFieldSetElement>('[data-ledger-total]')?.disabled).toBe(true)
    expect(document.body.textContent).not.toMatch(/remaining safe dose/i)
    expect(skipButton()?.textContent).toBe('Continue without completing')
    fireEvent.click(screen.getByRole('button', { name: 'Show the worked arithmetic' }))
    expect(document.querySelector('[data-ledger-explanation]')).not.toBeNull()
    expect(document.querySelector('[data-ledger-outcome]')).toBeNull()
    expect(nowPrimary()).toBeNull()
    fillLedgerEntries(act)
    expect(document.querySelectorAll('[data-ledger-check="matches"]').length).toBeGreaterThan(0)
    expect(document.querySelector<HTMLFieldSetElement>('[data-ledger-total]')?.disabled).toBe(false)
    answerLedger(act, 'unsafe')
    expect(document.querySelector('[data-ledger-outcome="refused"]')).not.toBeNull()
    expect(nowPrimary()).toBeNull()
    answerLedger(act, 'best')
    expect(document.querySelector('[data-ledger-outcome="held"]')).not.toBeNull()
    expect(nowStatus()).toMatch(/^Done/)
    expect(skipButton()).toBeNull()
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })
})

describe('the report builder (A08)', () => {
  it('refuses a statement the evidence does not support, shows what it supports on request, and completes only on supported ones', async () => {
    const { lesson } = await mountSection('honest-report')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'report')
    if (act.interaction.kind !== 'report') return
    const first = act.interaction.report.fields[0]
    chooseReportOption(act, first.id, false)
    expect(
      document.querySelector(`[data-report-field="${first.id}"] [data-report-verdict="refused"]`),
    ).not.toBeNull()
    expect(nowPrimary()).toBeNull()
    expect(skipButton()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show what the evidence supports' }))
    expect(document.querySelectorAll('[data-report-explanation]').length).toBe(
      act.interaction.report.fields.length,
    )
    fillReport(act)
    expect(document.querySelectorAll('[data-report-verdict="held"]').length).toBe(
      act.interaction.report.fields.length,
    )
    expect(nowStatus()).toMatch(/^Done/)
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })
})

describe('a scenario in frames (A13, A32)', () => {
  it('refuses the unsafe move, keeps the frame, opens the reasoning without moving the case, and advances only on the keyed decision', async () => {
    const { lesson } = await mountSection('poor-return')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'scenario')
    if (act.interaction.kind !== 'scenario') return
    const firstFrame = act.interaction.scenario.frames[0]
    const hasUnsafe = firstFrame.choices.some((choice) => choice.plausibility === 'unsafe')
    if (hasUnsafe) {
      decideFrame(act, 'unsafe')
      expect(document.querySelector('[data-scenario-outcome="refused"]')).not.toBeNull()
      expect(nowPrimary()).toBeNull()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Show the reasoning' }))
    expect(document.querySelector(`[data-scenario-explanation="${firstFrame.id}"]`)).not.toBeNull()
    expect(
      document
        .querySelector('[data-bronch-scenario] [data-scenario-frame]')
        ?.getAttribute('data-scenario-frame'),
    ).toBe(firstFrame.id)
    expect(skipButton()).not.toBeNull()
    decideAllFrames(act)
    expect(document.querySelector('[data-scenario-done]')).not.toBeNull()
    expect(nowStatus()).toMatch(/^Done/)
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })
})

describe('naming views and ordering steps', () => {
  it('names every view, opens the names on request, and can be tried again', async () => {
    const { lesson } = await mountSection('reference-frames')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'identify')
    if (act.interaction.kind !== 'identify') return
    const rows = act.interaction.identify.rows.length
    expect(nowPrimary()?.disabled).toBe(true)
    expect(skipButton()?.textContent).toBe('Continue without checking')
    fireEvent.click(screen.getByRole('button', { name: 'Show the names' }))
    expect(document.querySelectorAll('[data-identify-explanation]').length).toBe(rows)
    nameIdentifyRows(act)
    clickPrimary()
    expect(document.querySelectorAll('[data-identify-verdict="held"]').length).toBe(rows)
    fireEvent.click(nowButton('Try the names again')!)
    expect(document.querySelectorAll('[data-identify-verdict]').length).toBe(0)
    clickPrimary()
    expect(document.querySelectorAll('[data-identify-verdict="held"]').length).toBe(rows)
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })

  it('names a misplaced critical step a safety error, and a retry can hold the authored order', async () => {
    const { lesson } = await mountSection('washing-and-lavage')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'sequence')
    if (act.interaction.kind !== 'sequence') return
    const authored = act.interaction.sequence.steps.map((step) => step.id)
    const critical = act.interaction.sequence.criticalStepIds ?? []
    // Move one critical step to the end: reversed order for it, authored order for the rest.
    const misplaced = [...authored.filter((id) => id !== critical[0]), critical[0]]
    orderSequence(act, misplaced)
    clickPrimary()
    expect(document.querySelector('[data-critical-missed="true"]')).not.toBeNull()

    fireEvent.click(nowButton('Try the order again')!)
    orderSequence(act)
    clickPrimary()
    expect(document.querySelectorAll('[data-sequence-verdict="held"]').length).toBe(authored.length)
    expect(document.querySelector('[data-critical-missed="true"]')).toBeNull()
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })
})

/** The whole core path (A21): every section walked, in the canonical order, to a reviewed mark. */
describe('the core path', () => {
  it('walks every section in order to a reviewed mark and saves no answer', async () => {
    for (const sectionId of BRONCH_SECTION_IDS) {
      const { lesson } = await mountSection(sectionId)
      if (sectionId === 'five-controls') {
        await performFiveControlsLearn(lesson)
      } else {
        await reachAct(lesson)
        await performAct(lesson)
        await finishSection(lesson)
      }
      cleanup()
    }
    const record = storedRecord()
    expect(record?.reviewedSectionIds).toEqual([...BRONCH_SECTION_IDS])
    expect(record?.visitedSectionIds).toEqual([...BRONCH_SECTION_IDS])
    expect(record?.surveySnapshot?.sectionId).toBe('systematic-survey')
    expect(Object.keys(record!).sort()).toEqual(SELF_PACED_KEYS)
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
  }, 120000)
})
