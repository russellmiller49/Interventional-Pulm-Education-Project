'use client'

import { BookOpenCheck, Check, FlaskConical, Gauge, Layers3 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
import {
  criticalCareActivityPhases,
  useCriticalCareActivityAnalytics,
  type ClinicalLearningItem,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { baxterCrrtCurriculum } from '../content/curriculum'
import { getBaxterCrrtDeviceProfile } from '../content/deviceProfiles'
import { baxterCrrtLessonClinicalAnchors } from '../content/lessonClinicalAnchors'
import {
  baxterCrrtLearnLessonById,
  baxterCrrtLearnLessons,
  baxterCrrtPriorPlatformAdvancedBlock,
} from '../content/learnLessons'
import type { BaxterCrrtLearnLessonId } from '../content/learnerRegistry'
import { baxterCrrtSupplementalSourceReferences } from '../content/phase7ReviewSources'
import { baxterCrrtPilotSourceReferences } from '../content/provenance'
import {
  createDefaultProgress,
  readProgress,
  recordLessonCompletion,
  setProgressContext,
  writeProgress,
  type BaxterCrrtProgressStation,
  type BaxterCrrtProgressV3,
} from '../engine/progress'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import { CrrtPrescriptionWorkbench } from './CrrtPrescriptionWorkbench'
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

const crrtSourceById = new Map(
  [...baxterCrrtPilotSourceReferences, ...baxterCrrtSupplementalSourceReferences].map((source) => [
    source.id,
    source,
  ]),
)

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

function CircuitTeachingFigure() {
  return (
    <div className={styles.learnFigure}>
      <CrrtPilotCircuit
        running={true}
        setReady={true}
        fluidsReady={true}
        bloodFlowMlMin={100}
        dialysateFlowMlHour={1_000}
        patientFluidRemovalMlHour={100}
        pressure={{
          access: -72,
          filter: 146,
          return: 64,
          effluent: 28,
          TMP: 77,
          filterDrop: 82,
        }}
      />
      <p>
        Teaching figure: trace access → pump → filter → return, then follow dialysate, replacement,
        and effluent paths separately. Values are simulated examples.
      </p>
    </div>
  )
}

function ReadOnlyConsoleFigure() {
  return (
    <div
      className={styles.consoleFigure}
      role="img"
      aria-label="Read-only PrisMax Operations screen teaching mockup"
    >
      <div>
        <span>PrisMax · Operations</span>
        <strong>CVVHD</strong>
      </div>
      <dl>
        <div>
          <dt>Access</dt>
          <dd>−72 mmHg</dd>
        </div>
        <div>
          <dt>Filter</dt>
          <dd>146 mmHg</dd>
        </div>
        <div>
          <dt>Return</dt>
          <dd>64 mmHg</dd>
        </div>
        <div>
          <dt>TMP</dt>
          <dd>77 mmHg</dd>
        </div>
      </dl>
      <small>Read-only teaching mockup · not a device screen or operating instruction</small>
    </div>
  )
}

function ClinicalApplicationCheck({
  item,
  selectedChoiceId,
  submittedChoiceId,
  onSelect,
  onSubmit,
  onRevise,
}: {
  readonly item: ClinicalLearningItem
  readonly selectedChoiceId: string | null
  readonly submittedChoiceId: string | null
  readonly onSelect: (choiceId: string) => void
  readonly onSubmit: () => void
  readonly onRevise: () => void
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
  const router = useRouter()
  const initialId = validLessonId(initialLessonId) ? initialLessonId : baxterCrrtLearnLessons[0].id
  const [selectedLessonId, setSelectedLessonId] = useState<BaxterCrrtLearnLessonId>(initialId)
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(createDefaultProgress)
  const [hydrated, setHydrated] = useState(false)
  const [lessonAttempt, setLessonAttempt] = useState(1)
  const [helpVisible, setHelpVisible] = useState(false)
  const [lessonPhase, setLessonPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [submittedChoiceId, setSubmittedChoiceId] = useState<string | null>(null)
  const [labEvidenceMet, setLabEvidenceMet] = useState(false)
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
    applicationSubmitted && (selectedLesson.embeddedLabId === undefined || labEvidenceMet)
  const nextLesson =
    baxterCrrtLearnLessons.find(
      (lesson) =>
        lesson.id !== selectedLesson.id && !progress.completedLessonIds.includes(lesson.id),
    ) ?? null
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

  function persist(next: BaxterCrrtProgressV3) {
    setProgress(next)
    if (hydrated) writeProgress(next)
  }

  function selectLesson(lessonId: BaxterCrrtLearnLessonId) {
    setHelpVisible(false)
    setLessonPhase('recognize')
    setSelectedChoiceId(null)
    setSubmittedChoiceId(null)
    setLabEvidenceMet(false)
    setSelectedLessonId(lessonId)
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: `crrt:learn:${lessonId}`,
      mode: 'guided',
      query: { lesson: lessonId },
      payloadVersion: 'crrt-selection-v1',
    })
    if (!hydrated) return
    persist(
      setProgressContext(progress, {
        device: 'prismax-aw8035-2xx',
        roleLens: progress.lastRoleLens,
        station: stationForLesson(lessonId),
      }),
    )
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
    recordCompletionIfReady(true, labEvidenceMet)
  }

  function recordLabCompletionEvidence() {
    setLabEvidenceMet(true)
    recordCompletionIfReady(applicationSubmitted, true)
  }

  function resetLessonWork() {
    setLessonAttempt((attempt) => attempt + 1)
    setLessonPhase('recognize')
    setSelectedChoiceId(null)
    setSubmittedChoiceId(null)
    setLabEvidenceMet(false)
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
            {validLessonId(initialLessonId) ? (
              <ResumeBanner
                state="ready"
                title="Lesson selection restored"
                description={`${selectedLesson.title} is open. Prior answers and embedded-lab state were not replayed.`}
                onResume={() =>
                  document.getElementById('crrt-learn-viewport')?.focus({ preventScroll: true })
                }
              />
            ) : null}
          </>
        }
        currentTask={
          <TaskPanel
            objective={clinicalAnchor.immediateGoal}
            requiredAction={
              clinicalAnchor.labEvidenceLabel
                ? `${clinicalAnchor.labEvidenceLabel} Then answer the patient application check. Completion records automatically when both are observed.`
                : 'Answer the patient application check. Completion records automatically after the response and feedback are observed.'
            }
            targets={selectedLesson.bullets?.slice(0, 4) ?? []}
            hint={selectedLesson.paragraphs?.[0]}
            mode="guided"
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          />
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
            {nextLesson ? (
              <Link
                href={{
                  pathname: `${baxterCrrtNavBase}/learn`,
                  query: { lesson: nextLesson.id },
                }}
              >
                Next recommended · {nextLesson.title}
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
              <nav className={styles.lessonSwitcher} aria-label="CRRT Learn lessons">
                <label>
                  <span>Lesson</span>
                  <select
                    aria-label="Choose CRRT lesson"
                    value={selectedLesson.id}
                    onChange={(event) =>
                      selectLesson(event.currentTarget.value as BaxterCrrtLearnLessonId)
                    }
                  >
                    {baxterCrrtLearnLessons.map((lesson) => {
                      const lessonComplete = progress.completedLessonIds.includes(lesson.id)
                      return (
                        <option key={lesson.id} value={lesson.id}>
                          {lessonComplete ? '✓ ' : ''}
                          {lesson.ordinal}. {lesson.title}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <p>
                  Seven lessons · patient anchor, didactic explanation, and observed application
                  evidence
                </p>
              </nav>

              <article className={styles.lessonArticle} aria-labelledby="crrt-lesson-title">
                <header>
                  <span>
                    Lesson {selectedLesson.ordinal} of {baxterCrrtLearnLessons.length}
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
                        <h3 id="prescription-lab-heading">Prescription Workbench</h3>
                      </div>
                    </div>
                    <CrrtPrescriptionWorkbench
                      onPhaseChange={advanceLessonPhase}
                      onCompletionEvidence={recordLabCompletionEvidence}
                    />
                  </section>
                ) : null}

                {selectedLesson.id === 'crrt-circuit-pressures' ? (
                  <>
                    <section
                      className={styles.teachingFigures}
                      aria-label="Circuit and console teaching figures"
                    >
                      <div>
                        <Layers3 aria-hidden="true" />
                        <h3>Circuit anchor figure</h3>
                        <CircuitTeachingFigure />
                      </div>
                      <div>
                        <Gauge aria-hidden="true" />
                        <h3>Read the pressure pattern</h3>
                        <ReadOnlyConsoleFigure />
                      </div>
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
                  onRevise={() => {
                    setSubmittedChoiceId(null)
                    setSelectedChoiceId(null)
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
