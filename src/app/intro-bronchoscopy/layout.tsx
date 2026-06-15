import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function IntroBronchoscopyLayout({ children }: { children: ReactNode }) {
  await assertDraftModulesEnabled()
  return children
}
