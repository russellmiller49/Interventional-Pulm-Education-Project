'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import type { EquipmentHotspot, EquipmentMap } from '../engine/types'

interface EquipmentLabelerProps {
  map: EquipmentMap
  /** Practice asks learners to place labels; demonstration presents every authored callout. */
  experience?: 'practice' | 'demonstration'
  labels?: Partial<EquipmentLabelerLabels>
}

interface EquipmentLabelerLabels {
  instruction: string
  bankHeading: string
  check: string
  reset: string
  score: (correct: number, total: number) => string
  allCorrect: string
  placePrompt: string
  demonstrationInstruction: string
}

const defaultLabels: EquipmentLabelerLabels = {
  instruction:
    'Select a label, then click the numbered marker it belongs to. Click a placed marker to return its label.',
  bankHeading: 'Labels',
  check: 'Check labels',
  reset: 'Reset',
  score: (correct, total) => `${correct} of ${total} labels placed correctly.`,
  allCorrect: 'All labels placed correctly.',
  placePrompt: 'Now click the marker this label belongs to.',
  demonstrationInstruction: 'Review each numbered component and its function.',
}

/** A label token corresponds one-to-one with a hotspot (token id === hotspot id). */
type Assignments = Record<string, string | undefined> // hotspotId -> labelId

function shuffle<T extends { id: string }>(items: readonly T[]): T[] {
  if (items.length < 2) {
    return [...items]
  }
  let state = items.reduce((hash, item) => {
    for (const char of item.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    return hash >>> 0
  }, 2166136261)
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  const unchanged = next.every((item, index) => item.id === items[index].id)
  if (unchanged) {
    next.push(next.shift() as T)
  }
  return next
}

/**
 * Click-hotspot equipment-labeling drill. Numbered markers sit over a neutral
 * diagram (whose alt text must not name the parts); the learner places each
 * label token onto its marker and checks the result. Correctly placed labels
 * reveal the part's teaching description. Keyboard-operable: label tokens and
 * markers are focusable buttons, so Tab + Enter drives the whole exercise.
 */
export function EquipmentLabeler({ map, experience = 'practice', labels }: EquipmentLabelerProps) {
  if (experience === 'demonstration') {
    return <EquipmentMapDemonstration map={map} labels={labels} />
  }

  return <EquipmentLabelerPractice map={map} labels={labels} />
}

function EquipmentMapDemonstration({ map, labels }: Pick<EquipmentLabelerProps, 'map' | 'labels'>) {
  const text = { ...defaultLabels, ...labels }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{map.title}</h3>
        <p className="text-xs text-muted-foreground">{text.demonstrationInstruction}</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={map.imageSrc}
          alt={map.imageAlt}
          className="w-full bg-background object-contain"
        />
        {map.hotspots.map((hotspot, index) => (
          <span
            key={hotspot.id}
            aria-hidden
            style={{ left: `${hotspot.xPct}%`, top: `${hotspot.yPct}%` }}
            className="-translate-x-1/2 -translate-y-1/2 absolute flex h-7 w-7 items-center justify-center rounded-full border-2 border-sky-500 bg-sky-500 text-xs font-bold text-white shadow-md"
          >
            {index + 1}
          </span>
        ))}
      </div>

      <ol className="grid gap-2 text-sm sm:grid-cols-2" aria-label={text.bankHeading}>
        {map.hotspots.map((hotspot, index) => (
          <li
            key={hotspot.id}
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500/10 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{hotspot.label}</p>
              <p className="text-xs leading-5 text-muted-foreground">{hotspot.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function EquipmentLabelerPractice({ map, labels }: Pick<EquipmentLabelerProps, 'map' | 'labels'>) {
  const text = { ...defaultLabels, ...labels }

  const [assignments, setAssignments] = useState<Assignments>({})
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [graded, setGraded] = useState(false)

  // Stable per-mount marker numbering follows authored order; the deterministic
  // shuffle keeps the token bank from mirroring it without causing SSR hydration drift.
  const shuffledTokens = useMemo(() => shuffle(map.hotspots), [map.hotspots])

  const placedLabelIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as string[]),
    [assignments],
  )
  const bank = shuffledTokens.filter((hotspot) => !placedLabelIds.has(hotspot.id))

  const hotspotById = useMemo(() => {
    const map_ = new Map<string, EquipmentHotspot>()
    for (const hotspot of map.hotspots) {
      map_.set(hotspot.id, hotspot)
    }
    return map_
  }, [map.hotspots])

  const correctCount = map.hotspots.reduce(
    (total, hotspot) => total + (assignments[hotspot.id] === hotspot.id ? 1 : 0),
    0,
  )
  const allCorrect = correctCount === map.hotspots.length

  function assignToMarker(hotspotId: string) {
    if (activeLabel) {
      setAssignments((current) => {
        // Remove the active label from any marker it already sits on, then place it.
        const cleared: Assignments = {}
        for (const [key, value] of Object.entries(current)) {
          cleared[key] = value === activeLabel ? undefined : value
        }
        cleared[hotspotId] = activeLabel
        return cleared
      })
      setActiveLabel(null)
      setGraded(false)
      return
    }
    // No active label: clicking a filled marker returns its label to the bank.
    if (assignments[hotspotId]) {
      setAssignments((current) => ({ ...current, [hotspotId]: undefined }))
      setGraded(false)
    }
  }

  function reset() {
    setAssignments({})
    setActiveLabel(null)
    setGraded(false)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{map.title}</h3>
        <p className="text-xs text-muted-foreground">{text.instruction}</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={map.imageSrc}
          alt={map.imageAlt}
          className="w-full bg-background object-contain"
        />
        {map.hotspots.map((hotspot, index) => {
          const assignedLabel = assignments[hotspot.id]
          const isCorrect = graded && assignedLabel === hotspot.id
          const isWrong = graded && assignedLabel !== undefined && assignedLabel !== hotspot.id
          return (
            <button
              key={hotspot.id}
              type="button"
              onClick={() => assignToMarker(hotspot.id)}
              style={{ left: `${hotspot.xPct}%`, top: `${hotspot.yPct}%` }}
              aria-label={`Marker ${index + 1}${assignedLabel ? `, labeled ${hotspotById.get(assignedLabel)?.label}` : ', empty'}`}
              className={cn(
                '-translate-x-1/2 -translate-y-1/2 absolute flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isCorrect
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : isWrong
                    ? 'border-destructive bg-destructive text-white'
                    : assignedLabel
                      ? 'border-sky-500 bg-sky-500 text-white'
                      : 'border-sky-500 bg-background text-sky-600 hover:bg-sky-500/10',
              )}
            >
              {index + 1}
            </button>
          )
        })}
      </div>

      {/* Placed-label legend so a placed marker's current label is visible/readable. */}
      {placedLabelIds.size > 0 ? (
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {map.hotspots.map((hotspot, index) => {
            const assignedLabel = assignments[hotspot.id]
            if (!assignedLabel) {
              return null
            }
            const isCorrect = graded && assignedLabel === hotspot.id
            const isWrong = graded && assignedLabel !== hotspot.id
            const labelText = hotspotById.get(assignedLabel)?.label
            return (
              <li
                key={hotspot.id}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2',
                  isCorrect
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : isWrong
                      ? 'border-destructive/50 bg-destructive/5'
                      : 'border-border/60 bg-background/60',
                )}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{labelText}</p>
                  {isCorrect ? (
                    <p className="text-xs leading-5 text-muted-foreground">{hotspot.description}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {text.bankHeading}
        </p>
        {activeLabel ? (
          <p className="text-xs text-sky-600" role="status">
            {text.placePrompt}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {bank.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            bank.map((token) => (
              <button
                key={token.id}
                type="button"
                onClick={() =>
                  setActiveLabel((current) => (current === token.id ? null : token.id))
                }
                aria-pressed={activeLabel === token.id}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeLabel === token.id
                    ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'border-border/70 bg-background/70 text-foreground hover:border-sky-500/60',
                )}
              >
                {token.label}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setGraded(true)}
          disabled={placedLabelIds.size === 0}
        >
          {text.check}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {text.reset}
        </Button>
        {graded ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium',
              allCorrect ? 'text-emerald-600' : 'text-muted-foreground',
            )}
          >
            {allCorrect ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" aria-hidden />
            )}
            {text.score(correctCount, map.hotspots.length)}
          </span>
        ) : null}
      </div>

      {graded && allCorrect ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
          <Badge
            variant="outline"
            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
          >
            {text.allCorrect}
          </Badge>
        </div>
      ) : null}
    </div>
  )
}
