import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'
import { SavedDevicesProvider } from '@/features/device-intelligence/components/SavedDevicesProvider'

export default function DevicesLayout({ children }: { children: ReactNode }) {
  if (!deviceIntelligenceEnabled()) notFound()
  return <SavedDevicesProvider>{children}</SavedDevicesProvider>
}
