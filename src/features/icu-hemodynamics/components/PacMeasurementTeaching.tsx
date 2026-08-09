import { ArrowRight, CircleAlert, Gauge, Sigma } from 'lucide-react'

import { HEMODYNAMIC_CLINICAL_THRESHOLDS, hemodynamicDerivedValueGuides } from '../content'
import styles from './icu-hemodynamics.module.css'

function TeachingSourceNote({ children }: { readonly children: string }) {
  return (
    <p className={styles.measurementTeachingSource}>
      <span>Evidence anchor</span>
      {children}
    </p>
  )
}

export function DerivedHemodynamicsTeachingPanel() {
  return (
    <section
      className={styles.measurementTeachingPanel}
      aria-labelledby="derived-hemodynamics-teaching-heading"
    >
      <header>
        <span>Interpret the dependency chain</span>
        <h2 id="derived-hemodynamics-teaching-heading">
          Derived hemodynamics are equations, not new measurements
        </h2>
        <p>
          A calculated value inherits the timing, calibration error, artifact, sampling error, and
          physiologic assumptions of every input. A precise display cannot rescue an invalid
          denominator.
        </p>
      </header>

      <div className={styles.derivedDependencyFlow} aria-label="Derived value dependency chain">
        <span>
          <Gauge className="size-4" aria-hidden="true" />
          Validate direct inputs
        </span>
        <ArrowRight className="size-4" aria-hidden="true" />
        <span>
          <Sigma className="size-4" aria-hidden="true" />
          Calculate with units
        </span>
        <ArrowRight className="size-4" aria-hidden="true" />
        <span>Interpret mechanism and trend</span>
      </div>

      <div className={styles.derivedTeachingGrid}>
        <article>
          <span>Flow and indexing</span>
          <h3>CI = CO ÷ BSA · SV = 1000 × CO ÷ HR</h3>
          <p>
            Indexing helps compare flow across body size, while stroke volume converts minute flow
            to flow per beat. Both still depend on a valid CO.
          </p>
        </article>
        <article>
          <span>Resistance</span>
          <h3>SVR = 80 × (MAP − RAP) ÷ CO</h3>
          <p>
            SVR represents a systemic pressure gradient divided by flow. An artifactually low CO
            inflates calculated resistance; an invalid RAP also changes the gradient.{' '}
            {hemodynamicDerivedValueGuides.systemicVascularResistance.normalRange}{' '}
            {hemodynamicDerivedValueGuides.systemicVascularResistance.caveats}
          </p>
        </article>
        <article>
          <span>Pulmonary load</span>
          <h3>PVR = (mPAP − PAWP) ÷ CO</h3>
          <p>
            PVR requires a valid mean PA pressure, a correctly obtained PAWP, and a valid CO from
            the same physiologic state. Error in any one input changes classification.{' '}
            {hemodynamicDerivedValueGuides.pulmonaryVascularResistance.normalRange}
          </p>
        </article>
        <article>
          <span>Conditional indices</span>
          <h3>PAPi, compliance, CPO, and PPV need context</h3>
          <p>
            {hemodynamicDerivedValueGuides.pulmonaryArteryPulsatilityIndex.actionableThresholds}{' '}
            {hemodynamicDerivedValueGuides.cardiacPowerOutputW.actionableThresholds}{' '}
            {hemodynamicDerivedValueGuides.pulmonaryArteryCompliance.normalRange}
          </p>
        </article>
        <article>
          <span>Conditional dynamic signal</span>
          <h3>
            PPV ≈{HEMODYNAMIC_CLINICAL_THRESHOLDS.pulsePressureVariation.responsivePercent}% is a
            conditional boundary only during a valid maneuver
          </h3>
          <p>
            PPV is withheld unless rhythm, controlled ventilation, effort, tidal volume, chest
            condition, arterial waveform, and RV context pass the validity screen.{' '}
            {hemodynamicDerivedValueGuides.pulsePressureVariationPercent.actionableThresholds}{' '}
            {hemodynamicDerivedValueGuides.pulsePressureVariationPercent.caveats}
          </p>
        </article>
        <article>
          <span>Oxygen balance</span>
          <h3>SvO₂ is usually interpreted around 65–75%, but the trend has four determinants</h3>
          <p>
            Cardiac output, hemoglobin, arterial oxygen saturation, and oxygen consumption all move
            mixed-venous saturation. A normal or high value does not by itself prove adequate tissue
            oxygen use, and a low value does not identify which determinant failed.
          </p>
        </article>
      </div>

      <article className={styles.measurementTeachingCard}>
        <div className={styles.measurementTeachingCardHeading}>
          <CircleAlert className="size-5" aria-hidden="true" />
          <div>
            <span>Four-question validity screen</span>
            <h3>Before interpreting any calculated number</h3>
          </div>
        </div>
        <ol className={styles.measurementTeachingAudit}>
          <li>Which direct measurements feed this formula?</li>
          <li>Were they valid, correctly timed, and obtained in the same physiologic state?</li>
          <li>Which input is the denominator, and how would its error move the result?</li>
          <li>Does the trend cohere with the waveform and bedside perfusion picture?</li>
        </ol>
        <p className={styles.measurementTeachingCallout}>
          If one required input is stale, unzeroed, artifact-contaminated, or unavailable, label the
          result “not interpretable” rather than substituting a normal value.
        </p>
      </article>

      <TeachingSourceNote>
        Bootsma et al. (2021); Korabathina et al. (2012); Mendoza et al. (2007); Michard et al.
        (2000); Mounsey et al. (2026).
      </TeachingSourceNote>
    </section>
  )
}
