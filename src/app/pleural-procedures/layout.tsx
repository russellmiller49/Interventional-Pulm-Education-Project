import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default function PleuralProceduresLayout({ children }: { children: ReactNode }) {
  assertDraftModulesEnabled()
  return children
}
