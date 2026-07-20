'use client'

import { useSyncExternalStore } from 'react'

let webglSupportCache: boolean | null = null

function detectWebGLSupport(): boolean {
  if (webglSupportCache !== null) return webglSupportCache
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    webglSupportCache = Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    )
  } catch {
    webglSupportCache = false
  }
  return webglSupportCache
}

const subscribeNever = () => () => {}

export function useWebGLSupport(): boolean {
  return useSyncExternalStore(subscribeNever, detectWebGLSupport, () => false)
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

function reducedMotionSnapshot() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  )
}

export function useReducedMotionPreference(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => true)
}
