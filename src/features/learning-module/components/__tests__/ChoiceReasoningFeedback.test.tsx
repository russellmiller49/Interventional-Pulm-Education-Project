import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { flaggedGradingCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import type { ClinicalLearningItem } from '../../activity'
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
 * The other answers, under the verdict.
 *
 * `AnswerVerdict` has always offered why the alternatives do not fit; this card, which three
 * modules render for its concept links and citations, never did. A caller that passes the item's
 * choices gets the same folded disclosure; a caller that passes nothing renders exactly as before.
 *
 * SHARED-FEEDBACK-02: the fold holds the choices that do not fit and nothing else. Until November
 * 2026 it held every choice the learner did not take, so after any selection but the best one the
 * best-supported answer was filed under "Why the other answers do not fit".
 */
describe('ChoiceReasoningFeedback other answers', () => {
  const choices: readonly Choice[] = [
    {
      ...choice('best'),
      id: 'best-read',
      label: 'The best read',
      rationale: 'The discriminating cue is present, so this read holds.',
    },
    {
      ...choice('incorrect-mechanism'),
      id: 'other-mechanism',
      label: 'Another mechanism',
      rationale: 'This mechanism would move the pressure the other way.',
    },
    {
      ...choice('reasonable-but-incomplete'),
      id: 'partial-read',
      label: 'A partial read',
      rationale: 'This read stops before the cue that limits it.',
    },
    {
      ...choice('unsafe'),
      id: 'harmful-move',
      label: 'A harmful move',
      rationale: 'This move removes the support the patient depends on.',
    },
  ]
  const best = choices[0]

  function renderCard(chosen: Choice, alternatives: readonly Choice[] | undefined = choices) {
    return render(
      <ChoiceReasoningFeedback
        choice={chosen}
        outcome="stated"
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
        alternatives={alternatives}
      />,
    )
  }

  it('renders no disclosure unless the caller passes the choices', () => {
    const { container } = render(
      <ChoiceReasoningFeedback
        choice={choices[0]}
        explanation="Compare the expected waveform and patient response."
        evidenceIds={['esc-ers-ph-2022']}
      />,
    )
    expect(container.querySelector('[data-other-answers-panel]')).toBeNull()
    expect(container.querySelector('[data-best-supported-answers]')).toBeNull()
  })

  it('after the best choice, folds every other choice under the heading that is true of them', () => {
    const { container } = renderCard(best)
    const panel = container.querySelector<HTMLDetailsElement>('[data-other-answers-panel]')
    expect(panel).not.toBeNull()
    expect(panel?.open).toBe(false)
    expect(panel?.querySelector('summary')?.textContent).toBe('Why the other answers do not fit')
    expect(container.querySelector('[data-best-supported-answers]')).toBeNull()
    expect(container.querySelector('[data-other-answer="best-read"]')).toBeNull()
    const rows = panel!.querySelectorAll('[data-other-answer]')
    expect(rows).toHaveLength(choices.length - 1)
    for (const other of choices.filter((candidate) => candidate.id !== best.id)) {
      const row = panel!.querySelector(`[data-other-answer="${other.id}"]`)
      expect(row).toHaveAttribute('data-other-answer-role', 'alternative')
      expect(row?.textContent).toContain(other.label)
      expect(row?.textContent).toContain(other.rationale)
    }
  })

  it.each(['other-mechanism', 'partial-read', 'harmful-move'] as const)(
    'after %s, states the best-supported answer apart from the answers that do not fit',
    (chosenId) => {
      const chosen = choices.find((candidate) => candidate.id === chosenId)!
      const { container } = renderCard(chosen)

      // The best-supported answer: named as such, with its own reasoning, open to read.
      const stated = container.querySelector<HTMLElement>('[data-best-supported-answers]')
      expect(stated).not.toBeNull()
      expect(stated!.closest('details')).toBeNull()
      expect(stated!.querySelector('[data-keyed-answer-label]')?.textContent).toBe(
        'Best-supported answer',
      )
      const keyed = stated!.querySelector('[data-other-answer="best-read"]')
      expect(keyed).toHaveAttribute('data-other-answer-role', 'keyed')
      expect(keyed?.textContent).toContain(best.label)
      expect(keyed?.textContent).toContain(best.rationale)

      // The fold: only what does not fit. This is the assertion that failed before the repair.
      const panel = container.querySelector<HTMLDetailsElement>('[data-other-answers-panel]')!
      expect(panel.open).toBe(false)
      expect(panel.querySelector('summary')?.textContent).toBe('Why the other answers do not fit')
      expect(panel.querySelector('[data-other-answer="best-read"]')).toBeNull()
      expect(panel.textContent).not.toContain(best.label)
      expect(panel.textContent).not.toContain(best.rationale)
      const doNotFit = choices.filter(
        (candidate) => candidate.id !== chosenId && candidate.id !== best.id,
      )
      expect(panel.querySelectorAll('[data-other-answer]')).toHaveLength(doNotFit.length)
      for (const other of doNotFit) {
        const row = panel.querySelector(`[data-other-answer="${other.id}"]`)
        expect(row).toHaveAttribute('data-other-answer-role', 'alternative')
        expect(row?.textContent).toContain(other.label)
        expect(row?.textContent).toContain(other.rationale)
      }

      // The chosen answer is the card's own subject and is in neither group.
      expect(container.querySelector(`[data-other-answer="${chosenId}"]`)).toBeNull()
      // Reading order: the learner's answer, then the best-supported one, then the rest.
      expect(stated!.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    },
  )

  it('renders no empty fold when the best-supported answer is the only other choice', () => {
    const pair = [choices[0], choices[1]]
    const { container } = renderCard(pair[1], pair)
    expect(container.querySelector('[data-best-supported-answers]')).not.toBeNull()
    expect(container.querySelector('[data-other-answers-panel]')).toBeNull()
  })

  it('never files a second best-supported answer under the fold either', () => {
    const second: Choice = {
      ...choice('best'),
      id: 'second-best-read',
      label: 'A second best read',
      rationale: 'This read holds on the same cue.',
    }
    const { container } = renderCard(best, [...choices, second])
    const stated = container.querySelector('[data-best-supported-answers]')!
    expect(stated.querySelector('[data-keyed-answer-label]')?.textContent).toBe(
      'Another best-supported answer',
    )
    expect(stated.querySelector('[data-other-answer="second-best-read"]')).not.toBeNull()
    expect(
      container.querySelector('[data-other-answers-panel] [data-other-answer="second-best-read"]'),
    ).toBeNull()
  })

  it('adds no scoring word to the card in either arrangement', () => {
    for (const chosen of choices) {
      const { container, unmount } = renderCard(chosen)
      expect(flaggedGradingCopyTerms(container.textContent ?? '')).toEqual([])
      unmount()
    }
  })
})
