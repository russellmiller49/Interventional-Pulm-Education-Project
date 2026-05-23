import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default function IntroBronchoscopyLayout({ children }: { children: ReactNode }) {
  assertDraftModulesEnabled()
  return children
}
