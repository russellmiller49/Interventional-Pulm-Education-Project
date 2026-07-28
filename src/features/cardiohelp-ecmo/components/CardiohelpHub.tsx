'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  HeartPulse,
  SlidersHorizontal,
  Wind,
} from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { cardiohelpDeviceProfile, cardiohelpEcmoPublicationStatus } from '../content/deviceProfile'
import {
  cardiohelpCurriculum,
  nextRecommendedActivity,
  type RecommendedActivity,
} from '../content/curriculum'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { createDefaultProgress, readProgress, type ProgressV2, type SupportMode } from '../engine'
import { CardiohelpModuleFrame } from './CardiohelpModuleFrame'
import { SourcesPanel } from './SourcesPanel'
import styles from './cardiohelp-ecmo.module.css'

interface CardiohelpHubProps {
  locale?: string
}

interface ActivityLink {
  pathname: string
  query: Record<string, string>
  label: string
}

function activityLink(activity: RecommendedActivity, supportMode: SupportMode): ActivityLink {
  if (activity.kind === 'lesson') {
    const lesson = cardiohelpLearnLessonByScenarioId.get(activity.scenarioId)
    return {
      pathname: `${cardiohelpEcmoNavBase}/learn`,
      query: { lesson: activity.scenarioId, track: supportMode },
      label: `Lesson: ${lesson?.title ?? activity.scenarioId}`,
    }
  }
  if (activity.kind === 'case') {
    const clinicalCase = clinicalPracticeScenarioById.get(activity.scenarioId)
    return {
      pathname: `${cardiohelpEcmoNavBase}/practice`,
      query: { case: activity.scenarioId, track: supportMode },
      label: `Case: ${clinicalCase?.title ?? activity.scenarioId}`,
    }
  }
  return {
    pathname: `${cardiohelpEcmoNavBase}/assess`,
    query: { track: supportMode },
    label: `${supportMode.toUpperCase()} challenge`,
  }
}

function continueLink(progress: ProgressV2, track: SupportMode): ActivityLink | null {
  const lastVisited = progress.lastVisited
  if (lastVisited) {
    if (lastVisited.section === 'assess') {
      return {
        pathname: `${cardiohelpEcmoNavBase}/assess`,
        query: { track: lastVisited.supportMode },
        label: `${lastVisited.supportMode.toUpperCase()} challenge`,
      }
    }
    const kind = lastVisited.section === 'learn' ? 'lesson' : 'case'
    return activityLink(
      { kind, scenarioId: lastVisited.scenarioId, unitId: '' },
      lastVisited.supportMode,
    )
  }
  const recommended = nextRecommendedActivity(progress, track)
  return recommended ? activityLink(recommended, track) : null
}

export function CardiohelpHub({ locale = 'en' }: CardiohelpHubProps) {
  const [progress, setProgress] = useState<ProgressV2>(createDefaultProgress)
  const [track, setTrack] = useState<SupportMode>('vv')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readProgress()
    setProgress(stored)
    if (stored.lastVisited) setTrack(stored.lastVisited.supportMode)
    setHydrated(true)
  }, [])

  const completedLessons = new Set(progress.completedLearnLessonIds)
  const completedCases = new Set(progress.completedLabs)
  const units = cardiohelpCurriculum[track]
  const resume = continueLink(progress, track)
  const recommended = nextRecommendedActivity(progress, track)
  const started =
    progress.completedLearnLessonIds.length > 0 ||
    progress.completedLabs.length > 0 ||
    progress.lastVisited !== undefined

  return (
    <CardiohelpModuleFrame locale={locale} activeHref={cardiohelpEcmoNavBase}>
      <div data-hydrated={hydrated}>
        <header className={styles.hubHero}>
          <h1>ECMO Management</h1>
          <p>
            The CARDIOHELP console lab pairs lessons and clinical cases for adult VV and peripheral
            VA ECMO: learn each reasoning sequence step by step, apply it to an evolving case, then
            try a harder challenge with less help.
          </p>
          {resume && started ? (
            <Link
              className={styles.hubContinue}
              href={{ pathname: resume.pathname, query: resume.query }}
            >
              <ArrowRight aria-hidden="true" />
              <span>
                <strong>Continue where you left off</strong>
                <small>{resume.label}</small>
              </span>
            </Link>
          ) : resume ? (
            <Link
              className={styles.hubContinue}
              href={{ pathname: resume.pathname, query: resume.query }}
            >
              <ArrowRight aria-hidden="true" />
              <span>
                <strong>Start the curriculum</strong>
                <small>{resume.label}</small>
              </span>
            </Link>
          ) : null}
        </header>

        <section className={styles.hubHowItWorks} aria-labelledby="hub-how-heading">
          <h2 id="hub-how-heading">How this module works</h2>
          <ol className={styles.hubPathGrid}>
            <li>
              <Link href={`${cardiohelpEcmoNavBase}/learn`}>
                <span aria-hidden="true">1</span>
                <GraduationCap aria-hidden="true" />
                <strong>Learn</strong>
                <p>
                  Guided walkthroughs on the simulated console: where to look, what to do, and why.
                  Ten lessons per track.
                </p>
              </Link>
            </li>
            <li>
              <Link href={`${cardiohelpEcmoNavBase}/practice`}>
                <span aria-hidden="true">2</span>
                <SlidersHorizontal aria-hidden="true" />
                <strong>Practice</strong>
                <p>
                  Clinical cases that apply each lesson: commit a plan, treat the patient and
                  circuit, reassess, and debrief. Seven cases per track.
                </p>
              </Link>
            </li>
            <li>
              <Link href={`${cardiohelpEcmoNavBase}/assess`}>
                <span aria-hidden="true">3</span>
                <BookOpenCheck aria-hidden="true" />
                <strong>Challenge</strong>
                <p>
                  A harder case per track, open from the start. Work uninterrupted, then use the
                  causal debrief.
                </p>
              </Link>
            </li>
          </ol>
        </section>

        <section className={styles.hubTrackSection} aria-labelledby="hub-track-heading">
          <h2 id="hub-track-heading">Choose a track</h2>
          <p>
            The console workflow is shared, but the return vessel, patient physiology, monitoring,
            lessons, cases, and capstone change with the configuration. Work either track first—your
            progress is saved separately for each.
          </p>
          <div className={styles.supportModeTabs} role="radiogroup" aria-label="ECMO support mode">
            <button
              type="button"
              role="radio"
              aria-checked={track === 'vv'}
              data-active={track === 'vv'}
              onClick={() => setTrack('vv')}
            >
              <Wind aria-hidden="true" />
              <span>
                <strong>VV ECMO</strong>
                <small>
                  Gas-exchange support: femoral vein drainage → pump + oxygenator → femoral vein
                  return toward the right atrium.
                </small>
              </span>
              <em>{track === 'vv' ? 'Selected' : 'View VV track'}</em>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={track === 'va'}
              data-active={track === 'va'}
              onClick={() => setTrack('va')}
            >
              <HeartPulse aria-hidden="true" />
              <span>
                <strong>Peripheral VA ECMO</strong>
                <small>
                  Circulatory support: femoral vein drainage → pump + oxygenator → femoral artery
                  return toward the aorta, with mode-specific upper-body, LV-loading, and limb
                  risks.
                </small>
              </span>
              <em>{track === 'va' ? 'Selected' : 'View VA track'}</em>
            </button>
          </div>
        </section>

        <section className={styles.hubCurriculum} aria-labelledby="hub-curriculum-heading">
          <div className={styles.hubCurriculumHeading}>
            <h2 id="hub-curriculum-heading">{track.toUpperCase()} curriculum</h2>
            <span>Open in any order · personal history stays local</span>
          </div>
          <ol className={styles.hubUnitList}>
            {units.map((unit, index) => {
              if (unit.capstoneScenarioId) {
                return (
                  <li key={unit.id} className={styles.hubCapstoneCard}>
                    <div className={styles.hubUnitHeading}>
                      <span aria-hidden="true">{index + 1}</span>
                      <div>
                        <h3>{unit.title}</h3>
                        <p>{unit.summary}</p>
                      </div>
                      <BookOpenCheck aria-hidden="true" />
                    </div>
                    <Link
                      className={styles.hubChip}
                      data-kind="capstone"
                      href={{
                        pathname: `${cardiohelpEcmoNavBase}/assess`,
                        query: { track },
                      }}
                    >
                      <ArrowRight aria-hidden="true" /> Open the {track.toUpperCase()} challenge
                      {completedCases.has(unit.capstoneScenarioId) ? ' · worked through' : ''}
                    </Link>
                  </li>
                )
              }
              return (
                <li key={unit.id} className={styles.hubUnitCard}>
                  <div className={styles.hubUnitHeading}>
                    <span aria-hidden="true">{index + 1}</span>
                    <div>
                      <h3>{unit.title}</h3>
                      <p>{unit.summary}</p>
                    </div>
                    <small className={styles.hubUnitCount}>Choose what is useful now</small>
                  </div>
                  <div className={styles.hubChipRow}>
                    {unit.lessonScenarioIds.map((lessonId) => {
                      const lesson = cardiohelpLearnLessonByScenarioId.get(lessonId)
                      const complete = completedLessons.has(lessonId)
                      const isRecommended =
                        recommended?.kind === 'lesson' && recommended.scenarioId === lessonId
                      return (
                        <Link
                          key={lessonId}
                          className={styles.hubChip}
                          data-kind="lesson"
                          data-complete={complete}
                          data-recommended={isRecommended}
                          href={{
                            pathname: `${cardiohelpEcmoNavBase}/learn`,
                            query: { lesson: lessonId, track },
                          }}
                        >
                          <GraduationCap aria-hidden="true" />
                          {lesson?.title ?? lessonId}
                          {complete ? ' ✓' : ''}
                          {isRecommended ? <em>Up next</em> : null}
                        </Link>
                      )
                    })}
                    {unit.caseScenarioIds.map((caseId) => {
                      const clinicalCase = clinicalPracticeScenarioById.get(caseId)
                      const complete = completedCases.has(caseId)
                      const isRecommended =
                        recommended?.kind === 'case' && recommended.scenarioId === caseId
                      return (
                        <Link
                          key={caseId}
                          className={styles.hubChip}
                          data-kind="case"
                          data-complete={complete}
                          data-recommended={isRecommended}
                          href={{
                            pathname: `${cardiohelpEcmoNavBase}/practice`,
                            query: { case: caseId, track },
                          }}
                        >
                          <BookOpenCheck aria-hidden="true" />
                          {clinicalCase?.title ?? caseId}
                          {complete ? ' ✓' : ''}
                          {isRecommended ? <em>Up next</em> : null}
                        </Link>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className={styles.profileStrip} aria-label="Fixed device profile">
          <span>
            <strong>Profile</strong> {cardiohelpDeviceProfile.displayName}
          </span>
          <span>
            <strong>U.S. IFU</strong> rev {cardiohelpDeviceProfile.ifuRevision} ·{' '}
            {cardiohelpDeviceProfile.ifuDate}
          </span>
          <span>
            <strong>Software</strong> ≥{cardiohelpDeviceProfile.minimumSoftwareVersion}
          </span>
          <span>
            <strong>thApp</strong> {cardiohelpDeviceProfile.thApp}
          </span>
          <span>
            <strong>Curriculum</strong> VV + peripheral VA · draft review
          </span>
        </section>

        <SourcesPanel publicationStatus={cardiohelpEcmoPublicationStatus} />
      </div>
    </CardiohelpModuleFrame>
  )
}
