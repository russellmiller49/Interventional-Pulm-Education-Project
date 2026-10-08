'use client'

import { lazy, Suspense } from 'react'
import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import { mcsDeviceProfiles, mcsReleaseGates } from '../content'
import { MCS_DEVICE_INCREMENTS } from '../content/deviceIncrements'
import {
  MCS_HUB_AUDIENCE,
  MCS_HUB_OBJECTIVES,
  MCS_HUB_REFRESHER,
  MCS_HUB_TIME_NOTE,
} from '../content/hubObjectives'
import { mcsLearnSectionHref, mcsPathway } from '../content/pathwayResolver'
import { mcsPathwayComposition } from '../content/pathwayResolver'
import { ImpellaVariantPreview } from './ImpellaVariantPreview'
import { McsCommonModel } from './McsCommonModel'
import { McsContinueCta } from './McsContinueCta'
import { McsGlossary } from './McsGlossary'
import { McsModuleFrame } from './McsModuleFrame'
import { McsStoredPathwayAccordion } from './McsPathwayAccordion'
import { McsRouteOrientation } from './McsRouteOrientation'
import { McsSourcesPanel } from './McsSourcesPanel'
import { McsSourceReviewNotice } from './McsClaimSourceChecks'
import { McsSupportPathwayCards } from './McsSupportPathwayCards'
import styles from './mechanical-circulatory-support.module.css'

const EcmoCannulationPreview = lazy(() =>
  import('./EcmoCannulationPreview').then((module) => ({
    default: module.EcmoCannulationPreview,
  })),
)

/**
 * The hub: one door, one map.
 *
 * It used to open on an encyclopedia — the whole common model, eight pathway cards, three device
 * cards, comparison pathways, two previews, a reasoning loop, cross-links and the sources — with
 * two different "start" links and no Continue. Now it is two sentences, the one Continue every
 * surface resolves through, the pathway as five groups, and the three routes. Everything a learner
 * would go looking for is still here, folded under a reference heading rather than in the way.
 */
export function McsHub({ locale = 'en' }: { locale?: string }) {
  const composition = mcsPathwayComposition()
  const sections = mcsPathway().sections

  return (
    <McsModuleFrame locale={locale} activeHref={mechanicalCirculatorySupportNavBase}>
      <section className={styles.hubHero}>
        <div>
          <span className={styles.kicker}>SELF-PACED LEARNING</span>
          <h1>Mechanical Circulatory Support ICU Lab</h1>
          {/*
           * Who it is for, what a learner will be able to do, and one way in (F02). The hero opened
           * on "One circulation, one monitor, one map… walk the loop every device is drawn on" —
           * true, and meaningless to someone who has not yet met "the loop" or "the common model".
           * Each objective is linked to the sections that teach it, so none is a promise the
           * module does not keep.
           */}
          <p data-hub-audience>
            {MCS_HUB_AUDIENCE.who} {MCS_HUB_AUDIENCE.assumes}
          </p>
          <McsSourceReviewNotice />
          <div className={styles.hubObjectives} data-hub-objectives>
            <h2 id="mcs-hub-objectives-heading">After this module you will be able to</h2>
            <ol aria-labelledby="mcs-hub-objectives-heading">
              {MCS_HUB_OBJECTIVES.map((objective) => (
                <li key={objective.id} data-hub-objective={objective.id}>
                  {objective.statement}{' '}
                  <span className={styles.hubObjectiveSections}>
                    {objective.sectionIds.map((sectionId, index) => {
                      const position = sections.findIndex((section) => section.id === sectionId)
                      return (
                        <span key={sectionId}>
                          {index > 0 ? ' · ' : ''}
                          <Link href={mcsLearnSectionHref(sectionId)}>Section {position + 1}</Link>
                        </span>
                      )
                    })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.heroActions}>
            <McsContinueCta />
            <a href="#mcs-hub-pathway">Browse all {composition.total} sections</a>
          </div>
          <p className={styles.hubComposition} data-pathway-composition>
            {composition.sentence}
          </p>
          <p className={styles.hubTimeNote} data-hub-time-note>
            {MCS_HUB_TIME_NOTE}
          </p>
          {/* The refresher is an offer, not a gate: nothing waits on it and nothing checks it. */}
          <p className={styles.hubRefresher} data-hub-refresher>
            <strong>{MCS_HUB_REFRESHER.label}.</strong> {MCS_HUB_REFRESHER.sentence}{' '}
            <Link href={MCS_HUB_REFRESHER.href}>{MCS_HUB_REFRESHER.linkLabel}</Link>.
          </p>
        </div>
        <aside className={styles.progressCard} aria-label="Saved module progress">
          <span>PERSONAL HISTORY</span>
          <strong>Stored locally</strong>
          <p>
            Topic visits and your last location are remembered in this browser. Resume returns to
            that location with a fresh model; previous controls and answers are not replayed.
          </p>
          <small>No ranking, comparison, or claim about what you know.</small>
        </aside>
      </section>

      <section className={styles.pathwaySection} aria-labelledby="mcs-hub-pathway-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>THE PATHWAY</span>
          <h2 id="mcs-hub-pathway-heading">{composition.total} sections, in one order</h2>
          <p>
            The common model first, then each device as the model plus a counted number of new
            ideas, then integration with patient assessment. Every section opens from its own link;
            the order is a recommendation, not a lock.
          </p>
          <ul className={styles.incrementList} data-track-increments>
            {MCS_DEVICE_INCREMENTS.filter((increment) => increment.track !== 'integration').map(
              (increment) => (
                <li key={increment.track}>{increment.sentence}</li>
              ),
            )}
          </ul>
        </div>
        <McsStoredPathwayAccordion id="mcs-hub-pathway" />
      </section>

      <McsRouteOrientation />

      <section className={styles.referenceSection} aria-labelledby="mcs-reference-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>REFERENCE</span>
          <h2 id="mcs-reference-heading">The common model, the pathways, and the sources</h2>
          <p>
            Everything the sections teach, laid out for looking things up rather than for reading in
            order. Each block is folded; open the one you need.
          </p>
        </div>
        <details className={styles.referenceBlock} data-reference="glossary">
          <summary>Glossary, abbreviations and device names</summary>
          <McsGlossary />
        </details>
        <details className={styles.referenceBlock} data-reference="common-model">
          <summary>The common model: seven questions, four levels, three flow lines</summary>
          <McsCommonModel variant="front-door" />
        </details>
        <details className={styles.referenceBlock} data-reference="pathways">
          <summary>The eight support pathways, compared</summary>
          <McsSupportPathwayCards />
        </details>
        <details className={styles.referenceBlock} data-reference="devices">
          <summary>The three simulated devices and where they are compared</summary>
          <div className={styles.trackGrid}>
            {mcsDeviceProfiles.map((profile) => (
              <article key={profile.kind}>
                <span>{profile.category}</span>
                <h3>{profile.displayName}</h3>
                <p>{profile.mechanism}</p>
                <Link href={`${mechanicalCirculatorySupportNavBase}/learn?device=${profile.kind}`}>
                  Open the first section on this device <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}
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
          <Suspense
            fallback={<div className={styles.ecmoCannulationFallback}>Loading 3D preview…</div>}
          >
            <EcmoCannulationPreview />
          </Suspense>
          <ImpellaVariantPreview />
        </details>
        <details className={styles.referenceBlock} data-reference="sources">
          <summary>Sources, device revisions, and the model card</summary>
          <McsSourcesPanel />
        </details>
        {/*
         * Review status and what is still open, kept and placed with the reference (F02). The
         * status line stays in the open — the module is a preview pending clinical review, and a
         * learner should know it — while the reviewer's checklist is one click further in, where
         * it no longer competes with the way into the module.
         */}
        <div className={styles.releaseReview} data-review-governance>
          <strong>Preview · pending clinical review</strong>
          <p>
            Device responses here are bounded teaching approximations. Nothing in this module is a
            source for a device specification, and device selection, timing, and escalation remain
            team decisions under current manufacturer instructions and local protocol.
          </p>
          <details data-reviewer-layer>
            <summary>For reviewers: what is still open before publication</summary>
            <p>
              Publication awaits review by an advanced-heart-failure/MCS physician and an ICU nurse,
              APP, perfusionist, or clinical engineer, covering the clinical content, device
              revision, model behavior, accessibility, 3D provenance, and safety boundaries.
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
        </div>
      </section>
    </McsModuleFrame>
  )
}
