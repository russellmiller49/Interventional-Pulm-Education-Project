'use client'

import { useCallback, useMemo, useState } from 'react'
import { Boxes, ChevronLeft, ChevronRight, Eye, Gauge, Lightbulb, RotateCcw } from 'lucide-react'

import { SURVEY_STEPS } from '@/data/airway-anatomy-lesson/airway-map'
import { getAncestry, getNode, lobeColor } from '@/lib/airway-anatomy-lesson/airway-graph'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { AirwayTreeDiagram } from './AirwayTreeDiagram'
import { CtCorrelationView } from './CtCorrelationView'
import { GuidedScopeStage } from './GuidedScopeStage'

interface AirwaySurveyProps {
  onOpenStructure?: (id: string) => void
  className?: string
}

const SPEEDS = [0.5, 0.25, 1] as const

export function AirwaySurvey({ onOpenStructure, className }: AirwaySurveyProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(0.5)
  const step = SURVEY_STEPS[stepIndex]
  const node = getNode(step.nodeId)

  const nodeIdToStep = useMemo(() => {
    const map: Record<string, number> = {}
    SURVEY_STEPS.forEach((surveyStep, index) => {
      map[surveyStep.nodeId] = index
    })
    return map
  }, [])

  const trailIds = useMemo(() => {
    const ids = new Set<string>()
    for (let i = 0; i <= stepIndex; i += 1) {
      getAncestry(SURVEY_STEPS[i].nodeId).forEach((ancestor) => ids.add(ancestor.id))
    }
    return ids
  }, [stepIndex])

  const goTo = useCallback((index: number) => {
    setStepIndex(((index % SURVEY_STEPS.length) + SURVEY_STEPS.length) % SURVEY_STEPS.length)
  }, [])

  const handleDiagramSelect = useCallback(
    (id: string) => {
      if (id in nodeIdToStep) setStepIndex(nodeIdToStep[id])
      else onOpenStructure?.(id)
    },
    [nodeIdToStep, onOpenStructure],
  )

  if (!node) return null
  const color = lobeColor(node.lobe)
  const orientation =
    node.endoscopicView?.orientation ??
    (node.kind === 'segmental'
      ? 'Terminal segment - withdraw and inspect the mucosa after identifying the orifice.'
      : "Keep anterior at 12 o'clock and the flat membranous wall at 6 o'clock to stay oriented.")

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / SURVEY_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2">
          <GuidedScopeStage focusNodeId={node.id} playbackRate={speed} />
          <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">Orientation: </span>
            {orientation}
          </p>
        </div>
        <CtCorrelationView focusNodeId={node.id} />
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/50 p-5">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">{step.title}</h3>
          {step.narration.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>

        {node.whatYouSee.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden /> What you see through the scope
            </p>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {node.whatYouSee.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.pearls.length > 0 && (
          <div className="flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <p className="text-sm leading-6 text-muted-foreground">{node.pearls[0]}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenStructure?.(node.id)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          <Boxes className="h-3.5 w-3.5" aria-hidden /> Open {node.shortLabel} in the explorer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => goTo(stepIndex - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button type="button" size="sm" onClick={() => goTo(stepIndex + 1)}>
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => goTo(0)}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Restart
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <div className="flex gap-0.5 rounded-lg border border-border/70 bg-card/60 p-0.5">
            {SPEEDS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setSpeed(candidate)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
                  speed === candidate
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {candidate}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Position in the tree - tap any stop to jump there
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
