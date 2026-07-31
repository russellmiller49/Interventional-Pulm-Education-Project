import { z } from 'zod'

import { literatureGoldReviewRequestSchema } from '@/features/literature/schemas/gold-set'
import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import {
  loadLiteratureGoldReviewItem,
  saveLiteratureGoldReview,
  updateLiteratureGoldReviewItem,
} from '@/features/literature/server/gold-set'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const itemIdSchema = z.string().uuid()

interface GoldSetItemRouteContext {
  params: Promise<{ itemId: string }>
}

export async function GET(request: Request, context: GoldSetItemRouteContext) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) return auth.response
  const { itemId: rawItemId } = await context.params
  const itemId = itemIdSchema.safeParse(rawItemId)
  if (!itemId.success) return literatureValidationError(itemId.error)

  const splitValue = new URL(request.url).searchParams.get('split')
  const split = splitValue === 'test' || splitValue === 'all' ? splitValue : 'development'
  const result = await loadLiteratureGoldReviewItem(undefined, itemId.data, 'all', split)
  if (result.error) {
    return literatureApiError('LITERATURE_GOLD_SET_LOAD_FAILED', result.error, 503)
  }
  if (!result.data) {
    return literatureApiError('LITERATURE_GOLD_SET_ITEM_NOT_FOUND', 'Review item not found.', 404)
  }
  return literatureJson({ item: result.data })
}

export async function PATCH(request: Request, context: GoldSetItemRouteContext) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) return auth.response
  const { itemId: rawItemId } = await context.params
  const itemId = itemIdSchema.safeParse(rawItemId)
  if (!itemId.success) return literatureValidationError(itemId.error)

  const payload = literatureGoldReviewRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!payload.success) return literatureValidationError(payload.error)

  const result =
    payload.data.action === 'save_draft' || payload.data.action === 'complete_review'
      ? await saveLiteratureGoldReview(
          itemId.data,
          payload.data.review,
          payload.data.action === 'complete_review',
          auth.user,
        )
      : await updateLiteratureGoldReviewItem(itemId.data, payload.data.action, auth.user)

  if (result.error) {
    return literatureApiError('LITERATURE_GOLD_SET_SAVE_FAILED', result.error, 409)
  }
  const splitValue = new URL(request.url).searchParams.get('split')
  const split = splitValue === 'test' || splitValue === 'all' ? splitValue : 'development'
  const refreshed = await loadLiteratureGoldReviewItem(undefined, itemId.data, 'all', split)
  return literatureJson({ result: result.data, item: refreshed.data })
}
