'use client'

/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import {
  Clipboard,
  FileJson,
  Move,
  RotateCcw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'

import { cytologySlides, defaultCytologySlideId } from '../content/slides'
import { getAnnotationById, getAnnotationOverlayStyle } from '../engine/annotations'
import type { CytologyAnnotation, CytologyAnnotationShape, CytologySlide } from '../engine/types'

type DragMode = 'move' | 'resize'

interface DragState {
  annotationId: string
  mode: DragMode
  pointerId: number
}

interface NaturalImageSize {
  width: number
  height: number
}

const minRadiusPct = 1
const maxRadiusPct = 40
const coordinateStep = 0.5

export function AnnotationWorkbench() {
  const [slides, setSlides] = React.useState<CytologySlide[]>(cloneSlides)
  const [activeSlideId, setActiveSlideId] = React.useState(defaultCytologySlideId)
  const [selectedAnnotationId, setSelectedAnnotationId] = React.useState(
    cytologySlides[0]?.annotations[0]?.id ?? '',
  )
  const [zoom, setZoom] = React.useState(1)
  const [copied, setCopied] = React.useState<'slide' | 'all' | null>(null)
  const [naturalSize, setNaturalSize] = React.useState<NaturalImageSize | null>(null)

  const imageRef = React.useRef<HTMLImageElement | null>(null)
  const dragStateRef = React.useRef<DragState | null>(null)

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0]
  const originalSlide =
    cytologySlides.find((slide) => slide.id === activeSlide.id) ?? cytologySlides[0]
  const selectedAnnotation =
    getAnnotationById(activeSlide, selectedAnnotationId) ?? activeSlide.annotations[0]

  const activeSlidePatch = formatSlidePatch(activeSlide)
  const allSlidesPatch = formatAllSlidesPatch(slides)

  const selectSlide = (slide: CytologySlide) => {
    setActiveSlideId(slide.id)
    setSelectedAnnotationId(slide.annotations[0]?.id ?? '')
    setNaturalSize(null)
  }

  const updateAnnotationShape = (
    annotationId: string,
    updater: (shape: CytologyAnnotationShape) => CytologyAnnotationShape,
  ) => {
    setSlides((currentSlides) =>
      currentSlides.map((slide) => {
        if (slide.id !== activeSlide.id) {
          return slide
        }

        return {
          ...slide,
          annotations: slide.annotations.map((annotation) =>
            annotation.id === annotationId
              ? { ...annotation, shape: normalizeShape(updater(annotation.shape)) }
              : annotation,
          ),
        }
      }),
    )
  }

  const setSelectedShapeValue = (
    key: keyof Omit<CytologyAnnotationShape, 'type'>,
    value: number,
  ) => {
    if (!selectedAnnotation || Number.isNaN(value)) {
      return
    }

    updateAnnotationShape(selectedAnnotation.id, (shape) => ({ ...shape, [key]: value }))
  }

  const nudgeSelected = (dxPct: number, dyPct: number) => {
    if (!selectedAnnotation) {
      return
    }

    updateAnnotationShape(selectedAnnotation.id, (shape) => ({
      ...shape,
      xPct: shape.xPct + dxPct,
      yPct: shape.yPct + dyPct,
    }))
  }

  const resetActiveSlide = () => {
    setSlides((currentSlides) =>
      currentSlides.map((slide) =>
        slide.id === activeSlide.id ? cloneSlide(originalSlide) : slide,
      ),
    )
    setSelectedAnnotationId(
      originalSlide.annotations.some((annotation) => annotation.id === selectedAnnotationId)
        ? selectedAnnotationId
        : (originalSlide.annotations[0]?.id ?? ''),
    )
  }

  const resetAllSlides = () => {
    setSlides(cloneSlides())
    setActiveSlideId(defaultCytologySlideId)
    setSelectedAnnotationId(cytologySlides[0]?.annotations[0]?.id ?? '')
    setNaturalSize(null)
  }

  const getPointerPoint = (event: { clientX: number; clientY: number }) => {
    const bounds = imageRef.current?.getBoundingClientRect()

    if (!bounds) {
      return null
    }

    return {
      xPct: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      yPct: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    }
  }

  const moveSelectedToPointer = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedAnnotation) {
      return
    }

    const point = getPointerPoint(event)

    if (!point) {
      return
    }

    updateAnnotationShape(selectedAnnotation.id, (shape) => ({
      ...shape,
      xPct: point.xPct,
      yPct: point.yPct,
    }))
  }

  const beginDrag = (
    event: React.PointerEvent<HTMLElement>,
    annotation: CytologyAnnotation,
    mode: DragMode,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedAnnotationId(annotation.id)
    dragStateRef.current = { annotationId: annotation.id, mode, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const point = getPointerPoint(event)

    if (!point) {
      return
    }

    updateAnnotationShape(dragState.annotationId, (shape) => {
      if (dragState.mode === 'move') {
        return {
          ...shape,
          xPct: point.xPct,
          yPct: point.yPct,
        }
      }

      return {
        ...shape,
        radiusXPct: Math.abs(point.xPct - shape.xPct),
        radiusYPct: Math.abs(point.yPct - shape.yPct),
      }
    })
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
    }
  }

  const copyPatch = async (kind: 'slide' | 'all') => {
    const text = kind === 'slide' ? activeSlidePatch : allSlidesPatch
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="space-y-8">
      <section className="container space-y-4 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Offline dev tool</Badge>
          <Badge variant="outline">Coordinate calibration</Badge>
          <Badge variant="success">{activeSlide.annotations.length} active hotspots</Badge>
        </div>
        <div className="max-w-4xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Cytology annotation workbench
          </h2>
          <p className="text-base leading-7 text-muted-foreground md:text-lg">
            Drag hotspot ellipses onto the actual cells, resize the selected region, then copy the
            normalized percent coordinates back into the slide content file.
          </p>
        </div>
      </section>

      <section className="container grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
          <div>
            <h3 className="text-lg font-semibold">Slides</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Use the same imported Creative Commons images as the teaching module.
            </p>
          </div>
          <div className="grid gap-2">
            {slides.map((slide, index) => {
              const isActive = slide.id === activeSlide.id

              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => selectSlide(slide)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-primary/60 bg-primary/10 shadow-sm'
                      : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Slide {index + 1}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {slide.annotations.length}
                    </span>
                  </span>
                  <span className="mt-2 block font-semibold leading-5">{slide.shortTitle}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {slide.diagnosisTheme}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <Card className="min-w-0 overflow-hidden rounded-lg">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <CardTitle className="text-2xl">{activeSlide.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{activeSlide.stain}</Badge>
                  <Badge variant="default">{activeSlide.diagnosisTheme}</Badge>
                  {naturalSize ? (
                    <Badge variant="outline">
                      {naturalSize.width} x {naturalSize.height}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetActiveSlide}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Reset slide
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetAllSlides}>
                  Reset all
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                aria-label="Workbench zoom"
                className="h-2 w-48 accent-primary"
                type="range"
                min="0.75"
                max="3"
                step="0.25"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="rounded-full bg-background px-3 py-1 text-sm font-medium">
                {Math.round(zoom * 100)}%
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Move className="h-4 w-4" aria-hidden />
                Drag ellipses; click image to move selected center.
              </span>
            </div>
          </CardHeader>

          <CardContent>
            <div
              className="overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-inner"
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div
                className="relative mx-auto select-none"
                style={{ width: `${Math.round(zoom * 100)}%` }}
                onClick={moveSelectedToPointer}
              >
                <img
                  ref={imageRef}
                  src={activeSlide.imageUrl}
                  alt={activeSlide.imageAlt}
                  className="block h-auto w-full rounded-md"
                  draggable={false}
                  onLoad={(event) => {
                    setNaturalSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }}
                />
                <div className="absolute inset-0" aria-label="Editable cytology annotations">
                  {activeSlide.annotations.map((annotation, index) => {
                    const isSelected = annotation.id === selectedAnnotation?.id

                    return (
                      <button
                        key={annotation.id}
                        type="button"
                        aria-label={`Select ${annotation.label}`}
                        aria-pressed={isSelected}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedAnnotationId(annotation.id)
                        }}
                        onPointerDown={(event) => beginDrag(event, annotation, 'move')}
                        className={cn(
                          'absolute rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                          isSelected
                            ? 'border-cyan-200 bg-cyan-300/20 shadow-[0_0_0_4px_rgba(34,211,238,0.25)]'
                            : 'border-amber-200 bg-amber-300/15 hover:border-cyan-200 hover:bg-cyan-300/20',
                        )}
                        style={{
                          ...getAnnotationOverlayStyle(annotation),
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/85 text-xs font-semibold text-white shadow">
                          {index + 1}
                        </span>
                      </button>
                    )
                  })}
                  {selectedAnnotation ? (
                    <button
                      type="button"
                      aria-label={`Resize ${selectedAnnotation.label}`}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => beginDrag(event, selectedAnnotation, 'resize')}
                      className="absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-white bg-cyan-500 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      style={{
                        left: `${selectedAnnotation.shape.xPct + selectedAnnotation.shape.radiusXPct}%`,
                        top: `${selectedAnnotation.shape.yPct + selectedAnnotation.shape.radiusYPct}%`,
                      }}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Selected hotspot</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              {selectedAnnotation ? (
                <>
                  <div className="space-y-2">
                    <Badge variant="info">{selectedAnnotation.cellType}</Badge>
                    <h3 className="text-xl font-semibold leading-7">{selectedAnnotation.label}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {selectedAnnotation.explanation}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ShapeNumberInput
                      label="X %"
                      value={selectedAnnotation.shape.xPct}
                      onChange={(value) => setSelectedShapeValue('xPct', value)}
                    />
                    <ShapeNumberInput
                      label="Y %"
                      value={selectedAnnotation.shape.yPct}
                      onChange={(value) => setSelectedShapeValue('yPct', value)}
                    />
                    <ShapeNumberInput
                      label="Radius X %"
                      value={selectedAnnotation.shape.radiusXPct}
                      min={minRadiusPct}
                      max={maxRadiusPct}
                      onChange={(value) => setSelectedShapeValue('radiusXPct', value)}
                    />
                    <ShapeNumberInput
                      label="Radius Y %"
                      value={selectedAnnotation.shape.radiusYPct}
                      min={minRadiusPct}
                      max={maxRadiusPct}
                      onChange={(value) => setSelectedShapeValue('radiusYPct', value)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div />
                    <NudgeButton label="Nudge up" onClick={() => nudgeSelected(0, -coordinateStep)}>
                      Up
                    </NudgeButton>
                    <div />
                    <NudgeButton
                      label="Nudge left"
                      onClick={() => nudgeSelected(-coordinateStep, 0)}
                    >
                      Left
                    </NudgeButton>
                    <NudgeButton
                      label="Nudge down"
                      onClick={() => nudgeSelected(0, coordinateStep)}
                    >
                      Down
                    </NudgeButton>
                    <NudgeButton
                      label="Nudge right"
                      onClick={() => nudgeSelected(coordinateStep, 0)}
                    >
                      Right
                    </NudgeButton>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a hotspot to edit.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-primary" aria-hidden />
                <CardTitle>Export coordinates</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="gap-4 text-sm leading-6">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void copyPatch('slide')}>
                  <Clipboard className="h-4 w-4" aria-hidden />
                  {copied === 'slide' ? 'Copied slide' : 'Copy slide JSON'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyPatch('all')}
                >
                  {copied === 'all' ? 'Copied all' : 'Copy all JSON'}
                </Button>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                {activeSlidePatch}
              </pre>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                <p>
                  Open this slide in QuPath with{' '}
                  <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-950 dark:bg-amber-900/60 dark:text-amber-100">
                    npm run rose:qupath -- {activeSlide.id}
                  </code>
                  .
                </p>
                <p className="mt-3">
                  This is intentionally an offline authoring aid. QuPath, Cellpose-SAM, TIA Toolbox,
                  CONCH, and HISTAI can help generate candidate objects, but the teaching label and
                  final hotspot placement still need expert review.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  )
}

function ShapeNumberInput({
  label,
  max = 100,
  min = 0,
  onChange,
  value,
}: {
  label: string
  max?: number
  min?: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="number"
        min={min}
        max={max}
        step={coordinateStep}
        value={roundPct(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function NudgeButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

function cloneSlides() {
  return cytologySlides.map(cloneSlide)
}

function cloneSlide(slide: CytologySlide): CytologySlide {
  return {
    ...slide,
    annotations: slide.annotations.map((annotation) => ({
      ...annotation,
      shape: { ...annotation.shape },
      featureTags: [...annotation.featureTags],
      quiz: {
        ...annotation.quiz,
        choices: annotation.quiz.choices.map((choice) => ({ ...choice })),
      },
    })),
    learningObjectives: [...slide.learningObjectives],
    source: { ...slide.source },
  }
}

function normalizeShape(shape: CytologyAnnotationShape): CytologyAnnotationShape {
  return {
    type: 'ellipse',
    xPct: roundPct(clamp(shape.xPct, 0, 100)),
    yPct: roundPct(clamp(shape.yPct, 0, 100)),
    radiusXPct: roundPct(clamp(shape.radiusXPct, minRadiusPct, maxRadiusPct)),
    radiusYPct: roundPct(clamp(shape.radiusYPct, minRadiusPct, maxRadiusPct)),
  }
}

function formatSlidePatch(slide: CytologySlide) {
  return JSON.stringify(
    {
      slideId: slide.id,
      imageUrl: slide.imageUrl,
      annotations: slide.annotations.map((annotation) => ({
        id: annotation.id,
        label: annotation.label,
        shape: normalizeShape(annotation.shape),
      })),
    },
    null,
    2,
  )
}

function formatAllSlidesPatch(slides: CytologySlide[]) {
  return JSON.stringify(
    slides.map((slide) => ({
      slideId: slide.id,
      annotations: slide.annotations.map((annotation) => ({
        id: annotation.id,
        shape: normalizeShape(annotation.shape),
      })),
    })),
    null,
    2,
  )
}

function roundPct(value: number) {
  return Number(value.toFixed(1))
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}
