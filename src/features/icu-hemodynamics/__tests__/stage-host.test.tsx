import { act, cleanup, fireEvent, screen } from '@testing-library/react'

import { hemodynamicsSectionSpec } from '../content/sectionSpecs'
import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY } from '../engine/learnProgress'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
} from '../engine/selfPacedProgress'
import {
  checkAnswer,
  clickPrimary,
  advanceToPrediction,
  commitChoice,
  control,
  currentStepId,
  goalStates,
  installDom,
  mountSection,
  nowPrimary,
  nowStatus,
  readAndRepairFlush,
  setLevel,
} from '../test-support/stageHarness'

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
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function tick(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

function stepRows(): readonly string[] {
  return [...document.querySelectorAll('[data-step-list] li')].map(
    (row) => row.getAttribute('data-step-state') ?? '',
  )
}

function verdictOutcome(): string | null {
  return (
    document
      .querySelector('[data-now-card] [data-answer-verdict]')
      ?.getAttribute('data-verdict-outcome') ?? null
  )
}

function storedRecord() {
  return parseSelfPacedRecord(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY))
}

function questionAction(name: 'check' | 'hint-toggle' | 'explanation-toggle' | 'try-again') {
  return document.querySelector<HTMLButtonElement>(`[data-now-card] [data-question-${name}]`)
}

function openTask(index: number) {
  fireEvent.click(document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')[index])
}

/**
 * The pressure-system section on the stage, the self-paced way (HD-01): the walk, an optional
 * question with a stated verdict, the reference set on the line, the flush read and repaired, the
 * explanation with what changed and two stories, the transfer on a new patient, and a reviewed mark
 * the learner can undo. Then the same section left step by step without an answer or an action, a
 * task opened straight from the list, and the question's hint, explanation and Try again.
 */
describe('a section on the stage', () => {
  it('walks the pressure-system section, answering and acting, to a reviewed mark', () => {
    const { lesson } = mountSection('pressure-system')
    const p = lesson.predictionStepIndex
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(screen.getByRole('heading', { name: 'A line that can be trusted' })).toBeInTheDocument()
    expect(storedRecord()?.visitedSectionIds).toEqual(['pressure-system'])

    // The walk: one stop, the line.
    clickPrimary()
    expect(nowStatus()).toMatch(/Every stop visited/)
    clickPrimary()
    advanceToPrediction('pressure-system')
    expect(currentStepId()).toBe(lesson.steps[p].id)

    // The question: the faulty line is loaded and the question view shows no docks. Nothing waits on
    // an answer — Continue is live and Check waits only for a choice.
    expect(document.querySelector('[data-dock="line"]')).toBeNull()
    expect(nowPrimary()?.disabled).toBe(false)
    expect(nowPrimary()?.textContent).toMatch(/Continue without answering/)
    expect(questionAction('check')?.disabled).toBe(true)
    expect(verdictOutcome()).toBeNull()
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(verdictOutcome()).toBe('correct')
    expect(screen.getByText('Correct.')).toBeInTheDocument()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    clickPrimary()

    // Act: the reference. The actions are optional; doing them performs the step.
    expect(currentStepId()).toBe(lesson.steps[p + 1].id)
    expect(goalStates()).toEqual(['false', 'false'])
    expect(nowPrimary()?.textContent).toMatch(/Continue without these actions/)
    setLevel(0)
    fireEvent.click(control('zero'))
    expect(goalStates()).toEqual(['true', 'true'])
    expect(nowStatus()).toMatch(/Done/)
    clickPrimary()

    // Observe: the flush, said and repaired.
    expect(currentStepId()).toBe(lesson.steps[p + 2].id)
    expect(goalStates()).toEqual(['false', 'false', 'false', 'false'])
    readAndRepairFlush('underdamped')
    expect(document.querySelector('[data-flush-outcome]')?.getAttribute('data-flush-outcome')).toBe(
      'correct',
    )
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true'])
    clickPrimary()

    // Explain: the recap, what changed, the rows, the strip, the stories.
    expect(currentStepId()).toBe(lesson.steps[p + 3].id)
    expect(document.querySelector('[data-explain-recap]')?.textContent).toMatch(/^Correct\./)
    expect(document.querySelectorAll('[data-before-after] tbody tr')).toHaveLength(4)
    expect(
      [...document.querySelectorAll('[data-grammar-row]')].map((row) =>
        row.getAttribute('data-grammar-row'),
      ),
    ).toEqual(['reference-offset', 'display-scale', 'overdamped', 'underdamped'])
    expect(document.querySelectorAll('[data-story]')).toHaveLength(2)
    expect(document.querySelector('[data-control-strip="this-control"]')).not.toBeNull()
    clickPrimary()

    // Transfer: a new patient, transducer low and the line damped.
    expect(currentStepId()).toBe(lesson.steps[p + 4].id)
    expect(document.querySelector('[data-dock]')).toBeNull()
    commitChoice(/Re-level the transducer and restore/)
    expect(verdictOutcome()).toBe('correct')
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[p + 5].id)
    setLevel(0)
    readAndRepairFlush('overdamped')
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true', 'true'])
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[p + 6].id)
    expect(storedRecord()?.reviewedSectionIds).toEqual([])
    clickPrimary()

    // Finished: marked reviewed, with an undo. The legacy Learn record is never written.
    expect(screen.getByRole('heading', { name: 'Section finished' })).toBeInTheDocument()
    expect(storedRecord()?.reviewedSectionIds).toEqual(['pressure-system'])
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)).toBeNull()
    expect(
      document.querySelector('[data-practice-pairing]')?.getAttribute('data-practice-pairing'),
    ).toBe('mechanism-match')
    const rows = stepRows()
    expect(rows[0]).toBe('done')
    expect(rows.slice(1, p).every((row) => row === 'passed')).toBe(true)
    expect(rows[p]).toBe('answered')
    expect(rows[p + 1]).toBe('done')
    expect(rows[p + 2]).toBe('done')
    expect(rows[p + 4]).toBe('answered')
    expect(rows[p + 5]).toBe('done')
    expect(rows.at(-1)).toBe('current')
    expect(document.querySelectorAll('[data-step-list] [aria-current="step"]')).toHaveLength(1)
    fireEvent.click(document.querySelector('[data-reviewed-toggle]')!)
    expect(storedRecord()?.reviewedSectionIds).toEqual([])
    expect(
      document.querySelector('[data-reviewed-state]')?.getAttribute('data-reviewed-state'),
    ).toBe('not-reviewed')
  })

  it('can be left step by step without an answer or an action, and records neither', () => {
    const { lesson } = mountSection('pressure-system')
    const p = lesson.predictionStepIndex
    let guard = 60
    while (!document.querySelector('[data-stage-completion]') && guard-- > 0) {
      const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
      if (step.interaction.kind === 'prediction') expect(verdictOutcome()).toBeNull()
      if (step.id === lesson.steps[p + 3].id) {
        // Nothing was changed, so there is no before-and-after table to misread as a result, and
        // the question's reasoning is there without an answer.
        expect(document.querySelector('[data-before-after]')).toBeNull()
        expect(document.querySelector('[data-before-after-absent]')).not.toBeNull()
        expect(
          document.querySelector('[data-explain-recap]')?.getAttribute('data-explain-recap'),
        ).toBe('not-answered')
      }
      const skip = document.querySelector<HTMLButtonElement>('[data-skip-task]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
    }
    expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
    const rows = stepRows()
    expect(rows).not.toContain('done')
    expect(rows).not.toContain('answered')
    expect(rows.slice(0, -1).every((row) => row === 'passed')).toBe(true)
    expect(rows.at(-1)).toBe('current')
  })

  it('opens any task from the task list with its authored state, performing nothing on the way', () => {
    const { lesson } = mountSection('pressure-system')
    const p = lesson.predictionStepIndex
    openTask(p + 1)
    expect(currentStepId()).toBe(lesson.steps[p + 1].id)
    // The faulty line the question describes, not the clean one the section opened on.
    expect(goalStates()).toEqual(['false', 'false'])
    expect(
      stepRows()
        .slice(0, p + 1)
        .every((row) => row === 'passed'),
    ).toBe(true)
    // Opening an earlier task from there is a look back; it answers nothing.
    openTask(p)
    expect(nowStatus()).toMatch(/Reviewing an earlier step/)
    expect(verdictOutcome()).toBeNull()
    expect(document.querySelector('[data-now-card] [data-question-check]')).not.toBeNull()
  })

  it('offers a hint and the explanation before any answer, and Try again clears a checked answer', () => {
    const { lesson } = mountSection('pressure-system')
    const p = lesson.predictionStepIndex
    advanceToPrediction('pressure-system')
    fireEvent.click(questionAction('hint-toggle')!)
    expect(document.querySelector('[data-question-hint]')?.textContent).toContain(
      hemodynamicsSectionSpec('pressure-system').newConcept,
    )
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')

    fireEvent.click(questionAction('explanation-toggle')!)
    expect(document.querySelector('[data-explanation-reveal]')).not.toBeNull()
    expect(document.querySelector('[data-explanation-best]')?.textContent).toMatch(
      /off level, not zeroed, and underdamped/,
    )
    expect(verdictOutcome()).toBeNull()
    expect(stepRows()[p]).toBe('current')
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')

    commitChoice(/Atmospheric zero alone/)
    expect(verdictOutcome()).toBe('not-correct')
    fireEvent.click(questionAction('try-again')!)
    expect(verdictOutcome()).toBeNull()
    expect(document.querySelector('[data-prediction-choices] input:checked')).toBeNull()
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(verdictOutcome()).toBe('correct')
    clickPrimary()
    expect(stepRows()[p]).toBe('answered')
  })

  it('offers Back on the Now card and returns to the live step without losing an answer', () => {
    const { lesson } = mountSection('pressure-system')
    const p = lesson.predictionStepIndex
    advanceToPrediction('pressure-system')
    commitChoice(/off level, not zeroed, and underdamped/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[p + 1].id)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[p].id)
    expect(nowStatus()).toMatch(/Reviewing an earlier step/)
    expect(document.querySelector('[data-controls-locked]')).toBeNull()
    expect(document.querySelector('[data-dock="line"]')).toBeNull()
    expect(verdictOutcome()).toBe('correct')
    while (document.querySelector('[data-now-back]'))
      fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(document.querySelector('[data-now-back]')).toBeNull()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[p + 1].id)
    expect(verdictOutcome()).toBeNull()
    const rows = stepRows()
    expect(rows[0]).toBe('done')
    expect(rows[p]).toBe('answered')
    expect(rows[p + 1]).toBe('current')
  })

  it('restarts from nothing', () => {
    const { lesson } = mountSection('pressure-system')
    advanceToPrediction('pressure-system')
    commitChoice(/off level, not zeroed, and underdamped/)
    fireEvent.click(document.querySelector('[data-stage-restart]')!)
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(verdictOutcome()).toBeNull()
    expect(stepRows()[0]).toBe('current')
  })

  it('fails closed on a URL that names a later phase', () => {
    window.history.replaceState(
      null,
      '',
      '/icu-hemodynamics/learn?activity=pressure-system&phase=explain',
    )
    const { lesson } = mountSection('pressure-system')
    expect(currentStepId()).toBe(lesson.steps[0].id)
  })
})

describe('the orientation section', () => {
  it('checks the question sort row by row in words, opens the worked sort first, and never requires it', () => {
    const { lesson } = mountSection('why-measure')
    clickPrimary()
    commitChoice(/arterial pressure is low at the measurement site/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    expect(document.querySelector('[data-sort-row]')).toBeNull()
    clickPrimary() // read the worked classification before the sort
    expect(nowPrimary()?.textContent).toMatch(/Continue without sorting/)
    expect(questionAction('check')?.disabled).toBe(true)

    // The worked sort opens without placing a row and records no outcome.
    fireEvent.click(questionAction('explanation-toggle')!)
    expect(document.querySelectorAll('[data-sort-shown]')).toHaveLength(7)
    expect(document.querySelector('[data-sort-verdict]')).toBeNull()

    const answers: Record<string, string> = {
      'pa-pressure': 'measured',
      'wedge-pressure': 'measured',
      'cardiac-output': 'calculated',
      'vascular-resistance': 'calculated',
      'oxygen-delivery': 'calculated',
      'fluid-responsiveness': 'beyond',
      cause: 'beyond',
    }
    for (const row of document.querySelectorAll('[data-sort-row]')) {
      fireEvent.change(row.querySelector('select')!, {
        target: { value: answers[row.getAttribute('data-sort-row')!] },
      })
    }
    checkAnswer()
    const verdicts = [...document.querySelectorAll('[data-sort-verdict]')].map((p) =>
      p.getAttribute('data-sort-verdict'),
    )
    expect(verdicts).toEqual([
      'correct',
      'correct',
      'not-correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ])
    expect(
      document.querySelector('[data-sort-row="cardiac-output"] [data-sort-verdict]')?.textContent,
    ).toMatch(/^Not correct\./)
    clickPrimary()
    clickPrimary()
    commitChoice(/Transduced pressures/)
    expect(nowPrimary()?.textContent).toMatch(/Finish the section/)
    clickPrimary()
    expect(storedRecord()?.reviewedSectionIds).toEqual(['why-measure'])
  })

  it('checks a partial sort, giving the origin of every row left unplaced', () => {
    mountSection('why-measure')
    clickPrimary()
    clickPrimary()
    clickPrimary()
    fireEvent.change(document.querySelector('[data-sort-row="cause"] select')!, {
      target: { value: 'beyond' },
    })
    checkAnswer()
    const verdicts = [...document.querySelectorAll('[data-sort-verdict]')].map((p) =>
      p.getAttribute('data-sort-verdict'),
    )
    expect(verdicts.filter((verdict) => verdict === 'correct')).toHaveLength(1)
    expect(verdicts.filter((verdict) => verdict === 'not-placed')).toHaveLength(6)
  })
})

describe('answering on the catheter map', () => {
  it('is one radio group of numbered pins, silent until checked, marked in words after', () => {
    const { lesson } = mountSection('waveform-interpretation')
    // The walk moves the tip to each place and the monitor names it.
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('ra')
    for (let stop = 0; stop < 4; stop += 1) clickPrimary()
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('wedge')
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)

    advanceToPrediction('waveform-interpretation')
    // The question: nothing names the place until an answer is checked or the explanation opened.
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('withheld')
    expect(document.querySelector('[data-map-emphasis-target]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/PAC · RV/)
    expect(screen.getByText('PAC · distal')).toBeInTheDocument()
    const radios = document.querySelectorAll<HTMLInputElement>(
      '[data-catheter-map-answer] input[type="radio"]',
    )
    expect(radios).toHaveLength(5)
    expect(new Set([...radios].map((radio) => radio.name)).size).toBe(1)
    const pins = [...document.querySelectorAll('[data-map-pin]')].map(
      (pin) => `${pin.getAttribute('data-map-pin')}:${pin.textContent}`,
    )
    expect(pins).toEqual(['ra:2', 'rv:3', 'pa:4', 'wedge:5'])
    expect(document.querySelector('[data-catheter-map-outcome]')).toBeNull()
    expect(
      document.querySelector('[data-prediction-choices]:not([data-catheter-map-answer])'),
    ).toBeNull()
    expect(questionAction('check')?.disabled).toBe(true)
    expect(nowPrimary()?.disabled).toBe(false)

    // Choose from a pin, check from the card.
    fireEvent.click(document.querySelector('[data-map-pin="rv"]')!)
    expect(document.querySelector('[data-map-answer-note]')?.textContent).toMatch(
      /Chosen: The right ventricle/,
    )
    checkAnswer()
    expect(document.querySelector('[data-map-emphasis-target="rv"]')).not.toBeNull()
    expect(
      [...document.querySelectorAll('[data-catheter-map-outcome]')].map((o) => o.textContent),
    ).toEqual(['your answer · correct'])
    expect(
      document.querySelector<HTMLFieldSetElement>('[data-catheter-map-answer]')?.disabled,
    ).toBe(true)
    expect(verdictOutcome()).toBe('correct')
  })

  it('names the place when the explanation is opened, recording no answer', () => {
    mountSection('waveform-interpretation')
    advanceToPrediction('waveform-interpretation')
    fireEvent.click(questionAction('explanation-toggle')!)
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('rv')
    expect(document.querySelector('[data-map-emphasis-target="rv"]')).not.toBeNull()
    expect(document.querySelector('[data-catheter-map-outcome]')).toBeNull()
    expect(verdictOutcome()).toBeNull()
    expect(
      document.querySelector<HTMLFieldSetElement>('[data-catheter-map-answer]')?.disabled,
    ).toBe(false)
  })

  it('keeps the off-map option as a row with no pin, never keyed', () => {
    mountSection('waveform-interpretation')
    advanceToPrediction('waveform-interpretation')
    const offMap = document.querySelector('[data-catheter-map-answer] label[data-off-map="true"]')
    expect(offMap?.textContent).toMatch(/cannot be named/)
    expect(document.querySelector('[data-map-pin="line"]')).toBeNull()
    fireEvent.click(offMap!.querySelector('input')!)
    checkAnswer()
    expect(verdictOutcome()).toBe('partly-correct')
  })
})

describe('the tip section', () => {
  it('confirms a place only when the tracing has settled there', () => {
    const { lesson } = mountSection('catheter-advancement')
    clickPrimary()
    commitChoice(/Advance, expecting a rapid systolic rise/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    const rv = () =>
      [...document.querySelectorAll<HTMLLabelElement>('[data-catheter-map-answer] label')].find(
        (l) => /right ventricle/i.test(l.textContent ?? ''),
      )!
    // Claiming the ventricle from the atrium: the tracing does not match.
    fireEvent.click(rv().querySelector('input')!)
    expect(document.querySelector('[data-place-note]')?.textContent).toMatch(/does not match/)
    expect(goalStates()).toEqual(['false', 'false', 'false', 'false'])
    fireEvent.click(control('advance'))
    fireEvent.click(rv().querySelector('input')!)
    expect(document.querySelector('[data-place-note]')?.textContent).toMatch(/still moving/)
    tick(5)
    fireEvent.click(rv().querySelector('input')!)
    expect(document.querySelector('[data-place-note]')?.textContent).toMatch(
      /Confirmed: the right ventricle/,
    )
    expect(goalStates()).toEqual(['true', 'true', 'false', 'false'])
    fireEvent.click(control('advance'))
    tick(5)
    const pa = [
      ...document.querySelectorAll<HTMLLabelElement>('[data-catheter-map-answer] label'),
    ].find((l) => /pulmonary artery/i.test(l.textContent ?? ''))!
    fireEvent.click(pa.querySelector('input')!)
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true'])
    clickPrimary()
    expect(document.querySelector('[data-ventricle-artery]')).not.toBeNull()
  })
})

describe('the wedge section', () => {
  it('stores at end expiration, deflates and says the artery is back; the questions stay optional', () => {
    const { lesson } = mountSection('pawp-capture')
    clickPrimary()
    commitChoice(/Place the cursor at end expiration/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    fireEvent.click(control('inflate'))
    // While the balloon is up, nothing lets the learner leave the step.
    expect(nowPrimary()).toBeDisabled()
    expect(document.querySelector('[data-now-back]')).toBeNull()
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')].every(
        (button) => button.disabled,
      ),
    ).toBe(true)
    expect((control('cursor') as HTMLButtonElement).disabled).toBe(true)
    tick(6)
    expect((control('cursor') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(control('cursor'))
    fireEvent.click(control('store'))
    expect(goalStates()).toEqual(['true', 'false'])
    fireEvent.click(control('deflate'))
    expect(goalStates()).toEqual(['true', 'true'])
    expect(nowPrimary()).not.toBeDisabled()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[3].id)
    expect(nowPrimary()?.textContent).toMatch(/Continue without these actions/)
    fireEvent.click(document.querySelector('[data-return-check] button')!)
    expect(goalStates()).toEqual(['true'])
    expect(nowPrimary()?.textContent).not.toMatch(/without/)
    // Both wedge questions are optional, and each opens its explanation without an answer.
    expect(
      document.querySelectorAll('[data-commitment] [data-question-explanation-toggle]'),
    ).toHaveLength(2)
  })

  it('does not count the simulation releasing the balloon itself as a deflation', () => {
    mountSection('pawp-capture')
    clickPrimary()
    commitChoice(/Place the cursor at end expiration/)
    clickPrimary()
    fireEvent.click(control('inflate'))
    tick(12)
    expect(screen.getByRole('alert').textContent).toMatch(/released the balloon itself/)
    expect(goalStates()).toEqual(['false', 'false'])
    expect(document.querySelector<HTMLButtonElement>('[data-return-check] button')).toBeNull()
  })
})

describe('the capstone', () => {
  it('restores the line, the tip and the series in order, reassesses, then reads a different line', () => {
    const { lesson } = mountSection('pac-signal-validation')
    // HD-08 as authored: the tip reads a false wedge on a line that is high, unzeroed and ringing.
    expect(document.querySelector('[data-dock]')).toBeNull()
    expect(document.querySelector('[data-catheter-map]')).toBeNull()
    clickPrimary()
    commitChoice(/Set every number aside as unconfirmed/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    expect(goalStates()).toEqual(['false', 'false', 'false'])

    // The line: level, zero, then flush — which the dock refuses while the tip is wedged.
    setLevel(0)
    fireEvent.click(control('zero'))
    expect((control('flush') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(control('withdraw'))
    tick(5)
    expect(control('advance')).toBeDisabled() // PA reached; the engine goal below confirms it.
    expect(goalStates()).toEqual(['false', 'true', 'false'])
    readAndRepairFlush('underdamped')
    expect(goalStates()).toEqual(['true', 'true', 'false'])

    // The series: three injections, each read before it is accepted.
    for (let trial = 0; trial < 3; trial += 1) {
      fireEvent.pointerDown(control('inject'), { pointerType: 'mouse', button: 0 })
      tick(2.5)
      fireEvent.pointerUp(control('inject'), { pointerType: 'mouse', button: 0 })
    }
    const cards = document.querySelectorAll('[data-dock="thermodilution"] article')
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      const accept = [...card.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        /Accept/.test(b.textContent ?? ''),
      )!
      expect(accept.disabled).toBe(true)
      fireEvent.click(
        [...card.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
          /Review/.test(b.textContent ?? ''),
        )!,
      )
      fireEvent.click(accept)
    }
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    clickPrimary()

    // Observe: reassess is a control, not a reading.
    expect(currentStepId()).toBe(lesson.steps[3].id)
    expect(nowPrimary()?.textContent).toMatch(/Continue without these actions/)
    fireEvent.click(document.querySelector('[data-reassess] button')!)
    expect(goalStates()).toEqual(['true'])
    clickPrimary()
    expect(document.querySelectorAll('[data-grammar-row]').length).toBeGreaterThanOrEqual(8)
    expect(document.querySelectorAll('[data-before-after] tbody tr').length).toBeGreaterThan(0)
    clickPrimary()

    // Transfer: a systemic arterial line whose shape changed while its mean did not.
    expect(currentStepId()).toBe(lesson.steps[5].id)
    commitChoice(/Run a fast flush and read how the line settles/)
    clickPrimary()
    expect(control('flush').textContent).toMatch(/arterial line/)
    readAndRepairFlush('overdamped')
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    clickPrimary()
    clickPrimary()
    expect(storedRecord()?.reviewedSectionIds).toEqual(['pac-signal-validation'])
  })
})

describe('what the wedge dock says about a deflated balloon', () => {
  it('never describes deflation as proving the occlusion has ended', () => {
    mountSection('pawp-capture')
    clickPrimary()
    commitChoice(/Place the cursor at end expiration/)
    clickPrimary()
    const dock = document.querySelector('[data-dock="wedge"]')!
    expect(dock.textContent).not.toMatch(/nothing is occluding/i)
    expect(dock.textContent).toMatch(/does not by itself establish that the occlusion has ended/i)
    expect(dock.textContent).toMatch(/artery tracing coming back does/i)
  })
})
