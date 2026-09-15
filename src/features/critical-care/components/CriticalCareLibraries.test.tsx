import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { criticalCareActivities } from '../content/activities'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity/progress'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareCasesLibrary } from './CriticalCareCasesLibrary'
import { CriticalCareLabsLibrary } from './CriticalCareLabsLibrary'
import { AssumedConceptStrip } from './AssumedConceptStrip'
import { CriticalCareProgressView } from './CriticalCareProgressView'

const catalog = buildCriticalCarePublicClientCatalog()

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

describe('critical-care global libraries', () => {
  it('filters stable practice and applied-case deep links', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), {
      target: { value: 'icu-hemodynamics' },
    })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'practice-case' },
    })
    expect(screen.getByText('9 activities')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'The numbers do not fit the patient' }),
    ).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'Open activity' })
    expect(links).toHaveLength(9)
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/icu-hemodynamics\/practice\?case=HD-/),
    )
  })

  it('lists focused draft/preview labs while withholding private-development modules', () => {
    render(<CriticalCareLabsLibrary catalog={catalog} />)
    const labLinks = screen.getAllByRole('link', { name: 'Open full lab' })
    expect(labLinks).toHaveLength(5)
    expect(labLinks.map((link) => link.getAttribute('href'))).toContain('/cardiohelp-ecmo')
    expect(
      screen.queryByRole('heading', { name: 'Integrated ICU Simulator' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ECMO Management' })).toBeInTheDocument()
    expect(
      screen.getByText(/retain their existing draft or preview release gates/i),
    ).toBeInTheDocument()
  })

  it('keeps applied-case identities visible and preserves direct case links', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), {
      target: { value: 'icu-hemodynamics' },
    })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'practice-case' },
    })

    expect(
      screen.getByRole('heading', {
        name: 'HD-07 pressure-equalization applied case',
      }),
    ).toBeInTheDocument()
    const appliedCase = screen
      .getByRole('heading', { name: 'HD-07 pressure-equalization applied case' })
      .closest('li')!
    expect(within(appliedCase).getByRole('link', { name: 'Open activity' })).toHaveAttribute(
      'href',
      '/icu-hemodynamics/assess?start=1',
    )
  })

  it.each(['hemodynamics:practice:HD-01', 'ecmo:assess:vv-off-sweep-capstone'])(
    'does not turn historical %s into a current visit, review suggestion, or resume',
    async (activityId) => {
      const activity = criticalCareActivities.find((item) => item.id === activityId)!
      const historical = JSON.stringify(
        {
          version: 1,
          activities: [
            {
              activityId,
              status: 'mastered',
              bestScore: 99,
              attempts: 5,
              hintCount: 2,
              competencyEvidenceIds: [],
              updatedAt: '2026-09-14T12:00:00.000Z',
            },
          ],
          resume: {
            activityId,
            pathname: activity.pathname,
            query: activity.query,
            mode: activity.supportedModes[0],
            phase: 'explain',
            payloadVersion: 'historical-v1',
            updatedAt: '2026-09-14T12:00:00.000Z',
          },
          updatedAt: '2026-09-14T12:00:00.000Z',
        },
        null,
        2,
      )
      localStorage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, historical)
      // Include ECMO explicitly to check the guard even with a full catalog consumer.
      render(
        <>
          <CriticalCareProgressView catalog={{ ...catalog, activities: criticalCareActivities }} />
          <AssumedConceptStrip
            activityId="mcs:practice:IMP-01"
            conceptIds={activity.teachesConceptIds}
          />
        </>,
      )
      expect(await screen.findByRole('button', { name: 'Export JSON' })).toBeEnabled()
      expect(screen.queryByText(activity.title)).not.toBeInTheDocument()
      expect(screen.queryByText('Worked through')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /Pick up where you left off/ }),
      ).not.toBeInTheDocument()
      expect(screen.getByText('Nothing is calling for a revisit.')).toBeInTheDocument()
      expect(document.querySelector('[data-engaged]')).toBeNull()
      expect(screen.queryByText(/You saw .*same thread/)).not.toBeInTheDocument()
      expect(
        document.querySelector('[aria-labelledby="concept-history"] ul')?.children,
      ).toHaveLength(0)
      expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(historical)
      localStorage.clear()
    },
  )

  it('presents personal history without grading-style progress', async () => {
    render(<CriticalCareProgressView catalog={catalog} />)

    expect(await screen.findByRole('heading', { name: 'Where you have been' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete local history' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/% complete/i)).not.toBeInTheDocument()
  })
})
