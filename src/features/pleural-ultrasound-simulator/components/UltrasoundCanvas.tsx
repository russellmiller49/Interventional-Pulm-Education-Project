'use client'

import { useEffect, useRef } from 'react'

import type { SimulatedPleuralFrame } from '../engine/simulateBMode'

interface UltrasoundCanvasProps {
  frame: SimulatedPleuralFrame | null
  depthCm: number
}

export function UltrasoundCanvas({ frame, depthCm }: UltrasoundCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !frame) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    canvas.width = frame.imageData.width
    canvas.height = frame.imageData.height
    context.putImageData(frame.imageData, 0, 0)
  }, [frame])

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-black shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        <span>Pleural B-mode</span>
        <span>{depthCm.toFixed(1)} cm</span>
      </div>
      <div className="relative bg-black p-3">
        <canvas
          ref={canvasRef}
          aria-label="Synthetic pleural ultrasound image generated from the virtual probe pose"
          className="aspect-[5/6] w-full rounded bg-black [image-rendering:auto]"
        />
        <div className="pointer-events-none absolute right-4 top-12 flex h-[calc(100%-4.5rem)] flex-col justify-between text-[10px] font-medium text-slate-400">
          <span>0</span>
          <span>{(depthCm / 2).toFixed(0)}</span>
          <span>{depthCm.toFixed(0)} cm</span>
        </div>
      </div>
    </div>
  )
}
