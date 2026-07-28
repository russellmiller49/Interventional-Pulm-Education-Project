import { pmidSchema } from '@/features/literature/schemas/search'
import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'
import { getLiteratureArticle } from '@/features/literature/server/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LiteratureArticleRouteContext {
  params: Promise<{ pmid: string }>
}

export async function GET(_request: Request, context: LiteratureArticleRouteContext) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) {
    return auth.response
  }

  const { pmid: rawPmid } = await context.params
  const parsed = pmidSchema.safeParse(rawPmid)
  if (!parsed.success) {
    return literatureValidationError(parsed.error)
  }

  const result = await getLiteratureArticle(parsed.data)
  if (result.error) {
    return literatureApiError('LITERATURE_ARTICLE_UNAVAILABLE', result.error, 503)
  }
  if (!result.data) {
    return literatureApiError(
      'LITERATURE_ARTICLE_NOT_FOUND',
      'The requested literature article was not found.',
      404,
    )
  }

  return literatureJson(result.data)
}
