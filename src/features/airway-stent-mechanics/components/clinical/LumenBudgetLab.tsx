'use client'

import { useId, useMemo, useState } from 'react'

import {
  lumenBudgetArchitecturePresets,
  lumenBudgetOuterDiameterControl,
  lumenBudgetTeachingCopy,
} from '../../content/lumenBudgetPresets'
import type {
  LumenBudgetArchitectureId,
  LumenBudgetArchitecturePreset,
} from '../../content/lumenBudgetPresets'
import { circleAreaMm2, deriveInnerDiameterMm, lumenAreaFraction } from '../../engine/lumenBudget'

const DRAWING_SCALE_PX_PER_MM = 8

interface LumenBudgetMetric {
  preset: LumenBudgetArchitecturePreset
  outerDiameterMm: number
  innerDiameterMm: number
  lumenAreaMm2: number
  innerToOuterRatio: number
  lumenAreaFraction: number
}

interface LumenBudgetLabProps {
  completed?: boolean
  initialOuterDiameterMm?: number
  onComplete?: () => void
}

const architecturePalette: Record<
  LumenBudgetArchitectureId,
  {
    accentClassName: string
    wallClassName: string
  }
> = {
  'generic-silicone-tube': {
    accentClassName: 'border-cyan-500/30 bg-cyan-500/5',
    wallClassName: 'fill-cyan-600 dark:fill-cyan-400',
  },
  'generic-thin-wall-scaffold': {
    accentClassName: 'border-violet-500/30 bg-violet-500/5',
    wallClassName: 'fill-violet-600 dark:fill-violet-400',
  },
}

function normalizeOuterDiameter(value: number) {
  const { defaultMm, maxMm, minMm, stepMm } = lumenBudgetOuterDiameterControl
  if (!Number.isFinite(value)) return defaultMm

  const clamped = Math.min(maxMm, Math.max(minMm, value))
  const snapped = minMm + Math.round((clamped - minMm) / stepMm) * stepMm
  return Number(snapped.toFixed(2))
}

function calculateMetric(
  preset: LumenBudgetArchitecturePreset,
  outerDiameterMm: number,
): LumenBudgetMetric {
  const innerDiameterMm = deriveInnerDiameterMm(outerDiameterMm, preset.wallThicknessMm)
  return {
    preset,
    outerDiameterMm,
    innerDiameterMm,
    lumenAreaMm2: circleAreaMm2(innerDiameterMm),
    innerToOuterRatio: innerDiameterMm / outerDiameterMm,
    lumenAreaFraction: lumenAreaFraction(innerDiameterMm, outerDiameterMm),
  }
}

function formatMm(value: number) {
  return `${value.toFixed(1)} mm`
}

function formatArea(value: number) {
  return `${value.toFixed(1)} mm²`
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function LumenCrossSection({ centerX, metric }: { centerX: number; metric: LumenBudgetMetric }) {
  const centerY = 91
  const outerRadius = (metric.outerDiameterMm / 2) * DRAWING_SCALE_PX_PER_MM
  const innerRadius = (metric.innerDiameterMm / 2) * DRAWING_SCALE_PX_PER_MM
  const palette = architecturePalette[metric.preset.id]

  return (
    <g aria-hidden="true">
      <circle
        cx={centerX}
        cy={centerY}
        r={outerRadius + 4}
        className="fill-none stroke-slate-300 dark:stroke-slate-600"
        strokeDasharray="3 4"
        strokeWidth="1"
      />
      <circle cx={centerX} cy={centerY} r={outerRadius} className={palette.wallClassName} />
      <circle
        cx={centerX}
        cy={centerY}
        r={innerRadius}
        className="fill-white stroke-slate-700 dark:fill-slate-950 dark:stroke-slate-200"
        strokeWidth="1.5"
      />
      <line
        x1={centerX - innerRadius}
        x2={centerX + innerRadius}
        y1={centerY}
        y2={centerY}
        className="stroke-slate-500 dark:stroke-slate-300"
        strokeDasharray="3 3"
        strokeWidth="1"
      />
      <text
        x={centerX}
        y="188"
        textAnchor="middle"
        className="fill-slate-950 text-[13px] font-bold dark:fill-white"
      >
        {metric.preset.shortLabel}
      </text>
      <text
        x={centerX}
        y="207"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] dark:fill-slate-300"
      >
        OD {formatMm(metric.outerDiameterMm)} · wall {formatMm(metric.preset.wallThicknessMm)}
      </text>
      <text
        x={centerX}
        y="224"
        textAnchor="middle"
        className="fill-slate-600 text-[11px] dark:fill-slate-300"
      >
        calculated ID {formatMm(metric.innerDiameterMm)}
      </text>
    </g>
  )
}

function MetricCard({ metric, titleId }: { metric: LumenBudgetMetric; titleId: string }) {
  const palette = architecturePalette[metric.preset.id]

  return (
    <article
      className={`rounded-2xl border p-4 sm:p-5 ${palette.accentClassName}`}
      aria-labelledby={titleId}
      data-testid={`lumen-budget-${metric.preset.id}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Same outer diameter
      </p>
      <h4 id={titleId} className="mt-2 text-lg font-bold">
        {metric.preset.label}
      </h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.preset.description}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-background/85 p-3">
          <dt className="text-xs text-muted-foreground">Outer diameter</dt>
          <dd className="mt-1 text-base font-bold tabular-nums">
            {formatMm(metric.outerDiameterMm)}
          </dd>
        </div>
        <div className="rounded-xl border bg-background/85 p-3">
          <dt className="text-xs text-muted-foreground">Wall thickness</dt>
          <dd className="mt-1 text-base font-bold tabular-nums">
            {formatMm(metric.preset.wallThicknessMm)}
          </dd>
        </div>
        <div className="rounded-xl border bg-background/85 p-3">
          <dt className="text-xs text-muted-foreground">Calculated inner diameter</dt>
          <dd className="mt-1 text-base font-bold tabular-nums">
            {formatMm(metric.innerDiameterMm)}
          </dd>
        </div>
        <div className="rounded-xl border bg-background/85 p-3">
          <dt className="text-xs text-muted-foreground">Calculated lumen area</dt>
          <dd className="mt-1 text-base font-bold tabular-nums">
            {formatArea(metric.lumenAreaMm2)}
          </dd>
        </div>
        <div className="rounded-xl border bg-background/85 p-3">
          <dt className="text-xs text-muted-foreground">Inner ÷ outer diameter</dt>
          <dd className="mt-1 text-base font-bold tabular-nums">
            {formatPercent(metric.innerToOuterRatio)}
          </dd>
        </div>
        <div className="rounded-xl border bg-background/85 p-3">
          <dt className="text-xs text-muted-foreground">Lumen-area fraction</dt>
          <dd className="mt-1 text-base font-bold tabular-nums">
            {formatPercent(metric.lumenAreaFraction)}
          </dd>
        </div>
      </dl>
    </article>
  )
}

export function LumenBudgetLab({
  completed = false,
  initialOuterDiameterMm = lumenBudgetOuterDiameterControl.defaultMm,
  onComplete,
}: LumenBudgetLabProps) {
  const initialDiameter = normalizeOuterDiameter(initialOuterDiameterMm)
  const [outerDiameterMm, setOuterDiameterMm] = useState(initialDiameter)
  const [outerDiameterDraft, setOuterDiameterDraft] = useState(String(initialDiameter))
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null)
  const [committedPredictionId, setCommittedPredictionId] = useState<string | null>(null)
  const [completionRecorded, setCompletionRecorded] = useState(completed)
  const id = useId()
  const titleId = `${id}-title`
  const controlDescriptionId = `${id}-control-description`
  const diagramTitleId = `${id}-diagram-title`
  const diagramDescriptionId = `${id}-diagram-description`
  const metrics = useMemo(
    () => lumenBudgetArchitecturePresets.map((preset) => calculateMetric(preset, outerDiameterMm)),
    [outerDiameterMm],
  )
  const siliconeMetric = metrics.find((metric) => metric.preset.id === 'generic-silicone-tube')!
  const scaffoldMetric = metrics.find(
    (metric) => metric.preset.id === 'generic-thin-wall-scaffold',
  )!

  function commitOuterDiameterDraft() {
    const nextDiameter = normalizeOuterDiameter(Number(outerDiameterDraft))
    setOuterDiameterMm(nextDiameter)
    setOuterDiameterDraft(String(nextDiameter))
  }

  function updateFromRange(value: number) {
    const nextDiameter = normalizeOuterDiameter(value)
    setOuterDiameterMm(nextDiameter)
    setOuterDiameterDraft(String(nextDiameter))
  }

  function recordCompletion() {
    if (completed || completionRecorded || !committedPredictionId) return
    setCompletionRecorded(true)
    onComplete?.()
  }

  const isComplete = completed || completionRecorded

  return (
    <section
      className="overflow-hidden rounded-3xl border bg-card shadow-sm"
      aria-labelledby={titleId}
      data-testid="lumen-budget-lab"
    >
      <div className="border-b bg-gradient-to-br from-cyan-500/10 via-background to-violet-500/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
          Architecture · functional lumen
        </p>
        <h3 id={titleId} className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Lumen Budget Lab
        </h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
          Hold outer diameter constant, then inspect how wall thickness changes inner diameter and
          open cross-sectional area. Both drawings use the same scale.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-center">
          <div>
            <label htmlFor={`${id}-number`} className="text-sm font-semibold">
              Shared outer diameter
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id={`${id}-number`}
                type="number"
                inputMode="decimal"
                min={lumenBudgetOuterDiameterControl.minMm}
                max={lumenBudgetOuterDiameterControl.maxMm}
                step={lumenBudgetOuterDiameterControl.stepMm}
                value={outerDiameterDraft}
                onChange={(event) => {
                  const draft = event.currentTarget.value
                  setOuterDiameterDraft(draft)
                  if (draft.trim() === '') return

                  const parsed = Number(draft)
                  if (
                    Number.isFinite(parsed) &&
                    parsed >= lumenBudgetOuterDiameterControl.minMm &&
                    parsed <= lumenBudgetOuterDiameterControl.maxMm
                  ) {
                    setOuterDiameterMm(parsed)
                  }
                }}
                onBlur={commitOuterDiameterDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitOuterDiameterDraft()
                    event.currentTarget.select()
                  }
                  if (event.key === 'Escape') {
                    setOuterDiameterDraft(String(outerDiameterMm))
                    event.currentTarget.blur()
                  }
                }}
                aria-describedby={controlDescriptionId}
                className="min-h-11 w-28 rounded-xl border bg-background px-3 text-base font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              />
              <span className="text-sm font-semibold text-muted-foreground">mm</span>
              <output
                htmlFor={`${id}-number ${id}-range`}
                aria-live="polite"
                className="ml-auto rounded-full border bg-background px-3 py-1 text-sm font-bold tabular-nums"
              >
                {formatMm(outerDiameterMm)} shared OD
              </output>
            </div>
            <p id={controlDescriptionId} className="mt-2 text-xs leading-5 text-muted-foreground">
              {lumenBudgetTeachingCopy.displayRangeBoundary}
            </p>
          </div>

          <div>
            <label htmlFor={`${id}-range`} className="text-sm font-semibold">
              Adjust the same outer diameter for both models
            </label>
            <input
              id={`${id}-range`}
              type="range"
              min={lumenBudgetOuterDiameterControl.minMm}
              max={lumenBudgetOuterDiameterControl.maxMm}
              step={lumenBudgetOuterDiameterControl.stepMm}
              value={outerDiameterMm}
              onChange={(event) => updateFromRange(event.currentTarget.valueAsNumber)}
              aria-describedby={controlDescriptionId}
              className="mt-3 block w-full accent-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground" aria-hidden>
              <span>{formatMm(lumenBudgetOuterDiameterControl.minMm)}</span>
              <span>{formatMm(lumenBudgetOuterDiameterControl.maxMm)}</span>
            </div>
          </div>
        </div>

        <fieldset className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold">Commit your geometry prediction</legend>
          <p className="text-sm leading-6 text-muted-foreground">
            At the same outer diameter, what should a thicker continuous wall do to the available
            inner lumen compared with a thinner scaffold wall?
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[
              {
                id: 'thicker-wall-smaller-lumen',
                label: 'Reduce inner diameter and lumen-area fraction',
              },
              {
                id: 'same-outer-means-same-lumen',
                label: 'Leave inner diameter and lumen area unchanged',
              },
            ].map((choice) => (
              <label
                key={choice.id}
                className={
                  selectedPredictionId === choice.id
                    ? 'flex cursor-pointer gap-3 rounded-xl border border-cyan-500/60 bg-background p-4 focus-within:ring-2 focus-within:ring-cyan-500'
                    : 'flex cursor-pointer gap-3 rounded-xl border bg-background p-4 hover:border-cyan-500/40 focus-within:ring-2 focus-within:ring-cyan-500'
                }
              >
                <input
                  type="radio"
                  name={`${id}-lumen-prediction`}
                  value={choice.id}
                  checked={selectedPredictionId === choice.id}
                  onChange={() => setSelectedPredictionId(choice.id)}
                  className="mt-1 accent-cyan-600"
                />
                <span className="text-sm leading-6">{choice.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!selectedPredictionId || selectedPredictionId === committedPredictionId}
            onClick={() => selectedPredictionId && setCommittedPredictionId(selectedPredictionId)}
            className="mt-4 min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {committedPredictionId ? 'Revise and reveal again' : 'Commit and reveal geometry'}
          </button>
          {committedPredictionId ? (
            <p className="mt-3 text-sm leading-6" role="status">
              {committedPredictionId === 'thicker-wall-smaller-lumen'
                ? 'Defensible prediction: wall thickness consumes part of the shared outer-diameter budget.'
                : 'Reconsider the geometry: the same outside envelope does not guarantee the same inside lumen when wall thickness differs.'}
            </p>
          ) : null}
        </fieldset>

        {committedPredictionId ? (
          <>
            <div className="mt-5 overflow-hidden rounded-2xl border bg-slate-50 dark:bg-slate-900/60">
              <svg
                viewBox="0 0 420 236"
                role="img"
                aria-labelledby={`${diagramTitleId} ${diagramDescriptionId}`}
                className="block h-auto w-full"
                focusable="false"
              >
                <title id={diagramTitleId}>Same-scale airway-stent lumen cross-sections</title>
                <desc id={diagramDescriptionId}>
                  At a shared outer diameter of {formatMm(outerDiameterMm)}, the illustrative
                  silicone tube has an inner diameter of {formatMm(siliconeMetric.innerDiameterMm)}{' '}
                  and the illustrative thin-wall scaffold has an inner diameter of{' '}
                  {formatMm(scaffoldMetric.innerDiameterMm)}.
                </desc>
                <rect
                  width="420"
                  height="236"
                  rx="18"
                  className="fill-slate-50 dark:fill-slate-900"
                />
                <path
                  d="M210 18V228"
                  className="stroke-slate-200 dark:stroke-slate-700"
                  strokeDasharray="4 6"
                />
                <LumenCrossSection centerX={105} metric={siliconeMetric} />
                <LumenCrossSection centerX={315} metric={scaffoldMetric} />
              </svg>
            </div>
            <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
              Proportional cross-sections at one shared drawing scale; the dashed outline marks the
              common outer envelope.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2" aria-live="polite">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.preset.id}
                  metric={metric}
                  titleId={`${id}-${metric.preset.id}-title`}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
              <div className="rounded-2xl border bg-background p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
                  Clinical interpretation
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  At matched outer diameter, the thicker silicone wall consumes more of the radial
                  budget. Its lower inner-to-outer diameter ratio produces a smaller calculated
                  lumen-area fraction because circular area changes with diameter squared.
                </p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  This geometric difference should not be translated directly into an airflow,
                  symptom, complication, or outcome prediction.
                </p>
              </div>

              <div
                className="rounded-2xl border border-slate-300 bg-slate-950 p-4 text-white sm:p-5"
                aria-label="Lumen geometry formulas"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Geometry used
                </p>
                <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                  <div className="flex flex-wrap justify-between gap-2 border-b border-slate-700 pb-2">
                    <dt>Inner diameter</dt>
                    <dd className="font-mono">ID = OD − 2 × wall</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-slate-700 pb-2">
                    <dt>Lumen area</dt>
                    <dd className="font-mono">π × (ID ÷ 2)²</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt>Lumen-area fraction</dt>
                    <dd className="font-mono">(ID ÷ OD)²</dd>
                  </div>
                </dl>
              </div>
            </div>

            <aside className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Evidence boundary:</strong>{' '}
              {lumenBudgetTeachingCopy.evidenceBoundary}
            </aside>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Educational boundary:</strong>{' '}
              {lumenBudgetTeachingCopy.educationalDisclaimer}
            </p>
            <button
              type="button"
              onClick={recordCompletion}
              disabled={isComplete}
              className="mt-5 min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isComplete ? 'Lumen-budget inspection recorded' : 'Record lumen-budget inspection'}
            </button>
          </>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
            The same-scale cross-sections and calculated lumen metrics remain hidden until you
            commit a prediction.
          </p>
        )}
      </div>
    </section>
  )
}
