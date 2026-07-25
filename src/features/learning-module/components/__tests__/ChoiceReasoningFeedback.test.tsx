import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

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
