'use client'

import { useId, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'

import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import { Link } from '@/i18n/navigation'

import { mechanicalVentilationCaseById } from '../content/runtimeCases'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { VENTILATION_CONTROL_PANEL } from '../content/controlPanel'
import {
  nextSelfPacedVentilationSection,
  ventilationCompositionLine,
  ventilationPathwayComposition,
} from '../content/pathwayResolver'
import type { VentilatorDeviceId } from '../engine/types'
import { MechanicalVentilationModuleFrame } from './MechanicalVentilationModuleFrame'
import { SourcesPanel } from './SourcesPanel'
import { VentilationPathwayAccordion } from './VentilationPathwayAccordion'
import { readDevicePreference, saveDevicePreference } from './stage/useVentilationLabSession'
import styles from './mechanical-ventilation-hub.module.css'
import { useVentilationSelfPacedProgress } from './useVentilationSelfPacedProgress'

/** Open outline and a reading-location suggestion; visits never imply completion or competence. */
export function MechanicalVentilationHub({ locale = 'en' }: { readonly locale?: string }) {
  const { progress, ready } = useVentilationSelfPacedProgress()
  const [browsing, setBrowsing] = useState(false)
  const [device, setDevice] = useState<VentilatorDeviceId | null>(null)
  const accordionId = useId()
  const next = nextSelfPacedVentilationSection(progress)
  const lastCase =
    progress.location?.section !== 'learn'
      ? mechanicalVentilationCaseById.get(progress.location?.id ?? '')
      : undefined
  const composition = ventilationPathwayComposition()
  const visitedCases = new Set(progress.visited)
  const chosenDevice = device ?? (ready ? readDevicePreference() : 'hamilton-c6')

  return (
    <MechanicalVentilationModuleFrame locale={locale} activeHref={mechanicalVentilationNavBase}>
      <div data-hydrated={ready}>
        <header className={styles.hero}>
          <h1>Mechanical Ventilation</h1>
          <p>
            Fourteen short sections on a running ventilator: follow one normal breath from start to
            finish, learn the five things you can change, then take one mechanism at a time on the
            live patient — predict, make the change, watch, and explain. Clinical cases and optional
            worked applications connect the mechanisms. You can open any section and reveal
            explanations without answering.
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
                Revisit any section below or explore the cases.
              </p>
            )}
            {lastCase ? (
              <Link
                className={styles.pathwayLink}
                href={{
                  pathname: '/mechanical-ventilation/practice',
                  query: { case: lastCase.id, device: chosenDevice, mode: 'practice' },
                }}
              >
                Return to {lastCase.title}
              </Link>
            ) : null}
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
                <VentilationPathwayAccordion progress={progress} visitedCaseIds={visitedCases} />
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
                breath, the controls, then one mechanism at a time, each section offers an optional
                prediction, an experiment, and its explanation.
              </span>
            </li>
            <li>
              <Link href={`${mechanicalVentilationNavBase}/practice`}>Practice</Link>
              <span>
                {composition.cases} clinical cases that apply what the sections taught — inspect,
                act, reassess, and explore the explanation — each paired to the section that taught
                it.
              </span>
            </li>
            <li>
              <Link href={`${mechanicalVentilationNavBase}/assess`}>Applications</Link>
              <span>optional worked questions and clinical cases, available from the start.</span>
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
              <strong>Learn, apply, interpret</strong>
              The first five sections begin with a worked explanation. You can predict a response,
              inspect or change the patient, and interpret a captured result. Hints and explanations
              are always available.
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
            you can change it again from inside a section by starting a fresh patient.
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
