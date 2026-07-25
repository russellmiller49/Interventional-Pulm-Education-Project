'use client'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'

import { pacAdvancementOrientationSteps, type PacAdvancementOrientationPosition } from '../content'

interface PacAdvancementOrientationProps {
  readonly currentPosition: PacAdvancementOrientationPosition
  readonly moving: boolean
  readonly prediction: ClinicalLearningItem
  readonly selectedChoiceId: string | null
  readonly onAdvance: (position: PacAdvancementOrientationPosition) => void
  readonly onChoiceChange: (choiceId: string) => void
  readonly onCommit: () => void
}

export function PacAdvancementOrientation({
  currentPosition,
  moving,
  prediction,
  selectedChoiceId,
  onAdvance,
  onChoiceChange,
  onCommit,
}: PacAdvancementOrientationProps) {
  const stepIndex = Math.max(
    0,
    pacAdvancementOrientationSteps.findIndex((step) => step.position === currentPosition),
  )
  const step = pacAdvancementOrientationSteps[stepIndex]
  const nextStep = pacAdvancementOrientationSteps[stepIndex + 1]

  return (
    <div className="grid gap-3" aria-label="Ordered PAC waveform orientation">
      <ol className="grid grid-cols-5 gap-1" aria-label="Introducer to wedge orientation sequence">
        {pacAdvancementOrientationSteps.map((candidate, index) => (
          <li
            key={candidate.position}
            aria-current={index === stepIndex ? 'step' : undefined}
            className={[
              'rounded-lg border px-1.5 py-2 text-center text-[0.65rem] font-bold tracking-wide',
              index === stepIndex
                ? 'border-primary bg-primary/15 text-primary'
                : index < stepIndex
                  ? 'border-primary/40 bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground',
            ].join(' ')}
          >
            {candidate.shortLabel}
          </li>
        ))}
      </ol>

      <section
        className="grid gap-3 rounded-xl border border-primary/35 bg-primary/5 p-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <header>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">
            Orientation {stepIndex + 1} of {pacAdvancementOrientationSteps.length}
          </p>
          <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
        </header>

        <dl className="grid gap-2 text-xs leading-5">
          <div>
            <dt className="font-bold uppercase tracking-wide text-primary">Waveform</dt>
            <dd>{step.waveformFocus}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-primary">Physiology</dt>
            <dd>{step.physiologyFocus}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-primary">Technique</dt>
            <dd>{step.techniqueFocus}</dd>
          </div>
        </dl>
      </section>

      {nextStep ? (
        <button
          type="button"
          disabled={moving}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => onAdvance(nextStep.position)}
        >
          {moving ? 'Advancing…' : `Next: ${nextStep.title}`}
        </button>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">{prediction.stem}</legend>
          {prediction.choices.map((choice) => (
            <label
              key={choice.id}
              className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                name="skill-prediction"
                checked={selectedChoiceId === choice.id}
                onChange={() => onChoiceChange(choice.id)}
              />
              {choice.label}
            </label>
          ))}
          <button
            type="button"
            disabled={selectedChoiceId === null}
            className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            onClick={onCommit}
          >
            Finish orientation and begin hands-on pass
          </button>
        </fieldset>
      )}

      <p className="rounded-lg bg-muted p-2 text-xs leading-5 text-muted-foreground">
        This is a guided preview. The hands-on pass restarts at the introducer and requires you to
        confirm each waveform yourself.
      </p>
    </div>
  )
}
