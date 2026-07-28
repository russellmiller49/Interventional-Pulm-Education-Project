import type { ReactNode } from 'react'

import { CriticalCareRestrictedAccountSync } from '@/features/critical-care/components/CriticalCareRestrictedAccountSync'

export default function CardiohelpEcmoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CriticalCareRestrictedAccountSync />
    </>
  )
}
