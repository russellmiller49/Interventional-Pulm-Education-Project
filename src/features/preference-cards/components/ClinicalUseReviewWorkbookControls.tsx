'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface ClinicalUseReviewWorkbookControlsProps {
  locale: string
  productCount: number
  productRoleCount: number
  currentSlotCount: number
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

export function ClinicalUseReviewWorkbookControls({
  locale,
  productCount,
  productRoleCount,
  currentSlotCount,
}: ClinicalUseReviewWorkbookControlsProps) {
  const t = useTranslations('preferenceCards')
  const [isExporting, setIsExporting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const importHref = `/${locale}/admin/preference-cards/catalog-qa/clinical-use/import` as Route

  async function exportWorkbook() {
    setIsExporting(true)
    setError('')
    setStatus(t('admin.clinicalUseReviewExportPreparing'))
    try {
      const response = await fetch('/api/preference-cards/clinical-use-review/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(payload?.error?.message ?? t('admin.clinicalUseReviewExportFailed'))
      }

      const blob = await response.blob()
      const filename =
        fileNameFromDisposition(response.headers.get('content-disposition')) ??
        `IP_Full_Catalog_Clinical_Use_Review_${new Date().toISOString().slice(0, 10)}.xlsx`
      downloadResponseBlob(blob, filename)
      setStatus(
        t('admin.clinicalUseReviewExportReady', {
          products: Number(
            response.headers.get('x-catalog-product-count') ?? productCount,
          ).toLocaleString(locale),
          roles: Number(
            response.headers.get('x-product-role-count') ?? productRoleCount,
          ).toLocaleString(locale),
          slots: Number(
            response.headers.get('x-current-slot-count') ?? currentSlotCount,
          ).toLocaleString(locale),
        }),
      )
    } catch (caught) {
      setStatus('')
      setError(caught instanceof Error ? caught.message : t('admin.clinicalUseReviewExportFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  const counts = [
    ['admin.clinicalUseReviewProducts', productCount],
    ['admin.clinicalUseReviewRoleMappings', productRoleCount],
    ['admin.clinicalUseReviewSlotMappings', currentSlotCount],
  ] as const

  return (
    <section
      aria-labelledby="clinical-use-excel-review-heading"
      className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet aria-hidden="true" className="h-5 w-5 text-primary" />
            <h2 id="clinical-use-excel-review-heading" className="text-lg font-bold tracking-tight">
              {t('admin.clinicalUseReviewWorkbookTitle')}
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('admin.clinicalUseReviewWorkbookDescription')}
          </p>
          <dl className="grid gap-2 sm:grid-cols-3">
            {counts.map(([label, count]) => (
              <div key={label} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs font-semibold text-muted-foreground">{t(label)}</dt>
                <dd className="mt-1 text-2xl font-black tabular-nums">
                  {count.toLocaleString(locale)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-96 lg:grid-cols-1">
          <Button
            type="button"
            onClick={exportWorkbook}
            disabled={isExporting}
            className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
            aria-label={t('admin.clinicalUseReviewExportAccessible')}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {isExporting
              ? t('admin.clinicalUseReviewExporting')
              : t('admin.clinicalUseReviewExportAction')}
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-10 w-full justify-center whitespace-normal text-center"
          >
            <Link href={importHref}>
              <Upload aria-hidden="true" className="h-4 w-4" />
              {t('admin.clinicalUseReviewImportAction')}
            </Link>
          </Button>
        </div>
      </div>

      <aside className="mt-4 space-y-1 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <p>
          <span className="font-bold">{t('admin.clinicalUseReviewSafetyTitle')} </span>
          {t('admin.clinicalUseReviewSafety')}
        </p>
        <p className="font-semibold">{t('admin.clinicalUseReviewPhiWarning')}</p>
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
