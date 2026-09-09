import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { flaggedGradingCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import type { ClinicalLearningItem } from '../../activity'
import { answerVerdictFrames } from '../AnswerVerdict'
import { ChoiceReasoningFeedback } from '../ChoiceReasoningFeedback'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

type Choice = ClinicalLearningItem['choices'][number]

function choice(plausibility: Choice['plausibility']): Choice {
  return {
    id: `choice-${plausibility}`,
    label: 'A clinical frame',
    rationale: 'This rationale identifies the mechanism and the discriminating cue.',
    plausibility,
  }
}

describe('ChoiceReasoningFeedback', () => {
  it.each([
    ['best', 'The cues support this read.'],
    [
      'reasonable-but-incomplete',
      'That is a defensible read as far as it goes. One more cue changes the working frame.',
    ],
    [
      'incorrect-mechanism',
      'That mechanism would produce a different pattern from the one shown here.',
    ],
    ['unsafe', 'Stopping here—the selected action could cause harm in a real patient.'],
  ] as const)('renders the %s plausibility frame inline', (plausibility, framing) => {
    render(
      <ChoiceReasoningFeedback
        choice={choice(plausibility)}
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
        conceptIds={['cc.measurement.measurand']}
      />,
    )

    expect(screen.getByText(framing)).toBeInTheDocument()
    expect(
      screen.getByText('This rationale identifies the mechanism and the discriminating cue.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Compare the expected waveform and patient response.'),
    ).toBeInTheDocument()
  })

  /**
   * The outcome, stated before the reasoning.
   *
   * Added on an owner review in September 2026: the card used to open with the descriptive framing
   * alone, so a learner had to infer from a border colour whether they had got it right. The
   * framing is kept after the label, because it is the half that teaches.
   */
  it.each([
    ['best', 'correct', 'Correct.'],
    ['reasonable-but-incomplete', 'partly-correct', 'Partly correct.'],
    ['incorrect-mechanism', 'not-correct', 'Not correct.'],
    ['unsafe', 'unsafe', 'Not correct, and unsafe.'],
  ] as const)('states a %s answer as %s before any reasoning', (plausibility, outcome, label) => {
    const { container } = render(
      <ChoiceReasoningFeedback
        choice={choice(plausibility)}
        outcome="stated"
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
      />,
    )

    expect(container.querySelector('[data-verdict-outcome]')).toHaveAttribute(
      'data-verdict-outcome',
      outcome,
    )
    const stated = container.querySelector('[data-verdict-outcome-label]')
    expect(stated?.textContent).toBe(label)
    // It leads: the outcome is the first thing in the card's own reading order.
    expect((container.textContent ?? '').trimStart().startsWith(label)).toBe(true)
  })

  it('describes the reasoning and states no outcome unless the caller asks', () => {
    /*
     * The default is what every lab rendered before the September 2026 owner review, and it stays
     * the default: the finding came from one owner looking at one module, so the label is offered
     * to the others rather than applied to them. `outcome="stated"` is how a lab takes it.
     */
    const { container } = render(
      <ChoiceReasoningFeedback
        choice={choice('best')}
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
      />,
    )
    expect(container.querySelector('[data-verdict-outcome]')).toBeNull()
    expect(container.querySelector('[data-verdict-outcome-label]')).toBeNull()
    // The framing that teaches is still there, and it still leads.
    expect((container.textContent ?? '').trimStart()).toMatch(/^The cues support this read\./)
  })

  it('never says a word about scoring while stating the outcome', () => {
    for (const plausibility of [
      'best',
      'reasonable-but-incomplete',
      'incorrect-mechanism',
      'unsafe',
    ] as const) {
      const { container, unmount } = render(
        <ChoiceReasoningFeedback
          choice={choice(plausibility)}
          outcome="stated"
          explanation="Compare the expected waveform and patient response."
          evidenceIds={['esc-ers-ph-2022']}
        />,
      )
      expect(flaggedGradingCopyTerms(container.textContent ?? '')).toEqual([])
      unmount()
    }
  })

  it('renders related concepts and resolved citations with unsafe feedback announced as an alert', () => {
    render(
      <ChoiceReasoningFeedback
        choice={choice('unsafe')}
        explanation="Use the independent cue before acting."
        evidenceIds={['esc-ers-ph-2022']}
        conceptIds={['cc.measurement.measurand']}
      />,
    )

    expect(screen.getByRole('alert')).toHaveAttribute('data-plausibility', 'unsafe')
    expect(screen.getByRole('link', { name: 'Name the measurand' })).toHaveAttribute(
      'href',
      '/critical-care/concepts/cc.measurement.measurand',
    )
    expect(screen.getByText(/Humbert M, et al. 2022 ESC\/ERS Guidelines/i)).toBeInTheDocument()
  })
})

/**
 * The other answers, folded under the verdict.
 *
 * `AnswerVerdict` has always offered why the alternatives do not fit; this card, which three
 * modules render for its concept links and citations, never did. A caller that passes the item's
 * choices gets the same folded disclosure; a caller that passes nothing renders exactly as before.
 */
describe('ChoiceReasoningFeedback other answers', () => {
  const choices: readonly Choice[] = [
    { ...choice('best'), id: 'best-read', label: 'The best read' },
    { ...choice('incorrect-mechanism'), id: 'other-mechanism', label: 'Another mechanism' },
    { ...choice('unsafe'), id: 'harmful-move', label: 'A harmful move' },
  ]

  it('renders no disclosure unless the caller passes the choices', () => {
    const { container } = render(
      <ChoiceReasoningFeedback
        choice={choices[0]}
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
      />,
    )
    expect(container.querySelector('[data-other-answers-panel]')).toBeNull()
  })

  it('folds every choice but the chosen one, each with its rationale', () => {
    const { container } = render(
      <ChoiceReasoningFeedback
        choice={choices[1]}
        outcome="stated"
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
        alternatives={choices}
      />,
    )
    const panel = container.querySelector<HTMLDetailsElement>('[data-other-answers-panel]')
    expect(panel).not.toBeNull()
    expect(panel?.open).toBe(false)
    expect(panel?.querySelector('summary')?.textContent).toBe('Why the other answers do not fit')
    expect(container.querySelector('[data-other-answer="other-mechanism"]')).toBeNull()
    for (const other of choices.filter((candidate) => candidate.id !== 'other-mechanism')) {
      const row = container.querySelector(`[data-other-answer="${other.id}"]`)
      expect(row?.textContent).toContain(other.label)
      expect(row?.textContent).toContain(other.rationale)
    }
  })
})

/**
 * One vocabulary for a learner who meets both cards in one pathway.
 *
 * `answerVerdictFrames` is `AnswerVerdict`'s four titles as sentences, derived from the same table
 * that card renders, so the frame this card prints after the stated outcome can never drift from
 * the title the drill card prints. ECMO used to carry these four strings by hand.
 */
describe('ChoiceReasoningFeedback with AnswerVerdict’s vocabulary', () => {
  it.each([
    ['best', 'Correct.', 'That read holds.'],
    ['reasonable-but-incomplete', 'Partly correct.', 'Defensible, but not the whole picture.'],
    ['incorrect-mechanism', 'Not correct.', 'That mechanism predicts a different pattern.'],
    ['unsafe', 'Not correct, and unsafe.', 'Stopping here — this could harm a real patient.'],
  ] as const)('frames a %s answer with the verdict title', (plausibility, label, frame) => {
    expect(answerVerdictFrames[plausibility]).toBe(frame)
    const { container } = render(
      <ChoiceReasoningFeedback
        choice={choice(plausibility)}
        outcome="stated"
        frames={answerVerdictFrames}
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
      />,
    )
    expect((container.textContent ?? '').trimStart().startsWith(`${label} ${frame}`)).toBe(true)
  })
})
