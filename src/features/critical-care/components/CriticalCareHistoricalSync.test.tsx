import { render, waitFor } from '@testing-library/react'
import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareAccountSync } from './CriticalCareAccountSync'
import { CriticalCareRestrictedAccountSync } from './CriticalCareRestrictedAccountSync'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'
import {
  masteredLegacyProgressFixtures,
  partialLegacyProgressFixtures,
} from '../progress/__fixtures__/legacyProgress'

const mockGetUser = jest.fn(async () => ({ data: { user: { id: 'learner' } }, error: null }))

jest.mock('@/lib/supabase/browser', () => ({
  hasSupabaseBrowserConfig: () => true,
  supabaseCookieBrowser: () => ({
    auth: {
      getUser: () => mockGetUser(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  }),
}))

const now = '2026-09-14T12:00:00.000Z'

describe('real public and restricted account hydration with historical HD/ECMO/MCS/MV/CRRT data', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
  })

  it.each(['public', 'restricted'])(
    '%s mount does not rewrite historical bytes or POST completion',
    async (surface) => {
      localStorage.clear()
      mockGetUser.mockClear()
      localStorage.setItem(
        'critical-care-account-sync-ownership-v1',
        JSON.stringify({ version: 1, accountId: 'learner' }),
      )
      for (const key of [
        'icu-hemodynamics-progress-v2',
        'cardiohelp-ecmo-progress-v1',
        'interventionalpulm:mcs-progress:v1',
        'mechanical-ventilation-progress-v2',
        'baxter-crrt-progress-v3',
      ]) {
        const historical = { ...partialLegacyProgressFixtures, ...masteredLegacyProgressFixtures }[
          key
        ]
        expect(historical).toBeDefined()
        localStorage.setItem(key, `\n ${historical} \n`)
      }
      localStorage.setItem(
        CRITICAL_CARE_PROGRESS_STORAGE_KEY,
        JSON.stringify(
          {
            version: 1,
            activities: [
              'hemodynamics:practice:HD-01',
              'ecmo:assess:vv-off-sweep-capstone',
              'mcs:assess:CAP-IMP-01',
              'ventilation:practice:MV-01',
              'crrt:assess:MASTERY-PRISMAX-01',
            ].map((activityId) => ({
              activityId,
              status: 'mastered',
              attempts: 3,
              bestScore: 100,
              competencyEvidenceIds: [],
              updatedAt: now,
            })),
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
          modules: [
            'icu-hemodynamics',
            'cardiohelp-ecmo',
            'mechanical-circulatory-support',
            'mechanical-ventilation',
            'baxter-crrt',
          ].map((moduleId) => ({
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
      await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(2))
      expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual(['GET'])
      expect({ ...localStorage }).toEqual(before)
      unmount()
    },
  )
})
