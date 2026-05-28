'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Route } from 'next'

import { AnatomyViewerDynamic } from '@/components/3d/AnatomyViewerDynamic'
import type { AnatomyAxis, OrthogonalClipMode } from '@/components/3d/AnatomyViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getModel } from '@/data/models'
import { anatomyModels } from '@/data/printable-models'
import type { AnatomyModel, AnatomySegment } from '@/lib/types'

const axisLabels: Record<AnatomyAxis, string> = {
  x: 'Sagittal',
  y: 'Coronal',
  z: 'Axial',
}

const anatomyAxes: AnatomyAxis[] = ['z', 'y', 'x']

const defaultCtPlaneVisibility: Record<AnatomyAxis, boolean> = {
  x: false,
  y: false,
  z: true,
}

const defaultCtPlaneSlices: Record<AnatomyAxis, number> = {
  x: 50,
  y: 50,
  z: 50,
}

export default function AnatomyLearnPage() {
  const models = anatomyModels
  const [selectedModel, setSelectedModel] = useState<AnatomyModel>(models[0])
  const [displaySegments, setDisplaySegments] = useState<AnatomySegment[]>(() =>
    models[0].segments.map((segment) => ({ ...segment })),
  )
  const [visibleSegments, setVisibleSegments] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      models[0].segments.map((segment) => [segment.id, segment.visibleByDefault !== false]),
    ),
  )
  const [crossSection, setCrossSection] = useState(0)
  const [volumeSlice, setVolumeSlice] = useState(0)
  const [showCtPlanes, setShowCtPlanes] = useState(true)
  const [ctPlaneVisibility, setCtPlaneVisibility] =
    useState<Record<AnatomyAxis, boolean>>(defaultCtPlaneVisibility)
  const [ctPlaneSlices, setCtPlaneSlices] =
    useState<Record<AnatomyAxis, number>>(defaultCtPlaneSlices)
  const [ctPlaneOpacity, setCtPlaneOpacity] = useState(0.3)
  const [ctClipMode, setCtClipMode] = useState<OrthogonalClipMode>('none')
  const [ctClipAxis, setCtClipAxis] = useState<AnatomyAxis>('z')
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [resetSignal, setResetSignal] = useState(0)
  const [showDebugHelpers, setShowDebugHelpers] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 })

  const segmentList = useMemo(() => displaySegments, [displaySegments])
  const viewerModel = useMemo<AnatomyModel>(
    () => ({
      ...selectedModel,
      segments: displaySegments,
    }),
    [selectedModel, displaySegments],
  )

  const handleModelChange = (model: AnatomyModel) => {
    setSelectedModel(model)
    const nextSegments = model.segments.map((segment) => ({ ...segment }))
    setDisplaySegments(nextSegments)
    setVisibleSegments(
      Object.fromEntries(
        nextSegments.map((segment) => [segment.id, segment.visibleByDefault !== false]),
      ),
    )
    setCrossSection(0)
    setVolumeSlice(0)
    setShowCtPlanes(true)
    setCtPlaneVisibility(defaultCtPlaneVisibility)
    setCtPlaneSlices(defaultCtPlaneSlices)
    setCtPlaneOpacity(0.3)
    setCtClipMode('none')
    setCtClipAxis('z')
    setShowAnnotations(true)
    setResetSignal((signal) => signal + 1)
    setRotation({ x: 0, y: 0, z: 0 })
  }

  const handleToggleSegment = (segmentId: string) => {
    setVisibleSegments((prev) => ({
      ...prev,
      [segmentId]: !prev[segmentId],
    }))
  }

  const handleCtPlaneVisibilityChange = (axis: AnatomyAxis, visible: boolean) => {
    setCtPlaneVisibility((prev) => ({
      ...prev,
      [axis]: visible,
    }))
  }

  const handleCtPlaneSliceChange = (axis: AnatomyAxis, value: number) => {
    setCtPlaneSlices((prev) => ({
      ...prev,
      [axis]: value,
    }))
  }

  const downloads = selectedModel.downloads
  const xrModel = getModel(selectedModel.slug)
  const controlCardClassName =
    'grid gap-4 rounded-2xl border border-slate-500/20 bg-white/[0.04] p-4'
  const controlLabelClassName =
    'text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400'

  const viewerControlPanel = (
    <div className="grid gap-4">
      <div>
        <div className={controlLabelClassName}>Scene Controls</div>
        <h2 className="mt-1 text-lg font-semibold text-white">Anatomy workspace</h2>
      </div>

      <section className={controlCardClassName}>
        <label className="grid gap-2">
          <span className={controlLabelClassName}>Model</span>
          <select
            value={selectedModel.id}
            onChange={(event) => {
              const nextModel = models.find((model) => model.id === event.target.value)
              if (nextModel) {
                handleModelChange(nextModel)
              }
            }}
            className="min-h-11 w-full rounded-xl border border-slate-500/25 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={controlCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={controlLabelClassName}>Cross-section</div>
            <h3 className="mt-1 text-base font-semibold text-white">Cut plane</h3>
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
        <div className="grid gap-2">
          <label className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={showAnnotations}
              onChange={(event) => setShowAnnotations(event.target.checked)}
              className="h-4 w-4 accent-cyan-300"
            />
            <span>Show annotations</span>
          </label>
          <label className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={showDebugHelpers}
              onChange={(event) => setShowDebugHelpers(event.target.checked)}
              className="h-4 w-4 accent-cyan-300"
            />
            <span>Show grid</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            setCrossSection(0)
            setVisibleSegments(
              Object.fromEntries(
                segmentList.map((segment) => [segment.id, segment.visibleByDefault !== false]),
              ),
            )
            setShowAnnotations(true)
            setVolumeSlice(0)
            setShowCtPlanes(true)
            setCtPlaneVisibility(defaultCtPlaneVisibility)
            setCtPlaneSlices(defaultCtPlaneSlices)
            setCtPlaneOpacity(0.3)
            setCtClipMode('none')
            setCtClipAxis('z')
            setResetSignal((signal) => signal + 1)
            setRotation({ x: 0, y: 0, z: 0 })
          }}
          className="min-h-10 rounded-full border border-cyan-300/30 bg-cyan-300/15 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
        >
          Reset workspace
        </button>
      </section>

      <section className={controlCardClassName}>
        <div>
          <div className={controlLabelClassName}>3D CT</div>
          <h3 className="mt-1 text-base font-semibold text-white">Orthogonal planes</h3>
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
                onChange={(event) => handleCtPlaneVisibilityChange(axis, event.target.checked)}
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
                onChange={(event) => handleCtPlaneSliceChange(axis, Number(event.target.value))}
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

      <section className={controlCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={controlLabelClassName}>Rotation</div>
            <h3 className="mt-1 text-base font-semibold text-white">Model orientation</h3>
          </div>
          <button
            type="button"
            onClick={() => setRotation({ x: 0, y: 0, z: 0 })}
            className="text-xs font-semibold text-cyan-200 transition hover:text-white"
          >
            Reset
          </button>
        </div>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={axis} className="grid gap-2">
            <span className="flex items-center justify-between text-xs text-slate-400">
              <span className={controlLabelClassName}>{axis.toUpperCase()} axis</span>
              <span className="text-white">{rotation[axis].toFixed(0)}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation[axis]}
              onChange={(event) =>
                setRotation((prev) => ({ ...prev, [axis]: Number(event.target.value) }))
              }
              className="w-full accent-cyan-300"
            />
          </label>
        ))}
      </section>

      <section className={controlCardClassName}>
        <div>
          <div className={controlLabelClassName}>Visibility</div>
          <h3 className="mt-1 text-base font-semibold text-white">Structures</h3>
        </div>
        <div className="grid max-h-72 gap-2 overflow-auto pr-1">
          {segmentList.map((segment) => (
            <label
              key={segment.id}
              className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={visibleSegments[segment.id] ?? true}
                onChange={() => handleToggleSegment(segment.id)}
                className="h-4 w-4 accent-cyan-300"
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate">{segment.name}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )

  return (
    <div className="space-y-12 py-16">
      <section className="container space-y-4">
        <div className="space-y-2">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Learn · Anatomy
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Interactive 3D Anatomy Viewer
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Explore airway structures, vasculature, and lobar relationships with orbit controls,
            cross-sectional slicing, annotated segments, and WebXR spatial viewing for supported
            headsets. Built for fellows and faculty running rehearsal labs or patient consults.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href={'/learn/anatomy/ct-alignment' as Route}>Open CT alignment sandbox</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container">
        <AnatomyViewerDynamic
          key={selectedModel.id}
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
          showDebugHelpers={showDebugHelpers}
          rotation={rotation}
          controlPanel={viewerControlPanel}
          onScreenshot={(dataUrl) => {
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = `${selectedModel.slug}-anatomy.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }}
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
              if (identical) {
                return prev
              }
              return segments
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
      </section>

      <section className="container grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/30 p-6">
          <h2 className="text-lg font-semibold">About this structure</h2>
          <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
          <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                Clinical relevance
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/90">
                {selectedModel.clinicalRelevance}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
                Related procedures
              </h3>
              <p className="mt-1 text-sm text-muted-foreground/90">
                {selectedModel.relatedProcedures.join(', ')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-lg font-semibold">Download model</h2>
          <p className="text-sm text-muted-foreground">
            Export the optimized STL or GLB to incorporate in your rehearsal lab, print farm, or
            teaching decks.
          </p>
          <div className="flex flex-wrap gap-2">
            {downloads.map((download) => (
              <Button key={download.url} asChild variant="outline">
                <a href={download.url} download>
                  {download.format.toUpperCase()} ·{' '}
                  {download.sizeMB ? `${download.sizeMB} MB` : 'N/A'}
                </a>
              </Button>
            ))}
          </div>
          {xrModel ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Spatial headset mode</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open the viewer in a WebXR-capable headset browser to inspect the model at room
                  scale. Select or pinch a visible segment to move it; squeeze recenters it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/xr/${xrModel.slug}` as Route}>Open fullscreen spatial viewer</Link>
                </Button>
                {xrModel.usdzSrc ? (
                  <Button asChild variant="outline">
                    <a href={xrModel.usdzSrc} rel="ar">
                      View in AR
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {selectedModel.notes ? (
            <p className="text-xs text-muted-foreground/80">{selectedModel.notes}</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
