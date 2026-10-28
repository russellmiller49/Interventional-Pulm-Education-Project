// Atlas downloads (`/export/…`) are counted per client and overall, in memory on this server: each
// export holds at most 500 articles, and this keeps one client from paging the whole Atlas out.

const WINDOW_MS = 10 * 60 * 1000
const PER_CLIENT = 20
const OVERALL = 300

type Window = { start: number; count: number }
const downloads = new Map<string, Window>()
let overall: Window = { start: 0, count: 0 }

function current(window: Window | undefined, now: number): Window {
  return !window || now - window.start >= WINDOW_MS ? { start: now, count: 0 } : window
}

/** Counts one download for a client: 0 when it may go ahead, otherwise the seconds to wait. */
export function takeDownload(client: string, now = Date.now()): number {
  const mine = current(downloads.get(client), now)
  overall = current(overall, now)
  if (mine.count >= PER_CLIENT || overall.count >= OVERALL) {
    const until = Math.max(
      mine.count >= PER_CLIENT ? mine.start + WINDOW_MS : 0,
      overall.count >= OVERALL ? overall.start + WINDOW_MS : 0,
    )
    return Math.max(1, Math.ceil((until - now) / 1000))
  }
  downloads.set(client, { ...mine, count: mine.count + 1 })
  overall = { ...overall, count: overall.count + 1 }
  if (downloads.size > 5000) {
    for (const [key, value] of downloads) if (now - value.start >= WINDOW_MS) downloads.delete(key)
  }
  return 0
}

export function resetDownloads(): void {
  downloads.clear()
  overall = { start: 0, count: 0 }
}

/** The client address as the host's proxy reports it; the first forwarded address wins. */
export function clientOf(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  )
}

export const DOWNLOAD_LIMITS = { windowMs: WINDOW_MS, perClient: PER_CLIENT, overall: OVERALL }
