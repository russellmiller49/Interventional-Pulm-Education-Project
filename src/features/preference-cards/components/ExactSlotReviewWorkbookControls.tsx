'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type {
  ExactSlotReviewWorkbookExportRequest,
  ExactSlotReviewExportScope,
} from '@/features/preference-cards/excel/exact-slot-review-contract'

interface ExactSlotReviewWorkbookControlsProps {
  locale: string
  totalCount: number
  filteredCount: number
  requiredCount: number
  filters?: ExactSlotReviewWorkbookExportRequest['filters']
  productId?: string
  productName?: string
  productProposalCount?: number
}

function fileNameFromDisposition(disposition: string | null): string | null {
  const match = disposition?.match(/filename="([^"]+)"/i)
  return match?.[1] ?? null
}

function downloadResponseBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function ExactSlotReviewWorkbookControls({
  locale,
  totalCount,
  filteredCount,
  requiredCount,
  filters,
  productId,
  productName,
  productProposalCount = 0,
}: ExactSlotReviewWorkbookControlsProps) {
  const t = useTranslations('preferenceCards')
  const isProductScope = Boolean(productId)
  const [scope, setScope] = useState<ExactSlotReviewExportScope>(
    isProductScope ? 'product' : 'filtered',
  )
  const [isExporting, setIsExporting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const importHref = `/${locale}/admin/preference-cards/catalog-qa/slot-options/import` as Route
  const slotReviewHref = productId
    ? (`/${locale}/admin/preference-cards/catalog-qa/slot-options?q=${encodeURIComponent(
        productId,
      )}` as Route)
    : (`/${locale}/admin/preference-cards/catalog-qa/slot-options` as Route)

  async function exportWorkbook() {
    setIsExporting(true)
    setError('')
    setStatus(t('admin.excelExportPreparing'))
    try {
      const requestBody: ExactSlotReviewWorkbookExportRequest = {
        scope: isProductScope ? 'product' : scope,
        locale,
        filters,
        productId,
      }
      const response = await fetch('/api/preference-cards/exact-slot-review/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(payload?.error?.message ?? t('admin.excelExportFailed'))
      }
      const blob = await response.blob()
      const filename =
        fileNameFromDisposition(response.headers.get('content-disposition')) ??
        `IP_Exact_Slot_Clinician_Review_${new Date().toISOString().slice(0, 10)}.xlsx`
      downloadResponseBlob(blob, filename)
      setStatus(
        t('admin.excelExportReady', {
          count: response.headers.get('x-proposal-count') ?? filteredCount,
        }),
      )
    } catch (caught) {
      setStatus('')
      setError(caught instanceof Error ? caught.message : t('admin.excelExportFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section
      aria-labelledby={
        isProductScope ? 'product-excel-review-heading' : 'exact-slot-excel-review-heading'
      }
      className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2
              id={
                isProductScope ? 'product-excel-review-heading' : 'exact-slot-excel-review-heading'
              }
              className="text-lg font-bold tracking-tight"
            >
              {t('admin.excelReviewTitle')}
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {isProductScope
              ? t('admin.excelProductEvidenceClarification')
              : t('admin.excelReviewDescription')}
          </p>
          {isProductScope ? (
            <p className="text-xs font-semibold text-foreground">
              {t('admin.excelVerifiedClarification')}
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-80">
          {isProductScope ? (
            <>
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
              >
                <Link href={slotReviewHref}>{t('admin.excelOpenExactSlotReview')}</Link>
              </Button>
              <Button
                type="button"
                onClick={exportWorkbook}
                disabled={isExporting || productProposalCount === 0}
                className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
                aria-label={t('admin.excelExportProductAccessible', {
                  product: productName ?? productId ?? '',
                })}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {isExporting
                  ? t('admin.excelExporting')
                  : t('admin.excelExportProductProposals', { count: productProposalCount })}
              </Button>
              {productProposalCount === 0 ? (
                <p className="text-sm font-semibold text-muted-foreground">
                  {t('admin.excelNoProductProposals')}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('admin.excelExportScope')}
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value as ExactSlotReviewExportScope)}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground"
                >
                  <option value="filtered">
                    {t('admin.excelScopeFiltered', { count: filteredCount })}
                  </option>
                  <option value="all">{t('admin.excelScopeAll', { count: totalCount })}</option>
                  <option value="required">
                    {t('admin.excelScopeRequired', { count: requiredCount })}
                  </option>
                  <option value="unreviewed" disabled>
                    {t('admin.excelScopeUnreviewedAfterImport')}
                  </option>
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={exportWorkbook}
                  disabled={isExporting}
                  className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  {isExporting ? t('admin.excelExporting') : t('admin.excelExportAction')}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
                >
                  <Link href={importHref}>
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    {t('admin.excelImportAction')}
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.excelUnreviewedScopeHelp')}</p>
            </>
          )}
        </div>
      </div>

      <aside className="mt-4 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <span className="font-bold">{t('admin.excelSafetyTitle')} </span>
        {t('admin.excelSafety')}
      </aside>

      <div aria-live="polite" className="mt-3 text-sm">
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
  )
}
