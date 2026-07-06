'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock, RotateCcw, ShieldCheck } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { advanceScenario, initScenario, timeoutScenario } from '../engine/scenario'
import type {
  DecisionScenario as DecisionScenarioType,
  ScenarioNode,
  Vitals,
} from '../engine/types'

interface DecisionScenarioProps {
  scenario: DecisionScenarioType
  labels?: Partial<DecisionScenarioLabels>
}

interface DecisionScenarioLabels {
  briefingHeading: string
  situationHeading: string
  vitalsHeading: string
  timeRemaining: (seconds: number) => string
  timedOut: string
  restart: string
  debriefHeading: string
  decisionLogHeading: string
  safeTag: string
  unsafeTag: string
  outcomeLabel: Record<'rescued' | 'harm' | 'mixed', string>
}

const defaultLabels: DecisionScenarioLabels = {
  briefingHeading: 'Briefing',
  situationHeading: 'Current situation',
  vitalsHeading: 'Monitored vitals (simulated)',
  timeRemaining: (seconds) => `Decision window: ${seconds}s`,
  timedOut: 'Time elapsed — the default action was taken.',
  restart: 'Restart scenario',
  debriefHeading: 'Debrief',
  decisionLogHeading: 'Your decisions',
  safeTag: 'Appropriate',
  unsafeTag: 'Unsafe / delayed',
  outcomeLabel: {
    rescued: 'Rescued',
    harm: 'Preventable harm',
    mixed: 'Mixed outcome',
  },
}

interface TrendPoint {
  point: string
  spo2: number
  hr: number
  sbp: number
}

const outcomeStyles: Record<'rescued' | 'harm' | 'mixed', string> = {
  rescued: 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  harm: 'border-destructive/50 bg-destructive/5 text-destructive',
  mixed: 'border-amber-400/60 bg-amber-400/5 text-amber-700 dark:text-amber-300',
}

/**
 * Branching clinical recognition-and-management drill — the procedural-
 * complication trainer. Each node presents a situation and choices; unsafe or
 * delayed choices move the simulated vitals trend, and an optional per-node
 * countdown applies the least-bad default on expiry. The run ends on a terminal
 * node with a debrief report card that replays every decision.
 *
 * All logic is delegated to the pure engine (`initScenario`, `advanceScenario`,
 * `timeoutScenario`); this component only renders and drives the timer.
 */
export function DecisionScenario({ scenario, labels }: DecisionScenarioProps) {
  const text = {
    ...defaultLabels,
    ...labels,
    outcomeLabel: { ...defaultLabels.outcomeLabel, ...labels?.outcomeLabel },
  }

  const [state, setState] = useState(() => initScenario(scenario))
  const [trend, setTrend] = useState<TrendPoint[]>(() => [
    { point: 'Start', ...scenario.initialVitals },
  ])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [timedOutAt, setTimedOutAt] = useState<string | null>(null)

  const currentNode = useMemo<ScenarioNode | undefined>(
    () => scenario.nodes.find((node) => node.id === state.nodeId),
    [scenario.nodes, state.nodeId],
  )

  function commit(next: ReturnType<typeof advanceScenario>) {
    if (next === state) {
      return
    }
    setState(next)
    setTrend((prev) => [...prev, { point: `#${prev.length}`, ...next.vitals }])
  }

  function handleChoice(choiceId: string) {
    setTimedOutAt(null)
    commit(advanceScenario(scenario, state, choiceId))
  }

  function handleTimeout() {
    setTimedOutAt(state.nodeId)
    commit(timeoutScenario(scenario, state))
  }

  function restart() {
    setState(initScenario(scenario))
    setTrend([{ point: 'Start', ...scenario.initialVitals }])
    setTimedOutAt(null)
  }

  // Reset the countdown whenever we land on a new (non-terminal) timed node.
  useEffect(() => {
    if (!state.finished && currentNode?.decisionSeconds) {
      setRemaining(currentNode.decisionSeconds)
    } else {
      setRemaining(null)
    }
  }, [state.nodeId, state.finished, currentNode?.decisionSeconds])

  // Tick once per second; on expiry apply the timeout branch.
  useEffect(() => {
    if (remaining === null) {
      return
    }
    if (remaining <= 0) {
      handleTimeout()
      return
    }
    const timer = setTimeout(() => {
      setRemaining((value) => (value === null ? null : value - 1))
    }, 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  const terminal = state.finished ? currentNode?.terminal : undefined

  return (
    <div className="space-y-5 rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{scenario.title}</h3>
        <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {text.briefingHeading}
            </p>
            <p className="text-sm leading-6 text-foreground">{scenario.briefing}</p>
          </div>
        </div>
      </div>

      <VitalsTrend heading={text.vitalsHeading} trend={trend} current={state.vitals} />

      {!state.finished && currentNode ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {text.situationHeading}
            </p>
            {remaining !== null ? (
              <Badge
                variant={remaining <= 3 ? 'destructive' : 'outline'}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              >
                <Clock className="h-3 w-3" aria-hidden />
                {text.timeRemaining(Math.max(0, remaining))}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-foreground">{currentNode.situation}</p>

          <div className="grid gap-2">
            {currentNode.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => handleChoice(choice.id)}
                className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-left text-sm text-foreground transition hover:border-sky-500/60 hover:bg-sky-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {choice.label}
              </button>
            ))}
          </div>

          {timedOutAt === state.nodeId ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-600" role="status">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {text.timedOut}
            </p>
          ) : null}
        </div>
      ) : null}

      {terminal ? (
        <Debrief scenario={scenario} history={state.history} terminal={terminal} text={text} />
      ) : null}

      <div>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={restart}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {text.restart}
        </Button>
      </div>
    </div>
  )
}

function VitalsTrend({
  heading,
  trend,
  current,
}: {
  heading: string
  trend: TrendPoint[]
  current: Vitals
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </p>
        <div className="flex gap-3 text-xs tabular-nums text-muted-foreground">
          <span>
            SpO₂ <strong className="text-foreground">{current.spo2}%</strong>
          </span>
          <span>
            HR <strong className="text-foreground">{current.hr}</strong>
          </span>
          <span>
            SBP <strong className="text-foreground">{current.sbp}</strong>
          </span>
        </div>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="point"
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
            />
            <YAxis
              domain={[40, 160]}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <ReferenceLine y={90} strokeDasharray="4 4" className="stroke-amber-500/60" />
            <Line
              type="monotone"
              dataKey="spo2"
              name="SpO₂ %"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="hr"
              name="HR"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="sbp"
              name="SBP"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Debrief({
  scenario,
  history,
  terminal,
  text,
}: {
  scenario: DecisionScenarioType
  history: string[]
  terminal: NonNullable<ScenarioNode['terminal']>
  text: DecisionScenarioLabels
}) {
  // Resolve each chosen choice id to its authored choice (across all nodes) so
  // the report card can replay label + feedback + safe/unsafe for every step.
  const allChoices = useMemo(() => scenario.nodes.flatMap((node) => node.choices), [scenario.nodes])

  return (
    <div className="space-y-4">
      <div className={cn('space-y-2 rounded-xl border p-4', outcomeStyles[terminal.outcome])}>
        <div className="flex items-center gap-2">
          {terminal.outcome === 'rescued' ? (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden />
          )}
          <span className="text-sm font-semibold">
            {text.debriefHeading}: {text.outcomeLabel[terminal.outcome]}
          </span>
        </div>
        <p className="text-sm leading-6">{terminal.debrief}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {text.decisionLogHeading}
        </p>
        <ol className="space-y-2">
          {history.map((choiceId, index) => {
            const choice = allChoices.find((candidate) => candidate.id === choiceId)
            if (!choice) {
              return null
            }
            return (
              <li
                key={`${choiceId}-${index}`}
                className="rounded-xl border border-border/60 bg-background/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {choice.label}
                  </p>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      choice.isSafe
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-destructive/10 text-destructive',
                    )}
                  >
                    {choice.isSafe ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : (
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                    )}
                    {choice.isSafe ? text.safeTag : text.unsafeTag}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{choice.feedback}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
