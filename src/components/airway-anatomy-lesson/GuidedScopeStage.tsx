'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'

import { lobeColor } from '@/lib/airway-anatomy-lesson/airway-graph'
import {
  buildAirwayAtlas,
  buildIndex,
  currentScopeSegmentAt,
  frameForTime,
  loadOverlayData,
  loadScopeSegmentOverlayData,
  nearestFrame,
  polygonCentroid,
  shapesAt,
  timeForFrame,
  type AirwayAtlasEntry,
  type OverlayIndex,
} from '@/lib/airway-anatomy-lesson/video-atlas'
import { cn } from '@/lib/cn'

interface VideoFrameMeta {
  mediaTime: number
}
type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameMeta) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

interface GuidedScopeStageProps {
  focusNodeId: string
  playbackRate?: number
  showLabels?: boolean
  className?: string
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawRoundedLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  cssW: number,
  cssH: number,
) {
  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const padX = 7
  const w = ctx.measureText(text).width + padX * 2
  const h = 21
  const clampedX = Math.min(Math.max(x, w / 2 + 3), cssW - w / 2 - 3)
  const clampedY = Math.min(Math.max(y, h / 2 + 3), cssH - h / 2 - 3)
  const rx = clampedX - w / 2
  const ry = clampedY - h / 2
  const radius = 6
  ctx.beginPath()
  ctx.moveTo(rx + radius, ry)
  ctx.arcTo(rx + w, ry, rx + w, ry + h, radius)
  ctx.arcTo(rx + w, ry + h, rx, ry + h, radius)
  ctx.arcTo(rx, ry + h, rx, ry, radius)
  ctx.arcTo(rx, ry, rx + w, ry, radius)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = '#07111f'
  ctx.fillText(text, clampedX, clampedY + 0.5)
}

export function GuidedScopeStage({
  focusNodeId,
  playbackRate = 0.5,
  showLabels = true,
  className,
}: GuidedScopeStageProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [index, setIndex] = useState<OverlayIndex | null>(null)
  const [scopeIndex, setScopeIndex] = useState<OverlayIndex | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [currentScopeSegment, setCurrentScopeSegment] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const indexRef = useRef<OverlayIndex | null>(null)
  const scopeIndexRef = useRef<OverlayIndex | null>(null)
  const actualFrameRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const focusRef = useRef<AirwayAtlasEntry | null>(null)
  const clipEndFrameRef = useRef<number | null>(null)
  const playbackRateRef = useRef(playbackRate)
  const showLabelsRef = useRef(showLabels)
  const currentScopeSegmentKeyRef = useRef<string | null>(null)

  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    scopeIndexRef.current = scopeIndex
  }, [scopeIndex])
  useEffect(() => {
    playbackRateRef.current = playbackRate
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])
  useEffect(() => {
    showLabelsRef.current = showLabels
  }, [showLabels])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      loadOverlayData(controller.signal),
      loadScopeSegmentOverlayData(controller.signal).catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('guided scope-segment overlays failed to load', err)
        }
        return null
      }),
    ])
      .then(([data, scopeData]) => {
        if (controller.signal.aborted) return
        setIndex(buildIndex(data))
        if (scopeData) setScopeIndex(buildIndex(scopeData))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error('guided scope overlays failed to load', err)
          setStatus('error')
        }
      })
    return () => controller.abort()
  }, [])

  const atlas = useMemo(() => (index ? buildAirwayAtlas(index) : null), [index])
  const focus = focusNodeId && atlas ? atlas[focusNodeId] : null
  useEffect(() => {
    focusRef.current = focus ?? null
  }, [focus])

  const meta = index?.meta ?? null

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const idx = indexRef.current
    const entry = focusRef.current
    if (!canvas || !idx || !entry) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    if (cssW === 0 || cssH === 0) return
    const sx = cssW / idx.meta.width
    const sy = cssH / idx.meta.height
    ctx.clearRect(0, 0, cssW, cssH)

    const scopeIdx = scopeIndexRef.current
    const actualFrame = actualFrameRef.current
    if (scopeIdx && actualFrame != null) {
      const scopeFrame = nearestFrame(scopeIdx, actualFrame, scopeIdx.meta.step + 1)
      const scopeSegment = currentScopeSegmentAt(scopeIdx, actualFrame)
      const segmentShape = scopeSegment
        ? shapesAt(scopeIdx, scopeFrame).find((shape) => shape.s === scopeSegment.structIndex)
        : null
      if (scopeSegment && segmentShape) {
        const segmentColor = lobeColor(scopeSegment.structure.lobe)
        const segmentPts = segmentShape.pts
        ctx.beginPath()
        ctx.moveTo(segmentPts[0] * sx, segmentPts[1] * sy)
        for (let i = 1; i < segmentPts.length / 2; i += 1) {
          ctx.lineTo(segmentPts[i * 2] * sx, segmentPts[i * 2 + 1] * sy)
        }
        if (scopeSegment.structure.shape === 'poly') {
          ctx.closePath()
          ctx.fillStyle = hexToRgba(segmentColor, 0.06)
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)'
        ctx.lineWidth = 5
        ctx.stroke()
        ctx.setLineDash([9, 7])
        ctx.strokeStyle = segmentColor
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (entry.structureIndex == null) return
    const shape = shapesAt(idx, frameRef.current).find((item) => item.s === entry.structureIndex)
    if (!shape) return
    const structure = idx.structures[shape.s]
    const color = lobeColor(structure.lobe)
    const pts = shape.pts

    ctx.beginPath()
    ctx.moveTo(pts[0] * sx, pts[1] * sy)
    for (let i = 1; i < pts.length / 2; i += 1) {
      ctx.lineTo(pts[i * 2] * sx, pts[i * 2 + 1] * sy)
    }
    if (structure.shape === 'poly') {
      ctx.closePath()
      ctx.fillStyle = hexToRgba(color, 0.18)
      ctx.fill()
    } else {
      ctx.setLineDash([8, 6])
    }
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.6)'
    ctx.lineWidth = 7
    ctx.stroke()
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.setLineDash([])

    if (showLabelsRef.current) {
      const centroid = polygonCentroid(pts)
      drawRoundedLabel(ctx, structure.short, centroid.x * sx, centroid.y * sy, color, cssW, cssH)
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw()
  }, [draw])

  const syncTo = useCallback(
    (seconds: number) => {
      const idx = indexRef.current
      if (!idx) return
      const frame = frameForTime(idx.meta, seconds)
      actualFrameRef.current = frame
      frameRef.current = nearestFrame(idx, frame, idx.meta.step + 1)

      const scopeSegment = currentScopeSegmentAt(scopeIndexRef.current, frame)
      const scopeSegmentKey = scopeSegment?.structure.key ?? null
      if (scopeSegmentKey !== currentScopeSegmentKeyRef.current) {
        currentScopeSegmentKeyRef.current = scopeSegmentKey
        setCurrentScopeSegment(scopeSegment?.structure.name ?? null)
      }

      draw()

      const clipEnd = clipEndFrameRef.current
      const video = videoRef.current
      if (clipEnd != null && video && !video.paused && frame >= clipEnd) {
        video.pause()
        clipEndFrameRef.current = null
        const still = focusRef.current?.bestFrame
        if (still != null) {
          video.currentTime = timeForFrame(idx.meta, still)
          frameRef.current = nearestFrame(idx, still, idx.meta.step + 1)
          draw()
        }
      }
    },
    [draw],
  )

  useEffect(() => {
    if (status !== 'ready') return
    resizeCanvas()
    const ro = new ResizeObserver(() => resizeCanvas())
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [resizeCanvas, status])

  useEffect(() => {
    if (status !== 'ready') return
    const video = videoRef.current as RVFCVideo | null
    if (!video) return
    let handle = 0
    let raf = 0
    let cancelled = false
    const useRVFC = typeof video.requestVideoFrameCallback === 'function'
    const onRVFC = (_now: number, frameMeta: VideoFrameMeta) => {
      if (cancelled) return
      syncTo(frameMeta.mediaTime)
      handle = video.requestVideoFrameCallback!(onRVFC)
    }
    const onRAF = () => {
      if (cancelled) return
      syncTo(video.currentTime)
      raf = requestAnimationFrame(onRAF)
    }
    if (useRVFC) handle = video.requestVideoFrameCallback!(onRVFC)
    else raf = requestAnimationFrame(onRAF)
    return () => {
      cancelled = true
      if (useRVFC && handle && video.cancelVideoFrameCallback)
        video.cancelVideoFrameCallback(handle)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [status, syncTo])

  const seekToStill = useCallback(() => {
    const idx = indexRef.current
    const video = videoRef.current
    const still = focusRef.current?.bestFrame
    if (!idx || !video || still == null || video.readyState < 1) return
    clipEndFrameRef.current = null
    video.pause()
    video.currentTime = timeForFrame(idx.meta, still)
    syncTo(video.currentTime)
  }, [syncTo])

  const playClip = useCallback(() => {
    const idx = indexRef.current
    const video = videoRef.current
    const entry = focusRef.current
    if (!idx || !video || !entry || entry.clipStartFrame == null || entry.clipEndFrame == null)
      return
    if (video.readyState < 1) return
    clipEndFrameRef.current = entry.clipEndFrame
    video.currentTime = timeForFrame(idx.meta, entry.clipStartFrame)
    video.playbackRate = playbackRateRef.current
    syncTo(video.currentTime)
    void video.play().catch(() => {})
  }, [syncTo])

  useEffect(() => {
    if (!videoReady || !focus) return
    seekToStill()
  }, [focus, seekToStill, videoReady])

  useEffect(() => {
    draw()
  }, [draw, showLabels])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let readyTimer: number | undefined
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onReady = () => setVideoReady(true)
    const onLoaded = () => {
      setVideoReady(true)
      resizeCanvas()
      syncTo(video.currentTime)
    }
    const onSeeked = () => syncTo(video.currentTime)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('loadeddata', onLoaded)
    video.addEventListener('seeked', onSeeked)
    if (video.readyState >= 1) readyTimer = window.setTimeout(onReady, 0)
    return () => {
      if (readyTimer != null) window.clearTimeout(readyTimer)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('seeked', onSeeked)
    }
  }, [resizeCanvas, syncTo])

  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex aspect-[1368/1080] w-full items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        The bronchoscopy video could not be loaded.
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative aspect-[1368/1080] w-full overflow-hidden rounded-2xl border border-border/70 bg-black">
        <video
          ref={videoRef}
          src={meta ? `/airway-lesson/${meta.video}` : undefined}
          poster={meta ? `/airway-lesson/${meta.poster}` : undefined}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            Loading bronchoscopy...
          </div>
        )}

        <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
          Focused still
        </span>

        {currentScopeSegment && (
          <span className="pointer-events-none absolute right-3 top-3 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-slate-200">
            Scope in {currentScopeSegment}
          </span>
        )}

        {focus && focus.coverageNote && (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-black/70 px-3 py-2 text-[11px] leading-4 text-slate-200">
            {focus.coverageNote}
          </p>
        )}

        {focus && !focus.hasVideo && status === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 px-4 text-center text-xs text-white/80">
            No annotated bronchoscopy video frame is available for this branch.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (isPlaying ? videoRef.current?.pause() : playClip())}
          disabled={!focus?.hasVideo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-50"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {isPlaying ? 'Pause clip' : 'Play clip'}
        </button>
        <button
          type="button"
          onClick={seekToStill}
          disabled={!focus?.hasVideo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Return to still
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {playbackRate}x clip speed
        </span>
      </div>
    </div>
  )
}
