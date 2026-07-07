'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Shared in-scene VR widgets (headset has no DOM, so buttons and labels are
 * meshes with canvas-texture faces). Used by both the spatial correlation scene
 * and the "Bronch Quest VR" game layer.
 */

/** In-scene button (plane + label). `repeat` holds-to-repeat via pointer capture + an interval. */
export function XrButton({
  label,
  position,
  size,
  primary = false,
  accent,
  repeat = false,
  onTrigger,
}: {
  label: string
  position: [number, number, number]
  size: [number, number]
  primary?: boolean
  /** Optional highlight color for the outline (defaults to cyan/blue by `primary`). */
  accent?: string
  repeat?: boolean
  onTrigger: () => void
}) {
  const heldRef = useRef(false)
  const accumRef = useRef(0)
  const triggerRef = useRef(onTrigger)
  useEffect(() => {
    triggerRef.current = onTrigger
  })

  useFrame((_, delta) => {
    if (!repeat || !heldRef.current) return
    accumRef.current += delta
    while (accumRef.current >= 0.11) {
      accumRef.current -= 0.11
      triggerRef.current()
    }
  })

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    triggerRef.current()
    if (repeat) {
      heldRef.current = true
      accumRef.current = 0
    }
  }

  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    heldRef.current = false
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  const bg = primary ? '#0e7490' : '#1e293b'
  const outline = accent ?? (primary ? '#67e8f9' : '#93c5fd')
  return (
    <group
      position={position}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <mesh>
        <planeGeometry args={size} />
        <meshBasicMaterial color={bg} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[size[0] + 0.006, size[1] + 0.006]} />
        <meshBasicMaterial color={outline} opacity={0.35} transparent toneMapped={false} />
      </mesh>
      <XrText
        text={label}
        position={[0, 0, 0.008]}
        width={size[0] * 0.9}
        height={size[1] * 0.7}
        fontSize={48}
      />
    </group>
  )
}

/** Unlit canvas-texture text plane (toneMapped off keeps it bright against ACES tone mapping). */
export function XrText({
  text,
  position,
  width,
  height,
  fontSize = 44,
  color = '#f8fafc',
}: {
  text: string
  position: [number, number, number]
  width: number
  height: number
  fontSize?: number
  color?: string
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = color
      context.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineJoin = 'round'
      context.lineWidth = Math.max(6, Math.round(fontSize * 0.16))
      context.strokeStyle = 'rgba(2, 6, 23, 0.9)'
      context.strokeText(text, canvas.width / 2, canvas.height / 2, canvas.width - 48)
      context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 48)
    }
    const next = new THREE.CanvasTexture(canvas)
    next.colorSpace = THREE.SRGBColorSpace
    next.anisotropy = 8
    return next
  }, [text, fontSize, color])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}
