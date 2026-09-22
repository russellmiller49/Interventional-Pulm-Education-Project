'use client'

import { GraduationCap } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { getBaxterCrrtCase } from '../content/completeCases'
import { baxterCrrtMasteryManifest } from '../content/mastery'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine'
import { recordCrrtVisit } from '../selfPacedProgress'
import type { CrrtRoleLens } from '../engine/types'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtActivityWorkspace } from './CrrtActivityWorkspace'
import { CrrtCasePlayer } from './CrrtCasePlayer'
import styles from './baxter-crrt.module.css'

const capstoneCase = getBaxterCrrtCase('CRRT-16')

export function BaxterCrrtAssess({ locale = 'en' }: { readonly locale?: string }) {
  const router = useRouter()
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
      recordCrrtVisit({ section: 'assess', id: baxterCrrtMasteryManifest.id })
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  // The role lens is presentational. Reloading the capstone case for it would
  // discard the learner's run, so only the lens itself changes (X-08).
  useEffect(() => {
    dispatch({ type: 'SET_ROLE_LENS', roleLens })
  }, [roleLens])

  function chooseRole(nextRole: CrrtRoleLens) {
    setRoleLens(nextRole)
  }

  const assessmentTaskRules = (
    <div className={styles.assessmentTaskRules}>
      <strong>Challenge flow</strong>
      <ul>
        <li>Open Explain this case for a worked plan at any time.</li>
        <li>Use patient, prescription, circuit, pressure, and alert cues together.</li>
        <li>Use hints, explore the simulation, or continue without answering.</li>
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
          router.push(baxterCrrtNavBase)
        }}
        currentTaskExtras={assessmentTaskRules}
        nextRecommendation={<Link href={baxterCrrtNavBase}>Continue to CRRT topics</Link>}
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
            idNamespace="assess-prismax"
            showSharedStepper={false}
          />
        </section>
      </CrrtActivityWorkspace>
    </BaxterCrrtModuleFrame>
  )
}
