import { literatureBulkReviewSchema } from '@/features/literature/schemas/search'
import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'
import { curateLiteratureArticle } from '@/features/literature/server/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: Request) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) {
    return auth.response
  }

  const payload = literatureBulkReviewSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return literatureValidationError(payload.error)
  }

  const results: Array<{
    pmid: string
    ok: boolean
    error?: string
  }> = []

  for (const pmid of payload.data.pmids) {
    const result = await curateLiteratureArticle(pmid, payload.data.update, auth.user)
    results.push({
      pmid,
      ok: result.error === null,
      ...(result.error ? { error: result.error } : {}),
    })
  }

  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    return literatureApiError(
      'LITERATURE_BULK_REVIEW_PARTIAL_FAILURE',
      `${failed.length} of ${results.length} curation updates could not be saved.`,
      409,
      { results },
    )
  }

  return literatureJson({ results })
}
