'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { ArrowDown, ArrowUp, Eye, EyeOff, MapPin, RotateCcw } from 'lucide-react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveModuleAssetPath } from '@/lib/module-assets'
import {
  clamp,
  ctAxisLength,
  ctCanvasDimensions,
  ctCanvasPixelToIndex,
  ctIndexToLps,
  lpsToCtIndex,
  projectLpsToCanvas,
  windowHu,
} from '@/lib/airway-anatomy/geometry'
import {
  buildScopePoseSnapshot,
  chooseBranch,
  createInitialScopeState,
  moveScope,
  pointsUntilDistance,
  sampleEdgePose,
  updateLookOffset,
  type ScopeState,
} from '@/lib/airway-anatomy/scope-state'
import type {
  AirwayAnatomyCaseManifest,
  AirwayGraph,
  AirwayGraphEdge,
  AirwayGraphNode,
  CenterlineLabels,
  CtAxis,
  ScopePoseSnapshot,
  Vec3,
} from '@/lib/airway-anatomy/types'

const MANIFEST_URL = resolveModuleAssetPath('/airway-anatomy/case-001/case_manifest.json')
const VIEWPORT_CLASS =
  'relative min-h-[360px] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950'
const airwayGeometryCache = new Map<string, Promise<THREE.BufferGeometry>>()

interface LoadedCase {
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  labels: CenterlineLabels
  ctVolume: Int16Array
}

interface AirwayTarget {
  id: string
  label: string
  fullLabel: string
  nodeId: number
  edgePath: number[]
  anchorLps: Vec3
}

export function AirwayAnatomyModule() {
  const [loadedCase, setLoadedCase] = useState<LoadedCase | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scopeState, setScopeState] = useState<ScopeState | null>(null)
  const [ctAxis, setCtAxis] = useState<CtAxis>('axial')
  const [windowPresetId, setWindowPresetId] = useState('lung')
  const [showLabels, setShowLabels] = useState(false)
  const [ctPlaneOpacity, setCtPlaneOpacity] = useState(0.28)
  const [targetId, setTargetId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const manifestResponse = await fetch(MANIFEST_URL)
        if (!manifestResponse.ok) {
          throw new Error(`Unable to load airway anatomy manifest (${manifestResponse.status}).`)
        }
        const manifest = (await manifestResponse.json()) as AirwayAnatomyCaseManifest
        const [graphResponse, labelsResponse, ctResponse] = await Promise.all([
          fetch(resolveModuleAssetPath(manifest.assets.airwayGraphJson)),
          fetch(resolveModuleAssetPath(manifest.assets.centerlineLabelsJson)),
          fetch(resolveModuleAssetPath(manifest.assets.ctPreviewRaw)),
        ])

        if (!graphResponse.ok)
          throw new Error(`Unable to load airway graph (${graphResponse.status}).`)
        if (!labelsResponse.ok)
          throw new Error(`Unable to load airway labels (${labelsResponse.status}).`)
        if (!ctResponse.ok) throw new Error(`Unable to load CT preview (${ctResponse.status}).`)

        const [graph, labels, ctBuffer] = await Promise.all([
          graphResponse.json() as Promise<AirwayGraph>,
          labelsResponse.json() as Promise<CenterlineLabels>,
          ctResponse.arrayBuffer(),
        ])

        if (cancelled) return

        setLoadedCase({
          manifest,
          graph,
          labels,
          ctVolume: new Int16Array(ctBuffer),
        })
        setScopeState(
          createInitialScopeState(
            graph,
            manifest.interaction.defaultEdgeId,
            manifest.interaction.initialDistanceMm,
          ),
        )
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Unable to load airway anatomy module.',
          )
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const snapshot = useMemo(() => {
    if (!loadedCase || !scopeState) return null
    return buildScopePoseSnapshot({
      state: scopeState,
      graph: loadedCase.graph,
      labels: loadedCase.labels,
      lookAheadMm: loadedCase.manifest.interaction.lookAheadMm,
    })
  }, [loadedCase, scopeState])

  const currentWindow = useMemo(() => {
    const presets = loadedCase?.manifest.ct.windowPresets ?? []
    return presets.find((preset) => preset.id === windowPresetId) ?? presets[0] ?? null
  }, [loadedCase?.manifest.ct.windowPresets, windowPresetId])

  const currentEdge = useMemo(() => {
    if (!loadedCase || !snapshot) return null
    return loadedCase.graph.edges.find((edge) => edge.id === snapshot.edgeId) ?? null
  }, [loadedCase, snapshot])

  const airwayTargets = useMemo(() => {
    if (!loadedCase) return []
    return buildAirwayTargets(loadedCase.graph, loadedCase.labels)
  }, [loadedCase])

  const selectedTarget = useMemo(
    () => airwayTargets.find((target) => target.id === targetId) ?? null,
    [airwayTargets, targetId],
  )

  const edgeTargetLabels = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const target of airwayTargets) {
      for (const edgeId of target.edgePath) {
        const labels = map.get(edgeId) ?? []
        if (!labels.includes(target.label)) {
          labels.push(target.label)
        }
        map.set(edgeId, labels)
      }
    }
    return map
  }, [airwayTargets])

  const handleMove = (delta: number) => {
    if (!loadedCase) return
    setScopeState((state) =>
      state
        ? moveScope(state, loadedCase.graph, delta, {
            trailMaxPoints: loadedCase.manifest.interaction.trailMaxPoints,
            preferredEdgePath: selectedTarget?.edgePath,
          })
        : state,
    )
  }

  const handleReset = () => {
    if (!loadedCase) return
    setScopeState(
      createInitialScopeState(
        loadedCase.graph,
        loadedCase.manifest.interaction.defaultEdgeId,
        loadedCase.manifest.interaction.initialDistanceMm,
      ),
    )
  }

  const handleBranchSelect = (edgeId: number) => {
    if (!loadedCase) return
    setScopeState((state) => (state ? chooseBranch(state, loadedCase.graph, edgeId) : state))
  }

  const handleTargetChange = (nextTargetId: string) => {
    if (!loadedCase) return
    setTargetId(nextTargetId)
    setScopeState(
      createInitialScopeState(
        loadedCase.graph,
        loadedCase.manifest.interaction.defaultEdgeId,
        loadedCase.manifest.interaction.initialDistanceMm,
      ),
    )
  }

  const handleLookDrag = useCallback((yawDelta: number, pitchDelta: number) => {
    setScopeState((state) =>
      state
        ? updateLookOffset(state, {
            yawDeg: state.yawDeg + yawDelta,
            pitchDeg: state.pitchDeg + pitchDelta,
          })
        : state,
    )
  }, [])

  const handleRollChange = (rollDeg: number) => {
    setScopeState((state) => (state ? updateLookOffset(state, { rollDeg }) : state))
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
        {loadError}
      </div>
    )
  }

  if (!loadedCase || !snapshot || !currentWindow) {
    return (
      <div className="flex min-h-[680px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading synchronized airway case...
      </div>
    )
  }

  const stepMm = loadedCase.manifest.interaction.stepMm
  const branchLabel =
    loadedCase.labels.edgeLabels[String(snapshot.edgeId)]?.fullLabel ??
    currentEdge?.sourceCurve ??
    `Edge ${snapshot.edgeId}`

  return (
    <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow-sm">
      <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold">
                Simulation
              </Badge>
              <span className="text-xs font-medium text-slate-400">
                {loadedCase.manifest.ct.sourceNrrd}
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              Synchronized Airway Anatomy
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowLabels((value) => !value)}
            >
              {showLabels ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showLabels ? 'Hide labels' : 'Show labels'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
        <p className="mt-3 max-w-4xl text-sm text-slate-300">
          {loadedCase.manifest.safetyLabel} This module is for education and anatomy correlation
          only.
        </p>
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
          <VirtualBronchoscopyViewport
            manifest={loadedCase.manifest}
            graph={loadedCase.graph}
            pose={snapshot}
            edgeTargetLabels={edgeTargetLabels}
            onLookDrag={handleLookDrag}
            onBranchSelect={handleBranchSelect}
          />
          <AirwayTreeViewport
            manifest={loadedCase.manifest}
            graph={loadedCase.graph}
            targets={airwayTargets}
            pose={snapshot}
            currentEdge={currentEdge}
            showLabels={showLabels}
            ctVolume={loadedCase.ctVolume}
            windowLow={currentWindow.low}
            windowHigh={currentWindow.high}
            ctPlaneOpacity={ctPlaneOpacity}
          />
        </div>

        <div className="grid gap-3">
          <ControlPanel
            pose={snapshot}
            branchLabel={branchLabel}
            stepMm={stepMm}
            targets={airwayTargets}
            selectedTargetId={targetId}
            selectedTarget={selectedTarget}
            edgeTargetLabels={edgeTargetLabels}
            onTargetChange={handleTargetChange}
            ctAxis={ctAxis}
            onCtAxisChange={setCtAxis}
            windowPresetId={windowPresetId}
            windowPresets={loadedCase.manifest.ct.windowPresets}
            onWindowPresetChange={setWindowPresetId}
            ctPlaneOpacity={ctPlaneOpacity}
            onCtPlaneOpacityChange={setCtPlaneOpacity}
            onMove={handleMove}
            onBranchSelect={handleBranchSelect}
            onRollChange={handleRollChange}
          />
          <CtSliceViewport
            ct={loadedCase.manifest.ct}
            volume={loadedCase.ctVolume}
            axis={ctAxis}
            pose={snapshot}
            trail={snapshot.trailLps}
            windowLow={currentWindow.low}
            windowHigh={currentWindow.high}
          />
        </div>
      </div>
    </section>
  )
}

function ControlPanel({
  pose,
  branchLabel,
  stepMm,
  targets,
  selectedTargetId,
  selectedTarget,
  edgeTargetLabels,
  onTargetChange,
  ctAxis,
  onCtAxisChange,
  windowPresetId,
  windowPresets,
  onWindowPresetChange,
  ctPlaneOpacity,
  onCtPlaneOpacityChange,
  onMove,
  onBranchSelect,
  onRollChange,
}: {
  pose: ScopePoseSnapshot
  branchLabel: string
  stepMm: number
  targets: AirwayTarget[]
  selectedTargetId: string
  selectedTarget: AirwayTarget | null
  edgeTargetLabels: Map<number, string[]>
  onTargetChange: (targetId: string) => void
  ctAxis: CtAxis
  onCtAxisChange: (axis: CtAxis) => void
  windowPresetId: string
  windowPresets: AirwayAnatomyCaseManifest['ct']['windowPresets']
  onWindowPresetChange: (preset: string) => void
  ctPlaneOpacity: number
  onCtPlaneOpacityChange: (opacity: number) => void
  onMove: (deltaMm: number) => void
  onBranchSelect: (edgeId: number) => void
  onRollChange: (rollDeg: number) => void
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Current branch
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{branchLabel}</div>
          <div className="mt-1 text-xs text-slate-400">
            {Math.round(pose.distanceMm)} / {Math.round(pose.edgeLengthMm)} mm
          </div>
        </div>
        <div className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">
          Edge {pose.edgeId}
        </div>
      </div>

      <label className="mt-4 grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Route target
        </span>
        <select
          value={selectedTargetId}
          onChange={(event) => onTargetChange(event.target.value)}
          className="min-h-10 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
        >
          <option value="">Free exploration</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label} - {target.fullLabel}
            </option>
          ))}
        </select>
      </label>

      {selectedTarget && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            Following {selectedTarget.label}: {selectedTarget.fullLabel}
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => onMove(-stepMm)}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => onMove(stepMm)}
          disabled={pose.branchOptions.length > 1}
        >
          <ArrowUp className="mr-2 h-4 w-4" />
          Forward
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => onMove(-stepMm * 5)}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Back {stepMm * 5}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onMove(stepMm * 5)}
          disabled={pose.branchOptions.length > 1 && !selectedTarget}
        >
          <ArrowUp className="mr-2 h-4 w-4" />
          Forward {stepMm * 5}
        </Button>
      </div>

      {pose.branchOptions.length > 1 && (
        <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-100">
            Branch point
          </div>
          <div className="mt-2 grid gap-2">
            {pose.branchOptions.map((option) => (
              <button
                type="button"
                key={option.edgeId}
                onClick={() => onBranchSelect(option.edgeId)}
                className="flex min-h-10 items-center justify-between rounded-md border border-amber-200/25 bg-slate-950/60 px-3 text-left text-sm text-amber-50 transition hover:border-amber-200/70 hover:bg-amber-200/10"
              >
                <span className="font-semibold">{option.label}</span>
                <span className="text-xs text-amber-100/80">
                  {formatEdgeTargetLabel(edgeTargetLabels, option.edgeId) ??
                    option.anatomicalLabel ??
                    `Edge ${option.edgeId}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            CT plane
          </span>
          <select
            value={ctAxis}
            onChange={(event) => onCtAxisChange(event.target.value as CtAxis)}
            className="min-h-10 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
          >
            <option value="axial">Axial</option>
            <option value="coronal">Coronal</option>
            <option value="sagittal">Sagittal</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            CT window
          </span>
          <select
            value={windowPresetId}
            onChange={(event) => onWindowPresetChange(event.target.value)}
            className="min-h-10 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
          >
            {windowPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>3D CT overlay</span>
            <span>{Math.round(ctPlaneOpacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={0.65}
            step={0.01}
            value={ctPlaneOpacity}
            onChange={(event) => onCtPlaneOpacityChange(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </label>
        <label className="grid gap-2">
          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Scope roll</span>
            <span>{Math.round(pose.rollDeg)} deg</span>
          </span>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={pose.rollDeg}
            onChange={(event) => onRollChange(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </label>
      </div>
    </div>
  )
}

function VirtualBronchoscopyViewport({
  manifest,
  graph,
  pose,
  edgeTargetLabels,
  onLookDrag,
  onBranchSelect,
}: {
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  pose: ScopePoseSnapshot
  edgeTargetLabels: Map<number, string[]>
  onLookDrag: (yawDelta: number, pitchDelta: number) => void
  onBranchSelect: (edgeId: number) => void
}) {
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  return (
    <div
      className={VIEWPORT_CLASS}
      onPointerDown={(event) => {
        pointerRef.current = { x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const previous = pointerRef.current
        if (!previous) return
        const dx = event.clientX - previous.x
        const dy = event.clientY - previous.y
        pointerRef.current = { x: event.clientX, y: event.clientY }
        onLookDrag(dx * 0.08, -dy * 0.08)
      }}
      onPointerUp={() => {
        pointerRef.current = null
      }}
      onPointerCancel={() => {
        pointerRef.current = null
      }}
    >
      <div className="absolute inset-0 [transform:scaleY(-1)]">
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 84, near: 0.06, far: 900, position: pose.tipLps }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={[0x070201]} />
          <ambientLight intensity={0.65} color={0xffb08a} />
          <pointLight
            position={pose.tipLps}
            intensity={18}
            distance={180}
            decay={1.1}
            color={0xffd1ad}
          />
          <Suspense fallback={null}>
            <AirwaySurface
              stlUrl={
                manifest.assets.airwayStl ? resolveModuleAssetPath(manifest.assets.airwayStl) : null
              }
              transform={manifest.airwaySurfaceTransform ?? manifest.airwayTransform}
              mode="bronch"
            />
            <ScopeCamera pose={pose} />
          </Suspense>
        </Canvas>
      </div>
      <ScopeBranchOverlay
        edgeTargetLabels={edgeTargetLabels}
        graph={graph}
        onBranchSelect={onBranchSelect}
        pose={pose}
      />
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
        Virtual bronchoscopy
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-slate-950/75 px-2 py-1 text-[11px] text-slate-300">
        yaw {Math.round(pose.yawDeg)} / pitch {Math.round(pose.pitchDeg)}
      </div>
    </div>
  )
}

function AirwayTreeViewport({
  manifest,
  graph,
  targets,
  pose,
  currentEdge,
  showLabels,
  ctVolume,
  windowLow,
  windowHigh,
  ctPlaneOpacity,
}: {
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  targets: AirwayTarget[]
  pose: ScopePoseSnapshot
  currentEdge: AirwayGraphEdge | null
  showLabels: boolean
  ctVolume: Int16Array
  windowLow: number
  windowHigh: number
  ctPlaneOpacity: number
}) {
  const bounds = useMemo(() => boundsForGraph(graph), [graph])
  const cameraPosition: Vec3 = [
    bounds.center[0] + bounds.radius * 0.95,
    bounds.center[1] - bounds.radius * 1.35,
    bounds.center[2] + bounds.radius * 0.55,
  ]

  return (
    <div className={VIEWPORT_CLASS}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 34, near: 0.5, far: bounds.radius * 12, position: cameraPosition }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[0x040812]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[180, -260, 120]} intensity={1.15} />
        <directionalLight position={[-120, 180, -100]} intensity={0.35} color={0x9bb8ff} />
        <Suspense fallback={null}>
          <AirwaySurface
            stlUrl={
              manifest.assets.airwayStl ? resolveModuleAssetPath(manifest.assets.airwayStl) : null
            }
            transform={manifest.airwaySurfaceTransform ?? manifest.airwayTransform}
            mode="tree"
          />
          <CtAxialPlane
            ct={manifest.ct}
            volume={ctVolume}
            pose={pose}
            windowLow={windowLow}
            windowHigh={windowHigh}
            opacity={ctPlaneOpacity}
          />
          <group>
            {graph.edges.map((edge) => (
              <Polyline
                key={edge.id}
                points={edge.pointsLps}
                color={edge.id === pose.edgeId ? '#facc15' : '#38bdf8'}
                opacity={edge.id === pose.edgeId ? 0.95 : 0.22}
                lineWidth={edge.id === pose.edgeId ? 2 : 1}
              />
            ))}
            {currentEdge && (
              <Polyline
                points={pointsUntilDistance(currentEdge, pose.distanceMm)}
                color="#ffffff"
                opacity={0.95}
                lineWidth={3}
              />
            )}
            <Polyline points={pose.trailLps} color="#34d399" opacity={0.9} lineWidth={3} />
            <ScopeMarker pose={pose} />
          </group>
          {showLabels && <SceneLabels targets={targets} />}
        </Suspense>
        <OrbitControls target={bounds.center} enablePan enableRotate enableZoom />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
        3D airway correlation
      </div>
    </div>
  )
}

function CtSliceViewport({
  ct,
  volume,
  axis,
  pose,
  trail,
  windowLow,
  windowHigh,
}: {
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  axis: CtAxis
  pose: ScopePoseSnapshot
  trail: Vec3[]
  windowLow: number
  windowHigh: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tipIndex = useMemo(() => lpsToCtIndex(pose.tipLps, ct), [ct, pose.tipLps])
  const sliceIndex = Math.round(
    axis === 'axial' ? tipIndex[2] : axis === 'coronal' ? tipIndex[1] : tipIndex[0],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawCtSlice({
      canvas,
      ct,
      volume,
      axis,
      sliceIndex,
      windowLow,
      windowHigh,
      pose,
      trail,
    })
  }, [axis, ct, pose, sliceIndex, trail, volume, windowHigh, windowLow])

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            CT slice
          </div>
          <div className="text-sm text-slate-200">
            IJK {tipIndex.map((value) => Math.round(value)).join(', ')}
          </div>
        </div>
        <div className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">
          {axis} {clamp(sliceIndex, 0, ctAxisLength(ct, axis) - 1)}
        </div>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
        <canvas ref={canvasRef} className="h-full w-full object-contain" />
      </div>
    </div>
  )
}

function AirwaySurface({
  stlUrl,
  transform,
  mode,
}: {
  stlUrl: string | null
  transform: AirwayAnatomyCaseManifest['airwayTransform']
  mode: 'bronch' | 'tree'
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    if (!stlUrl) return
    let cancelled = false
    loadAirwayStlGeometry(stlUrl)
      .then((nextGeometry) => {
        if (!cancelled) {
          setGeometry(nextGeometry)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeometry(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [stlUrl])

  const material = useMemo(
    () =>
      mode === 'bronch'
        ? createBronchoscopyMaterial()
        : new THREE.MeshStandardMaterial({
            color: '#67e8f9',
            roughness: 0.58,
            metalness: 0.02,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
          }),
    [mode],
  )

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  if (!stlUrl || !geometry) return null

  return (
    <mesh
      geometry={geometry}
      material={material}
      scale={transform.sceneScale}
      rotation={transform.rotationDeg.map((deg) => THREE.MathUtils.degToRad(deg)) as Vec3}
      position={transform.positionOffsetMm}
    />
  )
}

function loadAirwayStlGeometry(stlUrl: string): Promise<THREE.BufferGeometry> {
  const cached = airwayGeometryCache.get(stlUrl)
  if (cached) return cached

  const promise = new STLLoader().loadAsync(stlUrl).then((geometry) => {
    geometry.deleteAttribute('normal')
    const smoothedGeometry = mergeVertices(geometry, 0.001)
    geometry.dispose()
    smoothedGeometry.computeVertexNormals()
    smoothedGeometry.computeBoundingBox()
    smoothedGeometry.computeBoundingSphere()
    return smoothedGeometry
  })
  airwayGeometryCache.set(stlUrl, promise)
  return promise
}

function createBronchoscopyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    toneMapped: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormalWorld;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormalWorld;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 n = normalize(vNormalWorld);
        if (dot(n, viewDir) < 0.0) {
          n = -n;
        }

        float dist = length(cameraPosition - vWorldPosition);
        float headlight = max(dot(n, viewDir), 0.0);
        float falloff = mix(0.92, 0.42, smoothstep(34.0, 170.0, dist));

        vec3 p = vWorldPosition * 0.055;
        float broadFold = 0.5 + 0.5 * sin(p.z * 5.5 + p.y * 2.2 + sin(p.x * 2.6) * 1.4);
        float fineFold = 0.5 + 0.5 * sin(p.x * 12.0 + p.y * 7.0 + p.z * 4.0);
        float speckle = hash(floor(vWorldPosition * 0.95));
        float mucosa = 0.78 + broadFold * 0.18 + fineFold * 0.055 + (speckle - 0.5) * 0.045;

        vec3 shadowTone = vec3(0.34, 0.075, 0.052);
        vec3 midTone = vec3(0.82, 0.32, 0.205);
        vec3 highTone = vec3(1.0, 0.56, 0.36);
        vec3 base = mix(shadowTone, midTone, clamp(mucosa, 0.0, 1.0));
        base = mix(base, highTone, pow(headlight, 2.2) * 0.24);

        float rimWet = pow(max(dot(reflect(-viewDir, n), viewDir), 0.0), 20.0);
        float sparkleGate = smoothstep(0.982, 1.0, hash(floor(vWorldPosition * 2.15)));
        float sparkle = sparkleGate * pow(headlight, 10.0) * 0.22;

        float exposure = 0.7 + headlight * 0.68;
        vec3 color = base * exposure * falloff;
        color += vec3(1.0, 0.72, 0.52) * (rimWet * 0.18 + sparkle);

        float depthDarken = smoothstep(110.0, 240.0, dist);
        color = mix(color, vec3(0.07, 0.018, 0.012), depthDarken * 0.5);
        color = pow(max(color, vec3(0.0)), vec3(0.94));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
}

function ScopeCamera({ pose }: { pose: ScopePoseSnapshot }) {
  const { camera } = useThree()

  useFrame(() => {
    const position = new THREE.Vector3(...pose.tipLps)
    const forward = new THREE.Vector3(...pose.lookAtLps).sub(position).normalize()
    if (forward.lengthSq() < 1e-8) forward.set(...pose.tangentLps)
    // Match the Nav Bronch patient-view camera basis so the on-image A/B
    // markers project to the same branches described by the picker.
    const upHint = new THREE.Vector3(0, 1, 0)
    let right = new THREE.Vector3().crossVectors(forward, upHint).normalize()
    if (right.lengthSq() < 1e-8) right = new THREE.Vector3(1, 0, 0)
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()

    const yaw = new THREE.Quaternion().setFromAxisAngle(up, THREE.MathUtils.degToRad(pose.yawDeg))
    forward.applyQuaternion(yaw).normalize()
    right.applyQuaternion(yaw).normalize()
    const pitch = new THREE.Quaternion().setFromAxisAngle(
      right,
      THREE.MathUtils.degToRad(pose.pitchDeg),
    )
    forward.applyQuaternion(pitch).normalize()
    up.applyQuaternion(pitch).normalize()

    camera.position.copy(position)
    camera.up.copy(up)
    camera.lookAt(position.clone().add(forward))
    camera.rotateZ(THREE.MathUtils.degToRad(pose.rollDeg))
  })

  return null
}

function ScopeMarker({ pose }: { pose: ScopePoseSnapshot }) {
  const quaternion = useMemo(() => {
    const tangent = new THREE.Vector3(...pose.tangentLps).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
  }, [pose.tangentLps])

  return (
    <group>
      <mesh position={pose.tipLps}>
        <sphereGeometry args={[3.2, 18, 18]} />
        <meshStandardMaterial color="#ffffff" emissive="#facc15" emissiveIntensity={0.65} />
      </mesh>
      <mesh position={pose.tipLps} quaternion={quaternion}>
        <coneGeometry args={[4.8, 13, 24]} />
        <meshStandardMaterial color="#facc15" transparent opacity={0.82} />
      </mesh>
    </group>
  )
}

function ScopeBranchOverlay({
  edgeTargetLabels,
  graph,
  pose,
  onBranchSelect,
}: {
  edgeTargetLabels: Map<number, string[]>
  graph: AirwayGraph
  pose: ScopePoseSnapshot
  onBranchSelect: (edgeId: number) => void
}) {
  if (pose.branchOptions.length < 2) return null
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const placements = pose.branchOptions
    .map((option) => {
      const edge = edgeById.get(option.edgeId)
      if (!edge) return null
      const labelPoint = sampleEdgePose(edge, Math.min(10, edge.lengthMm * 0.35)).point
      return {
        option,
        targetLabel: formatEdgeTargetLabel(edgeTargetLabels, option.edgeId),
        lateral: labelPoint[0] - pose.tipLps[0],
      }
    })
    .filter((placement): placement is NonNullable<typeof placement> => placement != null)
    .sort((a, b) => a.lateral - b.lateral)

  if (!placements.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {placements.map(({ option, targetLabel }, index) => {
        const denominator = Math.max(placements.length - 1, 1)
        const leftPercent =
          placements.length === 2 ? (index === 0 ? 34 : 66) : 24 + (index / denominator) * 52
        return (
          <button
            type="button"
            key={option.edgeId}
            onClick={() => onBranchSelect(option.edgeId)}
            aria-label={`Choose branch ${option.label}: ${
              targetLabel ?? option.anatomicalLabel ?? `Edge ${option.edgeId}`
            }`}
            title={targetLabel ?? option.anatomicalLabel ?? `Edge ${option.edgeId}`}
            className="pointer-events-auto absolute flex h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-red-950/80 bg-red-500/95 px-2 text-base font-black text-slate-950 shadow-[0_0_12px_rgba(255,255,255,0.45)] transition hover:scale-105 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
            style={{ left: `${leftPercent}%`, top: '50%' }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function Polyline({
  points,
  color,
  opacity,
}: {
  points: Vec3[]
  color: string
  opacity: number
  lineWidth?: number
}) {
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setFromPoints(points.map((point) => new THREE.Vector3(...point)))
    return next
  }, [points])
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    [color, opacity],
  )
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  if (points.length < 2) return null
  return <primitive object={line} />
}

function SceneLabels({ targets }: { targets: AirwayTarget[] }) {
  return (
    <>
      {targets.slice(0, 90).map((target) => (
        <group key={target.id} position={target.anchorLps}>
          <mesh>
            <sphereGeometry args={[1.6, 8, 8]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          <Html center distanceFactor={38} zIndexRange={[10, 0]}>
            <div
              className="rounded border border-amber-200/60 bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-100 shadow"
              title={target.fullLabel}
            >
              {target.label}
            </div>
          </Html>
        </group>
      ))}
    </>
  )
}

function CtAxialPlane({
  ct,
  volume,
  pose,
  windowLow,
  windowHigh,
  opacity,
}: {
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  pose: ScopePoseSnapshot
  windowLow: number
  windowHigh: number
  opacity: number
}) {
  const texture = useMemo(() => {
    if (opacity <= 0.01) return null
    const canvas = document.createElement('canvas')
    const sliceIndex = Math.round(lpsToCtIndex(pose.tipLps, ct)[2])
    drawCtSlice({
      canvas,
      ct,
      volume,
      axis: 'axial',
      sliceIndex,
      windowLow,
      windowHigh,
      pose,
      trail: [],
    })
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    return nextTexture
  }, [ct, opacity, pose, volume, windowHigh, windowLow])

  useEffect(() => () => texture?.dispose(), [texture])

  if (!texture || opacity <= 0.01) return null

  const [i, j, k] = lpsToCtIndex(pose.tipLps, ct)
  const center = ctIndexToLps([(ct.sizeXyz[0] - 1) / 2, (ct.sizeXyz[1] - 1) / 2, Math.round(k)], ct)
  const width = (ct.sizeXyz[0] - 1) * ct.spacingXyzMm[0]
  const height = (ct.sizeXyz[1] - 1) * ct.spacingXyzMm[1]
  void i
  void j

  return (
    <mesh position={center} scale={[1, -1, 1]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function drawCtSlice({
  canvas,
  ct,
  volume,
  axis,
  sliceIndex,
  windowLow,
  windowHigh,
  pose,
  trail,
}: {
  canvas: HTMLCanvasElement
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  axis: CtAxis
  sliceIndex: number
  windowLow: number
  windowHigh: number
  pose: ScopePoseSnapshot
  trail: Vec3[]
}) {
  const dimensions = ctCanvasDimensions(ct, axis)
  const clampedSlice = clamp(Math.round(sliceIndex), 0, ctAxisLength(ct, axis) - 1)
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d')
  if (!context) return

  const image = context.createImageData(dimensions.width, dimensions.height)
  const [sx, sy] = ct.sizeXyz
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const [i, j, k] = ctCanvasPixelToIndex(x, y, axis, clampedSlice, ct)
      const value = volume[k * sx * sy + j * sx + i] ?? -1024
      const gray = windowHu(value, windowLow, windowHigh)
      const offset = (y * dimensions.width + x) * 4
      image.data[offset] = gray
      image.data[offset + 1] = gray
      image.data[offset + 2] = gray
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  drawTrailOnCt(context, ct, axis, clampedSlice, trail)
  drawCrosshair(context, ct, axis, clampedSlice, pose.tipLps)
}

function drawCrosshair(
  context: CanvasRenderingContext2D,
  ct: AirwayAnatomyCaseManifest['ct'],
  axis: CtAxis,
  sliceIndex: number,
  tipLps: Vec3,
) {
  const projected = projectLpsToCanvas(
    tipLps,
    axis,
    sliceIndex,
    ct,
    context.canvas.width,
    context.canvas.height,
  )
  if (!projected.inFrame) return
  context.save()
  context.strokeStyle = '#22d3ee'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(projected.x - 14, projected.y)
  context.lineTo(projected.x + 14, projected.y)
  context.moveTo(projected.x, projected.y - 14)
  context.lineTo(projected.x, projected.y + 14)
  context.stroke()
  context.beginPath()
  context.arc(projected.x, projected.y, 5, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawTrailOnCt(
  context: CanvasRenderingContext2D,
  ct: AirwayAnatomyCaseManifest['ct'],
  axis: CtAxis,
  sliceIndex: number,
  trail: Vec3[],
) {
  if (trail.length < 2) return
  context.save()
  context.strokeStyle = '#34d399'
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  let started = false
  for (const point of trail) {
    const projected = projectLpsToCanvas(
      point,
      axis,
      sliceIndex,
      ct,
      context.canvas.width,
      context.canvas.height,
    )
    if (!projected.inFrame || projected.distanceFromSlice > 2.5) {
      started = false
      continue
    }
    if (!started) {
      context.beginPath()
      context.moveTo(projected.x, projected.y)
      started = true
    } else {
      context.lineTo(projected.x, projected.y)
      context.stroke()
    }
  }
  context.restore()
}

function buildAirwayTargets(graph: AirwayGraph, labels: CenterlineLabels): AirwayTarget[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const byLabel = new Map<string, AirwayTarget>()

  for (const polyline of labels.polylines) {
    if (!polyline.abbreviatedLabel || !polyline.fullLabel || polyline.pointsLps.length < 2) {
      continue
    }
    const distalPoint = polyline.pointsLps[polyline.pointsLps.length - 1]
    const matchedEdge =
      polyline.matchedEdgeId == null ? null : (edgeById.get(polyline.matchedEdgeId) ?? null)
    const node =
      (matchedEdge ? nodeById.get(matchedEdge.endNodeId) : nearestGraphNode(graph, distalPoint)) ??
      nearestGraphNode(graph, distalPoint)
    const edgePath = edgePathToNode(node.id, nodeById)
    if (!edgePath.length) {
      continue
    }
    const key = `${polyline.abbreviatedLabel}|${polyline.fullLabel}`
    const current = byLabel.get(key)
    const next: AirwayTarget = {
      id: key,
      label: polyline.abbreviatedLabel,
      fullLabel: polyline.fullLabel,
      nodeId: node.id,
      edgePath,
      anchorLps: matchedEdge?.pointsLps[matchedEdge.pointsLps.length - 1] ?? distalPoint,
    }
    if (!current || node.rootDistanceMm > (nodeById.get(current.nodeId)?.rootDistanceMm ?? 0)) {
      byLabel.set(key, next)
    }
  }

  return [...byLabel.values()].sort((a, b) =>
    airwayLabelSortKey(a).localeCompare(airwayLabelSortKey(b)),
  )
}

function formatEdgeTargetLabel(
  edgeTargetLabels: Map<number, string[]>,
  edgeId: number,
): string | null {
  const labels = edgeTargetLabels.get(edgeId)
  if (!labels?.length) return null
  if (labels.length <= 4) return labels.join(', ')
  return `${labels.slice(0, 4).join(', ')} +${labels.length - 4}`
}

function edgePathToNode(nodeId: number, nodeById: Map<number, AirwayGraphNode>): number[] {
  const reversed: number[] = []
  let current = nodeById.get(nodeId)
  let guard = 0
  while (current?.parentEdgeId != null && guard < nodeById.size + 1) {
    guard += 1
    reversed.push(current.parentEdgeId)
    current = current.parentNodeId == null ? undefined : nodeById.get(current.parentNodeId)
  }
  return reversed.reverse()
}

function nearestGraphNode(graph: AirwayGraph, point: Vec3): AirwayGraphNode {
  let nearest = graph.nodes[0]
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const node of graph.nodes) {
    const nextDistance = Math.hypot(
      node.lps[0] - point[0],
      node.lps[1] - point[1],
      node.lps[2] - point[2],
    )
    if (nextDistance < nearestDistance) {
      nearest = node
      nearestDistance = nextDistance
    }
  }
  return nearest
}

function airwayLabelSortKey(target: AirwayTarget): string {
  const sideRank = target.label.startsWith('RB') ? '1' : target.label.startsWith('LB') ? '2' : '0'
  const number = target.label.match(/\d+/)?.[0]?.padStart(2, '0') ?? '00'
  return `${sideRank}-${number}-${target.label}-${target.fullLabel}`
}

function boundsForGraph(graph: AirwayGraph): { center: Vec3; radius: number } {
  const points = graph.nodes.map((node) => node.lps)
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (const point of points) {
    min[0] = Math.min(min[0], point[0])
    min[1] = Math.min(min[1], point[1])
    min[2] = Math.min(min[2], point[2])
    max[0] = Math.max(max[0], point[0])
    max[1] = Math.max(max[1], point[1])
    max[2] = Math.max(max[2], point[2])
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const radius = Math.max(160, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.62)
  return { center, radius }
}
