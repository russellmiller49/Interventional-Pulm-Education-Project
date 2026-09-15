'use client'

import { BookOpenCheck, ChevronRight, ClipboardCheck, ShieldAlert } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { getBaxterCrrtCase } from '../content/completeCases'
import {
  baxterCrrtAdditionalCaseIds,
  baxterCrrtCoreCaseIds,
  baxterCrrtCurriculum,
  baxterCrrtPracticeCaseIds,
  getBaxterCrrtCaseCatalogEntry,
} from '../content/curriculum'
import type { CrrtCaseId } from '../content/schema'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine'
import { readCrrtSelfPacedProgress, recordCrrtVisit } from '../selfPacedProgress'
import type { CrrtRoleLens } from '../engine/types'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtActivityWorkspace } from './CrrtActivityWorkspace'
import { CrrtCasePlayer } from './CrrtCasePlayer'
import { CrrtRapidDrillReview } from './CrrtRapidDrillReview'
import styles from './baxter-crrt.module.css'

function validPracticeCaseId(value: string | undefined): value is CrrtCaseId {
  return value !== undefined && (baxterCrrtPracticeCaseIds as readonly string[]).includes(value)
}

export function BaxterCrrtPractice({
  locale = 'en',
  initialCaseId,
}: {
  readonly locale?: string
  readonly initialCaseId?: string
}) {
  const router = useRouter()
  const firstCaseId = validPracticeCaseId(initialCaseId) ? initialCaseId : baxterCrrtCoreCaseIds[0]
  const [selectedCaseId, setSelectedCaseId] = useState<CrrtCaseId>(firstCaseId)
  const [roleLens, setRoleLens] = useState<CrrtRoleLens>('integrated')
  const [progress, setProgress] = useState(() => readCrrtSelfPacedProgress(null))
  const [hydrated, setHydrated] = useState(false)
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: getBaxterCrrtCase(firstCaseId),
      experience: 'practice' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )

  const selectedDefinition = getBaxterCrrtCase(selectedCaseId)
  const selectedCatalogEntry = getBaxterCrrtCaseCatalogEntry(selectedCaseId)
  const selectedIsAdditional = baxterCrrtAdditionalCaseIds.includes(selectedCaseId)
  const nextRecommendedCase =
    baxterCrrtCoreCaseIds.find(
      (caseId) => caseId !== selectedCaseId && !progress.visitedCaseIds.includes(caseId),
    ) ?? null

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      recordCrrtVisit({ section: 'practice', id: firstCaseId })
      const stored = readCrrtSelfPacedProgress()
      setProgress(stored)
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [firstCaseId, initialCaseId])

  useEffect(() => {
    dispatch({
      type: 'LOAD_CASE',
      caseDefinition: selectedDefinition,
      experience: 'practice',
      roleLens,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx',
    })
  }, [roleLens, selectedDefinition])

  function chooseCase(caseId: CrrtCaseId) {
    if (!(baxterCrrtPracticeCaseIds as readonly string[]).includes(caseId)) return
    setSelectedCaseId(caseId)

    recordCrrtVisit({ section: 'practice', id: caseId })
    setProgress(readCrrtSelfPacedProgress())
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
        resumed={validPracticeCaseId(initialCaseId)}
        onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
        onSaveAndExit={() => {
          router.push(baxterCrrtNavBase)
        }}
        currentTaskExtras={
          <div className={styles.workspaceCasePicker} data-hydrated={hydrated}>
            <label>
              <span>Practice case</span>
              <select
                aria-label="Station-grouped core case"
                value={selectedCaseId}
                onChange={(event) => chooseCase(event.target.value as CrrtCaseId)}
              >
                {selectedIsAdditional ? (
                  <option value={selectedCaseId}>Optional · {selectedCatalogEntry.title}</option>
                ) : null}
                {baxterCrrtCurriculum.map((unit) => (
                  <optgroup key={unit.id} label={`${unit.station}. ${unit.title}`}>
                    {unit.coreCaseIds.map((caseId) => {
                      const entry = getBaxterCrrtCaseCatalogEntry(caseId)
                      const complete = progress.visitedCaseIds.includes(caseId)
                      return (
                        <option key={caseId} value={caseId}>
                          {complete ? 'Visited · ' : ''}
                          {entry.title}
                        </option>
                      )
                    })}
                  </optgroup>
                ))}
              </select>
            </label>
            <details className={styles.additionalCases}>
              <summary>
                <BookOpenCheck aria-hidden="true" /> Additional cases (
                {baxterCrrtAdditionalCaseIds.length})
              </summary>
              <div>
                {baxterCrrtCurriculum.flatMap((unit) =>
                  unit.additionalCaseIds.map((caseId) => {
                    const entry = getBaxterCrrtCaseCatalogEntry(caseId)
                    return (
                      <button key={caseId} type="button" onClick={() => chooseCase(caseId)}>
                        <span>
                          <strong>{entry.title}</strong>
                          <small>
                            Station {unit.station} · {entry.focus}
                          </small>
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    )
                  }),
                )}
              </div>
            </details>
          </div>
        }
        nextRecommendation={
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
              <span className={styles.kicker}>Five focused rehearsals</span>
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
