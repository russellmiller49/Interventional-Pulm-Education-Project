import styles from './learning-module-v2.module.css'

export interface PatientContextItem {
  readonly label: string
  readonly value: string
}

export interface PatientContextBarProps {
  readonly title?: string
  readonly items: readonly PatientContextItem[]
  readonly immediateGoal: string
  readonly safetyConstraints?: readonly string[]
}

export function PatientContextBar({
  title = 'Patient context',
  items,
  immediateGoal,
  safetyConstraints = [],
}: PatientContextBarProps) {
  return (
    <section className={styles.panelSection}>
      <h2 className={styles.panelHeading}>{title}</h2>
      <dl className={styles.contextList}>
        {items.map((item) => (
          <div key={`${item.label}:${item.value}`} className={styles.contextItem}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.goalCard}>
        <strong>Immediate goal</strong>
        <p>{immediateGoal}</p>
      </div>
      {safetyConstraints.length > 0 ? (
        <div>
          <h3 className={styles.panelHeading}>Safety constraints</h3>
          <ul className={styles.safetyList}>
            {safetyConstraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
