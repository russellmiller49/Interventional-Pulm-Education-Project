import { resolveSiteModuleId } from './site-auth/access'

export type SiteAnalyticsEventType =
  | 'module_completed'
  | 'module_interaction'
  | 'module_opened'
  | 'quiz_submitted'
  | 'section_completed'
  | 'session_end'
  | 'session_heartbeat'
  | 'session_start'

export interface SiteAnalyticsPayload {
  durationSeconds?: number
  eventPayload?: Record<string, unknown>
  eventType: SiteAnalyticsEventType
  moduleId: string
  percentComplete?: number
  routePath: string
  section?: string
  sessionId?: string
}

export { resolveSiteModuleId }

export function postSiteAnalytics(payload: SiteAnalyticsPayload, options?: { beacon?: boolean }) {
  if (typeof window === 'undefined') {
    return
  }

  const body = JSON.stringify(payload)

  if (options?.beacon && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon('/api/analytics', blob)
    return
  }

  if (typeof fetch !== 'function') {
    return
  }

  void fetch('/api/analytics', {
    body,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: options?.beacon,
    method: 'POST',
  }).catch(() => {
    // Analytics should never interrupt the learning flow.
  })
}

export function recordSiteModuleEvent(payload: Omit<SiteAnalyticsPayload, 'routePath'>) {
  if (typeof window === 'undefined') {
    return
  }

  postSiteAnalytics({
    ...payload,
    routePath: window.location.pathname,
  })
}
