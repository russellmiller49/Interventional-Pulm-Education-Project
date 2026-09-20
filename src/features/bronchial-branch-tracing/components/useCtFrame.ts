'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

/**
 * Which native plane is actually on screen.
 *
 * The viewer asks for a slice; this hook keeps the previously decoded plane
 * visible until every image the new plane needs has reported `load`, then
 * promotes it in one step. Nothing is shown with the wrong slice number: the
 * caller reads `shown` for the pixels and their labels, and `ready` is false
 * while a different plane is still arriving, so overlays stay withheld.
 *
 * No plane is fetched here beyond the one requested and the caller's own
 * bounded neighbour preload; the native stack is never downloaded eagerly.
 */
export interface CtFrameRequest {
  slice: number
  url: string
  patchUrl: string | null
}

const HISTORY_LIMIT = 64
const stamp = (retry: number, url: string) => `${retry} ${url}`

export function useCtFrame(request: CtFrameRequest, retry: number) {
  const [loaded, setLoaded] = useState<Record<string, 'ok' | 'error'>>({})
  const [shown, setShown] = useState<CtFrameRequest | null>(null)
  const order = useRef<string[]>([])
  const report = useCallback(
    (url: string, state: 'ok' | 'error') => {
      const id = stamp(retry, url)
      setLoaded((current) => {
        if (current[id] === state) return current
        const next = { ...current, [id]: state }
        order.current = [...order.current.filter((key) => key !== id), id]
        while (order.current.length > HISTORY_LIMIT) {
          const dropped = order.current.shift()
          if (dropped) delete next[dropped]
        }
        return next
      })
    },
    [retry],
  )
  const urls = useMemo(
    () => (request.patchUrl ? [request.url, request.patchUrl] : [request.url]),
    [request.url, request.patchUrl],
  )
  const states = urls.map((url) => loaded[stamp(retry, url)])
  const failed = states.some((state) => state === 'error')
  const complete = !failed && states.every((state) => state === 'ok')
  const { slice, url, patchUrl } = request
  // Promoting during render, not in an effect: the swap happens before the browser
  // paints, so no frame is ever shown with a slice number that is not its own.
  const key = `${slice} ${url} ${patchUrl ?? ''}`
  const [promoted, setPromoted] = useState<string | null>(null)
  if (complete && promoted !== key) {
    setPromoted(key)
    setShown({ slice, url, patchUrl })
  }
  const ready = Boolean(
    !failed && shown && shown.slice === slice && shown.url === url && shown.patchUrl === patchUrl,
  )
  return {
    /** The plane whose pixels are on screen, or null before the first one loads. */
    shown,
    /** True only when the pixels on screen are the plane that was asked for. */
    ready,
    failed,
    /** True when the requested native image itself failed, as opposed to the nodule patch. */
    baseFailed: loaded[stamp(retry, request.url)] === 'error',
    /** Render the requested plane hidden until it is ready, so it can report load. */
    pending: ready ? null : request,
    report,
  }
}
