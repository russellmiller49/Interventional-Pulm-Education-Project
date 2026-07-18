'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

export function WebGLContextGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      onContextLost()
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost)
  }, [gl, onContextLost])

  return null
}
