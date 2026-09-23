'use client'

import { ArrowRight, BookOpen, ClipboardList, Eye, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import {
  baxterCrrtCurriculum,
  getBaxterCrrtCaseCatalogEntry,
  isCrrtCurriculumUnitComplete,
  nextRecommendedCrrtActivity,
  type BaxterCrrtRecommendedActivity,
} from '../content/curriculum'
import { baxterCrrtLearnLessonById } from '../content/learnLessons'
import { crrtLessonNumber } from '../learnSequence'
import { readCrrtSelfPacedProgress } from '../selfPacedProgress'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { CrrtGlossaryButton } from './CrrtGlossary'
import { SourcesPanel } from './SourcesPanel'
import styles from './baxter-crrt.module.css'

function activityLink(activity: BaxterCrrtRecommendedActivity) {
  if (activity.kind === 'lesson') {
    return {
      href: { pathname: `${baxterCrrtNavBase}/learn`, query: { lesson: activity.id } },
      label: `Lesson ${crrtLessonNumber(activity.id)}: ${
        baxterCrrtLearnLessonById.get(activity.id)?.title ?? activity.id
      }`,
    }
  }
  if (activity.kind === 'case') {
    return {
      href: { pathname: `${baxterCrrtNavBase}/practice`, query: { case: activity.id } },
      label: `Case: ${getBaxterCrrtCaseCatalogEntry(activity.id).title}`,
    }
  }
  return {
    href: `${baxterCrrtNavBase}/assess`,
    label: 'PrisMax challenge',
  }
}

export function BaxterCrrtHub({ locale = 'en' }: { readonly locale?: string }) {
  const [progress, setProgress] = useState(() => readCrrtSelfPacedProgress(null))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setProgress(readCrrtSelfPacedProgress())
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  // F-20: these are opened-on-this-device records, never completion. The recommendation helper
  // still receives them under its historical parameter names; nothing reads them as a result.
  const visitedLessons = new Set(progress.visitedLessonIds)
  const visitedCases = new Set(progress.visitedCaseIds.map((id) => id.toUpperCase()))
  const visited = {
    completedLessonIds: progress.visitedLessonIds,
    completedPracticeCaseIds: progress.visitedCaseIds,
  }
  const recommendation = nextRecommendedCrrtActivity(visited)
  const resume = recommendation ? activityLink(recommendation) : null
  const started = progress.visitedLessonIds.length > 0 || progress.visitedCaseIds.length > 0

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={baxterCrrtNavBase}>
      <div data-hydrated={hydrated}>
        <header className={styles.hubHero}>
          <p className={styles.eyebrow}>Learn → Practice → Challenge</p>
          <h1>High-yield CRRT reasoning on PrisMax</h1>
          <p>
            Build the concepts in {BAXTER_CRRT_LEARN_LESSON_IDS.length} focused lessons, apply them
            in a ten-case core path, rehearse five cause-first safety drills, then try a harder
            challenge.
          </p>
          {resume ? (
            <Link className={styles.hubContinue} href={resume.href}>
              <ArrowRight aria-hidden="true" />
              <span>
                <strong>{started ? 'Continue to the next topic' : 'Start the core path'}</strong>
                <small>{resume.label}</small>
              </span>
            </Link>
          ) : null}
        </header>

        <section className={styles.howItWorks} aria-labelledby="crrt-how-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Three deliberate modes</span>
              <h2 id="crrt-how-heading">How this module works</h2>
            </div>
          </div>
          <div className={styles.howGrid}>
            <Link href={`${baxterCrrtNavBase}/learn`}>
              <BookOpen aria-hidden="true" />
              <strong>1 · Learn</strong>
              <p>
                {BAXTER_CRRT_LEARN_LESSON_IDS.length} lessons with a prescription lab and
                pressure-localization lab.
              </p>
            </Link>
            <Link href={`${baxterCrrtNavBase}/practice`}>
              <ClipboardList aria-hidden="true" />
              <strong>2 · Practice</strong>
              <p>Read a worked plan, explore the PrisMax simulation, and compare its responses.</p>
            </Link>
            <Link href={`${baxterCrrtNavBase}/assess`}>
              <GraduationCap aria-hidden="true" />
              <strong>3 · Challenge</strong>
              <p>Open a harder PrisMax case from the start and use its causal debrief.</p>
            </Link>
          </div>
        </section>

        <section className={styles.hubOrientation} aria-labelledby="crrt-orientation-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Before you start</span>
              <h2 id="crrt-orientation-heading">Who this is for and how it works</h2>
            </div>
          </div>
          <dl className={styles.orientationList}>
            <div>
              <dt>Who it is for</dt>
              <dd>
                Clinicians and trainees who already know what acute kidney injury is and can read a
                basic acid–base and electrolyte picture. No earlier CRRT machine, circuit or
                prescription experience is assumed.
              </dd>
            </div>
            <div>
              <dt>What you will practice</dt>
              <dd>
                Tracing one circuit and naming where each pressure sits; building a prescription in
                stages; separating prescribed intensity from therapy actually delivered; telling a
                circuit sample from a patient sample; and keeping the machine fluid ledger separate
                from the whole-patient one.
              </dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>
                Everything is open. The Learn sequence below is a recommendation, not a requirement,
                and every exercise, case and drill is an optional try with its worked explanation
                available at any time.
              </dd>
            </div>
            <div>
              <dt>What “Visited” means</dt>
              <dd>
                You opened that lesson or case on this device. It is not a record of completion or
                competence: a lesson whose exercises you skipped still shows as visited.
              </dd>
            </div>
            <div>
              <dt>What is saved</dt>
              <dd>
                Only on this device: which lessons and cases you have opened and where you were
                last. Answers, runs and settings are not saved; each visit starts a fresh
                simulation.
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                A draft educational simulation, not yet clinically reviewed. Finishing it does not
                qualify anyone to prescribe, set up or run CRRT, and it replaces no local protocol.
              </dd>
            </div>
          </dl>
          <CrrtGlossaryButton />
        </section>

        <section className={styles.curriculumMap} aria-labelledby="crrt-map-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>
                Eight lessons · six topic stations · ten core cases
              </span>
              <h2 id="crrt-map-heading">Curriculum map</h2>
            </div>
            <span className={styles.completionSummary}>
              Open in any order · history stays local
            </span>
          </div>

          {/* F-10: one authored lesson order. The stations below group lessons and cases by
              topic; they are not a second sequence, so each lesson keeps its number here. */}
          <div className={styles.learnSequence}>
            <h3 id="crrt-learn-sequence-heading">Recommended Learn sequence</h3>
            <ol aria-labelledby="crrt-learn-sequence-heading" data-crrt-learn-sequence>
              {BAXTER_CRRT_LEARN_LESSON_IDS.map((lessonId) => {
                const lesson = baxterCrrtLearnLessonById.get(lessonId)
                const visitedLesson = visitedLessons.has(lessonId)
                return (
                  <li key={lessonId}>
                    <Link
                      href={{
                        pathname: `${baxterCrrtNavBase}/learn`,
                        query: { lesson: lessonId },
                      }}
                      data-visited={visitedLesson}
                    >
                      <span className={styles.lessonIndex}>{crrtLessonNumber(lessonId)}</span>
                      <span>{lesson?.title ?? lessonId}</span>
                      {visitedLesson ? <VisitedMarker /> : null}
                    </Link>
                  </li>
                )
              })}
            </ol>
            <p>
              The stations below group the same lessons with their practice cases by topic. They are
              not a required order: each lesson keeps its number from this sequence, and everything
              stays open.
            </p>
          </div>

          <ol className={styles.stationList}>
            {baxterCrrtCurriculum.map((unit) => {
              const allOpened = isCrrtCurriculumUnitComplete(visited, unit)
              return (
                <li key={unit.id} className={styles.stationCard} data-all-opened={allOpened}>
                  <div className={styles.stationHeading}>
                    <span className={styles.stationNumber}>
                      <span className="sr-only">Topic station </span>
                      {unit.station}
                    </span>
                    <div>
                      <h3>{unit.title}</h3>
                      <p>{unit.summary}</p>
                    </div>
                    {allOpened ? (
                      <span className={styles.stationVisited}>
                        <Eye aria-hidden="true" /> Every lesson and core case here opened
                        <span className="sr-only"> on this device; not a record of completion</span>
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.curriculumChips}>
                    {unit.lessonIds.map((lessonId) => {
                      const lesson = baxterCrrtLearnLessonById.get(lessonId)
                      const visitedLesson = visitedLessons.has(lessonId)
                      return (
                        <Link
                          key={lessonId}
                          data-visited={visitedLesson}
                          href={{
                            pathname: `${baxterCrrtNavBase}/learn`,
                            query: { lesson: lessonId },
                          }}
                        >
                          <BookOpen aria-hidden="true" />
                          <span>
                            Lesson {crrtLessonNumber(lessonId)} · {lesson?.title ?? lessonId}
                          </span>
                          {visitedLesson ? <VisitedMarker /> : null}
                        </Link>
                      )
                    })}
                    {unit.coreCaseIds.map((caseId) => {
                      const visitedCase = visitedCases.has(caseId)
                      const entry = getBaxterCrrtCaseCatalogEntry(caseId)
                      return (
                        <Link
                          key={caseId}
                          data-visited={visitedCase}
                          href={{
                            pathname: `${baxterCrrtNavBase}/practice`,
                            query: { case: caseId },
                          }}
                        >
                          <ClipboardList aria-hidden="true" />
                          <span>
                            {caseId} · {entry.title}
                          </span>
                          {visitedCase ? <VisitedMarker /> : null}
                        </Link>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ol>

          <article className={styles.capstoneCard} data-available>
            <GraduationCap aria-hidden="true" />
            <div>
              <span>Challenge</span>
              <h3>PrisMax troubleshooting challenge</h3>
              <p>Open from the start. Worked plans and hints are available throughout.</p>
            </div>
            <Link href={`${baxterCrrtNavBase}/assess`}>Open challenge</Link>
          </article>
        </section>

        <SourcesPanel />
      </div>
    </BaxterCrrtModuleFrame>
  )
}

/**
 * The one marker a visited lesson or case carries (F-20): an eye and the word "Visited", with
 * the meaning spelled out for screen readers. No tick, no color-only state, no completion.
 */
function VisitedMarker() {
  return (
    <small className={styles.visitedMarker} data-visited-marker>
      <Eye aria-hidden="true" /> Visited
      <span className="sr-only"> — opened on this device; not a record of completion</span>
    </small>
  )
}
