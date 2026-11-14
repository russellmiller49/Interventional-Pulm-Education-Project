'use client'

import { lazy, Suspense } from 'react'
import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import { mcsDeviceProfiles } from '../content'
import { MCS_DEVICE_INCREMENTS } from '../content/deviceIncrements'
import {
  MCS_HUB_AUDIENCE,
  MCS_HUB_OBJECTIVES,
  MCS_HUB_REFRESHER,
  MCS_HUB_TIME_NOTE,
} from '../content/hubObjectives'
import { mcsLearnSectionHref, mcsPathway, mcsPathwayComposition } from '../content/pathwayResolver'
import { ImpellaVariantPreview } from './ImpellaVariantPreview'
import { McsCommonModel } from './McsCommonModel'
import { McsContinueCta } from './McsContinueCta'
import { McsGlossary } from './McsGlossary'
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
 * two different "start" links and no Continue. Then it opened on an audience paragraph, five
 * objectives, a time note, a refresher and a history card before the pathway, and the ECMO tester
 * (2026-10-13) asked of that shape: "one thing to do, then what is all the other stuff for?"
 *
 * Now the hero is one line and the one Continue every surface resolves through, the pathway is
 * directly under it, and everything else — who the module is for, what a learner will be able to
 * do, how it is organised, and the reference material — sits in one closed "About this module".
 */
export function McsHub({ locale = 'en' }: { locale?: string }) {
  const composition = mcsPathwayComposition()
  const sections = mcsPathway().sections

  return (
    <McsModuleFrame locale={locale} activeHref={mechanicalCirculatorySupportNavBase}>
      <header className={styles.hubHero} data-hub-hero>
        <div>
          <h1>Mechanical Circulatory Support ICU Lab</h1>
          <p data-hub-summary>
            IABP, Impella and durable LVAD support for the adult ICU, on one simulated circulation.
            Work through the sections in order.
          </p>
          <div className={styles.heroActions}>
            <McsContinueCta />
          </div>
        </div>
      </header>

      <section className={styles.pathwaySection} aria-labelledby="mcs-hub-pathway-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>THE PATHWAY</span>
          <h2 id="mcs-hub-pathway-heading">{composition.total} sections, in one order</h2>
          <p>
            The common model first, then each device as the common model plus its new ideas, then
            integration with patient evaluation.
          </p>
          <p className={styles.hubComposition} data-pathway-composition>
            {composition.sentence}
          </p>
        </div>
        <McsStoredPathwayAccordion id="mcs-hub-pathway" />
      </section>

      {/*
        Everything that is not the way in, one click away.

        Each of these is still true and still wanted by someone, and none of it is needed to begin.
        The objectives keep their links to the sections that teach them, so none is a promise the
        module does not keep.
      */}
      <details className={styles.hubAbout} data-hub-about>
        <summary>
          <h2 id="mcs-hub-about-heading">About this module</h2>
          <span>
            Who it is for, what you will be able to do, how it is organised, and reference
          </span>
        </summary>
        <div className={styles.hubAboutBody}>
          <section aria-labelledby="mcs-hub-audience-heading">
            <h3 id="mcs-hub-audience-heading">Who it is for</h3>
            <p data-hub-audience>
              {MCS_HUB_AUDIENCE.who} {MCS_HUB_AUDIENCE.assumes}
            </p>
            {/* The refresher is an offer, not a gate: nothing waits on it and nothing checks it. */}
            <p className={styles.hubRefresher} data-hub-refresher>
              <strong>{MCS_HUB_REFRESHER.label}.</strong> {MCS_HUB_REFRESHER.sentence}{' '}
              <Link href={MCS_HUB_REFRESHER.href}>{MCS_HUB_REFRESHER.linkLabel}</Link>.
            </p>
          </section>

          <section className={styles.hubObjectives} data-hub-objectives>
            <h3 id="mcs-hub-objectives-heading">After this module you will be able to</h3>
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
          </section>

          <section aria-labelledby="mcs-route-orientation-heading">
            <h3 id="mcs-route-orientation-heading">How it is organised</h3>
            <McsRouteOrientation />
            <p>In Learn, each device builds on the one before it:</p>
            <ul className={styles.incrementList} data-track-increments>
              {MCS_DEVICE_INCREMENTS.filter((increment) => increment.track !== 'integration').map(
                (increment) => (
                  <li key={increment.track}>{increment.sentence}</li>
                ),
              )}
            </ul>
            <p className={styles.hubTimeNote} data-hub-time-note>
              {MCS_HUB_TIME_NOTE}
            </p>
            <p className={styles.hubTimeNote} data-hub-progress-note>
              The sections you have opened and your last place are kept in this browser, and Resume
              takes you back to that place.
            </p>
          </section>

          <section aria-labelledby="mcs-reference-heading">
            <h3 id="mcs-reference-heading">Reference</h3>
            <p>Everything the sections teach, laid out for looking things up.</p>
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
                    <Link
                      href={`${mechanicalCirculatorySupportNavBase}/learn?device=${profile.kind}`}
                    >
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
                    TandemHeart-type physiology can unload the left atrium and add flow, but
                    insertion, cannulation, and operational controls remain out of scope.
                  </p>
                </article>
                <article>
                  <span>TEMPORARY RV SUPPORT</span>
                  <h3>Right atrium → pump → pulmonary artery</h3>
                  <p>
                    RA-to-PA support bypasses the failing RV. This module uses it as a comparison
                    when diagnosing RV-limited LV-device flow.
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
          </section>
        </div>
      </details>
    </McsModuleFrame>
  )
}
