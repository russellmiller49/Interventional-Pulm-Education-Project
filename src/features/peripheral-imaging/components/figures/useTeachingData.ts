'use client'

import { useEffect, useState } from 'react'

import { loadAnatomyVolume } from '../../lib/anatomy'

export type TeachingDataState = 'loading' | 'ready' | 'failed'

/**
 * The course's teaching CT, for a static figure. The loader is shared and cached, so a figure beside
 * the suite does not download it twice. A figure that cannot load
 * says so; it never draws a placeholder that could be mistaken for the model.
 */
function useLoaded<T>(load: () => Promise<T>): {
  readonly data: T | null
  readonly state: TeachingDataState
} {
  const [result, setResult] = useState<{ data: T | null; state: TeachingDataState }>({
    data: null,
    state: 'loading',
  })
  useEffect(() => {
    let active = true
    // The loaders reject asynchronously; a synchronous throw (no fetch at all) is a failure too.
    Promise.resolve()
      .then(load)
      .then(
        (data) => {
          if (active) setResult({ data, state: 'ready' })
        },
        () => {
          if (active) setResult({ data: null, state: 'failed' })
        },
      )
    return () => {
      active = false
    }
  }, [load])
  return result
}

export function useTeachingVolume() {
  return useLoaded(loadAnatomyVolume)
}
