'use client'

import { BookOpenCheck, Check, FlaskConical, Gauge, Layers3 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
import {
  criticalCareActivityPhases,
  useCriticalCareActivityAnalytics,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link, useRouter } from '@/i18n/navigation'

import { baxterCrrtCurriculum } from '../content/curriculum'
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
  const nextLesson =
    baxterCrrtLearnLessons.find(
      (lesson) =>
        lesson.id !== selectedLesson.id && !progress.completedLessonIds.includes(lesson.id),
    ) ?? null
  const progressLabel = `${progress.completedLessonIds.length}/${baxterCrrtLearnLessons.length} lessons complete · lesson ${selectedLesson.ordinal}`
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'baxter-crrt',
    activityId: `crrt:learn:${selectedLesson.id}`,
    mode: 'guided',
    phase: lessonPhase,
    enabled: hydrated,
  })

  function persist(next: BaxterCrrtProgressV3) {
    setProgress(next)
    if (hydrated) writeProgress(next)
  }

  function selectLesson(lessonId: BaxterCrrtLearnLessonId) {
    setHelpVisible(false)
    setLessonPhase('recognize')
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

  function completeLesson() {
    const withContext = setProgressContext(progress, {
      device: 'prismax-aw8035-2xx',
      roleLens: progress.lastRoleLens,
      station: stationForLesson(selectedLesson.id),
    })
    persist(recordLessonCompletion(withContext, selectedLesson.id))
    advanceLessonPhase('explain')
    lifecycleAnalytics.recordGoalMet()
    lifecycleAnalytics.recordActivityCompleted()
  }

  function showHelp() {
    if (!helpVisible) lifecycleAnalytics.recordHintUsed()
    setHelpVisible(true)
  }

  function advanceLessonPhase(nextPhase: CriticalCareActivityPhase) {
    setLessonPhase((current) =>
      criticalCareActivityPhases.indexOf(nextPhase) > criticalCareActivityPhases.indexOf(current)
        ? nextPhase
        : current,
    )
  }

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/learn`} activityMode>
      <ActivityShell
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
        theme="dark"
        patientContext={
          <>
            <PatientContextBar
              title="Lesson context"
              items={[
                {
                  label: 'Lesson',
                  value: `${selectedLesson.ordinal} of ${baxterCrrtLearnLessons.length}`,
                },
                { label: 'Device', value: 'prismax-aw8035-2xx' },
                { label: 'Review status', value: selectedLesson.reviewStatus },
              ]}
              immediateGoal={selectedLesson.summary}
              safetyConstraints={[
                'Educational model only; verify current manufacturer instructions and local policy.',
                'Displayed values and device responses are synthetic teaching examples.',
              ]}
            />
            {validLessonId(initialLessonId) ? (
              <ResumeBanner
                state="ready"
                title="Exact lesson restored"
                description={`${selectedLesson.id} is open from its stable lesson route.`}
                onResume={() =>
                  document.getElementById('crrt-learn-viewport')?.focus({ preventScroll: true })
                }
              />
            ) : null}
          </>
        }
        currentTask={
          <TaskPanel
            objective={selectedLesson.summary}
            requiredAction="Read the lesson, complete any embedded concept lab, then mark the lesson complete."
            targets={selectedLesson.bullets ?? []}
            hint={selectedLesson.paragraphs?.[0]}
            mode="guided"
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          />
        }
        onHelp={showHelp}
        onReset={() => {
          setLessonAttempt((attempt) => attempt + 1)
          setLessonPhase('recognize')
        }}
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
                  meta: selectedLesson.sourceRecordIds.join(' · '),
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
            <header className={styles.sectionHero}>
              <span className={styles.kicker}>Learn · unscored didactics</span>
              <h1>Build the CRRT mental model before opening a case</h1>
              <p>
                Seven concise lessons connect treatment goals, transport, prescription, circuit
                pressures, anticoagulation, alarms, fluid management, and liberation.
              </p>
            </header>

            <div className={styles.learnLayout} data-hydrated={hydrated}>
              <nav className={styles.lessonNav} aria-label="CRRT Learn lessons">
                <ol>
                  {baxterCrrtLearnLessons.map((lesson) => {
                    const lessonComplete = progress.completedLessonIds.includes(lesson.id)
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          aria-current={lesson.id === selectedLesson.id ? 'step' : undefined}
                          data-active={lesson.id === selectedLesson.id}
                          data-complete={lessonComplete}
                          onClick={() => selectLesson(lesson.id)}
                        >
                          <span>
                            {lessonComplete ? <Check aria-hidden="true" /> : lesson.ordinal}
                          </span>
                          <span>
                            <strong>{lesson.title}</strong>
                            <small>{lesson.summary}</small>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </nav>

              <article className={styles.lessonArticle} aria-labelledby="crrt-lesson-title">
                <header>
                  <span>
                    Lesson {selectedLesson.ordinal} of {baxterCrrtLearnLessons.length}
                  </span>
                  <h2 id="crrt-lesson-title">{selectedLesson.title}</h2>
                  <p>{selectedLesson.summary}</p>
                </header>

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
                    <CrrtPrescriptionWorkbench onPhaseChange={advanceLessonPhase} />
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
                      />
                    </section>
                  </>
                ) : null}

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
                      <strong>Draft evidence links</strong>
                      <small>{selectedLesson.sourceRecordIds.join(' · ')}</small>
                    </span>
                  </div>
                  <button type="button" disabled={complete} onClick={completeLesson}>
                    {complete ? <Check aria-hidden="true" /> : <BookOpenCheck aria-hidden="true" />}
                    {complete ? 'Lesson complete' : 'Mark lesson complete'}
                  </button>
                </footer>
              </article>
            </div>
          </div>
        }
      />
    </BaxterCrrtModuleFrame>
  )
}
