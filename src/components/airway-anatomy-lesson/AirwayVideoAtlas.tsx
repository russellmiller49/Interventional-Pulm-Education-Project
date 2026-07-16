'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react'

import { lobeColor, LOBE_LABELS } from '@/lib/airway-anatomy-lesson/airway-graph'
import type { Lobe } from '@/lib/airway-anatomy-lesson/types'
import {
  ATLAS_CHAPTERS,
  buildIndex,
  currentScopeSegmentAt,
  frameForTime,
  hitTestMarker,
  isAtlasTargetStructure,
  isUpperAirwayStructure,
  loadOverlayData,
  loadScopeSegmentOverlayData,
  makeStructureChoices,
  markersAtFrame,
  nearestFrame,
  shapesAt,
  timeForFrame,
  type OverlayIndex,
  type OverlayStructure,
} from '@/lib/airway-anatomy-lesson/video-atlas'
import { cn } from '@/lib/cn'

interface VideoFrameMeta {
  mediaTime: number
}
type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameMeta) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

interface MarkerQuestion {
  target: number
  choices: number[]
}

const GROUP_ORDER: { key: string; label: string; lobe: Lobe }[] = [
  { key: 'larynx', label: 'Larynx', lobe: 'central' },
  { key: 'central', label: 'Central airways', lobe: 'central' },
  { key: 'RUL', label: LOBE_LABELS.RUL, lobe: 'RUL' },
  { key: 'RML', label: LOBE_LABELS.RML, lobe: 'RML' },
  { key: 'RLL', label: LOBE_LABELS.RLL, lobe: 'RLL' },
  { key: 'LUL', label: LOBE_LABELS.LUL, lobe: 'LUL' },
  { key: 'lingula', label: LOBE_LABELS.lingula, lobe: 'lingula' },
  { key: 'LLL', label: LOBE_LABELS.LLL, lobe: 'LLL' },
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function structureRegionLabel(structure: OverlayStructure): string {
  if (isUpperAirwayStructure(structure)) return 'Upper airway / larynx'
  return LOBE_LABELS[structure.lobe]
}

function drawLabel(
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
  const cx = Math.min(Math.max(x, w / 2 + 3), cssW - w / 2 - 3)
  const cy = Math.min(Math.max(y, h / 2 + 3), cssH - h / 2 - 3)
  const rx = cx - w / 2
  const ry = cy - h / 2
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
  ctx.fillText(text, cx, cy + 0.5)
}

export function AirwayVideoAtlas({
  onOpenStructure,
}: {
  onOpenStructure?: (nodeId: string) => void
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [index, setIndex] = useState<OverlayIndex | null>(null)
  const [scopeIndex, setScopeIndex] = useState<OverlayIndex | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showScopeSegment, setShowScopeSegment] = useState(true)
  const [currentScopeSegment, setCurrentScopeSegment] = useState<OverlayStructure | null>(null)
  const [uiTime, setUiTime] = useState(0)
  const [uiFrame, setUiFrame] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [question, setQuestion] = useState<MarkerQuestion | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const indexRef = useRef<OverlayIndex | null>(null)
  const scopeIndexRef = useRef<OverlayIndex | null>(null)
  const actualFrameRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const hoveredRef = useRef<number | null>(null)
  const selectedRef = useRef<number | null>(null)
  const questionRef = useRef<MarkerQuestion | null>(null)
  const pickedRef = useRef<number | null>(null)
  const showLabelsRef = useRef(false)
  const showMarkersRef = useRef(true)
  const showScopeSegmentRef = useRef(true)
  const currentScopeSegmentKeyRef = useRef<string | null>(null)
  const uiThrottleRef = useRef(0)

  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    scopeIndexRef.current = scopeIndex
  }, [scopeIndex])
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  useEffect(() => {
    hoveredRef.current = hovered
  }, [hovered])
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  useEffect(() => {
    questionRef.current = question
  }, [question])
  useEffect(() => {
    pickedRef.current = picked
  }, [picked])
  useEffect(() => {
    showLabelsRef.current = showLabels
  }, [showLabels])
  useEffect(() => {
    showMarkersRef.current = showMarkers
  }, [showMarkers])
  useEffect(() => {
    showScopeSegmentRef.current = showScopeSegment
  }, [showScopeSegment])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      loadOverlayData(controller.signal),
      loadScopeSegmentOverlayData(controller.signal).catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.warn('airway scope-segment overlays failed to load', err)
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
          console.error('airway overlays failed to load', err)
          setStatus('error')
        }
      })
    return () => controller.abort()
  }, [])

  const meta = index?.meta ?? null

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const idx = indexRef.current
    if (!canvas || !idx) return
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
    if (scopeIdx && actualFrame != null && showScopeSegmentRef.current) {
      const scopeFrame = nearestFrame(scopeIdx, actualFrame, scopeIdx.meta.step + 1)
      const scopeSegment = currentScopeSegmentAt(scopeIdx, actualFrame)
      const segmentShape = scopeSegment
        ? shapesAt(scopeIdx, scopeFrame).find((shape) => shape.s === scopeSegment.structIndex)
        : null
      if (scopeSegment && segmentShape) {
        const color = lobeColor(scopeSegment.structure.lobe)
        const pts = segmentShape.pts
        ctx.beginPath()
        ctx.moveTo(pts[0] * sx, pts[1] * sy)
        for (let i = 1; i < pts.length / 2; i += 1) {
          ctx.lineTo(pts[i * 2] * sx, pts[i * 2 + 1] * sy)
        }
        if (scopeSegment.structure.shape === 'poly') {
          ctx.closePath()
          ctx.fillStyle = hexToRgba(color, isPlayingRef.current ? 0.09 : 0.06)
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)'
        ctx.lineWidth = isPlayingRef.current ? 7 : 5
        ctx.stroke()
        ctx.setLineDash([9, 7])
        ctx.strokeStyle = color
        ctx.lineWidth = isPlayingRef.current ? 4 : 3
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (isPlayingRef.current || !showMarkersRef.current) return

    const frame = frameRef.current
    const activeQuestion = questionRef.current
    const revealed = pickedRef.current != null
    const emphasized = new Set<number>()
    if (hoveredRef.current != null) emphasized.add(hoveredRef.current)
    if (selectedRef.current != null) emphasized.add(selectedRef.current)
    if (activeQuestion && revealed) emphasized.add(activeQuestion.target)

    for (const shape of shapesAt(idx, frame)) {
      if (!emphasized.has(shape.s)) continue
      const structure = idx.structures[shape.s]
      if (!structure?.node) continue
      const color = lobeColor(structure.lobe)
      const pts = shape.pts
      ctx.beginPath()
      ctx.moveTo(pts[0] * sx, pts[1] * sy)
      for (let i = 1; i < pts.length / 2; i += 1) {
        ctx.lineTo(pts[i * 2] * sx, pts[i * 2 + 1] * sy)
      }
      if (structure.shape === 'poly') {
        ctx.closePath()
        ctx.fillStyle = hexToRgba(color, 0.14)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.65)'
      ctx.lineWidth = 8
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.shadowColor = color
      ctx.shadowBlur = 12
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    for (const marker of markersAtFrame(idx, frame, { atlasTargetsOnly: true })) {
      const color = lobeColor(marker.structure.lobe)
      const x = marker.x * sx
      const y = marker.y * sy
      const isHot =
        marker.structIndex === hoveredRef.current ||
        marker.structIndex === selectedRef.current ||
        marker.structIndex === activeQuestion?.target
      ctx.beginPath()
      ctx.arc(x, y, isHot ? 9 : 7, 0, Math.PI * 2)
      ctx.fillStyle = isHot ? color : 'rgba(248,250,252,0.92)'
      ctx.fill()
      ctx.lineWidth = isHot ? 4 : 3
      ctx.strokeStyle = isHot ? 'rgba(255,255,255,0.9)' : color
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, isHot ? 15 : 12, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(color, isHot ? 0.42 : 0.24)
      ctx.lineWidth = 2
      ctx.stroke()

      const shouldLabel =
        showLabelsRef.current ||
        isHot ||
        (revealed && marker.structIndex === activeQuestion?.target)
      if (shouldLabel) {
        drawLabel(ctx, marker.structure.short, x, y - 22, color, cssW, cssH)
      }
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
        setCurrentScopeSegment(scopeSegment?.structure ?? null)
      }

      draw()
      const now = performance.now()
      if (now - uiThrottleRef.current > 90) {
        uiThrottleRef.current = now
        setUiTime(seconds)
        setUiFrame(frame)
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

  useEffect(() => {
    draw()
  }, [
    draw,
    hovered,
    isPlaying,
    picked,
    question,
    selected,
    showLabels,
    showMarkers,
    showScopeSegment,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay = () => {
      setPlaybackError(null)
      setIsPlaying(true)
      setQuestion(null)
      setPicked(null)
      setHovered(null)
    }
    const onPause = () => setIsPlaying(false)
    const onError = () => {
      setIsPlaying(false)
      setPlaybackError(
        video.error?.message ||
          'The bronchoscopy video could not be played. Refresh the page and try again.',
      )
    }
    const onSeeked = () => syncTo(video.currentTime)
    const onLoaded = () => {
      setPlaybackError(null)
      resizeCanvas()
      syncTo(video.currentTime)
    }
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('error', onError)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadeddata', onLoaded)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('error', onError)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadeddata', onLoaded)
    }
  }, [resizeCanvas, syncTo])

  const togglePlay = useCallback(async () => {
    const video = videoRef.current
    if (!video || status !== 'ready') return

    if (!video.paused) {
      video.pause()
      return
    }

    try {
      setPlaybackError(null)
      if (video.readyState < 2) {
        video.load()
      }
      await video.play()
      setIsPlaying(true)
    } catch (error) {
      setIsPlaying(false)
      setPlaybackError(
        error instanceof Error && error.message
          ? `Unable to start the bronchoscopy video: ${error.message}`
          : 'Unable to start the bronchoscopy video. Refresh the page and try again.',
      )
    }
  }, [status])

  const seekToFrame = useCallback(
    (frame: number) => {
      const video = videoRef.current
      const idx = indexRef.current
      if (!video || !idx) return
      const time = timeForFrame(idx.meta, frame)
      video.currentTime = time
      syncTo(time)
      video.pause()
      setQuestion(null)
      setPicked(null)
    },
    [syncTo],
  )

  const restart = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    setQuestion(null)
    setPicked(null)
    syncTo(0)
  }, [syncTo])

  const pointerToOverlay = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current
    const idx = indexRef.current
    if (!stage || !idx) return null
    const rect = stage.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * idx.meta.width,
      y: ((clientY - rect.top) / rect.height) * idx.meta.height,
    }
  }, [])

  const pickMarker = useCallback(
    (clientX: number, clientY: number): number | null => {
      const idx = indexRef.current
      const point = pointerToOverlay(clientX, clientY)
      if (!idx || !point || isPlayingRef.current) return null
      return hitTestMarker(idx, frameRef.current, point.x, point.y, 34, {
        atlasTargetsOnly: true,
      })
    },
    [pointerToOverlay],
  )

  const onStageMove = useCallback(
    (event: React.MouseEvent) => {
      setHovered(pickMarker(event.clientX, event.clientY))
    },
    [pickMarker],
  )

  const onStageClick = useCallback(
    (event: React.MouseEvent) => {
      const idx = indexRef.current
      const hit = pickMarker(event.clientX, event.clientY)
      if (!idx || hit == null) return
      const video = videoRef.current
      if (video) video.pause()
      setSelected(hit)
      setPicked(null)
      setQuestion({ target: hit, choices: makeStructureChoices(idx.structures, hit) })
    },
    [pickMarker],
  )

  const answerQuestion = useCallback(
    (choice: number) => {
      if (!question || picked != null) return
      setPicked(choice)
      setSelected(question.target)
      setScore((prev) => ({
        correct: prev.correct + (choice === question.target ? 1 : 0),
        total: prev.total + 1,
      }))
    },
    [picked, question],
  )

  const onScreen = useMemo(() => {
    if (!index) return new Set<number>()
    const nearest = nearestFrame(index, uiFrame, index.meta.step + 1)
    return new Set(
      markersAtFrame(index, nearest, { atlasTargetsOnly: true }).map(
        (marker) => marker.structIndex,
      ),
    )
  }, [index, uiFrame])

  const grouped = useMemo(() => {
    if (!index) return []
    return GROUP_ORDER.map((group) => ({
      ...group,
      items: index.structures
        .map((structure, structureIndex) => ({ structure, structureIndex }))
        .filter(
          ({ structure }) => structure.group === group.key && isAtlasTargetStructure(structure),
        ),
    })).filter((group) => group.items.length > 0)
  }, [index])

  const activeChapter = useMemo(() => {
    let active = ATLAS_CHAPTERS[0]
    for (const chapter of ATLAS_CHAPTERS) {
      if (uiFrame >= chapter.frame - 20) active = chapter
    }
    return active
  }, [uiFrame])

  const selectedStruct: OverlayStructure | null =
    selected != null && index ? index.structures[selected] : null
  const questionTarget = question && index ? index.structures[question.target] : null
  const duration = meta?.duration ?? 0
  const markersVisible = status === 'ready' && !isPlaying && showMarkers

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-muted-foreground">
        The bronchoscopy video atlas could not be loaded. Please refresh to try again.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div
            ref={stageRef}
            onMouseMove={onStageMove}
            onMouseLeave={() => setHovered(null)}
            onClick={onStageClick}
            className={cn(
              'relative aspect-[1368/1080] w-full overflow-hidden rounded-2xl border border-border/70 bg-black',
              markersVisible && 'cursor-crosshair',
            )}
          >
            <video
              ref={videoRef}
              src={meta ? `/airway-lesson/${meta.video}` : undefined}
              poster={meta ? `/airway-lesson/${meta.poster}` : undefined}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />

            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                Loading bronchoscopy...
              </div>
            )}

            {status === 'ready' && isPlaying && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white/90 shadow">
                Pause to reveal airway markers
              </div>
            )}

            {status === 'ready' && showScopeSegment && currentScopeSegment && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/75 px-3 py-1.5 text-xs text-white/90 shadow">
                <span className="text-white/60">Scope position:</span>{' '}
                <span className="font-semibold">{currentScopeSegment.name}</span>
              </div>
            )}

            {markersVisible && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white/90 shadow">
                Click a marker to identify the airway
              </div>
            )}

            {status === 'ready' && !isPlaying && !showMarkers && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setShowMarkers(true)
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20 text-sm font-semibold text-white transition-colors hover:bg-black/30"
              >
                Show markers
              </button>
            )}

            {status === 'ready' && !isPlaying && !question && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  togglePlay()
                }}
                aria-label="Play bronchoscopy video"
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-105"
              >
                <Play className="ml-0.5 h-5 w-5 text-slate-900" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={status !== 'ready'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={restart}
              aria-label="Restart"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {formatTime(uiTime)}
            </span>
            <div className="relative flex-1">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.02}
                value={uiTime}
                onChange={(event) => {
                  const time = Number(event.target.value)
                  const video = videoRef.current
                  if (video) video.currentTime = time
                  syncTo(time)
                }}
                aria-label="Seek bronchoscopy video"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              {meta &&
                duration > 0 &&
                ATLAS_CHAPTERS.map((chapter) => (
                  <span
                    key={chapter.id}
                    className="pointer-events-none absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full bg-foreground/30"
                    style={{ left: `${(timeForFrame(meta, chapter.frame) / duration) * 100}%` }}
                  />
                ))}
            </div>
            <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>
          {playbackError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {playbackError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {ATLAS_CHAPTERS.map((chapter) => {
              const active = activeChapter.id === chapter.id
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => seekToFrame(chapter.frame)}
                  title={chapter.subtitle}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {chapter.title}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-card/60 p-1">
            <button
              type="button"
              onClick={() => setShowMarkers((value) => !value)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                showMarkers
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <MapPin className="h-4 w-4" />
              Markers
            </button>
            <button
              type="button"
              onClick={() => setShowLabels((value) => !value)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                showLabels
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Labels
            </button>
            <button
              type="button"
              onClick={() => setShowScopeSegment((value) => !value)}
              disabled={!scopeIndex}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                showScopeSegment
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Navigation className="h-4 w-4" />
              Scope
            </button>
          </div>

          {question && questionTarget ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 text-primary" aria-hidden />
                  Which airway or upper-airway structure did you click?
                </p>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {score.correct}/{score.total}
                </span>
              </div>
              <div className="space-y-1.5">
                {question.choices.map((choice) => {
                  const structure = index?.structures[choice]
                  if (!structure) return null
                  const isTarget = choice === question.target
                  const isPicked = choice === picked
                  const revealed = picked != null
                  return (
                    <button
                      key={structure.key}
                      type="button"
                      disabled={revealed}
                      onClick={() => answerQuestion(choice)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        !revealed && 'border-border/70 hover:border-primary/50 hover:bg-muted/60',
                        revealed &&
                          isTarget &&
                          'border-emerald-500/60 bg-emerald-500/10 text-foreground',
                        revealed &&
                          isPicked &&
                          !isTarget &&
                          'border-destructive/60 bg-destructive/10 text-foreground',
                        revealed && !isTarget && !isPicked && 'border-border/50 opacity-60',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: lobeColor(structure.lobe) }}
                          aria-hidden
                        />
                        {structure.name}
                      </span>
                      {revealed && isTarget && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                      {revealed && isPicked && !isTarget && (
                        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                    </button>
                  )
                })}
              </div>
              {picked != null && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <p
                    className={cn(
                      'font-semibold',
                      picked === question.target ? 'text-emerald-600' : 'text-destructive',
                    )}
                  >
                    {picked === question.target ? 'Correct' : 'Not quite'} - this is{' '}
                    {questionTarget.name}.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {structureRegionLabel(questionTarget)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuestion(null)
                        setPicked(null)
                      }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Back to markers
                    </button>
                    {questionTarget.node && onOpenStructure && (
                      <button
                        type="button"
                        onClick={() => onOpenStructure(questionTarget.node as string)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <Boxes className="h-3.5 w-3.5" />
                        Open explorer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-card/60 p-4">
              <p className="text-sm font-semibold text-foreground">Pause, reveal, identify</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Play the survey without labels. Pause when you want to study a view, then use the
                marker dots to test yourself. Turn labels on only after you commit.
              </p>
            </div>
          )}

          {selectedStruct && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: lobeColor(selectedStruct.lobe) }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{selectedStruct.name}</p>
                <p className="text-xs text-muted-foreground">
                  {structureRegionLabel(selectedStruct)}
                </p>
              </div>
              {selectedStruct.node && onOpenStructure && (
                <button
                  type="button"
                  onClick={() => onOpenStructure(selectedStruct.node as string)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  3D
                </button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-card/60 p-1.5">
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              Filled dots are visible in the paused frame. Pick a structure to jump to its first
              annotated appearance.
            </p>
            <div className="max-h-[360px] space-y-2 overflow-y-auto px-1 pb-1">
              {grouped.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-1.5 px-1.5 py-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: lobeColor(group.lobe) }}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(({ structure, structureIndex }) => {
                      const isOn = onScreen.has(structureIndex)
                      return (
                        <button
                          key={structure.key}
                          type="button"
                          onMouseEnter={() => setHovered(structureIndex)}
                          onMouseLeave={() =>
                            setHovered((current) => (current === structureIndex ? null : current))
                          }
                          onClick={() => {
                            setSelected(structureIndex)
                            const first = index?.framesByStruct.get(structureIndex)?.[0]
                            if (first != null) seekToFrame(first)
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                            selected === structureIndex
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-muted/60',
                          )}
                        >
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full ring-1',
                              !isOn && 'bg-transparent',
                            )}
                            style={{
                              backgroundColor: isOn ? lobeColor(structure.lobe) : undefined,
                              boxShadow: isOn
                                ? `0 0 0 3px ${hexToRgba(lobeColor(structure.lobe), 0.2)}`
                                : undefined,
                              borderColor: lobeColor(structure.lobe),
                            }}
                          />
                          <span className={cn('flex-1 truncate', isOn && 'font-medium')}>
                            {structure.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
