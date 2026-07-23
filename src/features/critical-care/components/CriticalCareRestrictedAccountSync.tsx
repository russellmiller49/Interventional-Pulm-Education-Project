'use client'

import { useEffect } from 'react'

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { CRITICAL_CARE_PROGRESS_CHANGED_EVENT } from '@/features/learning-module/activity/progress'
import { hasSupabaseBrowserConfig, supabaseCookieBrowser } from '@/lib/supabase/browser'

const SYNC_DEBOUNCE_MS = 400
const restrictedModuleIds = ['cardiohelp-ecmo', 'icu-simulation'] as const
const restrictedActivities = criticalCareActivities.filter((activity) =>
  restrictedModuleIds.includes(activity.moduleId as (typeof restrictedModuleIds)[number]),
)

/**
 * Mounted only inside source-owned restricted route layouts. This keeps restricted catalog and
 * legacy adapter chunks out of every public Critical Care client graph while preserving authorized
 * learners' established coarse account sync.
 */
export function CriticalCareRestrictedAccountSync() {
  useEffect(() => {
    let active = true
    let timer: number | null = null
    let lastSyncedPayload = ''
    let unsubscribeAuth: (() => void) | undefined

    const schedule = () => {
      if (!active) return
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void syncCurrentProgress()
      }, SYNC_DEBOUNCE_MS)
    }

    const syncCurrentProgress = async () => {
      if (!active || !hasSupabaseBrowserConfig()) return

      const {
        data: { user },
        error,
      } = await supabaseCookieBrowser().auth.getUser()
      if (!active || error || !user) return

      const [
        { readMergedCriticalCareProgress },
        { readCriticalCareProgress, writeCriticalCareProgress },
        {
          claimCriticalCareAccountSyncOwnership,
          getCriticalCareCoarseProgress,
          hydrateCriticalCareCoarseProgress,
          projectCriticalCareCoarseProgress,
          postCriticalCareCoarseProgress,
        },
        { mergeCriticalCareSubsetProgress },
      ] = await Promise.all([
        import('@/features/critical-care/progress'),
        import('@/features/learning-module/activity/progress'),
        import('@/features/critical-care/progress/accountSync'),
        import('@/features/critical-care/progress/publicAccountSync'),
      ])
      if (!active) return
      if (claimCriticalCareAccountSyncOwnership(window.localStorage, user.id) === 'blocked') return

      const mergedProgress = readMergedCriticalCareProgress(
        window.localStorage,
        restrictedActivities,
      )
      let progress = mergedProgress.envelope
      const accountProgress = await getCriticalCareCoarseProgress(user.id)
      if (!active) return

      const {
        data: { user: currentUser },
        error: currentUserError,
      } = await supabaseCookieBrowser().auth.getUser()
      if (!active || currentUserError || currentUser?.id !== user.id) return

      if (accountProgress) {
        const hydrated = hydrateCriticalCareCoarseProgress(
          progress,
          accountProgress,
          restrictedActivities,
        )
        if (JSON.stringify(hydrated) !== JSON.stringify(progress)) {
          const fullEnvelope = readCriticalCareProgress(window.localStorage)
          const reconciled = mergeCriticalCareSubsetProgress(fullEnvelope, hydrated)
          if (writeCriticalCareProgress(window.localStorage, reconciled)) progress = hydrated
        }
      }

      const batch = projectCriticalCareCoarseProgress(
        progress,
        restrictedActivities,
        restrictedModuleIds,
      )
      if (!batch) return

      const serialized = `${user.id}:${JSON.stringify(batch)}`
      if (serialized === lastSyncedPayload) return

      const {
        data: { user: postingUser },
        error: postingUserError,
      } = await supabaseCookieBrowser().auth.getUser()
      if (!active || postingUserError || postingUser?.id !== user.id) return
      if (await postCriticalCareCoarseProgress(batch, user.id)) lastSyncedPayload = serialized
    }

    schedule()
    window.addEventListener(CRITICAL_CARE_PROGRESS_CHANGED_EVENT, schedule)
    if (hasSupabaseBrowserConfig()) {
      try {
        const {
          data: { subscription },
        } = supabaseCookieBrowser().auth.onAuthStateChange(() => {
          lastSyncedPayload = ''
          schedule()
        })
        unsubscribeAuth = () => subscription.unsubscribe()
      } catch {
        // Account infrastructure is optional in local/static previews.
      }
    }
    return () => {
      active = false
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener(CRITICAL_CARE_PROGRESS_CHANGED_EVENT, schedule)
      unsubscribeAuth?.()
    }
  }, [])

  return null
}
