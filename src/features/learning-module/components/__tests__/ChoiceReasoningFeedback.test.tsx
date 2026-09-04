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
