import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { ImagingCaseActivity } from '../components/ImagingCaseActivity'
import { PeripheralImagingPracticeLanding } from '../components/PeripheralImagingPracticeLanding'
import { imagingMicroCasesInPathwayOrder, practiceItemId } from '../content/microCases'
import {
  createEmptyImagingRecord,
  parseImagingRecord,
  PERIPHERAL_IMAGING_STORAGE_KEY,
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

const cases = () => imagingMicroCasesInPathwayOrder()
const stored = () => parseImagingRecord(localStorage.getItem(PERIPHERAL_IMAGING_STORAGE_KEY))

function commitChoice(choiceId: string) {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${choiceId}"]`)!)
  fireEvent.click(document.querySelector('[data-now-primary]')!)
}

describe('a practice case', () => {
  it('shows the situation, withholds the reasoning until a decision, then states it', () => {
    const microCase = cases()[0]
    render(<ImagingCaseActivity caseId={microCase.id} />)

    expect(document.querySelector('[data-case-situation]')?.textContent).toContain(
      microCase.situation,
    )
    expect(document.querySelector('[data-case-verdict]')).toBeNull()
    expect(document.querySelector<HTMLButtonElement>('[data-now-primary]')?.disabled).toBe(true)

    commitChoice(microCase.item.correctChoiceIds[0])
    expect(document.querySelector('[data-case-verdict]')).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
  })

  it('records the first decision once, and lets the learner answer again without rewriting it', () => {
    const microCase = cases()[0]
    const key = practiceItemId(microCase.id)
    const keyed = microCase.item.correctChoiceIds[0]
    const other = microCase.item.choices.find((choice) => choice.id !== keyed)!.id
    render(<ImagingCaseActivity caseId={microCase.id} />)

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
    const keyed = microCase.item.correctChoiceIds[0]
    localStorage.setItem(
      PERIPHERAL_IMAGING_STORAGE_KEY,
      JSON.stringify(
        withFirstAttempt(createEmptyImagingRecord(), practiceItemId(microCase.id), keyed),
      ),
    )
    render(<ImagingCaseActivity caseId={microCase.id} />)
    expect(document.querySelector('[data-first-decision]')?.textContent).toContain(
      microCase.item.choices.find((choice) => choice.id === keyed)!.label,
    )
  })

  it('walks to the next case, and says so plainly on the last one', () => {
    const all = cases()
    render(<ImagingCaseActivity caseId={all[0].id} />)
    commitChoice(all[0].item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toHaveAttribute('data-next-case', all[1].id)
    cleanup()

    render(<ImagingCaseActivity caseId={all[all.length - 1].id} />)
    commitChoice(all[all.length - 1].item.choices[0].id)
    expect(document.querySelector('[data-next-case]')).toBeNull()
    expect(screen.getByText(/Back to the case list/)).toBeInTheDocument()
  })

  it('does not name the section, and so the mechanism, until the decision is made', () => {
    // A section title names the mechanism the case is about. Above the choices it is a free hint;
    // after the decision it is the link a learner wants.
    const microCase = cases()[0]
    render(<ImagingCaseActivity caseId={microCase.id} />)
    expect(document.querySelector('[data-case-pairing]')).toBeNull()
    commitChoice(microCase.item.choices[0].id)
    expect(document.querySelector('[data-case-pairing]')).not.toBeNull()
  })

  it('says so rather than breaking when the case is not in the module', () => {
    render(<ImagingCaseActivity caseId="not-a-case" />)
    expect(document.querySelector('[data-unknown-case]')).not.toBeNull()
  })
})

describe('the practice landing', () => {
  it('lists every case in pathway order behind one door', async () => {
    const { container } = render(<PeripheralImagingPracticeLanding />)
    const links = [...document.querySelectorAll('[data-practice-case-link]')].map((el) =>
      el.getAttribute('data-practice-case-link'),
    )
    expect(links).toEqual(cases().map((microCase) => microCase.id))
    expect(document.querySelectorAll('[data-practice-continue]')).toHaveLength(1)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      cases()[0].id,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('moves the door past the cases already decided and marks them', () => {
    const all = cases()
    let record = createEmptyImagingRecord()
    record = withFirstAttempt(record, practiceItemId(all[0].id), all[0].item.choices[0].id)
    localStorage.setItem(PERIPHERAL_IMAGING_STORAGE_KEY, JSON.stringify(record))

    render(<PeripheralImagingPracticeLanding />)
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
    let record = createEmptyImagingRecord()
    for (const microCase of cases()) {
      record = withFirstAttempt(record, practiceItemId(microCase.id), microCase.item.choices[0].id)
    }
    localStorage.setItem(PERIPHERAL_IMAGING_STORAGE_KEY, JSON.stringify(record))
    render(<PeripheralImagingPracticeLanding />)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-practice-continue',
      'complete',
    )
  })
})
