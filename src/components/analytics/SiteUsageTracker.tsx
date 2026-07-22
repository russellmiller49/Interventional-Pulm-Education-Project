'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import { postSiteAnalytics, resolveSiteModuleId } from '@/lib/analytics'

const HEARTBEAT_INTERVAL_MS = 30_000
const GENERIC_LIFECYCLE_EXCLUDED_MODULE_IDS = new Set(['baxter-crrt', 'icu-simulation'])

function makeSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function SiteUsageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) {
      return
    }

    const routePath = pathname
    const moduleId = resolveSiteModuleId(routePath)

    if (!moduleId || GENERIC_LIFECYCLE_EXCLUDED_MODULE_IDS.has(moduleId)) {
      return
    }

    const trackedModuleId = moduleId
    const sessionId = makeSessionId()
    let activeStartedAt = document.visibilityState === 'visible' ? Date.now() : null
    let activeMs = 0
    let ended = false

    function captureActiveTime() {
      if (activeStartedAt === null) {
        return
      }

      activeMs += Date.now() - activeStartedAt
      activeStartedAt = null
    }

    function currentDurationSeconds() {
      const visibleMs = activeStartedAt === null ? 0 : Date.now() - activeStartedAt
      return Math.max(0, Math.round((activeMs + visibleMs) / 1000))
    }

    function send(
      eventType: 'session_end' | 'session_heartbeat' | 'session_start',
      beacon = false,
    ) {
      postSiteAnalytics(
        {
          durationSeconds: currentDurationSeconds(),
          eventType,
          moduleId: trackedModuleId,
          routePath,
          sessionId,
        },
        { beacon },
      )
    }

    function endSession(beacon = true) {
      if (ended) {
        return
      }

      captureActiveTime()
      ended = true
      send('session_end', beacon)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        captureActiveTime()
        send('session_heartbeat', true)
        return
      }

      if (!ended && activeStartedAt === null) {
        activeStartedAt = Date.now()
      }
    }

    send('session_start')

    const heartbeatId = window.setInterval(() => {
      if (!ended && document.visibilityState === 'visible') {
        send('session_heartbeat')
      }
    }, HEARTBEAT_INTERVAL_MS)

    function handlePageHide() {
      endSession(true)
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(heartbeatId)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      endSession(true)
    }
  }, [pathname])

  return null
}
