import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { BronchCaseActivity } from '../components/BronchCaseActivity'
import { BronchoscopyFoundationsPracticeLanding } from '../components/BronchoscopyFoundationsPracticeLanding'
import { bronchMicroCasesInPathwayOrder, microCaseAttemptKey } from '../content/microCases'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const cases = () => bronchMicroCasesInPathwayOrder()

function choose(choiceId: string) {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${choiceId}"]`)!)
}

function checkChoice(choiceId: string) {
  choose(choiceId)
  fireEvent.click(document.querySelector('[data-now-primary]')!)
}

/** Self-paced contract (BF-01): explanation before an answer, try again, move on, nothing saved. */
describe('a practice case', () => {
  it('shows the situation and states the outcome once an answer is checked', () => {
    const microCase = cases()[0]
    render(<BronchCaseActivity caseId={microCase.id} />)

    expect(document.querySelector('[data-practice-case]')).toHaveAttribute(
      'data-practice-case',
      microCase.id,
    )
    expect(document.querySelector('[data-case-situation]')?.textContent).toContain(
      microCase.situation,
    )
    expect(document.querySelector('[data-case-verdict]')).toBeNull()
    expect(document.querySelector<HTMLButtonElement>('[data-now-primary]')?.disabled).toBe(true)

    checkChoice(microCase.stage.item.correctChoiceIds[0])
    expect(document.querySelector('[data-case-verdict]')).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    expect(localStorage.length).toBe(0)
  })

  it('opens the explanation before an answer, records nothing, and still lets the learner answer', () => {
    const microCase = cases()[0]
    const item = microCase.stage.item
    render(<BronchCaseActivity caseId={microCase.id} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    const reveal = document.querySelector('[data-explanation-reveal]')
    expect(reveal).not.toBeNull()
    expect(reveal?.textContent).toContain(item.explanation)
    expect(
      reveal?.querySelector(`[data-explanation-best="${item.correctChoiceIds[0]}"]`),
    ).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
    checkChoice(item.correctChoiceIds[0])
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('lets the learner try again after a wrong answer, and keeps nothing', () => {
    const microCase = cases()[0]
    const keyed = microCase.stage.item.correctChoiceIds[0]
    const other = microCase.stage.item.choices.find((choice) => choice.id !== keyed)!.id
    render(<BronchCaseActivity caseId={microCase.id} />)

    checkChoice(other)
    expect(document.querySelector('[data-answer-verdict]')).not.toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    fireEvent.click(document.querySelector('[data-answer-again]')!)
    expect(document.querySelector('[data-case-verdict]')).toBeNull()
    checkChoice(keyed)
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    expect(localStorage.length).toBe(0)
  })

  it('offers the next case before any answer, and says so plainly on the last one', () => {
    const all = cases()
    render(<BronchCaseActivity caseId={all[0].id} />)
    expect(document.querySelector('[data-nav-next-case]')).toHaveAttribute(
      'data-nav-next-case',
      all[1].id,
    )
    checkChoice(all[0].stage.item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toHaveAttribute('data-next-case', all[1].id)
    cleanup()

    render(<BronchCaseActivity caseId={all[all.length - 1].id} />)
    expect(document.querySelector('[data-nav-next-case]')).toBeNull()
    checkChoice(all[all.length - 1].stage.item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toBeNull()
    expect(screen.getByText(/Back to the case list/)).toBeInTheDocument()
  })

  it('names the section it draws on before any answer, so the idea can be reviewed', () => {
    const microCase = cases()[0]
    render(<BronchCaseActivity caseId={microCase.id} />)
    expect(document.querySelector('[data-case-pairing] a')).toHaveAttribute(
      'href',
      `/bronchoscopy-foundations/learn?section=${microCase.sectionId}`,
    )
  })

  it('lists the local policies a decision depends on with the feedback or explanation, and only when there are any', () => {
    const withPolicies = cases().find((entry) => entry.stage.localPolicyIds.length > 0)
    const without = cases().find((entry) => entry.stage.localPolicyIds.length === 0)
    if (withPolicies) {
      render(<BronchCaseActivity caseId={withPolicies.id} />)
      expect(document.querySelector('[data-case-policies]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
      const listed = [...document.querySelectorAll('[data-case-policies] [data-local-policy]')].map(
        (el) => el.getAttribute('data-local-policy'),
      )
      expect(listed).toEqual([...withPolicies.stage.localPolicyIds])
      cleanup()
    }
    if (without) {
      render(<BronchCaseActivity caseId={without.id} />)
      checkChoice(without.stage.item.choices[0].id)
      expect(document.querySelector('[data-case-policies]')).toBeNull()
    }
  })

  it('says so rather than breaking when the case is not in the module', () => {
    render(<BronchCaseActivity caseId="not-a-case" />)
    expect(document.querySelector('[data-unknown-case]')).not.toBeNull()
  })
})

describe('the practice landing', () => {
  it('lists every case in pathway order behind one door', async () => {
    const { container } = render(<BronchoscopyFoundationsPracticeLanding />)
    const links = [...document.querySelectorAll('[data-practice-case-link]')].map((el) =>
      el.getAttribute('data-practice-case-link'),
    )
    expect(links).toEqual(cases().map((microCase) => microCase.id))
    expect(document.querySelector('[data-practice-list]')).not.toBeNull()
    expect(document.querySelectorAll('[data-practice-continue]')).toHaveLength(1)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      cases()[0].id,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('marks nothing as decided and ignores answers stored by the earlier record', () => {
    const all = cases()
    const earlier = JSON.stringify({
      ...createEmptyBronchRecord(),
      firstAttempts: {
        [microCaseAttemptKey(all[0])]: {
          choiceId: all[0].stage.item.choices[0].id,
          correct: false,
          at: '2026-09-12T00:00:00.000Z',
        },
      },
      updatedAt: '2026-09-12T00:00:00.000Z',
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    render(<BronchoscopyFoundationsPracticeLanding />)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      all[0].id,
    )
    expect(document.querySelector('[data-decided]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/first decision|decided once|capstone/i)
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })
})
