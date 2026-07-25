import { HEMODYNAMIC_CLINICAL_THRESHOLDS, hemodynamicsSources } from '../content'
import styles from './icu-hemodynamics.module.css'

export function SourcesPanel() {
  return (
    <section className={styles.sourcesPanel} aria-labelledby="sources-heading">
      <div>
        <span>Evidence registry · versioned</span>
        <h2 id="sources-heading">Sources, definitions, and model limits</h2>
        <p>
          Every case maps to registry IDs below. Current guidance supersedes older thresholds in the
          supplied master document.
        </p>
      </div>
      <div className={styles.definitionCallout}>
        <strong>Current pulmonary hypertension definition used here</strong>
        <p>
          mPAP &gt;{HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension.meanPapMmHg} mmHg.
          Pre-capillary/PAH physiology requires PAWP ≤
          {HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension.preCapillaryPawpMaxMmHg} mmHg and
          PVR &gt;{HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension.elevatedPvrWoodUnits} WU.
          The treatment evidence between{' '}
          {HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension.elevatedPvrWoodUnits} and 3 WU
          remains less certain; classification is not a treatment recommendation.
        </p>
      </div>
      <div className={styles.sourceGrid}>
        {hemodynamicsSources.map((source) => (
          <article key={source.id}>
            <span>
              {source.sourceType} · {source.version}
            </span>
            <h3>{source.title}</h3>
            <p>{source.citation}</p>
            <small>{source.intendedUse}</small>
            {source.limitation && <em>{source.limitation}</em>}
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer">
                Open source ↗
              </a>
            )}
            {source.suppliedFilename && <code>Supplied: {source.suppliedFilename}</code>}
          </article>
        ))}
      </div>
    </section>
  )
}
