'use client'

import { useEffect } from 'react'

import { CRITICAL_CARE_PROGRESS_CHANGED_EVENT } from '@/features/learning-module/activity/progress'
import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity/types'
import { hasSupabaseBrowserConfig, supabaseCookieBrowser } from '@/lib/supabase/browser'

const SYNC_DEBOUNCE_MS = 400

export function CriticalCareAccountSync({
  activities,
}: {
  readonly activities: readonly CriticalCareActivityDefinition[]
}) {
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
        { readPublicCriticalCareProgress },
        { readCriticalCareProgress, writeCriticalCareProgress },
        {
          claimPublicCriticalCareAccountSyncOwnership,
          getPublicCriticalCareCoarseProgress,
          hydratePublicCriticalCareCoarseProgress,
          mergeCriticalCareSubsetProgress,
          projectPublicCriticalCareCoarseProgress,
          postPublicCriticalCareCoarseProgress,
        },
      ] = await Promise.all([
        import('@/features/critical-care/progress/publicClient'),
        import('@/features/learning-module/activity/progress'),
        import('@/features/critical-care/progress/publicAccountSync'),
      ])
      if (!active) return
      if (claimPublicCriticalCareAccountSyncOwnership(window.localStorage, user.id) === 'blocked') {
        return
      }

      const mergedProgress = readPublicCriticalCareProgress(activities, window.localStorage)
      let progress = mergedProgress.envelope
      const accountProgress = await getPublicCriticalCareCoarseProgress(user.id, activities)
      if (!active) return

      // Bind reads and writes to the same authenticated account even if an auth
      // event fires while the network request is in flight.
      const {
        data: { user: currentUser },
        error: currentUserError,
      } = await supabaseCookieBrowser().auth.getUser()
      if (!active || currentUserError || currentUser?.id !== user.id) return

      if (accountProgress) {
        const hydrated = hydratePublicCriticalCareCoarseProgress(
          progress,
          accountProgress,
          activities,
        )
        if (JSON.stringify(hydrated) !== JSON.stringify(progress)) {
          const fullEnvelope = readCriticalCareProgress(window.localStorage)
          const reconciled = mergeCriticalCareSubsetProgress(fullEnvelope, hydrated)
          if (writeCriticalCareProgress(window.localStorage, reconciled)) progress = hydrated
        }
      }

      const batch = projectPublicCriticalCareCoarseProgress(progress, activities)
      if (!batch) return

      const serialized = `${user.id}:${JSON.stringify(batch)}`
      if (serialized === lastSyncedPayload) return

      const {
        data: { user: postingUser },
        error: postingUserError,
      } = await supabaseCookieBrowser().auth.getUser()
      if (!active || postingUserError || postingUser?.id !== user.id) return
      if (await postPublicCriticalCareCoarseProgress(batch, user.id, activities)) {
        lastSyncedPayload = serialized
      }
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
  }, [activities])

  return null
}
