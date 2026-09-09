'use client'
import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { loadAnatomyVolume, sampleAnatomy } from '../../lib/anatomy'
import { LESION_CENTER, type Point3 } from '../../lib/physics'
import { Quad } from './SceneGeometry'

export type SlicePlane = 'Axial' | 'Coronal' | 'Sagittal'
/** Slice coordinates match the linked MPR: image-right is x, x, -y respectively. */
export function slicePoint(plane: SlicePlane, u: number, v: number, depth: number): Point3 {
  return plane === 'Axial' ? [u, v, depth] : plane === 'Coronal' ? [u, depth, v] : [depth, -u, v]
}
export function useCtVolume(enabled: boolean) {
  const [volume, setVolume] = useState<Uint8Array | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void loadAnatomyVolume()
      .then((v) => {
        if (active) setVolume(v)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [enabled])
  return volume
}
export function CtQuad({
  volume,
  plane,
  depth = 0,
  points,
  span = 54,
  slab = false,
  opacity = 1,
}: {
  volume: Uint8Array
  plane: SlicePlane
  depth?: number
  points: readonly Point3[]
  span?: number
  slab?: boolean
  opacity?: number
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    const pixels = context.createImageData(128, 128)
    for (let row = 0; row < 128; row++)
      for (let col = 0; col < 128; col++) {
        let hu = -1100
        for (let at = slab ? -60 : depth; at <= (slab ? 42 : depth); at += 3) {
          const local = slicePoint(plane, (col / 128 - 0.5) * span, (0.5 - row / 128) * span, at)
          const point = local.map((n, i) => n + LESION_CENTER[i]) as Point3
          hu = Math.max(hu, sampleAnatomy(volume, point))
        }
        const gray = Math.max(0, Math.min(255, ((hu + 1350) / 1500) * 255))
        const i = (row * 128 + col) * 4
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray
        pixels.data[i + 3] = 255
      }
    context.putImageData(pixels, 0, 0)
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    return result
  }, [volume, plane, depth, span, slab])
  useEffect(() => () => texture.dispose(), [texture])
  return <Quad points={points} color="#ffffff" texture={texture} opacity={opacity} />
}
