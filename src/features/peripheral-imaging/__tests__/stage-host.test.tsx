import { act, cleanup, fireEvent, screen } from '@testing-library/react'

import { peripheralImagingSectionIds } from '../content/pathway'
import type { ImagingStageStep } from '../content/stageLessons'
import { parseImagingRecord, PERIPHERAL_IMAGING_STORAGE_KEY } from '../engine/learnProgress'
import {
  clickPrimary,
  commitChainChoice,
  control,
  currentStepId,
  goalStates,
  installDom,
  mountSection,
  nowPrimary,
  nowStatus,
  placeSortRows,
  setRange,
} from '../test-support/stageHarness'

jest.mock(
  '../components/suite/ImagingSuitePane',
  () =>
    jest.requireActual<typeof import('../test-support/SuiteTestDouble')>(
      '../test-support/SuiteTestDouble',
    ).suitePaneDouble,
)
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

function settle() {
  act(() => {
    jest.advanceTimersByTime(10)
  })
}

function verdictOutcome(): string | null {
  return (
    document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome') ?? null
  )
}

function stepRows(): readonly string[] {
  return [...document.querySelectorAll('[data-step-list] li')].map(
    (row) => row.getAttribute('data-step-state') ?? '',
  )
}

function storedRecord() {
  return parseImagingRecord(localStorage.getItem(PERIPHERAL_IMAGING_STORAGE_KEY))
}

/** The keyed choice of a prediction step, by id — the test never depends on the item's words. */
function keyedChoiceId(step: ImagingStageStep): string {
  if (step.interaction.kind !== 'prediction') throw new Error(`${step.id} is not a prediction`)
  const best = step.interaction.item.choices.find((choice) => choice.plausibility === 'best')
  if (!best) throw new Error(`${step.id} has no keyed choice`)
  return best.id
}

function otherChoiceId(step: ImagingStageStep): string {
  if (step.interaction.kind !== 'prediction') throw new Error(`${step.id} is not a prediction`)
  const other = step.interaction.item.choices.find((choice) => choice.plausibility !== 'best')
  if (!other) throw new Error(`${step.id} has no distractor`)
  return other.id
}

function commitById(choiceId: string) {
  const input = document.querySelector<HTMLInputElement>(
    `[data-prediction-choices] input[value="${choiceId}"]`,
  )
  if (!input) throw new Error(`No choice ${choiceId} on step ${currentStepId()}`)
  fireEvent.click(input)
  clickPrimary()
}

function controlsFieldset(): HTMLFieldSetElement | null {
  return document.querySelector<HTMLFieldSetElement>('[data-suite-controls]')
}

/**
 * The projection section, the way a learner walks it: the read, a locked prediction with a
 * stated verdict, the geometry moved until both goals hold, the overlap found again, the
 * explanation with what changed, the transfer, and the record written once.
 */
describe('a lab section on the stage', () => {
  it('walks the projection section from the read to the record', () => {
    const { lesson } = mountSection('projection')
    const steps = lesson.steps
    expect(currentStepId()).toBe(steps[0].id)
    expect(screen.getByRole('heading', { name: steps[0].title })).toBeInTheDocument()
    // The suite is there from the first step, lit at the section's stop, its controls locked
    // until the prediction is committed.
    expect(document.querySelector('[data-suite-scene]')?.getAttribute('data-lit')).not.toBe('')
    expect(controlsFieldset()?.disabled).toBe(true)
    expect(stepRows()[0]).toBe('current')

    // Recognize is a read.
    clickPrimary()
    settle()
    expect(currentStepId()).toBe(steps[lesson.predictionStepIndex].id)

    // Predict: controls locked, no verdict, the primary waits for a choice.
    expect(controlsFieldset()?.disabled).toBe(true)
    expect(nowPrimary()?.disabled).toBe(true)
    expect(verdictOutcome()).toBeNull()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')
    const predictStep = steps[lesson.predictionStepIndex]
    commitById(keyedChoiceId(predictStep))
    expect(verdictOutcome()).toBe('correct')
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    // The first attempt is on the record, once, as made.
    const afterPredict = storedRecord()
    const attemptKey = Object.keys(afterPredict?.firstAttempts ?? {}).find((key) =>
      key.startsWith('projection:'),
    )
    expect(attemptKey).toBeDefined()
    expect(afterPredict?.firstAttempts[attemptKey!].correct).toBe(true)
    expect(afterPredict?.completedSectionIds).not.toContain('projection')
    clickPrimary()
    settle()

    // Act: the controls open; nothing continues until both goals hold.
    const actIndex = lesson.predictionStepIndex + 1
    expect(currentStepId()).toBe(steps[actIndex].id)
    expect(controlsFieldset()?.disabled).toBe(false)
    // The suite opens on the overlap: the tool sits off the target along the ray, on the same
    // pixel. The second goal is a constraint — keep it there — and holds from the start.
    expect(goalStates()).toEqual(['false', 'true'])
    expect(nowPrimary()).toBeNull()
    expect(nowStatus()).toMatch(/Waiting for the work on the suite/)
    setRange('depth', 5)
    expect(goalStates()).toEqual(['false', 'false'])
    setRange('depth', -18)
    setRange('orbit', 60)
    expect(goalStates()).toEqual(['true', 'true'])
    expect(nowStatus()).toMatch(/^Done/)
    clickPrimary()
    settle()

    // Observe: find the overlap again.
    const observeIndex = actIndex + 1
    expect(currentStepId()).toBe(steps[observeIndex].id)
    expect(steps[observeIndex].interaction.kind).toBe('observe')
    expect(goalStates()).toEqual(['false'])
    setRange('orbit', 0)
    expect(goalStates()).toEqual(['true'])
    clickPrimary()
    settle()

    // Explain: the recap of the verdict and the table of what changed.
    const explainIndex = observeIndex + 1
    expect(currentStepId()).toBe(steps[explainIndex].id)
    expect(steps[explainIndex].interaction.kind).toBe('explain')
    expect(document.querySelector('[data-explain-recap] [data-answer-verdict]')).not.toBeNull()
    expect(document.querySelectorAll('[data-before-after] tbody tr').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-control-strip]')).not.toBeNull()
    expect(document.querySelector('[data-recall-answer]')).not.toBeNull()
    clickPrimary()
    settle()

    // Transfer: a second item, a distractor chosen — the verdict says so, in words.
    expect(currentStepId()).toBe(steps[lesson.transferStepIndex].id)
    expect(controlsFieldset()?.disabled).toBe(true)
    const transferStep = steps[lesson.transferStepIndex]
    commitById(otherChoiceId(transferStep))
    expect(verdictOutcome()).toBe('not-correct')
    expect(storedRecord()?.completedSectionIds).not.toContain('projection')

    // Through to the end, and the record written once.
    while (nowPrimary()) {
      clickPrimary()
      settle()
    }
    expect(nowStatus()).toMatch(/worked through/)
    expect(document.querySelector('[data-section-completion]')).not.toBeNull()
    expect(document.querySelector('[data-section-completion] [data-next-section]')).toHaveAttribute(
      'data-next-section',
      'signal',
    )
    const finished = storedRecord()
    expect(finished?.completedSectionIds).toEqual(['projection'])
    expect(
      Object.keys(finished?.firstAttempts ?? {}).filter((k) => k.startsWith('projection:')),
    ).toHaveLength(2)
  })

  it('lets a learner look back without losing the live step, and restarts from nothing', () => {
    const { lesson } = mountSection('projection')
    clickPrimary()
    settle()
    commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
    clickPrimary()
    settle()
    const actId = lesson.steps[lesson.predictionStepIndex + 1].id
    expect(currentStepId()).toBe(actId)

    // Back to the prediction: the verdict, read-only; then return.
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

    // Restart: the section starts again at the first step; the first attempt stays as made.
    const restart = screen.getByRole('button', { name: /Restart section/ })
    fireEvent.click(restart)
    settle()
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(
      Object.keys(storedRecord()?.firstAttempts ?? {}).filter((k) => k.startsWith('projection:')),
    ).toHaveLength(1)
  })

  it('opens at the first step whatever phase the address names, and keeps the first attempt across a reload', () => {
    const { lesson } = mountSection('projection')
    clickPrimary()
    settle()
    commitById(otherChoiceId(lesson.steps[lesson.predictionStepIndex]))
    const before = storedRecord()
    cleanup()

    window.history.replaceState(
      null,
      '',
      '/peripheral-imaging/learn?section=projection&phase=explain',
    )
    mountSection('projection')
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(verdictOutcome()).toBeNull()
    expect(storedRecord()).toEqual(before)
    // A second commitment of the same item does not overwrite the first.
    clickPrimary()
    settle()
    commitById(keyedChoiceId(lesson.steps[lesson.predictionStepIndex]))
    expect(verdictOutcome()).toBe('correct')
    const key = Object.keys(storedRecord()?.firstAttempts ?? {}).find((k) =>
      k.startsWith('projection:'),
    )!
    expect(storedRecord()?.firstAttempts[key]).toEqual(before?.firstAttempts[key])
  })
})

/**
 * The chain walk: the question answered on the chain map itself — nothing lit while it is the
 * question, the keyed stop named after — then six stops on a running suite with the beam moved
 * once.
 */
describe('a section answered on the chain, then walked', () => {
  it('answers on the chain map and walks the six stops', () => {
    const { lesson } = mountSection('chain-walk')
    clickPrimary()
    settle()

    // The prediction is answered on the chain: nothing is lit, the fieldset is there, the
    // card's primary waits for a stop.
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    expect(document.querySelector('[data-suite-scene]')?.getAttribute('data-lit')).toBe('')
    expect(document.querySelector('[data-chain-answer]')).not.toBeNull()
    expect(document.querySelector('[data-chain-answer-note]')).not.toBeNull()
    expect(nowPrimary()?.disabled).toBe(true)
    expect(document.querySelector('[data-chain-outcome]')).toBeNull()
    expect(controlsFieldset()?.disabled).toBe(true)
    const predictStep = lesson.steps[lesson.predictionStepIndex]
    const keyed = keyedChoiceId(predictStep)
    const keyedLabel = [
      ...document.querySelectorAll<HTMLLabelElement>('[data-chain-answer] label'),
    ].find((label) => label.querySelector('input')?.value === keyed)
    expect(keyedLabel).toBeDefined()
    commitChainChoice(new RegExp(keyedLabel!.textContent!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(verdictOutcome()).toBe('correct')
    expect(document.querySelector('[data-chain-answer]')?.getAttribute('data-chain-outcome')).toBe(
      'best',
    )
    expect(document.querySelector<HTMLFieldSetElement>('[data-chain-answer]')?.disabled).toBe(true)
    // The lit stop returns once the answer is committed.
    expect(document.querySelector('[data-suite-scene]')?.getAttribute('data-lit')).not.toBe('')
    clickPrimary()
    settle()

    // The walk: six stops, one card each, then the beam moved once before the walk counts.
    const walk = lesson.steps[lesson.predictionStepIndex + 1]
    expect(walk.interaction.kind).toBe('walk')
    if (walk.interaction.kind !== 'walk') return
    expect(currentStepId()).toBe(walk.id)
    expect(controlsFieldset()?.disabled).toBe(false)
    expect(document.querySelector('[data-walk-stop]')).toHaveAttribute(
      'data-walk-stop',
      walk.interaction.stops[0],
    )
    expect(nowPrimary()?.textContent).toMatch(/Next stop/)
    for (let stop = 0; stop < walk.interaction.stops.length - 1; stop += 1) {
      clickPrimary()
      expect(document.querySelector('[data-walk-stop]')).toHaveAttribute(
        'data-walk-stop',
        walk.interaction.stops[stop + 1],
      )
    }
    expect(nowPrimary()?.textContent).toMatch(/Finish the walk/)
    clickPrimary()
    // Every stop visited, but the beam never moved: the walk waits.
    expect(nowStatus()).toMatch(/Every stop visited/)
    expect(goalStates()).toEqual(['false'])
    expect(nowPrimary()).toBeNull()
    setRange('orbit', 20)
    expect(goalStates()).toEqual(['true'])
    expect(nowStatus()).toMatch(/the beam moved once/)
    clickPrimary()
    settle()
    expect(lesson.steps[lesson.predictionStepIndex + 2].interaction.kind).toBe('explain')
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex + 2].id)
  })
})

/** A sort section: rows placed, committed as a set, graded row by row in words. */
describe('a sorted section', () => {
  it('commits the four-questions sort and grades each row', () => {
    const { lesson } = mountSection('imaging-questions')
    clickPrimary()
    settle()
    const predictStep = lesson.steps[lesson.predictionStepIndex]
    commitById(keyedChoiceId(predictStep))
    clickPrimary()
    settle()
    const sortStep = lesson.steps[lesson.predictionStepIndex + 1]
    expect(sortStep.interaction.kind).toBe('sort')
    if (sortStep.interaction.kind !== 'sort') return
    expect(currentStepId()).toBe(sortStep.id)
    expect(nowPrimary()?.disabled).toBe(true)
    expect(document.querySelector('[data-sort-verdict]')).toBeNull()
    // Place every row on its keyed origin.
    const answers = Object.fromEntries(
      sortStep.interaction.sort.rows.map((row) => [row.id, row.origin]),
    )
    placeSortRows(answers)
    expect(nowPrimary()?.disabled).toBe(false)
    clickPrimary()
    expect(document.querySelector('[data-imaging-sort]')?.getAttribute('data-committed')).toBe(
      'true',
    )
    const verdicts = [...document.querySelectorAll('[data-sort-verdict]')].map((v) =>
      v.getAttribute('data-sort-verdict'),
    )
    expect(verdicts).toHaveLength(sortStep.interaction.sort.rows.length)
    expect(new Set(verdicts)).toEqual(new Set(['held']))
    expect(nowPrimary()?.textContent).toMatch(/Continue/)
  })
})

/** Every section reaches its prediction and commits it, with the same rules in force. */
describe('every section', () => {
  it.each(peripheralImagingSectionIds)(
    '%s locks the suite until the prediction is committed and then opens it',
    (sectionId) => {
      const { lesson } = mountSection(sectionId)
      const first = lesson.steps[0]
      if (first.interaction.kind === 'walk') {
        setRange('orbit', 20)
        for (let stop = 0; stop < first.interaction.stops.length; stop += 1) clickPrimary()
        clickPrimary()
      } else if (first.interaction.kind === 'read') {
        clickPrimary()
      }
      settle()
      const predictStep = lesson.steps[lesson.predictionStepIndex]
      expect(currentStepId()).toBe(predictStep.id)
      if (predictStep.interaction.kind !== 'prediction') throw new Error('not a prediction')
      const fieldset = controlsFieldset()
      if (fieldset) expect(fieldset.disabled).toBe(true)
      const keyed = keyedChoiceId(predictStep)
      if (predictStep.interaction.chainTargets) {
        const input = document.querySelector<HTMLInputElement>(
          `[data-chain-answer] input[value="${keyed}"]`,
        )
        if (!input) throw new Error(`No chain choice ${keyed}`)
        fireEvent.click(input)
        clickPrimary()
      } else {
        commitById(keyed)
      }
      expect(verdictOutcome()).toBe('correct')
      clickPrimary()
      settle()
      const next = lesson.steps[lesson.predictionStepIndex + 1]
      expect(currentStepId()).toBe(next.id)
      if (next.interaction.kind === 'lab-task' && controlsFieldset()) {
        expect(controlsFieldset()?.disabled).toBe(false)
        // At least one goal, none met by default, and a control for the section's lab.
        expect(goalStates().length).toBeGreaterThan(0)
        expect(() => control(firstControlKey())).not.toThrow()
      }
      const record = storedRecord()
      expect(record?.completedSectionIds).toEqual([])
      expect(record?.lastSectionId).toBe(sectionId)
    },
  )
})

function firstControlKey(): string {
  const input = document.querySelector<HTMLElement>(
    '[data-suite-controls] [id^="peripheral-imaging-control-"]',
  )
  return input?.id.replace('peripheral-imaging-control-', '') ?? ''
}
