'use client'

import {
  Activity,
  ArrowDownUp,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleGauge,
  FlaskConical,
  Grid3X3,
  Microscope,
  RotateCcw,
  ShieldAlert,
  Waves,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HandoffContent } from '@/i18n/handoff'
import {
  airwayGeometryOptions,
  benchDesignChecklist,
  forceTaxonomy,
  ginaDumonBenchData,
  tissueMechanisms,
} from '@/features/airway-stent-mechanics/content/curriculum'
import {
  sourceDocumentLabel,
  stentMechanicsReferences,
} from '@/features/airway-stent-mechanics/content/references'
import {
  getStentArchitecturePreset,
  stentArchitecturePresets,
} from '@/features/airway-stent-mechanics/content/stentProfiles'
import {
  calculateMechanicsProfile,
  defaultMechanicsInputs,
} from '@/features/airway-stent-mechanics/engine/mechanics'
import type {
  MechanicsInputs,
  MechanicsProfile,
  QualitativeBand,
} from '@/features/airway-stent-mechanics/engine/types'
import { cn } from '@/lib/cn'

import { ForceCurveLab } from './ForceCurveLab'
import { MechanicsChallenge } from './MechanicsChallenge'
import { StentMechanicsDisclaimer } from './StentMechanicsDisclaimer'
import { StentMechanicsLabDynamic } from './StentMechanicsLabDynamic'
import { StentExampleGalleryDynamic } from './StentExampleGalleryDynamic'
import { TissueInteractionLab } from './TissueInteractionLab'

const bandStyles: Record<QualitativeBand, string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  moderate: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200',
}

function RelativeMeter({
  label,
  value,
  band,
  note,
}: {
  label: string
  value: number
  band: QualitativeBand
  note: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
        </div>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
            bandStyles[band],
          )}
        >
          {band}
        </span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
            band === 'low'
              ? 'bg-emerald-500'
              : band === 'moderate'
                ? 'bg-amber-500'
                : 'bg-rose-500',
          )}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
      <p className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
        {value.toFixed(1)} / 100 relative index
      </p>
    </div>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
  helper,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  disabled?: boolean
  helper?: string
}) {
  return (
    <label className={cn('block rounded-2xl border bg-background p-4', disabled && 'opacity-45')}>
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
        {label}
        <output className="rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-sky-600"
      />
      {helper ? (
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{helper}</span>
      ) : null}
    </label>
  )
}

function MechanicsReadout({ profile }: { profile: MechanicsProfile }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RelativeMeter
          label="Radial support"
          value={profile.radialSupportIndex}
          band={profile.radialSupportBand}
          note="Relative lumen-restoring support—not a Newton value."
        />
        <RelativeMeter
          label="Chronic contact"
          value={profile.chronicContactIndex}
          band={profile.contactBand}
          note="Combines support, distribution, asymmetry, and curvature."
        />
        <RelativeMeter
          label="Migration resistance"
          value={profile.migrationResistanceIndex}
          band={profile.migrationBand}
          note="Friction + normal load + surface and branch geometry."
        />
        <RelativeMeter
          label="Straightening tendency"
          value={profile.straighteningIndex}
          band={profile.straighteningBand}
          note="Relative axial recovery and end-loading tendency in the bend."
        />
        <RelativeMeter
          label="Fatigue demand"
          value={profile.fatigueDemandIndex}
          band={profile.fatigueBand}
          note="Architecture hot spots under modeled combined cyclic loading."
        />
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Geometry outputs</p>
          <dl className="mt-3 grid gap-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Oversizing</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {profile.oversizingPercent}%
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Bend-area retention</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {profile.areaRetentionPercent}% index
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Foreshortening</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {profile.foreshorteningPercent}% model
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Secretion burden</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {profile.secretionBurdenIndex} / 100
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
          System interpretation
        </p>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground">
          {profile.interpretation.map((item) => (
            <li key={item} className="flex gap-2.5">
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ArchitectureComparison() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stentArchitecturePresets.map((preset) => (
        <article
          key={preset.id}
          className="flex h-full flex-col rounded-3xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                {preset.material}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{preset.label}</h3>
            </div>
            {preset.isCovered ? (
              <Badge variant="outline">Covered</Badge>
            ) : (
              <Badge variant="secondary">Open</Badge>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{preset.description}</p>
          <div className="mt-4 grid gap-3 text-xs">
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                Mechanical advantages
              </p>
              <ul className="mt-1 grid gap-1.5 text-muted-foreground">
                {preset.strengths.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-300">Tradeoffs</p>
              <ul className="mt-1 grid gap-1.5 text-muted-foreground">
                {preset.tradeoffs.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ShieldAlert
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-auto pt-4 text-[11px] leading-4 text-muted-foreground">
            Sources {preset.sourceRefs.map((reference) => `[${reference}]`).join(' ')}
          </p>
        </article>
      ))}
    </div>
  )
}

function BenchEvidenceLab() {
  const [prediction, setPrediction] = useState<'dumon' | 'gina' | 'same' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const correct = prediction === 'gina'

  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
            Direct sourced bench values
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-foreground">
            Can anchoring beat brute force?
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Two 14-mm silicone designs were compared in the same study. The GINA used a thinner
            wall, directional triangular rings, posterior raised lines, and a flat dynamic portion;
            the Dumon comparator used a thicker wall and studs.
          </p>
          <p className="mt-5 text-sm font-semibold leading-6 text-foreground">
            Predict first: which design required more force to push through the migration jig?
          </p>
          <div className="mt-3 grid gap-2">
            {[
              ['dumon', 'Dumon'],
              ['gina', 'GINA'],
              ['same', 'Approximately the same'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={revealed}
                onClick={() => setPrediction(id as 'dumon' | 'gina' | 'same')}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                  prediction === id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-border bg-background hover:border-indigo-500/40',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {!revealed ? (
            <Button
              className="mt-4"
              type="button"
              disabled={!prediction}
              onClick={() => setRevealed(true)}
            >
              Commit and reveal data
            </Button>
          ) : (
            <div
              className={cn(
                'mt-4 rounded-2xl border p-4 text-sm leading-6',
                correct
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
              )}
              role="status"
            >
              <p className="font-semibold">
                {correct ? 'Correct.' : 'The directional geometry changes the answer.'}
              </p>
              <p className="mt-1">
                GINA had greater anti-migration force while requiring less flat-plate compression
                and bending force. Anchoring was increased without maximizing whole-body expansion
                force.
              </p>
            </div>
          )}
        </div>

        {revealed ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
              <caption className="pb-3 text-left text-sm font-semibold text-foreground">
                GINA–Dumon comparison [1]
              </caption>
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="rounded-tl-xl px-4 py-3">Metric</th>
                  <th className="px-4 py-3">Dumon</th>
                  <th className="px-4 py-3">GINA</th>
                  <th className="rounded-tr-xl px-4 py-3">Method context</th>
                </tr>
              </thead>
              <tbody>
                {ginaDumonBenchData.map((row) => (
                  <tr key={row.metric} className="odd:bg-muted/30">
                    <th className="border-b border-l px-4 py-3 font-semibold text-foreground">
                      {row.metric}
                    </th>
                    <td className="border-b px-4 py-3 text-muted-foreground">{row.dumon}</td>
                    <td className="border-b px-4 py-3 text-muted-foreground">{row.gina}</td>
                    <td className="border-b border-r px-4 py-3 text-xs leading-5 text-muted-foreground">
                      {row.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Do not generalize these values across sizes or studies. The specimens, fixtures,
              orientations, endpoints, and methods define the result.
            </p>
          </div>
        ) : (
          <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-foreground">Bench data are hidden</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Choose a design, commit the prediction, and then inspect the measured forces and
                method context.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SourcesPanel() {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <div className="rounded-3xl border border-sky-500/30 bg-sky-500/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
          Source synthesis
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{sourceDocumentLabel}</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The supplied reference contains 12 sections, four appendices, seven figures, 19 labeled
          data tables, and a 43-item bibliography. This module converts its central mechanics,
          equations, cautions, comparison data, and bench framework into interactive lessons.
        </p>
        <div className="mt-5 rounded-2xl border bg-background p-4 text-sm leading-6 text-foreground">
          <p className="font-semibold">Evidence boundary</p>
          <p className="mt-1 text-muted-foreground">
            Regulatory summaries describe devices and testing, not comparative efficacy.
            Manufacturer documents are not peer-reviewed comparisons. Veterinary, vascular, biliary,
            and preclinical findings are labeled as transferred concepts where used.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-foreground">Selected module references</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Reference numbers match the supplied source document. Expand any item for source type and
          qualification.
        </p>
        <div className="mt-4 divide-y rounded-2xl border">
          {stentMechanicsReferences.map((reference) => (
            <details key={reference.id} className="group px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  <span>
                    [{reference.id}] {reference.citation}
                  </span>
                  <ChevronRight
                    className="mt-0.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                    aria-hidden
                  />
                </span>
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{reference.sourceType}</Badge>
                {reference.note ? (
                  <span>{reference.note}</span>
                ) : (
                  <span>Used as described in the source synthesis.</span>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AirwayStentMechanicsModule() {
  const [inputs, setInputs] = useState<MechanicsInputs>(defaultMechanicsInputs)
  const profile = useMemo(() => calculateMechanicsProfile(inputs), [inputs])
  const preset = getStentArchitecturePreset(inputs.architectureId)

  function update<K extends keyof MechanicsInputs>(key: K, value: MechanicsInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  return (
    <HandoffContent>
      <div className="space-y-14 pb-20 pt-8 md:space-y-20 md:pt-12">
        <section className="container">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 px-6 py-10 text-white shadow-2xl md:px-10 md:py-14 lg:px-14">
            <div
              className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl"
              aria-hidden
            />
            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Clinician deep dive
                  </span>
                  <span className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                    3D + animated mechanics
                  </span>
                  <span className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                    ~90 minutes
                  </span>
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
                  Airway Stent
                  <span className="block text-cyan-300">Mechanics Lab</span>
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200 md:text-lg">
                  Move beyond “silicone versus metal.” Explore how radial support, axial force,
                  architecture, oversizing, contact area, curvature, anchoring, fatigue, and time
                  interact inside a living airway.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#system-lab"
                    className="inline-flex items-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 motion-reduce:transition-none"
                  >
                    Enter the 3D lab
                  </a>
                  <a
                    href="#force-curves"
                    className="inline-flex items-center rounded-full border border-white/30 bg-slate-950/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
                  >
                    Start with radial force
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  Core mechanical conclusion
                </p>
                <p className="mt-3 text-lg font-semibold leading-7 text-white">
                  The mechanically desirable stent is not the one with the highest radial force.
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  It supplies enough lumen-restoring support with low focal tissue load, low
                  straightening force, stable apposition, preserved lumen in bends, controlled
                  anchoring, removability when needed, and fatigue life matched to dwell time.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container">
          <StentMechanicsDisclaimer />
        </section>

        <nav className="container" aria-label="Airway stent mechanics lessons">
          <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm">
            {[
              ['#system-lab', '1 · Coupled system'],
              ['#force-curves', '2 · Radial curves'],
              ['#architecture', '3 · Architecture'],
              ['#specific-examples', '4 · Real models'],
              ['#tissue', '5 · Tissue interface'],
              ['#bench-evidence', '6 · Bench evidence'],
              ['#challenge', '7 · Challenge'],
              ['#sources', '8 · Sources'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="snap-start whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section id="system-lab" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
              Lesson 1 · Coupled mechanics
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Build the airway + lesion + stent system
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The deployed diameter is an equilibrium: the stent expansion curve meets the airway
              constraint curve. Change the architecture and boundary conditions, then read the
              tradeoffs as linked outputs—not as a device ranking.
            </p>
          </div>

          <div className="grid gap-5 rounded-3xl border bg-muted/25 p-5 lg:grid-cols-[0.72fr_1.28fr] md:p-7">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Configuration
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">Mechanical inputs</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInputs(defaultMechanicsInputs)}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Reset
                </Button>
              </div>

              <label className="block rounded-2xl border bg-background p-4">
                <span className="text-sm font-semibold text-foreground">Stent architecture</span>
                <select
                  value={inputs.architectureId}
                  onChange={(event) =>
                    update(
                      'architectureId',
                      event.target.value as MechanicsInputs['architectureId'],
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {stentArchitecturePresets.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {preset.description}
                </span>
              </label>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {airwayGeometryOptions.map((geometry) => (
                  <button
                    key={geometry.id}
                    type="button"
                    onClick={() => update('airwayGeometry', geometry.id)}
                    aria-pressed={inputs.airwayGeometry === geometry.id}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                      inputs.airwayGeometry === geometry.id
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-border bg-background hover:border-sky-500/40',
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">
                      {geometry.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {geometry.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SliderControl
                label="Airway diameter"
                value={inputs.airwayDiameterMm}
                min={8}
                max={18}
                step={0.5}
                unit=" mm"
                onChange={(value) => update('airwayDiameterMm', value)}
                helper="Reference diameter for the educational oversizing calculation."
              />
              <SliderControl
                label="Free stent diameter"
                value={inputs.freeStentDiameterMm}
                min={8}
                max={20}
                step={0.5}
                unit=" mm"
                onChange={(value) => update('freeStentDiameterMm', value)}
                helper="The unconstrained diameter, not the final deployed diameter."
              />
              <SliderControl
                label="Device length"
                value={inputs.stentLengthMm}
                min={30}
                max={90}
                step={5}
                unit=" mm"
                onChange={(value) => update('stentLengthMm', value)}
                helper="Longer devices distribute contact but span more curvature and mucosa."
              />
              <SliderControl
                label="Airway curvature"
                value={inputs.curvaturePercent}
                min={0}
                max={100}
                unit="%"
                onChange={(value) => update('curvaturePercent', value)}
                helper="Raises straightening, end loading, and combined fatigue demand."
              />
              <SliderControl
                label="Constraint asymmetry"
                value={inputs.asymmetryPercent}
                min={0}
                max={100}
                unit="%"
                onChange={(value) => update('asymmetryPercent', value)}
                helper="Models eccentric compression and focal rather than uniform contact."
              />
              <SliderControl
                label={preset.isWireBased ? 'Relative wire / strut scale' : 'Relative wall scale'}
                value={inputs.structureScale}
                min={0.75}
                max={1.25}
                step={0.05}
                onChange={(value) => update('structureScale', value)}
                helper={
                  preset.isWireBased
                    ? 'Local circular-wire bending sensitivity follows approximately d⁴; completed braid behavior remains more complex.'
                    : 'Continuous-wall stiffness is highly thickness-sensitive; this index is not a physical wall measurement.'
                }
              />
              <SliderControl
                label="Braid angle"
                value={inputs.braidAngleDeg}
                min={35}
                max={70}
                unit="°"
                onChange={(value) => update('braidAngleDeg', value)}
                disabled={!preset.isWireBased}
                helper="Couples diameter, length, radial response, flexibility, and foreshortening."
              />
              <label className="flex min-h-[108px] items-start gap-3 rounded-2xl border bg-background p-4">
                <input
                  type="checkbox"
                  checked={inputs.wetInterface}
                  onChange={(event) => update('wetInterface', event.target.checked)}
                  className="mt-1 h-4 w-4 accent-sky-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    Wet mucus-lined interface
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Reduces the friction term while leaving geometric anchoring intact.
                  </span>
                </span>
              </label>
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 sm:col-span-2 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  Equilibrium concept
                </p>
                <p className="mt-2 font-mono text-sm text-foreground">F_stent(D) = F_airway(D)</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Contact stress then depends on where that resultant load acts, over what area, and
                  for how long.
                </p>
              </div>
            </div>
          </div>

          <StentMechanicsLabDynamic inputs={inputs} profile={profile} />
          <MechanicsReadout profile={profile} />
        </section>

        <section id="force-curves" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-300">
              Lesson 2 · Radial mechanics
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Separate support, resistance, stiffness, and pressure
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              “Radial force” may refer to different paths, slopes, endpoints, and fixtures. The
              first skill is naming the metric before comparing a number.
            </p>
          </div>
          <ForceCurveLab inputs={inputs} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {forceTaxonomy.map((item) => (
              <article key={item.term} className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="text-base font-semibold text-foreground">{item.term}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.definition}</p>
                <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
                  {item.caution}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="architecture" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              Lesson 3 · Architecture dominates material
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Trace the load path, not the catalog label
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              A molded wall, continuous knit, sliding braid, captured-cell braid, laser-cut
              connector, cover, or Y-junction creates a different mechanical system—even when the
              base material is unchanged.
            </p>
          </div>
          <ArchitectureComparison />
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                icon: CircleGauge,
                title: 'Wire diameter is a strong lever',
                body: 'For a circular wire, I = πd⁴/64. Small diameter changes strongly affect local bending stiffness, but braid angle, crossings, sliding, and nitinol transformation prevent direct d⁴ prediction of the whole device.',
              },
              {
                icon: ArrowDownUp,
                title: 'Bending must preserve lumen',
                body: 'Pair apparent flexural rigidity with minimum diameter or area retention. A device can appear flexible simply because it ovalizes or kinks.',
              },
              {
                icon: Waves,
                title: 'Time changes every interface',
                body: 'Silicone relaxes and creeps; wires fret and fatigue; covers crease; tissue grows or remodels; degrading devices lose support on a trajectory rather than at one instant.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border bg-muted/30 p-6">
                <item.icon className="h-7 w-7 text-sky-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="specific-examples" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              Lesson 4 · Specific 3D specimens
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Put the supplied models through explicit teaching motions
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Inspect the actual supplied geometry, predict the controlling variable, and then run
              prescribed deployment, coverage, bending, cyclic-loading, or carinal-seating
              animations. The examples teach what to measure without pretending the meshes are
              calibrated device simulations.
            </p>
          </div>
          <StentExampleGalleryDynamic />
        </section>

        <section id="tissue" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
              Lesson 5 · Tissue interface
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Translate load into biology without oversimplifying it
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Granulation is not a radial-force meter. Pressure distribution, stiffness transitions,
              cyclic shear, motion, infection, foreign-body response, wall vulnerability, and time
              interact.
            </p>
          </div>
          <TissueInteractionLab />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tissueMechanisms.map((mechanism) => (
              <article
                key={mechanism.id}
                className="rounded-2xl border bg-card p-5 shadow-sm"
                style={{ borderTopColor: mechanism.color, borderTopWidth: 4 }}
              >
                <h3 className="text-base font-semibold text-foreground">{mechanism.label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mechanism.mechanism}
                </p>
                <p
                  className="mt-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: mechanism.color }}
                >
                  {mechanism.outcomes}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="bench-evidence" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
              Lesson 6 · Evidence and test literacy
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Read the method before ranking the number
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Bench values are inseparable from specimen size, fixture, path, temperature, rate,
              endpoint, orientation, normalization, and conditioning. Airway-specific clinical
              thresholds are not established.
            </p>
          </div>
          <BenchEvidenceLab />
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-3xl border bg-slate-950 p-6 text-white shadow-xl">
              <FlaskConical className="h-7 w-7 text-cyan-300" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold">Design a meaningful bench program</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                No single fixture reproduces uniform compression, eccentric stenosis, curvature,
                cough, wet friction, branch torsion, and tissue response. Use a tiered test suite
                and keep each claim inside the boundary of the method.
              </p>
              <div className="mt-5 space-y-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 font-mono text-xs leading-5 text-slate-300">
                <p>EI_app = F · L³ / (48 · δ)</p>
                <p>Area retention = 100 · A_bent / A_straight</p>
                <p>F_migration ~ μ∫p dA + interlock + branch + ingrowth</p>
                <p>Support retention R_F(t) = F(t) / F(0)</p>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">
                The migration expression is conceptual, not a validated patient predictor. The
                flexural equation is an apparent beam approximation.
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {benchDesignChecklist.map((item, index) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-2xl border bg-card p-4 text-sm leading-6 text-foreground shadow-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="challenge" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
              Lesson 7 · Apply the model
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Commit to the controlling variable
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              These cases ask for the next mechanical question—not a patient-specific device
              prescription. Choose before the explanation appears.
            </p>
          </div>
          <MechanicsChallenge />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Activity,
                title: 'Support budget',
                body: 'Define the minimum force needed to preserve lumen and the maximum chronic interface burden the wall may tolerate.',
              },
              {
                icon: Grid3X3,
                title: 'Anchoring source',
                body: 'Ask whether stability comes from pressure, friction, studs, flares, taper, branch fixation, or tissue incorporation—and what that means for removal.',
              },
              {
                icon: BrainCircuit,
                title: 'Time horizon',
                body: 'Match fatigue, remodeling, planned removal, cover integrity, ingrowth, and degradation trajectory to the intended dwell.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border bg-muted/30 p-6">
                <item.icon className="h-7 w-7 text-violet-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="sources" className="container scroll-mt-24 space-y-7">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
              Lesson 8 · Sources and limitations
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Know which claims travel—and which do not
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The module preserves the reference document’s central caution: cross-study numbers are
              not comparable without method equivalence, and no universal airway force or pressure
              threshold is established.
            </p>
          </div>
          <SourcesPanel />
        </section>

        <section className="container">
          <div className="rounded-[2rem] border border-slate-700 bg-slate-950 p-7 text-white shadow-xl md:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <Microscope className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Final synthesis
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold md:text-3xl">
                  Choose and evaluate the whole mechanical system.
                </h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">
                  Airway + lesion + stent + deployment + time. “Silicone” or “metal” is only the
                  starting label; architecture and boundary conditions determine the behavior that
                  tissue actually experiences.
                </p>
              </div>
              <a
                href="#system-lab"
                className="inline-flex items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                Run another configuration
              </a>
            </div>
          </div>
        </section>
      </div>
    </HandoffContent>
  )
}
