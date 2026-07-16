import type { ReactNode } from 'react'

import { baxterCrrtPublicationStatus } from '@/features/baxter-crrt/content'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function BaxterCrrtLayout({ children }: { children: ReactNode }) {
  if (baxterCrrtPublicationStatus !== 'published') {
    await assertDraftModulesEnabled()
  }

  return children
}
