'use client'

import { GraduationCap } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { getBaxterCrrtCase } from '../content/completeCases'
import { baxterCrrtMasteryManifest } from '../content/mastery'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningOutcome,
} from '../engine'
import {
  createDefaultProgress,
  readProgress,
  recordCaseResult,
  setProgressContext,
  writeProgress,
  type BaxterCrrtProgressV3,
} from '../engine/progress'
import type { CrrtRoleLens } from '../engine/types'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtActivityWorkspace } from './CrrtActivityWorkspace'
import { CrrtCasePlayer } from './CrrtCasePlayer'
import styles from './baxter-crrt.module.css'

const capstoneCase = getBaxterCrrtCase('CRRT-16')

export function BaxterCrrtAssess({ locale = 'en' }: { readonly locale?: string }) {
  const router = useRouter()
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(createDefaultProgress)
  const [hydrated, setHydrated] = useState(false)
  const [roleLens, setRoleLens] = useState<CrrtRoleLens>('integrated')
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: capstoneCase,
      experience: 'mastery' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: baxterCrrtMasteryManifest.deviceId,
    },
    createCrrtLearningSession,
  )

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const stored = readProgress()
      setProgress(stored)
      setRoleLens(stored.lastRoleLens)
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  useEffect(() => {
    dispatch({
      type: 'LOAD_CASE',
      caseDefinition: capstoneCase,
      experience: 'mastery',
      roleLens,
      attempt: 1,
      deviceId: baxterCrrtMasteryManifest.deviceId,
    })
  }, [roleLens])

  function persist(next: BaxterCrrtProgressV3) {
    setProgress(next)
    if (hydrated) writeProgress(next)
  }

  function chooseRole(nextRole: CrrtRoleLens) {
    setRoleLens(nextRole)
    if (!hydrated) return
    persist(
      setProgressContext(progress, {
        device: baxterCrrtMasteryManifest.deviceId,
        roleLens: nextRole,
        station: 'anticoagulation-complications-liberation',
      }),
    )
  }

  function recordDebrief(outcome: CrrtLearningOutcome) {
    if (!outcome.scored || outcome.score === null) return
    persist(
      recordCaseResult(progress, {
        caseId: baxterCrrtMasteryManifest.id,
        device: baxterCrrtMasteryManifest.deviceId,
        roleLens: session.roleLens,
        pathway: 'mastery',
        score: outcome.score,
        criticalError: outcome.criticalErrorIds.length > 0,
        hintCount: session.usedHintIds.length,
        reassessmentCompleted: outcome.reassessmentComplete,
        masteryCompleted: outcome.mastery,
      }),
    )
  }

  const assessmentTaskRules = (
    <div className={styles.assessmentTaskRules}>
      <strong>Challenge flow</strong>
      <ul>
        <li>Use the five-part plan when it helps organize your working frame.</li>
        <li>Use patient, prescription, circuit, pressure, and alert cues together.</li>
        <li>Open any phase directly; unrecorded work remains visible in the causal debrief.</li>
      </ul>
      <small>Educational simulation only; not patient-specific device or treatment guidance.</small>
    </div>
  )

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/assess`} activityMode>
      <CrrtActivityWorkspace
        session={session}
        mode="challenge"
        progressLabel="Challenge · personal history stays local"
        onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
        onSaveAndExit={() => {
          writeProgress(progress)
          router.push(baxterCrrtNavBase)
        }}
        currentTaskExtras={assessmentTaskRules}
        nextRecommendation={
          session.debriefRevealed ? (
            <Link href={baxterCrrtNavBase}>Next recommended · Review CRRT history</Link>
          ) : null
        }
      >
        <section className={styles.casePlayerSection} aria-labelledby="capstone-heading">
          <div className={styles.casePlayerHeading}>
            <GraduationCap aria-hidden="true" />
            <div>
              <span>Open challenge</span>
              <h2 id="capstone-heading">{capstoneCase.title}</h2>
            </div>
          </div>
          <CrrtCasePlayer
            session={session}
            dispatch={dispatch}
            onRoleChange={chooseRole}
            onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
            onDebriefRevealed={recordDebrief}
            idNamespace="assess-prismax"
            showSharedStepper={false}
          />
        </section>
      </CrrtActivityWorkspace>
    </BaxterCrrtModuleFrame>
  )
}
