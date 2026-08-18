import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CuratedLiteratureResultCard } from '@/features/literature/components/CuratedLiteratureResultCard'
import { LiteratureAdminCollectionNav } from '@/features/literature/components/LiteratureAdminCollectionNav'
import { LiteratureReviewedProvenance } from '@/features/literature/components/LiteratureReviewedProvenance'
import {
  capabilityFromFailure,
  capabilityFromFilteredRead,
} from '@/features/literature/server/runtime-capability'
import type {
  LiteratureCuratedResult,
  LiteratureReviewedMetadata,
} from '@/features/literature/server/types'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const reviewed: LiteratureReviewedMetadata = {
  reviewedRelevance: 'include_core',
  enrichmentProvenance: 'physician_confirmed',
  sourceKind: 'owner_authorized_development_cohort',
  reviewedAt: '2026-08-16T12:00:00.000Z',
  curated: true,
}

const provenanceLabels = {
  adjacent: 'Adjacent IP',
  core: 'Core IP',
  curatedMembership: 'Curated membership',
  curatedNo: 'Not in Curated — reviewed exclusion',
  curatedYes: 'Included in Curated',
  description: 'Historical reviewed truth is separate from the working state.',
  excluded: 'Reviewed exclusion',
  physicianReviewed: 'Physician reviewed',
  provenance: {
    physician_confirmed: 'Physician-confirmed enrichment',
    physician_modified: 'Physician-modified enrichment',
    qc_accepted: 'QC-accepted enrichment',
  },
  provenanceLabel: 'Enrichment provenance',
  reviewedClass: 'Reviewed class',
  reviewedDate: 'Reviewed date',
  source: 'Reviewed source',
  sourceKinds: {
    owner_authorized_development_cohort: 'Owner-authorized physician-reviewed development cohort',
    physician_reviewed_source: 'Physician-reviewed source',
  },
  title: 'Physician-reviewed provenance',
  unreviewed: 'Unreviewed',
  unreviewedDescription:
    'No complete physician-reviewed overlay is recorded. This article is unreviewed, not excluded or judged irrelevant.',
}

const capabilityLabels = {
  title: 'Reviewed provenance is unavailable',
  description: 'The database did not answer.',
  projectLabel: 'Dedicated project',
  reasonLabel: 'Reported reason',
}

const resultLabels = {
  abstractUnavailable: 'No abstract is available.',
  adjacent: 'Adjacent IP',
  conferenceAbstract: 'Conference abstract',
  core: 'Core IP',
  correction: 'Correction',
  doi: 'DOI',
  physicianReviewed: 'Physician reviewed',
  pmid: 'PMID',
  provenance: {
    physician_confirmed: 'Physician-confirmed enrichment',
    physician_modified: 'Physician-modified enrichment',
    qc_accepted: 'QC-accepted enrichment',
  },
  pubMed: 'PubMed',
  retracted: 'Retracted',
  reviewedOn: 'Reviewed',
  visibility: {
    draft: 'Draft',
    published: 'Published',
    hidden: 'Hidden',
  },
}

const article: LiteratureCuratedResult = {
  pmid: '12345678',
  doi: '10.1000/synthetic',
  title: 'Synthetic physician-reviewed article',
  abstractSnippet: 'A synthetic abstract.',
  authors: [{ fullName: 'Example Author', abbreviatedName: 'Author E' }],
  journalTitle: 'Synthetic Journal',
  journalAbbreviation: 'Synth J',
  publicationYear: 2026,
  volume: '1',
  issue: '2',
  pages: '3-4',
  publicationTypes: ['Journal Article'],
  isRetracted: false,
  isCorrection: false,
  isConferenceAbstract: false,
  visibilityState: 'draft',
  reviewed,
}

describe('Curated Literature presentation', () => {
  it('shows controlled reviewed provenance without raw lineage identifiers', () => {
    const { container } = render(
      <LiteratureReviewedProvenance
        result={{
          data: reviewed,
          error: null,
          capability: capabilityFromFilteredRead('itcttmkxdxvwmwcmzmey'),
        }}
        locale="en"
        labels={provenanceLabels}
        capabilityLabels={capabilityLabels}
      />,
    )

    expect(screen.getByText('Physician reviewed')).toBeInTheDocument()
    expect(screen.getAllByText('Core IP').length).toBeGreaterThan(0)
    expect(screen.getByText('Included in Curated')).toBeInTheDocument()
    expect(
      screen.getByText('Owner-authorized physician-reviewed development cohort'),
    ).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/sha256|operation|checksum|digest|uuid/iu)
  })

  it('labels an article with no overlay as Unreviewed, never excluded', () => {
    render(
      <LiteratureReviewedProvenance
        result={{
          data: null,
          error: null,
          capability: capabilityFromFilteredRead('itcttmkxdxvwmwcmzmey'),
        }}
        locale="en"
        labels={provenanceLabels}
        capabilityLabels={capabilityLabels}
      />,
    )

    expect(screen.getByText('Unreviewed')).toBeInTheDocument()
    expect(screen.getByText(/unreviewed, not excluded or judged irrelevant/u)).toBeInTheDocument()
    expect(screen.queryByText('Not in Curated — reviewed exclusion')).not.toBeInTheDocument()
  })

  it('shows a reviewed exclusion as reviewed but outside Curated', () => {
    render(
      <LiteratureReviewedProvenance
        result={{
          data: { ...reviewed, reviewedRelevance: 'exclude', curated: false },
          error: null,
          capability: capabilityFromFilteredRead('itcttmkxdxvwmwcmzmey'),
        }}
        locale="en"
        labels={provenanceLabels}
        capabilityLabels={capabilityLabels}
      />,
    )

    expect(screen.getByText('Physician reviewed')).toBeInTheDocument()
    expect(screen.getAllByText('Reviewed exclusion').length).toBeGreaterThan(0)
    expect(screen.getByText('Not in Curated — reviewed exclusion')).toBeInTheDocument()
    expect(screen.queryByText('Unreviewed')).not.toBeInTheDocument()
  })

  it('renders unavailable provenance as a capability state without a zero', () => {
    const capability = capabilityFromFailure(
      { code: 'PGRST204' },
      { projectRef: 'itcttmkxdxvwmwcmzmey', surface: 'foundation' },
    )
    const { container } = render(
      <LiteratureReviewedProvenance
        result={{ data: null, error: capability.message, capability }}
        locale="en"
        labels={provenanceLabels}
        capabilityLabels={capabilityLabels}
      />,
    )

    expect(
      container.querySelector('[data-capability-state="temporarily_unavailable"]'),
    ).not.toBeNull()
    expect(screen.getByText('Reviewed provenance is unavailable')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\b0\b/u)
  })

  it('shows class, provenance, and Draft as textual badges on each result', () => {
    render(<CuratedLiteratureResultCard labels={resultLabels} locale="en" result={article} />)

    expect(screen.getByText('Synthetic physician-reviewed article')).toBeInTheDocument()
    expect(screen.getByText('Physician reviewed')).toBeInTheDocument()
    expect(screen.getByText('Core IP')).toBeInTheDocument()
    expect(screen.getByText('Physician-confirmed enrichment')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Synthetic physician-reviewed article' }),
    ).toHaveAttribute('href', '/admin/literature/article/12345678?from=curated')
  })

  it('keeps the collection navigation and result card accessible', async () => {
    const { container } = render(
      <>
        <LiteratureAdminCollectionNav
          active="curated"
          labels={{
            all: 'All Literature',
            curated: 'Curated',
            navigation: 'Literature administration collections',
          }}
        />
        <CuratedLiteratureResultCard labels={resultLabels} locale="en" result={article} />
      </>,
    )

    expect(screen.getByRole('link', { name: 'Curated' })).toHaveAttribute('aria-current', 'page')
    expect(await axe(container)).toHaveNoViolations()
  })
})
