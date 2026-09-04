import { fireEvent, render, screen } from '@testing-library/react'

import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'
import { AnswerVerdict, shouldRevealVerdict } from '../AnswerVerdict'

/**
 * B2 — the one shared verdict component.
 *
 * The behaviours pinned here are the ones the revision plan requires and the ones the three previous
 * implementations disagreed about: plausibility-keyed feedback, the "why the others do not fit"
 * disclosure, an accessible announcement, a separate Continue control, and no advancement of its own.
 */

const item = clinicalLearningItemSchema.parse({
  id: 'test.item',
  activityId: 'test:learn:item',
  phase: 'predict',
  itemType: 'mechanism-interpretation',
  contextRequirement: 'context-independent',
  stem: 'Drainage pressure has become more negative while flow has fallen. What best accounts for it?',
  choices: [
    {
      id: 'drainage-limited',
      label: 'The circuit is asking for more flow than the drainage can supply.',
      plausibility: 'best',
      rationale:
        'A more negative drainage pressure with falling flow is the drainage-limited pattern.',
    },
    {
      id: 'membrane-clotting',
      label: 'The membrane lung is clotting.',
      plausibility: 'incorrect-mechanism',
      rationale: 'That raises the gradient across the membrane and does not pull drainage down.',
    },
    {
      id: 'watch-longer',
      label: 'Watch a little longer before doing anything.',
      plausibility: 'reasonable-but-incomplete',
      rationale: 'Reasonable in general, but this pattern already discriminates.',
    },
    {
      id: 'raise-speed',
      label: 'Raise the pump speed until flow recovers.',
      plausibility: 'unsafe',
      rationale: 'Pulling harder on a limb that is already collapsing makes the collapse worse.',
    },
  ],
  correctChoiceIds: ['drainage-limited'],
  explanation:
    'Read drainage pressure and flow together; one without the other cannot localize it.',
  evidenceIds: ['bounded-educational-model'],
  reviewStatus: 'draft',
})

describe('AnswerVerdict', () => {
  it('keys its framing to the plausibility of what was chosen', () => {
    for (const [choiceId, expected] of [
      ['drainage-limited', 'best'],
      ['membrane-clotting', 'incorrect-mechanism'],
      ['watch-longer', 'reasonable-but-incomplete'],
      ['raise-speed', 'unsafe'],
    ] as const) {
      const { container, unmount } = render(<AnswerVerdict item={item} choiceId={choiceId} />)
      expect(container.querySelector('[data-answer-verdict]')).toHaveAttribute(
        'data-plausibility',
        expected,
      )
      unmount()
    }
  })

  it('announces the result, and announces an unsafe choice assertively', () => {
    const safe = render(<AnswerVerdict item={item} choiceId="drainage-limited" />)
    const safeNode = safe.container.querySelector('[data-answer-verdict]')
    expect(safeNode).toHaveAttribute('role', 'status')
    expect(safeNode).toHaveAttribute('aria-live', 'polite')
    safe.unmount()

    const unsafe = render(<AnswerVerdict item={item} choiceId="raise-speed" />)
    const unsafeNode = unsafe.container.querySelector('[data-answer-verdict]')
    expect(unsafeNode).toHaveAttribute('role', 'alert')
    expect(unsafeNode).toHaveAttribute('aria-live', 'assertive')
  })

  it('offers why the other answers do not fit, and names every one of them', () => {
    const { container } = render(<AnswerVerdict item={item} choiceId="drainage-limited" />)
    expect(screen.getByText(/why the other answers do not fit/i)).toBeInTheDocument()
    const others = container.querySelector('[data-other-answers]')
    expect(others?.children).toHaveLength(item.choices.length - 1)
    for (const choice of item.choices.filter((entry) => entry.id !== 'drainage-limited')) {
      expect(others?.textContent).toContain(choice.label)
      expect(others?.textContent).toContain(choice.rationale)
    }
  })

  it('never advances by itself — Continue is the only way forward, and only if wired', () => {
    const withoutContinue = render(<AnswerVerdict item={item} choiceId="drainage-limited" />)
    expect(withoutContinue.container.querySelector('[data-verdict-continue]')).toBeNull()
    withoutContinue.unmount()

    const onContinue = jest.fn()
    render(<AnswerVerdict item={item} choiceId="drainage-limited" onContinue={onContinue} />)
    expect(onContinue).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})

describe('AnswerVerdict timing policy', () => {
  it('reveals immediately in Learn', () => {
    const { container } = render(
      <AnswerVerdict item={item} choiceId="membrane-clotting" timing="immediate-after-commit" />,
    )
    expect(container.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-revealed',
      'true',
    )
    expect(screen.getByText(/predicts a different pattern/i)).toBeInTheDocument()
    expect(screen.getByText(/why the other answers do not fit/i)).toBeInTheDocument()
  })

  /**
   * The outcome, stated explicitly — and withheld exactly as strictly as the rest of the verdict.
   *
   * Added on an owner review in September 2026, which found the card opening with "That read holds"
   * and never saying whether the learner was right. The label is gated on `revealed` alongside
   * `data-plausibility`, for the reason `withheldTone` gives: an attribute or a heading that leaks
   * the outcome before the timing policy allows it has defeated the policy, and this is the
   * assertion that would catch it.
   */
  it.each([
    ['drainage-limited', 'correct', 'Correct.'],
    ['watch-longer', 'partly-correct', 'Partly correct.'],
    ['membrane-clotting', 'not-correct', 'Not correct.'],
    ['raise-speed', 'unsafe', 'Not correct, and unsafe.'],
  ] as const)('states %s as %s once the verdict is told', (choiceId, outcome, label) => {
    const { container } = render(
      <AnswerVerdict item={item} choiceId={choiceId} timing="immediate-after-commit" />,
    )
    const card = container.querySelector('[data-answer-verdict]')
    expect(card).toHaveAttribute('data-revealed', 'true')
    expect(card).toHaveAttribute('data-verdict-outcome', outcome)
    expect(container.querySelector('[data-verdict-outcome-label]')?.textContent).toBe(label)
    // The descriptive sentence is kept after it; the label replaces nothing.
    expect(container.querySelector('p')?.textContent).toMatch(
      new RegExp(`^${label.replace('.', '\\.')}\\s`),
    )
  })

  it('leaks no outcome, in text or in an attribute, while the verdict is withheld', () => {
    for (const timing of ['after-action-response', 'debrief-only'] as const) {
      const { container, unmount } = render(
        <AnswerVerdict
          item={item}
          choiceId="membrane-clotting"
          timing={timing}
          actionObserved={false}
        />,
      )
      const card = container.querySelector('[data-answer-verdict]')
      expect(card).toHaveAttribute('data-revealed', 'false')
      expect(card).not.toHaveAttribute('data-verdict-outcome')
      expect(container.querySelector('[data-verdict-outcome-label]')).toBeNull()
      expect(container.textContent ?? '').not.toMatch(/\bnot correct\b/i)
      unmount()
    }
  })

  it('withholds the mechanism in guided Practice until the learner has acted and observed', () => {
    const before = render(
      <AnswerVerdict
        item={item}
        choiceId="membrane-clotting"
        timing="after-action-response"
        actionObserved={false}
      />,
    )
    expect(before.container.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-revealed',
      'false',
    )
    expect(screen.getByText(/Answer recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/watch what happens before reading any judgement/i)).toBeInTheDocument()
    expect(screen.queryByText(/why the other answers do not fit/i)).toBeNull()
    before.unmount()

    const after = render(
      <AnswerVerdict
        item={item}
        choiceId="membrane-clotting"
        timing="after-action-response"
        actionObserved
      />,
    )
    expect(after.container.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-revealed',
      'true',
    )
    // Coaching verdict only — the full comparison is still reserved for the debrief.
    expect(screen.queryByText(/why the other answers do not fit/i)).toBeNull()
  })

  it('labels nothing before the debrief in independent Practice and Challenge', () => {
    const { container } = render(
      <AnswerVerdict item={item} choiceId="membrane-clotting" timing="debrief-only" />,
    )
    expect(container.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-revealed',
      'false',
    )
    expect(screen.getByText(/held until the debrief/i)).toBeInTheDocument()

    const debrief = render(
      <AnswerVerdict item={item} choiceId="membrane-clotting" timing="debrief-only" inDebrief />,
    )
    expect(debrief.container.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-revealed',
      'true',
    )
  })

  it('always surfaces an unsafe choice, whatever the timing policy says', () => {
    // The one exception the plan allows: letting a learner carry on believing a harmful action was
    // acceptable is not a pedagogic trade-off worth making.
    for (const timing of [
      'immediate-after-commit',
      'after-action-response',
      'debrief-only',
    ] as const) {
      expect(shouldRevealVerdict({ timing, plausibility: 'unsafe' })).toBe(true)
      const { container, unmount } = render(
        <AnswerVerdict item={item} choiceId="raise-speed" timing={timing} />,
      )
      const node = container.querySelector('[data-answer-verdict]')
      expect(node).toHaveAttribute('data-revealed', 'true')
      expect(node).toHaveAttribute('role', 'alert')
      unmount()
    }
  })

  it('shows a branch-specific explanation when the caller has one', () => {
    render(
      <AnswerVerdict
        item={item}
        choiceId="membrane-clotting"
        timing="after-action-response"
        actionObserved
        branchExplanation={<p>Drainage pressure fell further after the change.</p>}
      />,
    )
    expect(screen.getByText(/Drainage pressure fell further/i)).toBeInTheDocument()
  })
})

describe('AnswerVerdict and ChoiceReasoningFeedback are not interchangeable', () => {
  /*
   * The audit's boundary, pinned so a later "finish the migration" pass cannot quietly drop the
   * sources block from the surfaces that show one. This component renders neither concept links nor
   * citations, so a consumer that depends on them stays with `ChoiceReasoningFeedback`.
   */
  it('renders no evidence citations or concept links of its own', () => {
    const { container } = render(<AnswerVerdict item={item} choiceId="drainage-limited" />)

    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(screen.queryByText(/^Sources$/)).toBeNull()
    expect(screen.queryByLabelText(/related concepts/i)).toBeNull()
  })
})

describe('an unrevealed verdict gives nothing away', () => {
  /*
   * Withholding the words while keeping the colour is not withholding the answer. The unrevealed
   * card kept its plausibility-keyed tone — emerald for a best answer, rose for an incorrect one —
   * and kept `data-plausibility` in the DOM, so "the reasoning is held until the debrief" was
   * announced on a card that had already said which kind of answer it was. A caller-supplied branch
   * explanation was rendered at the same time, before the learner had acted.
   */
  const timings = ['after-action-response', 'debrief-only'] as const

  it.each(timings)('%s: a best and an incorrect answer look identical', (timing) => {
    const best = render(<AnswerVerdict item={item} choiceId="drainage-limited" timing={timing} />)
    const bestNode = best.container.querySelector('[data-answer-verdict]')
    expect(bestNode).toHaveAttribute('data-revealed', 'false')
    const bestClass = bestNode?.className
    const bestText = bestNode?.textContent
    best.unmount()

    const wrong = render(<AnswerVerdict item={item} choiceId="membrane-clotting" timing={timing} />)
    const wrongNode = wrong.container.querySelector('[data-answer-verdict]')
    expect(wrongNode).toHaveAttribute('data-revealed', 'false')

    // Same styling, and the only difference in the text is the answer the learner chose.
    expect(wrongNode?.className).toBe(bestClass)
    expect(
      bestText?.replace('The circuit is asking for more flow than the drainage can supply.', ''),
    ).toBe(wrongNode?.textContent?.replace('The membrane lung is clotting.', ''))
  })

  it.each(timings)('%s: exposes no correctness label, reasoning or comparison', (timing) => {
    const { container } = render(
      <AnswerVerdict
        item={item}
        choiceId="membrane-clotting"
        timing={timing}
        branchExplanation={<p>Drainage pressure fell further after the change.</p>}
      />,
    )
    const node = container.querySelector('[data-answer-verdict]')

    // Not even as an attribute: a stylesheet or a devtools glance would read it straight off.
    expect(node?.hasAttribute('data-plausibility')).toBe(false)
    expect(screen.getByText(/Answer recorded/i)).toBeInTheDocument()
    expect(screen.queryByText(/predicts a different pattern/i)).toBeNull()
    expect(screen.queryByText(item.choices[1].rationale)).toBeNull()
    expect(screen.queryByText(/why the other answers do not fit/i)).toBeNull()
    expect(screen.queryByText(item.explanation)).toBeNull()
    // The branch note describes what the action produced, so it waits for the action too.
    expect(container.querySelector('[data-branch-explanation]')).toBeNull()
    expect(screen.queryByText(/Drainage pressure fell further/i)).toBeNull()
  })

  it('still reveals an unsafe answer in full, whatever the timing', () => {
    for (const timing of timings) {
      const { container, unmount } = render(
        <AnswerVerdict
          item={item}
          choiceId="raise-speed"
          timing={timing}
          branchExplanation={<p>The collapse deepened.</p>}
        />,
      )
      const node = container.querySelector('[data-answer-verdict]')
      expect(node).toHaveAttribute('data-revealed', 'true')
      expect(node).toHaveAttribute('data-plausibility', 'unsafe')
      expect(node).toHaveAttribute('role', 'alert')
      expect(container.querySelector('[data-branch-explanation]')).not.toBeNull()
      unmount()
    }
  })
})
