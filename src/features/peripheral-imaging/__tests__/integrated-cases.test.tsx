import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { ImagingIntegratedCaseActivity } from '../components/ImagingIntegratedCaseActivity'
import { PeripheralImagingIntegratedCasesLanding } from '../components/PeripheralImagingIntegratedCasesLanding'
import { imagingCaseById, imagingCases, validateImagingCases } from '../content/cases'
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

const stored = () => parseImagingProgress(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY))
const RESPONSE_SHAPED = /choice|correct|attempt|answer/i

function checkChoice(choiceId: string) {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${choiceId}"]`)!)
  fireEvent.click(document.querySelector('[data-now-primary]')!)
}

/*
 * Contract change (PI-01, owner decision 2026-09-14). These eight cases were the capstone: locked
 * until every section was worked through, decided once each with no feedback until the last, and
 * held to a standard of seven of eight with every safety decision correct. `case-standard.test.ts`
 * pinned the standard and the lock and was retired with them. The contract now: every case is open
 * to anyone, in any order, explains itself before an answer, gives immediate feedback — safety
 * feedback included — on any answer, repeats freely, and records nothing but the visit.
 */
describe('the integrated cases', () => {
  it('keep the eight cases, their stable item ids and the item bank’s safety flags', () => {
    expect(validateImagingCases()).toEqual([])
    // Prompt 04 (OD4-05, 2026-09-22) replaced the fourth, fifth and eighth slots with revised
    // cases under new ids; the earlier items stay in the bank and their addresses redirect.
    expect(imagingCases.map((imagingCase) => imagingCase.id)).toEqual([
      'case-1',
      'case-2',
      'case-3',
      'case-4-v2',
      'case-5-v2',
      'case-6',
      'case-7',
      'case-8-v2',
    ])
    expect(imagingCases.map((imagingCase) => imagingCase.item.id)).toEqual(
      imagingCases.map((imagingCase) => `capstone:${imagingCase.id}`),
    )
    expect(
      imagingCases
        .filter((imagingCase) => imagingCase.critical)
        .map((imagingCase) => imagingCase.id),
    ).toEqual(['case-1', 'case-4-v2', 'case-6', 'case-7'])
  })

  it('are all open, from the old Assess address, to a learner who has opened no section', async () => {
    const { container } = render(<PeripheralImagingIntegratedCasesLanding />)
    const links = [...document.querySelectorAll('[data-integrated-case-link]')]
    expect(links.map((link) => link.getAttribute('data-integrated-case-link'))).toEqual(
      imagingCases.map((imagingCase) => imagingCase.id),
    )
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `/peripheral-imaging/assess?case=${link.getAttribute('data-integrated-case-link')}`,
      )
    }
    expect(document.querySelector('[data-integrated-continue]')).toHaveAttribute(
      'data-next-case',
      'case-1',
    )
    expect(document.body.textContent).not.toMatch(
      /capstone|sections first|decisions held|standard/i,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('explain a case before any answer, and record only that it was opened', async () => {
    const imagingCase = imagingCaseById.get('case-6')!
    const { container } = render(<ImagingIntegratedCaseActivity caseId="case-6" />)
    expect(document.querySelector('[data-integrated-case]')).toHaveAttribute(
      'data-safety-decision',
      'true',
    )
    expect(screen.getByText(/safety decision/)).toBeInTheDocument()
    expect(document.querySelector('[data-case-pairing] a')).toHaveAttribute(
      'href',
      `/peripheral-imaging/learn?section=${imagingCase.pairedSectionId}`,
    )
    // Moving on never waits on an answer.
    expect(document.querySelector('[data-next-case]')).toHaveAttribute('data-next-case', 'case-7')

    fireEvent.click(screen.getByRole('button', { name: 'Show the explanation' }))
    const panel = document.querySelector('[data-explanation-reveal]')!
    expect(panel).toHaveTextContent(imagingCase.item.explanation)
    const unsafe = imagingCase.item.choices.filter((choice) => choice.plausibility === 'unsafe')
    expect(unsafe.length).toBeGreaterThan(0)
    for (const choice of unsafe) {
      expect(panel.querySelector(`[data-explanation-option="${choice.id}"]`)).toHaveAttribute(
        'data-unsafe',
        'true',
      )
    }
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)
    expect(await axe(container)).toHaveNoViolations()

    expect(stored()).toMatchObject({
      lastLocation: { kind: 'integrated-case', id: 'case-6' },
      openedIntegratedCaseIds: ['case-6'],
    })
    expect(JSON.stringify(stored())).not.toMatch(RESPONSE_SHAPED)
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBeNull()
  })

  it('give an unsafe answer its safety feedback at once, then allow another try and moving on', () => {
    const imagingCase = imagingCaseById.get('case-6')!
    const unsafe = imagingCase.item.choices.find((choice) => choice.plausibility === 'unsafe')!
    render(<ImagingIntegratedCaseActivity caseId="case-6" />)
    checkChoice(unsafe.id)
    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(verdict).toHaveAttribute('data-verdict-outcome', 'unsafe')
    expect(verdict).toHaveAttribute('role', 'alert')
    expect(verdict).toHaveTextContent(unsafe.rationale)

    fireEvent.click(document.querySelector('[data-answer-again]')!)
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    checkChoice(imagingCase.item.correctChoiceIds[0])
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
    expect(document.querySelector('[data-next-case]')).toHaveAttribute('data-next-case', 'case-7')
    expect(JSON.stringify(stored())).not.toMatch(RESPONSE_SHAPED)
  })

  it('point a returning learner at the first case not yet opened, and mark the opened ones', () => {
    let progress = withLocation(createEmptyImagingProgress(), {
      kind: 'integrated-case',
      id: 'case-1',
    })
    progress = withLocation(progress, { kind: 'integrated-case', id: 'case-2' })
    localStorage.setItem(IMAGING_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
    render(<PeripheralImagingIntegratedCasesLanding />)
    expect(document.querySelector('[data-integrated-continue]')).toHaveAttribute(
      'data-next-case',
      'case-3',
    )
    expect(document.querySelector('[data-integrated-case-link="case-1"]')).toHaveAttribute(
      'data-opened',
      'true',
    )
    expect(document.querySelector('[data-integrated-case-link="case-3"]')).toHaveAttribute(
      'data-opened',
      'false',
    )
  })

  it('stay open to a learner whose legacy record holds capstone decisions, without reading them', () => {
    const legacy = JSON.stringify({
      version: 2,
      completedSectionIds: [],
      lastSectionId: null,
      firstAttempts: {
        'capstone:case-1': { choiceId: 'a', correct: false, at: '2026-09-10T00:00:00.000Z' },
      },
      capstoneDebriefViewedAt: null,
      updatedAt: '2026-09-10T00:00:00.000Z',
    })
    localStorage.setItem(LEGACY_IMAGING_RECORD_KEY_V2, legacy)
    render(<ImagingIntegratedCaseActivity caseId="case-1" />)
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelectorAll('[data-prediction-choices] input:checked')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/first decision|on your record/i)
    expect(localStorage.getItem(LEGACY_IMAGING_RECORD_KEY_V2)).toBe(legacy)
  })

  it('say so for a case that is not in the module', () => {
    render(<ImagingIntegratedCaseActivity caseId="case-99" />)
    expect(document.querySelector('[data-unknown-case="case-99"]')).not.toBeNull()
    cleanup()
    render(<PeripheralImagingIntegratedCasesLanding unknownCase="case-99" />)
    expect(document.querySelector('[data-unknown-case="case-99"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-integrated-case-link]')).toHaveLength(8)
  })
})
