import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  flaggedGradingCopyTerms,
  flaggedLearnerCopyTerms,
} from '@/features/learning-module/activity/clinicalLearningItem'

import { MechanicalVentilationLessonActivity } from '../components/MechanicalVentilationLessonActivity'
import { mechanicalVentilationLessonItems, mechanicalVentilationLessons } from '../content'

/**
 * B2 — the Mechanical Ventilation Learn verdict, before and after it became the shared one.
 *
 * This lesson's local verdict is the implementation the revision plan judged strongest, and it is
 * the one the shared `AnswerVerdict` was promoted from. Migrating it is therefore the migration
 * most likely to look harmless and quietly change something, so every behaviour worth keeping is
 * pinned here first: plausibility-keyed framing, the learner's own answer echoed back, the choice's
 * reasoning, the comparison against the answers not taken, the item's distinguishing explanation,
 * and a Continue that is the caller's and nobody else's.
 *
 * Every assertion in the first block passed against the local implementation before the migration
 * and passes against the shared one after it. The second block covers the two things the migration
 * deliberately standardises.
 */

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}))

const LESSON_ID = 'mechanics-load-and-pressure'

function lessonUnderTest() {
  const lesson = mechanicalVentilationLessons.find((candidate) => candidate.id === LESSON_ID)
  if (!lesson) throw new Error(`Missing lesson ${LESSON_ID}`)
  return lesson
}

function items() {
  return mechanicalVentilationLessonItems[LESSON_ID]
}

async function renderLesson() {
  const lesson = lessonUnderTest()
  render(<MechanicalVentilationLessonActivity lesson={lesson} />)
  // The activity gates on a saved-work check before it renders anything interactive.
  await screen.findByRole('heading', { name: lesson.title })
}

async function openPredictionPhase() {
  await renderLesson()
  fireEvent.click(screen.getByRole('button', { name: /^Record bedside assessment/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Document multitrace review/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to prediction' }))
}

function verdictNode() {
  const node = document.querySelector<HTMLElement>('[data-plausibility]')
  if (!node) throw new Error('No verdict rendered')
  return node
}

describe('Mechanical Ventilation Learn verdict', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  it.each(items().prediction.choices.map((choice) => [choice.plausibility, choice.id] as const))(
    'keys its framing to a %s answer and shows that answer’s reasoning',
    async (plausibility, choiceId) => {
      const item = items().prediction
      const chosen = item.choices.find((choice) => choice.id === choiceId)
      if (!chosen) throw new Error('missing choice')

      await openPredictionPhase()
      fireEvent.click(screen.getByLabelText(chosen.label))
      fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

      const verdict = verdictNode()
      expect(verdict).toHaveAttribute('data-plausibility', plausibility)
      // The learner's own answer is echoed back beside the judgement of it.
      expect(verdict.textContent).toContain(chosen.label)
      expect(within(verdict).getByText(chosen.rationale)).toBeInTheDocument()
      // And the item's distinguishing explanation, which is what generalises.
      expect(verdict.textContent).toContain(item.explanation)
    },
  )

  it('offers the comparison against every answer not taken', async () => {
    const item = items().prediction
    const chosen = item.choices[0]

    await openPredictionPhase()
    fireEvent.click(screen.getByLabelText(chosen.label))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    const verdict = verdictNode()
    expect(within(verdict).getByText(/why the other answers do not fit/i)).toBeInTheDocument()
    for (const other of item.choices.filter((choice) => choice.id !== chosen.id)) {
      expect(verdict.textContent).toContain(other.label)
      expect(verdict.textContent).toContain(other.rationale)
    }
  })

  it('stays on the question after commitment and moves only when Continue is taken', async () => {
    const item = items().prediction

    await openPredictionPhase()
    fireEvent.click(screen.getByLabelText(item.choices[0].label))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    // Still in Predict: the Act phase's control is not on screen yet.
    expect(screen.queryByRole('button', { name: 'Run the response and reassess' })).toBeNull()
    expect(verdictNode()).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      screen.getByRole('button', { name: 'Run the response and reassess' }),
    ).toBeInTheDocument()
  })

  it('keeps the answer selectable-once: the committed choice stays chosen and locked', async () => {
    const item = items().prediction
    const chosen = item.choices[1]

    await openPredictionPhase()
    fireEvent.click(screen.getByLabelText(chosen.label))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    const input = screen.getByLabelText(chosen.label)
    expect(input).toBeChecked()
    expect(input).toBeDisabled()
  })

  it('shows the transfer verdict on selection, with no Continue of its own', async () => {
    await renderLesson()
    fireEvent.click(screen.getByRole('button', { name: 'Open Transfer phase' }))

    const unsafe = items().transfer.choices.find((choice) => choice.plausibility === 'unsafe')
    if (!unsafe) throw new Error('this lesson’s transfer item needs an unsafe choice')
    fireEvent.click(screen.getByLabelText(unsafe.label))

    const verdict = verdictNode()
    expect(verdict).toHaveAttribute('data-plausibility', 'unsafe')
    expect(verdict).toHaveAttribute('role', 'alert')
    // Transfer is completed by its own control, not from inside the verdict.
    expect(within(verdict).queryByRole('button', { name: /continue/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Review draft transfer' })).toBeInTheDocument()
  })
})

describe('Mechanical Ventilation Learn verdict — what the shared component standardises', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  it('announces an unsafe answer assertively rather than politely', async () => {
    await renderLesson()
    fireEvent.click(screen.getByRole('button', { name: 'Open Transfer phase' }))

    const unsafe = items().transfer.choices.find((choice) => choice.plausibility === 'unsafe')
    if (!unsafe) throw new Error('this lesson’s transfer item needs an unsafe choice')
    fireEvent.click(screen.getByLabelText(unsafe.label))

    // The local implementation announced every verdict politely, so a harmful selection waited its
    // turn behind whatever else the live region had queued.
    expect(verdictNode()).toHaveAttribute('aria-live', 'assertive')
  })

  it('drops the grading vocabulary the module’s own learner-copy rule bans elsewhere', async () => {
    const item = items().prediction

    await openPredictionPhase()
    fireEvent.click(screen.getByLabelText(item.choices[0].label))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    /*
     * The local verdict headed a best answer "Correct" — a term this project rejects in authored
     * learner copy, and the reason the shared component words its framings the way it does.
     *
     * An owner review of the ECMO module in September 2026 asked for the outcome to be said in as
     * many words, and the shared card can now do that — but only where a caller opts in with
     * `outcome="stated"`. Mechanical ventilation has not, so this lab still reads exactly as it
     * did and this contract still holds in full. The half of the rule that is not a teaching
     * preference is checked separately by `flaggedGradingCopyTerms`: this content is not
     * credit-eligible, so no card may talk about a score, a percentage, a pass or a mastery claim.
     */
    const heading = verdictNode().querySelector('p')?.textContent ?? ''
    expect(heading.length).toBeGreaterThan(0)
    expect(flaggedLearnerCopyTerms(heading)).toEqual([])
    expect(flaggedGradingCopyTerms(heading)).toEqual([])
    expect(verdictNode()).not.toHaveAttribute('data-verdict-outcome')
  })
})
