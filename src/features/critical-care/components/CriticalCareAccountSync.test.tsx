/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react'

import {
  CRITICAL_CARE_PROGRESS_CHANGED_EVENT,
  type CriticalCareActivityDefinition,
} from '@/features/learning-module/activity'
import { hasSupabaseBrowserConfig, supabaseCookieBrowser } from '@/lib/supabase/browser'

import {
  claimPublicCriticalCareAccountSyncOwnership,
  getPublicCriticalCareCoarseProgress,
  hydratePublicCriticalCareCoarseProgress,
  mergeCriticalCareSubsetProgress,
  postPublicCriticalCareCoarseProgress,
  projectPublicCriticalCareCoarseProgress,
} from '../progress/publicAccountSync'
import { CriticalCareAccountSync } from './CriticalCareAccountSync'

const mockReadMergedCriticalCareProgress = jest.fn()
const mockReadCriticalCareProgress = jest.fn()
const mockWriteCriticalCareProgress = jest.fn()
const activities: readonly CriticalCareActivityDefinition[] = [
  {
    id: 'hemodynamics:learn:signal-validation',
    moduleId: 'icu-hemodynamics',
    title: 'Signal validation',
    description: 'Reviewed public activity.',
    kind: 'micro-lesson',
    supportedModes: ['guided'],
    pathname: '/icu-hemodynamics/learn',
    pathwayIds: ['shock-and-perfusion'],
    competencyIds: ['signal-validation'],
    prerequisiteActivityIds: [],
    estimatedMinutes: 10,
    difficulty: 'foundation',
    completionRuleId: 'hemodynamics:completion:learn-existing',
    assetIds: ['hemodynamics-bedside-waveforms'],
    reviewStatus: 'sme-review',
    evidenceIds: ['reviewed-source'],
  },
]

jest.mock('@/lib/supabase/browser', () => ({
  hasSupabaseBrowserConfig: jest.fn(),
  supabaseCookieBrowser: jest.fn(),
}))

jest.mock('@/features/learning-module/activity/progress', () => ({
  CRITICAL_CARE_PROGRESS_CHANGED_EVENT: 'critical-care-progress-changed',
  readCriticalCareProgress: (...args: unknown[]) => mockReadCriticalCareProgress(...args),
  writeCriticalCareProgress: (...args: unknown[]) => mockWriteCriticalCareProgress(...args),
}))

jest.mock('../progress/publicClient', () => ({
  readPublicCriticalCareProgress: (...args: unknown[]) =>
    mockReadMergedCriticalCareProgress(...args),
}))

jest.mock('../progress/publicAccountSync', () => ({
  claimPublicCriticalCareAccountSyncOwnership: jest.fn(),
  getPublicCriticalCareCoarseProgress: jest.fn(),
  hydratePublicCriticalCareCoarseProgress: jest.fn(),
  mergeCriticalCareSubsetProgress: jest.fn(),
  projectPublicCriticalCareCoarseProgress: jest.fn(),
  postPublicCriticalCareCoarseProgress: jest.fn(),
}))

const batch = {
  schemaVersion: 1 as const,
  modules: [
    {
      moduleId: 'icu-hemodynamics' as const,
      percentComplete: 50,
      completedSections: [] as ('learn' | 'practice' | 'assess')[],
      completed: false,
    },
  ],
}

describe('CriticalCareAccountSync', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(hasSupabaseBrowserConfig).mockReset()
    jest.mocked(supabaseCookieBrowser).mockReset()
    jest.mocked(claimPublicCriticalCareAccountSyncOwnership).mockReset()
    jest.mocked(getPublicCriticalCareCoarseProgress).mockReset()
    jest.mocked(hydratePublicCriticalCareCoarseProgress).mockReset()
    jest.mocked(mergeCriticalCareSubsetProgress).mockReset()
    jest.mocked(mergeCriticalCareSubsetProgress).mockImplementation((_full, subset) => subset)
    jest.mocked(projectPublicCriticalCareCoarseProgress).mockReset()
    jest.mocked(postPublicCriticalCareCoarseProgress).mockReset()
    mockReadMergedCriticalCareProgress.mockReset()
    mockReadCriticalCareProgress.mockReset()
    mockReadCriticalCareProgress.mockReturnValue({
      version: 1,
      activities: [],
      updatedAt: '1970-01-01T00:00:00.000Z',
    })
    mockWriteCriticalCareProgress.mockReset()
  })

  afterEach(() => jest.useRealTimers())

  it('does not attempt account access or network sync without configured account infrastructure', () => {
    jest.mocked(hasSupabaseBrowserConfig).mockReturnValue(false)
    render(<CriticalCareAccountSync activities={activities} />)

    act(() => jest.advanceTimersByTime(400))

    expect(supabaseCookieBrowser).not.toHaveBeenCalled()
    expect(postPublicCriticalCareCoarseProgress).not.toHaveBeenCalled()
  })

  it('keeps anonymous progress local', async () => {
    jest.mocked(hasSupabaseBrowserConfig).mockReturnValue(true)
    jest.mocked(supabaseCookieBrowser).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
      },
    } as ReturnType<typeof supabaseCookieBrowser>)
    render(<CriticalCareAccountSync activities={activities} />)

    await act(async () => {
      jest.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(projectPublicCriticalCareCoarseProgress).not.toHaveBeenCalled()
    expect(postPublicCriticalCareCoarseProgress).not.toHaveBeenCalled()
  })

  it('debounces meaningful local writes and synchronizes one allowlisted batch for a signed-in user', async () => {
    jest.mocked(hasSupabaseBrowserConfig).mockReturnValue(true)
    jest.mocked(supabaseCookieBrowser).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
      },
    } as ReturnType<typeof supabaseCookieBrowser>)
    const envelope = { version: 1 as const, activities: [], updatedAt: '2026-07-22T00:00:00.000Z' }
    mockReadMergedCriticalCareProgress.mockReturnValue({
      envelope,
      legacySources: [
        { moduleId: 'cardiohelp-ecmo', status: 'valid', activities: [{ activityId: 'legacy' }] },
      ],
    })
    jest.mocked(claimPublicCriticalCareAccountSyncOwnership).mockReturnValue('claimed')
    jest.mocked(getPublicCriticalCareCoarseProgress).mockResolvedValue(null)
    jest.mocked(projectPublicCriticalCareCoarseProgress).mockReturnValue(batch)
    jest.mocked(postPublicCriticalCareCoarseProgress).mockResolvedValue(true)
    render(<CriticalCareAccountSync activities={activities} />)

    act(() => {
      window.dispatchEvent(new Event(CRITICAL_CARE_PROGRESS_CHANGED_EVENT))
      window.dispatchEvent(new Event(CRITICAL_CARE_PROGRESS_CHANGED_EVENT))
      jest.advanceTimersByTime(400)
    })

    await waitFor(() =>
      expect(postPublicCriticalCareCoarseProgress).toHaveBeenCalledWith(
        batch,
        'user-1',
        activities,
      ),
    )
    expect(projectPublicCriticalCareCoarseProgress).toHaveBeenCalledWith(envelope, activities)
    expect(postPublicCriticalCareCoarseProgress).toHaveBeenCalledTimes(1)
  })

  it('hydrates server section completion locally before projecting the upload', async () => {
    jest.mocked(hasSupabaseBrowserConfig).mockReturnValue(true)
    jest.mocked(supabaseCookieBrowser).mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
      },
    } as ReturnType<typeof supabaseCookieBrowser>)
    const local = {
      version: 1 as const,
      activities: [],
      updatedAt: '2026-07-01T00:00:00.000Z',
    }
    const hydrated = {
      ...local,
      activities: [
        {
          activityId: 'hemodynamics:learn:signal-validation',
          status: 'completed' as const,
          attempts: 0,
          competencyEvidenceIds: [],
          updatedAt: '2026-07-22T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-07-22T00:00:00.000Z',
    }
    const server = { schemaVersion: 1 as const, accountId: 'user-1', modules: [] }
    mockReadMergedCriticalCareProgress.mockReturnValue({ envelope: local, legacySources: [] })
    jest.mocked(claimPublicCriticalCareAccountSyncOwnership).mockReturnValue('owned')
    jest.mocked(getPublicCriticalCareCoarseProgress).mockResolvedValue(server)
    jest.mocked(hydratePublicCriticalCareCoarseProgress).mockReturnValue(hydrated)
    mockWriteCriticalCareProgress.mockReturnValue(true)
    jest.mocked(projectPublicCriticalCareCoarseProgress).mockReturnValue(batch)
    jest.mocked(postPublicCriticalCareCoarseProgress).mockResolvedValue(true)
    render(<CriticalCareAccountSync activities={activities} />)

    await act(async () => {
      jest.advanceTimersByTime(400)
      await Promise.resolve()
    })

    await waitFor(() =>
      expect(mockWriteCriticalCareProgress).toHaveBeenCalledWith(window.localStorage, hydrated),
    )
    expect(projectPublicCriticalCareCoarseProgress).toHaveBeenCalledWith(hydrated, activities)
  })

  it('blocks a second signed-in account from uploading the first account local progress', async () => {
    let accountId = 'user-1'
    let authChange: (() => void) | undefined
    const client = {
      auth: {
        getUser: jest.fn().mockImplementation(async () => ({
          data: { user: { id: accountId } },
          error: null,
        })),
        onAuthStateChange: jest.fn().mockImplementation((callback: () => void) => {
          authChange = callback
          return { data: { subscription: { unsubscribe: jest.fn() } } }
        }),
      },
    }
    jest.mocked(hasSupabaseBrowserConfig).mockReturnValue(true)
    jest
      .mocked(supabaseCookieBrowser)
      .mockReturnValue(client as unknown as ReturnType<typeof supabaseCookieBrowser>)
    mockReadMergedCriticalCareProgress.mockReturnValue({
      envelope: { version: 1, activities: [], updatedAt: '2026-07-22T00:00:00.000Z' },
      legacySources: [],
    })
    jest
      .mocked(claimPublicCriticalCareAccountSyncOwnership)
      .mockImplementation((_storage, candidate) => (candidate === 'user-1' ? 'owned' : 'blocked'))
    jest.mocked(getPublicCriticalCareCoarseProgress).mockResolvedValue(null)
    jest.mocked(projectPublicCriticalCareCoarseProgress).mockReturnValue(batch)
    jest.mocked(postPublicCriticalCareCoarseProgress).mockResolvedValue(true)
    render(<CriticalCareAccountSync activities={activities} />)

    await act(async () => {
      jest.advanceTimersByTime(400)
      await Promise.resolve()
    })
    await waitFor(() => expect(postPublicCriticalCareCoarseProgress).toHaveBeenCalledTimes(1))

    accountId = 'user-2'
    act(() => {
      authChange?.()
      jest.advanceTimersByTime(400)
    })
    await act(async () => Promise.resolve())

    expect(postPublicCriticalCareCoarseProgress).toHaveBeenCalledTimes(1)
    expect(postPublicCriticalCareCoarseProgress).not.toHaveBeenCalledWith(
      batch,
      'user-2',
      activities,
    )
  })
})
