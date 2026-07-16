import type { ReactNode } from 'react'

import { hamiltonC6PublicationStatus } from '@/features/hamilton-c6-ventilation/content/deviceProfile'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function HamiltonC6VentilationLayout({ children }: { children: ReactNode }) {
  if (hamiltonC6PublicationStatus !== 'published') {
    await assertDraftModulesEnabled()
  }

  return children
}
