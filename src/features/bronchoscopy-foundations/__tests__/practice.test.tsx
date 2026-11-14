import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { BronchCaseActivity } from '../components/BronchCaseActivity'
import { BronchoscopyFoundationsPracticeLanding } from '../components/BronchoscopyFoundationsPracticeLanding'
import { bronchMicroCasesInPathwayOrder, microCaseAttemptKey } from '../content/microCases'
import { PRACTICE_SETS, PRACTICE_SET_SIZE, practiceSetErrors } from '../content/practiceSets'
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

  it('names the section it draws on only after an answer or the explanation (rewrite plan)', () => {
    const microCase = cases()[0]
    render(<BronchCaseActivity caseId={microCase.id} />)
    // Before an answer the section would give the idea away.
    expect(document.querySelector('[data-case-pairing]')).toBeNull()
    expect(document.querySelector('a[href*="learn?section="]')).toBeNull()
    fireEvent.click(document.querySelector('[data-show-explanation]')!)
    expect(document.querySelector('[data-case-pairing] a')).toHaveAttribute(
      'href',
      `/bronchoscopy-foundations/learn?section=${microCase.sectionId}`,
    )
    fireEvent.click(document.querySelector('[data-show-explanation]')!)
    expect(document.querySelector('[data-case-pairing]')).toBeNull()
    checkChoice(microCase.stage.item.choices[0].id)
    expect(document.querySelector('[data-case-pairing] a')).not.toBeNull()
  })

  it('keeps the way on inside a mixed set, then offers the next set', () => {
    const first = PRACTICE_SETS[0]
    render(<BronchCaseActivity caseId={first[0].id} set={1} />)
    expect(document.body).toHaveTextContent(
      `Practice · set 1 of ${PRACTICE_SETS.length} · case 1 of ${first.length}`,
    )
    expect(document.querySelector('[data-nav-next-case]')).toHaveAttribute(
      'href',
      `/bronchoscopy-foundations/practice?case=${first[1].id}&set=1`,
    )
    checkChoice(first[0].stage.item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toHaveAttribute(
      'data-next-case',
      first[1].id,
    )
    cleanup()
    render(<BronchCaseActivity caseId={first[first.length - 1].id} set={1} />)
    checkChoice(first[first.length - 1].stage.item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toBeNull()
    expect(document.querySelector('[data-next-set]')).toHaveAttribute(
      'href',
      `/bronchoscopy-foundations/practice?case=${PRACTICE_SETS[1][0].id}&set=2`,
    )
    cleanup()
    // A set the case is not in is ignored: the case opens in the whole list.
    render(<BronchCaseActivity caseId={first[0].id} set={2} />)
    expect(document.body).not.toHaveTextContent('· set 2 of')
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

describe('the mixed practice sets', () => {
  it('deal every case once into sets of ten, half vignettes, with no two from one section or topic side by side', () => {
    expect(practiceSetErrors()).toEqual([])
    expect(PRACTICE_SETS.flat()).toHaveLength(cases().length)
    for (const setCases of PRACTICE_SETS.slice(0, -1)) {
      expect(setCases).toHaveLength(PRACTICE_SET_SIZE)
      expect(setCases.filter((entry) => entry.vignetteTopic).length).toBe(PRACTICE_SET_SIZE / 2)
      expect(new Set(setCases.map((entry) => entry.sectionId)).size).toBeGreaterThanOrEqual(5)
    }
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
    // The one door is the first mixed set; the full list is behind a disclosure, closed.
    expect(document.querySelectorAll('[data-practice-continue]')).toHaveLength(1)
    const door = document.querySelector('[data-practice-continue]')!
    expect(door).toHaveAttribute('data-next-case', PRACTICE_SETS[0][0].id)
    expect(door).toHaveAttribute(
      'href',
      `/bronchoscopy-foundations/practice?case=${PRACTICE_SETS[0][0].id}&set=1`,
    )
    expect(document.querySelectorAll('[data-practice-set-link]')).toHaveLength(PRACTICE_SETS.length)
    const browse = document.querySelector<HTMLDetailsElement>('[data-practice-browse]')!
    expect(browse.open).toBe(false)
    expect(browse.querySelectorAll('[data-practice-case-link]')).toHaveLength(cases().length)
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
      PRACTICE_SETS[0][0].id,
    )
    expect(document.querySelector('[data-decided]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/first decision|decided once|capstone/i)
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })
})
