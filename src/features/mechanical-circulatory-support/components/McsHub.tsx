'use client'

import { lazy, Suspense } from 'react'
import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import { mcsDeviceProfiles, mcsReleaseGates } from '../content'
import { MCS_DEVICE_INCREMENTS } from '../content/deviceIncrements'
import { mcsPathwayComposition } from '../content/pathwayResolver'
import { ImpellaVariantPreview } from './ImpellaVariantPreview'
import { McsCommonModel } from './McsCommonModel'
import { McsContinueCta } from './McsContinueCta'
import { McsModuleFrame } from './McsModuleFrame'
import { McsStoredPathwayAccordion } from './McsPathwayAccordion'
import { McsRouteOrientation } from './McsRouteOrientation'
import { McsSourcesPanel } from './McsSourcesPanel'
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

  return (
    <McsModuleFrame locale={locale} activeHref={mechanicalCirculatorySupportNavBase}>
      <section className={styles.hubHero}>
        <div>
          <span className={styles.kicker}>LEARN → PRACTICE → CHALLENGE</span>
          <h1>Mechanical Circulatory Support ICU Lab</h1>
          <p>
            One circulation, one monitor, one map. Read the pressure and the flow apart, walk the
            loop every device is drawn on, then meet the balloon, the transvalvular pump and the
            durable pump one at a time — each on the same patient, each with one thing to predict
            before anything moves.
          </p>
          <p className={styles.hubComposition} data-pathway-composition>
            {composition.sentence}
          </p>
          <div className={styles.heroActions}>
            <McsContinueCta />
            <a href="#mcs-hub-pathway">Browse all {composition.total} sections</a>
          </div>
        </div>
        <aside className={styles.progressCard} aria-label="Saved module progress">
          <span>PERSONAL HISTORY</span>
          <strong>Stored locally</strong>
          <p>
            Sections you work through are remembered in this browser, and Continue picks up at the
            first one you have not.
          </p>
          <small>No ranking, comparison, or claim about what you know.</small>
        </aside>
      </section>

      <section className={styles.pathwaySection} aria-labelledby="mcs-hub-pathway-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>THE PATHWAY</span>
          <h2 id="mcs-hub-pathway-heading">Nine sections, in one order</h2>
          <p>
            The common model first, then each device as the model plus a counted number of new
            ideas, then the choice among them. Every section opens from its own link; the order is a
            recommendation, not a lock.
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

      <section className={styles.referenceSection} aria-labelledby="mcs-reference-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>REFERENCE</span>
          <h2 id="mcs-reference-heading">The common model, the pathways, and the sources</h2>
          <p>
            Everything the sections teach, laid out for looking things up rather than for reading in
            order. Each block is folded; open the one you need.
          </p>
        </div>
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
        <p className={styles.crossLinkLine}>
          Need a pressure-and-flow refresher first?{' '}
          <Link href="/icu-hemodynamics">Open the ICU Hemodynamics Lab</Link>.
        </p>
      </section>
    </McsModuleFrame>
  )
}
