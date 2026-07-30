import { z } from 'zod'

import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import { unlockLiteratureGoldTestSplit } from '@/features/literature/server/gold-set'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const requestSchema = z.object({
  batchId: z.string().uuid(),
  reason: z.string().trim().min(5).max(2000),
})

interface GoldSetUnlockRouteContext {
  params: Promise<{ batchId: string }>
}

export async function POST(request: Request, context: GoldSetUnlockRouteContext) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) return auth.response
  const { batchId } = await context.params
  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse({
    batchId,
    reason:
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).reason
        : undefined,
  })
  if (!parsed.success) return literatureValidationError(parsed.error)

  const result = await unlockLiteratureGoldTestSplit(
    parsed.data.batchId,
    parsed.data.reason,
    auth.user,
  )
  if (result.error) {
    return literatureApiError('LITERATURE_GOLD_TEST_UNLOCK_FAILED', result.error, 409)
  }
  return literatureJson({ result: result.data })
}
