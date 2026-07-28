import {
  literatureAdminArticleUpdateSchema,
  pmidSchema,
} from '@/features/literature/schemas/search'
import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'
import { curateLiteratureArticle, getLiteratureArticle } from '@/features/literature/server/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LiteratureAdminArticleRouteContext {
  params: Promise<{ pmid: string }>
}

export async function PATCH(request: Request, context: LiteratureAdminArticleRouteContext) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) {
    return auth.response
  }

  const { pmid: rawPmid } = await context.params
  const pmid = pmidSchema.safeParse(rawPmid)
  if (!pmid.success) {
    return literatureValidationError(pmid.error)
  }

  const payload = literatureAdminArticleUpdateSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!payload.success) {
    return literatureValidationError(payload.error)
  }

  const result = await curateLiteratureArticle(pmid.data, payload.data, auth.user)
  if (result.error) {
    return literatureApiError('LITERATURE_CURATION_FAILED', result.error, 409)
  }

  const refreshed = await getLiteratureArticle(pmid.data)
  if (refreshed.error || !refreshed.data) {
    return literatureApiError(
      'LITERATURE_ARTICLE_REFRESH_FAILED',
      'The curation change was saved, but the updated article could not be reloaded.',
      503,
    )
  }

  return literatureJson({ article: refreshed.data, curation: result.data })
}
