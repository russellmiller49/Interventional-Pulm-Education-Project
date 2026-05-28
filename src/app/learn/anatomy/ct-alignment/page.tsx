'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { Copy, RotateCcw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { AnatomyViewerDynamic } from '@/components/3d/AnatomyViewerDynamic'
import {
  DEFAULT_CT_ALIGNMENT,
  DEFAULT_CT_SLICE_ORIENTATION,
  type AnatomyAxis,
  type AnatomySceneMetrics,
  type CtAlignmentConfig,
  type CtSliceOrientationByAxis,
  type OrthogonalClipMode,
} from '@/components/3d/AnatomyViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { anatomyModels } from '@/data/printable-models'
import type { AnatomyModel, AnatomySegment } from '@/lib/types'

const axisLabels: Record<AnatomyAxis, string> = {
  x: 'Sagittal',
  y: 'Coronal',
  z: 'Axial',
}

const anatomyAxes: AnatomyAxis[] = ['z', 'y', 'x']
const rotationOptions = [0, 90, 180, 270]
type TranslationRangeKey = 'fine' | 'wide' | 'full'

const translationRanges: Record<TranslationRangeKey, { label: string; max: number; step: number }> =
  {
    fine: { label: 'Fine +/-300 mm', max: 300, step: 1 },
    wide: { label: 'Wide +/-1200 mm', max: 1200, step: 2 },
    full: { label: 'Full body +/-3000 mm', max: 3000, step: 5 },
  }

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

function cloneCtAlignment(model?: AnatomyModel): CtAlignmentConfig {
  const alignment = model?.volume?.ctAlignment
  return {
    translationMm: {
      ...DEFAULT_CT_ALIGNMENT.translationMm,
      ...alignment?.translationMm,
    },
    rotationDegrees: {
      ...DEFAULT_CT_ALIGNMENT.rotationDegrees,
      ...alignment?.rotationDegrees,
    },
    scale: alignment?.scale ?? DEFAULT_CT_ALIGNMENT.scale,
    flip: {
      ...DEFAULT_CT_ALIGNMENT.flip,
      ...alignment?.flip,
    },
  }
}

function cloneSliceOrientation(model?: AnatomyModel): CtSliceOrientationByAxis {
  return Object.fromEntries(
    anatomyAxes.map((axis) => [
      axis,
      {
        ...DEFAULT_CT_SLICE_ORIENTATION[axis],
        ...model?.volume?.ctSliceOrientation?.[axis],
      },
    ]),
  ) as CtSliceOrientationByAxis
}

function getTranslationRangeKeyForVector(translation: CtAlignmentConfig['translationMm']) {
  const maxOffset = Math.max(
    Math.abs(translation.x),
    Math.abs(translation.y),
    Math.abs(translation.z),
  )
  if (maxOffset > translationRanges.wide.max) {
    return 'full'
  }
  if (maxOffset > translationRanges.fine.max) {
    return 'wide'
  }
  return 'fine'
}

function roundMillimeters(value: number) {
  return Math.round(value)
}

function getDefaultSandboxModel(): AnatomyModel {
  return (
    anatomyModels.find((model) => model.id === 'te-fistula-patient') ??
    anatomyModels[anatomyModels.length - 1]
  )
}

export default function CtAlignmentSandboxPage() {
  const models = anatomyModels
  const defaultModel = useMemo(() => getDefaultSandboxModel(), [])
  const [selectedModel, setSelectedModel] = useState<AnatomyModel>(defaultModel)
  const [displaySegments, setDisplaySegments] = useState<AnatomySegment[]>(() =>
    defaultModel.segments.map((segment) => ({ ...segment })),
  )
  const [visibleSegments, setVisibleSegments] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      defaultModel.segments.map((segment) => [segment.id, segment.visibleByDefault !== false]),
    ),
  )
  const [volumeSlice, setVolumeSlice] = useState(50)
  const [crossSection, setCrossSection] = useState(0)
  const [showCtPlanes, setShowCtPlanes] = useState(true)
  const [ctPlaneVisibility, setCtPlaneVisibility] =
    useState<Record<AnatomyAxis, boolean>>(defaultCtPlaneVisibility)
  const [ctPlaneSlices, setCtPlaneSlices] =
    useState<Record<AnatomyAxis, number>>(defaultCtPlaneSlices)
  const [ctPlaneOpacity, setCtPlaneOpacity] = useState(0.42)
  const [ctClipMode, setCtClipMode] = useState<OrthogonalClipMode>('none')
  const [ctClipAxis, setCtClipAxis] = useState<AnatomyAxis>('z')
  const [ctAlignment, setCtAlignment] = useState<CtAlignmentConfig>(() =>
    cloneCtAlignment(defaultModel),
  )
  const [ctSliceOrientation, setCtSliceOrientation] = useState<CtSliceOrientationByAxis>(() =>
    cloneSliceOrientation(defaultModel),
  )
  const [showDebugHelpers, setShowDebugHelpers] = useState(true)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 })
  const [translationRangeKey, setTranslationRangeKey] = useState<TranslationRangeKey>(() =>
    getTranslationRangeKeyForVector(cloneCtAlignment(defaultModel).translationMm),
  )
  const [sceneMetrics, setSceneMetrics] = useState<AnatomySceneMetrics | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [copyStatus, setCopyStatus] = useState('')
  const translationRange = translationRanges[translationRangeKey]

  const viewerModel = useMemo<AnatomyModel>(
    () => ({
      ...selectedModel,
      segments: displaySegments,
    }),
    [displaySegments, selectedModel],
  )

  const calibrationExport = useMemo(
    () => ({
      modelId: selectedModel.id,
      modelSlug: selectedModel.slug,
      ctAlignment,
      ctSliceOrientation,
      ctPlaneDefaults: {
        showCtPlanes,
        ctPlaneVisibility,
        ctPlaneSlices,
        ctPlaneOpacity,
        ctClipMode,
        ctClipAxis,
      },
      surfaceModelRotationDegrees: rotation,
    }),
    [
      ctAlignment,
      ctClipAxis,
      ctClipMode,
      ctPlaneOpacity,
      ctPlaneSlices,
      ctPlaneVisibility,
      ctSliceOrientation,
      rotation,
      selectedModel.id,
      selectedModel.slug,
      showCtPlanes,
    ],
  )

  const calibrationJson = useMemo(
    () => JSON.stringify(calibrationExport, null, 2),
    [calibrationExport],
  )

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(calibrationJson)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy unavailable')
    }
  }

  const resetWorkspace = () => {
    setCrossSection(0)
    setVolumeSlice(50)
    setShowCtPlanes(true)
    setCtPlaneVisibility(defaultCtPlaneVisibility)
    setCtPlaneSlices(defaultCtPlaneSlices)
    setCtPlaneOpacity(0.42)
    setCtClipMode('none')
    setCtClipAxis('z')
    const modelAlignment = cloneCtAlignment(selectedModel)
    setCtAlignment(modelAlignment)
    setCtSliceOrientation(cloneSliceOrientation(selectedModel))
    setShowDebugHelpers(true)
    setShowAnnotations(true)
    setRotation({ x: 0, y: 0, z: 0 })
    setTranslationRangeKey(getTranslationRangeKeyForVector(modelAlignment.translationMm))
    setSceneMetrics(null)
    setResetSignal((signal) => signal + 1)
    setVisibleSegments(
      Object.fromEntries(
        displaySegments.map((segment) => [segment.id, segment.visibleByDefault !== false]),
      ),
    )
  }

  const handleModelChange = (modelId: string) => {
    const nextModel = models.find((model) => model.id === modelId)
    if (!nextModel) {
      return
    }
    const nextSegments = nextModel.segments.map((segment) => ({ ...segment }))
    setSelectedModel(nextModel)
    setDisplaySegments(nextSegments)
    setVisibleSegments(
      Object.fromEntries(
        nextSegments.map((segment) => [segment.id, segment.visibleByDefault !== false]),
      ),
    )
    setCrossSection(0)
    setVolumeSlice(50)
    setShowCtPlanes(true)
    setCtPlaneVisibility(defaultCtPlaneVisibility)
    setCtPlaneSlices(defaultCtPlaneSlices)
    setCtPlaneOpacity(0.42)
    setCtClipMode('none')
    setCtClipAxis(nextModel.volume?.axis ?? 'z')
    const modelAlignment = cloneCtAlignment(nextModel)
    setCtAlignment(modelAlignment)
    setCtSliceOrientation(cloneSliceOrientation(nextModel))
    setShowDebugHelpers(true)
    setShowAnnotations(true)
    setRotation({ x: 0, y: 0, z: 0 })
    setTranslationRangeKey(getTranslationRangeKeyForVector(modelAlignment.translationMm))
    setSceneMetrics(null)
    setResetSignal((signal) => signal + 1)
    setCopyStatus('')
  }

  const updateCtPlaneVisibility = (axis: AnatomyAxis, visible: boolean) => {
    setCtPlaneVisibility((prev) => ({ ...prev, [axis]: visible }))
  }

  const updateCtPlaneSlice = (axis: AnatomyAxis, value: number) => {
    setCtPlaneSlices((prev) => ({ ...prev, [axis]: value }))
  }

  const updateCtTranslation = (axis: AnatomyAxis, value: number) => {
    setCtAlignment((prev) => ({
      ...prev,
      translationMm: { ...prev.translationMm, [axis]: value },
    }))
  }

  const nudgeCtTranslation = (axis: AnatomyAxis, delta: number) => {
    setCtAlignment((prev) => ({
      ...prev,
      translationMm: {
        ...prev.translationMm,
        [axis]: prev.translationMm[axis] + delta,
      },
    }))
  }

  const applySuggestedCenterAlignment = () => {
    if (!sceneMetrics) {
      return
    }
    const translation = {
      x: roundMillimeters(sceneMetrics.suggestedCtTranslationMm[0]),
      y: roundMillimeters(sceneMetrics.suggestedCtTranslationMm[1]),
      z: roundMillimeters(sceneMetrics.suggestedCtTranslationMm[2]),
    }
    setCtAlignment((prev) => ({
      ...prev,
      translationMm: translation,
    }))
    setTranslationRangeKey(getTranslationRangeKeyForVector(translation))
  }

  const handleSceneMetrics = useCallback((metrics: AnatomySceneMetrics | null) => {
    setSceneMetrics(metrics)
  }, [])

  const updateCtRotation = (axis: AnatomyAxis, value: number) => {
    setCtAlignment((prev) => ({
      ...prev,
      rotationDegrees: { ...prev.rotationDegrees, [axis]: value },
    }))
  }

  const updateCtFlip = (axis: AnatomyAxis, checked: boolean) => {
    setCtAlignment((prev) => ({
      ...prev,
      flip: { ...prev.flip, [axis]: checked },
    }))
  }

  const updateSliceOrientation = (
    axis: AnatomyAxis,
    patch: Partial<CtSliceOrientationByAxis[AnatomyAxis]>,
  ) => {
    setCtSliceOrientation((prev) => ({
      ...prev,
      [axis]: {
        ...prev[axis],
        ...patch,
      },
    }))
  }

  const toggleSegment = (segmentId: string) => {
    setVisibleSegments((prev) => ({ ...prev, [segmentId]: !prev[segmentId] }))
  }

  const controlCardClassName =
    'grid gap-4 rounded-2xl border border-slate-500/20 bg-white/[0.04] p-4'
  const controlLabelClassName =
    'text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400'
  const smallInputClassName =
    'min-h-9 rounded-lg border border-slate-500/25 bg-slate-950/80 px-2 text-xs text-white outline-none transition focus:border-cyan-300/70'

  const viewerControlPanel = (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={controlLabelClassName}>Temporary Module</div>
          <h2 className="mt-1 text-lg font-semibold text-white">CT alignment sandbox</h2>
        </div>
        <button
          type="button"
          onClick={resetWorkspace}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/15 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>

      <section className={controlCardClassName}>
        <label className="grid gap-2">
          <span className={controlLabelClassName}>Model</span>
          <select
            value={selectedModel.id}
            onChange={(event) => handleModelChange(event.target.value)}
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
        <div>
          <div className={controlLabelClassName}>3D CT</div>
          <h3 className="mt-1 text-base font-semibold text-white">Planes and cut plane</h3>
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
        <div>
          <div className={controlLabelClassName}>CT Transform</div>
          <h3 className="mt-1 text-base font-semibold text-white">Volume alignment</h3>
        </div>
        <button
          type="button"
          onClick={applySuggestedCenterAlignment}
          disabled={!sceneMetrics}
          className="min-h-10 rounded-full border border-cyan-300/30 bg-cyan-300/15 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Center CT on model
        </button>
        {sceneMetrics ? (
          <div className="rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
            Suggested center offset:{' '}
            {sceneMetrics.suggestedCtTranslationMm
              .map((value) => `${roundMillimeters(value)} mm`)
              .join(', ')}
          </div>
        ) : null}
        <label className="grid gap-2">
          <span className={controlLabelClassName}>Translation range</span>
          <select
            value={translationRangeKey}
            onChange={(event) => setTranslationRangeKey(event.target.value as TranslationRangeKey)}
            className="min-h-11 w-full rounded-xl border border-slate-500/25 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
          >
            {(Object.keys(translationRanges) as TranslationRangeKey[]).map((key) => (
              <option key={key} value={key}>
                {translationRanges[key].label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3">
          {anatomyAxes.map((axis) => (
            <label key={`translate-${axis}`} className="grid gap-2">
              <span className="flex items-center justify-between text-xs text-slate-400">
                <span className={controlLabelClassName}>{axis.toUpperCase()} offset</span>
                <span className="text-white">{ctAlignment.translationMm[axis].toFixed(0)} mm</span>
              </span>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <input
                  type="range"
                  min={-translationRange.max}
                  max={translationRange.max}
                  step={translationRange.step}
                  value={ctAlignment.translationMm[axis]}
                  onChange={(event) => updateCtTranslation(axis, Number(event.target.value))}
                  className="w-full accent-cyan-300"
                />
                <input
                  type="number"
                  value={ctAlignment.translationMm[axis]}
                  step={1}
                  onChange={(event) => updateCtTranslation(axis, Number(event.target.value))}
                  className={smallInputClassName}
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[-500, -100, 100, 500].map((delta) => (
                  <button
                    key={`${axis}-${delta}`}
                    type="button"
                    onClick={() => nudgeCtTranslation(axis, delta)}
                    className="min-h-8 rounded-lg border border-slate-500/20 bg-slate-950/60 px-2 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </label>
          ))}
        </div>
        <div className="grid gap-3">
          {anatomyAxes.map((axis) => (
            <label key={`rotate-${axis}`} className="grid gap-2">
              <span className="flex items-center justify-between text-xs text-slate-400">
                <span className={controlLabelClassName}>{axis.toUpperCase()} rotation</span>
                <span className="text-white">
                  {ctAlignment.rotationDegrees[axis].toFixed(0)} deg
                </span>
              </span>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={ctAlignment.rotationDegrees[axis]}
                  onChange={(event) => updateCtRotation(axis, Number(event.target.value))}
                  className="w-full accent-cyan-300"
                />
                <input
                  type="number"
                  value={ctAlignment.rotationDegrees[axis]}
                  step={1}
                  onChange={(event) => updateCtRotation(axis, Number(event.target.value))}
                  className={smallInputClassName}
                />
              </div>
            </label>
          ))}
        </div>
        <label className="grid gap-2">
          <span className="flex items-center justify-between text-xs text-slate-400">
            <span className={controlLabelClassName}>CT scale</span>
            <span className="text-white">{ctAlignment.scale.toFixed(2)}</span>
          </span>
          <div className="grid grid-cols-[1fr_5.5rem] gap-2">
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.01}
              value={ctAlignment.scale}
              onChange={(event) =>
                setCtAlignment((prev) => ({ ...prev, scale: Number(event.target.value) }))
              }
              className="w-full accent-cyan-300"
            />
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={ctAlignment.scale}
              onChange={(event) =>
                setCtAlignment((prev) => ({ ...prev, scale: Number(event.target.value) }))
              }
              className={smallInputClassName}
            />
          </div>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {anatomyAxes.map((axis) => (
            <label
              key={`flip-${axis}`}
              className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-xs text-slate-200"
            >
              <input
                type="checkbox"
                checked={ctAlignment.flip[axis]}
                onChange={(event) => updateCtFlip(axis, event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              <span>Flip {axis.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={controlCardClassName}>
        <div>
          <div className={controlLabelClassName}>2D Views</div>
          <h3 className="mt-1 text-base font-semibold text-white">Slice orientation</h3>
        </div>
        <div className="grid gap-3">
          {anatomyAxes.map((axis) => (
            <div key={`slice-${axis}`} className="grid gap-2 rounded-xl bg-slate-950/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">{axisLabels[axis]}</span>
                <select
                  value={ctSliceOrientation[axis].rotationDegrees}
                  onChange={(event) =>
                    updateSliceOrientation(axis, {
                      rotationDegrees: Number(event.target.value),
                    })
                  }
                  className="min-h-9 rounded-lg border border-slate-500/25 bg-slate-950/80 px-2 text-xs text-white outline-none transition focus:border-cyan-300/70"
                >
                  {rotationOptions.map((rotationOption) => (
                    <option key={rotationOption} value={rotationOption}>
                      Rotate {rotationOption} deg
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
                <label className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-500/20 px-2">
                  <input
                    type="checkbox"
                    checked={ctSliceOrientation[axis].flipHorizontal}
                    onChange={(event) =>
                      updateSliceOrientation(axis, {
                        flipHorizontal: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-cyan-300"
                  />
                  <span>Flip H</span>
                </label>
                <label className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-500/20 px-2">
                  <input
                    type="checkbox"
                    checked={ctSliceOrientation[axis].flipVertical}
                    onChange={(event) =>
                      updateSliceOrientation(axis, {
                        flipVertical: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-cyan-300"
                  />
                  <span>Flip V</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={controlCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={controlLabelClassName}>Rotation</div>
            <h3 className="mt-1 text-base font-semibold text-white">Surface model</h3>
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
          <label key={`model-${axis}`} className="grid gap-2">
            <span className="flex items-center justify-between text-xs text-slate-400">
              <span className={controlLabelClassName}>{axis.toUpperCase()} axis</span>
              <span className="text-white">{rotation[axis].toFixed(0)} deg</span>
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
        <div className="grid max-h-56 gap-2 overflow-auto pr-1">
          {displaySegments.map((segment) => (
            <label
              key={segment.id}
              className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-500/20 bg-slate-950/50 px-3 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={visibleSegments[segment.id] ?? true}
                onChange={() => toggleSegment(segment.id)}
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
          <span>Show axes and camera</span>
        </label>
      </section>

      <section className={controlCardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={controlLabelClassName}>Export</div>
            <h3 className="mt-1 text-base font-semibold text-white">Current settings</h3>
          </div>
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-400/20 bg-slate-900/80 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </button>
        </div>
        {copyStatus ? <p className="text-xs text-cyan-200">{copyStatus}</p> : null}
        <pre className="max-h-72 overflow-auto rounded-xl border border-slate-500/20 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-300">
          {calibrationJson}
        </pre>
      </section>
    </div>
  )

  return (
    <div className="space-y-8 py-10">
      <section className="container space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <Badge
              variant="info"
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              Temporary CT Calibration
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">CT Alignment Sandbox</h1>
            <p className="text-muted-foreground">
              Live workspace for lining up the updated fistula GLB with the diagnostic CT volume,
              checking 3D cut planes, and correcting axial, coronal, and sagittal view orientation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={'/learn/anatomy' as Route}>Back to anatomy viewer</Link>
            </Button>
            <Button onClick={handleCopyJson}>
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Copy settings JSON
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
          ctAlignment={ctAlignment}
          ctSliceOrientation={ctSliceOrientation}
          showAnnotations={showAnnotations}
          resetSignal={resetSignal}
          showDebugHelpers={showDebugHelpers}
          rotation={rotation}
          controlPanel={viewerControlPanel}
          onSceneMetrics={handleSceneMetrics}
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
      </section>
    </div>
  )
}
