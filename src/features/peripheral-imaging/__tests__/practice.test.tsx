import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { ImagingCaseActivity } from '../components/ImagingCaseActivity'
import { PeripheralImagingPracticeLanding } from '../components/PeripheralImagingPracticeLanding'
import { imagingMicroCasesInPathwayOrder, practiceItemId } from '../content/microCases'
import { LEGACY_IMAGING_RECORD_KEY_V2 } from '../engine/learnProgress'
import {
  createEmptyImagingProgress,
  IMAGING_PROGRESS_STORAGE_KEY,
  parseImagingProgress,
  withLocation,
} from '../engine/selfPacedProgress'

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
const stored = () => parseImagingProgress(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY))
const RESPONSE_SHAPED = /choice|correct|attempt|answer/i

function checkChoice(choiceId: string) {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${choiceId}"]`)!)
  fireEvent.click(document.querySelector('[data-now-primary]')!)
}

/*
 * Contract change (PI-01). Old contract: the reasoning and the section link were withheld until a
 * decision, and the first decision was written once to the record and shown on return. New
 * contract: the explanation and the section link are there before any answer, answers are local
 * feedback only, and the only thing stored is that the case was opened.
 */
describe('a practice case', () => {
  it('shows the situation, the concept link and, on request, the explanation before any answer', async () => {
    const microCase = cases()[0]
    const { container } = render(<ImagingCaseActivity caseId={microCase.id} />)

    expect(document.querySelector('[data-case-situation]')?.textContent).toContain(
      microCase.situation,
    )
    expect(document.querySelector('[data-case-pairing] a')).toHaveAttribute(
      'href',
      `/peripheral-imaging/learn?section=${microCase.sectionId}`,
    )
    expect(document.querySelector('[data-case-verdict]')).toBeNull()
    expect(document.querySelector<HTMLButtonElement>('[data-now-primary]')?.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    const panel = document.querySelector('[data-explanation-reveal]')!
    expect(panel).toHaveTextContent(microCase.item.explanation)
    expect(
      panel.querySelector(`[data-explanation-best="${microCase.item.correctChoiceIds[0]}"]`),
    ).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('gives a wrong answer its reasoning, lets the learner try again, and saves no answer', () => {
    const microCase = cases()[0]
    const keyed = microCase.item.correctChoiceIds[0]
    const other = microCase.item.choices.find((choice) => choice.id !== keyed)!.id
    render(<ImagingCaseActivity caseId={microCase.id} />)

    checkChoice(other)
    const wrong = document.querySelector('[data-answer-verdict]')!
    expect(wrong).toHaveAttribute('data-verdict-outcome', 'not-correct')
    expect(wrong).toHaveTextContent(
      microCase.item.choices.find((choice) => choice.id === other)!.rationale,
    )

    fireEvent.click(document.querySelector('[data-answer-again]')!)
    expect(document.querySelector('[data-case-verdict]')).toBeNull()
    checkChoice(keyed)
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )

    expect(stored()).toMatchObject({
      lastLocation: { kind: 'practice-case', id: microCase.id },
      openedPracticeCaseIds: [microCase.id],
    })
    expect(JSON.stringify(stored())).not.toMatch(RESPONSE_SHAPED)
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBeNull()
  })

  it('names an unsafe option as unsafe, in the explanation and in the feedback', () => {
    const microCase = cases().find((entry) =>
      entry.item.choices.some((choice) => choice.plausibility === 'unsafe'),
    )!
    const unsafe = microCase.item.choices.find((choice) => choice.plausibility === 'unsafe')!
    render(<ImagingCaseActivity caseId={microCase.id} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    expect(
      document.querySelector(`[data-explanation-option="${unsafe.id}"][data-unsafe="true"]`),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the explanation' }))
    checkChoice(unsafe.id)
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'unsafe',
    )
  })

  it('offers the next case without an answer, and the case list on the last one', () => {
    const all = cases()
    render(<ImagingCaseActivity caseId={all[0].id} />)
    expect(document.querySelector('[data-next-case]')).toHaveAttribute('data-next-case', all[1].id)
    cleanup()

    render(<ImagingCaseActivity caseId={all[all.length - 1].id} />)
    expect(document.querySelector('[data-next-case]')).toBeNull()
    expect(document.querySelector('[data-back-to-list]')).toHaveTextContent(/Back to the case list/)
  })

  it('says so rather than breaking when the case is not in the module', () => {
    render(<ImagingCaseActivity caseId="not-a-case" />)
    expect(document.querySelector('[data-unknown-case]')).not.toBeNull()
    expect(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)).toBeNull()
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

  it('moves the door past the cases already opened and marks them opened', () => {
    const all = cases()
    const progress = withLocation(createEmptyImagingProgress(), {
      kind: 'practice-case',
      id: all[0].id,
    })
    localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, JSON.stringify(progress))

    render(<PeripheralImagingPracticeLanding />)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      all[1].id,
    )
    expect(document.querySelector(`[data-practice-case-link="${all[0].id}"]`)).toHaveAttribute(
      'data-opened',
      'true',
    )
    expect(document.querySelector(`[data-practice-case-link="${all[1].id}"]`)).toHaveAttribute(
      'data-opened',
      'false',
    )
  })

  it('does not treat a legacy first decision as progress', () => {
    const all = cases()
    const legacy = JSON.stringify({
      version: 2,
      completedSectionIds: [],
      lastSectionId: null,
      firstAttempts: {
        [practiceItemId(all[0].id)]: {
          choiceId: all[0].item.choices[0].id,
          correct: false,
          at: '2026-09-10T00:00:00.000Z',
        },
      },
      capstoneDebriefViewedAt: null,
      updatedAt: '2026-09-10T00:00:00.000Z',
    })
    localStorage.setItem(LEGACY_IMAGING_RECORD_KEY_V2, legacy)
    render(<PeripheralImagingPracticeLanding />)
    expect(document.querySelector('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      all[0].id,
    )
    expect(document.querySelectorAll('[data-practice-case-link][data-opened="true"]')).toHaveLength(
      0,
    )
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBe(legacy)
  })

  it('sends a learner who has opened every case to the integrated cases', () => {
    let progress = createEmptyImagingProgress()
    for (const microCase of cases()) {
      progress = withLocation(progress, { kind: 'practice-case', id: microCase.id })
    }
    localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
    render(<PeripheralImagingPracticeLanding />)
    const door = document.querySelector('[data-practice-continue]')
    expect(door).toHaveAttribute('data-practice-continue', 'complete')
    expect(door).toHaveAttribute('href', '/peripheral-imaging/assess')
  })
})
