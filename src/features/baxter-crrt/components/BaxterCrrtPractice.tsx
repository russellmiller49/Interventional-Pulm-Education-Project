'use client'

import { BookOpenCheck, ChevronRight, ClipboardCheck, ShieldAlert } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
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
  type BaxterCrrtProgressStation,
  type BaxterCrrtProgressV3,
} from '../engine/progress'
import type { CrrtRoleLens } from '../engine/types'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtActivityWorkspace } from './CrrtActivityWorkspace'
import { CrrtCasePlayer } from './CrrtCasePlayer'
import { CrrtRapidDrillReview } from './CrrtRapidDrillReview'
import styles from './baxter-crrt.module.css'

const stationIdByNumber: Readonly<Record<number, BaxterCrrtProgressStation>> = {
  1: 'define-goal',
  2: 'build-prescription',
  3: 'setup-start',
  4: 'monitor-dose-fluid',
  5: 'pressures-troubleshooting',
  6: 'anticoagulation-complications-liberation',
}

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
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(createDefaultProgress)
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
      (caseId) =>
        caseId !== selectedCaseId &&
        !progress.completedPracticeCaseIds.includes(caseId.toLowerCase()),
    ) ?? null

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const stored = readProgress()
      setProgress(stored)
      setRoleLens(stored.lastRoleLens)
      setHydrated(true)
      if (validPracticeCaseId(initialCaseId)) {
        recordCriticalCareActivitySelection(window.localStorage, {
          activityId: `crrt:practice:${firstCaseId}`,
          mode: 'practice',
          query: { case: firstCaseId },
          scenarioId: firstCaseId,
          deviceId: 'prismax-aw8035-2xx',
          payloadVersion: 'crrt-selection-v1',
        })
      }
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

  function persist(next: BaxterCrrtProgressV3) {
    setProgress(next)
    if (hydrated) writeProgress(next)
  }

  function chooseCase(caseId: CrrtCaseId) {
    if (!(baxterCrrtPracticeCaseIds as readonly string[]).includes(caseId)) return
    setSelectedCaseId(caseId)
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: `crrt:practice:${caseId}`,
      mode: 'practice',
      query: { case: caseId },
      scenarioId: caseId,
      deviceId: 'prismax-aw8035-2xx',
      payloadVersion: 'crrt-selection-v1',
    })
    const entry = getBaxterCrrtCaseCatalogEntry(caseId)
    if (!hydrated) return
    persist(
      setProgressContext(progress, {
        device: 'prismax-aw8035-2xx',
        roleLens,
        station: stationIdByNumber[entry.station],
      }),
    )
  }

  function chooseRole(nextRole: CrrtRoleLens) {
    setRoleLens(nextRole)
    if (!hydrated) return
    persist(
      setProgressContext(progress, {
        device: 'prismax-aw8035-2xx',
        roleLens: nextRole,
        station: stationIdByNumber[selectedCatalogEntry.station],
      }),
    )
  }

  function recordDebrief(outcome: CrrtLearningOutcome) {
    if (!outcome.scored || outcome.score === null) return
    const next = recordCaseResult(progress, {
      caseId: session.caseDefinition.id.toLowerCase(),
      device: 'prismax-aw8035-2xx',
      roleLens: session.roleLens,
      pathway: 'practice',
      score: outcome.score,
      criticalError: outcome.criticalErrorIds.length > 0,
      hintCount: session.usedHintIds.length,
      reassessmentCompleted: outcome.reassessmentComplete,
      masteryCompleted: false,
    })
    persist(
      setProgressContext(next, {
        device: 'prismax-aw8035-2xx',
        roleLens: session.roleLens,
        station: stationIdByNumber[selectedCatalogEntry.station],
      }),
    )
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
        progressLabel={`${progress.completedPracticeCaseIds.length}/${baxterCrrtCoreCaseIds.length} core cases complete · ${selectedCatalogEntry.title}`}
        resumed={validPracticeCaseId(initialCaseId)}
        onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
        onSaveAndExit={() => {
          writeProgress(progress)
          router.push(baxterCrrtNavBase)
        }}
        nextRecommendation={
          nextRecommendedCase ? (
            <Link
              href={{
                pathname: `${baxterCrrtNavBase}/practice`,
                query: { case: nextRecommendedCase },
              }}
            >
              Next recommended · {nextRecommendedCase}
            </Link>
          ) : null
        }
      >
        <header className={styles.sectionHero}>
          <span className={styles.kicker}>Practice · scored simulation</span>
          <h1>Commit a plan, run the case, reassess, and debrief</h1>
          <p>
            The ten-case core path covers all six stations. Seven additional cases stay available
            for deeper practice; the unseen CRRT-16 capstone is excluded from every picker.
          </p>
        </header>

        <section
          className={styles.practicePicker}
          aria-labelledby="practice-picker-heading"
          data-hydrated={hydrated}
        >
          <div>
            <span className={styles.kicker}>Core path</span>
            <h2 id="practice-picker-heading">Choose a station-grouped case</h2>
          </div>
          <label>
            <span>Core case</span>
            <select
              aria-label="Station-grouped core case"
              value={selectedCaseId}
              onChange={(event) => chooseCase(event.target.value as CrrtCaseId)}
            >
              {selectedIsAdditional ? (
                <option value={selectedCaseId}>
                  Optional · {selectedCaseId} · {selectedCatalogEntry.title}
                </option>
              ) : null}
              {baxterCrrtCurriculum.map((unit) => (
                <optgroup key={unit.id} label={`${unit.station}. ${unit.title}`}>
                  {unit.coreCaseIds.map((caseId) => {
                    const entry = getBaxterCrrtCaseCatalogEntry(caseId)
                    const complete = progress.completedPracticeCaseIds.includes(
                      caseId.toLowerCase(),
                    )
                    return (
                      <option key={caseId} value={caseId}>
                        {complete ? '✓ ' : ''}
                        {caseId} · {entry.title}
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
                        <strong>
                          {caseId} · {entry.title}
                        </strong>
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
        </section>

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
            onDebriefRevealed={recordDebrief}
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
