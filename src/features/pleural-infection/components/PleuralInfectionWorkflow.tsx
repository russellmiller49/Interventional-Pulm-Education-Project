'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { bleedingRisk, evaluateLyticChoice, type LyticChoice } from '../engine/lytics'
import {
  antibioticDuration,
  classifyParapneumonic,
  type InfectionUltrasoundPattern,
  type ParapneumonicInput,
  type ParapneumonicStage,
} from '../engine/staging'
import { infectionCases } from '../scenarios/infectionCases'

const stageOptions: { id: ParapneumonicStage; label: string; description: string }[] = [
  {
    id: 'uncomplicated',
    label: 'Uncomplicated parapneumonic effusion',
    description: 'Antibiotics and reassessment may be enough when low-risk features fit.',
  },
  {
    id: 'complicated',
    label: 'Complicated parapneumonic effusion',
    description: 'Drainage-level chemistry or imaging features are present.',
  },
  {
    id: 'empyema',
    label: 'Empyema',
    description: 'Pus or positive microbiology makes source control explicit.',
  },
]

const stageLabels: Record<ParapneumonicStage, string> = {
  uncomplicated: 'Uncomplicated parapneumonic effusion',
  complicated: 'Complicated parapneumonic effusion',
  empyema: 'Empyema',
}

const ultrasoundPatternLabels: Record<InfectionUltrasoundPattern, string> = {
  freeFlowing: 'Free-flowing',
  complex: 'Complex',
  septated: 'Septated',
  large: 'Large volume',
}

function cloneInput(input: ParapneumonicInput): ParapneumonicInput {
  return { ...input }
}

function numberOrUndefined(value: string) {
  return value === '' ? undefined : Number(value)
}

export function PleuralInfectionWorkflow() {
  const [caseId, setCaseId] = useState(infectionCases[0]?.id ?? '')
  const [choice, setChoice] = useState<LyticChoice>('alteplase10Dnase5')
  const [workingInput, setWorkingInput] = useState<ParapneumonicInput>(() =>
    cloneInput(
      infectionCases[0]?.input ?? {
        gramStain: false,
        frankPus: false,
        usPattern: 'freeFlowing',
      },
    ),
  )
  const [stageGuess, setStageGuess] = useState<ParapneumonicStage | null>(null)
  const [revealed, setRevealed] = useState(false)

  const clinicalCase = useMemo(
    () => infectionCases.find((item) => item.id === caseId) ?? infectionCases[0],
    [caseId],
  )

  if (!clinicalCase) {
    return null
  }

  const classification = classifyParapneumonic(workingInput)
  const lytic = evaluateLyticChoice(choice)
  const bleed = bleedingRisk(clinicalCase.anticoagulated)
  const guessedCorrectly = stageGuess === classification.stage

  function selectCase(id: string) {
    const nextCase = infectionCases.find((item) => item.id === id) ?? infectionCases[0]

    if (!nextCase) {
      return
    }

    setCaseId(id)
    setWorkingInput(cloneInput(nextCase.input))
    setStageGuess(null)
    setRevealed(false)
  }

  function updateInput(nextInput: ParapneumonicInput) {
    setWorkingInput(nextInput)
    setStageGuess(null)
    setRevealed(false)
  }

  return (
    <LessonScaffold
      title="Pleural infection staging and source control"
      objectives={[
        'Classify parapneumonic effusions using pH, glucose, LDH, microbiology, pus, and ultrasound pattern.',
        'Choose the drainage and antibiotic-duration teaching branch before seeing the answer.',
        'Explain where MIST2-style therapy, irrigation fallback, bleeding risk, and surgery fit.',
      ]}
      howToUse={[
        'Select a case, then adjust the fluid and ultrasound values if you want to test a variant.',
        'Predict the stage before revealing the action plan.',
        'Review drainage, antibiotics, adjunct therapy, bleeding risk, and escalation together.',
      ]}
      clinicalAnchor={
        <p>
          A patient with pneumonia has persistent systemic inflammation and a pleural effusion. The
          team needs to decide whether antibiotics alone are enough or whether source control is
          required.
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
              {guessedCorrectly ? 'Stage prediction matches' : 'Compare your stage prediction'}
            </h3>
            <p className="mt-2 text-base font-semibold">{stageLabels[classification.stage]}</p>
            <p className="mt-2">{classification.action}</p>
            <ul className="mt-3 grid gap-2">
              {classification.reasons.map((reason) => (
                <li key={reason} className="rounded-lg border border-current/30 p-3">
                  {reason}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-medium">
              Antibiotic duration: {antibioticDuration(classification.stage)}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RevealCard
              title="MIST2 trial branch"
              body={`${lytic.label}: ${lytic.effect}`}
              note={lytic.caution}
            />
            <RevealCard
              title="Pleural Irrigation Trial fallback"
              body="Normal saline irrigation can be discussed when lytic/enzyme therapy is unsuitable or bleeding risk cannot be mitigated."
              note="Treat irrigation as a selected fallback pathway, not a universal replacement for drainage, combination therapy, or surgery."
            />
            <RevealCard
              title="Bleeding overlay"
              body={`Estimated bleeding signal for this teaching case: ${bleed.percent.toFixed(1)}%.`}
              note={bleed.note}
            />
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold text-foreground">Escalation chain</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {[
                'Small-bore image-guided drain',
                'Flush and reimage',
                'Combination intrapleural therapy',
                'Irrigation fallback when suitable',
                'Surgical review',
              ].map((step) => (
                <div key={step} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-semibold text-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      canReveal={stageGuess !== null}
      revealLabel="Reveal source-control pathway"
      keyTakeaway={
        <p>
          Pleural infection decisions combine chemistry, microbiology, ultrasound complexity, and
          clinical progress. Drainage, antibiotics, intrapleural therapy, irrigation fallback, and
          surgery should be taught as one reassessment pathway.
        </p>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="h-fit space-y-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:sticky lg:top-20">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Infection case
            <select
              value={caseId}
              onChange={(event) => selectCase(event.target.value)}
              className="min-h-11 rounded-lg border border-input bg-background px-3"
            >
              {infectionCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Adjunct choice to test
            <select
              value={choice}
              onChange={(event) => {
                setChoice(event.target.value as LyticChoice)
                setRevealed(false)
              }}
              className="min-h-11 rounded-lg border border-input bg-background px-3"
            >
              <option value="alteplase10Dnase5">Tissue plasminogen activator plus DNase</option>
              <option value="alteplaseOnly">Tissue plasminogen activator only</option>
              <option value="dnaseOnly">DNase only</option>
              <option value="salineIrrigation">Normal saline irrigation</option>
              <option value="placebo">Drainage alone</option>
            </select>
          </label>

          <div className="rounded-lg border border-border bg-background p-4 text-sm leading-6">
            <p className="font-semibold text-foreground">Case bleeding context</p>
            <p className="mt-1 text-muted-foreground">
              {clinicalCase.anticoagulated
                ? 'Therapeutic anticoagulation cannot be safely paused.'
                : 'No therapeutic anticoagulation flag in this case.'}
            </p>
          </div>
        </aside>

        <div className="space-y-6">
          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Fluid and imaging values</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <NumberField
                label="Pleural pH"
                step={0.01}
                value={workingInput.ph}
                onChange={(value) => updateInput({ ...workingInput, ph: value })}
              />
              <NumberField
                label="Glucose (mg/dL)"
                step={1}
                value={workingInput.glucose}
                onChange={(value) => updateInput({ ...workingInput, glucose: value })}
              />
              <NumberField
                label="LDH (IU/L)"
                step={50}
                value={workingInput.ldh}
                onChange={(value) => updateInput({ ...workingInput, ldh: value })}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Ultrasound pattern
                <select
                  value={workingInput.usPattern}
                  onChange={(event) =>
                    updateInput({
                      ...workingInput,
                      usPattern: event.target.value as InfectionUltrasoundPattern,
                    })
                  }
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                >
                  {Object.entries(ultrasoundPatternLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <BooleanButton
                label="Gram stain"
                active={workingInput.gramStain}
                onChange={(value) => updateInput({ ...workingInput, gramStain: value })}
              />
              <BooleanButton
                label="Frank pus"
                active={workingInput.frankPus}
                onChange={(value) => updateInput({ ...workingInput, frankPus: value })}
              />
            </div>
          </article>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Predict the stage</h3>
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {stageOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={stageGuess === option.id}
                  disabled={revealed}
                  onClick={() => setStageGuess(option.id)}
                  className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
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
      </div>
    </LessonScaffold>
  )
}

function NumberField({
  label,
  onChange,
  step,
  value,
}: {
  label: string
  onChange: (value: number | undefined) => void
  step: number
  value?: number
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(numberOrUndefined(event.target.value))}
        className="min-h-11 rounded-lg border border-input bg-background px-3"
      />
    </label>
  )
}

function BooleanButton({
  active,
  label,
  onChange,
}: {
  active: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className="rounded-lg border border-border bg-background p-3 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
    >
      <span className="block font-semibold text-foreground">{label}</span>
      <span className="mt-1 block text-muted-foreground">{active ? 'Positive' : 'Negative'}</span>
    </button>
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
