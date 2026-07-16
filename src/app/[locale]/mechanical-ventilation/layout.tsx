import type { ReactNode } from 'react'

import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function MechanicalVentilationLayout({ children }: { children: ReactNode }) {
  if (mechanicalVentilationPublicationStatus !== 'published') {
    await assertDraftModulesEnabled()
  }

  return children
}
