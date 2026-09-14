'use client'

import { useMemo, useState, type Dispatch } from 'react'

import { waveformAtlasById, waveformAtlasEntries } from '../content/waveformAtlas'
import { unidentifiedTraceDescription } from '../content/introductoryTeaching'
import type { HemodynamicAction } from '../engine'
import { WaveformAtlasFigure } from './WaveformAtlasFigure'
import styles from './icu-hemodynamics.module.css'

/**
 * Question order and distractors are authored rather than randomized, so the drill is
 * deterministic across server and client renders and the difficulty ramp is intentional.
 */
const QUESTIONS: readonly { readonly answerId: string; readonly optionIds: readonly string[] }[] = [
  {
    answerId: 'rv-normal',
    optionIds: ['ra-normal', 'rv-normal', 'pa-normal', 'wedge-normal'],
  },
  {
    answerId: 'pa-normal',
    optionIds: ['rv-normal', 'pa-normal', 'wedge-hybrid', 'ra-normal'],
  },
  {
    answerId: 'wedge-normal',
    optionIds: ['wedge-normal', 'ra-normal', 'wedge-overwedged', 'pa-normal'],
  },
  {
    answerId: 'ra-tamponade',
    optionIds: [
      'ra-normal',
      'ra-tamponade',
      'ra-tricuspid-regurgitation',
      'ra-atrial-fibrillation',
    ],
  },
  {
    answerId: 'ra-tricuspid-regurgitation',
    optionIds: ['ra-cannon-a-wave', 'ra-tricuspid-regurgitation', 'ra-normal', 'ra-tamponade'],
  },
  {
    answerId: 'wedge-large-v-wave',
    optionIds: ['pa-normal', 'wedge-large-v-wave', 'wedge-normal', 'wedge-hybrid'],
  },
  {
    answerId: 'ra-atrial-fibrillation',
    optionIds: ['ra-atrial-fibrillation', 'ra-normal', 'ra-cannon-a-wave', 'ra-tamponade'],
  },
  {
    answerId: 'wedge-overwedged',
    optionIds: ['wedge-normal', 'wedge-overwedged', 'wedge-hybrid', 'ra-normal'],
  },
]

/**
 * The four places only, for the section that teaches naming a place from its shape. The
 * abnormal patterns belong to the section after it, which reads the waves inside a named place.
 */
const PLACE_QUESTIONS: readonly {
  readonly answerId: string
  readonly optionIds: readonly string[]
}[] = [
  { answerId: 'rv-normal', optionIds: ['ra-normal', 'rv-normal', 'pa-normal', 'wedge-normal'] },
  { answerId: 'pa-normal', optionIds: ['rv-normal', 'pa-normal', 'wedge-normal', 'ra-normal'] },
  { answerId: 'wedge-normal', optionIds: ['wedge-normal', 'ra-normal', 'rv-normal', 'pa-normal'] },
  { answerId: 'ra-normal', optionIds: ['pa-normal', 'wedge-normal', 'ra-normal', 'rv-normal'] },
  { answerId: 'pa-normal', optionIds: ['pa-normal', 'rv-normal', 'ra-normal', 'wedge-normal'] },
  { answerId: 'rv-normal', optionIds: ['wedge-normal', 'pa-normal', 'rv-normal', 'ra-normal'] },
]

const REQUIRED_CORRECT = 5

export interface RecognitionRecord {
  readonly index: number
  readonly selectedId: string | null
  readonly revealed: boolean
  readonly correctCount: number
  readonly answered: number
}
export const emptyRecognitionRecord = (): RecognitionRecord => ({
  index: 0,
  selectedId: null,
  revealed: false,
  correctCount: 0,
  answered: 0,
})

interface WaveformRecognitionDrillProps {
  readonly dispatch?: Dispatch<HemodynamicAction>
  /** `places` restricts the run to the four normal tracings; `all` is the full atlas. */
  readonly questionSet?: 'places' | 'all'
  readonly enabled?: boolean
  readonly record?: RecognitionRecord
  readonly onRecord?: (record: RecognitionRecord) => void
}

export function WaveformRecognitionDrill({
  dispatch,
  questionSet = 'all',
  enabled = true,
  record,
  onRecord,
}: WaveformRecognitionDrillProps) {
  const QUESTION_SET = questionSet === 'places' ? PLACE_QUESTIONS : QUESTIONS
  const [localRecord, setLocalRecord] = useState<RecognitionRecord>(emptyRecognitionRecord)
  const currentRecord = record ?? localRecord
  const { index, selectedId, revealed, correctCount, answered } = currentRecord
  const updateRecord = onRecord ?? setLocalRecord

  const question = QUESTION_SET[index % QUESTION_SET.length]
  const answer = waveformAtlasById.get(question.answerId)
  const options = useMemo(
    () => question.optionIds.flatMap((id) => waveformAtlasById.get(id) ?? []),
    [question.optionIds],
  )

  if (!answer) return null

  const isCorrect = revealed && selectedId === answer.id
  const complete = correctCount >= REQUIRED_CORRECT

  function submit() {
    if (!enabled || !selectedId || revealed || !answer || complete) return
    const next = correctCount + (selectedId === answer.id ? 1 : 0)
    updateRecord({ ...currentRecord, revealed: true, answered: answered + 1, correctCount: next })
    if (next === REQUIRED_CORRECT && correctCount < REQUIRED_CORRECT) {
      dispatch?.({ type: 'VALIDATE_SIGNAL', check: 'waveform-recognition' })
    }
  }

  function nextQuestion() {
    if (!enabled || complete) return
    updateRecord({ ...currentRecord, index: index + 1, selectedId: null, revealed: false })
  }

  return (
    <section className={styles.recognitionDrill} aria-labelledby="recognition-drill-heading">
      <header className={styles.atlasPanelHeader}>
        <div>
          <span>Your attempt · question tracing</span>
          <h3 id="recognition-drill-heading">Name the tracing</h3>
        </div>
        <p className={styles.drillScore} role="status" aria-live="polite">
          <strong>{complete ? 'Pattern set worked through' : 'Compare the morphology'}</strong>
          <span>
            {correctCount} of {REQUIRED_CORRECT} correct · {answered} attempted. Correct responses
            accumulate; an error does not reset the count.
          </span>
        </p>
      </header>
      {index >= QUESTION_SET.length ||
      QUESTION_SET.slice(0, index).some((candidate) => candidate.answerId === question.answerId) ? (
        <p>Repeated practice · this reference pattern has appeared earlier.</p>
      ) : (
        <p>Identify this tracing; it is the sole question example.</p>
      )}

      <WaveformAtlasFigure
        key={`${question.answerId}-${revealed}`}
        entry={
          revealed
            ? answer
            : // Withhold the identifying caption and labels until the learner commits.
              { ...answer, label: 'Unidentified tracing', normalRange: null, insertionDepth: null }
        }
        annotated={revealed}
        ecgLandmarks
        readable={questionSet === 'places'}
        figureDescription={
          revealed
            ? undefined
            : `${unidentifiedTraceDescription(answer)} Axis 0–${answer.scaleMaxMmHg} mmHg. Identifying labels are withheld.`
        }
      />

      <fieldset className={styles.drillOptions} disabled={revealed || !enabled || complete}>
        <legend>Which tracing is this?</legend>
        {options.map((option) => (
          <label key={option.id} data-state={revealed ? optionState(option.id) : undefined}>
            <input
              type="radio"
              name={`recognition-${index}`}
              value={option.id}
              checked={selectedId === option.id}
              onChange={() => updateRecord({ ...currentRecord, selectedId: option.id })}
            />
            <span>{option.label}</span>
            {revealed && option.id === answer.id ? (
              <span className={styles.optionStateText}>Reference tracing</span>
            ) : revealed && option.id === selectedId ? (
              <span className={styles.optionStateText}>Selected response</span>
            ) : null}
          </label>
        ))}
      </fieldset>

      <div className={styles.drillControls}>
        {!revealed && !complete ? (
          <button type="button" disabled={!selectedId || !enabled} onClick={submit}>
            Check answer
          </button>
        ) : !complete ? (
          <button type="button" disabled={!enabled} onClick={nextQuestion}>
            Next tracing
          </button>
        ) : (
          <p>
            Five correct responses recorded. This is completion of practice, not a clinical
            proficiency standard.
          </p>
        )}
      </div>

      {revealed ? (
        <div className={styles.drillFeedback} data-correct={isCorrect || undefined} role="status">
          <strong>
            {isCorrect ? 'Pattern identified.' : `This is ${answer.label.toLowerCase()}.`}
          </strong>
          <p>{answer.summary}</p>
          {/* The cues are a list, and say so: the same heading the atlas panel gives them. */}
          <h4>What identifies it</h4>
          <ul>
            {answer.recognitionCues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
          {answer.pitfall ? <p className={styles.drillPitfall}>{answer.pitfall}</p> : null}
        </div>
      ) : null}
    </section>
  )

  function optionState(optionId: string): 'correct' | 'incorrect' | undefined {
    if (!answer) return undefined
    if (optionId === answer.id) return 'correct'
    if (optionId === selectedId) return 'incorrect'
    return undefined
  }
}

export const waveformRecognitionEntryCount = waveformAtlasEntries.length
