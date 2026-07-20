'use client'

import { useEffect, useState } from 'react'
import { Activity, ArrowRight, HeartPulse, ShieldCheck } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import { mcsDeviceProfiles, mcsLessons, mcsPracticeScenarios, mcsReleaseGates } from '../content'
import {
  createDefaultMcsProgress,
  mcsProgressPercent,
  readMcsProgress,
  type McsProgressV1,
} from '../engine'
import { ImpellaVariantPreview } from './ImpellaVariantPreview'
import { McsModuleFrame } from './McsModuleFrame'
import { McsSourcesPanel } from './McsSourcesPanel'
import styles from './mechanical-circulatory-support.module.css'

const deviceAccent = { iabp: 'amber', impella: 'cyan', lvad: 'rose' } as const

export function McsHub({ locale = 'en' }: { locale?: string }) {
  const [progress, setProgress] = useState<McsProgressV1>(createDefaultMcsProgress)
  useEffect(() => {
    const timer = window.setTimeout(() => setProgress(readMcsProgress()), 0)
    return () => window.clearTimeout(timer)
  }, [])
  const completion = mcsProgressPercent(progress)

  return (
    <McsModuleFrame locale={locale} activeHref={mechanicalCirculatorySupportNavBase}>
      <section className={styles.hubHero}>
        <div>
          <span className={styles.kicker}>LEARN → PRACTICE → ASSESS</span>
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
          <span>LOCAL PROGRESS</span>
          <strong>{completion}%</strong>
          <div>
            <i style={{ width: `${completion}%` }} />
          </div>
          <p>
            {progress.completedLessonIds.length}/8 lessons · {progress.masteredCaseIds.length}/9
            practice cases mastered
          </p>
          <small>
            Stored in this browser. Only coarse completion and score bands are eligible for
            analytics.
          </small>
        </aside>
      </section>

      <section className={styles.statsBand} aria-label="Module scope">
        <div>
          <HeartPulse aria-hidden="true" />
          <strong>{mcsLessons.length}</strong>
          <span>guided lessons</span>
        </div>
        <div>
          <Activity aria-hidden="true" />
          <strong>{mcsPracticeScenarios.length}</strong>
          <span>practice cases</span>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" />
          <strong>80%</strong>
          <span>mastery + no critical error</span>
        </div>
      </section>

      <section className={styles.trackSection} aria-labelledby="mcs-tracks-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>THREE DISTINCT MECHANISMS</span>
          <h2 id="mcs-tracks-heading">See what the device moves—and what it cannot fix</h2>
          <p>
            Every track uses the same circulation and monitor, making differences in timing,
            unloading, preload dependence, afterload sensitivity, and recirculation directly
            comparable.
          </p>
        </div>
        <div className={styles.trackGrid}>
          {mcsDeviceProfiles.map((profile) => (
            <article key={profile.kind} data-accent={deviceAccent[profile.kind]}>
              <span>{profile.category}</span>
              <h3>{profile.displayName}</h3>
              <p>{profile.mechanism}</p>
              <dl>
                <div>
                  <dt>Learn</dt>
                  <dd>2 device lessons</dd>
                </div>
                <div>
                  <dt>Practice</dt>
                  <dd>3 cases</dd>
                </div>
                <div>
                  <dt>Assess</dt>
                  <dd>1 unseen capstone</dd>
                </div>
              </dl>
              <Link href={`${mechanicalCirculatorySupportNavBase}/learn`}>
                Enter track <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
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

      <section className={styles.reviewGate}>
        <strong>Preview release gate</strong>
        <p>
          Publication remains blocked until an advanced-heart-failure/MCS physician and an ICU
          nurse, APP, perfusionist, or clinical engineer review the clinical content, device
          revision, model behavior, accessibility, 3D provenance, and safety boundaries.
        </p>
        <details>
          <summary>Show {mcsReleaseGates.length}-item release checklist</summary>
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
