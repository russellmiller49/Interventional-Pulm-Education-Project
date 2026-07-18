'use client'

import { useState } from 'react'

import {
  baxterCrrtCrossDeviceTransferCapstone,
  scoreBaxterCrrtCrossDeviceTransfer,
  type CrrtCrossDeviceTransferDomainId,
} from '../content/crossDeviceTransfer'
import styles from './crrt-cross-device-transfer-review.module.css'

export function CrrtCrossDeviceTransferReview() {
  const [answers, setAnswers] = useState<Partial<Record<CrrtCrossDeviceTransferDomainId, string>>>(
    {},
  )
  const result = scoreBaxterCrrtCrossDeviceTransfer(answers)

  return (
    <section
      className={styles.shell}
      aria-labelledby="crrt-cross-device-capstone-heading"
      data-reviewer-only="false"
      data-clinically-interchangeable="false"
    >
      <header className={styles.header}>
        <div>
          <span>Workflow translation</span>
          <h2 id="crrt-cross-device-capstone-heading">
            {baxterCrrtCrossDeviceTransferCapstone.title}
          </h2>
        </div>
        <strong>Pass ≥ {baxterCrrtCrossDeviceTransferCapstone.minimumScore}%</strong>
      </header>
      <p className={styles.boundary}>
        Translate shared reasoning while relearning each device’s screens, vocabulary, calculations,
        alarms, and controls. This capstone does not claim that PrisMax and Prismaflex are
        clinically interchangeable.
      </p>
      <ol className={styles.domainList}>
        {baxterCrrtCrossDeviceTransferCapstone.domains.map((domain) => (
          <li key={domain.id} data-source-ids={domain.sourceRecordIds.join(' ')}>
            <h3>{domain.sharedClinicalGoal}</h3>
            <dl>
              <div>
                <dt>PrisMax</dt>
                <dd>{domain.prismaxExpression}</dd>
              </div>
              <div>
                <dt>Prismaflex</dt>
                <dd>{domain.prismaflexExpression}</dd>
              </div>
            </dl>
            <fieldset>
              <legend>{domain.transferPrompt}</legend>
              {domain.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name={`transfer-${domain.id}`}
                    value={option.id}
                    checked={answers[domain.id] === option.id}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [domain.id]: event.target.value,
                      }))
                    }
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <p role="status">
        {result.completed
          ? `Score ${result.score}%. ${result.passed ? 'Transfer capstone complete.' : 'Revisit the device-specific distinctions.'}`
          : 'Complete all five transfer domains to score the capstone.'}
      </p>
    </section>
  )
}
