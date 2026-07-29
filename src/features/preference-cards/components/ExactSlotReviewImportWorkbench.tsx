'use client'

import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, type FormEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  exactSlotDecisionLabel,
  type ExactSlotReviewImportPreview,
} from '@/features/preference-cards/excel/exact-slot-review-contract'
import {
  createExactSlotReviewNormalizedExport,
  exactSlotReviewDecisionFilename,
  serializeExactSlotReviewCsv,
  serializeExactSlotReviewJson,
} from '@/features/preference-cards/excel/exact-slot-review-serialization'

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function fileNameFromDisposition(disposition: string | null): string | null {
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? null
}

export function ExactSlotReviewImportWorkbench({
  locale,
  totalCount,
}: {
  locale: string
  totalCount: number
}) {
  const t = useTranslations('preferenceCards')
  const inputRef = useRef<HTMLInputElement>(null)
  const previewHeadingRef = useRef<HTMLHeadingElement>(null)
  const [selectedFileDescription, setSelectedFileDescription] = useState('')
  const [preview, setPreview] = useState<ExactSlotReviewImportPreview | null>(null)
  const [staleAcknowledged, setStaleAcknowledged] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExportingUnreviewed, setIsExportingUnreviewed] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function importWorkbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError(t('admin.excelImportChooseFile'))
      return
    }
    if (!file.name.toLocaleLowerCase().endsWith('.xlsx') || file.size > MAX_WORKBOOK_BYTES) {
      setError(t('admin.excelImportFileConstraint'))
      return
    }

    setIsImporting(true)
    setPreview(null)
    setStaleAcknowledged(false)
    setError('')
    setStatus(t('admin.excelImportValidating'))
    try {
      const response = await fetch(
        `/api/preference-cards/exact-slot-review/import?filename=${encodeURIComponent(
          file.name,
        )}&locale=${encodeURIComponent(locale)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
          body: file,
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | ExactSlotReviewImportPreview
        | { error?: { message?: string } }
        | null
      if (!response.ok || !payload || !('formatVersion' in payload)) {
        throw new Error(
          payload && 'error' in payload
            ? (payload.error?.message ?? t('admin.excelImportFailed'))
            : t('admin.excelImportFailed'),
        )
      }
      const importedPreview = payload as ExactSlotReviewImportPreview
      setPreview(importedPreview)
      setStatus(
        t('admin.excelImportPreviewReady', {
          count: importedPreview.summary.matchedProposalKeys,
        }),
      )
      if (inputRef.current) inputRef.current.value = ''
      setSelectedFileDescription(importedPreview.workbookFileName)
      const url = new URL(window.location.href)
      url.hash = 'preview'
      window.history.replaceState(null, '', url)
      requestAnimationFrame(() => previewHeadingRef.current?.focus())
    } catch (caught) {
      setStatus('')
      setError(caught instanceof Error ? caught.message : t('admin.excelImportFailed'))
    } finally {
      setIsImporting(false)
    }
  }

  function exportNormalized(format: 'json' | 'csv') {
    if (!preview) return
    setError('')
    try {
      const normalized = createExactSlotReviewNormalizedExport(preview, staleAcknowledged)
      const content =
        format === 'json'
          ? serializeExactSlotReviewJson(normalized)
          : serializeExactSlotReviewCsv(normalized)
      downloadBlob(
        new Blob([content], {
          type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
        }),
        exactSlotReviewDecisionFilename(format),
      )
      setStatus(t('admin.excelNormalizedExportReady', { format: format.toUpperCase() }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('admin.excelNormalizedExportBlocked'))
    }
  }

  async function exportUnreviewedWorkbook() {
    if (!preview) return
    setIsExportingUnreviewed(true)
    setError('')
    setStatus(t('admin.excelExportPreparing'))
    try {
      const response = await fetch('/api/preference-cards/exact-slot-review/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'unreviewed',
          locale,
          reviewedProposalKeys: preview.reviewedProposalKeys,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(payload?.error?.message ?? t('admin.excelExportFailed'))
      }
      const blob = await response.blob()
      downloadBlob(
        blob,
        fileNameFromDisposition(response.headers.get('content-disposition')) ??
          `IP_Exact_Slot_Clinician_Review_${new Date().toISOString().slice(0, 10)}.xlsx`,
      )
      setStatus(
        t('admin.excelExportReady', {
          count: response.headers.get('x-proposal-count') ?? totalCount,
        }),
      )
    } catch (caught) {
      setStatus('')
      setError(caught instanceof Error ? caught.message : t('admin.excelExportFailed'))
    } finally {
      setIsExportingUnreviewed(false)
    }
  }

  const canDownload =
    Boolean(preview?.canExportNormalized) && (!preview?.staleArtifact || staleAcknowledged)
  const issueRows =
    preview?.rows.filter(
      (row) => row.issues.length > 0 || row.protectedFieldDifferences.length > 0,
    ) ?? []
  const summaryCards: Array<[string, number]> = preview
    ? [
        ['admin.excelSummaryValid', preview.summary.validCompletedDecisions],
        ['admin.excelSummaryIncomplete', preview.summary.incompleteDecisions],
        ['admin.excelSummaryNoDecision', preview.summary.rowsWithoutDecision],
        ['admin.excelSummaryInvalidDecision', preview.summary.invalidDecisionValues],
        ['admin.excelSummaryMissingRationale', preview.summary.missingRationales],
        ['admin.excelSummaryUnknown', preview.summary.unknownProposalKeys],
        ['admin.excelSummaryStaleKeys', preview.summary.staleProposalKeys],
        ['admin.excelSummaryProtectedDiffs', preview.summary.protectedFieldDifferences],
        ['admin.excelSummaryDuplicates', preview.summary.duplicateRows],
      ]
    : []

  return (
    <div className="space-y-6">
      <section aria-labelledby="import-workbook-heading" className="rounded-2xl border bg-card p-5">
        <div className="max-w-4xl">
          <h2 id="import-workbook-heading" className="text-2xl font-bold tracking-tight">
            {t('admin.excelImportTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('admin.excelImportDescription')}
          </p>
        </div>

        <aside className="mt-4 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <span className="font-bold">{t('admin.excelSafetyTitle')} </span>
          {t('admin.excelSafety')}
        </aside>

        <form onSubmit={importWorkbook} className="mt-5 space-y-4">
          <div>
            <label htmlFor="completed-review-workbook" className="text-sm font-bold">
              {t('admin.excelImportFileLabel')}
            </label>
            <input
              ref={inputRef}
              id="completed-review-workbook"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-describedby="completed-review-workbook-help"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setSelectedFileDescription(
                  file ? `${file.name} · ${Math.ceil(file.size / 1024).toLocaleString()} KB` : '',
                )
                setError('')
              }}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-input bg-background text-sm file:mr-3 file:border-0 file:bg-muted file:px-4 file:py-3 file:font-semibold file:text-foreground hover:file:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p
              id="completed-review-workbook-help"
              className="mt-2 text-xs leading-5 text-muted-foreground"
            >
              {t('admin.excelImportFileHelp')}
            </p>
            {selectedFileDescription ? (
              <p className="mt-2 break-all text-xs font-semibold">{selectedFileDescription}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={isImporting || !selectedFileDescription}>
            <Upload aria-hidden="true" className="h-4 w-4" />
            {isImporting ? t('admin.excelImporting') : t('admin.excelImportValidate')}
          </Button>
        </form>

        <div aria-live="polite" className="mt-4 text-sm">
          {status ? (
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">{status}</p>
          ) : null}
          {error ? (
            <p role="alert" className="font-semibold text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {preview ? (
        <section id="preview" aria-labelledby="import-preview-heading" className="space-y-5">
          <div className="rounded-2xl border bg-card p-5">
            <h2
              ref={previewHeadingRef}
              id="import-preview-heading"
              tabIndex={-1}
              className="text-2xl font-bold tracking-tight outline-none focus:ring-2 focus:ring-ring"
            >
              {t('admin.excelPreviewTitle')}
            </h2>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {t('admin.excelPreviewDescription', { filename: preview.workbookFileName })}
            </p>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-3">
                <dt className="font-bold">{t('admin.excelWorkbookHash')}</dt>
                <dd className="mt-1 break-all font-mono">{preview.workbookSha256}</dd>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <dt className="font-bold">{t('admin.excelArtifactHash')}</dt>
                <dd className="mt-1 break-all font-mono">
                  {preview.workbookMetadata.proposal_artifact_sha256}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <dt className="font-bold">{t('admin.excelFormatVersion')}</dt>
                <dd className="mt-1">{preview.workbookMetadata.format_version}</dd>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <dt className="font-bold">{t('admin.excelImportedAt')}</dt>
                <dd className="mt-1">{preview.importedAt}</dd>
              </div>
            </dl>
          </div>

          {preview.staleArtifact ? (
            <div
              role="alert"
              className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <h3 className="font-bold">{t('admin.excelStaleTitle')}</h3>
              <p className="mt-2 text-sm leading-6">{preview.staleWarning}</p>
              <label className="mt-4 flex items-start gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={staleAcknowledged}
                  onChange={(event) => setStaleAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>{t('admin.excelStaleAcknowledge')}</span>
              </label>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map(([label, count]) => (
              <div key={label} className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t(label)}
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums">{count}</p>
              </div>
            ))}
          </div>

          <section
            aria-labelledby="protected-comparison-heading"
            className="rounded-2xl border bg-card p-5"
          >
            <h3 id="protected-comparison-heading" className="text-lg font-bold">
              {t('admin.excelProtectedComparisonTitle')}
            </h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ['admin.excelProtectedUnchanged', preview.summary.unchangedProtectedRows],
                  ['admin.excelProtectedChanged', preview.summary.changedProtectedRows],
                  ['admin.excelProtectedMissing', preview.summary.missingCurrentProposals],
                  ['admin.excelProtectedUnknown', preview.summary.unknownProposalKeys],
                  ['admin.excelProtectedDuplicate', preview.duplicateProposalKeys.length],
                ] as Array<[string, number]>
              ).map(([label, count]) => (
                <div key={label} className="rounded-lg bg-muted/60 p-3">
                  <dt className="font-semibold">{t(label)}</dt>
                  <dd className="mt-1 text-2xl font-black tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          </section>

          {preview.exportBlockers.length > 0 ? (
            <section
              aria-labelledby="export-blockers-heading"
              className="rounded-2xl border border-destructive/50 bg-destructive/5 p-5"
            >
              <h3 id="export-blockers-heading" className="font-bold text-destructive">
                {t('admin.excelBlockersTitle')}
              </h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {preview.exportBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="row-issues-heading" className="rounded-2xl border bg-card p-5">
            <h3 id="row-issues-heading" className="text-lg font-bold">
              {t('admin.excelRowIssuesTitle', { count: issueRows.length })}
            </h3>
            {issueRows.length > 0 ? (
              <div className="mt-4 space-y-3">
                {issueRows.map((row) => (
                  <details
                    key={`${row.rowNumber}-${row.proposalKey ?? 'missing'}`}
                    className="rounded-xl border p-4"
                  >
                    <summary className="cursor-pointer break-all font-semibold">
                      {t('admin.excelRowIssueSummary', {
                        row: row.rowNumber,
                        key: row.proposalKey ?? t('catalog.missingValue'),
                      })}
                    </summary>
                    <div className="mt-3 space-y-3 text-sm">
                      {row.issues.map((rowIssue, index) => (
                        <p key={`${rowIssue.code}-${rowIssue.field}-${index}`}>
                          <Badge
                            variant={rowIssue.severity === 'error' ? 'destructive' : 'outline'}
                          >
                            {rowIssue.severity}
                          </Badge>{' '}
                          {rowIssue.message}
                        </p>
                      ))}
                      {row.protectedFieldDifferences.map((difference) => (
                        <dl
                          key={difference.field}
                          className="grid gap-2 rounded-lg bg-muted/60 p-3 sm:grid-cols-3"
                        >
                          <div>
                            <dt className="font-bold">{t('admin.excelField')}</dt>
                            <dd>{difference.field}</dd>
                          </div>
                          <div>
                            <dt className="font-bold">{t('admin.excelWorkbookValue')}</dt>
                            <dd className="break-all">{difference.workbookValue || '—'}</dd>
                          </div>
                          <div>
                            <dt className="font-bold">{t('admin.excelCurrentValue')}</dt>
                            <dd className="break-all">{difference.currentValue || '—'}</dd>
                          </div>
                        </dl>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t('admin.excelNoRowIssues')}</p>
            )}
          </section>

          <section
            aria-labelledby="normalized-decisions-heading"
            className="rounded-2xl border bg-card p-5"
          >
            <h3 id="normalized-decisions-heading" className="text-lg font-bold">
              {t('admin.excelNormalizedPreviewTitle', { count: preview.decisions.length })}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.excelNormalizedPreviewDescription')}
            </p>
            {preview.decisions.length > 0 ? (
              <div className="mt-4 space-y-3">
                {preview.decisions.map((decision) => (
                  <article key={decision.proposalKey} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{exactSlotDecisionLabel(decision.decision)}</Badge>
                      {decision.reviewerConfidence ? (
                        <Badge variant="outline">{decision.reviewerConfidence}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                      {decision.proposalKey}
                    </p>
                    <p className="mt-2 break-words text-sm leading-6">{decision.rationale}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('admin.excelNoNormalizedDecisions')}
              </p>
            )}
          </section>

          <section
            aria-labelledby="review-artifact-actions-heading"
            className="rounded-2xl border border-primary/30 bg-card p-5"
          >
            <h3 id="review-artifact-actions-heading" className="text-lg font-bold">
              {t('admin.excelArtifactActionsTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.excelArtifactActionsDescription')}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Button
                type="button"
                onClick={() => exportNormalized('json')}
                disabled={!canDownload}
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
              >
                <FileJson aria-hidden="true" className="h-4 w-4" />
                {t('admin.excelDownloadJson')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => exportNormalized('csv')}
                disabled={!canDownload}
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {t('admin.excelDownloadCsv')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportUnreviewedWorkbook}
                disabled={isExportingUnreviewed}
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
              >
                <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
                {isExportingUnreviewed
                  ? t('admin.excelExporting')
                  : t('admin.excelExportUnreviewed', {
                      count: Math.max(0, totalCount - preview.reviewedProposalKeys.length),
                    })}
              </Button>
            </div>
            {!canDownload ? (
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                {preview.staleArtifact && !staleAcknowledged
                  ? t('admin.excelAcknowledgeBeforeDownload')
                  : t('admin.excelResolveBeforeDownload')}
              </p>
            ) : null}
          </section>
        </section>
      ) : null}
    </div>
  )
}
