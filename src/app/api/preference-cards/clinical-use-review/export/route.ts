import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  CLINICAL_USE_REVIEW_XLSX_MIME,
  createClinicalUseReviewWorkbook,
} from '@/features/preference-cards/excel/clinical-use-review-workbook.server'
import { requirePreferenceCardsSiteAdminApi } from '@/features/preference-cards/server/admin-access'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/features/preference-cards/server/bounded-request-body.server'
import { isActiveLocale } from '@/i18n/locale'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_EXPORT_REQUEST_BYTES = 32 * 1024
const PRIVATE_JSON_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

const exportRequestSchema = z
  .object({
    locale: z.string().refine(isActiveLocale),
  })
  .strict()

export async function POST(request: Request) {
  const auth = await requirePreferenceCardsSiteAdminApi()
  if (!auth.ok) return auth.response

  let requestBytes: Uint8Array
  try {
    requestBytes = await readBoundedRequestBody(request, MAX_EXPORT_REQUEST_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: { code: 'EXPORT_REQUEST_TOO_LARGE', message: 'Export request is too large.' } },
        { status: 413, headers: PRIVATE_JSON_HEADERS },
      )
    }
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_EXPORT_REQUEST',
          message: 'The workbook export request could not be read.',
        },
      },
      { status: 400, headers: PRIVATE_JSON_HEADERS },
    )
  }

  try {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(new TextDecoder().decode(requestBytes))
    } catch {
      parsedJson = null
    }
    const requestBody = exportRequestSchema.safeParse(parsedJson)
    if (!requestBody.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_EXPORT_REQUEST',
            message: 'Choose a supported locale for the full-catalog workbook.',
            fields: requestBody.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: PRIVATE_JSON_HEADERS },
      )
    }

    const workbook = await createClinicalUseReviewWorkbook(
      requestBody.data,
      new URL(request.url).origin,
    )
    return new Response(workbook.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${workbook.filename}"`,
        'Content-Length': String(workbook.bytes.byteLength),
        'Content-Type': CLINICAL_USE_REVIEW_XLSX_MIME,
        'X-Catalog-Product-Count': workbook.metadata.catalog_product_count,
        'X-Content-Type-Options': 'nosniff',
        'X-Current-Slot-Count': workbook.metadata.current_slot_count,
        'X-Product-Role-Count': workbook.metadata.product_role_count,
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'WORKBOOK_EXPORT_FAILED',
          message: 'The full-catalog clinical-use workbook could not be generated.',
        },
      },
      { status: 500, headers: PRIVATE_JSON_HEADERS },
    )
  }
}
