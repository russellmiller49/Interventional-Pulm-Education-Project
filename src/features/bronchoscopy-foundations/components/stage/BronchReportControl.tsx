'use client'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchReport } from '../../content/types'
import type { ReportCommitment } from '../../engine/stageSession'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/**
 * The report builder: each field of the record filled from what the evidence shows. An option
 * the evidence does not support is refused with the reason and the field stays open (A08: normal,
 * not assessed, not safely accessible and not examined are four different statements). The step
 * is done when every field holds a supported statement.
 */
export function BronchReportControl({
  report,
  commitment,
  onOption,
}: {
  readonly report: BronchReport
  readonly commitment: ReportCommitment
  readonly onOption: (fieldId: string, optionId: string, supported: boolean) => void
}) {
  return (
    <div className={styles.act} data-bronch-report={report.id}>
      <p className={styles.verdict}>{report.prompt}</p>
      <section className={styles.row} data-report-evidence aria-label={report.evidenceTitle}>
        <p className={styles.kicker}>{report.evidenceTitle}</p>
        {report.media?.map((media, index) => (
          <MediaFigure key={`${media.kind}-${index}`} media={media} compact />
        ))}
      </section>
      {report.fields.map((field) => {
        const chosen = commitment.chosen[field.id]
        const refusedId = commitment.refused[field.id]
        const refused = refusedId
          ? field.options.find((option) => option.id === refusedId)
          : undefined
        const chosenOption = chosen
          ? field.options.find((option) => option.id === chosen)
          : undefined
        const outcome = chosenOption ? 'held' : refused ? 'refused' : undefined
        return (
          <div
            key={field.id}
            className={styles.row}
            data-report-field={field.id}
            data-outcome={outcome}
          >
            <p className={styles.kicker}>{field.label}</p>
            <p className={styles.verdict} data-report-field-evidence>
              {field.evidence}
            </p>
            <fieldset className={styles.choices}>
              <legend>What the record may say</legend>
              {orderChoices(field.id, field.options).map((option) => (
                <label
                  key={option.id}
                  className={styles.choice}
                  data-selected={chosen === option.id}
                >
                  <input
                    type="radio"
                    name={`bronch-report-${report.id}-${field.id}`}
                    value={option.id}
                    checked={chosen === option.id}
                    onChange={() => onOption(field.id, option.id, option.supported)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {refused && !chosenOption ? (
              <p className={styles.verdict} data-report-verdict="refused" data-tone="refused">
                <strong>Refused: the evidence does not support that.</strong> {refused.rationale}
              </p>
            ) : null}
            {chosenOption ? (
              <p className={styles.verdict} data-report-verdict="held">
                <strong>Held.</strong> {chosenOption.rationale}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
