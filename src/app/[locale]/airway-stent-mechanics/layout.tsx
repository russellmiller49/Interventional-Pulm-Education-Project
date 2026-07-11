import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function AirwayStentMechanicsLayout({ children }: { children: ReactNode }) {
  await assertDraftModulesEnabled()
  return children
}
