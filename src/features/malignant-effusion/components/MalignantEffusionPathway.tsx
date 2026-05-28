'use client'

import { useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { malignantEffusionAssets } from '../content/assets'
import {
  afterNondiagnosticTaps,
  diagnosticYieldLabel,
  postDrainageBranch,
  type LungExpansion,
  type ManagementArm,
} from '../engine/diagnostic'

const expansionOptions: { id: LungExpansion; label: string; description: string }[] = [
  {
    id: 'full',
    label: 'Full expansion',
    description: 'The lung expands and the pleural surfaces can appose.',
  },
  {
    id: 'partial',
    label: 'Partial expansion',
    description: 'Symptoms improve, but residual non-expansion remains.',
  },
  {
    id: 'trapped',
    label: 'Trapped or non-expandable',
    description: 'The lung does not expand enough for pleurodesis to work reliably.',
  },
]

const managementLabels: Record<ManagementArm, string> = {
  pleurodesisCandidate: 'Pleurodesis-capable pathway',
  ipcOrRapidPleurodesis: 'Indwelling catheter with selected rapid pleurodesis strategy',
  ipcPreferred: 'Indwelling pleural catheter-centered symptom control',
}

const managementOptions: { id: ManagementArm; label: string }[] = [
  { id: 'pleurodesisCandidate', label: managementLabels.pleurodesisCandidate },
  { id: 'ipcOrRapidPleurodesis', label: managementLabels.ipcOrRapidPleurodesis },
  { id: 'ipcPreferred', label: managementLabels.ipcPreferred },
]

export function MalignantEffusionPathway() {
  const [tapCount, setTapCount] = useState(1)
  const [lungExpansion, setLungExpansion] = useState<LungExpansion>('partial')
  const [armGuess, setArmGuess] = useState<ManagementArm | null>(null)
  const [revealed, setRevealed] = useState(false)

  const tapRecommendation = afterNondiagnosticTaps(tapCount)
  const branch = postDrainageBranch(lungExpansion)
  const guessedCorrectly = armGuess === branch.arm

  function chooseExpansion(next: LungExpansion) {
    setLungExpansion(next)
    setArmGuess(null)
    setRevealed(false)
  }

  return (
    <LessonScaffold
      title="Malignant pleural effusion diagnostic and management pathway"
      objectives={[
        'Explain why negative cytology does not rule out malignant pleural effusion.',
        'Choose a management pathway based on lung expansion after drainage.',
        'Match pleurodesis, indwelling pleural catheter, or combined strategies to patient goals.',
      ]}
      howToUse={[
        'Set the number of nondiagnostic cytology samples and review the escalation warning.',
        'Choose the post-drainage lung expansion pattern.',
        'Predict the management arm before revealing the pathway recommendation.',
      ]}
      clinicalAnchor={
        <p>
          A patient has recurrent symptomatic unilateral pleural effusion and imaging features that
          keep malignancy on the differential despite fluid testing. The next step depends on tissue
          strategy, lung expansion, symptoms, and goals.
        </p>
      }
      reveal={
        <div className="space-y-4">
          <div
            className={
              guessedCorrectly
                ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
                : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100'
            }
          >
            <h3 className="font-semibold">
              {guessedCorrectly
                ? 'Management prediction matches'
                : 'Compare your management prediction'}
            </h3>
            <p className="mt-2 text-base font-semibold">{managementLabels[branch.arm]}</p>
            <p className="mt-2">{branch.recommendation}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RevealCard
              title="Cytology sensitivity"
              body={diagnosticYieldLabel('thoracentesis')}
              note="After one to two nondiagnostic taps, avoid cycling fluid-only tests when suspicion remains high."
            />
            <RevealCard
              title="Tissue escalation"
              body={tapRecommendation.recommendation}
              note={tapRecommendation.teachingPoint}
            />
            <RevealCard
              title="Higher-yield option"
              body={diagnosticYieldLabel('pleuroscopy')}
              note="Procedure fitness, imaging target, local expertise, and patient goals still decide the path."
            />
          </div>
        </div>
      }
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      canReveal={armGuess !== null}
      revealLabel="Reveal malignant effusion pathway"
      keyTakeaway={
        <p>
          In malignant pleural effusion, a nondiagnostic tap is not the endpoint. Lung expansion and
          patient goals determine whether pleurodesis, an indwelling pleural catheter, or a combined
          strategy is most teachable.
        </p>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Diagnostic escalation</h3>
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
            </div>
          </article>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Post-drainage lung expansion</h3>
            <div className="mt-4 grid gap-2">
              {expansionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={lungExpansion === option.id}
                  onClick={() => chooseExpansion(option.id)}
                  className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </article>
        </div>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-foreground">Predict the management arm</h3>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {managementOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={armGuess === option.id}
                disabled={revealed}
                onClick={() => setArmGuess(option.id)}
                className="rounded-lg border border-border bg-background px-3 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
              >
                {option.label}
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-foreground">Modality comparator</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              [
                'Thoracentesis',
                'Fast symptom and diagnostic step; negative cytology is contextual.',
              ],
              ['Pleuroscopy', 'Tissue diagnosis and poudrage option; procedure fitness matters.'],
              [
                'Indwelling pleural catheter',
                'Outpatient symptom control; home drainage support and infection education matter.',
              ],
              [
                'Pleurodesis',
                'Device-free goal when lung expands and the patient can tolerate the procedure.',
              ],
              [
                'Combined strategy',
                'Selected pathway that pairs catheter-centered outpatient care with pleurodesis intent.',
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-border bg-background p-4">
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-foreground">Image references</h3>
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
          <h3 className="text-xl font-semibold text-foreground">Patient-goals reflection</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Every endpoint should ask what matters more for this patient: hospital-free days,
            device-free chest, speed of relief, home support, expected prognosis, infection burden,
            and willingness to manage a catheter.
          </p>
        </article>
      </div>
    </LessonScaffold>
  )
}

function RevealCard({ body, note, title }: { body: string; note: string; title: string }) {
  return (
    <article className="rounded-lg border border-border/80 bg-card p-5 text-sm leading-6 shadow-sm">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <p className="mt-2 text-muted-foreground">{note}</p>
    </article>
  )
}
