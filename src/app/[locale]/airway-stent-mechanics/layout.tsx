import type { ReactNode } from 'react'

import { clinicalModuleCopy } from '@/features/airway-stent-mechanics/content/clinicalModuleCopy'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

export default async function AirwayStentMechanicsLayout({ children }: { children: ReactNode }) {
  if (clinicalModuleCopy.clinicalReviewStatus !== 'reviewed') {
    await assertDraftModulesEnabled()
  }
  return children
}
