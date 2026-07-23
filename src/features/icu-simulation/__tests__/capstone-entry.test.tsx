import { render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import type { CriticalCareProgressReadResult } from '@/features/critical-care/progress/types'

const mockReadMergedCriticalCareProgress = jest.fn<CriticalCareProgressReadResult, []>()
const mockRouterPush = jest.fn()
const mockIcuSimulatorLab = jest.fn(
  (props: {
    mode: string
    locale?: string
    initialScenarioId?: string
    availableScenarioIds?: readonly string[]
    embedded?: boolean
  }) => (
    <div
      data-testid="icu-simulator-lab"
      data-mode={props.mode}
      data-scenario={props.initialScenarioId}
      data-available={props.availableScenarioIds?.join(',')}
      data-embedded={props.embedded || undefined}
    />
  ),
)

jest.mock('@/features/critical-care/progress', () => ({
  readMergedCriticalCareProgress: () => mockReadMergedCriticalCareProgress(),
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
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('../components/IcuSimulatorLab', () => ({
  IcuSimulatorLab: (props: Parameters<typeof mockIcuSimulatorLab>[0]) => mockIcuSimulatorLab(props),
}))

import { IcuCapstoneEntry } from '../components/IcuCapstoneEntry'

const NOW = '2026-07-22T12:00:00.000Z'

function progressResult(activityIds: readonly string[] = []): CriticalCareProgressReadResult {
  return {
    envelope: {
      version: 1,
      activities: activityIds.map((activityId) => ({
        activityId,
        status: 'completed' as const,
        attempts: 1,
        competencyEvidenceIds: [],
        updatedAt: NOW,
      })),
      updatedAt: NOW,
    },
    normalizedSource: {
      moduleId: 'critical-care',
      storageKey: 'critical-care-activity-progress-v1',
      status: activityIds.length > 0 ? 'valid' : 'empty',
    },
    legacySources: [],
    notices: [],
  }
}

describe('integrated ICU capstone entry', () => {
  beforeEach(() => mockRouterPush.mockReset())

  beforeEach(() => {
    mockReadMergedCriticalCareProgress.mockReturnValue(progressResult())
    mockIcuSimulatorLab.mockClear()
  })

  it('keeps Practice open with a soft warning and direct refresher links', async () => {
    render(<IcuCapstoneEntry mode="practice" locale="en" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-scenario',
      'septic-ards-aki',
    )
    expect(screen.getByTestId('icu-simulator-lab')).toHaveAttribute('data-embedded', 'true')
    expect(
      screen.getByTestId('icu-simulator-lab').closest('[data-icu-capstone-active]'),
    ).toHaveAttribute('data-icu-capstone-active', 'practice')
    expect(screen.getByText(/Practice remains open to experienced learners/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Warm shock with a low diastolic pressure/ }),
    ).toHaveAttribute('href', '/icu-hemodynamics/practice?case=HD-02')
  })

  it('keeps the capstone mobile gate pointed at the ICU Overview text alternative', async () => {
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 })

    const rendered = render(<IcuCapstoneEntry mode="practice" locale="en" />)
    try {
      expect(
        await screen.findByRole('heading', { name: 'A larger screen is recommended' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open lightweight alternative' })).toHaveAttribute(
        'href',
        '/icu-simulation',
      )
      expect(screen.queryByTestId('icu-simulator-lab')).not.toBeInTheDocument()
    } finally {
      rendered.unmount()
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalWidth,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: originalHeight,
      })
    }
  })

  it('visibly changes the Practice recommendation after focused completion', async () => {
    mockReadMergedCriticalCareProgress.mockReturnValue(
      progressResult(['hemodynamics:practice:HD-03', 'mcs:practice:IMP-03']),
    )

    render(<IcuCapstoneEntry mode="practice" locale="en" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-scenario',
      'lv-cardiogenic',
    )
    expect(
      screen.getByRole('heading', { name: 'LV cardiogenic shock with pulmonary edema' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Focused preparation complete.', { exact: false })).toBeInTheDocument()
  })

  it('explains an unmet Assess gate without mounting the simulation', async () => {
    render(<IcuCapstoneEntry mode="assess" locale="en" requestedScenarioId="lv-cardiogenic" />)

    expect(
      await screen.findByRole('heading', {
        name: 'Assessment case 02 needs more preparation',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('icu-simulator-lab')).not.toBeInTheDocument()
    expect(screen.getAllByText(/Complete one focused MCS case/).length).toBeGreaterThan(0)
    expect(screen.queryByText('LV cardiogenic shock with pulmonary edema')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open unrestricted Practice/ })).toHaveAttribute(
      'href',
      '/icu-simulation/practice',
    )
  })

  it('mounts only verified Assess cases and passes no focused raw state', async () => {
    mockReadMergedCriticalCareProgress.mockReturnValue(
      progressResult(['hemodynamics:practice:HD-03', 'mcs:practice:IMP-03']),
    )

    render(<IcuCapstoneEntry mode="assess" locale="en" requestedScenarioId="lv-cardiogenic" />)

    expect(await screen.findByTestId('icu-simulator-lab')).toHaveAttribute(
      'data-available',
      'lv-cardiogenic',
    )
    await waitFor(() => expect(mockIcuSimulatorLab).toHaveBeenCalledTimes(1))
    expect(mockIcuSimulatorLab.mock.calls[0]?.[0]).toEqual({
      mode: 'assess',
      locale: 'en',
      initialScenarioId: 'lv-cardiogenic',
      availableScenarioIds: ['lv-cardiogenic'],
      embedded: true,
    })
    expect(JSON.stringify(mockIcuSimulatorLab.mock.calls[0]?.[0])).not.toMatch(
      /activities|waveform|commands|replay|patient|deviceState|focusedState/i,
    )
  })
})
