'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, LockKeyhole, BookOpen } from 'lucide-react'
import { StudyViewer } from '@/features/socrates-study/components/StudyViewer'
import { AnnotationKey } from '@/features/socrates-study/components/shared'
import type { SocratesCaseDocument } from '@/features/socrates-builder/types'
import {
  answerSchema,
  teachingSections,
  teachingTitle,
  type CaseProgress,
  type LearningMode,
} from '../model'
import styles from './learning.module.css'
import { coreTeachingSequence, teachingSectionTitle } from '../core-teaching'

export function SlideLesson({
  document,
  mode,
  position,
  total,
  progress,
  onProgress,
  onBack,
  onNext,
  previewOnly = false,
}: {
  document: SocratesCaseDocument
  mode: LearningMode
  position: number
  total: number
  progress: CaseProgress
  onProgress: (next: CaseProgress) => void
  onBack: () => void
  onNext: (() => void) | null
  previewOnly?: boolean
}) {
  const testing = mode === 'testing'
  const core = testing ? null : coreTeachingSequence(document)
  const sections = teachingSections(document)
  const step = Math.min(progress.teachingStep, Math.max(0, sections.length - 1))
  const section = sections[step]
  const heading = useRef<HTMLHeadingElement>(null)
  const [error, setError] = useState('')
  const answers = progress.submission?.answers ?? progress.draft
  const done = Boolean(progress.submission)
  useEffect(() => {
    heading.current?.focus()
  }, [step, done])

  // Use neutral viewer metadata in both modules. In testing the viewer itself prevents
  // automatic Invenio pairing, including its fullscreen presentation.
  const slide = {
    ...document.slide,
    attribution: { label: 'Invenio Imaging', href: 'https://www.invenioimaging.com/' },
    contentStatus: 'Educational slide',
  }
  return (
    <div className={styles.lesson}>
      <div className={styles.lessonBar}>
        <button className={styles.textButton} onClick={onBack}>
          <ArrowLeft size={17} /> {testing ? 'Testing set' : 'Teaching set'}
        </button>
        <span>
          Slide {position} of {total}
        </span>
        <span className={styles.modeBadge}>
          {testing ? <LockKeyhole size={14} /> : <BookOpen size={14} />}
          {testing ? 'Tissue only' : 'Guided teaching'}
        </span>
      </div>
      <div className={styles.lessonHeading}>
        <div>
          <span className={styles.eyebrow}>
            {testing
              ? 'Testing module'
              : core
                ? `Core case ${core.position} · ${teachingSectionTitle(core)}`
                : 'Teaching module'}
          </span>
          <h1>
            {testing ? `Slide ${String(position).padStart(2, '0')}` : teachingTitle(document)}
          </h1>
        </div>
        <p>
          {testing
            ? 'Examine the tissue, then record your interpretation. Teaching content remains hidden throughout this module.'
            : 'Move from tissue architecture to cellular detail, then review the authored interpretation.'}
        </p>
      </div>
      <div className={styles.lessonGrid}>
        <div className={styles.imageColumn}>
          <StudyViewer
            key={`${document.slug}-${mode}`}
            slide={slide}
            tissueOnly={testing}
            annotations={testing ? [] : document.annotations}
          />
          <div className={styles.imageCaption}>
            <span>Drag to pan · scroll to zoom · expand for a closer look</span>
            <span>
              {testing
                ? 'No color overlay or teaching regions'
                : document.annotations.length
                  ? `${document.annotations.length} teaching regions`
                  : 'Teaching regions will be added later'}
            </span>
          </div>
          {!testing && <AnnotationKey legend={document.caseContent.annotationLegend} />}
        </div>
        {testing ? (
          <section className={styles.lessonPanel} aria-label="Testing response">
            <div className={styles.panelTop}>
              <span className={styles.eyebrow}>
                {done ? 'Response recorded' : 'Independent interpretation'}
              </span>
              <LockKeyhole size={18} />
            </div>
            <h2 ref={heading} tabIndex={-1}>
              {done ? 'Interpretation submitted' : 'What does the tissue show?'}
            </h2>
            {done ? (
              <>
                <div className={styles.confirmation}>
                  <Check size={20} />
                  <p>
                    {previewOnly
                      ? 'This preview response is kept for this visit only.'
                      : 'Your response is saved in this browser.'}{' '}
                    Answers and teaching explanations are not shown in the testing module.
                  </p>
                </div>
                <dl className={styles.responseSummary}>
                  <div>
                    <dt>Adequacy</dt>
                    <dd>{answers.adequacy}</dd>
                  </div>
                  <div>
                    <dt>Cancer classification</dt>
                    <dd>{answers.cancer}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{answers.confidence}</dd>
                  </div>
                </dl>
                {answers.reasoning && (
                  <section>
                    <h3>Your reasoning</h3>
                    <p className={styles.prose}>{answers.reasoning}</p>
                  </section>
                )}
                {progress.submission?.teachingSeen && (
                  <p className={styles.note}>
                    You viewed this slide in the teaching module before submitting. This response is
                    practice.
                  </p>
                )}
                <button className={styles.primary} onClick={onNext ?? onBack}>
                  {onNext ? 'Continue to next slide' : 'Return to testing set'}
                  <ArrowRight size={18} />
                </button>
              </>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const parsed = answerSchema.safeParse({
                    ...progress.draft,
                    reasoning: progress.draft.reasoning ?? '',
                  })
                  if (!parsed.success) {
                    setError(
                      'Choose an answer for adequacy, cancer classification, and confidence.',
                    )
                    return
                  }
                  setError('')
                  onProgress({
                    ...progress,
                    submission: {
                      answers: parsed.data,
                      submittedAt: new Date().toISOString(),
                      teachingSeen: progress.teachingViewed,
                    },
                  })
                }}
              >
                {(
                  [
                    [
                      'adequacy',
                      '1. Is the specimen adequate for the targeted lesion?',
                      ['Adequate', 'Not adequate', 'Uncertain'],
                    ],
                    [
                      'cancer',
                      '2. How would you classify the tissue?',
                      ['Cancer', 'Non-cancer', 'Uncertain'],
                    ],
                    ['confidence', '3. How confident are you?', ['Low', 'Moderate', 'High']],
                  ] as const
                ).map(([id, label, options]) => (
                  <fieldset key={id} className={styles.question}>
                    <legend>{label}</legend>
                    <div className={styles.choices}>
                      {options.map((option) => (
                        <label key={option} className={answers[id] === option ? styles.chosen : ''}>
                          <input
                            type="radio"
                            name={id}
                            value={option}
                            checked={answers[id] === option}
                            required
                            onChange={() =>
                              onProgress({
                                ...progress,
                                draft: { ...progress.draft, [id]: option },
                              })
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <label className={styles.reasoning}>
                  Reasoning <span>Optional</span>
                  <textarea
                    maxLength={4000}
                    rows={3}
                    value={answers.reasoning ?? ''}
                    placeholder="Which features informed your interpretation?"
                    onChange={(event) =>
                      onProgress({
                        ...progress,
                        draft: { ...progress.draft, reasoning: event.target.value },
                      })
                    }
                  />
                </label>
                <p className={styles.note}>
                  Use the tissue findings only. Do not enter patient identifiers. Your submitted
                  response cannot be edited.
                </p>
                {error && <p role="alert">{error}</p>}
                <button className={styles.primary} type="submit">
                  Submit interpretation
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
          </section>
        ) : (
          <section className={styles.lessonPanel} aria-label="Guided teaching">
            <div className={styles.panelTop}>
              <span className={styles.eyebrow}>Read the slide</span>
              <span>{sections.length ? `${step + 1} / ${sections.length}` : 'Draft'}</span>
            </div>
            <nav className={styles.stepper} aria-label="Teaching steps">
              {sections.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={item.title}
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() =>
                    onProgress({ ...progress, teachingStep: index, teachingViewed: true })
                  }
                >
                  {index + 1}
                  <span>{item.title}</span>
                </button>
              ))}
            </nav>
            <h2 ref={heading} tabIndex={-1}>
              {section?.title ?? 'Teaching content pending'}
            </h2>
            <p className={styles.prose}>
              {section?.text ?? 'Add the authored teaching explanation in the slide builder.'}
            </p>
            <div className={styles.sourceNote}>
              Source: authored case curriculum · draft for review
            </div>
            <div className={styles.stepActions}>
              {step > 0 && (
                <button
                  className={styles.secondary}
                  onClick={() =>
                    onProgress({ ...progress, teachingStep: step - 1, teachingViewed: true })
                  }
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              {step < sections.length - 1 ? (
                <button
                  className={styles.primary}
                  onClick={() =>
                    onProgress({ ...progress, teachingStep: step + 1, teachingViewed: true })
                  }
                >
                  Continue
                  <ArrowRight size={18} />
                </button>
              ) : sections.length > 0 && !progress.teachingComplete ? (
                <button
                  className={styles.primary}
                  onClick={() =>
                    onProgress({ ...progress, teachingComplete: true, teachingViewed: true })
                  }
                >
                  Complete teaching
                  <Check size={18} />
                </button>
              ) : progress.teachingComplete ? (
                <button className={styles.primary} onClick={onNext ?? onBack}>
                  {onNext ? 'Continue to next slide' : 'Return to teaching set'}
                  <ArrowRight size={18} />
                </button>
              ) : null}
            </div>
            {progress.teachingComplete && (
              <p className={styles.completed} role="status">
                <Check size={16} />
                Teaching reviewed
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
