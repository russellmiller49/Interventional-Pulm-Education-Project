'use client'

import { useEffect, useState } from 'react'

/**
 * Run a figure's pure computation once its data has loaded, off the render: the step paints first,
 * with the figure saying it is being prepared, and the pixels arrive a moment later. A timer rather
 * than an animation frame, so a hidden tab still finishes. Same input, same result.
 */
export function useFigureComputation<I extends object, T>(
  input: I | null,
  compute: (input: I) => T,
): T | null {
  const [result, setResult] = useState<{ readonly input: I; readonly value: T } | null>(null)
  useEffect(() => {
    if (!input) return
    let active = true
    const timer = setTimeout(() => {
      const value = compute(input)
      if (active) setResult({ input, value })
    }, 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [input, compute])
  return result && result.input === input ? result.value : null
}
