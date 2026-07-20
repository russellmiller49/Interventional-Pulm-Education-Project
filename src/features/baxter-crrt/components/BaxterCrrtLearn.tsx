'use client'

import { BookOpenCheck, Check, FlaskConical, Gauge, Layers3 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'

import { baxterCrrtCurriculum } from '../content/curriculum'
import {
  baxterCrrtLearnLessonById,
  baxterCrrtLearnLessons,
  baxterCrrtPriorPlatformAdvancedBlock,
} from '../content/learnLessons'
import type { BaxterCrrtLearnLessonId } from '../content/learnerRegistry'
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
  const initialId = validLessonId(initialLessonId) ? initialLessonId : baxterCrrtLearnLessons[0].id
  const [selectedLessonId, setSelectedLessonId] = useState<BaxterCrrtLearnLessonId>(initialId)
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(createDefaultProgress)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setProgress(readProgress())
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  const selectedLesson = requireLesson(selectedLessonId)
  const complete = progress.completedLessonIds.includes(selectedLesson.id)

  function persist(next: BaxterCrrtProgressV3) {
    setProgress(next)
    if (hydrated) writeProgress(next)
  }

  function selectLesson(lessonId: BaxterCrrtLearnLessonId) {
    setSelectedLessonId(lessonId)
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
  }

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={`${baxterCrrtNavBase}/learn`}>
      <header className={styles.sectionHero}>
        <span className={styles.kicker}>Learn · unscored didactics</span>
        <h1>Build the CRRT mental model before opening a case</h1>
        <p>
          Seven concise lessons connect treatment goals, transport, prescription, circuit pressures,
          anticoagulation, alarms, fluid management, and liberation.
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
                    <span>{lessonComplete ? <Check aria-hidden="true" /> : lesson.ordinal}</span>
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
            <section className={styles.embeddedLab} aria-labelledby="prescription-lab-heading">
              <div className={styles.embeddedLabHeading}>
                <FlaskConical aria-hidden="true" />
                <div>
                  <span>Embedded concept lab</span>
                  <h3 id="prescription-lab-heading">Prescription Workbench</h3>
                </div>
              </div>
              <CrrtPrescriptionWorkbench />
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
                <CrrtPressureLocalizationLab />
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
    </BaxterCrrtModuleFrame>
  )
}
