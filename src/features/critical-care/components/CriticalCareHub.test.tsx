import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import type { CriticalCareProgressReadResult } from '../progress/types'
import { CriticalCareHub } from './CriticalCareHub'

const mockReadMergedCriticalCareProgress = jest.fn<CriticalCareProgressReadResult, []>()
const mockRecordCriticalCareDashboardEvent = jest.fn()
const catalog = buildCriticalCarePublicClientCatalog()

jest.mock('../progress/publicClient', () => ({
  readPublicCriticalCareProgress: () => mockReadMergedCriticalCareProgress(),
}))

jest.mock('../publicAnalytics', () => ({
  recordCriticalCareDashboardEvent: (event: unknown) => mockRecordCriticalCareDashboardEvent(event),
}))

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </a>
  ),
}))

describe('CriticalCareHub', () => {
  beforeEach(() => {
    mockRecordCriticalCareDashboardEvent.mockClear()
    mockReadMergedCriticalCareProgress.mockReturnValue({
      envelope: {
        version: 1,
        activities: [],
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      normalizedSource: {
        moduleId: 'critical-care',
        storageKey: 'critical-care-activity-progress-v1',
        status: 'empty',
      },
      legacySources: [],
      notices: [],
    })
  })

  it('promotes only reviewed modules and gives a new learner one start', async () => {
    render(<CriticalCareHub catalog={catalog} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Critical Care Learning Center' }),
    ).toBeInTheDocument()

    for (const moduleDefinition of catalog.launcherModules) {
      expect(screen.getByRole('link', { name: `Open ${moduleDefinition.title}` })).toHaveAttribute(
        'href',
        moduleDefinition.href,
      )
    }
    expect(screen.queryByRole('link', { name: 'Open CARDIOHELP ECMO' })).not.toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'Start here' })).toHaveAttribute(
      'href',
      '/icu-hemodynamics/learn?activity=pac-signal-validation',
    )
    expect(screen.getByRole('heading', { name: 'Quick launch a lab' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse all cases' })).toHaveAttribute(
      'href',
      '/critical-care/cases',
    )
    expect(screen.getByRole('link', { name: 'Browse lab library' })).toHaveAttribute(
      'href',
      '/critical-care/labs',
    )
    expect(
      screen.getByRole('heading', { name: 'Learn across support systems' }),
    ).toBeInTheDocument()
  })

  it('does not show a sign-in requirement for Baxter CRRT', async () => {
    render(<CriticalCareHub catalog={catalog} />)
    await screen.findByRole('link', { name: 'Start here' })
    expect(screen.queryByText('Sign-in required')).not.toBeInTheDocument()
  })

  it('resumes the exact normalized activity and emits bounded resume analytics', async () => {
    mockReadMergedCriticalCareProgress.mockReturnValue({
      envelope: {
        version: 1,
        activities: [
          {
            activityId: 'hemodynamics:learn:pac-signal-validation',
            status: 'in-progress',
            currentPhase: 'act',
            mode: 'guided',
            attempts: 1,
            competencyEvidenceIds: [],
            updatedAt: '2026-07-22T12:00:00.000Z',
          },
        ],
        resume: {
          activityId: 'hemodynamics:learn:pac-signal-validation',
          pathname: '/icu-hemodynamics/learn',
          query: { activity: 'pac-signal-validation' },
          mode: 'guided',
          phase: 'act',
          checkpointId: 'measurement-chain-checked',
          payloadVersion: 'pac-signal-validation-v1',
          updatedAt: '2026-07-22T12:00:00.000Z',
        },
        updatedAt: '2026-07-22T12:00:00.000Z',
      },
      normalizedSource: {
        moduleId: 'critical-care',
        storageKey: 'critical-care-activity-progress-v1',
        status: 'valid',
      },
      legacySources: [],
      notices: [],
    })

    render(<CriticalCareHub catalog={catalog} />)
    const resume = await screen.findByRole('link', { name: 'Resume activity' })
    expect(resume).toHaveAttribute('href', '/icu-hemodynamics/learn?activity=pac-signal-validation')
    expect(screen.getByText(/Safe checkpoint · Act phase/)).toBeInTheDocument()

    fireEvent.click(resume)
    expect(mockRecordCriticalCareDashboardEvent).toHaveBeenCalledWith({
      interaction: 'critical_care_qualified_start',
      qualification: 'meaningful-interaction',
    })
    expect(mockRecordCriticalCareDashboardEvent).toHaveBeenCalledWith({
      interaction: 'critical_care_resume_selected',
      targetId: 'hemodynamics:learn:pac-signal-validation',
      targetType: 'activity',
    })
  })

  it('shows safe diagnostics without exposing stored payload content', async () => {
    mockReadMergedCriticalCareProgress.mockReturnValue({
      envelope: {
        version: 1,
        activities: [],
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      normalizedSource: {
        moduleId: 'critical-care',
        storageKey: 'critical-care-activity-progress-v1',
        status: 'incompatible',
        issue: 'unsupported-version',
        detectedVersion: '99',
      },
      legacySources: [],
      notices: [
        {
          moduleId: 'critical-care',
          storageKey: 'critical-care-activity-progress-v1',
          status: 'incompatible',
          issue: 'unsupported-version',
          detectedVersion: '99',
        },
      ],
    })

    render(<CriticalCareHub catalog={catalog} />)
    expect(await screen.findByText('Start from a safe catalog entry')).toBeInTheDocument()
    expect(screen.getByText(/Saved-progress diagnostics/)).toBeInTheDocument()
    expect(screen.getByText(/version-mismatched data/i)).toBeInTheDocument()
    expect(screen.queryByText('critical-care-activity-progress-v1')).not.toBeInTheDocument()
  })

  it('records one dashboard view after mounting', async () => {
    render(<CriticalCareHub catalog={catalog} />)
    await waitFor(() =>
      expect(mockRecordCriticalCareDashboardEvent).toHaveBeenCalledWith({
        interaction: 'critical_care_dashboard_viewed',
      }),
    )
  })

  it('records a qualified start after 30 visible seconds without an interaction', () => {
    jest.useFakeTimers()
    const { unmount } = render(<CriticalCareHub catalog={catalog} />)

    act(() => {
      jest.advanceTimersByTime(30_000)
    })

    expect(mockRecordCriticalCareDashboardEvent).toHaveBeenCalledWith({
      interaction: 'critical_care_qualified_start',
      qualification: '30-visible-seconds',
    })
    unmount()
    jest.useRealTimers()
  })
})
