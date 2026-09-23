'use client'
import { useEffect, useState } from 'react'
import type { TrainingCase as TrainingCaseDTO, TrainingReveal } from '../projections'
import type { TrainingProgress, TrainingStage } from '../model'
import { api } from './shared'
import { TrainingLesson } from './TrainingLesson'
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
  return (
    <TrainingLesson
      initial={initial}
      reveal={reveal}
      step={step}
      setStep={setStep}
      onReveal={() => void advance('revealed')}
      onComplete={() => void advance('completed')}
      busy={busy}
      error={error}
      progress={progress}
    />
  )
}
