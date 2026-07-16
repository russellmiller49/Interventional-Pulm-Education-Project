import type { ReactNode } from 'react'

import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function HamiltonC6VentilationLayout({ children }: { children: ReactNode }) {
  if (mechanicalVentilationPublicationStatus === 'draft') {
    await assertDraftModulesEnabled()
  }

  return children
}
