import type { ReactNode } from 'react'

import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function CardiohelpEcmoLayout({ children }: { children: ReactNode }) {
  if (cardiohelpEcmoPublicationStatus !== 'published') {
    await assertDraftModulesEnabled()
  }

  return children
}
