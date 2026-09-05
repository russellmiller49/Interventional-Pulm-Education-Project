'use client'

import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { ArrowRight, ChevronDown, HeartPulse, Wind } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { presentationTitle } from '../content/casePresentation'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { orderedCaseScenarioIds } from '../content/curriculum'
import { cardiohelpDeviceProfile, cardiohelpEcmoPublicationStatus } from '../content/deviceProfile'
import { ecmoPathwayComposition, nextIncompleteSectionLink } from '../content/pathwayResolver'
import { ecmoTrackIncrement } from '../content/trackIncrements'
import type { ProgressV2, SupportMode } from '../engine'
import { CardiohelpModuleFrame } from './CardiohelpModuleFrame'
import { EcmoPathwayAccordion } from './EcmoPathwayAccordion'
import { SourcesPanel } from './SourcesPanel'
import { useStoredProgress } from './useStoredProgress'
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
 * longer in the registry rather than labelling a link with a raw identifier. The case is named by
 * its presentation: a saved-work link is read before the case is reopened, so it may not carry the
 * diagnosis.
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
    label: presentationTitle(clinicalCase),
  }
}

/**
 * The two tracks, as data, so the radio group's keyboard model is written once rather than per
 * option. Descriptions are one line each: VV is the base track, VA is the base track plus the two
 * named ideas — the sentence comes from the track-increment registry and is not restated here.
 */
const TRACK_OPTIONS: readonly {
  readonly mode: SupportMode
  readonly title: string
  readonly description: string
  readonly icon: typeof Wind
}[] = [
  {
    mode: 'vv',
    title: 'VV ECMO',
    description: 'The base track. Gas exchange in series with the native circulation.',
    icon: Wind,
  },
  {
    mode: 'va',
    title: 'Peripheral VA ECMO',
    description:
      ecmoTrackIncrement('va')?.sentence ??
      'Circulatory support in parallel with whatever the heart still ejects.',
    icon: HeartPulse,
  },
]

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

/**
 * The module hub: one door, one map.
 *
 * The hero holds the single primary call to action, resolved through the pathway. The map is one
 * accordion of seven units, opened in place from a browse button rather than reached through a
 * second page, and the track chooser sits below it, demoted to a switch. Everything a learner reads
 * here is counted from the registries.
 */
export function CardiohelpHub({ locale = 'en' }: CardiohelpHubProps) {
  const { progress, hydrated } = useStoredProgress()
  const [trackChoice, setTrackChoice] = useState<SupportMode | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const accordionId = useId()
  const track: SupportMode = trackChoice ?? progress.lastVisited?.supportMode ?? 'vv'

  /**
   * The track chooser, as a real ARIA radio group rather than the shape of one.
   *
   * Selection follows focus, which is the pattern for a radio group: moving to an option chooses
   * it. Both entry actions and the map read from the same `track` state, so they follow the
   * keyboard the same way they follow a click. Native `<input type="radio">` was not used because
   * the approved presentation selects `.supportModeTabs button`.
   */
  const trackRefs = useRef<Partial<Record<SupportMode, HTMLButtonElement | null>>>({})

  const selectTrackAt = useCallback((index: number) => {
    const option = TRACK_OPTIONS[(index + TRACK_OPTIONS.length) % TRACK_OPTIONS.length]!
    setTrackChoice(option.mode)
    trackRefs.current[option.mode]?.focus()
  }, [])

  const onTrackKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          selectTrackAt(index + 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          selectTrackAt(index - 1)
          break
        case 'Home':
          event.preventDefault()
          selectTrackAt(0)
          break
        case 'End':
          event.preventDefault()
          selectTrackAt(TRACK_OPTIONS.length - 1)
          break
        case ' ':
          // Enter already activates a button natively; Space needs to be claimed so the page does
          // not scroll underneath the choice.
          event.preventDefault()
          selectTrackAt(index)
          break
        default:
          break
      }
    },
    [selectTrackAt],
  )

  const next = nextIncompleteSectionLink(track, progress)
  const saved = savedActivityLink(progress)
  const total = ecmoPathwayComposition(track).total

  return (
    <CardiohelpModuleFrame locale={locale} activeHref={cardiohelpEcmoNavBase}>
      <div data-hydrated={hydrated}>
        <header className={styles.hubHero}>
          <h1>ECMO Management</h1>
          <p>
            The CARDIOHELP console lab teaches adult VV and peripheral VA ECMO on a simulated
            circuit: one ordered pathway of short sections per track, a clinical case after each
            mechanism, and one open challenge at the end.
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
          </div>
          {saved ? (
            <p className={styles.hubSavedAside}>
              <Link href={{ pathname: saved.pathname, query: saved.query }}>
                Return to your saved work: {saved.label}
              </Link>
            </p>
          ) : null}
        </header>

        <section className={styles.hubCurriculum} aria-labelledby="hub-curriculum-heading">
          <div className={styles.hubCurriculumHeading}>
            <h2 id="hub-curriculum-heading">{track.toUpperCase()} pathway</h2>
            <span>Grouped by unit · open any section · personal history stays local</span>
          </div>
          <p className={styles.hubEntryComposition}>{compositionLine(track)}</p>
          <button
            type="button"
            className={styles.hubBrowseToggle}
            aria-expanded={browsing}
            aria-controls={accordionId}
            onClick={() => setBrowsing((current) => !current)}
          >
            Browse all {total} sections
            <ChevronDown aria-hidden="true" />
          </button>
          {/* The controlled region exists whether or not it is open, so `aria-controls` always resolves. */}
          <div className={styles.hubBrowsePanel} id={accordionId} hidden={!browsing}>
            {browsing ? (
              <>
                <EcmoPathwayAccordion track={track} progress={progress} />
                <Link
                  className={styles.hubPathwayPageLink}
                  href={{ pathname: `${cardiohelpEcmoNavBase}/learn`, query: { track } }}
                >
                  Open the pathway page
                </Link>
              </>
            ) : null}
          </div>
        </section>

        <section className={styles.hubTrackSection} aria-labelledby="hub-track-heading">
          <h2 id="hub-track-heading">Choose a track</h2>
          <p>
            The first four sections are shared by both tracks; everything after them is followed
            separately. New to extracorporeal support? Work VV first.
          </p>
          <div className={styles.supportModeTabs} role="radiogroup" aria-label="ECMO support mode">
            {TRACK_OPTIONS.map((option, index) => {
              const Icon = option.icon
              const selected = track === option.mode
              return (
                <button
                  key={option.mode}
                  ref={(node) => {
                    trackRefs.current[option.mode] = node
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-active={selected}
                  // Roving tabindex: the group is one Tab stop, and the arrow keys move within it.
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTrackChoice(option.mode)}
                  onKeyDown={(event) => onTrackKeyDown(event, index)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                  <em>{selected ? 'Selected' : `View ${option.mode.toUpperCase()} track`}</em>
                </button>
              )
            })}
          </div>
        </section>

        <section className={styles.hubHowItWorks} aria-labelledby="hub-how-heading">
          <h2 id="hub-how-heading">How this module works</h2>
          <ol className={styles.hubLayers}>
            <li>
              <Link href={{ pathname: `${cardiohelpEcmoNavBase}/learn`, query: { track } }}>
                Learn
              </Link>
              <span>
                one ordered pathway per track on the simulated console, {total} sections per track:
                the physiology, the controls, then one failure at a time.
              </span>
            </li>
            <li>
              <Link href={{ pathname: `${cardiohelpEcmoNavBase}/practice`, query: { track } }}>
                Practice
              </Link>
              <span>
                clinical cases that apply what each section taught — commit a plan, manage,
                reassess, debrief — {orderedCaseScenarioIds(track).length} cases per track.
              </span>
            </li>
            <li>
              <Link href={{ pathname: `${cardiohelpEcmoNavBase}/assess`, query: { track } }}>
                Challenge
              </Link>
              <span>
                one harder case per track, open from the start, with less prompting and the same
                causal debrief.
              </span>
            </li>
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
            {/*
              One phrasing for one status. A language audit in September 2026 found the module
              saying this three ways on three surfaces, of which "draft review" was the most
              cryptic. This now matches the sentence the Sources panel below it prints.
            */}
            <strong>Pathway</strong> VV + peripheral VA · clinical and device review pending
          </span>
        </section>

        <SourcesPanel publicationStatus={cardiohelpEcmoPublicationStatus} />
      </div>
    </CardiohelpModuleFrame>
  )
}
