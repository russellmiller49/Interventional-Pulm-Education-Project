'use client'
import { useEffect, useState } from 'react'

/**
 * An image shown without its address. The teaching library files its stills by station
 * (`/media/stations/4L/…`), so an image element pointing at one names the station to anyone who
 * opens it in a new tab or reads the page source. Where a check asks for the station, the picture
 * is fetched and shown from an object URL instead, as the practice cases' CT already was.
 */
export function useHiddenImage(path: string | undefined) {
  const [state, setState] = useState<{ path?: string; url: string; failed: boolean }>({
    url: '',
    failed: false,
  })
  useEffect(() => {
    if (!path) return
    let disposed = false,
      objectUrl = ''
    const controller = new AbortController()
    const fail = () => {
      if (!disposed) setState({ path, url: '', failed: true })
    }
    if (typeof fetch !== 'function') {
      fail()
      return
    }
    fetch(path, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('image unavailable')
        return response.blob()
      })
      .then((blob) => {
        if (disposed) return
        objectUrl = URL.createObjectURL(blob)
        setState({ path, url: objectUrl, failed: false })
      })
      .catch(fail)
    return () => {
      disposed = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])
  // A result for an earlier path is not this path's.
  return state.path === path ? state : { url: '', failed: false }
}
