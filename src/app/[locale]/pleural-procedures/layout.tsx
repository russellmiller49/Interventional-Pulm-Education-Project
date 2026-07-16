import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function PleuralProceduresLayout({ children }: { children: ReactNode }) {
  await assertDraftModulesEnabled({ allowPccmIntroCourse: true })
  return children
}
