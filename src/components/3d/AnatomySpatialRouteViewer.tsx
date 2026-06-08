'use client'

import { useMemo, useState } from 'react'

import { AnatomyViewerDynamic } from '@/components/3d/AnatomyViewerDynamic'
import type { AnatomyAxis, OrthogonalClipMode } from '@/components/3d/AnatomyViewer'
import type { AnatomyModel, AnatomySegment } from '@/lib/types'

const axisLabels: Record<AnatomyAxis, string> = {
  x: 'Sagittal',
  y: 'Coronal',
  z: 'Axial',
}

const anatomyAxes: AnatomyAxis[] = ['z', 'y', 'x']

const defaultCtPlaneVisibility: Record<AnatomyAxis, boolean> = {
  x: true,
  y: true,
  z: true,
}

const defaultCtPlaneSlices: Record<AnatomyAxis, number> = {
  x: 50,
  y: 50,
  z: 50,
}

function buildDefaultVisibility(segments: AnatomySegment[]) {
  return Object.fromEntries(
    segments.map((segment) => [segment.id, segment.visibleByDefault !== false]),
  )
}

export function AnatomySpatialRouteViewer({ model }: { model: AnatomyModel }) {
  const [displaySegments, setDisplaySegments] = useState<AnatomySegment[]>(() =>
    model.segments.map((segment) => ({ ...segment })),
  )
  const [visibleSegments, setVisibleSegments] = useState<Record<string, boolean>>(() =>
    buildDefaultVisibility(model.segments),
  )
  const [crossSection, setCrossSection] = useState(0)
  const [volumeSlice, setVolumeSlice] = useState(50)
  const [showCtPlanes, setShowCtPlanes] = useState(true)
  const [ctPlaneVisibility, setCtPlaneVisibility] =
    useState<Record<AnatomyAxis, boolean>>(defaultCtPlaneVisibility)
  const [ctPlaneSlices, setCtPlaneSlices] =
    useState<Record<AnatomyAxis, number>>(defaultCtPlaneSlices)
  const [ctPlaneOpacity, setCtPlaneOpacity] = useState(0.3)
  const [ctClipMode, setCtClipMode] = useState<OrthogonalClipMode>('none')
  const [ctClipAxis, setCtClipAxis] = useState<AnatomyAxis>(model.volume?.axis ?? 'z')
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [resetSignal, setResetSignal] = useState(0)
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 })

  const viewerModel = useMemo<AnatomyModel>(
    () => ({
      ...model,
      segments: displaySegments,
    }),
    [displaySegments, model],
  )

  const updateCtPlaneVisibility = (axis: AnatomyAxis, visible: boolean) => {
    setCtPlaneVisibility((prev) => ({ ...prev, [axis]: visible }))
  }

  const updateCtPlaneSlice = (axis: AnatomyAxis, value: number) => {
    setVolumeSlice(value)
    setCtPlaneSlices((prev) => ({ ...prev, [axis]: value }))
  }

  const resetWorkspace = () => {
    setCrossSection(0)
    setVolumeSlice(50)
    setShowCtPlanes(true)
    setCtPlaneVisibility(defaultCtPlaneVisibility)
    setCtPlaneSlices(defaultCtPlaneSlices)
    setCtPlaneOpacity(0.3)
    setCtClipMode('none')
    setCtClipAxis(model.volume?.axis ?? 'z')
    setShowAnnotations(true)
    setRotation({ x: 0, y: 0, z: 0 })
    setResetSignal((signal) => signal + 1)
    setVisibleSegments(buildDefaultVisibility(displaySegments))
  }

  const controlLabelClassName =
    'text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400'
  const controlCardClassName =
    'grid gap-4 rounded-2xl border border-slate-500/20 bg-white/[0.04] p-4'

  const controlPanel = (
    <div className="grid gap-4">
      <div>
        <div className={controlLabelClassName}>Spatial Controls</div>
        <h1 className="mt-1 text-lg font-semibold text-white">{model.name}</h1>
      </div>

      <section className={controlCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={controlLabelClassName}>Cross-section</div>
            <h2 className="mt-1 text-base font-semibold text-white">Cut plane</h2>
          </div>
          <span className="rounded-full border border-slate-500/25 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-300">
            {crossSection}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={crossSection}
          onChange={(event) => setCrossSection(Number(event.target.value))}
          className="w-full accent-cyan-300"
        />
        <label className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={showAnnotations}
            onChange={(event) => setShowAnnotations(event.target.checked)}
            className="h-4 w-4 accent-cyan-300"
          />
          <span>Show annotations</span>
        </label>
        <button
          type="button"
          onClick={resetWorkspace}
          className="min-h-10 rounded-full border border-cyan-300/30 bg-cyan-300/15 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
        >
          Reset workspace
        </button>
      </section>

      <section className={controlCardClassName}>
        <div>
          <div className={controlLabelClassName}>3D CT</div>
          <h2 className="mt-1 text-base font-semibold text-white">Orthogonal planes</h2>
        </div>
        <label className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={showCtPlanes}
            onChange={(event) => setShowCtPlanes(event.target.checked)}
            className="h-4 w-4 accent-cyan-300"
          />
          <span>Show 3D CT planes</span>
        </label>
        <div className="grid gap-2">
          {anatomyAxes.map((axis) => (
            <label
              key={axis}
              className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={ctPlaneVisibility[axis]}
                disabled={!showCtPlanes}
                onChange={(event) => updateCtPlaneVisibility(axis, event.target.checked)}
                className="h-4 w-4 accent-cyan-300 disabled:opacity-40"
              />
              <span>{axisLabels[axis]}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-3">
          {anatomyAxes.map((axis) => (
            <label key={axis} className="grid gap-2">
              <span className="flex items-center justify-between text-xs text-slate-400">
                <span className={controlLabelClassName}>{axisLabels[axis]}</span>
                <span className="text-white">{ctPlaneSlices[axis].toFixed(0)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={ctPlaneSlices[axis]}
                disabled={!showCtPlanes}
                onChange={(event) => updateCtPlaneSlice(axis, Number(event.target.value))}
                onInput={(event) => updateCtPlaneSlice(axis, Number(event.currentTarget.value))}
                className="w-full accent-cyan-300 disabled:opacity-40"
              />
            </label>
          ))}
        </div>
        <label className="grid gap-2">
          <span className="flex items-center justify-between text-xs text-slate-400">
            <span className={controlLabelClassName}>3D CT plane opacity</span>
            <span className="text-white">{Math.round(ctPlaneOpacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ctPlaneOpacity}
            disabled={!showCtPlanes}
            onChange={(event) => setCtPlaneOpacity(Number(event.target.value))}
            className="w-full accent-cyan-300 disabled:opacity-40"
          />
        </label>
        <label className="grid gap-2">
          <span className={controlLabelClassName}>3D anatomy clipping</span>
          <select
            value={ctClipMode}
            onChange={(event) => setCtClipMode(event.target.value as OrthogonalClipMode)}
            className="min-h-11 w-full rounded-xl border border-slate-500/25 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
          >
            <option value="none">No clipping</option>
            <option value="hide-above">Hide above CT plane</option>
            <option value="hide-below">Hide below CT plane</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className={controlLabelClassName}>Clipping plane</span>
          <select
            value={ctClipAxis}
            disabled={ctClipMode === 'none'}
            onChange={(event) => setCtClipAxis(event.target.value as AnatomyAxis)}
            className="min-h-11 w-full rounded-xl border border-slate-500/25 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70 disabled:opacity-50"
          >
            {anatomyAxes.map((axis) => (
              <option key={axis} value={axis}>
                {axisLabels[axis]}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  )

  return (
    <main className="min-h-dvh bg-slate-950 p-3 text-white">
      <AnatomyViewerDynamic
        key={model.id}
        model={viewerModel}
        visibleSegments={visibleSegments}
        crossSection={crossSection}
        volumeSlice={volumeSlice}
        showCtPlanes={showCtPlanes}
        ctPlaneVisibility={ctPlaneVisibility}
        ctPlaneSlices={ctPlaneSlices}
        ctPlaneOpacity={ctPlaneOpacity}
        ctClipMode={ctClipMode}
        ctClipAxis={ctClipAxis}
        showAnnotations={showAnnotations}
        resetSignal={resetSignal}
        rotation={rotation}
        controlPanel={controlPanel}
        onCrossSectionChange={setCrossSection}
        onShowCtPlanesChange={setShowCtPlanes}
        onCtPlaneVisibilityChange={updateCtPlaneVisibility}
        onCtPlaneSliceChange={updateCtPlaneSlice}
        onCtPlaneOpacityChange={setCtPlaneOpacity}
        onCtClipModeChange={setCtClipMode}
        onCtClipAxisChange={setCtClipAxis}
        onVolumeSliceChange={setVolumeSlice}
        onSegmentsChanged={(segments) => {
          setDisplaySegments((prev) => {
            const sameLength = prev.length === segments.length
            const identical =
              sameLength &&
              prev.every((segment, index) => {
                const next = segments[index]
                return (
                  next &&
                  segment.id === next.id &&
                  segment.color === next.color &&
                  (segment.visibleByDefault ?? true) === (next.visibleByDefault ?? true)
                )
              })
            return identical ? prev : segments
          })
          setVisibleSegments((prev) => {
            const next: Record<string, boolean> = {}
            let changed = false
            segments.forEach((segment) => {
              const current =
                segment.id in prev ? prev[segment.id] : segment.visibleByDefault !== false
              next[segment.id] = current
              if (prev[segment.id] !== current) {
                changed = true
              }
            })
            if (Object.keys(prev).length !== Object.keys(next).length) {
              changed = true
            }
            return changed ? next : prev
          })
        }}
      />
    </main>
  )
}
