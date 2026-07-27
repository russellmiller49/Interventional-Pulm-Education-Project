import { serializeLiteratureGoldSetCsv } from '@/features/literature/gold-set/export'
import { literatureGoldExportQuerySchema } from '@/features/literature/schemas/gold-set'
import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import { exportLiteratureGoldSet } from '@/features/literature/server/gold-set'
import {
  literatureApiError,
  literatureJson,
  literatureValidationError,
} from '@/features/literature/server/http'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireLiteratureSiteAdminApi()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const query = literatureGoldExportQuerySchema.safeParse({
    batchId: url.searchParams.get('batchId') ?? undefined,
    format: url.searchParams.get('format') ?? 'json',
    split: url.searchParams.get('split') ?? 'development',
    includeHistory: url.searchParams.get('includeHistory') === 'true',
  })
  if (!query.success) return literatureValidationError(query.error)

  const result = await exportLiteratureGoldSet(
    query.data.batchId,
    query.data.split,
    query.data.includeHistory,
  )
  if (result.error) {
    return literatureApiError('LITERATURE_GOLD_SET_EXPORT_FAILED', result.error, 404)
  }
  if (!result.data) {
    return literatureApiError(
      'LITERATURE_GOLD_SET_EXPORT_FAILED',
      'Gold-set export returned no data.',
      404,
    )
  }

  const filename = `${result.data.batch.name}-${query.data.split}.${query.data.format}`
  if (query.data.format === 'csv') {
    return new Response(serializeLiteratureGoldSetCsv(result.data), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const response = literatureJson(result.data)
  response.headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  return response
}
