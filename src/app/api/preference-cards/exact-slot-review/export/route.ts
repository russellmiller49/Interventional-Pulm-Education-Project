import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  createExactSlotReviewWorkbook,
  EXACT_SLOT_REVIEW_XLSX_MIME,
} from '@/features/preference-cards/excel/exact-slot-review-workbook.server'
import { requirePreferenceCardsSiteAdminApi } from '@/features/preference-cards/server/admin-access'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/features/preference-cards/server/bounded-request-body.server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_EXPORT_REQUEST_BYTES = 256 * 1024
const PRIVATE_JSON_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

const boundedText = z.string().trim().max(160).optional()
const exportRequestSchema = z
  .object({
    scope: z.enum(['filtered', 'all', 'required', 'unreviewed', 'product']),
    locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
    filters: z
      .object({
        q: boundedText,
        procedure: boundedText,
        role: boundedText,
        requiredness: boundedText,
        manufacturer: boundedText,
        distribution: boundedText,
        verification: boundedText,
        visibility: boundedText,
      })
      .strict()
      .optional(),
    reviewedProposalKeys: z
      .array(z.string().regex(/^SLOT-[A-Z0-9]+:PRD-[A-Z0-9]+$/))
      .max(2_500)
      .optional(),
    productId: z
      .string()
      .regex(/^PRD-[A-Z0-9]{6,20}$/)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === 'product' && !value.productId) {
      context.addIssue({
        code: 'custom',
        message: 'productId is required for a product-scoped export.',
        path: ['productId'],
      })
    }
  })

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
            message: 'Choose a supported workbook export scope and valid filters.',
            fields: requestBody.error.flatten().fieldErrors,
          },
        },
        {
          status: 400,
          headers: PRIVATE_JSON_HEADERS,
        },
      )
    }

    const workbook = await createExactSlotReviewWorkbook(
      requestBody.data,
      new URL(request.url).origin,
    )
    return new Response(workbook.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${workbook.filename}"`,
        'Content-Length': String(workbook.bytes.byteLength),
        'Content-Type': EXACT_SLOT_REVIEW_XLSX_MIME,
        'X-Content-Type-Options': 'nosniff',
        'X-Proposal-Count': workbook.metadata.proposal_count,
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'WORKBOOK_EXPORT_FAILED',
          message: 'The clinician review workbook could not be generated.',
        },
      },
      {
        status: 500,
        headers: PRIVATE_JSON_HEADERS,
      },
    )
  }
}
