'use client'

import { Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

/** Browser print only: no export endpoint, storage, or server mutation. */
export function OperationalOutputPrintButton() {
  const t = useTranslations('deviceIntelligence.outputs')
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="h-4 w-4" />
      {t('print')}
    </Button>
  )
}
