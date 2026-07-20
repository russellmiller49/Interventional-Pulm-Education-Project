'use client'

import { CheckCircle2, GraduationCap, Lock, ShieldCheck } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { getBaxterCrrtCase } from '../content/completeCases'
import {
  getBaxterCrrtCaseCatalogEntry,
  isCrrtCapstoneUnlocked,
  remainingCrrtCoreCaseIds,
} from '../content/curriculum'
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
import { CrrtCasePlayer } from './CrrtCasePlayer'
import styles from './baxter-crrt.module.css'

const capstoneCase = getBaxterCrrtCase('CRRT-16')

export function BaxterCrrtAssess({ locale = 'en' }: { readonly locale?: string }) {
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

  const unlocked = hydrated && isCrrtCapstoneUnlocked(progress)
  const remainingCases = remainingCrrtCoreCaseIds(progress)
  const completed = progress.completedMasteryCapstoneIds.includes(baxterCrrtMasteryManifest.id)

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
    if (!unlocked || !outcome.scored || outcome.score === null) return
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

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/assess`}>
      <header className={styles.sectionHero}>
        <span className={styles.kicker}>Assess · masked capstone</span>
        <h1>Prove the full reasoning loop in an unseen case</h1>
        <p>
          The assessment unlocks after all ten core Practice cases. It uses PrisMax, provides no
          hints, and keeps the case identity masked until debrief.
        </p>
      </header>

      <section className={styles.assessmentRules} aria-labelledby="assessment-rules-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2 id="assessment-rules-heading">Passing rules</h2>
          <ul>
            <li>Score at least {baxterCrrtMasteryManifest.minimumScore}/100</li>
            <li>No hints</li>
            <li>No critical error</li>
            <li>Complete the required reassessment</li>
          </ul>
          <p>
            Educational completion only—this is not certification or proof of clinical competency.
          </p>
        </div>
        {completed ? (
          <span className={styles.completedBadge}>
            <CheckCircle2 aria-hidden="true" /> Capstone completed
          </span>
        ) : null}
      </section>

      {!hydrated ? (
        <div className={styles.assessmentGate} role="status">
          Checking core-path progress…
        </div>
      ) : !unlocked ? (
        <section className={styles.assessmentGate} aria-labelledby="assessment-locked-heading">
          <Lock aria-hidden="true" />
          <div>
            <span>Capstone locked</span>
            <h2 id="assessment-locked-heading">
              Complete {remainingCases.length} remaining core{' '}
              {remainingCases.length === 1 ? 'case' : 'cases'}
            </h2>
            <p>Optional cases and safety drills do not block the assessment.</p>
            <ul>
              {remainingCases.map((caseId) => {
                const entry = getBaxterCrrtCaseCatalogEntry(caseId)
                return (
                  <li key={caseId}>
                    <Link
                      href={{
                        pathname: `${baxterCrrtNavBase}/practice`,
                        query: { case: caseId },
                      }}
                    >
                      {caseId} · {entry.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      ) : (
        <section className={styles.casePlayerSection} aria-labelledby="capstone-heading">
          <div className={styles.casePlayerHeading}>
            <GraduationCap aria-hidden="true" />
            <div>
              <span>Unlocked assessment</span>
              <h2 id="capstone-heading">{baxterCrrtMasteryManifest.learnerTitleBeforeDebrief}</h2>
            </div>
          </div>
          <CrrtCasePlayer
            session={session}
            dispatch={dispatch}
            onRoleChange={chooseRole}
            onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
            onDebriefRevealed={recordDebrief}
            idNamespace="assess-prismax"
          />
        </section>
      )}
    </BaxterCrrtModuleFrame>
  )
}
