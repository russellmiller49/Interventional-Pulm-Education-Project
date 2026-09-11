import { cleanup, fireEvent, screen } from '@testing-library/react'

import { BRONCH_SECTION_IDS, type BronchSectionId } from '../content/pathway'
import type { BronchStageLesson, BronchStageStep } from '../content/stageLessons'
import { BRONCH_STORAGE_KEY, parseBronchRecord } from '../engine/learnProgress'
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
  goalStates,
  installDom,
  keyedChoiceId,
  mountSection,
  nameIdentifyRows,
  nowPrimary,
  nowStatus,
  orderSequence,
  otherChoiceId,
  placeSortRows,
  scopePilot,
  setRange,
  settle,
  stepRows,
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

function storedRecord() {
  return parseBronchRecord(localStorage.getItem(BRONCH_STORAGE_KEY))
}

function stepOfKind(lesson: BronchStageLesson, kind: BronchStageStep['interaction']['kind']) {
  const step = lesson.steps.find((candidate) => candidate.interaction.kind === kind)
  if (!step) throw new Error(`${lesson.sectionId} has no ${kind} step`)
  return step
}

/** Reads the Recognize step and commits the keyed prediction. */
async function reachAct(lesson: BronchStageLesson) {
  clickPrimary()
  await settle()
  commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
  clickPrimary()
  await settle()
}

/** Does the Act (and Observe) of any section the way a learner would, keyed answers throughout. */
async function performAct(lesson: BronchStageLesson) {
  const act = stepOfKind(
    lesson,
    lesson.section.act.kind === 'scope-lab' ? 'scope-task' : lesson.section.act.kind,
  )
  expect(currentStepId()).toBe(act.id)
  switch (act.interaction.kind) {
    case 'sort':
      placeSortRows(act)
      clickPrimary()
      clickPrimary()
      break
    case 'identify':
      nameIdentifyRows(act)
      clickPrimary()
      clickPrimary()
      break
    case 'sequence':
      orderSequence(act)
      clickPrimary()
      clickPrimary()
      break
    case 'ledger':
      fillLedgerEntries(act)
      answerLedger(act, 'best')
      clickPrimary()
      break
    case 'report':
      fillReport(act)
      clickPrimary()
      break
    case 'scenario':
      decideAllFrames(act)
      clickPrimary()
      break
    case 'scope-task': {
      const recipe = SCOPE_RECIPES[lesson.sectionId]
      if (!recipe) throw new Error(`No scope recipe for ${lesson.sectionId}`)
      recipe.act(scopePilot())
      expect(goalStates().every((state) => state === 'true')).toBe(true)
      clickPrimary()
      await settle()
      if (recipe.observe) {
        const observe = stepOfKind(lesson, 'observe')
        expect(currentStepId()).toBe(observe.id)
        recipe.observe(scopePilot())
        expect(goalStates().every((state) => state === 'true')).toBe(true)
        clickPrimary()
      }
      break
    }
    default:
      throw new Error(`Unexpected act ${act.interaction.kind}`)
  }
  await settle()
}

async function finishSection(lesson: BronchStageLesson, transferKeyed = true) {
  expect(currentStepId()).toBe(stepOfKind(lesson, 'explain').id)
  clickPrimary()
  await settle()
  const transfer = lesson.steps[lesson.transferStepIndex]
  expect(currentStepId()).toBe(transfer.id)
  commitById(transferKeyed ? keyedChoiceId(transfer) : otherChoiceId(transfer))
  while (nowPrimary()) {
    clickPrimary()
    await settle()
  }
  expect(nowStatus()).toMatch(/worked through/)
}

/**
 * A sort section, the way a learner walks it: the read, a locked prediction with a stated
 * verdict, the set placed, the explanation with the recap, the transfer, and the record written
 * once.
 */
describe('a sort section on the stage', () => {
  it('walks the first section from the read to the record', async () => {
    const { lesson } = await mountSection('shared-airway')
    const steps = lesson.steps
    expect(currentStepId()).toBe(steps[0].id)
    expect(screen.getByRole('heading', { name: steps[0].title })).toBeInTheDocument()
    expect(document.querySelector('[data-monitor]')).not.toBeNull()
    expect(stepRows()[0]).toBe('current')

    clickPrimary()
    await settle()
    expect(currentStepId()).toBe(steps[lesson.predictionStepIndex].id)
    expect(nowPrimary()?.disabled).toBe(true)
    expect(verdictOutcome()).toBeNull()
    expect(document.querySelector('[data-item-situation]')).not.toBeNull()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')
    expect(document.querySelector('[data-read-before-you-decide]')).not.toBeNull()
    const predictStep = steps[lesson.predictionStepIndex]
    commitById(keyedChoiceId(predictStep))
    expect(verdictOutcome()).toBe('correct')
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    const afterPredict = storedRecord()
    const attemptKey = Object.keys(afterPredict?.firstAttempts ?? {}).find((key) =>
      key.startsWith('shared-airway:'),
    )
    expect(attemptKey).toBeDefined()
    expect(afterPredict?.firstAttempts[attemptKey!].correct).toBe(true)
    expect(afterPredict?.completedSectionIds).not.toContain('shared-airway')
    clickPrimary()
    await settle()

    const act = stepOfKind(lesson, 'sort')
    expect(currentStepId()).toBe(act.id)
    expect(nowPrimary()?.disabled).toBe(true)
    placeSortRows(act)
    expect(nowPrimary()?.disabled).toBe(false)
    clickPrimary()
    expect(document.querySelectorAll('[data-sort-verdict="held"]').length).toBe(
      act.interaction.kind === 'sort' ? act.interaction.sort.rows.length : -1,
    )
    clickPrimary()
    await settle()

    expect(currentStepId()).toBe(stepOfKind(lesson, 'explain').id)
    expect(document.querySelector('[data-explain-recap] [data-answer-verdict]')).not.toBeNull()
    expect(document.querySelector('[data-control-strip]')).not.toBeNull()
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
    expect(nowStatus()).toMatch(/worked through/)
    expect(document.querySelector('[data-section-completion]')).not.toBeNull()
    expect(document.querySelector('[data-section-completion] [data-next-section]')).toHaveAttribute(
      'data-next-section',
      BRONCH_SECTION_IDS[1],
    )
    const finished = storedRecord()
    expect(finished?.completedSectionIds).toEqual(['shared-airway'])
    expect(
      Object.keys(finished?.firstAttempts ?? {}).filter((key) => key.startsWith('shared-airway:')),
    ).toHaveLength(2)
  })

  it('lets a learner look back without losing the live step, and restarts from nothing', async () => {
    const { lesson } = await mountSection('shared-airway')
    clickPrimary()
    await settle()
    commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
    clickPrimary()
    await settle()
    const actId = lesson.steps[lesson.predictionStepIndex + 1].id
    expect(currentStepId()).toBe(actId)

    const back = [...document.querySelectorAll<HTMLButtonElement>('[data-now-card] button')].find(
      (button) => /^Back to/.test(button.textContent ?? ''),
    )
    expect(back).toBeDefined()
    fireEvent.click(back!)
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    expect(nowStatus()).toMatch(/looking back/)
    expect(verdictOutcome()).toBe('correct')
    clickPrimary()
    expect(currentStepId()).toBe(actId)

    const restart = screen.getByRole('button', { name: /Restart section/ })
    fireEvent.click(restart)
    await settle()
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(
      Object.keys(storedRecord()?.firstAttempts ?? {}).filter((k) =>
        k.startsWith('shared-airway:'),
      ),
    ).toHaveLength(1)
  })

  it('opens at the first step whatever phase the address names, and keeps the first attempt across a reload', async () => {
    const { lesson } = await mountSection('shared-airway')
    clickPrimary()
    await settle()
    commitById(otherChoiceId(lesson.steps[lesson.predictionStepIndex]))
    const before = storedRecord()
    cleanup()

    window.history.replaceState(
      null,
      '',
      '/bronchoscopy-foundations/learn?section=shared-airway&phase=explain',
    )
    await mountSection('shared-airway')
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(verdictOutcome()).toBeNull()
    expect(storedRecord()).toEqual(before)
    clickPrimary()
    await settle()
    commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
    expect(verdictOutcome()).toBe('correct')
    const key = Object.keys(storedRecord()?.firstAttempts ?? {}).find((k) =>
      k.startsWith('shared-airway:'),
    )!
    expect(storedRecord()?.firstAttempts[key]).toEqual(before?.firstAttempts[key])
  })
})

/**
 * The bench: the scope's controls are locked until the prediction is committed, then one control
 * at a time meets the goals, the Observe step follows, and the completion record says how the
 * scope was driven (A18).
 */
describe('a scope section on the stage', () => {
  it('locks the dock until the commitment, then drives the bench through its goals', async () => {
    const { lesson } = await mountSection('five-controls')
    expect(document.querySelector('[data-scope-scene]')).not.toBeNull()
    expect(controlsFieldset()?.disabled).toBe(true)
    clickPrimary()
    await settle()
    expect(controlsFieldset()?.disabled).toBe(true)
    commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
    expect(controlsFieldset()?.disabled).toBe(true)
    clickPrimary()
    await settle()

    const act = stepOfKind(lesson, 'scope-task')
    expect(currentStepId()).toBe(act.id)
    expect(controlsFieldset()?.disabled).toBe(false)
    expect(goalStates().every((state) => state === 'false')).toBe(true)
    expect(nowPrimary()).toBeNull()
    expect(nowStatus()).toMatch(/Waiting for the work in the Simulator panel/)
    // The dock's own controls reach the engine: a rotation set from the range is on the readouts.
    setRange('rotate', 45)
    expect(document.querySelector('[data-readout="rotationDeg"] dd')?.textContent).toMatch(/45/)
    setRange('deflect', 45)
    setRange('rotate', 90)
    expect(goalStates().every((state) => state === 'true')).toBe(true)
    expect(nowStatus()).toMatch(/^Done/)
    clickPrimary()
    await settle()

    const observe = stepOfKind(lesson, 'observe')
    expect(currentStepId()).toBe(observe.id)
    expect(goalStates().every((state) => state === 'false')).toBe(true)
    SCOPE_RECIPES['five-controls']!.observe!(scopePilot())
    expect(goalStates().every((state) => state === 'true')).toBe(true)
    clickPrimary()
    await settle()

    expect(currentStepId()).toBe(stepOfKind(lesson, 'explain').id)
    expect(document.querySelector('[data-scope-performance]')?.textContent).toMatch(
      /keyboard|pointer/,
    )
    await finishSection(lesson)
    const record = storedRecord()
    expect(record?.completedSectionIds).toEqual(['five-controls'])
    expect(record?.sectionPerformance['five-controls']).toEqual({
      inputModes: expect.arrayContaining(['pointer']),
      assistsUsed: [],
      unaided: true,
    })
    expect(document.querySelector('[data-completion-performance]')).not.toBeNull()
    expect(document.querySelector('[data-completion-physical-skill]')).not.toBeNull()
  })

  it.each(Object.keys(SCOPE_RECIPES) as BronchSectionId[])(
    '%s: every authored goal is met through the host with the learner’s controls',
    async (sectionId) => {
      const { lesson } = await mountSection(sectionId)
      await reachAct(lesson)
      await performAct(lesson)
      await finishSection(lesson)
      const record = storedRecord()
      expect(record?.completedSectionIds).toEqual([sectionId])
      expect(record?.sectionPerformance[sectionId]).toBeDefined()
    },
  )

  it('records assisted travel as assisted, never as unaided (A18)', async () => {
    const { lesson } = await mountSection('branch-entry')
    await reachAct(lesson)
    await performAct(lesson)
    await finishSection(lesson)
    const performance = storedRecord()?.sectionPerformance['branch-entry']
    expect(performance?.unaided).toBe(false)
    expect(performance?.assistsUsed).toEqual(expect.arrayContaining(['centerline-lock']))
    expect(document.querySelector('[data-completion-performance]')?.textContent).toMatch(/assisted/)
  })
})

/**
 * The other Act kinds, each with the rule that makes it honest: an unknown line blocks a total
 * (A10); an unsupported report statement is refused (A08); an unsafe scenario move is refused and
 * cannot complete the step (A13, A32); a misplaced critical step is named a safety error.
 */
describe('the accounting ledger (A10)', () => {
  it('needs every measured line, refuses an unsafe total, and holds the answer the record allows', async () => {
    const { lesson } = await mountSection('sedation-and-monitoring')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'ledger')
    expect(document.querySelector('[data-ledger-unknown]')).not.toBeNull()
    expect(document.querySelector<HTMLFieldSetElement>('[data-ledger-total]')?.disabled).toBe(true)
    expect(document.body.textContent).not.toMatch(/remaining safe dose/i)
    fillLedgerEntries(act)
    expect(document.querySelectorAll('[data-ledger-check="matches"]').length).toBeGreaterThan(0)
    expect(document.querySelector<HTMLFieldSetElement>('[data-ledger-total]')?.disabled).toBe(false)
    answerLedger(act, 'unsafe')
    expect(document.querySelector('[data-ledger-outcome="refused"]')).not.toBeNull()
    expect(nowPrimary()).toBeNull()
    answerLedger(act, 'best')
    expect(document.querySelector('[data-ledger-outcome="held"]')).not.toBeNull()
    expect(nowStatus()).toMatch(/^Done/)
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })
})

describe('the report builder (A08)', () => {
  it('refuses a statement the evidence does not support and completes only on supported ones', async () => {
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
  it('refuses the unsafe move, keeps the frame, and advances only on the keyed decision', async () => {
    const { lesson } = await mountSection('poor-return')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'scenario')
    if (act.interaction.kind !== 'scenario') return
    const firstFrame = act.interaction.scenario.frames[0]
    const hasUnsafe = firstFrame.choices.some((choice) => choice.plausibility === 'unsafe')
    if (hasUnsafe) {
      decideFrame(act, 'unsafe')
      expect(document.querySelector('[data-scenario-outcome="refused"]')).not.toBeNull()
      expect(
        document.querySelector('[data-scenario-frame]')?.getAttribute('data-scenario-frame'),
      ).toBe(firstFrame.id)
      expect(nowPrimary()).toBeNull()
    }
    decideAllFrames(act)
    expect(document.querySelector('[data-scenario-done]')).not.toBeNull()
    expect(nowStatus()).toMatch(/^Done/)
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })
})

describe('naming views and ordering steps', () => {
  it('names every view and reads each row after the commitment', async () => {
    const { lesson } = await mountSection('reference-frames')
    await reachAct(lesson)
    const act = stepOfKind(lesson, 'identify')
    expect(nowPrimary()?.disabled).toBe(true)
    nameIdentifyRows(act)
    clickPrimary()
    expect(document.querySelectorAll('[data-identify-verdict="held"]').length).toBe(
      act.interaction.kind === 'identify' ? act.interaction.identify.rows.length : -1,
    )
    clickPrimary()
    await settle()
    await finishSection(lesson)
  })

  it('names a misplaced critical step a safety error, and holds the authored order', async () => {
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
    cleanup()

    const again = await mountSection('washing-and-lavage')
    await reachAct(again.lesson)
    const actAgain = stepOfKind(again.lesson, 'sequence')
    orderSequence(actAgain)
    clickPrimary()
    expect(document.querySelectorAll('[data-sequence-verdict="held"]').length).toBe(authored.length)
    expect(document.querySelector('[data-critical-missed="true"]')).toBeNull()
    clickPrimary()
    await settle()
    await finishSection(again.lesson)
  })
})

/** The whole core path (A21): every section walked to its record, in the canonical order. */
describe('the core path', () => {
  it('walks every section in order and records each once', async () => {
    for (const sectionId of BRONCH_SECTION_IDS) {
      const { lesson } = await mountSection(sectionId)
      await reachAct(lesson)
      await performAct(lesson)
      await finishSection(lesson)
      cleanup()
    }
    const record = storedRecord()
    expect(record?.completedSectionIds).toEqual([...BRONCH_SECTION_IDS])
    expect(Object.keys(record?.firstAttempts ?? {})).toHaveLength(BRONCH_SECTION_IDS.length * 2)
  }, 120000)
})
