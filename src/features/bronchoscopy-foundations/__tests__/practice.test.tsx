import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { BronchCaseActivity } from '../components/BronchCaseActivity'
import { BronchoscopyFoundationsPracticeLanding } from '../components/BronchoscopyFoundationsPracticeLanding'
import { bronchMicroCasesInPathwayOrder, microCaseAttemptKey } from '../content/microCases'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  parseBronchRecord,
  withFirstAttempt,
} from '../engine/learnProgress'

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
const stored = () => parseBronchRecord(localStorage.getItem(BRONCH_STORAGE_KEY))

function commitChoice(choiceId: string) {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${choiceId}"]`)!)
  fireEvent.click(document.querySelector('[data-now-primary]')!)
}

describe('a practice case', () => {
  it('shows the situation, withholds the reasoning until a decision, then states it', () => {
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

    commitChoice(microCase.stage.item.correctChoiceIds[0])
    expect(document.querySelector('[data-case-verdict]')).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
  })

  it('records the first decision once, and lets the learner answer again without rewriting it', () => {
    const microCase = cases()[0]
    const key = microCaseAttemptKey(microCase)
    const keyed = microCase.stage.item.correctChoiceIds[0]
    const other = microCase.stage.item.choices.find((choice) => choice.id !== keyed)!.id
    render(<BronchCaseActivity caseId={microCase.id} />)

    commitChoice(other)
    expect(stored()?.firstAttempts[key].choiceId).toBe(other)
    expect(stored()?.firstAttempts[key].correct).toBe(false)

    // Answering again is the point of this layer; the record is not.
    fireEvent.click(document.querySelector('[data-answer-again]')!)
    expect(document.querySelector('[data-case-verdict]')).toBeNull()
    commitChoice(keyed)
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    expect(stored()?.firstAttempts[key].choiceId).toBe(other)
    expect(stored()?.firstAttempts[key].correct).toBe(false)
  })

  it('tells a returning learner what they decided the first time', () => {
    const microCase = cases()[0]
    const keyed = microCase.stage.item.correctChoiceIds[0]
    localStorage.setItem(
      BRONCH_STORAGE_KEY,
      JSON.stringify(
        withFirstAttempt(createEmptyBronchRecord(), microCaseAttemptKey(microCase), keyed),
      ),
    )
    render(<BronchCaseActivity caseId={microCase.id} />)
    expect(document.querySelector('[data-first-decision]')?.textContent).toContain(
      microCase.stage.item.choices.find((choice) => choice.id === keyed)!.label,
    )
  })

  it('walks to the next case, and says so plainly on the last one', () => {
    const all = cases()
    render(<BronchCaseActivity caseId={all[0].id} />)
    commitChoice(all[0].stage.item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toHaveAttribute('data-next-case', all[1].id)
    cleanup()

    render(<BronchCaseActivity caseId={all[all.length - 1].id} />)
    commitChoice(all[all.length - 1].stage.item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toBeNull()
    expect(screen.getByText(/Back to the case list/)).toBeInTheDocument()
  })

  it('does not name the section, and so the idea, until the decision is made', () => {
    const microCase = cases()[0]
    render(<BronchCaseActivity caseId={microCase.id} />)
    expect(document.querySelector('[data-case-pairing]')).toBeNull()
    commitChoice(microCase.stage.item.choices[0].id)
    expect(document.querySelector('[data-case-pairing]')).not.toBeNull()
  })

  it('lists the local policies a decision depends on only after it is made, and only when there are any', () => {
    const withPolicies = cases().find((entry) => entry.stage.localPolicyIds.length > 0)
    const without = cases().find((entry) => entry.stage.localPolicyIds.length === 0)
    if (withPolicies) {
      render(<BronchCaseActivity caseId={withPolicies.id} />)
      expect(document.querySelector('[data-case-policies]')).toBeNull()
      commitChoice(withPolicies.stage.item.choices[0].id)
      const listed = [...document.querySelectorAll('[data-case-policies] [data-local-policy]')].map(
        (el) => el.getAttribute('data-local-policy'),
      )
      expect(listed).toEqual([...withPolicies.stage.localPolicyIds])
      cleanup()
    }
    if (without) {
      render(<BronchCaseActivity caseId={without.id} />)
      commitChoice(without.stage.item.choices[0].id)
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

  it('moves the door past the cases already decided and marks them', () => {
    const all = cases()
    let record = createEmptyBronchRecord()
    record = withFirstAttempt(record, microCaseAttemptKey(all[0]), all[0].stage.item.choices[0].id)
    localStorage.setItem(BRONCH_STORAGE_KEY, JSON.stringify(record))

    render(<BronchoscopyFoundationsPracticeLanding />)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      all[1].id,
    )
    expect(document.querySelector(`[data-practice-case-link="${all[0].id}"]`)).toHaveAttribute(
      'data-decided',
      'true',
    )
    expect(document.querySelector(`[data-practice-case-link="${all[1].id}"]`)).toHaveAttribute(
      'data-decided',
      'false',
    )
  })

  it('sends a learner who has decided every case to the capstone', () => {
    let record = createEmptyBronchRecord()
    for (const microCase of cases()) {
      record = withFirstAttempt(
        record,
        microCaseAttemptKey(microCase),
        microCase.stage.item.choices[0].id,
      )
    }
    localStorage.setItem(BRONCH_STORAGE_KEY, JSON.stringify(record))
    render(<BronchoscopyFoundationsPracticeLanding />)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-practice-continue',
      'complete',
    )
  })
})
