'use client'

import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  GraduationCap,
  Lock,
  LockOpen,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import {
  baxterCrrtCurriculum,
  getBaxterCrrtCaseCatalogEntry,
  isCrrtCapstoneUnlocked,
  isCrrtCurriculumUnitComplete,
  nextRecommendedCrrtActivity,
  remainingCrrtCoreCaseIds,
  type BaxterCrrtRecommendedActivity,
} from '../content/curriculum'
import { baxterCrrtLearnLessonById } from '../content/learnLessons'
import { createDefaultProgress, readProgress, type BaxterCrrtProgressV3 } from '../engine/progress'
import { BaxterCrrtModuleFrame } from './BaxterCrrtModuleFrame'
import { SourcesPanel } from './SourcesPanel'
import styles from './baxter-crrt.module.css'

function activityLink(activity: BaxterCrrtRecommendedActivity) {
  if (activity.kind === 'lesson') {
    return {
      href: { pathname: `${baxterCrrtNavBase}/learn`, query: { lesson: activity.id } },
      label: `Lesson: ${baxterCrrtLearnLessonById.get(activity.id)?.title ?? activity.id}`,
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
    label: 'Masked PrisMax capstone',
  }
}

export function BaxterCrrtHub({ locale = 'en' }: { readonly locale?: string }) {
  const [progress, setProgress] = useState<BaxterCrrtProgressV3>(createDefaultProgress)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setProgress(readProgress())
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  const completedLessons = new Set(progress.completedLessonIds)
  const completedCases = new Set(progress.completedPracticeCaseIds.map((id) => id.toUpperCase()))
  const recommendation = nextRecommendedCrrtActivity(progress)
  const resume = recommendation ? activityLink(recommendation) : null
  const capstoneUnlocked = isCrrtCapstoneUnlocked(progress)
  const remainingCases = remainingCrrtCoreCaseIds(progress)
  const started =
    progress.completedLessonIds.length > 0 || progress.completedPracticeCaseIds.length > 0

  return (
    <BaxterCrrtModuleFrame locale={locale} activeHref={baxterCrrtNavBase}>
      <div data-hydrated={hydrated}>
        <header className={styles.hubHero}>
          <p className={styles.eyebrow}>Learn → Practice → Assess</p>
          <h1>High-yield CRRT reasoning on PrisMax</h1>
          <p>
            Build the concepts in seven focused lessons, apply them in a ten-case core path,
            rehearse five cause-first safety drills, then complete a masked capstone.
          </p>
          {resume ? (
            <Link className={styles.hubContinue} href={resume.href}>
              <ArrowRight aria-hidden="true" />
              <span>
                <strong>{started ? 'Continue where you left off' : 'Start the core path'}</strong>
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
              <BookOpenCheck aria-hidden="true" />
              <strong>1 · Learn</strong>
              <p>
                Seven real didactic lessons with a prescription lab and pressure-localization lab.
              </p>
            </Link>
            <Link href={`${baxterCrrtNavBase}/practice`}>
              <ClipboardCheck aria-hidden="true" />
              <strong>2 · Practice</strong>
              <p>
                Commit a plan, run the PrisMax simulation, reassess, and review a causal debrief.
              </p>
            </Link>
            <Link href={`${baxterCrrtNavBase}/assess`}>
              <GraduationCap aria-hidden="true" />
              <strong>3 · Assess</strong>
              <p>Complete the ten core cases to unlock a masked, unassisted capstone.</p>
            </Link>
          </div>
        </section>

        <section className={styles.curriculumMap} aria-labelledby="crrt-map-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.kicker}>Six stations · ten core cases</span>
              <h2 id="crrt-map-heading">Curriculum map</h2>
            </div>
            <span className={styles.completionSummary}>
              {
                progress.completedPracticeCaseIds.filter((id) =>
                  completedCases.has(id.toUpperCase()),
                ).length
              }{' '}
              practice completions saved
            </span>
          </div>

          <ol className={styles.stationList}>
            {baxterCrrtCurriculum.map((unit) => {
              const complete = isCrrtCurriculumUnitComplete(progress, unit)
              return (
                <li key={unit.id} className={styles.stationCard} data-complete={complete}>
                  <div className={styles.stationHeading}>
                    <span>{unit.station}</span>
                    <div>
                      <h3>{unit.title}</h3>
                      <p>{unit.summary}</p>
                    </div>
                    {complete ? <BadgeCheck aria-label="Station complete" /> : null}
                  </div>
                  <div className={styles.curriculumChips}>
                    {unit.lessonIds.map((lessonId) => {
                      const lesson = baxterCrrtLearnLessonById.get(lessonId)
                      const completeLesson = completedLessons.has(lessonId)
                      return (
                        <Link
                          key={lessonId}
                          data-complete={completeLesson}
                          href={{
                            pathname: `${baxterCrrtNavBase}/learn`,
                            query: { lesson: lessonId },
                          }}
                        >
                          {completeLesson ? (
                            <Check aria-hidden="true" />
                          ) : (
                            <BookOpenCheck aria-hidden="true" />
                          )}
                          <span>{lesson?.title ?? lessonId}</span>
                        </Link>
                      )
                    })}
                    {unit.coreCaseIds.map((caseId) => {
                      const caseComplete = completedCases.has(caseId)
                      const entry = getBaxterCrrtCaseCatalogEntry(caseId)
                      return (
                        <Link
                          key={caseId}
                          data-complete={caseComplete}
                          href={{
                            pathname: `${baxterCrrtNavBase}/practice`,
                            query: { case: caseId },
                          }}
                        >
                          {caseComplete ? (
                            <Check aria-hidden="true" />
                          ) : (
                            <ClipboardCheck aria-hidden="true" />
                          )}
                          <span>
                            {caseId} · {entry.title}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ol>

          <article className={styles.capstoneCard} data-unlocked={capstoneUnlocked}>
            {capstoneUnlocked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
            <div>
              <span>Final assessment</span>
              <h3>Masked PrisMax capstone</h3>
              <p>
                {capstoneUnlocked
                  ? 'Unlocked. The case identity stays masked until the causal debrief.'
                  : `Complete ${remainingCases.length} remaining core ${remainingCases.length === 1 ? 'case' : 'cases'} to unlock. Optional cases and drills do not block access.`}
              </p>
            </div>
            {capstoneUnlocked ? (
              <Link href={`${baxterCrrtNavBase}/assess`}>Begin assessment</Link>
            ) : (
              <span>{remainingCases.join(' · ')}</span>
            )}
          </article>
        </section>

        <SourcesPanel />
      </div>
    </BaxterCrrtModuleFrame>
  )
}
