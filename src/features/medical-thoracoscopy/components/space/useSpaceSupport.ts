'use client'

import { useSyncExternalStore } from 'react'

/**
 * What the browser allows the space pane: WebGL, for the 3D scene, and the learner's motion
 * preference. Both are read without a flash of the wrong pane: on the server, and before hydration,
 * there is no WebGL and motion is reduced, the safer of each.
 */
let webglCache: boolean | null = null

function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    webglCache = Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    )
  } catch {
    webglCache = false
  }
  return webglCache
}

const never = () => () => {}

export function useWebGLSupport(): boolean {
  return useSyncExternalStore(never, detectWebGL, () => false)
}

function subscribeMotion(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

function motionReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  )
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, motionReduced, () => true)
}
