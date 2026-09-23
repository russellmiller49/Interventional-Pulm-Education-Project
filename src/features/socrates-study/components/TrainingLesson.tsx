import { useEffect, useRef } from 'react'
import type { TrainingCase, TrainingReveal } from '../projections'
import type { TrainingProgress } from '../model'
import { StudyViewer } from './StudyViewer'
import { AnnotationKey, Interpretation } from './shared'
import styles from './study.module.css'

/** Presentational lesson. Controllers own reveal and all persistence. */
export function TrainingLesson({
  initial,
  reveal,
  step,
  setStep,
  onReveal,
  onComplete,
  busy = false,
  error = '',
  progress = null,
}: {
  initial: TrainingCase
  reveal: TrainingReveal | null
  step: number
  setStep: (step: number) => void
  onReveal: () => void
  onComplete?: () => void
  busy?: boolean
  error?: string
  progress?: TrainingProgress | null
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (step > 0) heading.current?.focus()
  }, [step])
  const narrative = reveal?.teaching.learnerNarrative
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
      <div className={styles.eyebrow}>
        {onComplete ? 'Training' : 'Draft preview'} · {initial.diagnosticCategory}
      </div>
      <h1>{initial.title}</h1>
      <p>
        Inspect the tissue and form an interpretation. Reveal the authored teaching content when you
        are ready.
      </p>
      <div className={styles.grid}>
        <StudyViewer slide={initial.slide} annotations={reveal?.annotations} />
        <aside className={styles.panel} aria-label="Case teaching panel">
          <div className={styles.eyebrow}>
            {step === 0
              ? 'Image inspection'
              : narrative
                ? step === 5
                  ? 'Review completed'
                  : 'Teaching review'
                : `Step ${Math.min(step + 1, 5)} of 5`}
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {narrative && step > 0 && step < 5 ? 'Case teaching' : titles[step]}
          </h2>
          <section>
            <h3>Case vignette</h3>
            <p style={{ whiteSpace: 'pre-line' }}>
              {initial.vignette || 'Case vignette pending author review.'}
            </p>
          </section>
          {step === 0 && (
            <button type="button" disabled={busy} onClick={() => onReveal()}>
              {progress?.revealed_at
                ? 'Continue teaching review'
                : 'Reveal teaching interpretation'}
            </button>
          )}
          {reveal &&
            step > 0 &&
            (narrative ? (
              <>
                <div className={styles.narrative} data-testid="learner-narrative">
                  {narrative}
                </div>
                {onComplete && step !== 5 && (
                  <button type="button" disabled={busy} onClick={onComplete}>
                    Mark case completed
                  </button>
                )}
              </>
            ) : (
              <>
                {step === 1 && (
                  <>
                    {!reveal.teaching.lowMagnificationObservations.some(Boolean) && (
                      <p>Low-magnification observations pending author review.</p>
                    )}
                    <ul>
                      {reveal.teaching.lowMagnificationObservations
                        .filter(Boolean)
                        .map((text, i) => (
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
                    {step === 4 && onComplete && (
                      <button type="button" disabled={busy} onClick={() => onComplete?.()}>
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
            ))}
          <AnnotationKey legend={reveal?.legend ?? initial.legend} />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {onComplete && (
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
          )}
        </aside>
      </div>
    </>
  )
}
