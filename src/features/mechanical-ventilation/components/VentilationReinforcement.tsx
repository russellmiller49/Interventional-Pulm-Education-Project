'use client'

import { useState } from 'react'
import styles from './ventilation-course.module.css'

/** Optional, transient feedback. Revealing never submits a choice or performs an experiment. */
export function VentilationReinforcement({
  id,
  purpose,
  prompt,
  choices,
  explanation,
  hint,
  onChoose,
}: {
  id: string
  purpose: string
  prompt: string
  choices: readonly { id: string; label: string; rationale?: string }[]
  explanation: string
  hint: string
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
            <p>
              <strong>Your choice: {choice.label}. </strong>
              {choice.rationale}
            </p>
          ) : null}
          <p>{explanation}</p>
          <details>
            <summary>Compare the possibilities</summary>
            {choices.map((item) =>
              item.rationale ? (
                <p key={item.id}>
                  <strong>{item.label}. </strong>
                  {item.rationale}
                </p>
              ) : null,
            )}
          </details>
        </div>
      ) : null}
    </section>
  )
}
