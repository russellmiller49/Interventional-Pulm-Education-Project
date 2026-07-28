'use client'

import { LoaderCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function LiteratureLoading() {
  const t = useTranslations('literature')

  return (
    <div
      role="status"
      aria-live="polite"
      className="container flex min-h-[24rem] items-center justify-center py-12"
    >
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium shadow-sm">
        <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        {t('loading')}
      </div>
    </div>
  )
}
