import type { SafetyEvidenceRow, SafetyNotice } from '../domain/safety-notice-schema'
import type { SafetyFreshness } from '../domain/evidence-freshness'
import type { SafetyActionScope } from '../domain/product-status'

export interface SafetyEvidenceLabels {
  recordedState: Record<SafetyNotice['recorded_state'], string>
  freshness: Record<SafetyFreshness, string>
  freshnessNote: string
  coverageHeading: string
  source: Record<'device_recall' | 'device_enforcement', string>
  datasetDate: string
  retrievedDate: string
  dateUnavailable: string
  partialDates: string
  sourceLimitations: string
  sourceLimitationsLink: string
  earlyAlertsLink: string
  reason: string
  identifiers: string
  classification: string
  reportedStatus: string
  initiated: string
  instructions: string
  linkUnavailable: string
  applicability: string
  sourceTextLanguage: string
}

export function SafetyEvidenceCoverage({
  evidence,
  freshness,
  labels,
}: {
  evidence: SafetyEvidenceRow | null
  freshness: SafetyFreshness
  labels: SafetyEvidenceLabels
}) {
  return (
    <div
      className="min-w-0 space-y-2 rounded-xl border border-border bg-muted/30 p-4"
      data-safety-freshness={freshness}
    >
      <h3 className="text-sm font-bold">{labels.freshness[freshness]}</h3>
      <p className="text-xs leading-5 text-muted-foreground">{labels.freshnessNote}</p>
      <details className="text-xs">
        <summary className="cursor-pointer rounded font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {labels.coverageHeading}
        </summary>
        <ul className="mt-3 space-y-2">
          {evidence?.source_checks.map((source) => (
            <li key={source.system}>
              <span className="font-semibold">{labels.source[source.system]}</span>
              <span className="block text-muted-foreground">
                {labels.datasetDate} {source.dataset_as_of ?? labels.dateUnavailable} ·{' '}
                {labels.retrievedDate} {source.retrieved_on}
              </span>
              {source.has_undated_responses ? (
                <span className="block text-muted-foreground">{labels.partialDates}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 leading-5 text-muted-foreground">{labels.sourceLimitations}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <a
            href="https://open.fda.gov/apis/device/enforcement/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {labels.sourceLimitationsLink}
          </a>
          <a
            href="https://www.fda.gov/medical-devices/medical-device-safety/medical-device-recalls-and-early-alerts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {labels.earlyAlertsLink}
          </a>
        </div>
      </details>
    </div>
  )
}

/** Source-reported facts only. Full affected codes and action instructions stay with FDA;
 * the research input contains a truncated code excerpt that cannot support a unit/lot check. */
export function SafetyNoticeDetails({
  evidence,
  labels,
  scopeLabels,
}: {
  evidence: SafetyEvidenceRow
  labels: SafetyEvidenceLabels
  scopeLabels: Record<SafetyActionScope, string>
}) {
  return (
    <div className="space-y-3">
      {evidence.notices.map((notice) => (
        <article
          key={notice.recall_number}
          data-safety-notice={notice.recall_number}
          className="min-w-0 space-y-3 border-t border-border/60 pt-3 text-sm [overflow-wrap:anywhere]"
          aria-labelledby={`notice-${notice.recall_number}`}
        >
          <h3 id={`notice-${notice.recall_number}`} className="font-mono text-sm font-bold">
            {notice.recall_number}
          </h3>
          <p data-notice-state={notice.recorded_state} className="text-xs font-semibold">
            {labels.recordedState[notice.recorded_state]}
          </p>
          {notice.reason_for_recall ? (
            <div>
              <p className="text-xs font-semibold">{labels.reason}</p>
              <p lang="en" className="mt-1 leading-6">
                {notice.reason_for_recall}
              </p>
            </div>
          ) : null}
          <p className="text-xs">
            {labels.identifiers}{' '}
            <span className="font-mono">{notice.matched_identifiers.join(', ')}</span>
          </p>
          <p>{scopeLabels[notice.scope]}</p>
          {notice.initiated_on ? (
            <p className="text-xs">
              {labels.initiated} <time dateTime={notice.initiated_on}>{notice.initiated_on}</time>
            </p>
          ) : null}
          <ul className="space-y-2 text-xs text-muted-foreground">
            {notice.reports.map((report) => (
              <li key={report.system}>
                <span className="font-medium text-foreground">
                  {labels.source[report.system]}:{' '}
                </span>
                {labels.reportedStatus} <span lang="en">{report.recorded_status}</span>
                {report.classification ? (
                  <>
                    {' '}
                    · {labels.classification} <span lang="en">{report.classification}</span>
                  </>
                ) : null}
                <span className="block">
                  {labels.datasetDate} {report.dataset_as_of ?? labels.dateUnavailable} ·{' '}
                  {labels.retrievedDate} {report.retrieved_on}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5">{labels.applicability}</p>
          {notice.official_record_url ? (
            <a
              href={notice.official_record_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-current px-3 py-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels.instructions}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">{labels.linkUnavailable}</p>
          )}
        </article>
      ))}
      <p className="text-xs text-muted-foreground">{labels.sourceTextLanguage}</p>
    </div>
  )
}
