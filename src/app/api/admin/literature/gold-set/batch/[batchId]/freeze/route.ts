import { z } from 'zod'

import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import { freezeLiteratureGoldSetBatch } from '@/features/literature/server/gold-set'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const batchIdSchema = z.string().uuid()

interface GoldSetFreezeRouteContext {
  params: Promise<{ batchId: string }>
}

export async function POST(_request: Request, context: GoldSetFreezeRouteContext) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) return auth.response
  const { batchId: rawBatchId } = await context.params
  const batchId = batchIdSchema.safeParse(rawBatchId)
  if (!batchId.success) return literatureValidationError(batchId.error)

  const result = await freezeLiteratureGoldSetBatch(batchId.data, auth.user)
  if (result.error) {
    return literatureApiError('LITERATURE_GOLD_SET_FREEZE_FAILED', result.error, 409)
  }
  return literatureJson({ result: result.data })
}
