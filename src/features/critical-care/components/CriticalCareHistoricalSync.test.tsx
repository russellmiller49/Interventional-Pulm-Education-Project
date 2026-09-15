import { render, waitFor } from '@testing-library/react'
import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareAccountSync } from './CriticalCareAccountSync'
import { CriticalCareRestrictedAccountSync } from './CriticalCareRestrictedAccountSync'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'
import { masteredLegacyProgressFixtures } from '../progress/__fixtures__/legacyProgress'

jest.mock('@/lib/supabase/browser', () => ({
  hasSupabaseBrowserConfig: () => true,
  supabaseCookieBrowser: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'learner' } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  }),
}))

const now = '2026-09-14T12:00:00.000Z'

describe('real public and restricted account hydration with historical HD/ECMO data', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
  })

  it.each(['public', 'restricted'])(
    '%s mount does not rewrite historical bytes or POST completion',
    async (surface) => {
      localStorage.clear()
      localStorage.setItem(
        'critical-care-account-sync-ownership-v1',
        JSON.stringify({ version: 1, accountId: 'learner' }),
      )
      for (const key of ['icu-hemodynamics-progress-v2', 'cardiohelp-ecmo-progress-v1']) {
        localStorage.setItem(key, `\n ${masteredLegacyProgressFixtures[key]} \n`)
      }
      localStorage.setItem(
        CRITICAL_CARE_PROGRESS_STORAGE_KEY,
        JSON.stringify(
          {
            version: 1,
            activities: ['hemodynamics:practice:HD-01', 'ecmo:assess:vv-off-sweep-capstone'].map(
              (activityId) => ({
                activityId,
                status: 'mastered',
                attempts: 3,
                bestScore: 100,
                competencyEvidenceIds: [],
                updatedAt: now,
              }),
            ),
            updatedAt: now,
          },
          null,
          2,
        ),
      )
      const before = { ...localStorage }
      const fetcher = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          accountId: 'learner',
          modules: ['icu-hemodynamics', 'cardiohelp-ecmo'].map((moduleId) => ({
            moduleId,
            percentComplete: 100,
            completedSections: ['learn', 'practice', 'assess'],
            completedAt: now,
            lastVisitedAt: now,
          })),
        }),
      })
      global.fetch = fetcher
      const { unmount } = render(
        surface === 'public' ? (
          <CriticalCareAccountSync activities={buildCriticalCarePublicClientCatalog().activities} />
        ) : (
          <CriticalCareRestrictedAccountSync />
        ),
      )
      await waitFor(() => expect(fetcher).toHaveBeenCalled(), { timeout: 3000 })
      // Let the actual hydration, reconciliation, and projection continuation finish.
      await waitFor(() => expect(fetcher.mock.results[0]?.type).toBe('return'))
      expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual(['GET'])
      expect({ ...localStorage }).toEqual(before)
      unmount()
    },
  )
})
