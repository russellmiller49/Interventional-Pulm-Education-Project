'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'

import { SURVEY_STEPS } from '@/data/airway-anatomy-lesson/airway-map'
import { getAncestry, getNode, lobeColor } from '@/lib/airway-anatomy-lesson/airway-graph'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { AirwayTreeDiagram } from './AirwayTreeDiagram'
import { EndoscopicView } from './EndoscopicView'

const STEP_DURATION_MS = 7000

interface AirwaySurveyProps {
  onOpenStructure?: (id: string) => void
  className?: string
}

/**
 * Guided, auto-advancing walk-through of a normal airway survey. Each stop
 * shows the generated endoscopic view for that airway with the downstream
 * openings, synchronized narration, and the tree diagram lit along the path
 * travelled so far.
 */
export function AirwaySurvey({ onOpenStructure, className }: AirwaySurveyProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const step = SURVEY_STEPS[stepIndex]
  const node = getNode(step.nodeId)
  const atEnd = stepIndex >= SURVEY_STEPS.length - 1

  const nodeIdToStep = useMemo(() => {
    const map: Record<string, number> = {}
    SURVEY_STEPS.forEach((surveyStep, index) => {
      map[surveyStep.nodeId] = index
    })
    return map
  }, [])

  const trailIds = useMemo(() => {
    // Everything visited so far, plus the ancestry of the current node.
    const ids = new Set<string>()
    for (let i = 0; i <= stepIndex; i += 1) {
      getAncestry(SURVEY_STEPS[i].nodeId).forEach((n) => ids.add(n.id))
    }
    return ids
  }, [stepIndex])

  const goTo = useCallback((index: number) => {
    setStepIndex(((index % SURVEY_STEPS.length) + SURVEY_STEPS.length) % SURVEY_STEPS.length)
  }, [])

  // Auto-advance while playing; simply stop scheduling at the last step (the
  // Play button flips to "Replay" via `atEnd`, so no setState in the effect).
  useEffect(() => {
    if (!playing || stepIndex >= SURVEY_STEPS.length - 1) return
    const timer = setTimeout(() => setStepIndex((prev) => prev + 1), STEP_DURATION_MS)
    return () => clearTimeout(timer)
  }, [playing, stepIndex])

  const handleDiagramSelect = useCallback(
    (id: string) => {
      if (id in nodeIdToStep) {
        setPlaying(false)
        setStepIndex(nodeIdToStep[id])
      }
      onOpenStructure?.(id)
    },
    [nodeIdToStep, onOpenStructure],
  )

  if (!node) return null
  const color = lobeColor(node.lobe)

  return (
    <div className={cn('space-y-4', className)}>
      <style>{`
        @keyframes airway-advance {
          0% { opacity: 0; transform: scale(0.88); filter: brightness(0.7); }
          100% { opacity: 1; transform: scale(1); filter: brightness(1); }
        }
      `}</style>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Endoscopic view */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-slate-950 p-3 shadow-inner">
            <div
              key={stepIndex}
              style={{ animation: 'airway-advance 0.6s ease-out' }}
              className="mx-auto max-w-[320px]"
            >
              <EndoscopicView node={node} onSelectOpening={handleDiagramSelect} />
            </div>
            <span className="pointer-events-none absolute left-4 top-4 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
              Endoscopic view
            </span>
          </div>
          <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">Orientation: </span>
            {node.endoscopicView?.orientation ??
              'Terminal segment — advance no further; withdraw and inspect the mucosa.'}
          </p>
        </div>

        {/* Narration + progress */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {step.stage}
            </span>
            <span className="text-xs text-muted-foreground">
              Stop {stepIndex + 1} of {SURVEY_STEPS.length}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{step.title}</h3>
            <div className="space-y-2">
              {step.narration.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenStructure?.(node.id)}
            className="self-start text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open {node.shortLabel} in the explorer →
          </button>

          {/* Controls */}
          <div className="mt-auto space-y-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${((stepIndex + 1) / SURVEY_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (atEnd) {
                    setStepIndex(0)
                    setPlaying(true)
                  } else {
                    setPlaying((prev) => !prev)
                  }
                }}
              >
                {playing && !atEnd ? (
                  <>
                    <Pause className="h-4 w-4" aria-hidden /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden />
                    {atEnd ? 'Replay survey' : 'Play survey'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPlaying(false)
                  goTo(stepIndex - 1)
                }}
                aria-label="Previous stop"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPlaying(false)
                  goTo(stepIndex + 1)
                }}
                aria-label="Next stop"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPlaying(false)
                  setStepIndex(0)
                }}
                aria-label="Restart"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Restart
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized tree diagram */}
      <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Position in the tree — tap any stop to jump there
        </p>
        <AirwayTreeDiagram
          selectedId={node.id}
          trailIds={trailIds}
          onSelect={handleDiagramSelect}
        />
      </div>
    </div>
  )
}
