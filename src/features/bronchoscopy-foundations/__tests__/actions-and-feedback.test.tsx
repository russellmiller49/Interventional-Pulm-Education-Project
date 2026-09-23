import { cleanup, fireEvent, render } from '@testing-library/react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { flaggedGradingCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { ledgerRowMg } from '../components/stage/BronchLedgerControl'
import { asSentence, OUTCOME_WORDS } from '../components/stage/verdictWords'
import type { BronchSectionId } from '../content/pathway'
import type { BronchStageStep } from '../content/stageLessons'
import type { Plausibility } from '../content/types'
import {
  clickPrimary,
  commitById,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowStatus,
  placeSortRows,
  settle,
} from '../test-support/stageHarness'

/**
 * BF-PRE-REVIEW-02, the activity actions and the feedback after them (fellow walkthrough A12, A13,
 * A15, A16, the module's part of A43, SUP-17). Every case drives the real stage host through its
 * own controls. The first case of each group fails on the unchanged baseline: the ledger's
 * "Answer" and the scenario's "Continue to the next observation" carried a layout class that gave
 * them no button styling, the scenario's instruction still asked for a decision after one, the
 * question vanished under its verdict, and a set row said "Did not hold." without naming where the
 * statement belongs.
 */
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

const query = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T & HTMLElement>(selector)
const skipControl = () => query<HTMLButtonElement>('[data-now-card] [data-now-skip]')

/** Move to a step the way a learner can: skip what is not done, continue what is. */
async function openStep(sectionId: BronchSectionId, kind: BronchStageStep['interaction']['kind']) {
  const { lesson } = await mountSection(sectionId)
  const index = lesson.steps.findIndex(
    (step) => step.interaction.kind === kind && step.course?.kind !== 'transfer',
  )
  for (let i = 0; i < index; i += 1) {
    const skip = skipControl()
    if (skip) fireEvent.click(skip)
    else clickPrimary()
    await settle()
  }
  expect(currentStepId()).toBe(lesson.steps[index].id)
  return { lesson, step: lesson.steps[index] }
}

function choose(selector: string) {
  const input = query<HTMLInputElement>(selector)
  if (!input) throw new Error(`Nothing to choose at ${selector}`)
  fireEvent.click(input)
}

describe('the ledger is checked with the course primary action (A12)', () => {
  it('names Check, stays readable while disabled, and says what is missing', async () => {
    const { step } = await openStep('sedation-and-monitoring', 'ledger')
    if (step.interaction.kind !== 'ledger') throw new Error('not a ledger')
    const ledger = step.interaction.ledger
    const check = () => query<HTMLButtonElement>('[data-ledger-answer]')!
    expect(check().tagName).toBe('BUTTON')
    expect(check()).toHaveAttribute('type', 'button')
    expect(check()).toHaveTextContent('Check this answer')
    expect(check().className).toBe('primary')
    expect(check().className).not.toContain('orderActions')
    // Incomplete: disabled, and described by the entry prompt the learner can see.
    expect(check()).toBeDisabled()
    const reason = () => document.getElementById(check().getAttribute('aria-describedby') ?? '')
    expect(reason()).toHaveTextContent('Enter the milligrams for every measured line')
    // Skip is its own, secondary action.
    expect(skipControl()).toHaveTextContent('Continue without completing')
    expect(skipControl()!.className).toBe('secondary')

    // A false entry (the arithmetic wrong) is flagged, and the question can still be checked:
    // no dose judgement is attached to the entries.
    for (const row of ledger.rows)
      if (row.kind === 'measured')
        fireEvent.change(query(`[data-ledger-row="${row.id}"] input[type="number"]`)!, {
          target: { value: String(ledgerRowMg(row.concentrationMgPerMl, row.volumeMl) + 7) },
        })
    expect(
      [...document.querySelectorAll('[data-ledger-check]')].map((row) =>
        row.getAttribute('data-ledger-check'),
      ),
    ).toEqual(ledger.rows.filter((row) => row.kind === 'measured').map(() => 'recheck'))
    expect(check()).toBeDisabled()
    expect(reason()).toHaveTextContent('Choose a statement, then check it.')

    const unsafe = ledger.totalChoices.find((choice) => choice.plausibility === 'unsafe')!
    choose(`[data-ledger-total] input[value="${unsafe.id}"]`)
    expect(check()).toBeEnabled()
    expect(check()).not.toHaveAttribute('aria-describedby')
    fireEvent.click(check())
    const outcome = query('[data-ledger-outcome]')!
    expect(outcome).toHaveAttribute('data-ledger-outcome', 'refused')
    expect(outcome.querySelector('strong')).toHaveTextContent(OUTCOME_WORDS.unsafe)
    expect(outcome).toHaveTextContent('The table stays open.')
    // Refused, not done: the step stays open, the instruction names the next real step, and the
    // skip is still there.
    expect(nowPrimary()).toBeNull()
    expect(nowStatus()).toBe(
      'Choose another statement and check it, open the worked arithmetic, or continue without completing it.',
    )
    expect(skipControl()).not.toBeNull()
    expect(check()).toBeEnabled()

    const best = ledger.totalChoices.find((choice) => choice.plausibility === 'best')!
    choose(`[data-ledger-total] input[value="${best.id}"]`)
    fireEvent.click(check())
    await settle()
    expect(query('[data-ledger-outcome]')).toHaveAttribute('data-ledger-outcome', 'held')
    expect(query('[data-ledger-outcome] strong')).toHaveTextContent(OUTCOME_WORDS.best)
    // The pressed control is gone; the learner's place is on what it produced.
    expect(query('[data-ledger-answer]')).toBeNull()
    expect(document.activeElement).toBe(query('[data-ledger-outcome]'))
    expect(nowStatus()).toBe('Done. The record allows that statement.')
    expect(nowPrimary()).toBeEnabled()
  })

  it('leaves the worked arithmetic open before any entry, recording nothing', async () => {
    await openStep('sedation-and-monitoring', 'ledger')
    fireEvent.click(query('[data-show-explanation]')!)
    expect(query('[data-ledger-explanation]')).not.toBeNull()
    expect(query('[data-ledger-outcome]')).toBeNull()
    expect(nowPrimary()).toBeNull()
  })
})

const SCENARIO_SECTIONS: readonly BronchSectionId[] = [
  'poor-return',
  'deterioration',
  'bleeding-priorities',
]

describe('the branching cases show a real way on after each decision (A13, SUP-17)', () => {
  it.each(SCENARIO_SECTIONS)(
    '%s: refuse the unsafe move, then show the feedback and a primary Continue',
    async (sectionId) => {
      const { step } = await openStep(sectionId, 'scenario')
      if (step.interaction.kind !== 'scenario') throw new Error('not a scenario')
      const { frames } = step.interaction.scenario
      const decide = () => query<HTMLButtonElement>('[data-scenario-decide]')!
      const openFrame = () => query('[data-scenario-frame]')?.getAttribute('data-scenario-frame')

      expect(decide().className).toBe('primary')
      expect(decide()).toBeDisabled()
      expect(document.getElementById(decide().getAttribute('aria-describedby')!)).toHaveTextContent(
        'Choose an action to enable Decide',
      )
      expect(nowStatus()).toBe(
        'Decide on this card, open the reasoning for this observation, or continue without completing the case.',
      )

      // The first frame, an unsafe move: refused, the frame stays, nothing is done.
      const first = frames[0]
      const unsafe = first.choices.find((choice) => choice.plausibility === 'unsafe')!
      choose(`[data-scenario-frame="${first.id}"] input[value="${unsafe.id}"]`)
      fireEvent.click(decide())
      const refused = query('[data-scenario-outcome]')!
      expect(refused).toHaveAttribute('data-scenario-outcome', 'refused')
      expect(refused.querySelector('strong')).toHaveTextContent(OUTCOME_WORDS.unsafe)
      expect(refused).toHaveTextContent('the case does not move on with it')
      expect(openFrame()).toBe(first.id)
      expect(query('[data-scenario-feedback]')).toBeNull()
      expect(nowPrimary()).toBeNull()
      expect(nowStatus()).toBe(
        'Decide again on this observation, open its reasoning, or continue without completing the case.',
      )
      // Reveal, and skip, stay available after the unsafe choice; no acknowledgment is required.
      fireEvent.click(query('[data-show-explanation]')!)
      expect(query(`[data-scenario-explanation="${first.id}"]`)).not.toBeNull()
      expect(skipControl()).toHaveTextContent('Continue without completing')
      expect(skipControl()!.className).toBe('secondary')

      // Every frame's keyed move, read, then continued past — never advanced by itself.
      for (const [index, frame] of frames.entries()) {
        expect(openFrame()).toBe(frame.id)
        const best = frame.choices.find((choice) => choice.plausibility === 'best')!
        choose(`[data-scenario-frame="${frame.id}"] input[value="${best.id}"]`)
        fireEvent.click(decide())
        await settle()
        if (index === frames.length - 1) break
        expect(query('[data-scenario-feedback]')).toHaveTextContent(OUTCOME_WORDS.best)
        expect(query('[data-scenario-feedback]')).toHaveTextContent(best.label)
        expect(openFrame()).toBeUndefined()
        expect(document.activeElement).toBe(query('[data-scenario-feedback-open]'))
        const next = query<HTMLButtonElement>('[data-scenario-continue]')!
        expect(next.tagName).toBe('BUTTON')
        expect(next).toHaveTextContent('Continue to the next observation')
        expect(next.className).toBe('primary')
        expect(next).toBeEnabled()
        expect(nowStatus()).toBe(
          'Read the feedback on your decision, then continue to the next observation. You can also continue without completing the case.',
        )
        expect(query('[data-show-explanation]')).toBeNull()
        expect(skipControl()).not.toBeNull()
        fireEvent.click(next)
        await settle()
        expect(openFrame()).toBe(frames[index + 1].id)
        expect(document.activeElement).toBe(query('[data-case-observations]'))
        expect(nowStatus()).toBe(
          'Decide on this card, open the reasoning for this observation, or continue without completing the case.',
        )
      }
      // The last keyed decision ends the case; the summary takes focus and Continue opens.
      expect(query('[data-scenario-done]')).not.toBeNull()
      expect(document.activeElement).toBe(query('[data-scenario-done]'))
      expect(nowStatus()).toBe('Done. You worked the case to its end.')
      expect(nowPrimary()).toBeEnabled()
      expect(skipControl()).toBeNull()
    },
  )

  it('an other-than-keyed move says how it compares and leaves the frame to decide again', async () => {
    const { step } = await openStep('deterioration', 'scenario')
    if (step.interaction.kind !== 'scenario') throw new Error('not a scenario')
    const first = step.interaction.scenario.frames[0]
    const other = first.choices.find((choice) => choice.plausibility === 'incorrect-mechanism')!
    choose(`[data-scenario-frame="${first.id}"] input[value="${other.id}"]`)
    fireEvent.click(query('[data-scenario-decide]')!)
    const outcome = query('[data-scenario-outcome]')!
    expect(outcome).toHaveAttribute('data-scenario-outcome', 'other')
    expect(outcome.querySelector('strong')).toHaveTextContent(OUTCOME_WORDS['incorrect-mechanism'])
    expect(outcome).toHaveTextContent('Not the move to make first.')
    expect(query('[data-scenario-frame]')).toHaveAttribute('data-scenario-frame', first.id)
  })
})

describe('the question stays in view while its verdict is read (A15)', () => {
  async function checkWith(plausibility: Plausibility) {
    const { step } = await openStep('shared-airway', 'prediction')
    if (step.interaction.kind !== 'prediction') throw new Error('not a prediction')
    const { stage } = step.interaction
    const choice = stage.item.choices.find((entry) => entry.plausibility === plausibility)!
    commitById(choice.id)
    return { stage, choice }
  }

  it('after a wrong answer, keeps the situation, stem and options, and the shared card names the keyed one', async () => {
    const { stage, choice } = await checkWith('incorrect-mechanism')
    const context = query('[data-question-context]')!
    expect(context).not.toBeNull()
    expect(context.querySelector('[data-question-situation]')).toHaveTextContent(stage.situation!)
    expect(context.querySelector('[data-question-stem]')).toHaveTextContent(stage.item.stem)
    const options = [...context.querySelectorAll('[data-question-option]')]
    expect(options.map((item) => item.getAttribute('data-question-option')).sort()).toEqual(
      stage.item.choices.map((entry) => entry.id).sort(),
    )
    expect(context.querySelector('[data-chosen]')).toHaveAttribute(
      'data-question-option',
      choice.id,
    )
    expect(context.querySelector('[data-chosen]')).toHaveTextContent('your answer')
    // The question comes before the verdict it explains.
    const verdict = query('[data-answer-verdict]')!
    expect(context.compareDocumentPosition(verdict) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The merged shared semantics (EBUS-PRE-REVIEW-01), consumed rather than copied.
    expect(verdict.querySelector('[data-verdict-outcome-label]')).toHaveTextContent('Not correct.')
    expect(verdict.querySelector('details summary')).toHaveTextContent(
      'How the other answers compare',
    )
    expect(verdict.querySelector('details')).toHaveAttribute('data-other-answers-keyed', 'true')
    const keyed = verdict.querySelector('[data-other-answer-role="keyed"]')!
    expect(keyed.querySelector('[data-keyed-answer-label]')).toHaveTextContent(
      'Best-supported answer.',
    )
    expect(verdict.textContent).not.toContain('Why the other answers do not fit')
    // Retry brings the question back with nothing chosen.
    fireEvent.click(query('[data-now-card] [data-now-secondary]')!)
    expect(query('[data-question-context]')).toBeNull()
    expect(document.querySelectorAll('[data-prediction-choices] input')).toHaveLength(
      stage.item.choices.length,
    )
    expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)
  })

  it.each(['best', 'unsafe'] as const)(
    'keeps the question after a %s answer too',
    async (plausibility) => {
      const { stage, choice } = await checkWith(plausibility)
      expect(query('[data-question-context] [data-question-stem]')).toHaveTextContent(
        stage.item.stem,
      )
      expect(query('[data-question-context] [data-chosen]')).toHaveAttribute(
        'data-question-option',
        choice.id,
      )
      expect(query('[data-answer-verdict]')).toHaveAttribute('data-plausibility', plausibility)
    },
  )

  it('shows the explanation before any answer without showing a verdict', async () => {
    await openStep('shared-airway', 'prediction')
    fireEvent.click(query('[data-show-explanation]')!)
    expect(query('[data-prediction-choices]')).not.toBeNull()
    expect(query('[data-answer-verdict]')).toBeNull()
    expect(query('[data-question-context]')).toBeNull()
  })
})

describe('matching feedback names the authored category, row by row (A16, A43)', () => {
  it('a deliberately wrong row says what was chosen and where the course places it', async () => {
    const { step } = await openStep('shared-airway', 'sort')
    if (step.interaction.kind !== 'sort') throw new Error('not a sort')
    const { sort } = step.interaction
    const labelOf = (id: string) => sort.origins.find((origin) => origin.id === id)!.label
    placeSortRows(step, { 'lavage-returned': 'what' })
    clickPrimary()
    const row = query('[data-sort-row="lavage-returned"] [data-sort-verdict]')!
    expect(row).toHaveAttribute('data-sort-verdict', 'other')
    expect(row.querySelector('strong')).toHaveTextContent('Not correct.')
    expect(row.querySelector('[data-sort-chosen]')).toHaveTextContent(
      `You chose: ${asSentence(labelOf('what'))}`,
    )
    expect(row.querySelector('[data-sort-authored]')).toHaveTextContent(
      `Belongs with: ${asSentence(labelOf('result'))}`,
    )
    expect(row).toHaveTextContent(
      sort.rows.find((entry) => entry.id === 'lavage-returned')!.rationale,
    )
    for (const entry of sort.rows.filter((candidate) => candidate.id !== 'lavage-returned')) {
      const verdict = query(`[data-sort-row="${entry.id}"] [data-sort-verdict]`)!
      expect(verdict.querySelector('strong')).toHaveTextContent('Correct.')
      expect(verdict.querySelector('[data-sort-chosen]')).toHaveTextContent(
        `You chose: ${asSentence(labelOf(entry.origin))}`,
      )
      expect(verdict.querySelector('[data-sort-authored]')).toBeNull()
    }
    const act = query('[data-bronch-sort]')!.textContent ?? ''
    expect(act).not.toMatch(/\bHeld\.|Did not hold/)
    expect(act).not.toMatch(/\b\d+\s*(?:of|out of|\/)\s*\d+\b/)
    expect(act).not.toMatch(/\?\./)
  })

  it('explanation first names every row’s category without a stray full stop', async () => {
    const { step } = await openStep('shared-airway', 'sort')
    if (step.interaction.kind !== 'sort') throw new Error('not a sort')
    const { sort } = step.interaction
    fireEvent.click(query('[data-show-explanation]')!)
    for (const entry of sort.rows)
      expect(query(`[data-sort-row="${entry.id}"] [data-sort-explanation]`)).toHaveTextContent(
        `Belongs with: ${asSentence(sort.origins.find((origin) => origin.id === entry.origin)!.label)}`,
      )
    expect(query('[data-bronch-sort]')!.textContent).not.toMatch(/\?\./)
    expect(query('[data-sort-verdict]')).toBeNull()
  })

  it('names, orders and report fields use the same words as the questions', async () => {
    const { step: identifyStep } = await openStep('pre-use-check', 'identify')
    if (identifyStep.interaction.kind !== 'identify') throw new Error('not an identify')
    const [firstRow, ...rest] = identifyStep.interaction.identify.rows
    const wrong = firstRow.choices.find((choice) => choice.id !== firstRow.answerId)!
    choose(`[data-identify-row="${firstRow.id}"] input[value="${wrong.id}"]`)
    for (const row of rest) choose(`[data-identify-row="${row.id}"] input[value="${row.answerId}"]`)
    clickPrimary()
    const verdict = query(`[data-identify-row="${firstRow.id}"] [data-identify-verdict]`)!
    expect(verdict.querySelector('strong')).toHaveTextContent('Not correct.')
    expect(verdict.querySelector('[data-identify-authored]')).toHaveTextContent(
      `Name: ${asSentence(firstRow.choices.find((choice) => choice.id === firstRow.answerId)!.label)}`,
    )
    expect(document.body.textContent).not.toMatch(/\bHeld\.|Did not hold/)
    cleanup()

    const { step: sequenceStep } = await openStep('washing-and-lavage', 'sequence')
    if (sequenceStep.interaction.kind !== 'sequence') throw new Error('not a sequence')
    clickPrimary()
    const verdicts = [...document.querySelectorAll('[data-sequence-verdict]')]
    expect(verdicts.length).toBe(sequenceStep.interaction.sequence.steps.length)
    for (const entry of verdicts)
      expect(entry.textContent).toMatch(
        entry.getAttribute('data-sequence-verdict') === 'held'
          ? /Correct\./
          : /Not correct\. In the worked order this is step \d+\./,
      )
    expect(document.body.textContent).not.toMatch(/\bHeld\.|Did not hold/)
    cleanup()

    const { step: reportStep } = await openStep('describe-findings', 'report')
    if (reportStep.interaction.kind !== 'report') throw new Error('not a report')
    const field = reportStep.interaction.report.fields[0]
    const supported = field.options.find((option) => option.supported)!
    choose(`[data-report-field="${field.id}"] input[value="${supported.id}"]`)
    expect(
      query(`[data-report-field="${field.id}"] [data-report-verdict="held"] strong`),
    ).toHaveTextContent('Correct.')
    expect(document.body.textContent).not.toMatch(/\bHeld\.|Did not hold/)
  })
})

describe('one verdict vocabulary across the course (A43)', () => {
  it('uses the shared verdict card’s own outcome words, and no grading vocabulary', async () => {
    const { step } = await openStep('shared-airway', 'prediction')
    if (step.interaction.kind !== 'prediction') throw new Error('not a prediction')
    const plausibilities: readonly Plausibility[] = [
      'best',
      'reasonable-but-incomplete',
      'incorrect-mechanism',
      'unsafe',
    ]
    const base = step.interaction.stage.item
    const item = {
      ...base,
      choices: base.choices.map((choice, index) => ({
        ...choice,
        plausibility: plausibilities[index],
      })),
    }
    cleanup()
    for (const [index, plausibility] of plausibilities.entries()) {
      render(<AnswerVerdict item={item} choiceId={item.choices[index].id} outcome="stated" />)
      expect(query('[data-verdict-outcome-label]')).toHaveTextContent(OUTCOME_WORDS[plausibility])
      cleanup()
    }
    for (const words of [
      ...Object.values(OUTCOME_WORDS),
      'Check this answer',
      'Choose a statement, then check it.',
      'Continue to the next observation',
      'Read the feedback on your decision, then continue to the next observation. You can also continue without completing the case.',
      'Decide again on this observation, open its reasoning, or continue without completing the case.',
      'Choose another statement and check it, open the worked arithmetic, or continue without completing it.',
    ])
      expect([words, flaggedGradingCopyTerms(words)]).toEqual([words, []])
  })
})
