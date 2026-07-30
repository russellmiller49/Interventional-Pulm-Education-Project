'use client'

import { Download, FileJson, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, type FormEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  clinicalUseProductRoleDecisionLabel,
  clinicalUseSlotDecisionLabel,
  type ClinicalUseReviewDecision,
  type ClinicalUseReviewImportPreview,
} from '@/features/preference-cards/excel/clinical-use-review-contract'
import {
  clinicalUseReviewDecisionFilename,
  createClinicalUseReviewNormalizedExport,
  serializeClinicalUseReviewCsv,
  serializeClinicalUseReviewJson,
} from '@/features/preference-cards/excel/clinical-use-review-serialization'

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_VISIBLE_DECISIONS = 50

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

function decisionLabel(decision: ClinicalUseReviewDecision): string {
  return decision.recordType === 'product_role'
    ? clinicalUseProductRoleDecisionLabel(decision.decision)
    : clinicalUseSlotDecisionLabel(decision.decision)
}

export function ClinicalUseReviewImportWorkbench({ locale }: { locale: string }) {
  const t = useTranslations('preferenceCards')
  const inputRef = useRef<HTMLInputElement>(null)
  const previewHeadingRef = useRef<HTMLHeadingElement>(null)
  const [selectedFileDescription, setSelectedFileDescription] = useState('')
  const [preview, setPreview] = useState<ClinicalUseReviewImportPreview | null>(null)
  const [staleAcknowledged, setStaleAcknowledged] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function importWorkbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError(t('admin.clinicalUseReviewChooseFile'))
      return
    }
    if (!file.name.toLocaleLowerCase().endsWith('.xlsx') || file.size > MAX_WORKBOOK_BYTES) {
      setError(t('admin.clinicalUseReviewFileConstraint'))
      return
    }

    setIsImporting(true)
    setPreview(null)
    setStaleAcknowledged(false)
    setError('')
    setStatus(t('admin.clinicalUseReviewImporting'))
    try {
      const response = await fetch(
        `/api/preference-cards/clinical-use-review/import?filename=${encodeURIComponent(
          file.name,
        )}&locale=${encodeURIComponent(locale)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': file.type || XLSX_MIME },
          body: file,
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | ClinicalUseReviewImportPreview
        | { error?: { message?: string } }
        | null
      if (!response.ok || !payload || !('formatVersion' in payload)) {
        throw new Error(
          payload && 'error' in payload
            ? (payload.error?.message ?? t('admin.clinicalUseReviewImportFailed'))
            : t('admin.clinicalUseReviewImportFailed'),
        )
      }

      const importedPreview = payload as ClinicalUseReviewImportPreview
      setPreview(importedPreview)
      setStatus(
        t('admin.clinicalUseReviewImportReady', {
          count: importedPreview.summary.validCompletedDecisions,
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
      setError(caught instanceof Error ? caught.message : t('admin.clinicalUseReviewImportFailed'))
    } finally {
      setIsImporting(false)
    }
  }

  function exportNormalized(format: 'json' | 'csv') {
    if (!preview) return
    setError('')
    try {
      const normalized = createClinicalUseReviewNormalizedExport(preview, staleAcknowledged)
      const content =
        format === 'json'
          ? serializeClinicalUseReviewJson(normalized)
          : serializeClinicalUseReviewCsv(normalized)
      downloadBlob(
        new Blob([content], {
          type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
        }),
        clinicalUseReviewDecisionFilename(format),
      )
      setStatus(
        format === 'json'
          ? t('admin.clinicalUseReviewDownloadJsonReady')
          : t('admin.clinicalUseReviewDownloadCsvReady'),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('admin.clinicalUseReviewImportFailed'))
    }
  }

  const canDownload =
    Boolean(preview?.canExportNormalized) && (!preview?.staleArtifact || staleAcknowledged)
  const issueRows =
    preview?.rows.filter(
      (row) => row.issues.length > 0 || row.protectedFieldDifferences.length > 0,
    ) ?? []
  const visibleDecisions = preview?.decisions.slice(0, MAX_VISIBLE_DECISIONS) ?? []
  const summaryCards: Array<[string, number]> = preview
    ? [
        ['admin.clinicalUseReviewSummaryCompleted', preview.summary.validCompletedDecisions],
        ['admin.clinicalUseReviewRoleMappings', preview.summary.productRoleDecisions],
        ['admin.clinicalUseReviewSlotMappings', preview.summary.currentSlotDecisions],
        ['admin.clinicalUseReviewSummaryIncomplete', preview.summary.incompleteDecisions],
        ['admin.clinicalUseReviewSummaryUnreviewed', preview.summary.rowsWithoutDecision],
        ['admin.clinicalUseReviewSummaryInvalid', preview.summary.invalidDecisionValues],
        ['admin.clinicalUseReviewSummaryProtected', preview.summary.protectedFieldDifferences],
        ['admin.clinicalUseReviewSummaryDuplicates', preview.summary.duplicateRows],
      ]
    : []

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="clinical-use-import-heading"
        className="rounded-2xl border bg-card p-5"
      >
        <div className="max-w-4xl">
          <h2 id="clinical-use-import-heading" className="text-2xl font-bold tracking-tight">
            {t('admin.clinicalUseReviewImportTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('admin.clinicalUseReviewImportDescription')}
          </p>
        </div>

        <aside className="mt-4 space-y-1 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p>
            <span className="font-bold">{t('admin.clinicalUseReviewSafetyTitle')} </span>
            {t('admin.clinicalUseReviewSafety')}
          </p>
          <p className="font-semibold">{t('admin.clinicalUseReviewPhiWarning')}</p>
        </aside>

        <form onSubmit={importWorkbook} className="mt-5 space-y-4">
          <div>
            <label htmlFor="completed-clinical-use-workbook" className="text-sm font-bold">
              {t('admin.clinicalUseReviewWorkbookLabel')}
            </label>
            <input
              ref={inputRef}
              id="completed-clinical-use-workbook"
              type="file"
              accept={`.xlsx,${XLSX_MIME}`}
              aria-describedby="completed-clinical-use-workbook-help"
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
              id="completed-clinical-use-workbook-help"
              className="mt-2 text-xs leading-5 text-muted-foreground"
            >
              {t('admin.clinicalUseReviewFileHelp')}
            </p>
            {selectedFileDescription ? (
              <p className="mt-2 break-all text-xs font-semibold">{selectedFileDescription}</p>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={isImporting || !selectedFileDescription}
            className="h-auto min-h-10 w-full whitespace-normal sm:w-auto"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            {isImporting
              ? t('admin.clinicalUseReviewImporting')
              : t('admin.clinicalUseReviewImportSubmit')}
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
        <section id="preview" aria-labelledby="clinical-use-preview-heading" className="space-y-5">
          <div className="rounded-2xl border bg-card p-5">
            <h2
              ref={previewHeadingRef}
              id="clinical-use-preview-heading"
              tabIndex={-1}
              className="text-2xl font-bold tracking-tight outline-none focus:ring-2 focus:ring-ring"
            >
              {t('admin.clinicalUseReviewPreviewTitle')}
            </h2>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {t('admin.clinicalUseReviewPreviewDescription', {
                filename: preview.workbookFileName,
              })}
            </p>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-muted/60 p-3">
                <dt className="font-bold">{t('admin.excelWorkbookHash')}</dt>
                <dd className="mt-1 break-all font-mono">{preview.workbookSha256}</dd>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <dt className="font-bold">{t('admin.clinicalUseReviewManifestHash')}</dt>
                <dd className="mt-1 break-all font-mono">
                  {preview.workbookMetadata.clinical_use_manifest_sha256}
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
              <h3 className="font-bold">{t('admin.clinicalUseReviewStaleTitle')}</h3>
              <p className="mt-2 text-sm leading-6">{preview.staleWarning}</p>
              <label className="mt-4 flex items-start gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={staleAcknowledged}
                  onChange={(event) => setStaleAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>{t('admin.clinicalUseReviewStaleAcknowledge')}</span>
              </label>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map(([label, count]) => (
              <div key={label} className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t(label)}
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums">
                  {count.toLocaleString(locale)}
                </p>
              </div>
            ))}
          </div>

          {preview.exportBlockers.length > 0 ? (
            <section
              aria-labelledby="clinical-use-blockers-heading"
              className="rounded-2xl border border-destructive/50 bg-destructive/5 p-5"
            >
              <h3 id="clinical-use-blockers-heading" className="font-bold text-destructive">
                {t('admin.clinicalUseReviewBlockersTitle')}
              </h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {preview.exportBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            aria-labelledby="clinical-use-issues-heading"
            className="rounded-2xl border bg-card p-5"
          >
            <h3 id="clinical-use-issues-heading" className="text-lg font-bold">
              {t('admin.clinicalUseReviewIssuesTitle')} ({issueRows.length})
            </h3>
            {issueRows.length > 0 ? (
              <div className="mt-4 space-y-3">
                {issueRows.map((row) => (
                  <details
                    key={`${row.sheetName}-${row.rowNumber}-${row.reviewKey ?? 'missing'}`}
                    className="rounded-xl border p-4"
                  >
                    <summary className="cursor-pointer break-all font-semibold">
                      {t('admin.clinicalUseReviewRowIssueSummary', {
                        sheet: row.sheetName,
                        row: row.rowNumber,
                        key: row.reviewKey ?? t('catalog.missingValue'),
                      })}
                    </summary>
                    <div className="mt-3 space-y-3 text-sm">
                      {row.issues.map((issue, index) => (
                        <p key={`${issue.code}-${issue.field}-${index}`}>
                          <Badge variant={issue.severity === 'error' ? 'destructive' : 'outline'}>
                            {issue.severity}
                          </Badge>{' '}
                          {issue.message}
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
              <p className="mt-3 text-sm text-muted-foreground">
                {t('admin.clinicalUseReviewNoIssues')}
              </p>
            )}
          </section>

          <section
            aria-labelledby="clinical-use-normalized-heading"
            className="rounded-2xl border bg-card p-5"
          >
            <h3 id="clinical-use-normalized-heading" className="text-lg font-bold">
              {t('admin.clinicalUseReviewNormalizedTitle')} ({preview.decisions.length})
            </h3>
            {visibleDecisions.length > 0 ? (
              <div className="mt-4 space-y-3">
                {visibleDecisions.map((decision) => (
                  <article key={decision.reviewKey} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{decisionLabel(decision)}</Badge>
                      <Badge variant="outline">
                        {decision.recordType === 'product_role'
                          ? t('admin.clinicalUseReviewRecordProductRole')
                          : t('admin.clinicalUseReviewRecordCurrentSlot')}
                      </Badge>
                      {decision.reviewerConfidence ? (
                        <Badge variant="outline">{decision.reviewerConfidence}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                      {decision.reviewKey}
                    </p>
                    <p className="mt-2 break-words text-sm leading-6">{decision.rationale}</p>
                  </article>
                ))}
                {preview.decisions.length > visibleDecisions.length ? (
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t('admin.clinicalUseReviewShowingDecisions', {
                      shown: visibleDecisions.length,
                      total: preview.decisions.length,
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('admin.clinicalUseReviewNoNormalized')}
              </p>
            )}
          </section>

          <section
            aria-labelledby="clinical-use-artifact-actions-heading"
            className="rounded-2xl border border-primary/30 bg-card p-5"
          >
            <h3 id="clinical-use-artifact-actions-heading" className="text-lg font-bold">
              {t('admin.clinicalUseReviewNormalizedTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.clinicalUseReviewNoApplyNotice')}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => exportNormalized('json')}
                disabled={!canDownload}
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
              >
                <FileJson aria-hidden="true" className="h-4 w-4" />
                {t('admin.clinicalUseReviewDownloadJson')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => exportNormalized('csv')}
                disabled={!canDownload}
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {t('admin.clinicalUseReviewDownloadCsv')}
              </Button>
            </div>
            {!canDownload ? (
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                {preview.staleArtifact && !staleAcknowledged
                  ? t('admin.clinicalUseReviewDownloadBlockedStale')
                  : t('admin.clinicalUseReviewBlockersTitle')}
              </p>
            ) : null}
          </section>
        </section>
      ) : null}
    </div>
  )
}
