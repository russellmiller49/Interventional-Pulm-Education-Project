'use client'

import {
  wedgeValidityChecks,
  wedgeValidityModifiers,
  westZones,
} from '../content/troubleshootingAtlas'
import styles from './icu-hemodynamics.module.css'

/**
 * Schematic of the three West zones. A wedge estimates left atrial pressure only where an
 * uninterrupted column of blood connects the catheter tip to the left atrium, which requires
 * pulmonary venous pressure to exceed alveolar pressure — true only in zone 3.
 */
function WestZoneDiagram() {
  return (
    <svg
      className={styles.westZoneDiagram}
      viewBox="0 0 340 220"
      role="img"
      aria-label="Schematic of the three West lung zones. In zone 1 at the apex, alveolar pressure exceeds arterial and venous pressure. In zone 2 in the mid lung, arterial pressure exceeds alveolar pressure, which exceeds venous pressure. In zone 3 at the base, arterial and venous pressures both exceed alveolar pressure, and only there can an accurate wedge pressure be obtained."
    >
      <path
        className={styles.westZoneLung}
        d="M 96 24 C 62 40, 44 92, 48 154 C 50 186, 66 202, 88 200 C 108 198, 118 178, 120 150 L 124 44 Z"
      />
      <path
        className={styles.westZoneLung}
        d="M 244 24 C 278 40, 296 92, 292 154 C 290 186, 274 202, 252 200 C 232 198, 222 178, 220 150 L 216 44 Z"
      />
      <rect className={styles.westZoneAirway} x="164" y="16" width="12" height="62" rx="6" />

      {westZones.map((zone, index) => {
        const y = 62 + index * 52
        return (
          <g key={zone.zone} data-valid={zone.valid || undefined}>
            <line
              className={zone.valid ? styles.westZoneLineValid : styles.westZoneLine}
              x1="34"
              x2="306"
              y1={y}
              y2={y}
            />
            <text className={styles.westZoneLabel} x="8" y={y - 6}>
              Zone {zone.zone}
            </text>
            <text
              className={zone.valid ? styles.westZoneRelationValid : styles.westZoneRelation}
              x="306"
              y={y - 6}
              textAnchor="end"
            >
              {zone.relationship}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function WedgeValidityPanel() {
  return (
    <section className={styles.wedgeValidityPanel} aria-labelledby="wedge-validity-heading">
      <header className={styles.atlasPanelHeader}>
        <div>
          <span>Before you believe a wedge</span>
          <h3 id="wedge-validity-heading">What makes a wedge pressure valid</h3>
        </div>
      </header>

      <div className={styles.wedgeValidityGrid}>
        <div>
          <h4>West zones</h4>
          <WestZoneDiagram />
          <ul className={styles.westZoneNotes}>
            {westZones.map((zone) => (
              <li key={zone.zone} data-valid={zone.valid || undefined}>
                <strong>
                  Zone {zone.zone} · {zone.region}
                </strong>
                <span>{zone.explanation}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Confirmation checks</h4>
          <ol className={styles.wedgeCheckList}>
            {wedgeValidityChecks.map((check) => (
              <li key={check.id} data-definitive={check.definitive || undefined}>
                <strong>
                  {check.label}
                  {check.definitive ? ' · most confirmatory' : ''}
                </strong>
                <span>{check.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.wedgeModifiers}>
        <h4>What breaks the assumption</h4>
        <ul>
          {wedgeValidityModifiers.map((modifier) => (
            <li key={modifier}>{modifier}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
