import { render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { axe } from 'jest-axe'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'
import { PROMOTIONAL_WORDING } from '@/lib/sponsorship/policy'

import { CasesLanding } from '../components/hub/CasesLanding'
import { LearnLanding } from '../components/hub/LearnLanding'
import { MedicalThoracoscopyHub } from '../components/hub/MedicalThoracoscopyHub'
import { PracticeLanding } from '../components/hub/PracticeLanding'
import { THORACOSCOPY_PROGRESS_CHANGED_EVENT } from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const target =
      typeof href === 'string'
        ? href
        : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ''}`
    return (
      <a href={target} {...rest}>
        {children}
      </a>
    )
  },
}))

beforeEach(() => window.localStorage.clear())

function visibleCopyProblems(container: HTMLElement): string[] {
  const text = container.textContent ?? ''
  const promotional = text.match(PROMOTIONAL_WORDING)
  return [...flaggedLearnerCopyTerms(text), ...(promotional ? [promotional[0]] : [])]
}

describe('course hub', () => {
  it('leads with the procedure and who the course is for', () => {
    render(<MedicalThoracoscopyHub />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Decide, set up, enter, make room, survey, sample, treat and finish.',
    )
    expect(screen.getByText(/fellows and attendings starting thoracoscopy/)).toBeInTheDocument()
    expect(screen.getByText('19 sections in 5 chapters · about 154 min')).toBeInTheDocument()
  })

  it('offers no door while no section is open, and says so', () => {
    render(<MedicalThoracoscopyHub />)

    expect(screen.getByRole('status')).toHaveTextContent('No section is open yet.')
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.queryAllByRole('button')).toEqual([])
  })

  it('lists all nineteen sections by chapter, each in preparation and none a link', () => {
    const { container } = render(<MedicalThoracoscopyHub />)
    const outline = container.querySelector('[data-course-outline]') as HTMLElement

    expect(outline.querySelectorAll('[data-chapter]')).toHaveLength(5)
    const items = outline.querySelectorAll('[data-section]')
    expect(items).toHaveLength(19)
    for (const item of Array.from(items)) {
      expect(item).toHaveAttribute('data-state', 'in-preparation')
      expect(within(item as HTMLElement).getByText('In preparation')).toBeInTheDocument()
    }
    expect(outline.querySelector('details[open]')).toHaveAttribute('data-chapter', 'decide')
    expect(within(outline).getByText('When a complication happens')).toBeInTheDocument()
  })

  it('lists practice and cases as in preparation, and what the simulation does not show', () => {
    const { container } = render(<MedicalThoracoscopyHub />)

    expect(container.querySelectorAll('[data-item^="P"]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-item^="C"]')).toHaveLength(4)
    const boundaries = screen.getByRole('heading', { name: 'What the simulation does not show' })
      .nextElementSibling as HTMLElement
    expect(within(boundaries).getAllByRole('listitem')).toHaveLength(6)
  })

  it('writes nothing to storage by being opened', () => {
    render(<MedicalThoracoscopyHub />)

    expect(window.localStorage.length).toBe(0)
  })

  it('uses no grading, correctness or promotional words, and has no detectable accessibility problems', async () => {
    const { container } = render(<MedicalThoracoscopyHub />)

    expect(visibleCopyProblems(container)).toEqual([])
    expect(await axe(container)).toHaveNoViolations()
  })

  it('tells a learner whose browser is not saving', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(<MedicalThoracoscopyHub />)

    expect(screen.getByRole('note')).toHaveTextContent('This browser is not saving your place')
    getItem.mockRestore()
  })
})

describe('Learn landing', () => {
  it('says a requested section is in preparation, offers no mark, and records nothing', () => {
    const changed = jest.fn()
    window.addEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, changed)
    render(<LearnLanding requestedSection="four-controls" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Four things you control')
    expect(
      screen.getByText(/Section 7 of 19 · Access and orientation · about 7 min/),
    ).toBeInTheDocument()
    expect(screen.getByText(/nothing is recorded for it/)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all the sections' })).toHaveAttribute(
      'href',
      '/medical-thoracoscopy/learn',
    )
    expect(changed).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
    window.removeEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, changed)
  })

  it('says when a requested section does not exist', () => {
    render(<LearnLanding requestedSection="not-a-section" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Learn')
    expect(screen.getByRole('note')).toHaveTextContent('There is no section with that address.')
  })

  it('shows the outline and the door with nothing requested', async () => {
    const { container } = render(<LearnLanding />)

    expect(screen.getByRole('status')).toHaveTextContent('No section is open yet.')
    expect(container.querySelectorAll('[data-section]')).toHaveLength(19)
    expect(visibleCopyProblems(container)).toEqual([])
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Practice and Cases landings', () => {
  it('pair each scenario with its sections, all in preparation', () => {
    const { container } = render(<PracticeLanding />)

    expect(container.querySelectorAll('[data-state="in-preparation"]')).toHaveLength(7)
    expect(
      screen.getByText(/With Fluid out, air in and When the lung won't fall away/),
    ).toBeInTheDocument()
    expect(visibleCopyProblems(container)).toEqual([])
  })

  it('list the four cases, all in preparation', () => {
    const { container } = render(<CasesLanding />)

    expect(container.querySelectorAll('[data-state="in-preparation"]')).toHaveLength(4)
    expect(visibleCopyProblems(container)).toEqual([])
  })
})
