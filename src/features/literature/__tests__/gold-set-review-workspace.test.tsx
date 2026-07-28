import { fireEvent, render, screen } from '@testing-library/react'

import { GoldSetReviewWorkspace } from '@/features/literature/components/GoldSetReviewWorkspace'
import type { LiteratureGoldReviewItem } from '@/features/literature/gold-set/types'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

const item: LiteratureGoldReviewItem = {
  id: '00000000-0000-4000-8000-000000000001',
  batchId: '00000000-0000-4000-8000-000000000002',
  batchName: 'pilot-v1',
  batchStatus: 'active',
  displayOrder: 1,
  totalCount: 100,
  completedCount: 0,
  remainingCount: 100,
  reviewStatus: 'pending',
  article: {
    pmid: '12345678',
    title: 'Blinded gold-set fixture',
    abstract: 'A fixture abstract.',
    authors: [{ fullName: 'Example Author', abbreviatedName: 'Author E' }],
    journalTitle: 'Fixture Journal',
    journalAbbreviation: 'Fixture J',
    publicationYear: 2026,
    publicationTypes: ['Journal Article'],
  },
  draft: null,
  currentReview: null,
  reviewHistory: [],
  supplementalMetadataRevealed: false,
  automatedSignalsRevealed: false,
  automatedSignals: null,
  previousItemId: null,
  nextItemId: '00000000-0000-4000-8000-000000000003',
  nextUnresolvedItemId: '00000000-0000-4000-8000-000000000003',
}

describe('gold-set review workspace', () => {
  it('renders a blinded first pass without automated signals', () => {
    render(<GoldSetReviewWorkspace item={item} locale="en" queueSplit="development" />)

    expect(screen.getByText('Blinded gold-set fixture')).toBeInTheDocument()
    expect(screen.getByText('Blinded review')).toBeInTheDocument()
    expect(screen.queryByText('Automated signals')).not.toBeInTheDocument()
    expect(screen.getByText('Reveal MeSH and author keywords')).toBeInTheDocument()
  })

  it('supports keyboard relevance choices and hides categorization for exclusions', () => {
    render(<GoldSetReviewWorkspace item={item} locale="en" queueSplit="development" />)

    fireEvent.keyDown(window, { key: '1' })
    expect(screen.getByText('3. Categorization for included articles')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '3' })
    expect(screen.queryByText('3. Categorization for included articles')).not.toBeInTheDocument()
    expect(screen.getByText('Exclude').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the expanded clinical, study-design, and publication categories', () => {
    render(<GoldSetReviewWorkspace item={item} locale="en" queueSplit="development" />)

    fireEvent.keyDown(window, { key: '1' })

    expect(screen.getByText('Basic bronchoscopy')).toBeInTheDocument()
    expect(screen.getByText('Pleural procedures')).toBeInTheDocument()
    expect(screen.getByText('Multiple/general overview')).toBeInTheDocument()
    expect(screen.getByText('Safety/complication prevention')).toBeInTheDocument()
    expect(screen.getByText('Immune/inflammatory disease')).toBeInTheDocument()
    expect(screen.getAllByText('Not assessable from available metadata')).toHaveLength(3)
    expect(screen.getByRole('option', { name: 'Review article' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Interactive clinical case' })).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /Categorization required full-text review/u }),
    ).toBeInTheDocument()
  })

  it('clears the full-text categorization flag when an article is excluded', () => {
    render(<GoldSetReviewWorkspace item={item} locale="en" queueSplit="development" />)

    fireEvent.keyDown(window, { key: '1' })
    const fullTextCheckbox = screen.getByRole('checkbox', {
      name: /Categorization required full-text review/u,
    })
    fireEvent.click(fullTextCheckbox)
    expect(fullTextCheckbox).toBeChecked()

    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: '1' })
    expect(
      screen.getByRole('checkbox', { name: /Categorization required full-text review/u }),
    ).not.toBeChecked()
  })
})
