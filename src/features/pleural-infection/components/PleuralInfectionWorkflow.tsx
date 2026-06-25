'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { bleedingRisk, type LyticChoice } from '../engine/lytics'
import {
  classifyParapneumonic,
  type InfectionUltrasoundPattern,
  type ParapneumonicInput,
  type ParapneumonicStage,
} from '../engine/staging'
import { infectionCases } from '../scenarios/infectionCases'
import { HandoffContent } from '@/i18n/handoff'

const STAGE_IDS: ParapneumonicStage[] = ['uncomplicated', 'complicated', 'empyema']

const ULTRASOUND_PATTERN_IDS: InfectionUltrasoundPattern[] = [
  'freeFlowing',
  'complex',
  'septated',
  'large',
]

const ADJUNCT_IDS: LyticChoice[] = [
  'alteplase10Dnase5',
  'alteplaseOnly',
  'dnaseOnly',
  'salineIrrigation',
  'placebo',
]

function cloneInput(input: ParapneumonicInput): ParapneumonicInput {
  return { ...input }
}

function numberOrUndefined(value: string) {
  return value === '' ? undefined : Number(value)
}

export function PleuralInfectionWorkflow() {
  const t = useTranslations('pleuralInfection')

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
    return <HandoffContent>{null}</HandoffContent>
  }

  const classification = classifyParapneumonic(workingInput)
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
    <HandoffContent>
      {
        <LessonScaffold
          title={t('workflow.scaffoldTitle')}
          objectives={t.raw('workflow.objectives') as string[]}
          howToUse={t.raw('workflow.howToUse') as string[]}
          clinicalAnchor={<p>{t('workflow.clinicalAnchor')}</p>}
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
                  {guessedCorrectly ? t('workflow.matchHeading') : t('workflow.compareHeading')}
                </h3>
                <p className="mt-2 text-base font-semibold">{t(`stage.${classification.stage}`)}</p>
                <p className="mt-2">{t(`staging.action.${classification.stage}`)}</p>
                <ul className="mt-3 grid gap-2">
                  {classification.reasonCodes.map((code) => (
                    <li key={code} className="rounded-lg border border-current/30 p-3">
                      {t(`staging.reasons.${code}`)}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-medium">
                  {t('workflow.antibioticDurationLabel', {
                    duration: t(`antibioticDuration.${classification.stage}`),
                  })}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <RevealCard
                  title={t('workflow.cards.mist2.title')}
                  body={`${t(`lytic.${choice}.label`)}: ${t(`lytic.${choice}.effect`)}`}
                  note={t(`lytic.${choice}.caution`)}
                />
                <RevealCard
                  title={t('workflow.cards.irrigation.title')}
                  body={t('workflow.cards.irrigation.body')}
                  note={t('workflow.cards.irrigation.note')}
                />
                <RevealCard
                  title={t('workflow.cards.bleeding.title')}
                  body={t('workflow.cards.bleeding.body', {
                    percent: bleed.percent.toFixed(1),
                  })}
                  note={t(`bleedingNote.${bleed.noteCode}`)}
                />
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="text-base font-semibold text-foreground">
                  {t('workflow.escalation.heading')}
                </h3>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {(t.raw('workflow.escalation.steps') as string[]).map((step) => (
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
          revealLabel={t('workflow.revealLabel')}
          keyTakeaway={<p>{t('workflow.keyTakeaway')}</p>}
        >
          <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside className="h-fit space-y-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:sticky lg:top-20">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t('workflow.caseLabel')}
                <select
                  value={caseId}
                  onChange={(event) => selectCase(event.target.value)}
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                >
                  {infectionCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {t(`workflow.cases.${item.id}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t('workflow.adjunctLabel')}
                <select
                  value={choice}
                  onChange={(event) => {
                    setChoice(event.target.value as LyticChoice)
                    setRevealed(false)
                  }}
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                >
                  {ADJUNCT_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`workflow.adjunct.${id}`)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-border bg-background p-4 text-sm leading-6">
                <p className="font-semibold text-foreground">
                  {t('workflow.bleedingContextHeading')}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {clinicalCase.anticoagulated
                    ? t('workflow.bleedingContext.anticoagulated')
                    : t('workflow.bleedingContext.none')}
                </p>
              </div>
            </aside>

            <div className="space-y-6">
              <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="text-xl font-semibold text-foreground">
                  {t('workflow.fluidHeading')}
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <NumberField
                    label={t('workflow.phLabel')}
                    step={0.01}
                    value={workingInput.ph}
                    onChange={(value) => updateInput({ ...workingInput, ph: value })}
                  />
                  <NumberField
                    label={t('workflow.glucoseLabel')}
                    step={1}
                    value={workingInput.glucose}
                    onChange={(value) => updateInput({ ...workingInput, glucose: value })}
                  />
                  <NumberField
                    label={t('workflow.ldhLabel')}
                    step={50}
                    value={workingInput.ldh}
                    onChange={(value) => updateInput({ ...workingInput, ldh: value })}
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    {t('workflow.ultrasoundPatternLabel')}
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
                      {ULTRASOUND_PATTERN_IDS.map((id) => (
                        <option key={id} value={id}>
                          {t(`workflow.ultrasoundPattern.${id}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BooleanButton
                    label={t('workflow.gramStainLabel')}
                    positiveLabel={t('workflow.positive')}
                    negativeLabel={t('workflow.negative')}
                    active={workingInput.gramStain}
                    onChange={(value) => updateInput({ ...workingInput, gramStain: value })}
                  />
                  <BooleanButton
                    label={t('workflow.frankPusLabel')}
                    positiveLabel={t('workflow.positive')}
                    negativeLabel={t('workflow.negative')}
                    active={workingInput.frankPus}
                    onChange={(value) => updateInput({ ...workingInput, frankPus: value })}
                  />
                </div>
              </article>

              <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="text-xl font-semibold text-foreground">
                  {t('workflow.predictStageHeading')}
                </h3>
                <div className="mt-4 grid gap-2 lg:grid-cols-3">
                  {STAGE_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={stageGuess === id}
                      disabled={revealed}
                      onClick={() => setStageGuess(id)}
                      className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {t(`stage.${id}`)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t(`stageOption.${id}.description`)}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </LessonScaffold>
      }
    </HandoffContent>
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
    <HandoffContent>
      {
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
      }
    </HandoffContent>
  )
}

function BooleanButton({
  active,
  label,
  negativeLabel,
  onChange,
  positiveLabel,
}: {
  active: boolean
  label: string
  negativeLabel: string
  onChange: (value: boolean) => void
  positiveLabel: string
}) {
  return (
    <HandoffContent>
      {
        <button
          type="button"
          aria-pressed={active}
          onClick={() => onChange(!active)}
          className="rounded-lg border border-border bg-background p-3 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
        >
          <span className="block font-semibold text-foreground">{label}</span>
          <span className="mt-1 block text-muted-foreground">
            {active ? positiveLabel : negativeLabel}
          </span>
        </button>
      }
    </HandoffContent>
  )
}

function RevealCard({ body, note, title }: { body: string; note: string; title: string }) {
  return (
    <HandoffContent>
      {
        <article className="rounded-lg border border-border/80 bg-card p-5 text-sm leading-6 shadow-sm">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-muted-foreground">{body}</p>
          <p className="mt-2 text-muted-foreground">{note}</p>
        </article>
      }
    </HandoffContent>
  )
}
