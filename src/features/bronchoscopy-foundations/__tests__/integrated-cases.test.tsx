import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { axe } from 'jest-axe'

import { BronchoscopyFoundationsAssessLanding } from '../components/BronchoscopyFoundationsAssessLanding'
import { CAPSTONE_CASES } from '../content/capstone'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { capstoneAttemptKey, capstoneStageItem, capstoneStageItems } from '../content/stageItems'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
      }
      {...props}
    >
      {children}
    </a>
  ),
}))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const EXAM_WORDS =
  /capstone|standard met|not yet met|decided once|made once|first decision|decisions held|critical decisions that did not hold|work through the sections first/i

function caseElement(caseId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-integrated-case="${caseId}"]`)
  if (!element) throw new Error(`No integrated case ${caseId}`)
  return element
}

function checkChoice(caseId: string, choiceId: string) {
  const element = caseElement(caseId)
  fireEvent.click(element.querySelector(`input[value="${choiceId}"]`)!)
  fireEvent.click(element.querySelector('[data-check-answer]')!)
}

/**
 * The former capstone as integrated cases (BF-01). Superseded contracts: the Learn-completion lock,
 * one decision per case, withheld reasoning until a debrief, and the seven-of-eight / critical /
 * unsafe standard. Kept: the eight cases and their pairing, and immediate unsafe feedback.
 */
describe('the integrated cases', () => {
  it('holds eight cases, each backed by one stage item and paired to a section', () => {
    expect(CAPSTONE_CASES).toHaveLength(8)
    expect(capstoneStageItems.map((entry) => entry.item.id)).toEqual(
      CAPSTONE_CASES.map((entry) => entry.id),
    )
    for (const entry of CAPSTONE_CASES) {
      expect(BRONCH_SECTION_IDS).toContain(entry.pairedSectionId)
      expect(capstoneStageItem(entry.id).item.correctChoiceIds).toHaveLength(1)
    }
    expect(() => capstoneStageItem('no-such-case')).toThrow()
  })

  it('opens every case on a fresh device, with no lock, standard or once-only wording', async () => {
    const { container } = render(<BronchoscopyFoundationsAssessLanding />)
    expect(document.querySelectorAll('[data-integrated-case]')).toHaveLength(8)
    expect(document.querySelectorAll('[data-prediction-choices]')).toHaveLength(8)
    for (const entry of CAPSTONE_CASES) {
      expect(caseElement(entry.id).querySelector('[data-case-pairing] a')).toHaveAttribute(
        'href',
        `/bronchoscopy-foundations/learn?section=${entry.pairedSectionId}`,
      )
    }
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.body.textContent).not.toMatch(EXAM_WORDS)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('opens a case’s explanation before an answer and records nothing', () => {
    render(<BronchoscopyFoundationsAssessLanding />)
    const entry = CAPSTONE_CASES[0]
    const item = capstoneStageItem(entry.id).item
    fireEvent.click(caseElement(entry.id).querySelector('[data-show-explanation]')!)
    const reveal = caseElement(entry.id).querySelector('[data-explanation-reveal]')
    expect(reveal?.textContent).toContain(item.explanation)
    expect(
      reveal?.querySelector(`[data-explanation-best="${item.correctChoiceIds[0]}"]`),
    ).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(caseElement(entry.id).querySelector('[data-prediction-choices]')).not.toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('gives an unsafe choice immediate safety feedback, and the case can be tried again', () => {
    render(<BronchoscopyFoundationsAssessLanding />)
    const entry = CAPSTONE_CASES.find((candidate) =>
      capstoneStageItem(candidate.id).item.choices.some(
        (choice) => choice.plausibility === 'unsafe',
      ),
    )!
    const item = capstoneStageItem(entry.id).item
    const unsafe = item.choices.find((choice) => choice.plausibility === 'unsafe')!
    checkChoice(entry.id, unsafe.id)
    const verdict = caseElement(entry.id).querySelector('[data-answer-verdict]')
    expect(verdict).toHaveAttribute('role', 'alert')
    expect(verdict).toHaveAttribute('data-revealed', 'true')
    expect(verdict).toHaveAttribute('data-verdict-outcome', 'unsafe')
    fireEvent.click(caseElement(entry.id).querySelector('[data-answer-again]')!)
    expect(caseElement(entry.id).querySelector('[data-answer-verdict]')).toBeNull()
    checkChoice(entry.id, item.correctChoiceIds[0])
    expect(caseElement(entry.id).querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    // Other cases stay open and unanswered; nothing is written.
    expect(document.querySelectorAll('[data-answer-verdict]')).toHaveLength(1)
    expect(localStorage.length).toBe(0)
  })

  it('neither shows nor needs decisions stored by the earlier capstone', () => {
    const earlier = JSON.stringify({
      ...createEmptyBronchRecord(),
      completedSectionIds: [...BRONCH_SECTION_IDS],
      firstAttempts: Object.fromEntries(
        CAPSTONE_CASES.map((entry) => [
          capstoneAttemptKey(entry.id),
          {
            choiceId: capstoneStageItem(entry.id).item.correctChoiceIds[0],
            correct: true,
            at: '2026-09-12T00:00:00.000Z',
          },
        ]),
      ),
      capstoneDebriefViewedAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    render(<BronchoscopyFoundationsAssessLanding />)
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelectorAll('[data-prediction-choices]')).toHaveLength(8)
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })
})
