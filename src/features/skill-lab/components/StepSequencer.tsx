'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, GripVertical, RotateCcw, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { scoreSequence } from '../engine/sequencing'
import type { SequenceScore, SequenceStep, StepSequence } from '../engine/types'

interface StepSequencerProps {
  sequence: StepSequence
  /** Optional labels so the drill localizes with its host module. */
  labels?: Partial<SequencerLabels>
}

interface SequencerLabels {
  instruction: string
  check: string
  reset: string
  moveUp: string
  moveDown: string
  scoreSummary: (score: SequenceScore) => string
  passed: string
  keepTrying: string
  rationaleHeading: string
  correctOrderHeading: string
}

const defaultLabels: SequencerLabels = {
  instruction: 'Put the steps in the correct order, then check your sequence.',
  check: 'Check order',
  reset: 'Reshuffle',
  moveUp: 'Move step earlier',
  moveDown: 'Move step later',
  scoreSummary: (score) => `${score.correctPositions} of ${score.total} steps in the right place.`,
  passed: 'Correct sequence',
  keepTrying: 'Not quite — review the highlighted steps and try again.',
  rationaleHeading: 'Why the order matters',
  correctOrderHeading: 'Correct sequence',
}

/** Seeded shuffle that is stable across server/client hydration. */
function shuffleSteps(steps: readonly SequenceStep[], round = 0): SequenceStep[] {
  if (steps.length < 2) {
    return [...steps]
  }
  let state = steps.reduce(
    (hash, step) => {
      for (const char of step.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
      return hash >>> 0
    },
    (2166136261 ^ Math.imul(round + 1, 2654435761)) >>> 0,
  )
  const next = [...steps]
  for (let i = next.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  const unchanged = next.every((step, index) => step.id === steps[index].id)
  if (unchanged) {
    // Rotate by one so the learner never starts on the authored answer.
    next.push(next.shift() as SequenceStep)
  }
  return next
}

/**
 * Drag-to-order (or keyboard-order) drill. Steps are presented shuffled; the
 * learner reorders them and checks against the authored correct order via the
 * pure `scoreSequence`. On a correct sequence the rationale and per-step detail
 * are revealed. Fully keyboard-operable through the up/down controls on each
 * row, so it does not depend on pointer drag.
 */
export function StepSequencer({ sequence, labels }: StepSequencerProps) {
  const text = { ...defaultLabels, ...labels }
  const [order, setOrder] = useState<SequenceStep[]>(() => shuffleSteps(sequence.steps))
  const [score, setScore] = useState<SequenceScore | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const shuffleRound = useRef(0)

  const correctOrder = useMemo(() => sequence.steps.map((step) => step.id), [sequence.steps])
  const passed = score?.passed ?? false

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) {
      return
    }
    setOrder((current) => {
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setScore(null)
  }

  function check() {
    setScore(
      scoreSequence(
        order.map((step) => step.id),
        correctOrder,
      ),
    )
  }

  function reset() {
    shuffleRound.current += 1
    setOrder(shuffleSteps(sequence.steps, shuffleRound.current))
    setScore(null)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{sequence.title}</h3>
        <p className="text-sm text-muted-foreground">{sequence.prompt}</p>
      </div>
      <p className="text-xs text-muted-foreground">{text.instruction}</p>

      <ol className="space-y-2">
        {order.map((step, index) => {
          const misplaced = score !== null && !passed && step.id !== correctOrder[index]
          const placed = score !== null && step.id === correctOrder[index]

          return (
            <li
              key={step.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (dragIndex !== null) {
                  move(dragIndex, index)
                }
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-background/70 p-3 transition',
                dragIndex === index && 'opacity-60',
                misplaced
                  ? 'border-destructive/60 bg-destructive/5'
                  : placed
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-border/60',
              )}
            >
              <span
                aria-hidden
                className="mt-1 cursor-grab text-muted-foreground/70"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                {passed && step.detail ? (
                  <p className="text-xs leading-5 text-muted-foreground">{step.detail}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`${text.moveUp}: ${step.label}`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`${text.moveDown}: ${step.label}`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={check}>
          {text.check}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={reset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {text.reset}
        </Button>
        {score !== null ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium',
              passed ? 'text-emerald-600' : 'text-destructive',
            )}
          >
            {passed ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4" aria-hidden />
            )}
            {text.scoreSummary(score)}
          </span>
        ) : null}
      </div>

      {score !== null ? (
        <p className="text-sm text-muted-foreground" role="status">
          {passed ? text.passed : text.keepTrying}
        </p>
      ) : null}

      {passed ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
            >
              {text.rationaleHeading}
            </Badge>
          </div>
          <p className="text-sm leading-6 text-foreground">{sequence.rationale}</p>
        </div>
      ) : null}
    </div>
  )
}
