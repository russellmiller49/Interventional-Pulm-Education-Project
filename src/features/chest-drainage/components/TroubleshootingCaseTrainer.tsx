'use client'

import { useMemo, useState } from 'react'

import {
  calculateScenarioScore,
  evaluateScenarioAction,
  type ScenarioEvaluation,
} from '../engine/scenarioEngine'
import { troubleshootingScenarios } from '../scenarios/chestDrainageCases'
import { HandoffContent } from '@/i18n/handoff'

export function TroubleshootingCaseTrainer() {
  const [scenarioId, setScenarioId] = useState(troubleshootingScenarios[0]?.id ?? '')
  const [evaluations, setEvaluations] = useState<Record<string, ScenarioEvaluation>>({})
  const scenario =
    troubleshootingScenarios.find((item) => item.id === scenarioId) ?? troubleshootingScenarios[0]
  const evaluation = evaluations[scenario.id]
  const score = useMemo(() => calculateScenarioScore(Object.values(evaluations)), [evaluations])

  return (
    <HandoffContent>
      {
        <section className="container grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Cases</h2>
            <div className="mt-4 grid gap-2">
              {troubleshootingScenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScenarioId(item.id)}
                  className={
                    item.id === scenario.id
                      ? 'rounded-md bg-sky-600 px-3 py-2 text-left text-sm font-semibold text-white'
                      : 'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  }
                >
                  {item.title}
                </button>
              ))}
            </div>
            <p className="mt-5 rounded-lg border border-border/80 bg-background p-3 text-sm text-muted-foreground">
              Running score: <span className="font-semibold text-foreground">{score}%</span>
            </p>
          </aside>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Troubleshooting round
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                  {scenario.title}
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoBlock title="Learner sees">{scenario.learnerSees}</InfoBlock>
              <InfoBlock title="Patient-first prompt">{scenario.patientFirstPrompt}</InfoBlock>
              <InfoBlock title="Reasoning target">{scenario.bestReasoning}</InfoBlock>
            </div>

            <div className="mt-6">
              <h3 className="text-base font-semibold text-foreground">Choose your action</h3>
              <div className="mt-3 grid gap-3">
                {scenario.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() =>
                      setEvaluations((current) => ({
                        ...current,
                        [scenario.id]: evaluateScenarioAction(scenario, action.id),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-4 py-3 text-left text-sm leading-6 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {evaluation ? (
              <div
                className={
                  evaluation.result === 'safe'
                    ? 'mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : evaluation.result === 'partial'
                      ? 'mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100'
                      : 'mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-950 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100'
                }
                aria-live="polite"
              >
                <p className="font-semibold">Feedback</p>
                <p className="mt-1">{evaluation.feedback}</p>
                <p className="mt-3 text-sm">{scenario.debrief}</p>
              </div>
            ) : null}
          </article>
        </section>
      }
    </HandoffContent>
  )
}

function InfoBlock({ title, children }: { title: string; children: string }) {
  return (
    <HandoffContent>
      {
        <div className="rounded-lg border border-border/80 bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
        </div>
      }
    </HandoffContent>
  )
}
