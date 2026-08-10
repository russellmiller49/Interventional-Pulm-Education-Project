import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'

export default function DevicesLayout({ children }: { children: ReactNode }) {
  if (!deviceIntelligenceEnabled()) notFound()
  return children
}
