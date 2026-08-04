import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { PacGuidedSkillActivity } from '../components/PacGuidedSkillActivity'
import { pacGuidedLearningItems } from '../content/pacLearningItems'

/**
 * B2 — the PAC guided-skill reasoning feedback, before and after it became the shared verdict.
 *
 * This activity carried its own `ChoiceReasoningFeedback`, a third implementation that happened to
 * shadow the shared component's name while agreeing with neither it nor the workbench version. What
 * it did well is pinned in the first block, so the migration has to keep it: the feedback appears in
 * the Act phase — after commitment, beside the objective the learner is about to work — carrying the
 * chosen answer's reasoning, the item's distinguishing cue, and the framing and next move this
 * activity adds on top. Every assertion there passed against the local implementation first.
 *
 * The timing is deliberately left alone. Committing here advances to Act and always has; that is
 * this activity's pedagogy, not a defect, and the shared component advances nothing by itself.
 *
 * The second block is what the migration changes on purpose. The local panel was a plain `aside`
 * with no role and no live region, so a screen-reader user got no announcement when the feedback
 * appeared, and it never showed why the answers not taken did not fit.
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

jest.mock('../components/BedsideMonitor', () => ({
  BedsideMonitor: ({
    state,
  }: {
    state: { catheter: { position: string }; responseMessage: string | null }
  }) => (
    <section aria-label="Mock deterministic bedside monitor">
      <span>Position {state.catheter.position}</span>
      <span>{state.responseMessage}</span>
    </section>
  ),
}))

const SKILL_ID = 'pressure-system' as const

function items() {
  return pacGuidedLearningItems[SKILL_ID]
}

async function commitPrediction(choiceId: string) {
  const choice = items().prediction.choices.find((candidate) => candidate.id === choiceId)
  if (!choice) throw new Error(`Missing choice ${choiceId}`)
  render(<PacGuidedSkillActivity skillId={SKILL_ID} />)
  await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' })
  fireEvent.click(screen.getByRole('button', { name: 'Orient to this skill station' }))
  fireEvent.click(screen.getByLabelText(choice.label))
  fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
  return choice
}

function setUpEnvironment() {
  window.localStorage.clear()
  push.mockClear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  })
}

describe('PAC guided-skill reasoning feedback', () => {
  beforeEach(setUpEnvironment)

  it.each(items().prediction.choices.map((choice) => [choice.plausibility, choice.id] as const))(
    'shows a %s answer’s own reasoning once it has been committed',
    async (_plausibility, choiceId) => {
      const choice = await commitPrediction(choiceId)

      expect(screen.getByText(choice.rationale)).toBeInTheDocument()
      expect(screen.getByText(items().prediction.explanation)).toBeInTheDocument()
    },
  )

  it('keeps the feedback in the Act phase, beside the objective rather than in place of it', async () => {
    const choice = await commitPrediction('level-zero-underdamped')

    // Committing advanced to Act, as it always has — the objective's own control is present and
    // still gated on the hands-on work.
    expect(
      screen.getByRole('button', { name: 'Continue after completing the objective' }),
    ).toBeDisabled()
    expect(screen.getByText(choice.rationale)).toBeInTheDocument()
    // The feedback offers no way forward of its own; the phase control is the only one.
    expect(document.querySelector('[data-verdict-continue]')).toBeNull()
  })

  it('keeps this activity’s own framing and next move alongside the shared reasoning', async () => {
    const choice = await commitPrediction('physiology-wide-pulse')

    expect(screen.getByText(choice.rationale)).toBeInTheDocument()
    // Two things this activity says that the shared component does not: how the frame reads, and
    // what to do with it next.
    expect(screen.getByText(/does not produce the morphology/i)).toBeInTheDocument()
    expect(screen.getByText(/visual workspace to test that interpretation/i)).toBeInTheDocument()
  })
})

describe('PAC guided-skill reasoning feedback — what the shared component standardises', () => {
  beforeEach(setUpEnvironment)

  it('announces the feedback instead of appearing silently', async () => {
    await commitPrediction('level-zero-underdamped')

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).not.toBeNull()
    expect(verdict).toHaveAttribute('data-plausibility', 'best')
    expect(verdict).toHaveAttribute('role', 'status')
    expect(verdict).toHaveAttribute('aria-live', 'polite')
  })

  it('offers the comparison against the answers not taken', async () => {
    const choice = await commitPrediction('zero-only')

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(screen.getByText(/why the other answers do not fit/i)).toBeInTheDocument()
    for (const other of items().prediction.choices.filter(
      (candidate) => candidate.id !== choice.id,
    )) {
      expect(verdict?.textContent).toContain(other.label)
      expect(verdict?.textContent).toContain(other.rationale)
    }
  })
})
