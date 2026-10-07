'use client'

import { ClipboardCheck, ShieldAlert } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { getBaxterCrrtCase } from '../content/completeCases'
import {
  baxterCrrtAdditionalCaseIds,
  baxterCrrtCoreCaseIds,
  baxterCrrtPracticeCaseIds,
  getBaxterCrrtCaseCatalogEntry,
} from '../content/curriculum'
import type { CrrtCaseId } from '../content/schema'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine'
import { crrtCaseReuseNote } from '../caseReuse'
import { readCrrtSelfPacedProgress, recordCrrtVisit } from '../selfPacedProgress'
import type { CrrtRoleLens } from '../engine/types'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtActivityWorkspace } from './CrrtActivityWorkspace'
import { CrrtCaseNavigator } from './CrrtCaseNavigator'
import { CrrtCasePlayer } from './CrrtCasePlayer'
import { CrrtRapidDrillReview } from './CrrtRapidDrillReview'
import styles from './baxter-crrt.module.css'

function validPracticeCaseId(value: string | undefined): value is CrrtCaseId {
  return value !== undefined && (baxterCrrtPracticeCaseIds as readonly string[]).includes(value)
}

/**
 * One validated case identity for the URL, the rendered case, the session and
 * the visit record. An unknown or missing `?case=` falls back to the first core
 * case rather than mixing a requested title with another case's data.
 */
function resolvePracticeCaseId(requested: string | undefined): CrrtCaseId {
  return validPracticeCaseId(requested) ? requested : baxterCrrtCoreCaseIds[0]
}

export function BaxterCrrtPractice({
  locale = 'en',
  initialCaseId,
}: {
  readonly locale?: string
  readonly initialCaseId?: string
}) {
  const router = useRouter()
  const routeCaseId = resolvePracticeCaseId(initialCaseId)
  const requestedCaseUnavailable =
    initialCaseId !== undefined && !validPracticeCaseId(initialCaseId)
  const selectedCaseId = routeCaseId
  const [roleLens, setRoleLens] = useState<CrrtRoleLens>('integrated')
  const [progress, setProgress] = useState(() => readCrrtSelfPacedProgress(null))
  const [hydrated, setHydrated] = useState(false)
  // The case whose earlier visit this page load found in local history. "Return to saved case"
  // is shown only for a case the learner had really opened before, not for every `?case=` link.
  const [returningCaseId, setReturningCaseId] = useState<CrrtCaseId | null>(null)
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: getBaxterCrrtCase(routeCaseId),
      experience: 'practice' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )

  // Render and load only the committed route identity. An optimistic local
  // selection can finish before router.push updates the URL; a reload in that
  // interval would reopen the previous case despite showing the new case.
  // Same-case query updates leave the current run intact.
  const selectedDefinition = getBaxterCrrtCase(selectedCaseId)
  const selectedCatalogEntry = getBaxterCrrtCaseCatalogEntry(selectedCaseId)
  const selectedIsAdditional = baxterCrrtAdditionalCaseIds.includes(selectedCaseId)
  const caseReuseNote = crrtCaseReuseNote(selectedCaseId)
  const nextRecommendedCase =
    baxterCrrtCoreCaseIds.find(
      (caseId) => caseId !== selectedCaseId && !progress.visitedCaseIds.includes(caseId),
    ) ?? null

  // The visit record follows the case actually shown, so an unrelated query
  // update cannot record a visit for a case the learner never saw.
  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const before = readCrrtSelfPacedProgress()
      setReturningCaseId(before.visitedCaseIds.includes(selectedCaseId) ? selectedCaseId : null)
      recordCrrtVisit({ section: 'practice', id: selectedCaseId })
      const stored = readCrrtSelfPacedProgress()
      setProgress(stored)
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [selectedCaseId])

  // `getBaxterCrrtCase` returns one frozen definition per ID, so this fires
  // exactly once per real case change and never on a role change or re-render.
  useEffect(() => {
    dispatch({
      type: 'LOAD_CASE',
      caseDefinition: selectedDefinition,
      experience: 'practice',
      roleLens,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx',
    })
    // The role lens is applied through SET_ROLE_LENS below; reloading the case
    // for a presentational change would discard the run (X-08).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDefinition])

  useEffect(() => {
    dispatch({ type: 'SET_ROLE_LENS', roleLens })
  }, [roleLens])

  function chooseCase(caseId: CrrtCaseId) {
    if (!(baxterCrrtPracticeCaseIds as readonly string[]).includes(caseId)) return
    if (caseId === selectedCaseId) return
    // The new heading, session and visit appear together once this navigation
    // commits, so the visible case is already shareable and reloadable.
    router.push({ pathname: `${baxterCrrtNavBase}/practice`, query: { case: caseId } })
  }

  function chooseRole(nextRole: CrrtRoleLens) {
    setRoleLens(nextRole)
  }

  return (
    <BaxterCrrtModuleFrame
      locale={locale}
      activeHref={`${baxterCrrtNavBase}/practice`}
      activityMode
    >
      <CrrtActivityWorkspace
        session={session}
        mode="practice"
        progressLabel={`Practice case · ${selectedCatalogEntry.title} · personal history stays local`}
        resumed={returningCaseId === selectedCaseId}
        onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
        onSaveAndExit={() => {
          router.push(baxterCrrtNavBase)
        }}
        navigation={
          <CrrtCaseNavigator
            caseId={selectedCaseId}
            visitedCaseIds={hydrated ? progress.visitedCaseIds : []}
            onChoose={chooseCase}
            notice={
              requestedCaseUnavailable ? (
                <p role="status" aria-label="Requested practice case unavailable">
                  That practice case link is not available, so {selectedCatalogEntry.title} is open
                  instead. Choose a case below to change it.
                </p>
              ) : null
            }
            recommendation={
              nextRecommendedCase ? (
                <Link
                  href={{
                    pathname: `${baxterCrrtNavBase}/practice`,
                    query: { case: nextRecommendedCase },
                  }}
                >
                  Next recommended · {getBaxterCrrtCaseCatalogEntry(nextRecommendedCase).title}
                </Link>
              ) : null
            }
          />
        }
      >
        <section className={styles.casePlayerSection} aria-labelledby="practice-case-heading">
          <div className={styles.casePlayerHeading}>
            <ClipboardCheck aria-hidden="true" />
            <div>
              <span>
                {selectedIsAdditional
                  ? 'Additional practice'
                  : `Core station ${selectedCatalogEntry.station}`}
              </span>
              <h2 id="practice-case-heading">{selectedCatalogEntry.title}</h2>
              {caseReuseNote ? (
                <p className={styles.caseReuseNote} data-crrt-case-reuse>
                  {caseReuseNote}
                </p>
              ) : null}
            </div>
          </div>
          <CrrtCasePlayer
            session={session}
            dispatch={dispatch}
            onRoleChange={chooseRole}
            onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
            idNamespace="practice-prismax"
            showSharedStepper={false}
          />
        </section>

        <section className={styles.drillStrip} aria-labelledby="safety-drills-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>
                Five worked safety examples · optional try first
              </span>
              <h2 id="safety-drills-heading">Safety drills</h2>
            </div>
            <ShieldAlert aria-hidden="true" />
          </div>
          <CrrtRapidDrillReview />
        </section>
      </CrrtActivityWorkspace>
    </BaxterCrrtModuleFrame>
  )
}
