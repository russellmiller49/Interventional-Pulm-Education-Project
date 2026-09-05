'use client'

import { useId, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { VENTILATION_CONTROL_PANEL } from '../content/controlPanel'
import {
  nextIncompleteVentilationSection,
  ventilationCompositionLine,
  ventilationPathwayComposition,
} from '../content/pathwayResolver'
import { readProgress as readCaseProgress } from '../engine/progress'
import type { VentilatorDeviceId } from '../engine/types'
import { MechanicalVentilationModuleFrame } from './MechanicalVentilationModuleFrame'
import { SourcesPanel } from './SourcesPanel'
import { VentilationPathwayAccordion } from './VentilationPathwayAccordion'
import { readDevicePreference, saveDevicePreference } from './stage/useVentilationLabSession'
import styles from './mechanical-ventilation-hub.module.css'
import { useVentilationLabProgress } from './useVentilationLabProgress'

/**
 * The hub: one door, one map.
 *
 * A hero with exactly one primary call to action — Continue, resolving to the learner's next
 * incomplete section through the same function every other entry surface uses — the composition of
 * the pathway derived from the registry, the map browsed in place, how the module works, and the
 * console the facsimile will show. Progress is read from the same saved record the sections write.
 */
export function MechanicalVentilationHub({ locale = 'en' }: { readonly locale?: string }) {
  const { progress, ready } = useVentilationLabProgress()
  const [browsing, setBrowsing] = useState(false)
  const [device, setDevice] = useState<VentilatorDeviceId | null>(null)
  const accordionId = useId()
  const next = nextIncompleteVentilationSection(progress)
  const composition = ventilationPathwayComposition()
  const completedCases = ready ? new Set(readCaseProgress().completedCases) : new Set<string>()
  const chosenDevice = device ?? (ready ? readDevicePreference() : 'hamilton-c6')

  return (
    <MechanicalVentilationModuleFrame locale={locale} activeHref={mechanicalVentilationNavBase}>
      <div data-hydrated={ready}>
        <header className={styles.hero}>
          <h1>Mechanical Ventilation</h1>
          <p>
            Fourteen short sections on a running ventilator: follow one normal breath from start to
            finish, learn the five things you can change, then take one mechanism at a time on the
            live patient — predict, make the change, watch, and explain. Clinical cases apply each
            mechanism, and an independent knowledge check closes the module.
          </p>
          <div className={styles.entryActions}>
            {next ? (
              <Link
                className={styles.continue}
                data-ventilation-continue={ready ? 'resolved' : 'pending'}
                href={next.href}
              >
                <ArrowRight aria-hidden="true" />
                <span>
                  <strong>
                    {next.inProgress ? 'Resume' : 'Continue'} — {next.unit.title}
                  </strong>
                  <small>
                    Section {next.index + 1} of {composition.total} · {next.unit.minutes} minutes
                  </small>
                </span>
              </Link>
            ) : (
              <p className={styles.done} data-ventilation-continue="complete">
                Every section is worked through. Revisit any of them below, apply them in Practice,
                or take the knowledge check.
              </p>
            )}
          </div>
        </header>

        <section className={styles.section} aria-labelledby="mv-hub-pathway">
          <div className={styles.sectionHeading}>
            <h2 id="mv-hub-pathway">The pathway</h2>
            <span>Grouped by stage · open any section · your progress stays on this device</span>
          </div>
          <p className={styles.composition}>{ventilationCompositionLine()}</p>
          <button
            type="button"
            className={styles.browseToggle}
            aria-expanded={browsing}
            aria-controls={accordionId}
            onClick={() => setBrowsing((current) => !current)}
          >
            Browse all {composition.total} sections
            <ChevronDown aria-hidden="true" />
          </button>
          <div className={styles.browsePanel} id={accordionId} hidden={!browsing}>
            {browsing ? (
              <>
                <VentilationPathwayAccordion
                  progress={progress}
                  completedCaseIds={completedCases}
                />
                <Link className={styles.pathwayLink} href={`${mechanicalVentilationNavBase}/learn`}>
                  Open the pathway page
                </Link>
              </>
            ) : null}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="mv-hub-how">
          <h2 id="mv-hub-how">How this module works</h2>
          <ol className={styles.layers}>
            <li>
              <Link href={`${mechanicalVentilationNavBase}/learn`}>Learn</Link>
              <span>
                one ordered pathway of {composition.total} sections on the simulated console: the
                breath, the controls, then one mechanism at a time, each section a prediction, a
                change you make, and a response you watch.
              </span>
            </li>
            <li>
              <Link href={`${mechanicalVentilationNavBase}/practice`}>Practice</Link>
              <span>
                {composition.cases} clinical cases that apply what the sections taught — commit a
                mechanism, act, reassess, debrief — each paired to the section that taught it.
              </span>
            </li>
            <li>
              <Link href={`${mechanicalVentilationNavBase}/assess`}>Assess</Link>
              <span>
                an independent knowledge check once the sections are worked through, and challenge
                cases with less prompting.
              </span>
            </li>
          </ol>
          <ul className={styles.principles} aria-label="How the sections teach">
            <li>
              <strong>One breath</strong>
              Every term is introduced at its place on one breath — the start, the push, the switch,
              the emptying — and a breath map keeps you oriented in every section.
            </li>
            <li>
              <strong>Five controls</strong>
              {VENTILATION_CONTROL_PANEL.sentence} {VENTILATION_CONTROL_PANEL.monitoringSentence}
            </li>
            <li>
              <strong>Predict before you see</strong>
              Each section asks for your prediction before the change is made. The explanation opens
              only after you commit.
            </li>
            <li>
              <strong>Trend, not threshold</strong>
              The sections teach direction and pattern against this patient’s own baseline. Numeric
              bands appear only with a source.
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="mv-hub-console">
          <h2 id="mv-hub-console">Which console you will see</h2>
          <p>
            Four original facsimiles teach the same physiology. Choose the one closest to your unit;
            you can change it again from inside a section before its first prediction.
          </p>
          <div className={styles.consoles} role="radiogroup" aria-label="Training console">
            {ventilatorDeviceProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                role="radio"
                className={styles.consoleChoice}
                aria-checked={chosenDevice === profile.id}
                onClick={() => {
                  saveDevicePreference(profile.id)
                  setDevice(profile.id)
                }}
              >
                {profile.displayName}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            The facsimiles paraphrase each vendor’s screen. They are not manufacturer training, and
            working through them establishes nothing about bedside readiness.
          </p>
        </section>

        <SourcesPanel deviceId={chosenDevice} />
      </div>
    </MechanicalVentilationModuleFrame>
  )
}
