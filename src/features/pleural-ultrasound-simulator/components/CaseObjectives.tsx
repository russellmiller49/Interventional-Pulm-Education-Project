'use client'

import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { PleuralSimulatorCase, ProbeScore, UltrasoundFrameMetrics } from '../types'

interface CaseObjectivesProps {
  caseData: PleuralSimulatorCase
  metrics: UltrasoundFrameMetrics | null
  score: ProbeScore | null
}

export function CaseObjectives({ caseData, metrics, score }: CaseObjectivesProps) {
  return (
    <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Window assessment</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use the live measurements as procedural reasoning prompts, not patient-care guidance.
          </p>
        </div>
        <Badge variant={score?.safeWindow ? 'success' : 'info'}>
          {score?.safeWindow ? 'Safe teaching window' : 'Scanning'}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Largest pocket"
          value={metrics ? `${(metrics.maxFluidPocketMm / 10).toFixed(1)} cm` : '--'}
          help="Longest continuous fluid run in the synthetic fan."
        />
        <MetricCard
          label="Needle fluid run"
          value={metrics ? `${(metrics.centralNeedle.fluidRunMm / 10).toFixed(1)} cm` : '--'}
          help="Fluid length along the projected center needle line."
        />
        <MetricCard
          label="Rib shadow"
          value={metrics ? `${Math.round(metrics.ribShadowBeamFraction * 100)}% beams` : '--'}
          help="Lower is better; center the interspace."
        />
        <MetricCard
          label="First fluid"
          value={
            metrics?.centralNeedle.firstFluidDepthMm !== null &&
            metrics?.centralNeedle.firstFluidDepthMm !== undefined
              ? `${(metrics.centralNeedle.firstFluidDepthMm / 10).toFixed(1)} cm`
              : '--'
          }
          help="Approximate depth at which the center line first sees fluid."
        />
      </div>

      <div className="mt-5 grid gap-2">
        <StatusRow active={score?.largestPocketFound ?? false} label="Largest fluid pocket found" />
        <StatusRow active={score?.avoidsRibShadow ?? false} label="Rib shadow minimized" />
        <StatusRow active={score?.avoidsDiaphragm ?? false} label="Diaphragm avoided" />
        <StatusRow active={score?.avoidsSolidOrgan ?? false} label="Liver and spleen avoided" />
        <StatusRow active={score?.needleTrajectorySafe ?? false} label="Needle line remains safe" />
      </div>

      {score ? (
        <div className="mt-5 rounded-lg border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          {score.summary}
        </div>
      ) : null}

      <div className="mt-5 border-t border-border/80 pt-5">
        <h4 className="text-sm font-semibold text-foreground">Case objectives</h4>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
          {caseData.objectives.map((objective) => (
            <li key={objective} className="flex gap-2">
              <CircleDashed className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function MetricCard({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{help}</p>
    </div>
  )
}

function StatusRow({ active, label }: { active: boolean; label: string }) {
  const Icon = active ? CheckCircle2 : CircleAlert
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <Icon
        className={active ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-amber-600'}
        aria-hidden
      />
      <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}
