import type { Route } from 'next'
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import type { CriticalCareIcuScenarioReadiness } from '@/features/critical-care/progress/integrated'

import styles from './icu-simulation.module.css'

export interface IcuRemediationLinksProps {
  readonly readiness: CriticalCareIcuScenarioReadiness
  readonly heading?: string
  readonly onlyIncomplete?: boolean
  readonly showCompletion?: boolean
}

/** Shared direct-refresher surface used before a capstone and again in its debrief. */
export function IcuRemediationLinks({
  readiness,
  heading = 'Focused refreshers',
  onlyIncomplete = false,
  showCompletion = true,
}: IcuRemediationLinksProps) {
  const requirements = onlyIncomplete
    ? readiness.requirements.filter((requirement) => !requirement.completed)
    : readiness.requirements

  if (requirements.length === 0) {
    return (
      <div className={styles.remediationComplete} role="status">
        <CheckCircle2 aria-hidden="true" />
        <p>
          <strong>Focused preparation complete.</strong> Continue into the integrated course when
          ready.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.remediationLinks}>
      <h3>{heading}</h3>
      <ul>
        {requirements.map((requirement) => (
          <li key={requirement.id} data-complete={requirement.completed || undefined}>
            {showCompletion ? (
              requirement.completed ? (
                <CheckCircle2 aria-label="Preparation complete" />
              ) : (
                <Circle aria-label="Preparation not yet complete" />
              )
            ) : null}
            <div>
              <strong>{requirement.label}</strong>
              <p>{requirement.rationale}</p>
              <div className={styles.remediationActions}>
                {requirement.refreshers.map((refresher) => (
                  <Link key={refresher.activity.id} href={refresher.href as Route}>
                    {refresher.activity.title}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
