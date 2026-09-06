import { act, cleanup, fireEvent, screen } from '@testing-library/react'

import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY, parseLearnRecord } from '../engine/learnProgress'
import {
  clickPrimary,
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
    document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome') ?? null
  )
}

/**
 * The whole of the pressure-system section, the way a learner walks it: the walk, a locked
 * prediction with a stated verdict, the reference set on the line, the flush read and repaired,
 * the explanation with what changed and two stories, the transfer on a new patient, and the
 * completion record written once. Then looking back, and starting again from nothing.
 */
describe('a section on the stage', () => {
  it('walks the pressure-system section from the walk to the record', () => {
    const { lesson } = mountSection('pressure-system')
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(screen.getByRole('heading', { name: 'A line that can be trusted' })).toBeInTheDocument()

    // The walk: one stop, the line.
    clickPrimary()
    expect(nowStatus()).toMatch(/Every stop visited/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)

    // The prediction: the faulty line is loaded, the controls are locked, the verdict is stated.
    expect(document.querySelector('[data-controls-locked]')).not.toBeNull()
    expect(document.querySelector<HTMLFieldSetElement>('[data-dock="line"]')?.disabled).toBe(true)
    expect(nowPrimary()?.disabled).toBe(true)
    expect(verdictOutcome()).toBeNull()
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(verdictOutcome()).toBe('correct')
    expect(screen.getByText('Correct.')).toBeInTheDocument()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    clickPrimary()

    // Act: the reference. Continue only appears once both goals are met.
    expect(currentStepId()).toBe(lesson.steps[2].id)
    expect(goalStates()).toEqual(['false', 'false'])
    expect(nowPrimary()).toBeNull()
    setLevel(0)
    fireEvent.click(control('zero'))
    expect(goalStates()).toEqual(['true', 'true'])
    expect(nowStatus()).toMatch(/Done/)
    clickPrimary()

    // Observe: the flush, said and repaired.
    expect(currentStepId()).toBe(lesson.steps[3].id)
    expect(goalStates()).toEqual(['false', 'false', 'false'])
    readAndRepairFlush('underdamped')
    expect(document.querySelector('[data-flush-outcome]')?.getAttribute('data-flush-outcome')).toBe(
      'correct',
    )
    expect(goalStates()).toEqual(['true', 'true', 'true'])
    clickPrimary()

    // Explain: the recap, what changed, the rows, the strip, the stories.
    expect(currentStepId()).toBe(lesson.steps[4].id)
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
    expect(currentStepId()).toBe(lesson.steps[5].id)
    expect(document.querySelector('[data-level-readout]')?.textContent).toBe('-6 cm')
    commitChoice(/Re-level the transducer and restore/)
    expect(verdictOutcome()).toBe('correct')
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[6].id)
    setLevel(0)
    readAndRepairFlush('overdamped')
    expect(goalStates()).toEqual(['true', 'true', 'true', 'true'])
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[7].id)
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)).not.toMatch(
      /"pressure-system"\]/,
    )
    clickPrimary()

    // Done: the record, once; the completion card; the pairing by mechanism.
    expect(screen.getByRole('heading', { name: 'Section worked through' })).toBeInTheDocument()
    const record = parseLearnRecord(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY))
    expect(record?.completedSectionIds).toEqual(['pressure-system'])
    expect(
      document.querySelector('[data-practice-pairing]')?.getAttribute('data-practice-pairing'),
    ).toBe('mechanism-match')
    expect(stepRows()).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'done', 'done'])
    expect(document.querySelectorAll('[data-step-list] [aria-current="step"]')).toHaveLength(1)
  })

  it('offers Back on the Now card and walks home without losing a commitment', () => {
    const { lesson } = mountSection('pressure-system')
    clickPrimary()
    clickPrimary()
    commitChoice(/off level, not zeroed, and underdamped/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[1].id)
    expect(nowStatus()).toMatch(/looking back/)
    expect(document.querySelector('[data-controls-locked]')).toBeNull()
    expect(document.querySelector<HTMLFieldSetElement>('[data-dock="line"]')?.disabled).toBe(true)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(document.querySelector('[data-now-back]')).toBeNull()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    expect(verdictOutcome()).toBeNull()
    expect(stepRows().slice(0, 3)).toEqual(['done', 'done', 'current'])
  })

  it('restarts from nothing', () => {
    const { lesson } = mountSection('pressure-system')
    clickPrimary()
    clickPrimary()
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
  it('commits the question sort as a set and says each row in words', () => {
    const { lesson } = mountSection('why-measure')
    clickPrimary()
    commitChoice(/push behind the blood/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    expect(nowPrimary()?.disabled).toBe(true)
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
    expect(document.querySelector('[data-sort-verdict]')).toBeNull()
    clickPrimary()
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
    commitChoice(/pressures where its tip sits/)
    clickPrimary()
    expect(
      parseLearnRecord(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY))
        ?.completedSectionIds,
    ).toEqual(['why-measure'])
  })
})

describe('answering on the catheter map', () => {
  it('is one radio group of numbered pins, silent until committed, marked in words after', () => {
    const { lesson } = mountSection('waveform-interpretation')
    // The walk moves the tip to each place and the monitor names it.
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('ra')
    for (let stop = 0; stop < 4; stop += 1) clickPrimary()
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('wedge')
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)

    // The question: nothing names the place.
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
    expect(nowPrimary()?.disabled).toBe(true)

    // Choose from a pin, commit from the Now card.
    fireEvent.click(document.querySelector('[data-map-pin="rv"]')!)
    expect(document.querySelector('[data-map-answer-note]')?.textContent).toMatch(
      /Chosen: The right ventricle/,
    )
    clickPrimary()
    expect(document.querySelector('[data-map-emphasis-target="rv"]')).not.toBeNull()
    expect(
      [...document.querySelectorAll('[data-catheter-map-outcome]')].map((o) => o.textContent),
    ).toEqual(['your answer · correct'])
    expect(
      document.querySelector<HTMLFieldSetElement>('[data-catheter-map-answer]')?.disabled,
    ).toBe(true)
    expect(verdictOutcome()).toBe('correct')
  })

  it('keeps the off-map option as a row with no pin, never keyed', () => {
    mountSection('waveform-interpretation')
    for (let stop = 0; stop < 5; stop += 1) clickPrimary()
    const offMap = document.querySelector('[data-catheter-map-answer] label[data-off-map="true"]')
    expect(offMap?.textContent).toMatch(/cannot be named/)
    expect(document.querySelector('[data-map-pin="line"]')).toBeNull()
    fireEvent.click(offMap!.querySelector('input')!)
    clickPrimary()
    expect(verdictOutcome()).toBe('partly-correct')
  })
})

describe('the tip section', () => {
  it('confirms a place only when the tracing has settled there', () => {
    const { lesson } = mountSection('catheter-advancement')
    clickPrimary()
    commitChoice(/Advance, expecting the ventricular shape/)
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
  it('needs the learner to store at end expiration, deflate, and say the artery is back', () => {
    const { lesson } = mountSection('pawp-capture')
    clickPrimary()
    commitChoice(/Place the cursor at end expiration/)
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[2].id)
    fireEvent.click(control('inflate'))
    expect((control('cursor') as HTMLButtonElement).disabled).toBe(true)
    tick(6)
    expect((control('cursor') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(control('cursor'))
    fireEvent.click(control('store'))
    expect(goalStates()).toEqual(['true', 'false'])
    fireEvent.click(control('deflate'))
    expect(goalStates()).toEqual(['true', 'true'])
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[3].id)
    expect(nowPrimary()).toBeNull()
    fireEvent.click(document.querySelector('[data-return-check] button')!)
    expect(goalStates()).toEqual(['true'])
    expect(nowPrimary()).toBeNull()
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
    expect(document.querySelector('[data-level-readout]')?.textContent).toBe('+10 cm')
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('wedge')
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
    expect(document.querySelector('[data-catheter-map]')?.getAttribute('data-tip')).toBe('pa')
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
    expect(nowPrimary()).toBeNull()
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
    expect(
      parseLearnRecord(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY))
        ?.completedSectionIds,
    ).toEqual(['pac-signal-validation'])
  })
})

describe('what the wedge dock says about a deflated balloon', () => {
  it('never describes deflation as proving the occlusion has ended', () => {
    mountSection('pawp-capture')
    const dock = document.querySelector('[data-dock="wedge"]')!
    expect(dock.textContent).not.toMatch(/nothing is occluding/i)
    expect(dock.textContent).toMatch(/does not by itself establish that the occlusion has ended/i)
    expect(dock.textContent).toMatch(/artery tracing coming back does/i)
  })
})
