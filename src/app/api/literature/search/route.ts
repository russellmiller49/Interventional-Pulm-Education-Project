import {
  literatureSearchInputFromUrl,
  literatureSearchSchema,
} from '@/features/literature/schemas/search'
import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'
import { searchLiterature } from '@/features/literature/server/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) {
    return auth.response
  }

  const url = new URL(request.url)
  const parsed = literatureSearchSchema.safeParse(literatureSearchInputFromUrl(url.searchParams))
  if (!parsed.success) {
    return literatureValidationError(parsed.error)
  }

  const result = await searchLiterature(parsed.data)
  if (result.error) {
    return literatureApiError('LITERATURE_SEARCH_UNAVAILABLE', result.error, 503)
  }

  return literatureJson(result.data)
}
