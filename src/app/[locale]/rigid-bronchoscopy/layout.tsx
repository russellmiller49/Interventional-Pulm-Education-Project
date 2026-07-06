import type { ReactNode } from 'react'

import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

/**
 * Route-level admin gate for the draft Rigid Bronchoscopy module. Mirrors the
 * pleural-procedures layout so the module is genuinely admin-only (not merely
 * hidden from navigation) until it is removed from `draftModulePathPrefixes`.
 */
export default async function RigidBronchoscopyLayout({ children }: { children: ReactNode }) {
  await assertDraftModulesEnabled()
  return children
}
