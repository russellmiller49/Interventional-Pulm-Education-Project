import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function RapidOnsiteCytologyLayout({ children }: { children: ReactNode }) {
  await assertDraftModulesEnabled()
  return children
}
