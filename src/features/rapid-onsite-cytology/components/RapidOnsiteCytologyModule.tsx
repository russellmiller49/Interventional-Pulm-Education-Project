'use client'

/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  Microscope,
  Move,
  RotateCcw,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'

import { cytologySlides, defaultCytologySlideId } from '../content/slides'
import {
  getAnnotationById,
  getAnnotationOverlayStyle,
  getInitialAnnotation,
  isQuizAnswerCorrect,
} from '../engine/annotations'
import type { CytologyAnnotation, CytologyMode, CytologySlide } from '../engine/types'

const workflowLinks = [
  ...(process.env.NODE_ENV !== 'production'
    ? [
        {
          label: 'Offline hotspot workbench',
          href: '/resources/rapid-onsite-cytology/annotate',
        },
      ]
    : []),
  {
    label: 'QuPath GeoJSON export',
    href: 'https://qupath.github.io/javadoc/docs/qupath/lib/gui/commands/ExportObjectsCommand.html',
  },
  { label: 'Cellpose-SAM', href: 'https://www.cellpose.org/' },
  {
    label: 'TIA Toolbox nucleus segmentation',
    href: 'https://tia-toolbox.readthedocs.io/en/stable/_notebooks/jnb/08-nucleus-instance-segmentation.html',
  },
  { label: 'CONCH', href: 'https://github.com/mahmoodlab/CONCH' },
  { label: 'HISTAI', href: 'https://huggingface.co/papers/2505.12120' },
] as const

export function RapidOnsiteCytologyModule() {
  const [activeSlideId, setActiveSlideId] = React.useState(defaultCytologySlideId)
  const [selectedAnnotationId, setSelectedAnnotationId] = React.useState(
    cytologySlides[0]?.annotations[0]?.id ?? '',
  )
  const [mode, setMode] = React.useState<CytologyMode>('learn')
  const [showAnnotations, setShowAnnotations] = React.useState(true)
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, string>>({})
  const dragStateRef = React.useRef<{ pointerId: number; x: number; y: number } | null>(null)

  const activeSlide =
    cytologySlides.find((slide) => slide.id === activeSlideId) ?? cytologySlides[0]
  const selectedAnnotation =
    getAnnotationById(activeSlide, selectedAnnotationId) ?? getInitialAnnotation(activeSlide)
  const selectedChoiceId = selectedAnnotation ? quizAnswers[selectedAnnotation.id] : undefined

  const selectSlide = (slide: CytologySlide) => {
    setActiveSlideId(slide.id)
    setSelectedAnnotationId(slide.annotations[0]?.id ?? '')
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const selectAnnotation = (annotation: CytologyAnnotation) => {
    setSelectedAnnotationId(annotation.id)
  }

  const setQuizMode = (nextMode: CytologyMode) => {
    setMode(nextMode)
    setSelectedAnnotationId(selectedAnnotation?.id ?? activeSlide.annotations[0]?.id ?? '')
  }

  const answerQuiz = (choiceId: string) => {
    if (!selectedAnnotation) {
      return
    }

    setQuizAnswers((current) => ({ ...current, [selectedAnnotation.id]: choiceId }))
  }

  const resetViewer = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const answeredSlideCount = activeSlide.annotations.filter(
    (annotation) => quizAnswers[annotation.id],
  ).length

  return (
    <div className="space-y-8">
      <section className="container space-y-6 pt-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">ROSE trainer</Badge>
              <Badge variant="outline">Diff-Quik cytology</Badge>
              <Badge variant="success">{cytologySlides.length} teaching slides</Badge>
            </div>
            <div className="max-w-4xl space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Rapid onsite cytology interpretation
              </h2>
              <p className="text-base leading-7 text-muted-foreground md:text-lg">
                Hover, focus, or tap curated cells in ROSE and Diff-Quik examples to connect cell
                type, morphologic features, adequacy decisions, and common pitfalls.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p>
                This module is for education and slide-interpretation practice only. It is not a
                diagnostic tool, does not provide patient-specific advice, and does not replace
                final cytopathology review.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <SlideSelector
          activeSlide={activeSlide}
          onSelectSlide={selectSlide}
          slides={cytologySlides}
        />

        <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="min-w-0 overflow-hidden rounded-lg">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <CardTitle className="text-2xl">{activeSlide.title}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{activeSlide.stain}</Badge>
                    <Badge variant="default">{activeSlide.diagnosisTheme}</Badge>
                    <Badge variant="outline">{activeSlide.annotations.length} hotspots</Badge>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <SegmentedModeControl activeMode={mode} onModeChange={setQuizMode} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnnotations((value) => !value)}
                  >
                    {showAnnotations ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                    {showAnnotations ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground md:grid-cols-3">
                {activeSlide.learningObjectives.map((objective) => (
                  <div key={objective} className="flex min-w-0 gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    <span>{objective}</span>
                  </div>
                ))}
              </div>
            </CardHeader>

            <CardContent className="gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ViewerButton
                    label="Zoom out"
                    onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
                  >
                    <ZoomOut className="h-4 w-4" aria-hidden />
                  </ViewerButton>
                  <span className="min-w-20 rounded-full bg-muted px-3 py-1 text-center text-sm font-medium">
                    {Math.round(zoom * 100)}%
                  </span>
                  <ViewerButton
                    label="Zoom in"
                    onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
                  >
                    <ZoomIn className="h-4 w-4" aria-hidden />
                  </ViewerButton>
                  <ViewerButton label="Reset zoom and pan" onClick={resetViewer}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </ViewerButton>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Move className="h-4 w-4" aria-hidden />
                  Drag to pan after zooming
                </div>
              </div>

              <CytologyViewer
                activeAnnotation={selectedAnnotation}
                mode={mode}
                onPanChange={setPan}
                onSelectAnnotation={selectAnnotation}
                pan={pan}
                showAnnotations={showAnnotations}
                slide={activeSlide}
                zoom={zoom}
                dragStateRef={dragStateRef}
              />
            </CardContent>
          </Card>

          <InterpretationPanel
            activeSlide={activeSlide}
            annotation={selectedAnnotation}
            answeredSlideCount={answeredSlideCount}
            mode={mode}
            onAnswer={answerQuiz}
            selectedChoiceId={selectedChoiceId}
          />
        </div>
      </section>

      <section className="container pb-12">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-primary" aria-hidden />
              <CardTitle>Annotation workflow notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="gap-4 text-sm leading-6 text-muted-foreground">
            <p>
              V1 uses curated teaching hotspots. QuPath, Cellpose-SAM, TIA Toolbox, CONCH, and
              HISTAI are listed as future offline annotation or research aids, not runtime
              diagnostic engines in this browser module.
            </p>
            <div className="flex flex-wrap gap-2">
              {workflowLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function SlideSelector({
  activeSlide,
  onSelectSlide,
  slides,
}: {
  activeSlide: CytologySlide
  onSelectSlide: (slide: CytologySlide) => void
  slides: CytologySlide[]
}) {
  return (
    <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
      <div>
        <h3 className="text-lg font-semibold">Slide set</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Mixed ROSE examples selected from the imported Creative Commons cytology images.
        </p>
      </div>
      <div className="grid gap-2">
        {slides.map((slide, index) => {
          const isActive = activeSlide.id === slide.id

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelectSlide(slide)}
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
  )
}

function SegmentedModeControl({
  activeMode,
  onModeChange,
}: {
  activeMode: CytologyMode
  onModeChange: (mode: CytologyMode) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-muted/60 p-1">
      {(['learn', 'quiz'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onModeChange(mode)}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            activeMode === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode === 'learn' ? 'Learn mode' : 'Quiz mode'}
        </button>
      ))}
    </div>
  )
}

function ViewerButton({
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

function CytologyViewer({
  activeAnnotation,
  dragStateRef,
  mode,
  onPanChange,
  onSelectAnnotation,
  pan,
  showAnnotations,
  slide,
  zoom,
}: {
  activeAnnotation?: CytologyAnnotation
  dragStateRef: React.MutableRefObject<{ pointerId: number; x: number; y: number } | null>
  mode: CytologyMode
  onPanChange: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  onSelectAnnotation: (annotation: CytologyAnnotation) => void
  pan: { x: number; y: number }
  showAnnotations: boolean
  slide: CytologySlide
  zoom: number
}) {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || (event.target as HTMLElement).closest('[data-cytology-hotspot="true"]')) {
      return
    }

    dragStateRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const currentDrag = dragStateRef.current

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - currentDrag.x
    const deltaY = event.clientY - currentDrag.y
    dragStateRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    onPanChange((current) => ({ x: current.x + deltaX, y: current.y + deltaY }))
  }

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
    }
  }

  return (
    <div
      className={cn(
        'relative min-h-[420px] overflow-hidden rounded-lg border border-border/80 bg-slate-950/95 p-3 shadow-inner md:p-5',
        zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <div className="flex min-h-[390px] items-center justify-center">
        <div
          className="relative w-full max-w-5xl select-none transition-transform duration-150 ease-out motion-reduce:transition-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={slide.imageUrl}
            alt={slide.imageAlt}
            className="block h-auto w-full rounded-md object-contain"
            draggable={false}
          />
          {showAnnotations ? (
            <div className="absolute inset-0" aria-label="Cytology cell annotations">
              {slide.annotations.map((annotation, index) => {
                const isActive = activeAnnotation?.id === annotation.id
                const labelVisible = mode === 'learn' && isActive

                return (
                  <button
                    key={annotation.id}
                    type="button"
                    data-cytology-hotspot="true"
                    aria-label={`Inspect ${annotation.label}: ${annotation.cellType}`}
                    aria-pressed={isActive}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectAnnotation(annotation)
                    }}
                    onFocus={() => onSelectAnnotation(annotation)}
                    onMouseEnter={() => {
                      if (mode === 'learn') {
                        onSelectAnnotation(annotation)
                      }
                    }}
                    className={cn(
                      'absolute rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                      isActive
                        ? 'border-cyan-200 bg-cyan-300/20 shadow-[0_0_0_4px_rgba(34,211,238,0.20)]'
                        : 'border-amber-200 bg-amber-300/15 hover:border-cyan-200 hover:bg-cyan-300/20',
                      mode === 'quiz' && 'border-white/70 bg-white/10',
                    )}
                    style={{
                      ...getAnnotationOverlayStyle(annotation),
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-[11px] font-semibold text-white shadow">
                      {mode === 'quiz' ? (
                        <Crosshair className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        index + 1
                      )}
                    </span>
                    {labelVisible ? (
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 min-w-40 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-xs font-medium leading-5 text-white shadow-xl">
                        {annotation.label}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InterpretationPanel({
  activeSlide,
  annotation,
  answeredSlideCount,
  mode,
  onAnswer,
  selectedChoiceId,
}: {
  activeSlide: CytologySlide
  annotation?: CytologyAnnotation
  answeredSlideCount: number
  mode: CytologyMode
  onAnswer: (choiceId: string) => void
  selectedChoiceId?: string
}) {
  const isAnswered = Boolean(selectedChoiceId)
  const isCorrect = annotation ? isQuizAnswerCorrect(annotation, selectedChoiceId) : false

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{mode === 'quiz' ? 'Quiz prompt' : 'Interpretation'}</CardTitle>
            {mode === 'quiz' ? (
              <Badge variant="outline">
                {answeredSlideCount}/{activeSlide.annotations.length}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="gap-5">
          {annotation ? (
            <>
              <div className="space-y-2">
                <Badge variant={annotation.category === 'background' ? 'outline' : 'info'}>
                  {annotation.cellType}
                </Badge>
                <h3 className="text-xl font-semibold leading-7">{annotation.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {annotation.featureTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {mode === 'quiz' ? (
                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/40 p-3">
                  <p className="text-sm font-semibold leading-6">{annotation.quiz.prompt}</p>
                  <div className="grid gap-2">
                    {annotation.quiz.choices.map((choice) => {
                      const isSelected = selectedChoiceId === choice.id
                      const isRightChoice = annotation.quiz.correctChoiceId === choice.id

                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => onAnswer(choice.id)}
                          className={cn(
                            'rounded-lg border px-3 py-2 text-left text-sm leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isSelected &&
                              isCorrect &&
                              'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
                            isSelected &&
                              !isCorrect &&
                              'border-red-500 bg-red-500/10 text-red-950 dark:text-red-100',
                            isAnswered && isRightChoice && 'border-emerald-500 bg-emerald-500/10',
                            !isSelected &&
                              !isRightChoice &&
                              'border-border bg-background hover:border-primary/50',
                          )}
                        >
                          {choice.label}
                        </button>
                      )
                    })}
                  </div>
                  {isAnswered ? (
                    <div
                      className={cn(
                        'flex items-start gap-2 rounded-lg p-3 text-sm leading-6',
                        isCorrect
                          ? 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                          : 'bg-red-500/10 text-red-950 dark:text-red-100',
                      )}
                    >
                      {isCorrect ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span>
                        {isCorrect ? 'Correct.' : 'Not quite.'} Review the explanation below.
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === 'learn' || isAnswered ? (
                <div className="space-y-4 text-sm leading-6">
                  <InfoBlock title="Morphologic read" body={annotation.explanation} />
                  <InfoBlock
                    title="Why it matters during ROSE"
                    body={annotation.diagnosticSignificance}
                  />
                  <InfoBlock title="Pitfall" body={annotation.pitfall} tone="amber" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
                  Choose an answer to reveal the teaching explanation.
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select an annotation to begin.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Source and license</CardTitle>
        </CardHeader>
        <CardContent className="gap-3 text-sm leading-6">
          <a
            href={activeSlide.source.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1 font-medium text-primary hover:underline"
          >
            {activeSlide.source.articleTitle}
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
            <p>
              <span className="font-semibold">License: </span>
              <a
                href={activeSlide.source.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {activeSlide.source.license}
              </a>
            </p>
            <p className="mt-2">
              <span className="font-semibold">Attribution: </span>
              {activeSlide.source.attribution}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoBlock({
  body,
  title,
  tone = 'default',
}: {
  body: string
  title: string
  tone?: 'default' | 'amber'
}) {
  return (
    <section
      className={cn(
        'rounded-lg border p-3',
        tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-border bg-background',
      )}
    >
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </section>
  )
}
