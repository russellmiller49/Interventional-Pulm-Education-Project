'use client'
import { useEffect, useRef } from 'react'
import { loadAnatomyVolume, sampleAnatomy } from '../lib/anatomy'
import { LESION_CENTER, type Point3 } from '../lib/physics'

export function CTSlice({
  plane,
  position,
  slab,
}: {
  plane: 'Axial' | 'Coronal' | 'Sagittal'
  position: number
  slab: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    loadAnatomyVolume()
      .then((volume) => {
        if (cancelled || !canvas.current) return
        const ctx = canvas.current.getContext('2d')
        if (!ctx) return
        const data = ctx.createImageData(220, 225)
        for (let row = 0; row < 225; row++)
          for (let col = 0; col < 220; col++) {
            const u = (col - 110) / 4.1,
              v = (110 - row) / 4.1
            let hu = -1100
            for (let depth = slab ? -60 : position; depth <= (slab ? 42 : position); depth += 3) {
              const local: Point3 =
                plane === 'Axial'
                  ? [u, v, depth]
                  : plane === 'Coronal'
                    ? [u, depth, v]
                    : [depth, -u, v]
              hu = Math.max(
                hu,
                sampleAnatomy(volume, local.map((n, i) => n + LESION_CENTER[i]) as Point3),
              )
            }
            const gray = Math.max(0, Math.min(255, ((hu + 1350) / 1500) * 255))
            const index = (row * 220 + col) * 4
            data.data[index] = data.data[index + 1] = data.data[index + 2] = gray
            data.data[index + 3] = 255
          }
        ctx.putImageData(data, 0, 0)
        canvas.current.dataset.ctState = 'ready'
      })
      .catch(() => {
        if (canvas.current) canvas.current.dataset.ctState = 'failed'
      })
    return () => {
      cancelled = true
    }
  }, [plane, position, slab])
  return <canvas ref={canvas} width={220} height={225} aria-hidden="true" data-ct-state="loading" />
}
