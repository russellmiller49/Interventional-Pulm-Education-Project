'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'

import { BRANCH_GROUPS } from '@fluoroview/grouping'
import { FluoroRenderer } from '@fluoroview/render'
import type { AppState, FluoroConfig, PreparedSegment } from '@fluoroview/types'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

const ORIGIN_GROUP = 'other'
const GOLDEN_ORDER = BRANCH_GROUPS.map((group) => group.key)

interface LegendEntry {
  groupKey: string
  groupLabel: string
  items: { label: string; color: string }[]
}

type RenderStats = {
  fps: number
  visibleSegments: number
}

function resolveAsset(base: string | undefined, relative: string): string {
  if (!base || base === '.') {
    return relative
  }
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/${relative}`
}

function buildLegendEntries(segments: PreparedSegment[]): LegendEntry[] {
  const entries = BRANCH_GROUPS.map((group) => ({
    groupKey: group.key,
    groupLabel: group.label,
    items: segments
      .filter((segment) => segment.groupKey === group.key)
      .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
      .map((segment) => ({
        label: segment.displayLabel,
        color: segment.color,
      })),
  })).filter((entry) => entry.items.length > 0)

  const otherSegments = segments.filter(
    (segment) =>
      segment.groupKey === ORIGIN_GROUP && !segment.label.includes('Tracheobronchial_tree_full'),
  )

  if (otherSegments.length) {
    entries.push({
      groupKey: ORIGIN_GROUP,
      groupLabel: 'Other',
      items: otherSegments
        .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
        .map((segment) => ({
          label: segment.displayLabel,
          color: segment.color,
        })),
    })
  }

  return entries
}

export function FluoroViewApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const labelLayerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<FluoroRenderer | null>(null)
  const animationFrameRef = useRef<number>()
  const needsRenderRef = useRef(false)
  const stateRef = useRef<AppState | null>(null)

  const [config, setConfig] = useState<FluoroConfig | null>(null)
  const [segments, setSegments] = useState<PreparedSegment[]>([])
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([])
  const [appState, setAppState] = useState<AppState | null>(null)
  const [renderStats, setRenderStats] = useState<RenderStats>({ fps: 0, visibleSegments: 0 })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const requestRender = useCallback(() => {
    needsRenderRef.current = true
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const labelLayer = labelLayerRef.current
    if (!canvas || !labelLayer) return

    let cancelled = false

    async function boot() {
      try {
        const res = await fetch('/fluoroview/fluoro_config.json')
        if (!res.ok) {
          throw new Error(`Failed to load configuration (${res.status})`)
        }
        const cfg = (await res.json()) as FluoroConfig
        if (cfg.units !== 'mm' || cfg.coordinateSystem !== 'LPS') {
          throw new Error('Configuration mismatch: FluoroView expects mm / LPS coordinates.')
        }
        setConfig(cfg)

        const renderer = new FluoroRenderer({ canvas, labelLayer, config: cfg })
        rendererRef.current = renderer

        const assetBase = cfg.asset_base_url
        const glbPath = resolveAsset(assetBase, 'airway_segments.glb')
        const dracoBase = resolveAsset(assetBase, 'draco')
        const loadedSegments = await renderer.loadGlb(glbPath, { dracoBaseUrl: dracoBase })
        if (cancelled) return

        setSegments(loadedSegments)
        setLegendEntries(buildLegendEntries(loadedSegments))

        const baseState: AppState = {
          raoLao: cfg.default_view.rao_lao_deg,
          cranialCaudal: cfg.default_view.cranial_caudal_deg,
          useDts: false,
          useWireframe: false,
          showLabels: true,
          activeGroups: new Set([...GOLDEN_ORDER, ORIGIN_GROUP]),
        }
        stateRef.current = {
          ...baseState,
          activeGroups: new Set(baseState.activeGroups),
        }
        setAppState(baseState)
        setLoading(false)
        requestRender()
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Failed to load FluoroView assets.')
        setLoading(false)
      }
    }

    boot()

    return () => {
      cancelled = true
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [requestRender])

  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer) return

    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        return
      }
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      if (renderer.setPointer(x, y)) {
        requestRender()
      }
    }

    const clearPointer = () => {
      if (renderer.clearPointer()) {
        requestRender()
      }
    }

    canvas.addEventListener('pointermove', handlePointer)
    canvas.addEventListener('pointerdown', handlePointer)
    canvas.addEventListener('pointerup', handlePointer)
    canvas.addEventListener('pointerleave', clearPointer)
    canvas.addEventListener('pointercancel', clearPointer)

    const handleResize = () => requestRender()
    window.addEventListener('resize', handleResize)

    return () => {
      canvas.removeEventListener('pointermove', handlePointer)
      canvas.removeEventListener('pointerdown', handlePointer)
      canvas.removeEventListener('pointerup', handlePointer)
      canvas.removeEventListener('pointerleave', clearPointer)
      canvas.removeEventListener('pointercancel', clearPointer)
      window.removeEventListener('resize', handleResize)
    }
  }, [requestRender, segments.length])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !stateRef.current) {
      return
    }

    let smoothFps = 0
    let lastTime = performance.now()

    const loop = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(loop)
      if (!needsRenderRef.current || !stateRef.current) {
        return
      }
      const stats = renderer.render(stateRef.current)
      const delta = now - lastTime
      lastTime = now
      const instantFps = delta > 0 ? 1000 / delta : 0
      smoothFps = smoothFps * 0.85 + instantFps * 0.15
      setRenderStats({ fps: smoothFps, visibleSegments: stats.visibleSegments })
      needsRenderRef.current = false
    }

    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [segments.length])

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setAppState((prev) => {
      if (!prev) return prev
      const base = updater(prev)
      const next: AppState = {
        ...base,
        activeGroups: new Set(base.activeGroups),
      }
      stateRef.current = {
        ...next,
        activeGroups: new Set(next.activeGroups),
      }
      needsRenderRef.current = true
      return next
    })
  }, [])

  const handleGroupToggle = useCallback(
    (groupKey: string, checked: boolean) => {
      updateState((prev) => {
        const groups = new Set(prev.activeGroups)
        if (checked) {
          groups.add(groupKey)
        } else {
          groups.delete(groupKey)
        }
        return { ...prev, activeGroups: groups }
      })
    },
    [updateState],
  )

  useEffect(() => {
    if (!appState) return
    requestRender()
  }, [appState, requestRender])

  const statsText = useMemo(() => {
    return `FPS ${renderStats.fps.toFixed(1)} · segments ${renderStats.visibleSegments}`
  }, [renderStats])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-3XL border border-border/70 bg-card/80">
        <span className="text-sm text-muted-foreground">Loading FluoroView…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
        <h3 className="text-lg font-semibold">Unable to load FluoroView</h3>
        <p className="mt-2 text-sm opacity-80">{error}</p>
      </div>
    )
  }

  if (!config || !appState) {
    return null
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-5">
        <div className="relative rounded-3xl border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
          <div className="relative mx-auto max-w-[min(720px,100%)]">
            <canvas
              ref={canvasRef}
              width={1024}
              height={1024}
              className="aspect-square w-full rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl"
            />
            <div ref={labelLayerRef} className="pointer-events-none absolute inset-0" />
            <div className="absolute left-4 top-4 text-xs font-medium text-slate-300/80">
              {statsText}
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <h3 className="text-base font-semibold text-foreground">Controls</h3>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>RAO / LAO</span>
                  <span className="font-semibold text-foreground">
                    {appState.raoLao.toFixed(0)}°
                  </span>
                </label>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={1}
                  value={appState.raoLao}
                  onChange={(event) =>
                    updateState((prev) => ({ ...prev, raoLao: Number(event.target.value) }))
                  }
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Cranial / Caudal</span>
                  <span className="font-semibold text-foreground">
                    {appState.cranialCaudal.toFixed(0)}°
                  </span>
                </label>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={appState.cranialCaudal}
                  onChange={(event) =>
                    updateState((prev) => ({ ...prev, cranialCaudal: Number(event.target.value) }))
                  }
                  className="w-full accent-primary"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm shadow-sm">
                <span className="text-muted-foreground">DTS depth emphasis</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={appState.useDts}
                  onChange={(event) =>
                    updateState((prev) => ({ ...prev, useDts: event.target.checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm shadow-sm">
                <span className="text-muted-foreground">Surface wireframe overlay</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={appState.useWireframe}
                  onChange={(event) =>
                    updateState((prev) => ({ ...prev, useWireframe: event.target.checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm shadow-sm">
                <span className="text-muted-foreground">Show labels</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={appState.showLabels}
                  onChange={(event) =>
                    updateState((prev) => ({ ...prev, showLabels: event.target.checked }))
                  }
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Lobar filters</h3>
            <Badge variant="outline" className="rounded-full border-primary/40 text-xs">
              {appState.activeGroups.size} active
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {legendEntries.map((group) => (
              <div key={group.groupKey} className="space-y-2">
                <label className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm shadow-sm">
                  <span className="font-medium text-foreground">{group.groupLabel}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={appState.activeGroups.has(group.groupKey)}
                    onChange={(event) => handleGroupToggle(group.groupKey, event.target.checked)}
                  />
                </label>
                <div className="grid gap-1 pl-2 text-xs text-muted-foreground">
                  {group.items.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm border border-border/40"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
