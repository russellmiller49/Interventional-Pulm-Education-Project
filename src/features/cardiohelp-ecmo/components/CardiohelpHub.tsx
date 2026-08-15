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
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { cardiohelpDeviceProfile, cardiohelpEcmoPublicationStatus } from '../content/deviceProfile'
import {
  ecmoPathwayComposition,
  ecmoPathwayGroups,
  ecmoWorkedSectionIds,
  nextIncompleteSectionLink,
  type EcmoPathwayGroup,
} from '../content/pathwayResolver'
import { orderedCaseScenarioIds } from '../content/curriculum'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { createDefaultProgress, readProgress, type ProgressV2, type SupportMode } from '../engine'
import { CardiohelpModuleFrame } from './CardiohelpModuleFrame'
import { SourcesPanel } from './SourcesPanel'
import styles from './cardiohelp-ecmo.module.css'

interface CardiohelpHubProps {
  locale?: string
}

interface SavedActivityLink {
  pathname: string
  query: Record<string, string>
  label: string
}

/**
 * Where a learner left a case or the challenge, if they left one open.
 *
 * The hub's primary call to action used to be this, which is why a fresh learner was sent to the
 * console tour: it fell through to the curriculum's unit walker, and that walker's first entry is
 * the console drill. The primary call to action now always resolves through the pathway, and this
 * survives only as a small aside — Practice and the challenge are not on the Learn pathway, so
 * without it a learner who stopped mid-case would have no way back to it from here.
 *
 * Returns null for a Learn pointer (the pathway already covers that), and for a case id that is no
 * longer in the registry rather than labelling a link with a raw identifier.
 */
function savedActivityLink(progress: ProgressV2): SavedActivityLink | null {
  const lastVisited = progress.lastVisited
  if (!lastVisited || lastVisited.section === 'learn') return null

  if (lastVisited.section === 'assess') {
    return {
      pathname: `${cardiohelpEcmoNavBase}/assess`,
      query: { track: lastVisited.supportMode },
      label: `${lastVisited.supportMode.toUpperCase()} challenge`,
    }
  }

  const clinicalCase = clinicalPracticeScenarioById.get(lastVisited.scenarioId)
  if (!clinicalCase) return null
  return {
    pathname: `${cardiohelpEcmoNavBase}/practice`,
    query: { case: lastVisited.scenarioId, track: lastVisited.supportMode },
    label: clinicalCase.title,
  }
}

/**
 * Which sections a group holds, and how long they run.
 *
 * Positions come from the canonical order, not from counting within the group, so the numbers a
 * learner reads here are the same ones the pathway rail and the section headers show them.
 */
function groupSpanLabel(group: EcmoPathwayGroup, track: SupportMode): string {
  const order = criticalCareLearningPathway('cardiohelp-ecmo', track).sections
  const positions = group.sections.map(
    (section) => order.findIndex((candidate) => candidate.id === section.id) + 1,
  )
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  return `${span} · ${minutes} minutes`
}

/** The composition line, counted from the registry so it cannot drift out of step with it. */
function compositionLine(track: SupportMode): string {
  const { total, foundations, consoleOrientation, drills, capstone } = ecmoPathwayComposition(track)
  return [
    `${total} sections`,
    `${foundations} foundations`,
    consoleOrientation === 1
      ? 'console orientation'
      : `${consoleOrientation} console orientation sections`,
    `${drills} drills`,
    capstone === 1 ? 'integration capstone' : `${capstone} integration capstones`,
  ].join(' · ')
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

  const workedSections = ecmoWorkedSectionIds(progress)
  const completedCases = new Set(progress.completedLabs)
  const groups = ecmoPathwayGroups(track)
  const next = nextIncompleteSectionLink(track, progress)
  const saved = savedActivityLink(progress)

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
          <div className={styles.hubEntryActions}>
            {next ? (
              <Link
                className={styles.hubContinue}
                data-ecmo-continue={hydrated ? 'resolved' : 'pending'}
                href={next.linkTarget}
              >
                <ArrowRight aria-hidden="true" />
                <span>
                  <strong>Continue — {next.section.title}</strong>
                  <small>
                    Section {next.index + 1} of {next.total} · {next.section.minutes} minutes
                  </small>
                </span>
              </Link>
            ) : (
              <p className={styles.hubTrackDone} data-ecmo-continue="complete">
                Every section of the {track.toUpperCase()} track is worked through. Revisit any of
                them below, or take the challenge.
              </p>
            )}
            {/*
              Carries the track, like the primary action and every chip beside it. Without it the
              landing falls back to VV, so a learner who had just chosen VA would be shown the VV
              pathway by the second of the two actions on this screen — the same disagreement
              between entry surfaces this package exists to remove.
            */}
            <Link
              className={styles.hubBrowseAll}
              href={{ pathname: `${cardiohelpEcmoNavBase}/learn`, query: { track } }}
            >
              Browse all {ecmoPathwayComposition(track).total} sections
            </Link>
          </div>
          <p className={styles.hubEntryComposition}>{compositionLine(track)}</p>
          {saved ? (
            <p className={styles.hubSavedAside}>
              <Link href={{ pathname: saved.pathname, query: saved.query }}>
                Return to your saved work: {saved.label}
              </Link>
            </p>
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
                  One ordered pathway per track on the simulated console: the physiology, the
                  controls, then one failure at a time. {ecmoPathwayComposition(track).total}{' '}
                  sections per track.
                </p>
              </Link>
            </li>
            <li>
              <Link href={`${cardiohelpEcmoNavBase}/practice`}>
                <span aria-hidden="true">2</span>
                <SlidersHorizontal aria-hidden="true" />
                <strong>Practice</strong>
                <p>
                  Clinical cases that apply what each drill taught: commit a plan, treat the patient
                  and circuit, reassess, and debrief. {orderedCaseScenarioIds(track).length} cases
                  per track.
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
            drills, cases, and capstone change with the configuration. New to extracorporeal
            support? Work VV first: VA is VV plus two added ideas — the artery pushes back on the
            return limb, and there are two circulations to keep track of.
          </p>
          <p>
            Work either track first. The first four sections are shared by both, so working them
            once covers both tracks; everything after them is followed separately.
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
                  For failing lungs. Gas exchange happens in series with the native circulation:
                  femoral vein drainage → pump + oxygenator → femoral vein return toward the right
                  atrium.
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
                  For a failing heart or circulation. Circuit flow runs in parallel with whatever
                  the heart still ejects: femoral vein drainage → pump + oxygenator → femoral artery
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
            <h2 id="hub-curriculum-heading">{track.toUpperCase()} pathway</h2>
            <span>Grouped by unit · open any section · personal history stays local</span>
          </div>
          {/*
            The seven units, each holding its own run of the pathway. Every one of the seventeen
            sections appears here exactly once and in order, so this is a view of the sequence
            rather than a second sequence: `pathway-resolver.test.ts` asserts that flattening these
            groups reproduces the pathway. The physiology sections used to be missing from this
            list entirely, which is how a learner could read the hub and never learn they existed.
          */}
          <ol className={styles.hubUnitList}>
            {groups.map((group, index) => (
              <li
                key={group.unitId}
                className={group.capstoneScenarioId ? styles.hubCapstoneCard : styles.hubUnitCard}
              >
                <div className={styles.hubUnitHeading}>
                  <span aria-hidden="true">{index + 1}</span>
                  <div>
                    <h3>{group.title}</h3>
                    {/*
                      The span leads, and the unit's own summary follows. The summaries were
                      authored to describe a unit's drills and cases, and the first unit now also
                      carries the six physiology sections that come before its drill — so a learner
                      reading only the summary would not know the runway was there. Saying which
                      sections a group holds is the part that has to be exact.
                    */}
                    <p>{groupSpanLabel(group, track)}</p>
                    <p>{group.summary}</p>
                  </div>
                  {group.capstoneScenarioId ? (
                    <BookOpenCheck aria-hidden="true" />
                  ) : (
                    <small className={styles.hubUnitCount}>Choose what is useful now</small>
                  )}
                </div>
                <div className={styles.hubChipRow}>
                  {group.sections.map((section) => {
                    const worked = workedSections.has(section.id)
                    const isNext = next?.section.id === section.id
                    return (
                      <Link
                        key={section.id}
                        className={styles.hubChip}
                        data-kind="section"
                        data-complete={worked}
                        data-recommended={isNext}
                        href={{
                          pathname: `${cardiohelpEcmoNavBase}/learn`,
                          query: { lesson: section.id, track },
                        }}
                      >
                        <GraduationCap aria-hidden="true" />
                        {section.title}
                        {worked ? ' ✓ worked through' : ''}
                        {isNext ? <em>Up next</em> : null}
                      </Link>
                    )
                  })}
                  {group.caseScenarioIds.map((caseId) => {
                    const clinicalCase = clinicalPracticeScenarioById.get(caseId)
                    const complete = completedCases.has(caseId)
                    return (
                      <Link
                        key={caseId}
                        className={styles.hubChip}
                        data-kind="case"
                        data-complete={complete}
                        href={{
                          pathname: `${cardiohelpEcmoNavBase}/practice`,
                          query: { case: caseId, track },
                        }}
                      >
                        <BookOpenCheck aria-hidden="true" />
                        {clinicalCase?.title ?? caseId}
                        {complete ? ' ✓ worked through' : ''}
                      </Link>
                    )
                  })}
                  {group.capstoneScenarioId ? (
                    <Link
                      className={styles.hubChip}
                      data-kind="capstone"
                      data-complete={completedCases.has(group.capstoneScenarioId)}
                      href={{
                        pathname: `${cardiohelpEcmoNavBase}/assess`,
                        query: { track },
                      }}
                    >
                      <ArrowRight aria-hidden="true" /> Open the {track.toUpperCase()} challenge
                      {completedCases.has(group.capstoneScenarioId) ? ' ✓ worked through' : ''}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
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
            <strong>Pathway</strong> VV + peripheral VA · draft review
          </span>
        </section>

        <SourcesPanel publicationStatus={cardiohelpEcmoPublicationStatus} />
      </div>
    </CardiohelpModuleFrame>
  )
}
