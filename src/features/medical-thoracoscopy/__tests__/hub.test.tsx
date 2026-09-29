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

  it('offers one door, to section six, the first open section, for a fresh learner', () => {
    const { container } = render(<MedicalThoracoscopyHub />)

    const door = container.querySelector('[data-continue]') as HTMLElement
    expect(door).toHaveAttribute('data-next-section', 'normal-pleural-space')
    expect(door).toHaveTextContent(/^Start: /)
    expect(door).toHaveAttribute('href', expect.stringContaining('section=normal-pleural-space'))
    expect(screen.queryByText(/No section is open yet/)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-continue]')).toHaveLength(1)
  })

  it('lists all nineteen sections by chapter: the three written as links, the rest in preparation', () => {
    const { container } = render(<MedicalThoracoscopyHub />)
    const outline = container.querySelector('[data-course-outline]') as HTMLElement

    expect(outline.querySelectorAll('[data-chapter]')).toHaveLength(5)
    const items = Array.from(outline.querySelectorAll('[data-section]')) as HTMLElement[]
    expect(items).toHaveLength(19)
    const open = items.filter((item) => item.getAttribute('data-state') === 'available')
    expect(open.map((item) => item.getAttribute('data-section'))).toEqual([
      'normal-pleural-space',
      'four-controls',
      'systematic-survey',
    ])
    for (const item of open) expect(within(item).getByRole('link')).toBeInTheDocument()
    for (const item of items.filter((entry) => !open.includes(entry))) {
      expect(item).toHaveAttribute('data-state', 'in-preparation')
      expect(within(item).getByText('In preparation')).toBeInTheDocument()
      expect(within(item).queryByRole('link')).toBeNull()
    }
    // the chapter holding the next step opens on load
    expect(outline.querySelector('details[open]')).toHaveAttribute(
      'data-chapter',
      'equipment-and-anatomy',
    )
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

  it('links the engineering prototypes while the module is in development, outside the course', () => {
    const { container } = render(<MedicalThoracoscopyHub />)
    const prototypes = container.querySelector('[data-prototypes]') as HTMLElement

    expect(within(prototypes).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Engineering prototypes',
    )
    expect(
      within(prototypes)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/medical-thoracoscopy/prototype/space',
      '/medical-thoracoscopy/prototype/tool-contact',
    ])
    // neither is a section of the course, nor its door
    const outline = container.querySelector('[data-course-outline]') as HTMLElement
    expect(outline.querySelector('a[href*="prototype"]')).toBeNull()
    expect(container.querySelector('[data-continue]')?.getAttribute('href')).not.toMatch(
      /prototype/,
    )
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

    expect(container.querySelector('[data-continue]')).toHaveAttribute(
      'data-next-section',
      'normal-pleural-space',
    )
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
