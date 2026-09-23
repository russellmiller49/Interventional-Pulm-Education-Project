import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef, type RefObject } from 'react'

import { PracticePage } from '../components/PracticePage'
import { IntegratedCasesPage } from '../components/IntegratedCasesPage'
import { LessonHost } from '../components/LessonHost'
import { MatchingActivity } from '../components/MatchingActivity'
import { SequenceActivity } from '../components/SequenceActivity'
import { QuestionExplanation } from '../components/QuestionExplanation'
import { useLessonChromeClearance } from '../components/useLessonChromeClearance'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { LESSONS } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { taskErrors, newExamination } from '../engine/examination'
import { MODEL_WINDOW_CASE, EXAMINATION_CASE } from '../content/examination-cases'
import { initialModelState, modelReducer, type NeedleState } from '@/lib/ebus-model-contract'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import type { ClinicalLearningItem } from '@/features/learning-module/activity'

/**
 * EBUS-PRE-REVIEW-01 — the concrete defects this batch repairs.
 *
 * Every assertion here fails on the code as it stood at `77a141cc`. Each names the source row it
 * comes from. Geometry is checked in the browser and recorded in the batch handoff; jsdom does no
 * layout, so the clearance work is held here as the stylesheet's declarations and the measuring
 * hook's arithmetic.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/Workbench', () => ({
  Workbench: ({ onObservation }: { onObservation: (s: EbusObservation) => void }) => (
    <section data-mock-workbench>
      <button onClick={() => onObservation(EMPTY_EBUS_OBSERVATION)}>Report nothing</button>
    </section>
  ),
}))
jest.mock('../components/DecisionImage', () => ({
  DecisionImage: ({ station }: { station: string }) => (
    <figure data-mock-decision-image={station}>Reference CT for station {station}</figure>
  ),
}))
jest.mock('../components/StationFigure', () => ({
  StationFigure: ({ station }: { station: string }) => <figure data-mock-station={station} />,
}))

beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

const boundaryCase = PRACTICE_CASES.find((entry) => entry.id === 'practice-boundary')!
const openBoundaryCase = () => {
  render(<PracticePage />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(boundaryCase.title) }))
}
const caseOpen = () => !!document.querySelector('[data-ebus-case]')
const leaveCase = () => fireEvent.click(screen.getByRole('button', { name: 'Leave this case' }))
const practiceTab = () =>
  document.querySelector('a[aria-current="page"][href$="/ebus-guided/practice"]') as HTMLElement

/* A — the comparison after a wrong answer (L4-1, PR-3, CS-6) ------------------------------- */

describe('feedback says which answer is which', () => {
  it('does not file the keyed answer under answers that do not fit, in a case check', () => {
    openBoundaryCase()
    const wrong = boundaryCase.questions[0].choices.find((c) => !c.correct && !c.unsafe)!
    const keyed = boundaryCase.questions[0].choices.find((c) => c.correct)!
    fireEvent.click(screen.getByLabelText(wrong.text))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))

    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(within(verdict as HTMLElement).queryByText(/do not fit/i)).toBeNull()
    expect(within(verdict as HTMLElement).getByText(/how the other answers compare/i)).toBeVisible()
    const keyedRow = verdict.querySelector('[data-other-answer-role="keyed"]')!
    expect(keyedRow.textContent).toContain(keyed.text)
    expect(keyedRow.querySelector('[data-keyed-answer-label]')).not.toBeNull()
    // Nothing is withheld to avoid the contradiction.
    expect(verdict.querySelectorAll('[data-other-answers] li')).toHaveLength(
      boundaryCase.questions[0].choices.length - 1,
    )
  })

  it('keeps the original heading when the learner took the keyed answer', () => {
    openBoundaryCase()
    const keyed = boundaryCase.questions[0].choices.find((c) => c.correct)!
    fireEvent.click(screen.getByLabelText(keyed.text))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(
      within(verdict as HTMLElement).getByText(/why the other answers do not fit/i),
    ).toBeVisible()
    expect(verdict.querySelector('[data-keyed-answer-label]')).toBeNull()
  })

  /*
   * L4-2. The shared card's unsafe title said the course was stopping; the course is self-paced
   * and nothing stopped. The concern is named instead, and the announcement, the retry and the
   * way forward are all still there.
   */
  it('describes an unsafe choice truthfully and still lets the learner move', () => {
    const coupling = LESSONS.find((lesson) => lesson.id === 'acoustic-contact')!
    const unsafe = coupling.transfer.choices.find((c) => c.unsafe)!
    render(<LessonHost lesson={coupling} />)
    // Jump to the transfer check through the outline rather than walking the acquisition.
    fireEvent.click(screen.getByRole('button', { name: 'Course outline' }))
    fireEvent.click(screen.getByRole('button', { name: /Reassess another window/ }))
    fireEvent.click(screen.getByLabelText(unsafe.text))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))

    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(verdict.textContent).not.toContain('Stopping here')
    expect(verdict.textContent).toContain('Unsafe — this would put a real patient at risk')
    // Text, semantics and a data hook the stylesheet marks with more than colour.
    expect(verdict.textContent).toContain('Not correct, and unsafe.')
    expect(verdict).toHaveAttribute('role', 'alert')
    expect(verdict).toHaveAttribute('aria-live', 'assertive')
    expect(verdict).toHaveAttribute('data-plausibility', 'unsafe')
    // No acknowledgement, no forced retry: both routes stay open.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(document.querySelector('[data-now-primary]')).toBeEnabled()
  })

  it('marks an unsafe verdict with more than its colour', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/ebus-guided/components/course.module.css'),
      'utf8',
    )
    expect(css).toMatch(
      /\.questionFeedback :global\(\[data-answer-verdict\]\[data-plausibility='unsafe'\]\)\s*{[^}]*border-left-style:\s*double/,
    )
  })

  /* CS-6: the takeaway restated the keyed rationale word for word. */
  it('drops a takeaway that only repeats the keyed rationale, and keeps one that does not', () => {
    // Typed as the item rather than `as const`: a const assertion makes `choices` a readonly
    // tuple, which `ClinicalLearningItem` does not accept.
    const base: Omit<ClinicalLearningItem, 'explanation'> = {
      id: 'x',
      activityId: 'ebus-guided',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'technical',
      stem: 'Stem',
      choices: [
        { id: 'a', label: 'Keyed', rationale: 'Because of the landmark.', plausibility: 'best' },
        { id: 'b', label: 'Other', rationale: 'Not that.', plausibility: 'incorrect-mechanism' },
      ],
      correctChoiceIds: ['a'],
      evidenceIds: ['ebus-guided-sources'],
      reviewStatus: 'draft',
    }

    const repeated = render(
      <QuestionExplanation item={{ ...base, explanation: 'Because of the landmark.' }} />,
    )
    expect(document.querySelector('[data-explanation-takeaway]')).toBeNull()
    expect(repeated.container.textContent).toContain('Because of the landmark.')
    repeated.unmount()

    render(<QuestionExplanation item={{ ...base, explanation: 'Carry the landmark rule.' }} />)
    expect(document.querySelector('[data-explanation-takeaway]')?.textContent).toContain(
      'Carry the landmark rule.',
    )
  })
})

/* B — leaving a case (PR-7, L26-5, PR-5) ---------------------------------------------------- */

describe('leaving a case', () => {
  it('leaves from the first check, before anything is answered', () => {
    openBoundaryCase()
    expect(caseOpen()).toBe(true)
    leaveCase()
    expect(caseOpen()).toBe(false)
    expect(screen.getByRole('button', { name: new RegExp(boundaryCase.title) })).toBeVisible()
  })

  it('leaves after a wrong answer and a retry', () => {
    openBoundaryCase()
    const wrong = boundaryCase.questions[0].choices.find((c) => !c.correct)!
    fireEvent.click(screen.getByLabelText(wrong.text))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    leaveCase()
    expect(caseOpen()).toBe(false)
  })

  it('leaves from the debrief', () => {
    openBoundaryCase()
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    expect(document.querySelector('[data-case-debrief]')).not.toBeNull()
    leaveCase()
    expect(caseOpen()).toBe(false)
  })

  it('returns to the list when the Practice tab already in use is selected again', () => {
    openBoundaryCase()
    expect(practiceTab()).not.toBeNull()
    fireEvent.click(practiceTab())
    expect(caseOpen()).toBe(false)
  })

  it('leaves every other course tab to the router', () => {
    openBoundaryCase()
    const learn = document.querySelector('a[href$="/ebus-guided/learn"]') as HTMLElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    learn.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(caseOpen()).toBe(true)
  })

  it('leaves an integrated case, and keeps the deep link and its unknown-id fallback', () => {
    const known = FINAL_CASES[0]
    render(<IntegratedCasesPage caseId={known.id} />)
    expect(caseOpen()).toBe(true)
    leaveCase()
    expect(caseOpen()).toBe(false)
    cleanup()

    render(<IntegratedCasesPage caseId="no-such-case" />)
    expect(caseOpen()).toBe(false)
    expect(screen.getByText(/That case link is no longer available/)).toBeVisible()
  })

  /* L26-5: practice was never offered in the flow; both destinations are now open, neither gated. */
  it('offers practice and the cases at the end of a lesson, without ordering them', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'clinical-question')!
    render(<LessonHost lesson={lesson} />)
    for (let i = 0; i < 6 && !document.querySelector('[data-session-summary]'); i += 1) {
      fireEvent.click(document.querySelector('[data-now-primary]')!)
    }
    const destinations = document.querySelector('[data-lesson-destinations]')!
    expect(
      within(destinations as HTMLElement).getByRole('link', { name: /Practice cases and labs/ }),
    ).toHaveAttribute('href', '/ebus-guided/practice')
    expect(
      within(destinations as HTMLElement).getByRole('link', { name: /Integrated cases/ }),
    ).toHaveAttribute('href', '/ebus-guided/assess')
  })

  /* PR-5: the two links out of practice did not say they left the course. */
  it('says the separate EBUS tools are separate', () => {
    render(<PracticePage />)
    expect(
      // EBUS-PRE-REVIEW-04 added ", sign-in required" to the same label; the contract is that it
      // says it is a separate tool.
      screen.getByRole('link', { name: /Open the full EBUS simulator \(separate tool/ }),
    ).toHaveAttribute('href', '/ebus-training/simulator')
    expect(screen.getByText(/outside this course/)).toBeVisible()
  })
})

/* C — the evidence the instruction refers to (PR-2, L3-8, L5-1, L9-4, L11-5) ---------------- */

describe('evidence identity', () => {
  it('keeps the case reference on screen for every check that refers to it', () => {
    openBoundaryCase()
    const station = boundaryCase.questions[0].imageStation!
    expect(document.querySelector(`[data-mock-decision-image="${station}"]`)).not.toBeNull()
    // Answer the first check and move to the second, whose stem says "the same target".
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    expect(screen.getByText(/Check 2 of 2/)).toBeVisible()
    expect(document.querySelector(`[data-mock-decision-image="${station}"]`)).not.toBeNull()
  })

  it('corrects the held-activity instruction on a check that is a described scenario', () => {
    // The first check on this lesson's held activity is the authored air-gap scenario (L5-1):
    // it declares no retained-acquisition policy, so it is not a reading of whatever the learner
    // holds. Driven with a real acquisition in the browser; here the wording rule is pinned.
    const lesson = LESSONS.find((entry) => entry.id === 'contact-cutaway-model')!
    const held = activitiesForLesson(lesson).find((activity) => activity.image === 'held')!
    expect(held.instruction).toContain('This is the image you acquired')
    expect(lesson.question.imagePolicy).not.toBe('retained-acquisition')
    expect(lesson.observation.imagePolicy).toBe('retained-acquisition')
  })

  it('names what the pane beside the task is, and never calls a reference an acquisition', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'ct-map')!
    render(<LessonHost lesson={lesson} />)
    const identity = document.querySelector('[data-evidence-identity]')!
    expect(identity).toHaveAttribute('data-evidence-identity', 'supplied')
    expect(identity.textContent).toContain('not an acquisition of yours')
  })

  it('says a live workbench is holding nothing yet', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'contact-cutaway-model')!
    render(<LessonHost lesson={lesson} />)
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    expect(document.querySelector('[data-evidence-identity]')).toHaveAttribute(
      'data-evidence-identity',
      'live',
    )
  })

  it('does not claim a held image when the acquisition was skipped', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'contact-cutaway-model')!
    render(<LessonHost lesson={lesson} />)
    fireEvent.click(document.querySelector('[data-now-primary]')!) // the acquisition
    fireEvent.click(screen.getByRole('button', { name: 'Continue without an image' }))
    expect(document.querySelector('[data-evidence-identity]')).toHaveAttribute(
      'data-evidence-identity',
      'held-missing',
    )
    // Nothing on this task says the image beside it is the learner's.
    expect(document.querySelector('[data-task-instruction]')?.textContent).not.toContain(
      'This is the image you acquired',
    )
  })
})

/* D — matching, ordering and the record (L1-6, L1-7, L2-3, L2-4, L12-6, L21-4, L26-3) ------- */

describe('matching gives feedback per row', () => {
  const activity = LESSONS.find((entry) => entry.id === 'clinical-question')!.matching!

  it('says which pairs match and which need another look, and stays editable', () => {
    render(<MatchingActivity activity={activity} onComplete={jest.fn()} />)
    const [first, second, third] = activity.pairs
    fireEvent.change(screen.getByLabelText(first.cue), { target: { value: third.id } })
    fireEvent.change(screen.getByLabelText(second.cue), { target: { value: second.id } })
    fireEvent.change(screen.getByLabelText(third.cue), { target: { value: first.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Check matches' }))

    const row = (id: string) => document.querySelector(`[data-matching-row="${id}"]`)!
    expect(row(second.id)).toHaveAttribute('data-matching-state', 'matched')
    expect(row(first.id)).toHaveAttribute('data-matching-state', 'review')
    expect(row(third.id)).toHaveAttribute('data-matching-state', 'review')
    // No count, no score.
    expect(document.body.textContent).not.toMatch(/\b1 of 3\b/)
    // Still editable, and checking again clears the marks.
    expect(screen.getByLabelText(first.cue)).toBeEnabled()
    fireEvent.change(screen.getByLabelText(first.cue), { target: { value: first.id } })
    expect(row(first.id)).not.toHaveAttribute('data-matching-state')
  })

  it('keeps Show the matches available before any attempt', () => {
    render(<MatchingActivity activity={activity} onComplete={jest.fn()} onReveal={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Show the matches' })).toBeEnabled()
  })
})

describe('ordering', () => {
  const sequence = LESSONS.find((entry) => entry.id === 'preparation')!.sequence!

  it('numbers the selected order once, not twice', () => {
    render(<SequenceActivity sequence={sequence} onComplete={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: sequence.steps[1].text }))
    const item = document.querySelector('[data-sequence-order] li')!
    // The list marker is the stylesheet's; the text must not carry a second number.
    expect(item.textContent).toBe(sequence.steps[1].text)
    expect(item.textContent).not.toMatch(/^\d+\./)
  })

  it('says how the steps are selected, with the keyboard as well as the pointer', () => {
    render(<SequenceActivity sequence={sequence} onComplete={jest.fn()} />)
    const instruction = document.querySelector('[data-sequence-instruction]')!.textContent!
    expect(instruction).toMatch(/in the order you would do them/i)
    expect(instruction).toMatch(/Tab/)
    expect(document.querySelector('[data-sequence-order]')).toHaveAttribute(
      'aria-label',
      'Your sequence so far',
    )
  })

  it('names the first step that differs, without changing what is accepted', () => {
    const onComplete = jest.fn()
    render(<SequenceActivity sequence={sequence} onComplete={onComplete} />)
    const order = [1, 0, 2, 3].map((i) => sequence.steps[i])
    for (const step of order) fireEvent.click(screen.getByRole('button', { name: step.text }))
    fireEvent.click(screen.getByRole('button', { name: 'Check sequence' }))
    expect(screen.getByRole('status').textContent).toContain(
      'Your step 1 is the first that differs',
    )
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('still accepts exactly the authored order', () => {
    const onComplete = jest.fn()
    render(<SequenceActivity sequence={sequence} onComplete={onComplete} />)
    for (const step of sequence.steps)
      fireEvent.click(screen.getByRole('button', { name: step.text }))
    fireEvent.click(screen.getByRole('button', { name: 'Check sequence' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('the skip is available but not the brightest thing on the screen', () => {
  it('steps back while a task is open, and leads only when the primary cannot', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'clinical-question')!
    render(<LessonHost lesson={lesson} />)
    fireEvent.click(document.querySelector('[data-now-primary]')!) // into the matching task
    const advance = document.querySelector('[data-now-primary]')!
    expect(advance.textContent).toContain('without completing this task')
    expect(advance).not.toHaveAttribute('data-prominent')
    expect(advance).toBeEnabled()
  })

  it('gives the acquisition skip the weight while the hold is disabled, and takes it back', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'contact-cutaway-model')!
    render(<LessonHost lesson={lesson} />)
    fireEvent.click(document.querySelector('[data-now-primary]')!)
    expect(document.querySelector('[data-now-primary]')).toBeDisabled()
    expect(document.querySelector('[data-skip-acquisition]')).toHaveAttribute('data-prominent')
  })
})

describe('the examination record', () => {
  it('does not present an untouched node as an examined-and-unrecorded one', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'results-reporting')!
    render(<LessonHost lesson={lesson} />)
    for (
      let i = 0;
      i < 8 && !document.querySelector('[aria-label="Case-specific examination record"]');
      i += 1
    ) {
      fireEvent.click(document.querySelector('[data-now-primary]')!)
    }
    const node = EXAMINATION_CASE.nodes[0]
    const visualization = screen.getByLabelText(node.label + ': visualization') as HTMLSelectElement
    const sampling = screen.getByLabelText(node.label + ': sampling') as HTMLSelectElement
    expect(visualization.value).toBe('')
    expect(sampling.value).toBe('')
    expect(within(visualization).getByText('Choose the supplied visualization')).toBeVisible()
    // And the conditional field is announced before it exists.
    expect(screen.getAllByText(/adds one more field here/)[0]).toBeVisible()

    // Entering one field does not silently declare the other.
    fireEvent.change(visualization, { target: { value: 'described' } })
    expect((screen.getByLabelText(node.label + ': visualization') as HTMLSelectElement).value).toBe(
      'described',
    )
    expect((screen.getByLabelText(node.label + ': sampling') as HTMLSelectElement).value).toBe('')
    // Nor any other node's.
    const other = EXAMINATION_CASE.nodes[1]
    expect(
      (screen.getByLabelText(other.label + ': visualization') as HTMLSelectElement).value,
    ).toBe('')
  })

  it('keeps a stored draft exactly as it was saved', () => {
    const stored = {
      ...newExamination(EXAMINATION_CASE),
      nodes: {
        [EXAMINATION_CASE.nodes[0].id]: {
          identity: 'proposed' as const,
          visualization: 'not-examined' as const,
          description: '',
          approach: '',
          uncertainty: '',
          sampling: 'unrecorded' as const,
          samplingReason: '',
          origin: 'learner-declaration' as const,
        },
      },
    }
    localStorage.setItem(
      'ip-ebus-guided-examination:' + EXAMINATION_CASE.id,
      JSON.stringify(stored),
    )
    const lesson = LESSONS.find((entry) => entry.id === 'results-reporting')!
    render(<LessonHost lesson={lesson} />)
    for (
      let i = 0;
      i < 8 && !document.querySelector('[aria-label="Case-specific examination record"]');
      i += 1
    ) {
      fireEvent.click(document.querySelector('[data-now-primary]')!)
    }
    const node = EXAMINATION_CASE.nodes[0]
    expect((screen.getByLabelText(node.label + ': visualization') as HTMLSelectElement).value).toBe(
      'not-examined',
    )
    expect((screen.getByLabelText(node.label + ': sampling') as HTMLSelectElement).value).toBe(
      'unrecorded',
    )
    expect(
      JSON.parse(localStorage.getItem('ip-ebus-guided-examination:' + EXAMINATION_CASE.id)!).nodes,
    ).toEqual(stored.nodes)
  })

  /* L12-6: "Negative tissue assessment" was answered with a survey-completeness message. */
  it('answers each survey-extent choice with the reason that applies to it', () => {
    const draft = newExamination(MODEL_WINDOW_CASE)
    const negative = taskErrors(
      'station-window',
      { ...draft, decisions: { ...draft.decisions, 'survey-extent': 'negative' } },
      MODEL_WINDOW_CASE,
    )
    expect(negative['survey-extent']).toContain('No needle action, specimen or pathology')
    const complete = taskErrors(
      'station-window',
      { ...draft, decisions: { ...draft.decisions, 'survey-extent': 'complete' } },
      MODEL_WINDOW_CASE,
    )
    expect(complete['survey-extent']).toContain('complete clinical station survey')
    const accepted = taskErrors(
      'station-window',
      { ...draft, decisions: { ...draft.decisions, 'survey-extent': 'window-only' } },
      MODEL_WINDOW_CASE,
    )
    expect(accepted['survey-extent']).toBeUndefined()
  })
})

/* L21-4: a stop after a plane change answered with the resistance message. */
describe('the needle model separates a lost plane from resistance', () => {
  const advanceToLiveTip = () => {
    let state = initialModelState('needle') as NeedleState
    state = modelReducer(state, { type: 'sheath', value: 1 }) as NeedleState
    state = modelReducer(state, { type: 'secure' }) as NeedleState
    state = modelReducer(state, { type: 'extend' }) as NeedleState
    expect(state.steps).toContain('live-tip')
    return state
  }

  it('tells a plane-change stop to restore the view of the tip', () => {
    const lost = modelReducer(advanceToLiveTip(), { type: 'lost' }) as NeedleState
    const stopped = modelReducer(lost, { type: 'stop' }) as NeedleState
    expect(stopped.notice).toContain('not identified in the imaging plane')
    expect(stopped.notice).not.toContain('adding force')
    expect(stopped.steps).toContain('lost-tip-stop')
    expect(stopped.stopped).toBe(true)
  })

  it('keeps the resistance message for a resistance stop', () => {
    const resisted = modelReducer(advanceToLiveTip(), { type: 'resistance' }) as NeedleState
    const stopped = modelReducer(resisted, { type: 'stop' }) as NeedleState
    expect(stopped.notice).toContain('do not overcome resistance by adding force')
    expect(stopped.steps).toContain('resistance-stop')
  })

  it('names both when both are true', () => {
    const lost = modelReducer(advanceToLiveTip(), { type: 'lost' }) as NeedleState
    const both = modelReducer(lost, { type: 'resistance' }) as NeedleState
    const stopped = modelReducer(both, { type: 'stop' }) as NeedleState
    expect(stopped.notice).toContain('out of the imaging plane')
    expect(stopped.notice).toContain('adding force')
    expect(stopped.steps).toEqual(expect.arrayContaining(['lost-tip-stop', 'resistance-stop']))
  })
})

/* E — lesson identity and focus clearance (L1-1) -------------------------------------------- */

const courseStyles = readFileSync(
  join(process.cwd(), 'src/features/ebus-guided/components/course.module.css'),
  'utf8',
)
function ruleBody(css: string, selector: string): string {
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*{([^}]*)}`).exec(
    css,
  )
  if (!match) throw new Error(`No rule for ${selector}`)
  return match[1]
}

describe('the lesson keeps its identity in view', () => {
  it('holds lesson, task counter and lesson controls in one pinned block', () => {
    const lesson = LESSONS.find((entry) => entry.id === 'acoustic-contact')!
    render(<LessonHost lesson={lesson} />)
    const chrome = document.querySelector('[data-lesson-chrome]')!
    expect(chrome.textContent).toContain('Lesson ' + (LESSONS.indexOf(lesson) + 1) + ' of ')
    expect(chrome.textContent).toContain(lesson.title)
    expect(chrome.textContent).toMatch(/Task 1 of \d/)
    expect(within(chrome as HTMLElement).getByRole('button', { name: 'Help' })).toBeVisible()
    expect(
      within(chrome as HTMLElement).getByRole('button', { name: 'Course outline' }),
    ).toBeVisible()
    expect(ruleBody(courseStyles, '.lessonChrome')).toMatch(
      /position:\s*sticky[\s\S]*top:\s*var\(--site-header-height/,
    )
  })

  it('reserves the measured chrome for the page the browser scrolls, with no fixed guess', () => {
    const rule = ruleBody(courseStyles, ':global(html):has(.lessonFlow)')
    expect(rule).toMatch(/scroll-padding-top:\s*var\(--ebus-focus-clear-top/)
    expect(rule).toMatch(/--ebus-focus-clear-top,\s*calc\(var\(--site-header-height/)
    // The heading's own reservation, wherever in the sheet it is declared.
    expect(courseStyles).toMatch(
      /\.taskHeading h2\s*{[^}]*scroll-margin-top:\s*var\(--ebus-focus-clear-top/,
    )
    expect(courseStyles).not.toMatch(/\.taskHeading h2\s*{[^}]*scroll-margin-top:\s*\d+px/)
  })

  it('keeps the reservation to pages that render a lesson', () => {
    expect(courseStyles).toContain(':global(html):has(.lessonFlow)')
    expect(courseStyles).not.toMatch(/^html\s*{/m)
  })

  it('unpins the chrome once the measurement says it no longer fits', () => {
    expect(ruleBody(courseStyles, ".lessonFlow[data-chrome-pinned='false'] .lessonChrome")).toMatch(
      /position:\s*static/,
    )
  })
})

function ClearanceHarness({
  flow,
  chrome,
}: {
  flow: RefObject<HTMLElement | null>
  chrome: RefObject<HTMLElement | null>
}) {
  useLessonChromeClearance(flow, chrome)
  return null
}

describe('the clearance measurement', () => {
  const originalHeight = window.innerHeight
  const originalObserver = globalThis.ResizeObserver

  afterEach(() => {
    globalThis.ResizeObserver = originalObserver
    jest.restoreAllMocks()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('style')
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true })
  })

  /** A site header above the module and the lesson chrome inside it, with controlled geometry. */
  function page({
    siteHeaderBottom,
    chromeHeight,
    chromeFlowTop,
    position = 'sticky',
  }: {
    siteHeaderBottom: number
    chromeHeight: number
    /** Where the unscrolled page leaves the chrome, when that is not where it sticks. */
    chromeFlowTop?: number
    position?: string
  }) {
    const siteHeader = document.createElement('header')
    const flow = document.createElement('div')
    const chrome = document.createElement('div')
    flow.append(chrome)
    document.body.append(siteHeader, flow)
    const rect = (height: number, top: number) =>
      ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect
    siteHeader.getBoundingClientRect = () => rect(siteHeaderBottom, 0)
    chrome.getBoundingClientRect = () => rect(chromeHeight, chromeFlowTop ?? siteHeaderBottom)
    const positions = new Map<Element, string>([
      [siteHeader, 'sticky'],
      [chrome, position],
    ])
    // Where each pinned node settles once it is pinned: the site header at the top of the
    // viewport, this chrome directly below it. The rects above already put them there, so the
    // measurement reads the same number from either — which is the point of the flow-position
    // case below, where the chrome has not settled yet.
    const tops = new Map<Element, string>([
      [siteHeader, '0px'],
      [chrome, `${siteHeaderBottom}px`],
    ])
    jest.spyOn(window, 'getComputedStyle').mockImplementation(
      (node: Element) =>
        ({
          position: positions.get(node) ?? 'static',
          top: tops.get(node) ?? 'auto',
          zoom: '1',
        }) as unknown as CSSStyleDeclaration,
    )
    const flowRef = createRef<HTMLElement>() as RefObject<HTMLElement | null>
    const chromeRef = createRef<HTMLElement>() as RefObject<HTMLElement | null>
    flowRef.current = flow
    chromeRef.current = chrome
    return { flow, chrome, view: render(<ClearanceHarness flow={flowRef} chrome={chromeRef} />) }
  }

  it('reserves the site header, this chrome and room for the focus ring', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1021, configurable: true })
    page({ siteHeaderBottom: 81, chromeHeight: 96 })
    expect(document.documentElement.style.getPropertyValue('--ebus-focus-clear-top')).toBe('185px')
  })

  it('reserves where a sticky chrome settles, not where the unscrolled page leaves it', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1021, configurable: true })
    // The page has not scrolled, so the chrome is still 63 px below where it will stick.
    page({ siteHeaderBottom: 81, chromeHeight: 96, chromeFlowTop: 144 })
    expect(document.documentElement.style.getPropertyValue('--ebus-focus-clear-top')).toBe('185px')
  })

  it('keeps the chrome pinned while it leaves the lesson most of the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1021, configurable: true })
    const { flow } = page({ siteHeaderBottom: 81, chromeHeight: 96 })
    expect(flow.getAttribute('data-chrome-pinned')).toBe('true')
  })

  it('drops the pin once enlarged text makes the chrome bigger than the lesson', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1021, configurable: true })
    const { flow } = page({ siteHeaderBottom: 81, chromeHeight: 520 })
    expect(flow.getAttribute('data-chrome-pinned')).toBe('false')
  })

  it('reserves only the site header when the chrome scrolls away instead of pinning', () => {
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
    page({ siteHeaderBottom: 81, chromeHeight: 96, position: 'static' })
    expect(document.documentElement.style.getPropertyValue('--ebus-focus-clear-top')).toBe('89px')
  })

  it('never reserves so much that nothing can be scrolled into what is left', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1021, configurable: true })
    // A site header that has wrapped to taller than the viewport, measured at 350% text.
    page({ siteHeaderBottom: 1037, chromeHeight: 486 })
    expect(document.documentElement.style.getPropertyValue('--ebus-focus-clear-top')).toBe(
      '510.5px',
    )
  })

  it('leaves the page as it found it when the lesson unmounts', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1021, configurable: true })
    const { flow, view } = page({ siteHeaderBottom: 81, chromeHeight: 96 })
    act(() => view.unmount())
    expect(document.documentElement.style.getPropertyValue('--ebus-focus-clear-top')).toBe('')
    expect(flow.hasAttribute('data-chrome-pinned')).toBe(false)
  })
})
