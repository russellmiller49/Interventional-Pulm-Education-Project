import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { preferenceCardsEnabled } from '@/features/preference-cards/feature'

export default function PreferenceCardAdminLayout({ children }: { children: ReactNode }) {
  if (!preferenceCardsEnabled()) notFound()
  return children
}
