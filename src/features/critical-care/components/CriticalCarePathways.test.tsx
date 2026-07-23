import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import type { CriticalCareProgressReadResult } from '../progress/types'
import { CriticalCarePathwayDetail, CriticalCarePathwaysIndex } from './CriticalCarePathways'

const mockReadMergedCriticalCareProgress = jest.fn<CriticalCareProgressReadResult, []>()
const catalog = buildCriticalCarePublicClientCatalog()

jest.mock('../progress/publicClient', () => ({
  readPublicCriticalCareProgress: () => mockReadMergedCriticalCareProgress(),
}))

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

describe('critical-care clinical pathways', () => {
  beforeEach(() => {
    mockReadMergedCriticalCareProgress.mockReturnValue({
      envelope: { version: 1, activities: [], updatedAt: '1970-01-01T00:00:00.000Z' },
      normalizedSource: {
        moduleId: 'critical-care',
        storageKey: 'critical-care-activity-progress-v1',
        status: 'empty',
      },
      legacySources: [],
      notices: [],
    })
  })

  it('keeps practice open and links every catalog pathway', async () => {
    render(<CriticalCarePathwaysIndex catalog={catalog} />)

    expect(
      screen.getByRole('heading', { name: 'Build connected critical-care skills' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Preparation is recommended, not required, for Practice/),
    ).toBeInTheDocument()
    expect(await screen.findAllByText(/0 of \d+ module milestones complete/)).toHaveLength(5)
    expect(screen.getAllByRole('link', { name: /^Explore / })).toHaveLength(5)
  })

  it('shows module milestones, reviewed recommendation, competencies, and explainable Assess gates', async () => {
    const pathway = catalog.pathways.find((item) => item.id === 'cardiogenic-and-rv-shock')!
    render(<CriticalCarePathwayDetail catalog={catalog} pathway={pathway} />)

    expect(screen.getByRole('heading', { name: pathway.title })).toBeInTheDocument()
    expect(
      (await screen.findByRole('link', { name: 'Open activity' })).getAttribute('href'),
    ).toMatch(/^\/icu-hemodynamics\//)
    expect(screen.getByRole('heading', { name: 'Module milestones' })).toBeInTheDocument()
    expect(screen.getByText(/Practice remains open to experienced learners/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Advanced cross-system capstones' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Practice course' })).not.toBeInTheDocument()
    expect(screen.queryByText('LV cardiogenic shock with pulmonary edema')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Advanced assessment remains release-gated' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Explicit assessment prerequisites' }),
    ).toBeInTheDocument()
  })
})
