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

/**
 * Where the drill is: which tracing, what is selected, and whether the answer was checked or shown.
 *
 * HD-01 removed the running correct count, the attempts count and the five-correct target. A learner
 * names as many tracings as are useful, checks an answer, shows the labels without answering, or
 * moves to another tracing at any time; nothing here decides whether they may move on.
 */
export interface RecognitionRecord {
  readonly index: number
  readonly selectedId: string | null
  readonly revealed: 'checked' | 'shown' | null
}
export const emptyRecognitionRecord = (): RecognitionRecord => ({
  index: 0,
  selectedId: null,
  revealed: null,
})

interface WaveformRecognitionDrillProps {
  /**
   * When given, the first checked answer marks the stage's "named a tracing" goal. Showing the labels
   * without answering never does.
   */
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
  const { index, selectedId, revealed } = currentRecord
  const updateRecord = onRecord ?? setLocalRecord

  const question = QUESTION_SET[index % QUESTION_SET.length]
  const answer = waveformAtlasById.get(question.answerId)
  const options = useMemo(
    () => question.optionIds.flatMap((id) => waveformAtlasById.get(id) ?? []),
    [question.optionIds],
  )

  if (!answer) return null

  const isCorrect = revealed === 'checked' && selectedId === answer.id

  function check() {
    if (!enabled || !selectedId || revealed) return
    updateRecord({ ...currentRecord, revealed: 'checked' })
    dispatch?.({ type: 'VALIDATE_SIGNAL', check: 'waveform-recognition' })
  }

  function show() {
    if (!enabled || revealed) return
    updateRecord({ ...currentRecord, selectedId: null, revealed: 'shown' })
  }

  function nextQuestion() {
    if (!enabled) return
    updateRecord({ index: index + 1, selectedId: null, revealed: null })
  }

  return (
    <section className={styles.recognitionDrill} aria-labelledby="recognition-drill-heading">
      <header className={styles.atlasPanelHeader}>
        <div>
          <span>Optional practice · question tracing</span>
          <h3 id="recognition-drill-heading">Name the tracing</h3>
        </div>
        <p className={styles.drillScore} role="status" aria-live="polite">
          <strong>Tracing {index + 1}</strong>
          <span>
            Check an answer, show the labels, or move to another tracing whenever you like.
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
        key={`${index}-${question.answerId}-${revealed ?? 'open'}`}
        entry={
          revealed
            ? answer
            : // Withhold the identifying caption and labels until the learner checks or shows them.
              { ...answer, label: 'Unidentified tracing', normalRange: null, insertionDepth: null }
        }
        annotated={revealed !== null}
        ecgLandmarks
        readable={questionSet === 'places'}
        figureDescription={
          revealed
            ? undefined
            : `${unidentifiedTraceDescription(answer)} Axis 0–${answer.scaleMaxMmHg} mmHg. Identifying labels are withheld until you check an answer or show them.`
        }
      />

      <fieldset className={styles.drillOptions} disabled={revealed !== null || !enabled}>
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
        {!revealed ? (
          <>
            <button type="button" disabled={!selectedId || !enabled} onClick={check}>
              Check answer
            </button>
            <button type="button" disabled={!enabled} onClick={show}>
              Show the labels
            </button>
          </>
        ) : null}
        <button type="button" disabled={!enabled} onClick={nextQuestion}>
          Next tracing
        </button>
      </div>

      {revealed ? (
        <div
          className={styles.drillFeedback}
          data-correct={isCorrect || undefined}
          data-recognition-reveal={revealed}
          role="status"
        >
          <strong>
            {revealed === 'shown'
              ? `Shown without an answer: ${answer.label.toLowerCase()}.`
              : isCorrect
                ? 'Pattern identified.'
                : `This is ${answer.label.toLowerCase()}.`}
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
