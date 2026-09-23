'use client'
import { useState } from 'react'
import type { SocratesCaseDocument } from '../types'
import { trainingProjection, revealProjection } from '@/features/socrates-study/projections'
import { TrainingLesson } from '@/features/socrates-study/components/TrainingLesson'
import styles from '@/features/socrates-study/components/study.module.css'

/** Editor-only controller: no participant controller, API, or server service imports. */
export function DraftLearnerPreview({ document }: { document: SocratesCaseDocument }) {
  const [step, setStep] = useState(0)
  const initial = trainingProjection(
    document,
    Boolean(document.slide.comparisonDescriptorUrl),
    null,
  )
  // Authoring sources already belong to this editor. Retain the viewer's allowlisted fields,
  // never its arbitrary attribution/contentStatus or any private author metadata.
  initial.slide.descriptorUrl = document.slide.descriptorUrl
  initial.slide.comparisonDescriptorUrl = document.slide.comparisonDescriptorUrl
  const reveal = step ? revealProjection(document) : null
  return (
    <div className={styles.page}>
      <TrainingLesson
        initial={initial}
        reveal={reveal}
        step={step}
        setStep={setStep}
        onReveal={() => setStep(1)}
      />
    </div>
  )
}
