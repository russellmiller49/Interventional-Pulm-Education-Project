import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

import { BronchoscopyFoundationsHub } from '../components/BronchoscopyFoundationsHub'
import { BronchoscopyFoundationsLearnLanding } from '../components/BronchoscopyFoundationsLearnLanding'
import { BRONCH_SECTION_IDS, bronchPathwaySections } from '../content/pathway'
import { bronchPathwayComposition } from '../content/pathwayResolver'
import { BRONCH_PHASES } from '../content/sectionIds'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  createEmptyBronchSelfPacedRecord,
  withReviewLater,
  withSectionOpened,
  withSectionReviewed,
  type BronchSelfPacedRecord,
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

/** Exam and completion vocabulary the self-paced surfaces must not show (BF-01). */
const EXAM_WORDS =
  /capstone|standard met|not yet met|decided once|made once|first decision|first response|first answer|worked through|on your record|mastery|\bpass(ed)?\b/i

function store(record: BronchSelfPacedRecord) {
  localStorage.setItem(BRONCH_SELF_PACED_STORAGE_KEY, JSON.stringify(record))
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const ctas = () => document.querySelectorAll('[data-bronch-continue]')
const chips = () => [
  ...document.querySelectorAll('[data-pathway-accordion] a[data-kind="section"]'),
]

describe('the hub', () => {
  it('has one primary call to action, and it starts a fresh learner at the first section', async () => {
    const { container } = render(<BronchoscopyFoundationsHub />)
    expect(ctas()).toHaveLength(1)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Start — /)
    expect(BRONCH_SECTION_IDS[0]).toBe('clinical-question')
    expect(cta).toHaveAttribute('data-next-section', 'clinical-question')
    expect(cta).toHaveAttribute('href', '/bronchoscopy-foundations/learn?section=clinical-question')
    // Every count on the page is the registry's.
    const composition = bronchPathwayComposition()
    const line = document.querySelector('[data-pathway-composition]')!
    expect(line.textContent).toMatch(new RegExp(`^${composition.total} sections`))
    expect(line.textContent).toContain(`${composition.byPhase.length} phases`)
    expect(line.textContent).toMatch(new RegExp(`${composition.minutes} min estimated$`))
    expect(chips()).toHaveLength(bronchPathwaySections.length)
    expect(document.querySelectorAll('[data-pathway-accordion] details')).toHaveLength(
      BRONCH_PHASES.length,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('states the purpose, that questions are optional, what is kept and that it is not competence', () => {
    render(<BronchoscopyFoundationsHub />)
    expect(
      screen.getByRole('heading', { name: 'Prepare for supervised bronchoscopy' }),
    ).toBeVisible()
    expect(screen.getByText(/Fifteen short sections take you through/)).toHaveTextContent(
      'You do not need to have held a scope.',
    )
    // The one statement of what an online course cannot show, with no course-talk in it.
    const competence = document.querySelector('[data-competence-statement]')!
    expect(document.querySelectorAll('[data-competence-statement]')).toHaveLength(1)
    expect(competence).toHaveTextContent(
      'An online course cannot show that you can perform a bronchoscopy.',
    )
    expect(document.body.textContent).not.toMatch(/authored|model limits|teaching profile/i)
    expect(document.querySelector('[data-storage-statement]')).toHaveTextContent(
      'Your answers are not saved and nothing is scored.',
    )
    expect(screen.getByText(/You can skip any question or activity/)).toHaveTextContent(
      'Open the sections in any order.',
    )
    expect(document.body.textContent).not.toMatch(EXAM_WORDS)
  })

  it('makes Practice, Integrated cases and Reference secondary links', () => {
    render(<BronchoscopyFoundationsHub />)
    const nav = screen.getByRole('navigation', { name: 'Further Foundations activities' })
    expect(nav.querySelectorAll('a')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Integrated cases' })).toHaveAttribute(
      'href',
      '/bronchoscopy-foundations/assess',
    )
    expect(screen.getByRole('link', { name: /Reference and sources/ })).toHaveAttribute(
      'href',
      '/bronchoscopy-foundations/reference',
    )
  })

  it('resumes the section left and shows the learner’s own marks on the chips', () => {
    const [first, second, third] = BRONCH_SECTION_IDS
    let record = withSectionOpened(createEmptyBronchSelfPacedRecord(), first)
    record = withSectionReviewed(record, first, true)
    record = withReviewLater(record, third, true)
    record = withSectionOpened(record, second)
    store(record)
    render(<BronchoscopyFoundationsHub />)
    const cta = ctas()[0]
    expect(cta.textContent).toMatch(/^Resume — /)
    expect(cta).toHaveAttribute('data-next-section', second)
    const [firstChip, secondChip, thirdChip] = chips()
    expect(firstChip).toHaveAttribute('data-reviewed', 'true')
    expect(firstChip.textContent).toMatch(/✓ reviewed/)
    expect(secondChip).toHaveAttribute('data-recommended', 'true')
    expect(secondChip.textContent).toMatch(/opened/)
    expect(secondChip.textContent).toMatch(/Up next/)
    expect(thirdChip).toHaveAttribute('data-review-later', 'true')
    expect(thirdChip.textContent).toMatch(/Review later/)
    // Only the group holding the next section opens on load.
    const open = [...document.querySelectorAll('[data-pathway-accordion] details')].filter((d) =>
      d.hasAttribute('open'),
    )
    expect(open).toHaveLength(1)
    expect(open[0].querySelector('a[data-recommended="true"]')).not.toBeNull()
  })

  it('does not convert the earlier record’s completions into marks or a door', () => {
    const earlier = JSON.stringify({
      ...createEmptyBronchRecord(),
      completedSectionIds: [...BRONCH_SECTION_IDS],
      updatedAt: '2026-09-12T00:00:00.000Z',
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    render(<BronchoscopyFoundationsHub />)
    expect(ctas()[0].textContent).toMatch(/^Start — /)
    expect(ctas()[0]).toHaveAttribute('data-next-section', BRONCH_SECTION_IDS[0])
    expect(chips().filter((chip) => chip.getAttribute('data-reviewed') === 'true')).toHaveLength(0)
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })

  it('sends a learner who has marked every section reviewed to the closing screen', () => {
    let record = createEmptyBronchSelfPacedRecord()
    for (const id of BRONCH_SECTION_IDS) record = withSectionReviewed(record, id, true)
    store(record)
    render(<BronchoscopyFoundationsHub />)
    const cta = ctas()[0]
    expect(cta).toHaveAttribute('data-bronch-continue', 'complete')
    expect(cta).toHaveAttribute('href', '/bronchoscopy-foundations/learn/complete')
    expect(cta.textContent).toMatch(/read what comes next/)
  })

  it('gives the Learn landing the same door and the same map', async () => {
    const { container } = render(<BronchoscopyFoundationsLearnLanding unknownSection="nope" />)
    expect(ctas()).toHaveLength(1)
    expect(ctas()[0]).toHaveAttribute('data-next-section', BRONCH_SECTION_IDS[0])
    expect(document.querySelector('[data-unknown-section="nope"]')).not.toBeNull()
    expect(chips()).toHaveLength(bronchPathwaySections.length)
    expect(await axe(container)).toHaveNoViolations()
  })
})
