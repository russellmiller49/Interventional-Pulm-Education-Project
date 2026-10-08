'use client'

import { useId } from 'react'

import { SUPPLIED_RECORD_IDENTITY, type SurveyEvidenceKind } from '../../engine/inspectionReport'
import styles from './bronch-stage.module.css'

/**
 * Which record the report exercise is written from (fellow walkthrough A35).
 *
 * Three choices, each said for what it is: the learner's own recorded survey (offered only when
 * this device holds one from the current course record), a supplied teaching record that is not
 * theirs, or no survey evidence. The choice is held for this visit only. Choosing the supplied
 * record saves nothing, changes nothing in the learner's own survey, and is never shown as work
 * the learner performed; coming back to "my recorded survey" shows that survey exactly as it was.
 */
export function SurveyRecordChoice({
  value,
  learnerSurveyDate,
  disabled,
  onChange,
}: {
  readonly value: SurveyEvidenceKind
  /** The day the learner's own survey was kept; null when this device holds none. */
  readonly learnerSurveyDate: string | null
  readonly disabled: boolean
  readonly onChange: (kind: SurveyEvidenceKind) => void
}) {
  const name = useId()
  const hasSurvey = learnerSurveyDate !== null
  const options: readonly {
    readonly kind: SurveyEvidenceKind
    readonly label: string
    readonly detail: string
    readonly unavailable?: boolean
  }[] = [
    {
      kind: 'learner',
      label: 'Use my recorded survey',
      detail: hasSurvey
        ? `Your own finished survey, kept on this device${learnerSurveyDate ? ` on ${learnerSurveyDate}` : ''}. It is shown as you recorded it.`
        : 'Not available: this device holds no finished survey of yours. One is kept when you meet the survey’s goals on your own controls in “A systematic survey and its record” and finish that section. Opening a section, a demonstration, a step moved past or a record from an earlier version of this course does not count.',
      unavailable: !hasSurvey,
    },
    {
      kind: 'supplied',
      label: 'Work through a supplied teaching record (not mine)',
      detail:
        'One lower lobe from the worked example in “A systematic survey and its record”. It is not your examination, it is not saved, and it does not change your own survey.',
    },
    {
      kind: 'none',
      label: 'Continue with no survey evidence',
      detail: 'Write the report as it stands when there is no examination record to write from.',
    },
  ]
  return (
    <fieldset
      className={styles.choices}
      data-survey-record-choice={value}
      data-learner-survey={hasSurvey ? 'available' : 'none'}
      disabled={disabled}
    >
      <legend>Which record to write from</legend>
      {options.map((option) => (
        <label
          key={option.kind}
          className={styles.choice}
          data-selected={value === option.kind}
          data-survey-record-option={option.kind}
        >
          <input
            type="radio"
            name={name}
            value={option.kind}
            checked={value === option.kind}
            disabled={option.unavailable}
            aria-describedby={`${name}-${option.kind}`}
            onChange={() => onChange(option.kind)}
          />
          <span>
            <strong>{option.label}</strong>
            <span id={`${name}-${option.kind}`} data-survey-record-detail>
              {' '}
              {option.detail}
            </span>
          </span>
        </label>
      ))}
      {value === 'supplied' ? (
        <p className={styles.verdict} role="note" data-supplied-record-identity>
          <strong>{SUPPLIED_RECORD_IDENTITY}.</strong> Nothing you do with it is recorded as your
          survey, and no finding is filled in for an airway it does not cover.
        </p>
      ) : null}
    </fieldset>
  )
}
