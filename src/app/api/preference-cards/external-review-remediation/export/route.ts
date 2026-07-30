import { NextResponse } from 'next/server'

import {
  createExternalReviewRemediationWorkbook,
  EXTERNAL_REVIEW_REMEDIATION_XLSX_MIME,
} from '@/features/preference-cards/excel/external-review-remediation-workbook.server'
import { requirePreferenceCardsSiteAdminApi } from '@/features/preference-cards/server/admin-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET(request: Request) {
  const auth = await requirePreferenceCardsSiteAdminApi()
  if (!auth.ok) return auth.response

  const requestUrl = new URL(request.url)
  const locale = requestUrl.searchParams.get('locale')?.trim() ?? 'en'
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_EXPORT_REQUEST',
          message: 'Choose a supported locale for the focused remediation workbook.',
        },
      },
      { status: 400, headers: PRIVATE_HEADERS },
    )
  }

  try {
    const workbook = await createExternalReviewRemediationWorkbook(requestUrl.origin, locale)
    return new Response(workbook.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Disposition': `attachment; filename="${workbook.filename}"`,
        'Content-Length': String(workbook.bytes.byteLength),
        'Content-Type': EXTERNAL_REVIEW_REMEDIATION_XLSX_MIME,
        'X-Product-Review-Count': workbook.metadata.product_review_count,
        'X-Exact-Slot-Review-Count': workbook.metadata.exact_slot_review_count,
        'X-Review-Id': workbook.metadata.review_id,
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'WORKBOOK_EXPORT_FAILED',
          message: 'The focused external-review remediation workbook could not be generated.',
        },
      },
      { status: 500, headers: PRIVATE_HEADERS },
    )
  }
}
