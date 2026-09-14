'use client'

import { BookOpenCheck, Check, FlaskConical, Gauge, Layers3 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
import {
  criticalCareActivityPhases,
  useCriticalCareActivityAnalytics,
  type ClinicalLearningItem,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import {
  PathwayNav,
  PathwaySectionCompletion,
  nextPathwaySection,
} from '@/features/learning-module/curriculum'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { baxterCrrtCurriculum } from '../content/curriculum'
import { getBaxterCrrtDeviceProfile } from '../content/deviceProfiles'
import { baxterCrrtLessonClinicalAnchors } from '../content/lessonClinicalAnchors'
import { nextRecommendedCrrtActivity } from '../content/curriculum'
import {
  baxterCrrtLearnLessonById,
  baxterCrrtPriorPlatformAdvancedBlock,
} from '../content/learnLessons'
import type { BaxterCrrtLearnLessonId } from '../content/learnerRegistry'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import {
  createDefaultProgress,
  readProgress,
  recordLessonCompletion,
  setProgressContext,
  writeProgress,
  type BaxterCrrtProgressStation,
  type BaxterCrrtProgressV3,
} from '../engine/progress'
import { crrtLearnTasks } from '../content/learnTasks'
import { CrrtFoundationLesson } from './CrrtFoundationLesson'
import { BaxterCrrtLearnLanding } from './BaxterCrrtLearnLanding'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtCitrateDifferential } from './CrrtCitrateDifferential'
import { CrrtLivePressureStation } from './CrrtLivePressureStation'
import { CrrtStagedPrescriptionBuilder } from './CrrtStagedPrescriptionBuilder'
import { CrrtPressureLocalizationLab } from './CrrtPressureLocalizationLab'
import styles from './baxter-crrt.module.css'

const stationIdByNumber: Readonly<Record<number, BaxterCrrtProgressStation>> = {
  1: 'define-goal',
  2: 'build-prescription',
  3: 'setup-start',
  4: 'monitor-dose-fluid',
  5: 'pressures-troubleshooting',
  6: 'anticoagulation-complications-liberation',
}

const prismaxReferenceProfile = getBaxterCrrtDeviceProfile('prismax-aw8035-2xx')

const crrtLearningPathway = criticalCareLearningPathway('baxter-crrt')

// Resolves against all three registries, not two. The device-math registry
// holds MATH-PM-002 and FLUID-PM-002, which are cited by lessons and by the
// circuit but used to resolve nowhere and disappear without a warning.
const crrtSourceById = baxterCrrtLearnerFacingSourceById

function validLessonId(value: string | undefined): value is BaxterCrrtLearnLessonId {
  return value !== undefined && baxterCrrtLearnLessonById.has(value as BaxterCrrtLearnLessonId)
}

function requireLesson(lessonId: BaxterCrrtLearnLessonId) {
  const item = baxterCrrtLearnLessonById.get(lessonId)
  if (!item) throw new Error(`Unknown CRRT Learn lesson: ${lessonId}`)
  return item
}

function stationForLesson(lessonId: BaxterCrrtLearnLessonId): BaxterCrrtProgressStation {
  const unit = baxterCrrtCurriculum.find((candidate) => candidate.lessonIds.includes(lessonId))
  return unit ? stationIdByNumber[unit.station] : 'orientation'
}

function sectionIndex(lessonId: BaxterCrrtLearnLessonId): number {
  return crrtLearningPathway.sections.findIndex((section) => section.id === lessonId)
}

function ClinicalApplicationCheck({
  item,
  selectedChoiceId,
  submittedChoiceId,
  onSelect,
  onSubmit,
  onRevise,
  onReview,
}: {
  readonly item: ClinicalLearningItem
  readonly selectedChoiceId: string | null
  readonly submittedChoiceId: string | null
  readonly onSelect: (choiceId: string) => void
  readonly onSubmit: () => void
  readonly onRevise: () => void
  readonly onReview: () => void
}) {
  const submittedChoice = item.choices.find((choice) => choice.id === submittedChoiceId)
  const conceptIds = criticalCareActivityById.get(item.activityId)?.assumedConceptIds ?? []

  return (
    <section className={styles.clinicalApplication} aria-labelledby="crrt-application-heading">
      <header>
        <span>Clinical application</span>
        <h3 id="crrt-application-heading">Apply the lesson to this patient</h3>
      </header>
      <fieldset disabled={submittedChoiceId !== null}>
        <legend>{item.stem}</legend>
        <div>
          {item.choices.map((choice) => (
            <label key={choice.id} data-selected={selectedChoiceId === choice.id}>
              <input
                type="radio"
                name={item.id}
                checked={selectedChoiceId === choice.id}
                onChange={() => onSelect(choice.id)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {submittedChoice ? (
        <div className={styles.applicationFeedback}>
          <ChoiceReasoningFeedback
            choice={submittedChoice}
            explanation={item.explanation}
            evidenceIds={item.evidenceIds}
            conceptIds={conceptIds}
          />
          <button type="button" onClick={onReview}>
            Review feedback
          </button>
          <button type="button" onClick={onRevise}>
            Try another frame
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.applicationSubmit}
          disabled={selectedChoiceId === null}
          onClick={onSubmit}
        >
          Check clinical reasoning
        </button>
      )}
    </section>
  )
}

export function BaxterCrrtLearn({
  locale = 'en',
  initialLessonId,
}: {
  readonly locale?: string
  readonly initialLessonId?: string
}) {
  const [selection, setSelection] = useState(() => ({
    lessonId: validLessonId(initialLessonId) ? initialLessonId : null,
    revision: 0,
  }))
  const transition = useCallback((lessonId: BaxterCrrtLearnLessonId | null) => {
    setSelection((current) => ({ lessonId, revision: current.revision + 1 }))
    if (lessonId)
      recordCriticalCareActivitySelection(window.localStorage, {
        activityId: `crrt:learn:${lessonId}`,
        mode: 'guided',
        query: { lesson: lessonId },
        payloadVersion: 'crrt-selection-v1',
      })
  }, [])
  useEffect(() => {
    const restore = () => {
      const id = new URL(window.location.href).searchParams.get('lesson') ?? undefined
      transition(validLessonId(id) ? id : null)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [transition])
  const previousProp = useRef(initialLessonId)
  useEffect(() => {
    if (previousProp.current === initialLessonId) return
    previousProp.current = initialLessonId
    const timer = window.setTimeout(
      () => transition(validLessonId(initialLessonId) ? initialLessonId : null),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [initialLessonId, transition])
  function navigate(lessonId: BaxterCrrtLearnLessonId) {
    const url = new URL(window.location.href)
    url.searchParams.set('lesson', lessonId)
    window.history.pushState({}, '', `${url.pathname}${url.search}`)
    transition(lessonId)
  }
  if (!selection.lessonId)
    return (
      <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/learn`}>
        <BaxterCrrtLearnLanding />
      </BaxterCrrtModuleFrame>
    )
  const key = `${selection.lessonId}:${selection.revision}`
  if (crrtLearnTasks[selection.lessonId])
    return (
      <BaxterCrrtModuleFrame
        locale={locale}
        activeHref={`${baxterCrrtNavBase}/learn`}
        activityMode
        focusedLesson
      >
        <CrrtFoundationLesson
          key={key}
          lessonId={selection.lessonId}
          onNavigate={navigate}
          onRestart={() => transition(selection.lessonId)}
        />
      </BaxterCrrtModuleFrame>
    )
  return (
    <BaxterCrrtLearnWorkbench
      key={key}
      locale={locale}
      initialLessonId={selection.lessonId}
      onNavigate={navigate}
    />
  )
}

function BaxterCrrtLearnWorkbench({
  locale,
  initialLessonId,
  onNavigate,
}: {
  readonly locale: string
  readonly initialLessonId: BaxterCrrtLearnLessonId
  readonly onNavigate: (id: BaxterCrrtLearnLessonId) => void
}) {
  const router = useRouter()
  const initialId = initialLessonId
  const selectedLessonId = initialId
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(createDefaultProgress)
  const [hydrated, setHydrated] = useState(false)
  const [lessonAttempt, setLessonAttempt] = useState(1)
  const [helpVisible, setHelpVisible] = useState(false)
  const [lessonPhase, setLessonPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [submittedChoiceId, setSubmittedChoiceId] = useState<string | null>(null)
  const [labEvidenceMet, setLabEvidenceMet] = useState(false)
  const [applicationReviewed, setApplicationReviewed] = useState(false)
  const completionRecorded = useRef(new Set<BaxterCrrtLearnLessonId>())

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setProgress(readProgress())
      setHydrated(true)
      if (validLessonId(initialLessonId)) {
        recordCriticalCareActivitySelection(window.localStorage, {
          activityId: `crrt:learn:${initialId}`,
          mode: 'guided',
          query: { lesson: initialId },
          payloadVersion: 'crrt-selection-v1',
        })
      }
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [initialId, initialLessonId])

  const selectedLesson = requireLesson(selectedLessonId)
  const clinicalAnchor = baxterCrrtLessonClinicalAnchors[selectedLesson.id]
  const complete = progress.completedLessonIds.includes(selectedLesson.id)
  const evidenceEntries = selectedLesson.sourceRecordIds.flatMap((sourceId) => {
    const source = crrtSourceById.get(sourceId)
    return source
      ? [
          {
            id: source.id,
            title: source.sourceTitle,
            sourceLabel: `${source.documentVersion} · ${source.pageOrSection}`,
            limitation: String(
              source.value ?? 'Use only within the authored educational source scope.',
            ),
          },
        ]
      : []
  })
  const sourceTitles = [...new Set(evidenceEntries.map((entry) => entry.title))]
  const applicationSubmitted = submittedChoiceId !== null
  const completionEvidenceMet =
    applicationReviewed && (selectedLesson.embeddedLabId === undefined || labEvidenceMet)
  // One recommender, shared with the hub. The pathway supplies the sequence; this supplies the
  // suggestion. They can no longer disagree about lesson order because both read the pathway.
  const recommendation = nextRecommendedCrrtActivity({
    completedLessonIds: progress.completedLessonIds,
    completedPracticeCaseIds: progress.completedPracticeCaseIds,
  })
  const recommendedLesson =
    recommendation?.kind === 'lesson' && recommendation.id !== selectedLesson.id
      ? baxterCrrtLearnLessonById.get(recommendation.id)
      : undefined
  const nextSection = nextPathwaySection(crrtLearningPathway, selectedLesson.id)
  const progressLabel = `Current lesson · ${selectedLesson.title} · personal history stays local`
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'baxter-crrt',
    activityId: `crrt:learn:${selectedLesson.id}`,
    mode: 'guided',
    phase: lessonPhase,
    enabled: hydrated,
  })

  function advanceLessonPhase(nextPhase: CriticalCareActivityPhase) {
    setLessonPhase((current) =>
      criticalCareActivityPhases.indexOf(nextPhase) > criticalCareActivityPhases.indexOf(current)
        ? nextPhase
        : current,
    )
  }

  function recordCompletionIfReady(nextApplicationSubmitted: boolean, nextLabEvidenceMet: boolean) {
    if (
      !nextApplicationSubmitted ||
      (selectedLesson.embeddedLabId !== undefined && !nextLabEvidenceMet) ||
      completionRecorded.current.has(selectedLesson.id)
    ) {
      return
    }

    const currentProgress = readProgress()
    if (currentProgress.completedLessonIds.includes(selectedLesson.id)) {
      setProgress(currentProgress)
      return
    }

    completionRecorded.current.add(selectedLesson.id)
    const withContext = setProgressContext(currentProgress, {
      device: 'prismax-aw8035-2xx',
      roleLens: currentProgress.lastRoleLens,
      station: stationForLesson(selectedLesson.id),
    })
    const next = recordLessonCompletion(withContext, selectedLesson.id)
    setProgress(next)
    writeProgress(next)
    advanceLessonPhase('explain')
    lifecycleAnalytics.recordGoalMet()
    lifecycleAnalytics.recordActivityCompleted()
  }

  function selectLesson(lessonId: BaxterCrrtLearnLessonId) {
    onNavigate(lessonId)
  }

  function showHelp() {
    if (!helpVisible) lifecycleAnalytics.recordHintUsed()
    setHelpVisible(true)
  }

  function selectApplicationChoice(choiceId: string) {
    setSelectedChoiceId(choiceId)
    advanceLessonPhase('predict')
  }

  function submitApplication() {
    if (selectedChoiceId === null || submittedChoiceId !== null) return
    setSubmittedChoiceId(selectedChoiceId)
    advanceLessonPhase('observe')
    lifecycleAnalytics.recordPredictionSubmitted()
  }

  function recordLabCompletionEvidence() {
    setLabEvidenceMet(true)
    recordCompletionIfReady(applicationReviewed, true)
  }

  function resetLessonWork() {
    setLessonAttempt((attempt) => attempt + 1)
    setLessonPhase('recognize')
    setSelectedChoiceId(null)
    setSubmittedChoiceId(null)
    setLabEvidenceMet(false)
    setApplicationReviewed(false)
  }

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/learn`} activityMode>
      <ActivityShell
        layout="didactic-lesson"
        activityId={clinicalAnchor.applicationItem.activityId}
        assumedConceptIds={
          criticalCareActivityById.get(clinicalAnchor.applicationItem.activityId)?.assumedConceptIds
        }
        breadcrumb={
          <>
            <Link href={baxterCrrtNavBase}>CRRT</Link>
            {' / '}learn
          </>
        }
        activityTitle={selectedLesson.title}
        phase={lessonPhase}
        mode="guided"
        progressLabel={progressLabel}
        stepperAriaLabel="CRRT shared activity phases"
        onPhaseSelect={(phase) => {
          setLessonPhase(phase)
          document
            .getElementById(
              phase === 'recognize'
                ? 'clinical-anchor-heading'
                : phase === 'predict' || phase === 'observe'
                  ? 'crrt-application-heading'
                  : 'crrt-learn-viewport',
            )
            ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
        }}
        theme="dark"
        patientContext={
          <>
            <PatientContextBar
              title={clinicalAnchor.title}
              items={[
                { label: 'Device', value: prismaxReferenceProfile.displayName },
                ...clinicalAnchor.contextItems,
              ]}
              immediateGoal={clinicalAnchor.immediateGoal}
              safetyConstraints={[
                'Educational model only; verify current manufacturer instructions and local policy.',
                'Displayed values and device responses are synthetic teaching examples.',
              ]}
            />
            <p>
              This visit starts a new exercise. Prior completion is retained; prior answers and lab
              state are not replayed.
            </p>
          </>
        }
        currentTask={
          <>
            <TaskPanel
              objective={clinicalAnchor.immediateGoal}
              requiredAction={
                clinicalAnchor.labEvidenceLabel
                  ? `${clinicalAnchor.labEvidenceLabel} Then answer the patient application check. Review the application feedback to record worked-through completion.`
                  : 'Answer the patient application check. Review the feedback to record worked-through completion.'
              }
              targets={selectedLesson.bullets?.slice(0, 4) ?? []}
              hint={selectedLesson.paragraphs?.[0]}
              mode="guided"
              hintVisible={helpVisible}
              onHintRequested={showHelp}
            />
            {completionEvidenceMet ? (
              <PathwaySectionCompletion
                sectionTitle={selectedLesson.title}
                {...(nextSection ? { nextTitle: nextSection.title } : {})}
                endOfPathwayLabel="Continue to CRRT practice cases"
                onRepeat={resetLessonWork}
                onContinue={() => {
                  if (nextSection) {
                    selectLesson(nextSection.id as BaxterCrrtLearnLessonId)
                    return
                  }
                  router.push(`${baxterCrrtNavBase}/practice`)
                }}
              />
            ) : null}
          </>
        }
        onHelp={showHelp}
        onReset={resetLessonWork}
        onSaveAndExit={() => {
          writeProgress(progress)
          router.push(baxterCrrtNavBase)
        }}
        bottomContent={progressLabel}
        secondaryActions={
          <>
            <ReferenceDrawer
              entries={[
                {
                  id: selectedLesson.id,
                  title: selectedLesson.title,
                  summary: selectedLesson.summary,
                  meta: sourceTitles.join(' · '),
                },
              ]}
              trigger={<button type="button">Reference</button>}
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={<button type="button">Evidence</button>}
            />
            {recommendedLesson ? (
              <Link
                href={{
                  pathname: `${baxterCrrtNavBase}/learn`,
                  query: { lesson: recommendedLesson.id },
                }}
              >
                Next recommended · {recommendedLesson.title}
              </Link>
            ) : null}
          </>
        }
        viewport={
          <div
            key={`${selectedLesson.id}:${lessonAttempt}`}
            id="crrt-learn-viewport"
            className={styles.activityViewport}
            tabIndex={-1}
          >
            <div className={styles.lessonDocument} data-hydrated={hydrated}>
              <PathwayNav
                pathway={crrtLearningPathway}
                label="CRRT learning pathway"
                activeSectionId={selectedLesson.id}
                onSelect={(sectionId) => selectLesson(sectionId as BaxterCrrtLearnLessonId)}
              />

              <article className={styles.lessonArticle} aria-labelledby="crrt-lesson-title">
                <header>
                  <span>
                    Section {sectionIndex(selectedLesson.id) + 1} of{' '}
                    {crrtLearningPathway.sections.length}
                  </span>
                  <h2 id="crrt-lesson-title">{selectedLesson.title}</h2>
                  <p>{selectedLesson.summary}</p>
                </header>

                <section
                  className={styles.clinicalAnchor}
                  aria-labelledby="clinical-anchor-heading"
                >
                  <span>Clinical anchor</span>
                  <h3 id="clinical-anchor-heading">{clinicalAnchor.title}</h3>
                  <dl>
                    {clinicalAnchor.contextItems.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>
                    <strong>Immediate goal:</strong> {clinicalAnchor.immediateGoal}
                  </p>
                </section>

                {selectedLesson.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {selectedLesson.bullets ? (
                  <ul>
                    {selectedLesson.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}

                {selectedLesson.id === 'crrt-prescription-dosing' ? (
                  <section
                    className={styles.embeddedLab}
                    aria-labelledby="prescription-lab-heading"
                  >
                    <div className={styles.embeddedLabHeading}>
                      <FlaskConical aria-hidden="true" />
                      <div>
                        <span>Embedded concept lab</span>
                        <h3 id="prescription-lab-heading">Staged Prescription Builder</h3>
                      </div>
                    </div>
                    <CrrtStagedPrescriptionBuilder
                      onPhaseChange={advanceLessonPhase}
                      onCompletionEvidence={recordLabCompletionEvidence}
                    />
                  </section>
                ) : null}

                {selectedLesson.id === 'crrt-anticoagulation' ? (
                  <section className={styles.embeddedLab} aria-labelledby="citrate-section-heading">
                    <div className={styles.embeddedLabHeading}>
                      <Layers3 aria-hidden="true" />
                      <div>
                        <span>Mechanism and comparison</span>
                        <h3 id="citrate-section-heading">Citrate and calcium</h3>
                      </div>
                    </div>
                    <CrrtCitrateDifferential />
                  </section>
                ) : null}

                {selectedLesson.id === 'crrt-circuit-pressures' ? (
                  <>
                    <section
                      className={styles.embeddedLab}
                      aria-labelledby="crrt-live-pressure-heading"
                    >
                      <div className={styles.embeddedLabHeading}>
                        <Gauge aria-hidden="true" />
                        <div>
                          <span>Read the pressure pattern</span>
                          <h3 id="crrt-live-pressure-heading">Live pressure profile</h3>
                        </div>
                      </div>
                      <CrrtLivePressureStation />
                    </section>
                    <section className={styles.embeddedLab} aria-labelledby="pressure-lab-heading">
                      <div className={styles.embeddedLabHeading}>
                        <FlaskConical aria-hidden="true" />
                        <div>
                          <span>Embedded concept lab</span>
                          <h3 id="pressure-lab-heading">Pressure Localization Lab</h3>
                        </div>
                      </div>
                      <CrrtPressureLocalizationLab
                        onPhaseChange={advanceLessonPhase}
                        onPredictionCommitted={lifecycleAnalytics.recordPredictionSubmitted}
                        onCompletionEvidence={recordLabCompletionEvidence}
                      />
                    </section>
                  </>
                ) : null}

                <ClinicalApplicationCheck
                  item={clinicalAnchor.applicationItem}
                  selectedChoiceId={selectedChoiceId}
                  submittedChoiceId={submittedChoiceId}
                  onSelect={selectApplicationChoice}
                  onSubmit={submitApplication}
                  onReview={() => {
                    setApplicationReviewed(true)
                    recordCompletionIfReady(true, labEvidenceMet)
                  }}
                  onRevise={() => {
                    setSubmittedChoiceId(null)
                    setSelectedChoiceId(null)
                    setApplicationReviewed(false)
                  }}
                />

                <details className={styles.advancedBlock}>
                  <summary>{baxterCrrtPriorPlatformAdvancedBlock.title}</summary>
                  {baxterCrrtPriorPlatformAdvancedBlock.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </details>

                <footer className={styles.lessonFooter}>
                  <div>
                    <BookOpenCheck aria-hidden="true" />
                    <span>
                      <strong>Evidence basis</strong>
                      <small>{sourceTitles.join(' · ')}</small>
                    </span>
                  </div>
                  <div className={styles.lessonCompletion} data-complete={complete}>
                    {complete ? <Check aria-hidden="true" /> : <BookOpenCheck aria-hidden="true" />}
                    <span>
                      <strong>
                        {complete
                          ? completionEvidenceMet
                            ? 'Lesson evidence recorded'
                            : 'Prior completion retained'
                          : 'Evidence in progress'}
                      </strong>
                      <small>
                        Application {applicationSubmitted ? 'complete' : 'required this session'}
                        {selectedLesson.embeddedLabId
                          ? ` · embedded lab ${
                              labEvidenceMet ? 'complete' : 'required this session'
                            }`
                          : ''}
                      </small>
                    </span>
                  </div>
                </footer>
              </article>
            </div>
          </div>
        }
      />
    </BaxterCrrtModuleFrame>
  )
}
