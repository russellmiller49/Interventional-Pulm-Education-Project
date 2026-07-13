import type { ReactNode } from 'react'

import { stentExplorerPublicationStatus } from '@/features/airway-stent-mechanics/explorer/release'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function AirwayStentMechanicsLayout({ children }: { children: ReactNode }) {
  if (stentExplorerPublicationStatus !== 'published') {
    await assertDraftModulesEnabled()
  }
  return children
}
