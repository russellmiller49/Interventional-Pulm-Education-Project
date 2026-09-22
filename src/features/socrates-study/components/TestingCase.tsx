'use client'
import { useState } from 'react'
import type { TestCase } from '../projections'
import { validateResponses } from '../model'
import { StudyViewer } from './StudyViewer'
import { AnnotationKey, Interpretation, api } from './shared'
import styles from './study.module.css'
export function TestingCase({ initial }: { initial: TestCase }) {
  const [data, setData] = useState(initial)
  const [responses, setResponses] = useState(initial.attempt.responses)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = Boolean(data.attempt.submitted_at)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const answers = validateResponses(data.survey, responses)
      const result = await api<TestCase>('submit', {
        attemptId: data.attempt.id,
        responses: answers,
      })
      setData(result)
      setResponses(result.attempt.responses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className={styles.eyebrow}>
        Testing · {data.attempt.round_key} · study version {data.attempt.study_version}
      </div>
      <h1>{data.title}</h1>
      <p>
        {done
          ? 'Your interpretation has been saved.'
          : 'Inspect the image, then submit your interpretation and confidence.'}
      </p>
      <div className={styles.grid}>
        <StudyViewer slide={initial.slide} />
        <section className={styles.panel} aria-label="Testing survey">
          <h2>{done ? 'Submitted interpretation' : 'Your interpretation'}</h2>
          <form onSubmit={(event) => void submit(event)}>
            {data.survey.map((item) => (
              <label key={item.id}>
                {item.prompt}
                {item.required ? ' (required)' : ' (optional)'}
                {item.id === 'freeText' ? (
                  <textarea
                    maxLength={4000}
                    required={item.required}
                    disabled={done || busy}
                    value={responses[item.id] ?? ''}
                    onChange={(e) => setResponses({ ...responses, [item.id]: e.target.value })}
                  />
                ) : (
                  <select
                    required={item.required}
                    disabled={done || busy}
                    value={responses[item.id] ?? ''}
                    onChange={(e) => setResponses({ ...responses, [item.id]: e.target.value })}
                  >
                    <option value="">Select a response</option>
                    {item.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
            {data.survey.some((item) => item.id === 'freeText') && (
              <p className={styles.small}>
                Do not enter patient names, specimen identifiers or other identifying information.
              </p>
            )}
            {!done && (
              <>
                <p className={styles.small}>
                  Submission is final. Interpretation time runs from opening this case to
                  submission, including interruptions.
                </p>
                <button disabled={busy} type="submit">
                  {busy ? 'Submitting…' : 'Submit interpretation'}
                </button>
              </>
            )}
          </form>
          {done && (
            <p role="status">
              Completed · saved. Interpretation time: {(data.attempt.elapsed_ms! / 1000).toFixed(1)}{' '}
              seconds.
            </p>
          )}
          {done && !data.feedback && <p>Teaching feedback is withheld for this study round.</p>}
          {data.feedback && (
            <section aria-label="Configured study feedback">
              <Interpretation teaching={data.feedback} />
            </section>
          )}
          {data.legend && <AnnotationKey legend={data.legend} />}{' '}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </section>
      </div>
    </>
  )
}
