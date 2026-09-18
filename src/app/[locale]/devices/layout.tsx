import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'
import {
  CompareSelectionProvider,
  CompareTray,
} from '@/features/device-intelligence/components/CompareSelection'
import { SavedDevicesProvider } from '@/features/device-intelligence/components/SavedDevicesProvider'
import { getCompareLabels } from '@/features/device-intelligence/server/reference-labels.server'

export default async function DevicesLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  if (!deviceIntelligenceEnabled()) notFound()
  const { locale } = await params
  return (
    <SavedDevicesProvider>
      <CompareSelectionProvider>
        {children}
        <CompareTray locale={locale} labels={await getCompareLabels(locale)} />
      </CompareSelectionProvider>
    </SavedDevicesProvider>
  )
}
