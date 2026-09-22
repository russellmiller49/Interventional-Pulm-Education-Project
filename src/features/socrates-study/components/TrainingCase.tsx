'use client'
import { useEffect, useState } from 'react'
import type { TrainingCase as TrainingCaseDTO, TrainingReveal } from '../projections'
import type { TrainingProgress, TrainingStage } from '../model'
import { StudyViewer } from './StudyViewer'
import { AnnotationKey, Interpretation, api } from './shared'
import styles from './study.module.css'
export function TrainingCase({ initial }: { initial: TrainingCaseDTO }) {
  const [progress, setProgress] = useState(initial.progress)
  const [reveal, setReveal] = useState<TrainingReveal | null>(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    api<{ progress: TrainingProgress }>('training', {
      caseId: initial.id,
      revision: initial.revision,
      stage: 'opened',
    })
      .then((r) => {
        if (live) setProgress(r.progress)
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [initial.id, initial.revision])
  async function advance(stage: TrainingStage) {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ progress: TrainingProgress; reveal: TrainingReveal }>('training', {
        caseId: initial.id,
        revision: initial.revision,
        stage,
      })
      setProgress(result.progress)
      setReveal(result.reveal)
      setStep(stage === 'revealed' ? 1 : 5)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Progress was not saved.')
    } finally {
      setBusy(false)
    }
  }
  const titles = [
    'Inspect the image',
    'Low magnification',
    'High magnification',
    'Teaching interpretation',
    'Key learning points',
    'Case completed',
  ]
  return (
    <>
      <div className={styles.eyebrow}>Training · {initial.diagnosticCategory}</div>
      <h1>{initial.title}</h1>
      <p>
        Inspect the tissue and form an interpretation. Reveal the authored teaching content when you
        are ready.
      </p>
      <div className={styles.grid}>
        <StudyViewer slide={initial.slide} annotations={reveal?.annotations} />
        <aside className={styles.panel} aria-label="Case teaching panel">
          <div className={styles.eyebrow}>Step {Math.min(step + 1, 5)} of 5</div>
          <h2>{titles[step]}</h2>
          <section>
            <h3>Case vignette</h3>
            <p style={{ whiteSpace: 'pre-line' }}>
              {initial.vignette || 'Case vignette pending author review.'}
            </p>
          </section>
          {step === 0 && (
            <button type="button" disabled={busy} onClick={() => void advance('revealed')}>
              {progress?.revealed_at
                ? 'Continue teaching review'
                : 'Reveal teaching interpretation'}
            </button>
          )}
          {reveal && step > 0 && (
            <>
              {step === 1 && (
                <>
                  {!reveal.teaching.lowMagnificationObservations.some(Boolean) && (
                    <p>Low-magnification observations pending author review.</p>
                  )}
                  <ul>
                    {reveal.teaching.lowMagnificationObservations.filter(Boolean).map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => setStep(2)}>
                    Continue to high magnification
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  {!reveal.teaching.highMagnificationObservations.some(Boolean) && (
                    <p>High-magnification observations pending author review.</p>
                  )}
                  <ul>
                    {reveal.teaching.highMagnificationObservations
                      .filter(Boolean)
                      .map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                  </ul>
                  <button type="button" onClick={() => setStep(3)}>
                    Continue to interpretation
                  </button>
                </>
              )}
              {step === 3 && (
                <>
                  <Interpretation teaching={reveal.teaching} />
                  <button type="button" onClick={() => setStep(4)}>
                    Review learning points
                  </button>
                </>
              )}
              {step >= 4 && (
                <>
                  {!reveal.teaching.keyLearningPoints.some(Boolean) && (
                    <p>Key learning points pending author review.</p>
                  )}
                  <ul>
                    {reveal.teaching.keyLearningPoints.filter(Boolean).map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                  {step === 4 && (
                    <button type="button" disabled={busy} onClick={() => void advance('completed')}>
                      Mark case completed
                    </button>
                  )}
                </>
              )}
              {step > 1 && (
                <p>
                  <button type="button" onClick={() => setStep(step === 5 ? 1 : step - 1)}>
                    Review previous step
                  </button>
                </p>
              )}
            </>
          )}
          <AnnotationKey legend={initial.legend} />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <p role="status">
            {busy
              ? 'Saving progress…'
              : progress?.completed_at
                ? 'Completed · progress saved'
                : progress?.revealed_at
                  ? 'Teaching revealed · progress saved'
                  : progress
                    ? 'Opened · progress saved'
                    : 'Opening case…'}
          </p>
        </aside>
      </div>
    </>
  )
}
