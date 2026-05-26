'use client'

import { useState } from 'react'

import {
  afterNondiagnosticTaps,
  diagnosticYieldLabel,
  postDrainageBranch,
  type LungExpansion,
} from '../engine/diagnostic'
import { malignantEffusionAssets } from '../content/assets'

export function MalignantEffusionPathway() {
  const [tapCount, setTapCount] = useState(1)
  const [lungExpansion, setLungExpansion] = useState<LungExpansion>('partial')
  const tapRecommendation = afterNondiagnosticTaps(tapCount)
  const branch = postDrainageBranch(lungExpansion)

  return (
    <section className="container space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Diagnostic escalation</h2>
          <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
            Nondiagnostic cytology samples: {tapCount}
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={tapCount}
              onChange={(event) => setTapCount(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-sky-600"
            />
          </label>
          <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-6">
            <p className="font-semibold text-foreground">{tapRecommendation.recommendation}</p>
            <p className="mt-2 text-muted-foreground">{tapRecommendation.teachingPoint}</p>
            <p className="mt-2 text-muted-foreground">{diagnosticYieldLabel('thoracentesis')}</p>
            <p className="mt-2 text-muted-foreground">{diagnosticYieldLabel('pleuroscopy')}</p>
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Post-drainage branch</h2>
          <fieldset className="mt-4 grid gap-2">
            <legend className="sr-only">Lung expansion after drainage</legend>
            {(
              [
                ['full', 'Full expansion'],
                ['partial', 'Partial expansion'],
                ['trapped', 'Trapped / non-expandable'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={lungExpansion === id}
                onClick={() => setLungExpansion(id)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-6">
            <p className="font-semibold text-foreground">{branch.arm}</p>
            <p className="mt-2 text-muted-foreground">{branch.recommendation}</p>
          </div>
        </article>
      </div>

      <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Modality comparator</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[
            ['Thoracentesis', 'Fast symptom and diagnostic step; negative cytology is contextual.'],
            ['Pleuroscopy', 'Tissue diagnosis and poudrage option; procedure fitness matters.'],
            ['IPC', 'Outpatient symptom control; device care and infection education matter.'],
            ['Pleurodesis', 'Device-free goal when lung expands and patient can tolerate it.'],
            ['Rapid strategy', 'Combined pathway for selected patients and programs.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Teaching assets</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {malignantEffusionAssets.map((asset) => (
            <figure key={asset.id} className="overflow-hidden rounded-lg border border-border">
              <img
                src={asset.path}
                alt={asset.alt}
                className="h-48 w-full bg-muted object-contain"
              />
              <figcaption className="border-t border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
                {asset.alt} Attribution: {asset.attribution}
              </figcaption>
            </figure>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Patient-goals reflection</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Every endpoint should ask what matters more for this patient: hospital-free days,
          device-free chest, speed of relief, home support, expected prognosis, infection burden,
          and willingness to manage a catheter.
        </p>
      </article>
    </section>
  )
}
