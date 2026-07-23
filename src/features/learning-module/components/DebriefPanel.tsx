import { useId, type ReactNode } from 'react'

import styles from './learning-module-v2.module.css'

export interface DebriefPanelProps {
  readonly clinicalModel: string
  readonly actions: readonly string[]
  readonly consequences: readonly string[]
  readonly performanceDomains: readonly { label: string; result: string }[]
  readonly remediation?: ReactNode
  readonly transfer: ReactNode
  readonly replay?: ReactNode
}

export function DebriefPanel({
  clinicalModel,
  actions,
  consequences,
  performanceDomains,
  remediation,
  transfer,
  replay,
}: DebriefPanelProps) {
  const headingId = useId()

  return (
    <section className={styles.debrief} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.panelHeading}>
        Causal debrief
      </h2>
      <div className={styles.debriefGrid}>
        <div className={styles.debriefSection}>
          <h3>Your clinical model</h3>
          <p>{clinicalModel}</p>
        </div>
        <div className={styles.debriefSection}>
          <h3>What you did</h3>
          <ol className={styles.debriefList}>
            {actions.map((action, index) => (
              <li key={`${index}:${action}`}>{action}</li>
            ))}
          </ol>
        </div>
        <div className={styles.debriefSection}>
          <h3>What happened</h3>
          <ol className={styles.debriefList}>
            {consequences.map((consequence, index) => (
              <li key={`${index}:${consequence}`}>{consequence}</li>
            ))}
          </ol>
        </div>
        <div className={styles.debriefSection}>
          <h3>Performance domains</h3>
          <dl className={styles.contextList}>
            {performanceDomains.map((domain) => (
              <div key={domain.label} className={styles.contextItem}>
                <dt>{domain.label}</dt>
                <dd>{domain.result}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {remediation ? <div className={styles.debriefSection}>{remediation}</div> : null}
      <div className={styles.debriefSection}>
        <h3>Transfer</h3>
        {transfer}
      </div>
      {replay ? <div className={styles.debriefSection}>{replay}</div> : null}
    </section>
  )
}
