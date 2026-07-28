'use client'

import { useTranslations } from 'next-intl'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PrintControls() {
  const t = useTranslations('preferenceCards')

  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="h-4 w-4" />
      {t('printNow')}
    </Button>
  )
}
