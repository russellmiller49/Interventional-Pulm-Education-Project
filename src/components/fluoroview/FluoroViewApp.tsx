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
import { Eye, EyeOff } from 'lucide-react'

import {
  findDrrBlendFrames,
  findNearestDrrFrame,
  validateFluoroCaseManifest,
} from '@fluoroview/case'
import { BRANCH_GROUPS } from '@fluoroview/grouping'
import {
  buildRoutePath,
  lpsToCtIndex,
  projectLpsToCanvas,
  projectLpsToDetector,
  projectLpsToSlicerCalibratedDetector,
  projectLpsToSlicerFrontalDetector,
  resolveScopeRoutePath,
  sampleRoutePath,
  type AirwaySnapResult,
  type DetectorProjection,
  type RoutePath,
  type ScopeRouteId,
} from '@fluoroview/interaction'
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
import { VolumeDRRRenderer, type DrrFrameMetrics } from '@fluoroview/volume-drr'
import type {
  AirwayGraph,
  AppState,
  CenterlineOverlay,
  CtAxis,
  CtVolumePreview,
  FluoroCaseManifest,
  OverlayMode,
  PreparedSegment,
  ScopePathPolyline,
  SegmentMetadata,
  Vec3,
} from '@fluoroview/types'

import { Badge } from '@/components/ui/badge'
import { CarmInsetView } from './CarmInsetView'
import { Anatomy3DView } from './Anatomy3DView'

const CASE_MANIFEST_URL = '/fluoroview/cases/patient-new/case_manifest.json'
const FALLBACK_CASE_MANIFEST_URL = '/fluoroview/cases/patient-4/case_manifest.json'
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
const EMPTY_GROUPS = new Set<string>()

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

interface NoduleState {
  lps: Vec3
  distanceMm: number
  edgeId: number
  routeTerminalNodeId: number
}

interface ProjectedAirwayPath {
  id: string
  d: string
  groupKey: string
  radiusMm: number
}

type RelativeLocationAnswer = 'anteromedial' | 'anterolateral' | 'posteromedial' | 'posterolateral'

interface NoduleQuizState {
  scopeRouteTerminalNodeId: number
  scopeProgress: number
  scopePoint: Vec3
  correctAnswer: RelativeLocationAnswer
  selectedAnswer: RelativeLocationAnswer | null
  locked: boolean
}

interface RandomNoduleQuizTarget {
  nodule: NoduleState
  quiz: NoduleQuizState
}

type FluoroImageSource = 'atlas' | 'slicerheart'
type FluoroWorkspaceTab = 'fluoro' | 'quiz'

const RELATIVE_LOCATION_OPTIONS: Array<{ value: RelativeLocationAnswer; label: string }> = [
  { value: 'anteromedial', label: 'Anteromedial' },
  { value: 'anterolateral', label: 'Anterolateral' },
  { value: 'posteromedial', label: 'Posteromedial' },
  { value: 'posterolateral', label: 'Posterolateral' },
]
const RANDOM_NODULE_ATTEMPTS = 192
const MIN_PERIPHERAL_ROUTE_LENGTH_MM = 95
const NODULE_MIN_DISTANCE_FROM_TERMINAL_MM = 8
const NODULE_MAX_DISTANCE_FROM_TERMINAL_MM = 34
const PREFERRED_SCOPE_DISTANCE_MM = 34
const PREFERRED_SCOPE_PROGRESS = 0.82
const PREFERRED_SCOPE_DISTANCE_FROM_TERMINAL_MM = 22
const FULL_RAO_LAO_LIMIT_DEG = 60
const QUIZ_RAO_LAO_LIMIT_DEG = 30

const SCOPE_PERIPHERAL_SEARCH_PASSES = [
  {
    minProgress: 0.66,
    minDistanceFromTerminalMm: 6,
    maxDistanceFromTerminalMm: 55,
    maxNoduleDistanceMm: 95,
  },
  {
    minProgress: 0.56,
    minDistanceFromTerminalMm: 0,
    maxDistanceFromTerminalMm: 80,
    maxNoduleDistanceMm: 110,
  },
]

function buildLegendEntries(segments: PreparedSegment[]): LegendEntry[] {
  const entries = BRANCH_GROUPS.map((group) => ({
    groupKey: group.key,
    groupLabel: group.label,
    items: segments
      .filter((segment) => segment.groupKey === group.key && isLegendSegment(segment.label))
      .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
      .map((segment) => ({
        label: segment.displayLabel,
        color: segment.color,
      })),
  })).filter((entry) => entry.items.length > 0)

  const otherSegments = segments.filter(
    (segment) => segment.groupKey === ORIGIN_GROUP && isLegendSegment(segment.label),
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

function isLegendSegment(label: string): boolean {
  return !/complete[_\s]?airway|tracheobronchial[_\s]?tree[_\s]?full|tree[_\s]?full/i.test(label)
}

function defaultCtIndices(manifest: FluoroCaseManifest): CtIndexByAxis {
  if (manifest.ctVolume && manifest.geometry.overlay_calibration?.carina_lps_mm) {
    const [i, j, k] = lpsToCtIndex(
      manifest.geometry.overlay_calibration.carina_lps_mm,
      manifest.ctVolume,
    )
    return {
      axial: clampIndex(Math.round(k), manifest.ctVolume.sizeXyz[2]),
      coronal: clampIndex(Math.round(j), manifest.ctVolume.sizeXyz[1]),
      sagittal: clampIndex(Math.round(i), manifest.ctVolume.sizeXyz[0]),
    }
  }
  return {
    axial: manifest.ctSlices.axes.axial.defaultIndex,
    coronal: manifest.ctSlices.axes.coronal.defaultIndex,
    sagittal: manifest.ctSlices.axes.sagittal.defaultIndex,
  }
}

function clampIndex(value: number, length: number): number {
  return Math.min(Math.max(value, 0), Math.max(length - 1, 0))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function distanceVec3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function routePointsUntilProgress(route: RoutePath, progress: number): Vec3[] {
  const targetDistance = clampNumber(progress, 0, 1) * route.lengthMm
  if (!route.points.length) return []
  const points: Vec3[] = [route.points[0]]
  if (targetDistance <= 0) return points

  let travelled = 0
  for (let index = 1; index < route.points.length; index += 1) {
    const prev = route.points[index - 1]
    const next = route.points[index]
    const segmentLength = distanceVec3(prev, next)
    if (travelled + segmentLength >= targetDistance) {
      const t = (targetDistance - travelled) / Math.max(segmentLength, 1e-6)
      points.push([
        prev[0] + (next[0] - prev[0]) * t,
        prev[1] + (next[1] - prev[1]) * t,
        prev[2] + (next[2] - prev[2]) * t,
      ])
      return points
    }
    points.push(next)
    travelled += segmentLength
  }
  return points
}

function relativeLocationAnswer(
  noduleLps: Vec3,
  scopeLps: Vec3,
  midlineXLps: number,
): RelativeLocationAnswer {
  const deltaY = noduleLps[1] - scopeLps[1]
  const ap = deltaY < 0 ? 'antero' : 'postero'
  const noduleDistanceFromMidline = Math.abs(noduleLps[0] - midlineXLps)
  const scopeDistanceFromMidline = Math.abs(scopeLps[0] - midlineXLps)
  const medial = noduleDistanceFromMidline < scopeDistanceFromMidline
  return `${ap}${medial ? 'medial' : 'lateral'}` as RelativeLocationAnswer
}

function buildNoduleQuiz(
  graph: AirwayGraph,
  snap: AirwaySnapResult,
  midlineXLps: number,
): NoduleQuizState | null {
  for (const pass of SCOPE_PERIPHERAL_SEARCH_PASSES) {
    let best: {
      terminalNodeId: number
      point: Vec3
      progress: number
      distanceMm: number
      score: number
    } | null = null

    for (const terminalNodeId of graph.terminalNodeIds) {
      if (terminalNodeId === snap.routeTerminalNodeId) continue
      const route = buildRoutePath(graph, terminalNodeId)
      if (route.points.length < 2 || route.lengthMm <= 0) continue

      let travelled = 0
      for (let index = 1; index < route.points.length; index += 1) {
        const prev = route.points[index - 1]
        const point = route.points[index]
        travelled += distanceVec3(prev, point)
        const distanceMm = distanceVec3(point, snap.lps)
        if (distanceMm < 10 || distanceMm > pass.maxNoduleDistanceMm) continue
        const progress = clampNumber(travelled / Math.max(route.lengthMm, 1), 0, 1)
        const distanceFromTerminalMm = Math.max(route.lengthMm - travelled, 0)
        if (progress < pass.minProgress) continue
        if (
          distanceFromTerminalMm < pass.minDistanceFromTerminalMm ||
          distanceFromTerminalMm > pass.maxDistanceFromTerminalMm
        ) {
          continue
        }
        const lateralSeparationMm = Math.abs(
          Math.abs(snap.lps[0] - midlineXLps) - Math.abs(point[0] - midlineXLps),
        )
        const anteriorPosteriorSeparationMm = Math.abs(snap.lps[1] - point[1])
        if (lateralSeparationMm < 6 || anteriorPosteriorSeparationMm < 6) continue
        const score =
          Math.abs(distanceMm - PREFERRED_SCOPE_DISTANCE_MM) +
          Math.abs(progress - PREFERRED_SCOPE_PROGRESS) * 14 +
          Math.abs(distanceFromTerminalMm - PREFERRED_SCOPE_DISTANCE_FROM_TERMINAL_MM) * 0.25
        if (!best || score < best.score) {
          best = { terminalNodeId, point, progress, distanceMm, score }
        }
      }
    }

    if (!best) continue

    return {
      scopeRouteTerminalNodeId: best.terminalNodeId,
      scopeProgress: best.progress,
      scopePoint: best.point,
      correctAnswer: relativeLocationAnswer(snap.lps, best.point, midlineXLps),
      selectedAnswer: null,
      locked: false,
    }
  }

  return null
}

function nearestSnapForRandomRoute(
  graph: AirwayGraph,
  lps: Vec3,
  routeTerminalNodeId: number,
): AirwaySnapResult | null {
  let best: AirwaySnapResult | null = null
  for (const edge of graph.edges) {
    for (const point of edge.pointsLps) {
      const distanceMm = distanceVec3(point, lps)
      if (!best || distanceMm < best.distanceMm) {
        best = {
          lps: point,
          distanceMm,
          edgeId: edge.id,
          routeTerminalNodeId,
        }
      }
    }
  }
  return best
}

function buildRandomNoduleQuizTarget(
  graph: AirwayGraph,
  manifest: FluoroCaseManifest,
  random = Math.random,
): RandomNoduleQuizTarget | null {
  const terminalNodeIds = graph.terminalNodeIds.filter((id) => Number.isFinite(id))
  if (!terminalNodeIds.length) return null

  for (let attempt = 0; attempt < RANDOM_NODULE_ATTEMPTS; attempt += 1) {
    const terminalNodeId =
      terminalNodeIds[Math.floor(random() * terminalNodeIds.length)] ?? terminalNodeIds[0]
    const route = buildRoutePath(graph, terminalNodeId)
    if (route.points.length < 8 || route.lengthMm < MIN_PERIPHERAL_ROUTE_LENGTH_MM) continue

    const distanceFromTerminalMm =
      NODULE_MIN_DISTANCE_FROM_TERMINAL_MM +
      random() * (NODULE_MAX_DISTANCE_FROM_TERMINAL_MM - NODULE_MIN_DISTANCE_FROM_TERMINAL_MM)
    const progress = clampNumber(
      (route.lengthMm - distanceFromTerminalMm) / Math.max(route.lengthMm, 1),
      0,
      1,
    )
    const sample = sampleRoutePath(route, progress)
    const snap = nearestSnapForRandomRoute(graph, sample.point, terminalNodeId)
    if (!snap) continue
    const targetSnap: AirwaySnapResult = {
      ...snap,
      lps: sample.point,
    }

    const quiz = buildNoduleQuiz(
      graph,
      targetSnap,
      graph.carinaLpsMm?.[0] ?? manifest.geometry.isocenter_mm[0],
    )
    if (!quiz) continue

    return {
      nodule: {
        lps: sample.point,
        distanceMm: snap.distanceMm,
        edgeId: snap.edgeId,
        routeTerminalNodeId: snap.routeTerminalNodeId,
      },
      quiz,
    }
  }

  return null
}

export function FluoroViewApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const volumeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const labelLayerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<FluoroRenderer | null>(null)
  const volumeRendererRef = useRef<VolumeDRRRenderer | null>(null)
  const interactingRef = useRef(false)
  const lowResIdleTimerRef = useRef<number | undefined>(undefined)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const needsRenderRef = useRef(false)
  const stateRef = useRef<AppState | null>(null)
  const settingsRef = useRef<FluoroSettings>(DEFAULT_FLUORO_SETTINGS)
  const lastOverlayModeRef = useRef<OverlayMode>('surface')
  const drrMetricsRef = useRef<DrrFrameMetrics>({
    thicknessProxy: 1,
    renderMs: 0,
    sampleSteps: 0,
    renderScale: 1,
  })

  const [manifest, setManifest] = useState<FluoroCaseManifest | null>(null)
  const [centerline, setCenterline] = useState<CenterlineOverlay | null>(null)
  const [airwayGraph, setAirwayGraph] = useState<AirwayGraph | null>(null)
  const [scopeAnimationPath, setScopeAnimationPath] = useState<ScopePathPolyline | null>(null)
  const [ctVolumeData, setCtVolumeData] = useState<Uint8Array | null>(null)
  const [segmentMetadata, setSegmentMetadata] = useState<SegmentMetadata | null>(null)
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([])
  const [appState, setAppState] = useState<AppState | null>(null)
  const [settings, setSettings] = useState<FluoroSettings>(DEFAULT_FLUORO_SETTINGS)
  const [doseState, setDoseState] = useState<DoseState>(EMPTY_DOSE_STATE)
  const [ctAxis, setCtAxis] = useState<CtAxis>('axial')
  const [ctIndices, setCtIndices] = useState<CtIndexByAxis>({ axial: 0, coronal: 0, sagittal: 0 })
  const [ctWindowPreset, setCtWindowPreset] = useState('lung')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [nodule, setNodule] = useState<NoduleState | null>(null)
  const [noduleQuiz, setNoduleQuiz] = useState<NoduleQuizState | null>(null)
  const [snapStatus, setSnapStatus] = useState('Open quiz mode to generate a random nodule.')
  const [scopeRouteId, setScopeRouteId] = useState<ScopeRouteId | null>(null)
  const [scopeProgress, setScopeProgress] = useState(0.45)
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<FluoroWorkspaceTab>('fluoro')
  const [renderStats, setRenderStats] = useState<RenderStats>({ fps: 0, visibleSegments: 0 })
  const [drrMetrics, setDrrMetrics] = useState<DrrFrameMetrics>(drrMetricsRef.current)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fluoroImageSource, setFluoroImageSource] = useState<FluoroImageSource>('atlas')

  const requestRender = useCallback(() => {
    needsRenderRef.current = true
  }, [])

  useEffect(() => {
    const canvasEl = canvasRef.current
    const labelLayerEl = labelLayerRef.current
    if (!canvasEl || !labelLayerEl) return

    let cancelled = false

    async function boot(canvas: HTMLCanvasElement, labelLayer: HTMLDivElement) {
      const attempted: string[] = []
      try {
        let loadedManifest: FluoroCaseManifest | null = null
        for (const manifestUrl of [CASE_MANIFEST_URL, FALLBACK_CASE_MANIFEST_URL]) {
          attempted.push(manifestUrl)
          try {
            const manifestRes = await fetch(manifestUrl, { cache: 'no-store' })
            if (!manifestRes.ok) {
              throw new Error(`HTTP ${manifestRes.status}`)
            }
            const candidateManifest = (await manifestRes.json()) as FluoroCaseManifest
            const manifestErrors = validateFluoroCaseManifest(candidateManifest)
            if (manifestErrors.length) {
              throw new Error(manifestErrors.join(' '))
            }
            loadedManifest = candidateManifest
            break
          } catch (manifestErr) {
            console.warn(
              `[FluoroView] Failed to load ${manifestUrl}; trying fallback if available.`,
              manifestErr,
            )
          }
        }
        if (!loadedManifest) {
          throw new Error(`Failed to load case manifests: ${attempted.join(', ')}`)
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
          calibrationProjection: loadedManifest.volumeDrr?.calibrationProjection,
        })
        rendererRef.current = renderer

        const airwayGlb = loadedManifest.assets.airwaySegmentsGlb ?? loadedManifest.assets.airwayGlb
        const [loadedSegments, centerlineRes, segmentRes, graphRes, scopePathRes, ctVolumeBuffer] =
          await Promise.all([
            renderer.loadGlb(airwayGlb, {
              dracoBaseUrl: loadedManifest.assets.dracoBaseUrl,
              transform: loadedManifest.assets.assetTransforms?.airway,
            }),
            fetch(loadedManifest.assets.centerlineJson),
            fetch(loadedManifest.assets.segmentMetadataJson),
            loadedManifest.assets.airwayGraphJson
              ? fetch(loadedManifest.assets.airwayGraphJson)
              : Promise.resolve(null),
            loadedManifest.scopeAnimation?.polylineJsonUri
              ? fetch(loadedManifest.scopeAnimation.polylineJsonUri)
              : Promise.resolve(null),
            loadedManifest.ctVolume?.rawUrl
              ? fetch(loadedManifest.ctVolume.rawUrl).then((response) => {
                  if (!response.ok) {
                    throw new Error(`Failed to load CT preview volume (${response.status})`)
                  }
                  return response.arrayBuffer()
                })
              : Promise.resolve(null),
          ])

        if (cancelled) return

        if (centerlineRes.ok) {
          setCenterline((await centerlineRes.json()) as CenterlineOverlay)
        }
        if (segmentRes.ok) {
          setSegmentMetadata((await segmentRes.json()) as SegmentMetadata)
        }
        let loadedGraph: AirwayGraph | null = null
        if (graphRes) {
          if (!graphRes.ok) {
            throw new Error(`Failed to load airway graph (${graphRes.status})`)
          }
          loadedGraph = (await graphRes.json()) as AirwayGraph
          setAirwayGraph(loadedGraph)
        } else {
          setAirwayGraph(null)
        }
        if (scopePathRes) {
          if (!scopePathRes.ok) {
            throw new Error(`Failed to load scope animation path (${scopePathRes.status})`)
          }
          setScopeAnimationPath((await scopePathRes.json()) as ScopePathPolyline)
        } else {
          setScopeAnimationPath(null)
        }
        if (ctVolumeBuffer) {
          setCtVolumeData(new Uint8Array(ctVolumeBuffer))
        } else {
          setCtVolumeData(null)
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
        const initialCtIndices = defaultCtIndices(loadedManifest)
        setCtIndices(initialCtIndices)
        setScopeRouteId(
          loadedManifest.scopeAnimation
            ? 'bezier-demo'
            : (loadedManifest.interaction?.defaultRouteTerminalNodeId ??
                loadedGraph?.terminalNodeIds[0] ??
                null),
        )
        setScopeProgress(loadedManifest.interaction?.defaultScopeProgress ?? 0.45)
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
      const volume = volumeRendererRef.current
      if (volume && volume.isReady()) {
        const metrics = volume.render({
          raoLaoDeg: stateRef.current.raoLao,
          cranialCaudalDeg: stateRef.current.cranialCaudal,
          settings: settingsRef.current,
          lowRes: interactingRef.current,
        })
        drrMetricsRef.current = metrics
        setDrrMetrics(metrics)
      }
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
      if (base.overlayMode !== 'off') {
        lastOverlayModeRef.current = base.overlayMode
      }
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

  const setOverlayHidden = useCallback(
    (hidden: boolean) => {
      updateState((prev) => {
        if (hidden) {
          if (prev.overlayMode !== 'off') {
            lastOverlayModeRef.current = prev.overlayMode
          }
          return { ...prev, overlayMode: 'off' }
        }
        return {
          ...prev,
          overlayMode: prev.overlayMode === 'off' ? lastOverlayModeRef.current : prev.overlayMode,
        }
      })
    },
    [updateState],
  )

  const updateSetting = useCallback(
    <K extends keyof FluoroSettings>(key: K, value: FluoroSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        settingsRef.current = next
        needsRenderRef.current = true
        return next
      })
    },
    [],
  )

  useEffect(() => {
    settingsRef.current = settings
    needsRenderRef.current = true
  }, [settings])

  const beginInteraction = useCallback(() => {
    interactingRef.current = true
    needsRenderRef.current = true
    if (lowResIdleTimerRef.current != null) {
      window.clearTimeout(lowResIdleTimerRef.current)
      lowResIdleTimerRef.current = undefined
    }
  }, [])

  const endInteraction = useCallback(() => {
    interactingRef.current = false
    if (lowResIdleTimerRef.current != null) {
      window.clearTimeout(lowResIdleTimerRef.current)
    }
    lowResIdleTimerRef.current = window.setTimeout(() => {
      needsRenderRef.current = true
    }, 140)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const isRange = (el: EventTarget | null) =>
      el instanceof HTMLInputElement && el.type === 'range'
    const onDown = (e: PointerEvent) => {
      if (isRange(e.target)) beginInteraction()
    }
    const onUp = (e: PointerEvent) => {
      if (isRange(e.target) || interactingRef.current) endInteraction()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onUp, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onUp, true)
    }
  }, [beginInteraction, endInteraction])

  useEffect(() => {
    return () => {
      volumeRendererRef.current?.dispose()
      volumeRendererRef.current = null
      if (lowResIdleTimerRef.current != null) {
        window.clearTimeout(lowResIdleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!manifest?.volumeDrr) {
      volumeRendererRef.current?.dispose()
      volumeRendererRef.current = null
      return
    }
    const canvasEl = volumeCanvasRef.current
    if (!canvasEl) return
    let cancelled = false
    volumeRendererRef.current?.dispose()
    const volume = new VolumeDRRRenderer({
      canvas: canvasEl,
      config: manifest.geometry,
      asset: manifest.volumeDrr,
    })
    volumeRendererRef.current = volume
    volume.load().then(
      () => {
        if (cancelled) {
          volume.dispose()
          volumeRendererRef.current = null
          return
        }
        needsRenderRef.current = true
      },
      (err) => {
        console.error('[FluoroView] VolumeDRRRenderer init failed:', err)
      },
    )
    return () => {
      cancelled = true
      volume.dispose()
      if (volumeRendererRef.current === volume) {
        volumeRendererRef.current = null
      }
    }
  }, [manifest])

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

  useEffect(() => {
    if (!manifest?.ctVolume) return
    setCtIndices((prev) => ({
      axial: clampIndex(prev.axial, manifest.ctVolume!.sizeXyz[2]),
      coronal: clampIndex(prev.coronal, manifest.ctVolume!.sizeXyz[1]),
      sagittal: clampIndex(prev.sagittal, manifest.ctVolume!.sizeXyz[0]),
    }))
  }, [manifest?.ctVolume])

  const nearestFrame = useMemo(() => {
    if (!manifest || !appState) return null
    const frames = manifest.drrAtlas?.frames
    if (!frames?.length) return null
    return findNearestDrrFrame(frames, appState.raoLao, appState.cranialCaudal)
  }, [appState, manifest])

  const drrBlendFrames = useMemo(() => {
    if (!manifest || !appState) return []
    const frames = manifest.drrAtlas?.frames
    if (!frames?.length) return []
    return findDrrBlendFrames(frames, appState.raoLao, appState.cranialCaudal)
  }, [appState, manifest])

  const volumeDrrActive = Boolean(manifest?.volumeDrr)

  const slicerReferenceAvailable = Boolean(
    manifest?.virtualCathLab?.frontalImageUrl && manifest.virtualCathLab.frontalProjection,
  )
  const isSlicerReferenceMode = fluoroImageSource === 'slicerheart' && slicerReferenceAvailable
  const fluoroAspectRatio = useMemo(() => {
    const pixels =
      isSlicerReferenceMode && manifest?.virtualCathLab?.frontalDetectorPixels
        ? manifest.virtualCathLab.frontalDetectorPixels
        : manifest?.geometry.detector_pixels
    return pixels ? `${pixels[0]} / ${pixels[1]}` : '1 / 1'
  }, [isSlicerReferenceMode, manifest])

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

  const activeRoute = useMemo<RoutePath | null>(() => {
    return resolveScopeRoutePath({
      graph: airwayGraph,
      animationPath: scopeAnimationPath,
      routeId: scopeRouteId,
    })
  }, [airwayGraph, scopeAnimationPath, scopeRouteId])

  const scopeSample = useMemo(() => {
    return activeRoute ? sampleRoutePath(activeRoute, scopeProgress) : null
  }, [activeRoute, scopeProgress])

  const projectFluoroPoint = useCallback(
    (point: Vec3): DetectorProjection | null => {
      if (!manifest || !appState) return null
      if (isSlicerReferenceMode && manifest.virtualCathLab?.frontalProjection) {
        return projectLpsToSlicerFrontalDetector(point, manifest.virtualCathLab.frontalProjection)
      }
      if (manifest.volumeDrr?.calibrationProjection) {
        return projectLpsToSlicerCalibratedDetector(
          point,
          manifest.geometry,
          manifest.volumeDrr.calibrationProjection,
          appState.raoLao,
          appState.cranialCaudal,
        )
      }
      return projectLpsToDetector(point, manifest.geometry, appState.raoLao, appState.cranialCaudal)
    },
    [appState, isSlicerReferenceMode, manifest],
  )

  const projectRegisteredAirwayPoint = useCallback(
    (point: Vec3): DetectorProjection | null => {
      return projectFluoroPoint(point)
    },
    [projectFluoroPoint],
  )

  const projectedNodule = useMemo(() => {
    if (!manifest || !appState || activeWorkspaceTab !== 'quiz' || !nodule) return null
    return projectFluoroPoint(nodule.lps)
  }, [activeWorkspaceTab, appState, manifest, nodule, projectFluoroPoint])

  const quizScopePathPoints = useMemo(() => {
    if (!noduleQuiz || !activeRoute) return []
    return routePointsUntilProgress(activeRoute, scopeProgress)
  }, [activeRoute, noduleQuiz, scopeProgress])

  const projectedQuizScopePath = useMemo(() => {
    if (!manifest || !appState || activeWorkspaceTab !== 'quiz' || quizScopePathPoints.length < 2) {
      return null
    }
    const projected = quizScopePathPoints
      .map((point) => projectRegisteredAirwayPoint(point))
      .filter(
        (projection): projection is DetectorProjection => projection !== null && projection.inFrame,
      )
    if (projected.length < 2) return null
    return projected
      .map((projection, index) => {
        const [x, y] = projection.point
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`
      })
      .join(' ')
  }, [activeWorkspaceTab, appState, manifest, projectRegisteredAirwayPoint, quizScopePathPoints])

  const projectedAirwayPaths = useMemo<ProjectedAirwayPath[]>(() => {
    if (
      !centerline ||
      !appState ||
      appState.overlayMode !== 'centerline' ||
      isSlicerReferenceMode ||
      centerline.coordinateSystem !== 'LPS'
    ) {
      return []
    }
    const paths: ProjectedAirwayPath[] = []
    for (const polyline of centerline.polylines) {
      const points = polyline.pointsLps ?? []
      const projected = points
        .map((point) => projectRegisteredAirwayPoint(point))
        .filter((projection): projection is DetectorProjection => Boolean(projection))
      if (projected.length < 2) continue

      const d = projected
        .map((projection, index) => {
          const [x, y] = projection.point
          const command = index === 0 ? 'M' : 'L'
          return `${command}${x.toFixed(3)} ${y.toFixed(3)}`
        })
        .join(' ')
      paths.push({
        id: polyline.id,
        d,
        groupKey: 'centerline',
        radiusMm: 1.35,
      })
    }
    return paths
  }, [appState, centerline, isSlicerReferenceMode, projectRegisteredAirwayPoint])

  const noduleScopeDistance = useMemo(() => {
    if (!nodule || !scopeSample) return null
    return Math.hypot(
      nodule.lps[0] - scopeSample.point[0],
      nodule.lps[1] - scopeSample.point[1],
      nodule.lps[2] - scopeSample.point[2],
    )
  }, [nodule, scopeSample])

  const thicknessProxy = volumeDrrActive
    ? drrMetrics.thicknessProxy
    : drrBlendFrames.length
      ? drrBlendFrames.reduce((total, item) => total + item.frame.thicknessProxy * item.weight, 0)
      : (nearestFrame?.thicknessProxy ?? 1)
  const doseRate = estimateRelativeDoseRate(settings, thicknessProxy)
  const fieldArea = fieldAreaFraction(settings)

  const fluoroFrameStyle = useMemo<CSSProperties>(
    () => ({
      clipPath: collimationClipPath(settings),
      transform: `scale(${imageScaleForSettings(settings)})`,
    }),
    [settings],
  )

  const fluoroImageStyle = useMemo<CSSProperties>(
    () => ({
      ...fluoroFrameStyle,
      filter: imageFilterForSettings(settings, thicknessProxy),
    }),
    [fluoroFrameStyle, settings, thicknessProxy],
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

  const generateRandomNoduleQuiz = useCallback(() => {
    if (!airwayGraph || !manifest?.interaction) {
      setSnapStatus('Airway graph is still loading; a random quiz nodule will appear shortly.')
      return false
    }

    const target = buildRandomNoduleQuizTarget(airwayGraph, manifest)
    if (!target) {
      setNodule(null)
      setNoduleQuiz(null)
      setSnapStatus('Unable to generate a randomized nearby-branch quiz from this airway graph.')
      return false
    }

    setNodule(target.nodule)
    setNoduleQuiz(target.quiz)
    setScopeRouteId(target.quiz.scopeRouteTerminalNodeId)
    setScopeProgress(target.quiz.scopeProgress)
    setOverlayHidden(true)
    setSnapStatus(
      'Random quiz nodule generated. The scope is intentionally parked in a nearby incorrect airway branch.',
    )
    return true
  }, [airwayGraph, manifest, setOverlayHidden])

  const overlayMode = appState?.overlayMode ?? 'off'
  const quizOverlayLocked =
    activeWorkspaceTab === 'quiz' && Boolean(noduleQuiz && !noduleQuiz.locked)
  const quizAnglesLimited = activeWorkspaceTab === 'quiz' && !noduleQuiz?.locked
  const raoLaoLimitDeg = quizAnglesLimited ? QUIZ_RAO_LAO_LIMIT_DEG : FULL_RAO_LAO_LIMIT_DEG
  const overlayHidden = overlayMode === 'off' || quizOverlayLocked
  const overlayOpacity = appState?.overlayOpacity ?? 0
  const glbOverlayOpacity =
    quizOverlayLocked || overlayMode === 'off' || isSlicerReferenceMode
      ? 0
      : overlayMode === 'centerline'
        ? Math.min(overlayOpacity, 0.22)
        : overlayOpacity

  const selectQuizAnswer = useCallback((answer: RelativeLocationAnswer) => {
    setNoduleQuiz((prev) => (prev && !prev.locked ? { ...prev, selectedAnswer: answer } : prev))
  }, [])

  const lockQuizAnswer = useCallback(() => {
    setNoduleQuiz((prev) => {
      if (!prev?.selectedAnswer) return prev
      return { ...prev, locked: true }
    })
    setOverlayHidden(false)
  }, [setOverlayHidden])

  const resetNoduleQuiz = useCallback(() => {
    generateRandomNoduleQuiz()
  }, [generateRandomNoduleQuiz])

  useEffect(() => {
    if (activeWorkspaceTab !== 'quiz' || nodule || noduleQuiz || !airwayGraph || !manifest) return
    generateRandomNoduleQuiz()
  }, [activeWorkspaceTab, airwayGraph, generateRandomNoduleQuiz, manifest, nodule, noduleQuiz])

  useEffect(() => {
    if (!quizAnglesLimited || !appState) return
    const clampedRaoLao = clampNumber(
      appState.raoLao,
      -QUIZ_RAO_LAO_LIMIT_DEG,
      QUIZ_RAO_LAO_LIMIT_DEG,
    )
    if (clampedRaoLao === appState.raoLao) return
    updateState((prev) => ({
      ...prev,
      raoLao: clampNumber(prev.raoLao, -QUIZ_RAO_LAO_LIMIT_DEG, QUIZ_RAO_LAO_LIMIT_DEG),
    }))
  }, [appState, quizAnglesLimited, updateState])

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
                {isSlicerReferenceMode
                  ? 'SlicerHeart frontal reference from the exported C-arm scene.'
                  : volumeDrrActive
                    ? 'Real-time volumetric DRR rendered in WebGL2 from the source CT.'
                    : 'Relative educational DRR atlas with browser-side knobology.'}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-xs">
              {isSlicerReferenceMode
                ? 'SlicerHeart ref'
                : volumeDrrActive
                  ? 'Volume DRR'
                  : drrBlendFrames.length > 1
                    ? `${drrBlendFrames.length}-frame blend`
                    : nearestFrame
                      ? nearestFrame.id
                      : 'Loading'}
            </Badge>
          </div>
          <div
            className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-950"
            style={{ aspectRatio: fluoroAspectRatio }}
          >
            {isSlicerReferenceMode && manifest?.virtualCathLab?.frontalImageUrl ? (
              <Image
                src={manifest.virtualCathLab.frontalImageUrl}
                alt="SlicerHeart Virtual Cath Lab frontal reference frame"
                fill
                unoptimized
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain"
                style={fluoroImageStyle}
              />
            ) : volumeDrrActive ? (
              <canvas
                ref={volumeCanvasRef}
                width={1024}
                height={1024}
                aria-label={`Real-time volumetric DRR at RAO/LAO ${appState?.raoLao ?? 0} cranial/caudal ${appState?.cranialCaudal ?? 0}`}
                className="absolute inset-0 h-full w-full"
                style={fluoroImageStyle}
              />
            ) : drrBlendFrames.length ? (
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
                Loading fluoroscopy renderer...
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-slate-200 mix-blend-screen"
              style={{ opacity: scatterOpacityForSettings(settings, thicknessProxy) }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen"
              style={{
                opacity: noiseOpacityForSettings(settings) * (volumeDrrActive ? 0.35 : 1),
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, white 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 0 1px, transparent 1px)',
                backgroundSize: '7px 7px, 11px 11px',
              }}
            />
            {centerline &&
            centerline.coordinateSystem !== 'LPS' &&
            appState?.overlayMode === 'centerline' &&
            !quizOverlayLocked &&
            !isSlicerReferenceMode ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                aria-hidden
              >
                {centerline.polylines.map((polyline) => (
                  <polyline
                    key={polyline.id}
                    points={(polyline.points ?? []).map((point) => point.join(',')).join(' ')}
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
                ...fluoroFrameStyle,
                opacity: glbOverlayOpacity,
                pointerEvents:
                  appState?.overlayMode === 'off' || isSlicerReferenceMode ? 'none' : 'auto',
              }}
            />
            <div
              ref={labelLayerRef}
              className="pointer-events-none absolute inset-0"
              style={{ opacity: quizOverlayLocked ? 0 : 1 }}
            />
            {projectedAirwayPaths.length > 0 && !overlayHidden ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                aria-hidden
                style={fluoroFrameStyle}
              >
                {projectedAirwayPaths.map((path) => {
                  const strokeWidth = airwayStrokeWidthPercent(path.radiusMm, manifest, overlayMode)
                  const coreColor = overlayMode === 'centerline' ? '#facc15' : '#fff7d6'
                  const coreOpacity =
                    overlayMode === 'centerline' ? 0.92 : Math.max(0.28, overlayOpacity)
                  return (
                    <g key={path.id}>
                      <path
                        d={path.d}
                        fill="none"
                        stroke="#020617"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={strokeWidth + 0.34}
                        opacity={overlayMode === 'centerline' ? 0.58 : 0.46}
                      />
                      <path
                        d={path.d}
                        fill="none"
                        stroke={coreColor}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={strokeWidth}
                        opacity={coreOpacity}
                      />
                    </g>
                  )
                })}
              </svg>
            ) : null}
            {projectedNodule || projectedQuizScopePath ? (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                aria-hidden
                style={fluoroFrameStyle}
              >
                {projectedQuizScopePath ? (
                  <g>
                    <path
                      d={projectedQuizScopePath}
                      fill="none"
                      stroke="#ffffff"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.9"
                      opacity="0.9"
                    />
                    <path
                      d={projectedQuizScopePath}
                      fill="none"
                      stroke="#020617"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.05"
                      opacity="0.96"
                    />
                  </g>
                ) : null}
                {projectedNodule ? (
                  <g
                    transform={`translate(${projectedNodule.point[0]} ${projectedNodule.point[1]})`}
                  >
                    <circle
                      r="3.2"
                      fill="rgba(244,63,94,0.25)"
                      stroke="#fb7185"
                      strokeWidth="0.7"
                    />
                    <line x1="-4.5" x2="4.5" y1="0" y2="0" stroke="#fb7185" strokeWidth="0.45" />
                    <line x1="0" x2="0" y1="-4.5" y2="4.5" stroke="#fb7185" strokeWidth="0.45" />
                  </g>
                ) : null}
              </svg>
            ) : null}
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-slate-300">
                Loading FluoroView...
              </div>
            ) : null}
            <div className="absolute left-3 top-3 rounded bg-slate-950/70 px-2 py-1 text-xs text-slate-200">
              FPS {renderStats.fps.toFixed(1)} | segments {renderStats.visibleSegments}
              {volumeDrrActive ? ` | DRR ${drrMetrics.renderMs.toFixed(0)} ms` : ''}
            </div>
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-slate-100 shadow-sm backdrop-blur transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => {
                if (!quizOverlayLocked) setOverlayHidden(!overlayHidden)
              }}
              disabled={quizOverlayLocked}
              aria-label={
                quizOverlayLocked
                  ? '3D overlay locked for quiz'
                  : overlayHidden
                    ? 'Show 3D overlay'
                    : 'Hide 3D overlay'
              }
              title={
                quizOverlayLocked
                  ? '3D overlay locked for quiz'
                  : overlayHidden
                    ? 'Show 3D overlay'
                    : 'Hide 3D overlay'
              }
            >
              {overlayHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {atlasDelta ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {isSlicerReferenceMode
                ? `SlicerHeart reference uses exported detector geometry${
                    manifest?.virtualCathLab?.cArm?.sourceToImageDistanceMm
                      ? `, SID ${manifest.virtualCathLab.cArm.sourceToImageDistanceMm} mm`
                      : ''
                  }. Mesh overlay is hidden because this frame already contains Slicer's airway render.`
                : `Continuous atlas blend: ${atlasBlendDescription || 'Loading'}. Nearest delta ${atlasDelta.rao.toFixed(1)} / ${atlasDelta.cranial.toFixed(1)} deg.`}
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
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-background/60 p-1">
            {[
              { id: 'fluoro' as const, label: 'Fluoro controls' },
              { id: 'quiz' as const, label: 'Quiz mode' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rounded px-3 py-2 text-sm font-semibold transition ${
                  activeWorkspaceTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
                onClick={() => setActiveWorkspaceTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeWorkspaceTab === 'fluoro' ? (
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
                        {group.items.length > 4 ? (
                          <span>+ {group.items.length - 4} more</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          ) : (
            <div className="mb-5 rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
              A randomized nodule is selected from the airway graph. Choose its location relative to
              the bronchoscope path, then lock your answer to reveal CT correlation. RAO/LAO
              rotation is intentionally limited to 30 degrees during the quiz so localization
              requires inference; the full 60-degree range unlocks after you lock an answer.
            </div>
          )}
          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            <ControlPanel title="C-arm">
              <PresetButtons
                raoLaoLimitDeg={raoLaoLimitDeg}
                onSelect={(raoLao, cranialCaudal) =>
                  updateState((prev) => ({
                    ...prev,
                    raoLao: clampNumber(raoLao, -raoLaoLimitDeg, raoLaoLimitDeg),
                    cranialCaudal,
                  }))
                }
              />
              {appState ? (
                <>
                  <RangeControl
                    label="RAO / LAO"
                    value={appState.raoLao}
                    min={-raoLaoLimitDeg}
                    max={raoLaoLimitDeg}
                    step={0.5}
                    unit="deg"
                    onInteractionStart={beginInteraction}
                    onInteractionEnd={endInteraction}
                    onChange={(value) => updateState((prev) => ({ ...prev, raoLao: value }))}
                  />
                  <RangeControl
                    label="Cranial / Caudal"
                    value={appState.cranialCaudal}
                    min={-20}
                    max={20}
                    step={0.5}
                    unit="deg"
                    onInteractionStart={beginInteraction}
                    onInteractionEnd={endInteraction}
                    onChange={(value) => updateState((prev) => ({ ...prev, cranialCaudal: value }))}
                  />
                  {activeWorkspaceTab === 'quiz' ? (
                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                      {quizAnglesLimited
                        ? 'Quiz view limits RAO/LAO rotation to 30 degrees until you lock an answer.'
                        : 'Answer locked. Full 60-degree RAO/LAO review is now available.'}
                    </p>
                  ) : null}
                </>
              ) : null}
              {atlasDelta ? (
                <p className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                  {isSlicerReferenceMode && manifest?.virtualCathLab?.cArm
                    ? `Slicer export L/P/C ${manifest.virtualCathLab.cArm.frontalArmAngleLDeg ?? 'n/a'} / ${manifest.virtualCathLab.cArm.frontalArmAnglePDeg ?? 'n/a'} / ${manifest.virtualCathLab.cArm.frontalArmAngleCDeg ?? 'n/a'} deg.`
                    : `Continuous blend delta ${atlasDelta.rao.toFixed(1)} / ${atlasDelta.cranial.toFixed(1)} deg.`}
                </p>
              ) : null}
              {manifest?.cArm && appState ? (
                <CarmInsetView
                  raoLao={appState.raoLao}
                  cranialCaudal={appState.cranialCaudal}
                  cArm={manifest.cArm}
                  airwayGlbUri={manifest.assets.airwaySegmentsGlb ?? manifest.assets.airwayGlb}
                  dracoBaseUrl={manifest.assets.dracoBaseUrl}
                  className="pointer-events-none mt-3 h-44 w-full overflow-hidden rounded-lg border border-white/15 bg-slate-950/80 shadow-sm"
                />
              ) : null}
            </ControlPanel>

            {activeWorkspaceTab === 'fluoro' ? (
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
            ) : null}

            {activeWorkspaceTab === 'fluoro' ? (
              <ControlPanel title="Overlay And Dose">
                {appState ? (
                  <>
                    <label className="grid gap-1 text-sm">
                      <span className="text-muted-foreground">3D overlay</span>
                      <select
                        className="rounded-md border border-border bg-background px-3 py-2"
                        value={appState.overlayMode}
                        disabled={quizOverlayLocked}
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
                      {quizOverlayLocked ? (
                        <span className="text-xs text-muted-foreground">
                          Quiz mode keeps the 3D overlay hidden until the answer is locked.
                        </span>
                      ) : null}
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
                    <span className="text-right">
                      {doseState.elapsedFluoroSeconds.toFixed(1)} s
                    </span>
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
            ) : null}

            {activeWorkspaceTab === 'quiz' ? (
              <ControlPanel title="Scope And Target">
                <div className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Randomized quiz target</div>
                  <p className="mt-1">{snapStatus}</p>
                  {nodule && noduleQuiz?.locked ? (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      <span>Quiz scope offset</span>
                      <span className="text-right text-foreground">
                        {noduleScopeDistance ? `${noduleScopeDistance.toFixed(1)} mm` : 'Pending'}
                      </span>
                    </div>
                  ) : nodule ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      CT target markers stay hidden until the answer is locked.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-3 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground"
                    onClick={resetNoduleQuiz}
                  >
                    New random quiz
                  </button>
                </div>
                {noduleQuiz ? (
                  <div className="grid gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        Relative location quiz
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        The scope tip is parked in a nearby incorrect airway. Where is the nodule
                        relative to the scope tip?
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {RELATIVE_LOCATION_OPTIONS.map((option) => {
                        const selected = noduleQuiz.selectedAnswer === option.value
                        const correct = noduleQuiz.correctAnswer === option.value
                        const reveal = noduleQuiz.locked
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                              reveal && correct
                                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                                : selected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-background hover:bg-accent'
                            }`}
                            onClick={() => selectQuizAnswer(option.value)}
                            disabled={noduleQuiz.locked}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={lockQuizAnswer}
                      disabled={!noduleQuiz.selectedAnswer || noduleQuiz.locked}
                    >
                      Lock answer and reveal 3D
                    </button>
                    {noduleQuiz.locked ? (
                      <p className="rounded-md border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
                        Correct answer:{' '}
                        {
                          RELATIVE_LOCATION_OPTIONS.find(
                            (option) => option.value === noduleQuiz.correctAnswer,
                          )?.label
                        }
                        .
                        {noduleQuiz.selectedAnswer === noduleQuiz.correctAnswer
                          ? ' Nice localization.'
                          : ' Compare the nodule and scope tip with the revealed airway overlay.'}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        The 3D overlay is hidden until the answer is locked.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                    A random quiz nodule will be generated as soon as the airway graph is ready.
                  </p>
                )}
              </ControlPanel>
            ) : null}

            {activeWorkspaceTab === 'quiz' ? (
              <ControlPanel title="Field And Image">
                {slicerReferenceAvailable ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Fluoro source</span>
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2"
                      value={fluoroImageSource}
                      onChange={(event) =>
                        setFluoroImageSource(event.target.value as FluoroImageSource)
                      }
                    >
                      <option value="atlas">
                        {volumeDrrActive ? 'Volume DRR' : 'TIGRE continuous atlas'}
                      </option>
                      {slicerReferenceAvailable ? (
                        <option value="slicerheart">SlicerHeart reference</option>
                      ) : null}
                    </select>
                  </label>
                ) : null}
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
            ) : null}

            {activeWorkspaceTab === 'fluoro' ? (
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
            ) : null}

            {activeWorkspaceTab === 'fluoro' ? (
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
            ) : null}
          </div>
        </section>

        {activeWorkspaceTab === 'quiz' ? (
          <section className="rounded-lg border border-border/70 bg-card/70 p-4 xl:col-start-1">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">CT Correlation</h2>
                <p className="text-xs text-muted-foreground">
                  Review the CT after locking your answer. The nodule and bronchoscope path are
                  hidden here until then.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full text-xs">
                {ctAxis}
              </Badge>
            </div>
            <div className="grid items-start gap-4">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-slate-950">
                {manifest?.ctVolume && ctVolumeData ? (
                  <CtVolumeCanvas
                    axis={ctAxis}
                    ctVolume={manifest.ctVolume}
                    volume={ctVolumeData}
                    sliceIndex={ctIndices[ctAxis] ?? 0}
                    windowPreset={ctWindowPreset}
                    nodule={noduleQuiz?.locked ? nodule : null}
                    noduleRadiusMm={manifest.interaction?.noduleRadiusMm ?? 10}
                    scopePathPoints={noduleQuiz?.locked ? quizScopePathPoints : []}
                  />
                ) : ctFrame ? (
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
                <div className="grid gap-3 sm:grid-cols-2">
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
                      max={
                        manifest.ctVolume
                          ? ctAxisLength(manifest.ctVolume, ctAxis) - 1
                          : manifest.ctSlices.axes[ctAxis].frames.length - 1
                      }
                      step={1}
                      value={ctIndices[ctAxis] ?? 0}
                      onChange={(event) =>
                        setCtIndices((prev) => ({ ...prev, [ctAxis]: Number(event.target.value) }))
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                  <div className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground sm:col-span-2">
                    <div className="font-medium text-foreground">Quiz status</div>
                    <p className="mt-1">{snapStatus}</p>
                  </div>
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
        ) : null}

        <details className="rounded-lg border border-border/70 bg-card/70 p-4 xl:col-span-2">
          <summary className="cursor-pointer text-base font-semibold text-foreground">
            <span className="ml-2 inline-flex items-center gap-3">
              <span>Case Data</span>
              <Badge variant="outline" className="rounded-full text-xs">
                {volumeDrrActive
                  ? 'volume-drr'
                  : (manifest?.drrAtlas?.provenance.backend ?? 'Loading')}
              </Badge>
            </span>
          </summary>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt>Case</dt>
              <dd className="text-right text-foreground">{manifest?.title ?? 'Loading'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Renderer</dt>
              <dd className="text-right text-foreground">
                {volumeDrrActive ? 'Real-time volumetric DRR' : 'Atlas-based DRR'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Atlas frames</dt>
              <dd className="text-foreground">{manifest?.drrAtlas?.frames.length ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Atlas backend</dt>
              <dd className="text-right text-foreground">
                {manifest?.drrAtlas?.provenance.backend ?? 'n/a'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Detector</dt>
              <dd className="text-foreground">
                {manifest?.drrAtlas?.provenance.detectorPixels?.join(' x ') ??
                  manifest?.geometry.detector_pixels.join(' x ') ??
                  'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Image orientation</dt>
              <dd className="text-right text-foreground">
                {manifest?.drrAtlas?.provenance.imageOrientation ?? 'AP'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>DRR tone map</dt>
              <dd className="text-right text-foreground">
                {manifest?.drrAtlas?.provenance.toneMap ??
                  (volumeDrrActive ? 'shader-tonemap' : 'Loading')}
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
            <div className="flex justify-between gap-3">
              <dt>Airway graph</dt>
              <dd className="text-foreground">
                {airwayGraph ? `${airwayGraph.edges.length} edges` : 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>CT preview</dt>
              <dd className="text-right text-foreground">
                {manifest?.ctVolume ? manifest.ctVolume.sizeXyz.join(' x ') : 'Loading'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>SlicerHeart ref</dt>
              <dd className="text-right text-foreground">
                {manifest?.virtualCathLab ? 'Available' : 'Not loaded'}
              </dd>
            </div>
            {manifest?.virtualCathLab?.frontalDetectorPixels ? (
              <div className="flex justify-between gap-3">
                <dt>SlicerHeart detector</dt>
                <dd className="text-right text-foreground">
                  {manifest.virtualCathLab.frontalDetectorPixels.join(' x ')}
                </dd>
              </div>
            ) : null}
            {manifest?.virtualCathLab?.cArm?.sourceToImageDistanceMm ? (
              <div className="flex justify-between gap-3">
                <dt>SlicerHeart SID</dt>
                <dd className="text-right text-foreground">
                  {manifest.virtualCathLab.cArm.sourceToImageDistanceMm} mm
                </dd>
              </div>
            ) : null}
            {manifest?.virtualCathLab?.cArm ? (
              <div className="flex justify-between gap-3">
                <dt>SlicerHeart L/P/C</dt>
                <dd className="text-right text-foreground">
                  {manifest.virtualCathLab.cArm.frontalArmAngleLDeg ?? 'n/a'} /{' '}
                  {manifest.virtualCathLab.cArm.frontalArmAnglePDeg ?? 'n/a'} /{' '}
                  {manifest.virtualCathLab.cArm.frontalArmAngleCDeg ?? 'n/a'} deg
                </dd>
              </div>
            ) : null}
          </dl>
          {manifest?.virtualCathLab?.frontalImageUrl ? (
            <div className="mt-3 overflow-hidden rounded-md border border-border/70 bg-background">
              <Image
                src={manifest.virtualCathLab.frontalImageUrl}
                alt="SlicerHeart Virtual Cath Lab frontal reference frame"
                width={587}
                height={800}
                className="h-auto w-full"
              />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            {manifest?.sourcePolicy ??
              'Raw source imaging remains local; the browser loads derived educational assets.'}
          </p>
          {manifest?.virtualCathLab?.note ? (
            <p className="mt-2 text-xs text-sky-700 dark:text-sky-200">
              {manifest.virtualCathLab.note}
            </p>
          ) : null}
          {manifest?.drrAtlas?.provenance.note ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
              {manifest.drrAtlas.provenance.note}
            </p>
          ) : null}
        </details>
      </div>

      {activeWorkspaceTab === 'quiz' &&
      manifest &&
      airwayGraph &&
      (!noduleQuiz || noduleQuiz.locked) ? (
        <section className="rounded-lg border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                3D Anatomy &amp; Bronchoscope
              </h2>
              <p className="text-xs text-muted-foreground">
                Orbit, zoom, and pan the airway. The scope tube extends along the active route as
                you slide scope progress.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-xs">
              {activeRoute?.points.length
                ? `${activeRoute.points.length} pts | ${activeRoute.lengthMm.toFixed(0)} mm`
                : 'No route'}
            </Badge>
          </div>
          <Anatomy3DView
            airwayGlbUri={manifest.assets.airwaySegmentsGlb ?? manifest.assets.airwayGlb}
            dracoBaseUrl={manifest.assets.dracoBaseUrl}
            activeGroups={appState?.activeGroups ?? EMPTY_GROUPS}
            airwayTransform={manifest.assets.assetTransforms?.airway}
            route={activeRoute}
            scopeProgress={scopeProgress}
            noduleLps={nodule?.lps ?? null}
            tubeRadiusMm={manifest.scopeAnimation?.tubeRadiusMm ?? 2.5}
            tubeColor={manifest.scopeAnimation?.tubeColor ?? '#1a1a1a'}
          />
        </section>
      ) : activeWorkspaceTab === 'quiz' && manifest && airwayGraph && noduleQuiz ? (
        <section className="rounded-lg border border-dashed border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                3D Anatomy &amp; Bronchoscope
              </h2>
              <p className="text-xs text-muted-foreground">
                Locked for the quiz. Choose a relative nodule location, then lock your answer to
                reveal the airway model and scope position.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-xs">
              Quiz hidden
            </Badge>
          </div>
        </section>
      ) : null}

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

function airwayStrokeWidthPercent(
  radiusMm: number,
  manifest: FluoroCaseManifest | null,
  mode: OverlayMode,
): number {
  const detectorHeightMm =
    manifest?.volumeDrr?.calibrationProjection?.detectorSizeMm[1] ??
    (manifest?.geometry.detector_pixels[1] ?? 1024) * (manifest?.geometry.pixel_pitch_mm ?? 0.5)
  const diameterPercent = (Math.max(radiusMm, 0.5) * 2 * 100) / Math.max(detectorHeightMm, 1)
  if (mode === 'centerline') return clampNumber(diameterPercent * 0.28, 0.16, 0.72)
  if (mode === 'wireframe') return clampNumber(diameterPercent * 0.46, 0.2, 1.1)
  return clampNumber(diameterPercent * 0.72, 0.28, 2.35)
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
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
        onPointerDown={onInteractionStart}
        onPointerUp={onInteractionEnd}
        onPointerCancel={onInteractionEnd}
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

function CtVolumeCanvas({
  axis,
  ctVolume,
  volume,
  sliceIndex,
  windowPreset,
  nodule,
  noduleRadiusMm,
  scopePathPoints,
}: {
  axis: CtAxis
  ctVolume: CtVolumePreview
  volume: Uint8Array
  sliceIndex: number
  windowPreset: string
  nodule: NoduleState | null
  noduleRadiusMm: number
  scopePathPoints: Vec3[]
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = ctCanvasDimensions(ctVolume, axis)
    const clampedSlice = clampIndex(sliceIndex, ctAxisLength(ctVolume, axis))
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(width, height)
    const [sx, sy] = ctVolume.sizeXyz
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [i, j, k] = ctCanvasPixelToIndex(x, y, axis, clampedSlice, ctVolume)
        const offset = k * sx * sy + j * sx + i
        const value = applyCtWindowPreset(volume[offset] ?? 0, windowPreset)
        const pixel = (y * width + x) * 4
        image.data[pixel] = value
        image.data[pixel + 1] = value
        image.data[pixel + 2] = value
        image.data[pixel + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
    if (scopePathPoints.length > 1) {
      drawCtScopePath(ctx, ctVolume, axis, clampedSlice, scopePathPoints)
    }
    if (nodule) {
      drawCtMarker(ctx, ctVolume, axis, clampedSlice, nodule.lps, noduleRadiusMm, '#fb7185', 'N')
    }
  }, [axis, ctVolume, nodule, noduleRadiusMm, scopePathPoints, sliceIndex, volume, windowPreset])

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      aria-label="CT preview for quiz answer review."
    />
  )
}

function ctAxisLength(ctVolume: CtVolumePreview, axis: CtAxis): number {
  if (axis === 'axial') return ctVolume.sizeXyz[2]
  if (axis === 'coronal') return ctVolume.sizeXyz[1]
  return ctVolume.sizeXyz[0]
}

function ctCanvasDimensions(ctVolume: CtVolumePreview, axis: CtAxis) {
  const [sx, sy, sz] = ctVolume.sizeXyz
  if (axis === 'axial') return { width: sx, height: sy }
  if (axis === 'coronal') return { width: sx, height: sz }
  return { width: sy, height: sz }
}

function ctCanvasPixelToIndex(
  x: number,
  y: number,
  axis: CtAxis,
  sliceIndex: number,
  ctVolume: CtVolumePreview,
): [number, number, number] {
  const [sx, sy, sz] = ctVolume.sizeXyz
  if (axis === 'axial') {
    return [
      clampIndex(Math.round(x), sx),
      clampIndex(Math.round(y), sy),
      clampIndex(sliceIndex, sz),
    ]
  }
  if (axis === 'coronal') {
    return [
      clampIndex(Math.round(x), sx),
      clampIndex(sliceIndex, sy),
      clampIndex(Math.round(sz - 1 - y), sz),
    ]
  }
  return [
    clampIndex(sliceIndex, sx),
    clampIndex(Math.round(x), sy),
    clampIndex(Math.round(sz - 1 - y), sz),
  ]
}

function applyCtWindowPreset(value: number, preset: string): number {
  if (preset === 'bone') return Math.min(255, Math.round(value * 1.22 + 8))
  if (preset === 'softTissue') return Math.min(255, Math.round(value * 0.92 + 18))
  return value
}

function drawCtMarker(
  ctx: CanvasRenderingContext2D,
  ctVolume: CtVolumePreview,
  axis: CtAxis,
  sliceIndex: number,
  lps: Vec3,
  radiusMm: number,
  color: string,
  label: string,
) {
  const projected = projectLpsToCanvas(
    lps,
    axis,
    sliceIndex,
    ctVolume,
    ctx.canvas.width,
    ctx.canvas.height,
  )
  const tolerance = radiusMm / Math.max(axisSpacingMm(ctVolume, axis), 0.001) + 1.5
  if (!projected.inFrame || projected.distanceFromSlice > tolerance) return
  const radiusPx = Math.max(
    4,
    Math.min(26, radiusMm / Math.max(inPlaneSpacingMm(ctVolume, axis), 0.001)),
  )
  ctx.save()
  ctx.globalAlpha = label === 'N' ? 0.9 : 0.82
  ctx.strokeStyle = color
  ctx.fillStyle = label === 'N' ? 'rgba(251,113,133,0.18)' : 'rgba(34,197,94,0.28)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, radiusPx, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.font = '12px Inter, system-ui, sans-serif'
  ctx.fillText(label, projected.x + radiusPx + 4, projected.y - radiusPx)
  ctx.restore()
}

function drawCtScopePath(
  ctx: CanvasRenderingContext2D,
  ctVolume: CtVolumePreview,
  axis: CtAxis,
  sliceIndex: number,
  points: Vec3[],
) {
  const tolerancePx = Math.max(6, 12 / Math.max(axisSpacingMm(ctVolume, axis), 0.001))
  const projected = points.map((point) =>
    projectLpsToCanvas(point, axis, sliceIndex, ctVolume, ctx.canvas.width, ctx.canvas.height),
  )

  const drawPass = (strokeStyle: string, lineWidth: number, alphaScale: number) => {
    ctx.save()
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let index = 1; index < projected.length; index += 1) {
      const prev = projected[index - 1]
      const next = projected[index]
      if (!prev.inFrame || !next.inFrame) continue
      const distanceFromSlice = Math.min(prev.distanceFromSlice, next.distanceFromSlice)
      if (distanceFromSlice > tolerancePx) continue
      ctx.globalAlpha = clampNumber(1 - distanceFromSlice / tolerancePx, 0.2, 0.92) * alphaScale
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(next.x, next.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawPass('#ffffff', 7, 0.95)
  drawPass('#020617', 4, 1)
}

function axisSpacingMm(ctVolume: CtVolumePreview, axis: CtAxis): number {
  if (axis === 'axial') return ctVolume.spacingXyzMm[2]
  if (axis === 'coronal') return ctVolume.spacingXyzMm[1]
  return ctVolume.spacingXyzMm[0]
}

function inPlaneSpacingMm(ctVolume: CtVolumePreview, axis: CtAxis): number {
  if (axis === 'axial') return (ctVolume.spacingXyzMm[0] + ctVolume.spacingXyzMm[1]) / 2
  if (axis === 'coronal') return (ctVolume.spacingXyzMm[0] + ctVolume.spacingXyzMm[2]) / 2
  return (ctVolume.spacingXyzMm[1] + ctVolume.spacingXyzMm[2]) / 2
}

function PresetButtons({
  raoLaoLimitDeg,
  onSelect,
}: {
  raoLaoLimitDeg: number
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
      {presets.map((preset) => {
        const disabled = Math.abs(preset.rao) > raoLaoLimitDeg
        return (
          <button
            key={preset.label}
            type="button"
            className="rounded-md border border-border px-2 py-2 text-xs font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => onSelect(preset.rao, preset.cran)}
            disabled={disabled}
            title={disabled ? `Available after the quiz answer is locked.` : undefined}
          >
            {preset.label}
          </button>
        )
      })}
    </div>
  )
}
