'use client'

import { lazy, Suspense } from 'react'
import { Activity, ArrowRight, HeartPulse, ShieldCheck } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import {
  MCS_RECOMMENDED_FIRST_SECTION_ID,
  mcsCapstoneScenarios,
  mcsDeviceProfiles,
  mcsLessons,
  mcsPracticeScenarios,
  mcsReleaseGates,
} from '../content'
import { ImpellaVariantPreview } from './ImpellaVariantPreview'
import { McsCommonModel } from './McsCommonModel'
import { McsModuleFrame } from './McsModuleFrame'
import { McsRouteOrientation } from './McsRouteOrientation'
import { McsSourcesPanel } from './McsSourcesPanel'
import { McsSupportPathwayCards } from './McsSupportPathwayCards'
import styles from './mechanical-circulatory-support.module.css'

const deviceAccent = { iabp: 'amber', impella: 'cyan', lvad: 'rose' } as const
const EcmoCannulationPreview = lazy(() =>
  import('./EcmoCannulationPreview').then((module) => ({
    default: module.EcmoCannulationPreview,
  })),
)

/**
 * Counts are derived, never typed as prose.
 *
 * The module previously carried a hand-written "Eight guided lessons" in the nav and a hand-written
 * "2 device lessons" per track, both of which drifted the moment a ninth section landed. Deriving
 * them means the front door cannot disagree with the pathway rail again.
 */
const recommendedFirstSection = mcsLessons.find(
  (lesson) => lesson.id === MCS_RECOMMENDED_FIRST_SECTION_ID,
)

function trackCounts(kind: (typeof mcsDeviceProfiles)[number]['kind']) {
  return {
    lessons: mcsLessons.filter((lesson) => lesson.device === kind).length,
    practice: mcsPracticeScenarios.filter((scenario) => scenario.device === kind).length,
    challenge: mcsCapstoneScenarios.filter((scenario) => scenario.device === kind).length,
  }
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function McsHub({ locale = 'en' }: { locale?: string }) {
  const sharedSectionCount = mcsLessons.filter((lesson) => lesson.device === 'shared').length

  return (
    <McsModuleFrame locale={locale} activeHref={mechanicalCirculatorySupportNavBase}>
      <section className={styles.hubHero}>
        <div>
          <span className={styles.kicker}>LEARN → PRACTICE → CHALLENGE</span>
          <h1>Mechanical Circulatory Support ICU Lab</h1>
          <p>
            Make a physiologic prediction, change one bounded control, and watch anatomy, pressure,
            native output, pump flow, and effective systemic flow respond together.
          </p>
          <div className={styles.heroActions}>
            <Link href={`${mechanicalCirculatorySupportNavBase}/learn`}>
              Begin foundations <ArrowRight aria-hidden="true" />
            </Link>
            <Link href={`${mechanicalCirculatorySupportNavBase}/practice`}>
              Open Mechanism Studio
            </Link>
          </div>
        </div>
        <aside className={styles.progressCard} aria-label="Saved module progress">
          <span>PERSONAL HISTORY</span>
          <strong>Stored locally</strong>
          <p>
            Activities you work through remain available as private revisit cues in this browser.
          </p>
          <small>No ranking, comparison, or claim about what you know.</small>
        </aside>
      </section>

      <section className={styles.statsBand} aria-label="Module scope">
        <div>
          <HeartPulse aria-hidden="true" />
          <strong>{mcsLessons.length}</strong>
          <span>guided sections</span>
        </div>
        <div>
          <Activity aria-hidden="true" />
          <strong>{mcsPracticeScenarios.length}</strong>
          <span>practice cases</span>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" />
          <strong>Open</strong>
          <span>all cases from the start</span>
        </div>
      </section>

      <McsRouteOrientation />

      <section className={styles.startHere} aria-labelledby="mcs-start-here-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>WHERE TO START</span>
          <h2 id="mcs-start-here-heading">Begin with the model, not with a product</h2>
          <p>
            The recommended first section is{' '}
            <strong>{recommendedFirstSection?.title ?? 'the first foundation section'}</strong>. It
            builds the questions, the four causal levels, and the three flow lines that every later
            section reuses. Nothing here is locked — any section opens directly from its own link,
            in any order.
          </p>
        </div>
        <Link
          href={`${mechanicalCirculatorySupportNavBase}/learn?lesson=${MCS_RECOMMENDED_FIRST_SECTION_ID}`}
        >
          Open the recommended first section <ArrowRight aria-hidden="true" />
        </Link>
      </section>

      <McsCommonModel variant="front-door" />

      <McsSupportPathwayCards />

      <section className={styles.trackSection} aria-labelledby="mcs-tracks-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>THREE DISTINCT MECHANISMS</span>
          <h2 id="mcs-tracks-heading">See what the device moves—and what it cannot fix</h2>
          <p>
            Every track uses the same circulation and monitor, making differences in timing,
            unloading, preload dependence, afterload sensitivity, and recirculation directly
            comparable. The three device tracks sit inside a longer arc: {sharedSectionCount} shared
            sections carry the common model and the cross-device comparison around them, which is
            why the device counts below do not add up to the {mcsLessons.length} in the pathway.
          </p>
        </div>
        <div className={styles.trackGrid}>
          {mcsDeviceProfiles.map((profile) => {
            const counts = trackCounts(profile.kind)
            return (
              <article key={profile.kind} data-accent={deviceAccent[profile.kind]}>
                <span>{profile.category}</span>
                <h3>{profile.displayName}</h3>
                <p>{profile.mechanism}</p>
                <dl>
                  <div>
                    <dt>Learn</dt>
                    <dd>{plural(counts.lessons, 'device section')}</dd>
                  </div>
                  <div>
                    <dt>Practice</dt>
                    <dd>{plural(counts.practice, 'case')}</dd>
                  </div>
                  <div>
                    <dt>Challenge</dt>
                    <dd>{plural(counts.challenge, 'harder case')}</dd>
                  </div>
                </dl>
                <Link href={`${mechanicalCirculatorySupportNavBase}/learn?device=${profile.kind}`}>
                  Enter track <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.comparisonSection} aria-labelledby="mcs-comparison-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>COMPARISON PATHWAYS</span>
          <h2 id="mcs-comparison-heading">
            Locate other support without duplicating their simulators
          </h2>
          <p>
            Use the source and return compartments to compare mechanisms, then continue to the
            dedicated lab or supervised device curriculum.
          </p>
        </div>
        <div className={styles.comparisonGrid}>
          <article>
            <span>ECMO</span>
            <h3>Venous drainage → extracorporeal circuit → venous or arterial return</h3>
            <p>
              Gas exchange and circulatory effects depend on VV versus VA configuration. Full
              interaction lives in the CARDIOHELP module.
            </p>
            <Link href="/cardiohelp-ecmo">
              Open ECMO lab <ArrowRight aria-hidden="true" />
            </Link>
          </article>
          <article>
            <span>TRANSSEPTAL LA SUPPORT</span>
            <h3>Left atrium → centrifugal pump → systemic artery</h3>
            <p>
              TandemHeart-type physiology can unload the left atrium and add flow, but insertion,
              cannulation, and operational controls remain out of scope.
            </p>
          </article>
          <article>
            <span>TEMPORARY RV SUPPORT</span>
            <h3>Right atrium → pump → pulmonary artery</h3>
            <p>
              RA-to-PA support bypasses the failing RV. This release uses it as a comparison when
              diagnosing RV-limited LV-device flow.
            </p>
          </article>
        </div>
      </section>

      <Suspense
        fallback={<div className={styles.ecmoCannulationFallback}>Loading 3D preview…</div>}
      >
        <EcmoCannulationPreview />
      </Suspense>

      <ImpellaVariantPreview />

      <section className={styles.workflowSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>CLINICAL REASONING LOOP</span>
          <h2>Commit before you touch the controls</h2>
        </div>
        <ol>
          {['Inspect', 'Predict', 'Commit', 'Adjust', 'Observe', 'Reassess', 'Debrief'].map(
            (step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
              </li>
            ),
          )}
        </ol>
      </section>

      <section className={styles.crossLinks}>
        <div>
          <span>SHARED PHYSIOLOGY</span>
          <h2>Need a pressure-and-flow refresher?</h2>
          <p>Use the ICU Hemodynamics Lab for PAC waveforms, measurements, and shock phenotypes.</p>
          <Link href="/icu-hemodynamics">
            Open ICU Hemodynamics <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div>
          <span>COMPARISON PATHWAY</span>
          <h2>Need extracorporeal support?</h2>
          <p>ECMO is compared here but taught in the dedicated CARDIOHELP adult VV/VA lab.</p>
          <Link href="/cardiohelp-ecmo">
            Open CARDIOHELP ECMO <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/*
        The preview warning stays in the primary path because a learner has to know what they are
        reading. The governance detail behind it — who has to sign off, which gates are open, what
        evidence each carries — is reviewer material, and a first-year fellow trying to learn
        mechanical support does not need to read a release checklist to get started.
      */}
      <section className={styles.releaseReview} data-review-governance>
        <strong>Preview · pending clinical review</strong>
        <p>
          Device responses here are bounded teaching approximations. Nothing in this module is a
          source for a device specification, and device selection, timing, and escalation remain
          team decisions under current manufacturer instructions and local protocol.
        </p>
        <details data-reviewer-layer>
          <summary>Reviewer detail: what is still open before publication</summary>
          <p>
            Publication awaits review by an advanced-heart-failure/MCS physician and an ICU nurse,
            APP, perfusionist, or clinical engineer, covering the clinical content, device revision,
            model behavior, accessibility, 3D provenance, and safety boundaries.
          </p>
          <ul>
            {mcsReleaseGates.map((gate) => (
              <li key={gate.id} data-complete={gate.complete}>
                {gate.complete ? 'Complete' : 'Pending'} · {gate.label}
                {gate.evidence ? <small>{gate.evidence}</small> : null}
              </li>
            ))}
          </ul>
        </details>
      </section>
      <McsSourcesPanel />
    </McsModuleFrame>
  )
}
