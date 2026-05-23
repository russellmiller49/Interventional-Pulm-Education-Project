import { notFound } from 'next/navigation'

import { areDraftModulesEnabled } from '@/lib/draft-modules'

export function assertDraftModulesEnabled() {
  if (!areDraftModulesEnabled) {
    notFound()
  }
}
