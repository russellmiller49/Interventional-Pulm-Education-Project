'use client'

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Image from 'next/image'

import {
  findDrrBlendFrames,
  findNearestDrrFrame,
  validateFluoroCaseManifest,
} from '@fluoroview/case'
import { BRANCH_GROUPS } from '@fluoroview/grouping'
import {
  DEFAULT_FLUORO_SETTINGS,
  EMPTY_DOSE_STATE,
  collimationClipPath,
  estimateRelativeDoseRate,
  fieldAreaFraction,
  imageFilterForSettings,
  imageScaleForSettings,
  noiseOpacityForSettings,
  scatterOpacityForSettings,
  updateDoseState,
  type DoseState,
  type FluoroSettings,
  type MagnificationMode,
} from '@fluoroview/knobology'
import { FluoroRenderer } from '@fluoroview/render'
import type {
  AppState,
  CenterlineOverlay,
  CtAxis,
  FluoroCaseManifest,
  OverlayMode,
  PreparedSegment,
  SegmentMetadata,
} from '@fluoroview/types'

import { Badge } from '@/components/ui/badge'

const CASE_MANIFEST_URL = '/fluoroview/cases/patient-4/case_manifest.json'
const ORIGIN_GROUP = 'other'
const GOLDEN_ORDER = BRANCH_GROUPS.map((group) => group.key)
const CT_AXES: CtAxis[] = ['axial', 'coronal', 'sagittal']
const OVERLAY_MODES: Array<{ value: OverlayMode; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'surface', label: 'Surface' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'centerline', label: 'Centerline' },
  { value: 'labels', label: 'Labels' },
]
const MAGNIFICATION_MODES: Array<{ value: MagnificationMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'digital', label: 'Digital zoom' },
  { value: 'detector', label: 'Detector mag' },
  { value: 'geometric', label: 'Geometric mag' },
]

interface LegendEntry {
  groupKey: string
  groupLabel: string
  items: { label: string; color: string }[]
}

type RenderStats = {
  fps: number
  visibleSegments: number
}

type CtIndexByAxis = Record<CtAxis, number>

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

function defaultCtIndices(manifest: FluoroCaseManifest): CtIndexByAxis {
  return {
    axial: manifest.ctSlices.axes.axial.defaultIndex,
    coronal: manifest.ctSlices.axes.coronal.defaultIndex,
    sagittal: manifest.ctSlices.axes.sagittal.defaultIndex,
  }
}

export function FluoroViewApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const labelLayerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<FluoroRenderer | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const needsRenderRef = useRef(false)
  const stateRef = useRef<AppState | null>(null)

  const [manifest, setManifest] = useState<FluoroCaseManifest | null>(null)
  const [centerline, setCenterline] = useState<CenterlineOverlay | null>(null)
  const [segmentMetadata, setSegmentMetadata] = useState<SegmentMetadata | null>(null)
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([])
  const [appState, setAppState] = useState<AppState | null>(null)
  const [settings, setSettings] = useState<FluoroSettings>(DEFAULT_FLUORO_SETTINGS)
  const [doseState, setDoseState] = useState<DoseState>(EMPTY_DOSE_STATE)
  const [ctAxis, setCtAxis] = useState<CtAxis>('axial')
  const [ctIndices, setCtIndices] = useState<CtIndexByAxis>({ axial: 0, coronal: 0, sagittal: 0 })
  const [ctWindowPreset, setCtWindowPreset] = useState('lung')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [renderStats, setRenderStats] = useState<RenderStats>({ fps: 0, visibleSegments: 0 })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const requestRender = useCallback(() => {
    needsRenderRef.current = true
  }, [])

  useEffect(() => {
    const canvasEl = canvasRef.current
    const labelLayerEl = labelLayerRef.current
    if (!canvasEl || !labelLayerEl) return

    let cancelled = false

    async function boot(canvas: HTMLCanvasElement, labelLayer: HTMLDivElement) {
      try {
        const manifestRes = await fetch(CASE_MANIFEST_URL)
        if (!manifestRes.ok) {
          throw new Error(`Failed to load case manifest (${manifestRes.status})`)
        }
        const loadedManifest = (await manifestRes.json()) as FluoroCaseManifest
        const manifestErrors = validateFluoroCaseManifest(loadedManifest)
        if (manifestErrors.length) {
          throw new Error(manifestErrors.join(' '))
        }
        if (
          loadedManifest.geometry.units !== 'mm' ||
          loadedManifest.geometry.coordinateSystem !== 'LPS'
        ) {
          throw new Error('Configuration mismatch: FluoroView expects mm / LPS coordinates.')
        }

        const renderer = new FluoroRenderer({
          canvas,
          labelLayer,
          config: loadedManifest.geometry,
        })
        rendererRef.current = renderer

        const [loadedSegments, centerlineRes, segmentRes] = await Promise.all([
          renderer.loadGlb(loadedManifest.assets.airwayGlb, {
            dracoBaseUrl: loadedManifest.assets.dracoBaseUrl,
          }),
          fetch(loadedManifest.assets.centerlineJson),
          fetch(loadedManifest.assets.segmentMetadataJson),
        ])

        if (cancelled) return

        if (centerlineRes.ok) {
          setCenterline((await centerlineRes.json()) as CenterlineOverlay)
        }
        if (segmentRes.ok) {
          setSegmentMetadata((await segmentRes.json()) as SegmentMetadata)
        }

        const baseState: AppState = {
          raoLao: loadedManifest.geometry.default_view.rao_lao_deg,
          cranialCaudal: loadedManifest.geometry.default_view.cranial_caudal_deg,
          useDts: false,
          useWireframe: false,
          showLabels: true,
          overlayMode: 'surface',
          overlayOpacity: 0.68,
          activeGroups: new Set([...GOLDEN_ORDER, ORIGIN_GROUP]),
        }
        stateRef.current = {
          ...baseState,
          activeGroups: new Set(baseState.activeGroups),
        }
        setManifest(loadedManifest)
        setSelectedLessonId(loadedManifest.lessons[0]?.id ?? null)
        setCtIndices(defaultCtIndices(loadedManifest))
        setLegendEntries(buildLegendEntries(loadedSegments))
        setAppState(baseState)
        setLoading(false)
        requestRender()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load FluoroView assets.')
        setLoading(false)
      }
    }

    boot(canvasEl, labelLayerEl)

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
      if (rect.width === 0 || rect.height === 0) return
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      if (renderer.setPointer(x, y)) requestRender()
    }

    const clearPointer = () => {
      if (renderer.clearPointer()) requestRender()
    }

    canvas.addEventListener('pointermove', handlePointer)
    canvas.addEventListener('pointerdown', handlePointer)
    canvas.addEventListener('pointerup', handlePointer)
    canvas.addEventListener('pointerleave', clearPointer)
    canvas.addEventListener('pointercancel', clearPointer)
    window.addEventListener('resize', requestRender)

    return () => {
      canvas.removeEventListener('pointermove', handlePointer)
      canvas.removeEventListener('pointerdown', handlePointer)
      canvas.removeEventListener('pointerup', handlePointer)
      canvas.removeEventListener('pointerleave', clearPointer)
      canvas.removeEventListener('pointercancel', clearPointer)
      window.removeEventListener('resize', requestRender)
    }
  }, [requestRender, legendEntries.length])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !stateRef.current) return

    let smoothFps = 0
    let lastTime = performance.now()

    const loop = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(loop)
      if (!needsRenderRef.current || !stateRef.current) return
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
  }, [legendEntries.length])

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

  const updateSetting = useCallback(
    <K extends keyof FluoroSettings>(key: K, value: FluoroSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleGroupToggle = useCallback(
    (groupKey: string, checked: boolean) => {
      updateState((prev) => {
        const groups = new Set(prev.activeGroups)
        if (checked) groups.add(groupKey)
        else groups.delete(groupKey)
        return { ...prev, activeGroups: groups }
      })
    },
    [updateState],
  )

  useEffect(() => {
    if (!appState) return
    requestRender()
  }, [appState, requestRender])

  const nearestFrame = useMemo(() => {
    if (!manifest || !appState) return null
    return findNearestDrrFrame(manifest.drrAtlas.frames, appState.raoLao, appState.cranialCaudal)
  }, [appState, manifest])

  const drrBlendFrames = useMemo(() => {
    if (!manifest || !appState) return []
    return findDrrBlendFrames(manifest.drrAtlas.frames, appState.raoLao, appState.cranialCaudal)
  }, [appState, manifest])

  const selectedLesson = useMemo(() => {
    return (
      manifest?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? manifest?.lessons[0]
    )
  }, [manifest, selectedLessonId])

  const ctFrame = useMemo(() => {
    if (!manifest) return null
    const axisConfig = manifest.ctSlices.axes[ctAxis]
    const index = ctIndices[ctAxis] ?? axisConfig.defaultIndex
    return axisConfig.frames[Math.min(Math.max(index, 0), axisConfig.frames.length - 1)]
  }, [ctAxis, ctIndices, manifest])

  const thicknessProxy = drrBlendFrames.length
    ? drrBlendFrames.reduce((total, item) => total + item.frame.thicknessProxy * item.weight, 0)
    : (nearestFrame?.thicknessProxy ?? 1)
  const doseRate = estimateRelativeDoseRate(settings, thicknessProxy)
  const fieldArea = fieldAreaFraction(settings)

  const fluoroImageStyle = useMemo<CSSProperties>(
    () => ({
      filter: imageFilterForSettings(settings, thicknessProxy),
      clipPath: collimationClipPath(settings),
      transform: `scale(${imageScaleForSettings(settings)})`,
    }),
    [settings, thicknessProxy],
  )

  const ctImageStyle = useMemo<CSSProperties>(() => {
    const preset = manifest?.ctSlices.windowPresets.find((item) => item.id === ctWindowPreset)
    const contrast = preset?.id === 'bone' ? 1.18 : preset?.id === 'softTissue' ? 1.05 : 1.26
    const brightness = preset?.id === 'bone' ? 0.9 : preset?.id === 'softTissue' ? 1.03 : 1.08
    return { filter: `grayscale(1) contrast(${contrast}) brightness(${brightness})` }
  }, [ctWindowPreset, manifest])

  const atlasDelta =
    nearestFrame && appState
      ? {
          rao: nearestFrame.raoLaoDeg - appState.raoLao,
          cranial: nearestFrame.cranialCaudalDeg - appState.cranialCaudal,
        }
      : null
  const atlasBlendDescription = drrBlendFrames
    .map(
      (item) =>
        `${item.frame.id.replace('drr_', '').toUpperCase()} ${(item.weight * 100).toFixed(0)}%`,
    )
    .join(' + ')

  const acquireFrames = useCallback(
    (frameCount: number) => {
      setDoseState((prev) => updateDoseState(prev, settings, frameCount, thicknessProxy))
    },
    [settings, thicknessProxy],
  )

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-destructive">
        <h3 className="text-lg font-semibold">Unable to load FluoroView</h3>
        <p className="mt-2 text-sm opacity-80">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(360px,0.72fr)_minmax(620px,1.28fr)]">
        <section className="rounded-lg border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Simulated Fluoro</h2>
              <p className="text-xs text-muted-foreground">
                Relative educational DRR atlas with browser-side knobology.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-xs">
              {drrBlendFrames.length > 1
                ? `${drrBlendFrames.length}-frame blend`
                : nearestFrame
                  ? nearestFrame.id
                  : 'Loading'}
            </Badge>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-slate-950">
            {drrBlendFrames.length ? (
              drrBlendFrames.map((blendFrame, index) => (
                <Image
                  key={blendFrame.frame.id}
                  src={blendFrame.frame.imageUrl}
                  alt={
                    index === drrBlendFrames.length - 1
                      ? `Interpolated simulated fluoro near ${appState?.raoLao ?? 0} RAO/LAO and ${appState?.cranialCaudal ?? 0} cranial/caudal`
                      : ''
                  }
                  aria-hidden={index !== drrBlendFrames.length - 1}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  style={{
                    ...fluoroImageStyle,
                    mixBlendMode: drrBlendFrames.length > 1 ? 'plus-lighter' : 'normal',
                    opacity: drrBlendFrames.length === 1 ? 1 : blendFrame.weight,
                    transition: 'opacity 120ms linear, transform 120ms linear',
                  }}
                />
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-300">
                Loading DRR atlas...
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-slate-200 mix-blend-screen"
              style={{ opacity: scatterOpacityForSettings(settings, thicknessProxy) }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen"
              style={{
                opacity: noiseOpacityForSettings(settings),
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, white 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 0 1px, transparent 1px)',
                backgroundSize: '7px 7px, 11px 11px',
              }}
            />
            {centerline && appState?.overlayMode === 'centerline' ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                aria-hidden
              >
                {centerline.polylines.map((polyline) => (
                  <polyline
                    key={polyline.id}
                    points={polyline.points.map((point) => point.join(',')).join(' ')}
                    fill="none"
                    stroke="#facc15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    opacity="0.85"
                  />
                ))}
              </svg>
            ) : null}
            <canvas
              ref={canvasRef}
              width={1024}
              height={1024}
              className="absolute inset-0 h-full w-full"
              style={{
                opacity: appState?.overlayMode === 'off' ? 0 : 1,
                pointerEvents: appState?.overlayMode === 'off' ? 'none' : 'auto',
              }}
            />
            <div ref={labelLayerRef} className="pointer-events-none absolute inset-0" />
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-slate-300">
                Loading FluoroView...
              </div>
            ) : null}
            <div className="absolute left-3 top-3 rounded bg-slate-950/70 px-2 py-1 text-xs text-slate-200">
              FPS {renderStats.fps.toFixed(1)} | segments {renderStats.visibleSegments}
            </div>
          </div>
          {atlasDelta ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Continuous atlas blend: {atlasBlendDescription || 'Loading'}. Nearest delta{' '}
              {atlasDelta.rao.toFixed(1)} / {atlasDelta.cranial.toFixed(1)} deg.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-primary/40 bg-card/70 p-4 xl:row-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Live Controls</h2>
              <p className="text-xs text-muted-foreground">
                Adjust projection, image settings, and overlay while watching the fluoro view.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full border-primary/40 text-xs">
              Live
            </Badge>
          </div>
          <details className="mb-5 rounded-md border border-border/70 bg-background/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              <span className="ml-2 inline-flex items-center gap-3">
                <span>Lobar Filters</span>
                {appState ? (
                  <Badge variant="outline" className="rounded-full border-primary/40 text-xs">
                    {appState.activeGroups.size} active
                  </Badge>
                ) : null}
              </span>
            </summary>
            {!appState ? (
              <div className="mt-3 text-sm text-muted-foreground">Loading filters...</div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {legendEntries.map((group) => (
                  <div key={group.groupKey} className="space-y-2">
                    <label className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{group.groupLabel}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={appState.activeGroups.has(group.groupKey)}
                        onChange={(event) =>
                          handleGroupToggle(group.groupKey, event.target.checked)
                        }
                      />
                    </label>
                    <div className="grid gap-1 pl-2 text-xs text-muted-foreground">
                      {group.items.slice(0, 4).map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-sm border border-border/40"
                            style={{ backgroundColor: item.color }}
                            aria-hidden
                          />
                          <span>{item.label}</span>
                        </div>
                      ))}
                      {group.items.length > 4 ? <span>+ {group.items.length - 4} more</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            <ControlPanel title="C-arm">
              <PresetButtons
                onSelect={(raoLao, cranialCaudal) =>
                  updateState((prev) => ({ ...prev, raoLao, cranialCaudal }))
                }
              />
              {appState ? (
                <>
                  <RangeControl
                    label="RAO / LAO"
                    value={appState.raoLao}
                    min={-60}
                    max={60}
                    step={0.5}
                    unit="deg"
                    onChange={(value) => updateState((prev) => ({ ...prev, raoLao: value }))}
                  />
                  <RangeControl
                    label="Cranial / Caudal"
                    value={appState.cranialCaudal}
                    min={-20}
                    max={20}
                    step={0.5}
                    unit="deg"
                    onChange={(value) => updateState((prev) => ({ ...prev, cranialCaudal: value }))}
                  />
                </>
              ) : null}
              {atlasDelta ? (
                <p className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                  Continuous blend delta {atlasDelta.rao.toFixed(1)} /{' '}
                  {atlasDelta.cranial.toFixed(1)} deg.
                </p>
              ) : null}
            </ControlPanel>

            <ControlPanel title="Knobology">
              <RangeControl
                label="kVp"
                value={settings.kvp}
                min={60}
                max={120}
                step={1}
                onChange={(value) => updateSetting('kvp', value)}
              />
              <RangeControl
                label="mA"
                value={settings.ma}
                min={0.5}
                max={8}
                step={0.1}
                onChange={(value) => updateSetting('ma', value)}
              />
              <RangeControl
                label="Pulse width"
                value={settings.pulseWidthMs}
                min={2}
                max={20}
                step={0.5}
                unit="ms"
                onChange={(value) => updateSetting('pulseWidthMs', value)}
              />
              <RangeControl
                label="Pulse rate"
                value={settings.pulseRateFps}
                min={1}
                max={30}
                step={0.5}
                unit="fps"
                onChange={(value) => updateSetting('pulseRateFps', value)}
              />
            </ControlPanel>

            <ControlPanel title="Overlay And Dose">
              {appState ? (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">3D overlay</span>
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2"
                      value={appState.overlayMode}
                      onChange={(event) =>
                        updateState((prev) => ({
                          ...prev,
                          overlayMode: event.target.value as OverlayMode,
                          showLabels: event.target.value === 'labels' || prev.showLabels,
                          useWireframe:
                            event.target.value === 'wireframe' ||
                            event.target.value === 'centerline' ||
                            prev.useWireframe,
                        }))
                      }
                    >
                      {OVERLAY_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <RangeControl
                    label="Overlay opacity"
                    value={appState.overlayOpacity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(value) =>
                      updateState((prev) => ({ ...prev, overlayOpacity: value }))
                    }
                  />
                  <ToggleControl
                    label="Labels"
                    checked={appState.showLabels}
                    onChange={(checked) =>
                      updateState((prev) => ({ ...prev, showLabels: checked }))
                    }
                  />
                  <ToggleControl
                    label="Depth emphasis"
                    checked={appState.useDts}
                    onChange={(checked) => updateState((prev) => ({ ...prev, useDts: checked }))}
                  />
                </>
              ) : null}
              <div className="rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                <div className="font-medium">Relative educational dose estimate</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Dose rate</span>
                  <span className="text-right">{doseRate.toFixed(2)}</span>
                  <span>Cumulative air kerma</span>
                  <span className="text-right">
                    {doseState.cumulativeRelativeAirKerma.toFixed(2)}
                  </span>
                  <span>Relative KAP/DAP</span>
                  <span className="text-right">{doseState.cumulativeRelativeKap.toFixed(2)}</span>
                  <span>Frames</span>
                  <span className="text-right">{doseState.cumulativeFrames}</span>
                  <span>Fluoro time</span>
                  <span className="text-right">{doseState.elapsedFluoroSeconds.toFixed(1)} s</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    onClick={() => acquireFrames(1)}
                  >
                    Acquire frame
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
                    onClick={() => acquireFrames(settings.pulseRateFps)}
                  >
                    Run 1 s
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
                    onClick={() => setDoseState(EMPTY_DOSE_STATE)}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </ControlPanel>

            <ControlPanel title="Field And Image">
              <RangeControl
                label="Collimation width"
                value={settings.collimationX}
                min={0.25}
                max={1}
                step={0.05}
                onChange={(value) => updateSetting('collimationX', value)}
              />
              <RangeControl
                label="Collimation height"
                value={settings.collimationY}
                min={0.25}
                max={1}
                step={0.05}
                onChange={(value) => updateSetting('collimationY', value)}
              />
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Magnification</span>
                <select
                  className="rounded-md border border-border bg-background px-3 py-2"
                  value={settings.magnificationMode}
                  onChange={(event) =>
                    updateSetting('magnificationMode', event.target.value as MagnificationMode)
                  }
                >
                  {MAGNIFICATION_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
              <RangeControl
                label="Magnification factor"
                value={settings.magnificationFactor}
                min={1}
                max={2.5}
                step={0.1}
                onChange={(value) => updateSetting('magnificationFactor', value)}
              />
            </ControlPanel>

            <ControlPanel title="Physics Toggles">
              <ToggleControl
                label="ABC / AERC"
                checked={settings.abcEnabled}
                onChange={(checked) => updateSetting('abcEnabled', checked)}
              />
              <ToggleControl
                label="Scatter"
                checked={settings.scatterEnabled}
                onChange={(checked) => updateSetting('scatterEnabled', checked)}
              />
              <ToggleControl
                label="Quantum noise"
                checked={settings.noiseEnabled}
                onChange={(checked) => updateSetting('noiseEnabled', checked)}
              />
              <ToggleControl
                label="High-dose mode"
                checked={settings.highDoseMode}
                onChange={(checked) => updateSetting('highDoseMode', checked)}
              />
              <RangeControl
                label="Detector blur"
                value={settings.detectorBlurPx}
                min={0}
                max={2}
                step={0.1}
                unit="px"
                onChange={(value) => updateSetting('detectorBlurPx', value)}
              />
            </ControlPanel>

            <ControlPanel title="Lesson">
              {manifest ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Exercise</span>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={selectedLesson?.id ?? ''}
                    onChange={(event) => setSelectedLessonId(event.target.value)}
                  >
                    {manifest.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {selectedLesson ? (
                <div className="rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                  <div className="font-medium">{selectedLesson.title}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedLesson.objective}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedLesson.task}</p>
                </div>
              ) : null}
            </ControlPanel>
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-card/70 p-4 xl:col-start-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">CT Correlation</h2>
              <p className="text-xs text-muted-foreground">
                Derived slice tiles for educational projection correlation.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full text-xs">
              {ctAxis}
            </Badge>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-slate-950">
              {ctFrame ? (
                <Image
                  src={ctFrame.imageUrl}
                  alt={`${ctAxis} CT slice ${ctFrame.index + 1}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  style={ctImageStyle}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-300">
                  Loading CT slice...
                </div>
              )}
            </div>
            {manifest ? (
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Axis</span>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={ctAxis}
                    onChange={(event) => setCtAxis(event.target.value as CtAxis)}
                  >
                    {CT_AXES.map((axis) => (
                      <option key={axis} value={axis}>
                        {manifest.ctSlices.axes[axis].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="flex justify-between text-muted-foreground">
                    <span>Slice</span>
                    <span>{(ctIndices[ctAxis] ?? 0) + 1}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={manifest.ctSlices.axes[ctAxis].frames.length - 1}
                    step={1}
                    value={ctIndices[ctAxis] ?? 0}
                    onChange={(event) =>
                      setCtIndices((prev) => ({ ...prev, [ctAxis]: Number(event.target.value) }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Window</span>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={ctWindowPreset}
                    onChange={(event) => setCtWindowPreset(event.target.value)}
                  >
                    {manifest.ctSlices.windowPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        </section>

        <details className="rounded-lg border border-border/70 bg-card/70 p-4 xl:col-span-2">
          <summary className="cursor-pointer text-base font-semibold text-foreground">
            <span className="ml-2 inline-flex items-center gap-3">
              <span>Case Data</span>
              <Badge variant="outline" className="rounded-full text-xs">
                {manifest?.drrAtlas.provenance.backend ?? 'Loading'}
              </Badge>
            </span>
          </summary>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt>Case</dt>
              <dd className="text-right text-foreground">{manifest?.title ?? 'Loading'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Atlas frames</dt>
              <dd className="text-foreground">{manifest?.drrAtlas.frames.length ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Atlas backend</dt>
              <dd className="text-right text-foreground">
                {manifest?.drrAtlas.provenance.backend ?? 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Detector</dt>
              <dd className="text-foreground">
                {manifest ? manifest.drrAtlas.provenance.detectorPixels.join(' x ') : 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Image orientation</dt>
              <dd className="text-right text-foreground">
                {manifest?.drrAtlas.provenance.imageOrientation ?? 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>DRR tone map</dt>
              <dd className="text-right text-foreground">
                {manifest?.drrAtlas.provenance.toneMap ?? 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>3D calibration</dt>
              <dd className="text-right text-foreground">
                {manifest?.geometry.overlay_calibration?.method === 'centerline-carina'
                  ? 'Centerline carina'
                  : manifest
                    ? 'None'
                    : 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Field area</dt>
              <dd className="text-foreground">{(fieldArea * 100).toFixed(0)}%</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Segment metadata</dt>
              <dd className="text-foreground">{segmentMetadata?.segments.length ?? 0}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {manifest?.sourcePolicy ??
              'Raw source imaging remains local; the browser loads derived educational assets.'}
          </p>
          {manifest?.drrAtlas.provenance.note ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
              {manifest.drrAtlas.provenance.note}
            </p>
          ) : null}
        </details>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-950 dark:text-amber-100">
        {manifest?.safetyLabel ??
          'Educational simulation only — not for diagnosis, treatment, or procedure guidance.'}
      </div>
    </div>
  )
}

function ControlPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </div>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex justify-between gap-3 text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </label>
  )
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function PresetButtons({
  onSelect,
}: {
  onSelect: (raoLao: number, cranialCaudal: number) => void
}) {
  const presets = [
    { label: 'AP', rao: 0, cran: 0 },
    { label: 'Lat', rao: 60, cran: 0 },
    { label: 'RAO 30', rao: -30, cran: 0 },
    { label: 'LAO 30', rao: 30, cran: 0 },
    { label: 'Cran 20', rao: 0, cran: 20 },
    { label: 'Caud 20', rao: 0, cran: -20 },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className="rounded-md border border-border px-2 py-2 text-xs font-semibold hover:bg-accent"
          onClick={() => onSelect(preset.rao, preset.cran)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
