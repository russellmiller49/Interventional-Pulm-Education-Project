'use client'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { WebGLRenderer } from 'three'
const mounts = new WeakMap<WebGLRenderer, number>()
export function WebGLContextGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const generation = (mounts.get(gl) ?? 0) + 1
    mounts.set(gl, generation)
    const lost = (event: Event) => {
      event.preventDefault()
      onContextLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => {
      canvas.removeEventListener('webglcontextlost', lost)
      // Let Strict Mode's immediate effect replay retain the still-mounted renderer.
      queueMicrotask(() => {
        if (mounts.get(gl) === generation) gl.forceContextLoss()
      })
    }
  }, [gl, onContextLost])
  return null
}
