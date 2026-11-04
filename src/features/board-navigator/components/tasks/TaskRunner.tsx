'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Lightbulb } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import type { ChoiceOption, SequenceTask, SortTask, Task } from '../../content/types'
import {
  gradeResponse,
  responseComplete,
  type GradedResponse,
  type TaskResponse,
} from '../../engine/lab'
import { CONFIDENCE_LEVELS, type Confidence } from '../../engine/record'
import { StationSchematic, STATION_REGIONS } from './StationSchematic'

const CONFIDENCE_LABELS: Readonly<Record<Confidence, string>> = {
  guess: 'A guess',
  'fairly-sure': 'Fairly sure',
  sure: 'Sure',
}

export interface TaskCommit {
  readonly graded: GradedResponse
  readonly response: TaskResponse
  readonly usedHint: boolean
  readonly confidence: Confidence | null
}

/**
 * One task, start to finish: the stem, the interaction for its kind, a free hint, a confidence
 * rating, a commit, and the feedback that repairs the specific wrong model. Nothing that answers
 * the task is rendered before the commit; the rationales and the station labels appear after.
 */
export function TaskRunner({
  task,
  stageLabel,
  continueLabel,
  onCommit,
  onContinue,
}: {
  readonly task: Task
  readonly stageLabel: string
  readonly continueLabel: string
  readonly onCommit: (commit: TaskCommit) => void
  readonly onContinue: () => void
}) {
  const [response, setResponse] = useState<TaskResponse | null>(() => initialResponse(task))
  const [usedHint, setUsedHint] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [graded, setGraded] = useState<GradedResponse | null>(null)
  const committed = graded !== null
  const complete = responseComplete(task, response)

  function commit() {
    if (!response || !complete || committed) return
    const result = gradeResponse(task, response)
    setGraded(result)
    onCommit({ graded: result, response, usedHint, confidence })
  }

  return (
    <section
      aria-labelledby={`${task.id}-stem`}
      className="grid gap-5 rounded-3xl border bg-card p-6 sm:p-8"
      data-task={task.id}
      data-committed={committed || undefined}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-primary">{stageLabel}</p>
      {task.kind === 'predict' ? (
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p>
            <span className="font-semibold">Start from:</span> {task.baseline}
          </p>
          <p>
            <span className="font-semibold">Change one thing:</span> {task.change}
          </p>
        </div>
      ) : null}
      <h2 id={`${task.id}-stem`} className="text-lg font-semibold leading-7">
        {task.stem}
      </h2>

      {task.kind === 'choice' || task.kind === 'predict' ? (
        <ChoiceBody
          options={task.options}
          answerId={task.answerId}
          selectedId={
            response && (response.kind === 'choice' || response.kind === 'predict')
              ? response.optionId
              : null
          }
          committed={committed}
          onSelect={(optionId) => setResponse({ kind: task.kind, optionId })}
        />
      ) : null}
      {task.kind === 'sequence' && response?.kind === 'sequence' ? (
        <SequenceBody
          task={task}
          order={response.order}
          committed={committed}
          onChange={(order) => setResponse({ kind: 'sequence', order })}
        />
      ) : null}
      {task.kind === 'sort' && response?.kind === 'sort' ? (
        <SortBody
          task={task}
          placements={response.placements}
          committed={committed}
          onChange={(placements) => setResponse({ kind: 'sort', placements })}
        />
      ) : null}
      {task.kind === 'hotspot' ? (
        <HotspotBody
          answerId={task.answerRegionId}
          selectedId={response?.kind === 'hotspot' ? response.regionId : null}
          committed={committed}
          onSelect={(regionId) => setResponse({ kind: 'hotspot', regionId })}
        />
      ) : null}

      {!committed ? (
        <div className="grid gap-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHintOpen(true)
                setUsedHint(true)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 px-3 text-sm hover:bg-muted/40"
              aria-expanded={hintOpen}
            >
              <Lightbulb aria-hidden="true" className="size-4" /> Show a hint
            </button>
            <span className="text-xs text-muted-foreground">
              Hints are free. Using one is recorded so the map knows what you did on your own.
            </span>
          </div>
          {hintOpen ? (
            <p
              className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm"
              data-testid="task-hint"
            >
              {task.hint}
            </p>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">How sure are you?</legend>
            <div className="flex flex-wrap gap-2">
              {CONFIDENCE_LEVELS.map((level) => (
                <label
                  key={level}
                  className={cn(
                    'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm',
                    confidence === level
                      ? 'border-primary bg-primary/5'
                      : 'border-border/70 hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`${task.id}-confidence`}
                    checked={confidence === level}
                    onChange={() => setConfidence(level)}
                    className="accent-primary"
                  />
                  {CONFIDENCE_LABELS[level]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Button
              type="button"
              size="lg"
              onClick={commit}
              disabled={!complete}
              data-testid="task-commit"
            >
              Commit
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 border-t pt-4" data-testid="task-feedback">
          <p
            className={cn(
              'text-base font-semibold',
              graded.correct
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-800 dark:text-amber-300',
            )}
            role="status"
          >
            {graded.correct ? (usedHint ? 'Correct, with a hint.' : 'Correct.') : 'Not correct.'}
          </p>
          <TaskRationale task={task} response={response} graded={graded} />
          <p className="text-sm leading-6">
            <span className="font-semibold">Teaching point.</span> {task.teachingPoint}
          </p>
          <div>
            <Button type="button" size="lg" onClick={onContinue} data-testid="task-continue">
              {continueLabel}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function initialResponse(task: Task): TaskResponse | null {
  switch (task.kind) {
    case 'sequence':
      return { kind: 'sequence', order: task.steps.map((step) => step.id) }
    case 'sort':
      return { kind: 'sort', placements: {} }
    default:
      return null
  }
}

function ChoiceBody({
  options,
  answerId,
  selectedId,
  committed,
  onSelect,
}: {
  readonly options: readonly ChoiceOption[]
  readonly answerId: string
  readonly selectedId: string | null
  readonly committed: boolean
  readonly onSelect: (optionId: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Options" className="grid gap-2">
      {options.map((option) => {
        const selected = option.id === selectedId
        const isAnswer = committed && option.id === answerId
        const isWrongPick = committed && selected && option.id !== answerId
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={committed}
            onClick={() => onSelect(option.id)}
            data-option={option.id}
            className={cn(
              'grid gap-1 rounded-2xl border p-4 text-left text-sm transition',
              isAnswer
                ? 'border-emerald-500 bg-emerald-500/10'
                : isWrongPick
                  ? 'border-amber-500 bg-amber-500/10'
                  : selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border/70 hover:bg-muted/40',
              committed ? 'cursor-default' : '',
            )}
          >
            <span className="flex items-start gap-2 font-medium">
              {isAnswer ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : null}
              {option.label}
            </span>
            {committed ? <span className="text-muted-foreground">{option.rationale}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

function SequenceBody({
  task,
  order,
  committed,
  onChange,
}: {
  readonly task: SequenceTask
  readonly order: readonly string[]
  readonly committed: boolean
  readonly onChange: (order: readonly string[]) => void
}) {
  const labels = useMemo(
    () => new Map(task.steps.map((step) => [step.id, step.label])),
    [task.steps],
  )
  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }
  return (
    <ol className="grid gap-2" aria-label="Steps in your order">
      {order.map((id, index) => {
        const correctIndex = task.order.indexOf(id)
        const right = committed && correctIndex === index
        const wrong = committed && correctIndex !== index
        return (
          <li
            key={id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border p-3 text-sm',
              right
                ? 'border-emerald-500 bg-emerald-500/10'
                : wrong
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-border/70',
            )}
          >
            <span className="w-6 shrink-0 text-center font-bold text-primary">{index + 1}</span>
            <span className="flex-1">{labels.get(id)}</span>
            {committed ? (
              wrong ? (
                <span className="text-xs text-muted-foreground">
                  should be step {correctIndex + 1}
                </span>
              ) : null
            ) : (
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move "${labels.get(id)}" up`}
                  className="rounded-full border border-border/70 p-1.5 hover:bg-muted/40 disabled:opacity-40"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move "${labels.get(id)}" down`}
                  className="rounded-full border border-border/70 p-1.5 hover:bg-muted/40 disabled:opacity-40"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function SortBody({
  task,
  placements,
  committed,
  onChange,
}: {
  readonly task: SortTask
  readonly placements: Readonly<Record<string, string>>
  readonly committed: boolean
  readonly onChange: (placements: Readonly<Record<string, string>>) => void
}) {
  return (
    <ul className="grid gap-3" aria-label="Items to sort">
      {task.items.map((item) => {
        const chosen = placements[item.id]
        const right = committed && chosen === item.bucketId
        const wrong = committed && chosen !== item.bucketId
        return (
          <li
            key={item.id}
            className={cn(
              'grid gap-2 rounded-2xl border p-3 text-sm',
              right
                ? 'border-emerald-500 bg-emerald-500/10'
                : wrong
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-border/70',
            )}
          >
            <span className="font-medium" id={`${task.id}-${item.id}`}>
              {item.label}
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`${task.id}-${item.id}`}
              className="flex flex-wrap gap-2"
            >
              {task.buckets.map((bucket) => {
                const selected = chosen === bucket.id
                const isAnswer = committed && bucket.id === item.bucketId
                return (
                  <button
                    key={bucket.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={committed}
                    onClick={() => onChange({ ...placements, [item.id]: bucket.id })}
                    className={cn(
                      'min-h-9 rounded-full border px-3 text-xs font-medium transition',
                      isAnswer
                        ? 'border-emerald-500 bg-emerald-500/15'
                        : selected
                          ? committed
                            ? 'border-amber-500 bg-amber-500/15'
                            : 'border-primary bg-primary/10'
                          : 'border-border/70 hover:bg-muted/40',
                    )}
                  >
                    {bucket.label}
                  </button>
                )
              })}
            </div>
            {committed ? <span className="text-muted-foreground">{item.rationale}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

function HotspotBody({
  answerId,
  selectedId,
  committed,
  onSelect,
}: {
  readonly answerId: string
  readonly selectedId: string | null
  readonly committed: boolean
  readonly onSelect: (regionId: string) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <StationSchematic
        selectedId={selectedId}
        revealed={committed}
        answerId={answerId}
        onSelect={onSelect}
        disabled={committed}
      />
      <div role="radiogroup" aria-label="Regions" className="grid gap-1.5">
        <p className="text-xs text-muted-foreground">
          Click a region on the schematic, or choose it here. Region letters are neutral until you
          commit.
        </p>
        {STATION_REGIONS.map((region) => {
          const selected = region.id === selectedId
          const isAnswer = committed && region.id === answerId
          const isWrongPick = committed && selected && region.id !== answerId
          return (
            <button
              key={region.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={committed}
              onClick={() => onSelect(region.id)}
              data-region-option={region.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm',
                isAnswer
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isWrongPick
                    ? 'border-amber-500 bg-amber-500/10'
                    : selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border/70 hover:bg-muted/40',
              )}
            >
              <span className="w-8 shrink-0 font-bold">
                {committed ? region.id : region.letter}
              </span>
              <span className="text-muted-foreground">{region.position}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TaskRationale({
  task,
  response,
  graded,
}: {
  readonly task: Task
  readonly response: TaskResponse | null
  readonly graded: GradedResponse
}) {
  switch (task.kind) {
    case 'sequence':
      return <p className="text-sm leading-6 text-muted-foreground">{task.rationale}</p>
    case 'hotspot': {
      const picked =
        response?.kind === 'hotspot'
          ? STATION_REGIONS.find((region) => region.id === response.regionId)
          : null
      return (
        <p className="text-sm leading-6 text-muted-foreground">
          {!graded.correct && picked ? `You chose ${picked.id}. ` : ''}
          {task.rationale}
        </p>
      )
    }
    case 'sort':
      return graded.correct ? null : (
        <p className="text-sm leading-6 text-muted-foreground">
          {graded.misplaced.length} of {task.items.length} out of place. Each item shows where it
          belongs and why.
        </p>
      )
    default:
      return null
  }
}
