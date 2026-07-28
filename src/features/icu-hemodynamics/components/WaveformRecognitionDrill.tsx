'use client'

import { useMemo, useState, type Dispatch } from 'react'

import { waveformAtlasById, waveformAtlasEntries } from '../content/waveformAtlas'
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

const REQUIRED_CORRECT = 5

interface WaveformRecognitionDrillProps {
  readonly dispatch?: Dispatch<HemodynamicAction>
}

export function WaveformRecognitionDrill({ dispatch }: WaveformRecognitionDrillProps) {
  const [index, setIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [answered, setAnswered] = useState(0)

  const question = QUESTIONS[index % QUESTIONS.length]
  const answer = waveformAtlasById.get(question.answerId)
  const options = useMemo(
    () => question.optionIds.flatMap((id) => waveformAtlasById.get(id) ?? []),
    [question.optionIds],
  )

  if (!answer) return null

  const isCorrect = revealed && selectedId === answer.id
  const complete = correctCount >= REQUIRED_CORRECT

  function submit() {
    if (!selectedId || revealed || !answer) return
    setRevealed(true)
    setAnswered((current) => current + 1)
    if (selectedId === answer.id) {
      const next = correctCount + 1
      setCorrectCount(next)
      if (next >= REQUIRED_CORRECT) {
        dispatch?.({ type: 'VALIDATE_SIGNAL', check: 'waveform-recognition' })
      }
    }
  }

  function nextQuestion() {
    setIndex((current) => (current + 1) % QUESTIONS.length)
    setSelectedId(null)
    setRevealed(false)
  }

  return (
    <section className={styles.recognitionDrill} aria-labelledby="recognition-drill-heading">
      <header className={styles.atlasPanelHeader}>
        <div>
          <span>Recognition drill</span>
          <h3 id="recognition-drill-heading">Name the tracing</h3>
        </div>
        <p className={styles.drillScore} role="status" aria-live="polite">
          <strong>{complete ? 'Pattern set worked through' : 'Compare the morphology'}</strong>
          <span>
            {answered > 0
              ? 'Use the revealed landmarks to refine the next identification.'
              : 'Commit to a tracing before revealing its landmarks.'}
          </span>
        </p>
      </header>

      <WaveformAtlasFigure
        key={`${question.answerId}-${revealed}`}
        entry={
          revealed
            ? answer
            : // Withhold the identifying caption and labels until the learner commits.
              { ...answer, label: 'Unidentified tracing', normalRange: null, insertionDepth: null }
        }
        annotated={revealed}
      />

      <fieldset className={styles.drillOptions} disabled={revealed}>
        <legend>Which tracing is this?</legend>
        {options.map((option) => (
          <label key={option.id} data-state={revealed ? optionState(option.id) : undefined}>
            <input
              type="radio"
              name={`recognition-${index}`}
              value={option.id}
              checked={selectedId === option.id}
              onChange={() => setSelectedId(option.id)}
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
          <button type="button" disabled={!selectedId} onClick={submit}>
            Check answer
          </button>
        ) : (
          <button type="button" onClick={nextQuestion}>
            Next tracing
          </button>
        )}
      </div>

      {revealed ? (
        <div className={styles.drillFeedback} data-correct={isCorrect || undefined} role="status">
          <strong>
            {isCorrect ? 'Pattern identified.' : `This is ${answer.label.toLowerCase()}.`}
          </strong>
          <p>{answer.summary}</p>
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
