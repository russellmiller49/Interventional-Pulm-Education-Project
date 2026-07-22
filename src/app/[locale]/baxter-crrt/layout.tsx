import type { ReactNode } from 'react'

import {
  baxterCrrtIsDirectLinkPublic,
  baxterCrrtReleaseStage,
} from '@/features/baxter-crrt/content'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function BaxterCrrtLayout({ children }: { children: ReactNode }) {
  if (!baxterCrrtIsDirectLinkPublic(baxterCrrtReleaseStage)) {
    await assertDraftModulesEnabled()
  }

  return children
}
