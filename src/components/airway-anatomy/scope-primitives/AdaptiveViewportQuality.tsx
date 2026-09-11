'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import { AdaptiveQuality, opticalPixelRatio } from '@/lib/bronchoscopy-core/quality'

/** Lowers the canvas pixel ratio when frames run long, per the bronchoscopy-core quality ladder. */
export function AdaptiveViewportQuality() {
  const { size, setDpr } = useThree(),
    quality = useRef(new AdaptiveQuality())
  useEffect(
    () => setDpr(opticalPixelRatio(size.width, window.devicePixelRatio, quality.current.level)),
    [size.width, setDpr],
  )
  useFrame(() => {
    const changed = quality.current.frame(performance.now())
    if (changed) setDpr(opticalPixelRatio(size.width, window.devicePixelRatio, changed))
  })
  return null
}
