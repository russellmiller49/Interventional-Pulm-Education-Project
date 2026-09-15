'use client'

import { useState } from 'react'
import styles from './ventilation-course.module.css'

export interface VentilationReinforcementChoice {
  readonly id: string
  readonly label: string
  readonly rationale?: string
  /** Why this choice could harm the patient in the stated case. An explanation, never a grade. */
  readonly safety?: string
}

export function VentilationSafetyNote({ text }: { readonly text: string }) {
  return (
    <p className={`${styles.notice} ${styles.warning}`} data-safety-note>
      <strong>Potential harm in this case: </strong>
      {text}
    </p>
  )
}

export function choiceFitLabel(choiceId: string, bestChoiceId: string) {
  return choiceId === bestChoiceId ? 'This fits the case. ' : 'This does not fit the case. '
}

/** Optional, transient feedback. Revealing never submits a choice or performs an experiment. */
export function VentilationReinforcement({
  id,
  purpose,
  prompt,
  choices,
  explanation,
  hint,
  nextCheck,
  bestChoiceId,
  onChoose,
}: {
  id: string
  purpose: string
  prompt: string
  choices: readonly VentilationReinforcementChoice[]
  explanation: string
  hint: string
  /** The next observation worth making, shown with the explanation. */
  nextCheck?: string
  /** The reading the explanation supports; used only to say whether a compared choice fits. */
  bestChoiceId?: string
  onChoose?: (id: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [compared, setCompared] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const choice = choices.find((item) => item.id === selected)
  return (
    <section className={styles.question} data-reinforcement={id}>
      <p className={styles.eyebrow}>Optional reinforcement</p>
      <p>{purpose}</p>
      <fieldset>
        <legend>{prompt}</legend>
        {choices.map((item) => (
          <label key={item.id} className={styles.choice}>
            <input
              type="radio"
              name={id}
              checked={selected === item.id}
              onChange={() => {
                setSelected(item.id)
                setCompared(false)
              }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          disabled={!selected}
          onClick={() => {
            if (selected) onChoose?.(selected)
            setCompared(true)
            setRevealed(true)
          }}
        >
          Compare my choice
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={hintOpen}
          onClick={() => setHintOpen((open) => !open)}
        >
          Hint
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={revealed}
          onClick={() => setRevealed(true)}
        >
          Show explanation
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setSelected(null)
            setCompared(false)
            setRevealed(false)
            setHintOpen(false)
          }}
        >
          Try again
        </button>
      </div>
      {hintOpen ? <p role="status">{hint}</p> : null}
      {revealed ? (
        <div className={styles.feedback} data-reinforcement-explanation>
          <h3>Explanation</h3>
          {compared && choice ? (
            <>
              <p data-compared-choice={choice.id}>
                <strong>Your choice: {choice.label}. </strong>
                {bestChoiceId ? choiceFitLabel(choice.id, bestChoiceId) : null}
                {choice.rationale}
              </p>
              {choice.safety ? <VentilationSafetyNote text={choice.safety} /> : null}
            </>
          ) : null}
          <p>{explanation}</p>
          {nextCheck ? (
            <p>
              <strong>What to check next: </strong>
              {nextCheck}
            </p>
          ) : null}
          <details>
            <summary>Compare the possibilities</summary>
            {choices.map((item) =>
              item.rationale ? (
                <div key={item.id}>
                  <p>
                    <strong>{item.label}. </strong>
                    {item.rationale}
                  </p>
                  {item.safety ? <VentilationSafetyNote text={item.safety} /> : null}
                </div>
              ) : null,
            )}
          </details>
        </div>
      ) : null}
    </section>
  )
}
