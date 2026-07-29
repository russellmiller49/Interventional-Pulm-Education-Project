import { NextResponse } from 'next/server'

import {
  getClinicalUseReviewRuntimeContext,
  importClinicalUseReviewWorkbook,
} from '@/features/preference-cards/excel/clinical-use-review-workbook.server'
import { requirePreferenceCardsSiteAdminApi } from '@/features/preference-cards/server/admin-access'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/features/preference-cards/server/bounded-request-body.server'
import { isActiveLocale } from '@/i18n/locale'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024
const PRIVATE_JSON_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

function workbookFileName(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get('filename')
  if (!raw || raw.length > 220 || /[\u0000-\u001f\u007f]/.test(raw)) return null
  const baseName = raw.split(/[\\/]/).at(-1)?.trim()
  return baseName && baseName.toLocaleLowerCase().endsWith('.xlsx') ? baseName : null
}

function workbookLocale(request: Request): string | null {
  const locale = new URL(request.url).searchParams.get('locale')
  return isActiveLocale(locale) ? locale : null
}

export async function POST(request: Request) {
  const auth = await requirePreferenceCardsSiteAdminApi()
  if (!auth.ok) return auth.response

  const fileName = workbookFileName(request)
  const locale = workbookLocale(request)
  if (!fileName || !locale) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_WORKBOOK_FILENAME',
          message: 'Choose a macro-free .xlsx full-catalog clinical-use workbook.',
        },
      },
      { status: 400, headers: PRIVATE_JSON_HEADERS },
    )
  }

  let bytes: Uint8Array
  try {
    bytes = await readBoundedRequestBody(request, MAX_WORKBOOK_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        {
          error: {
            code: 'WORKBOOK_TOO_LARGE',
            message: 'The workbook exceeds the 20 MB upload limit.',
          },
        },
        { status: 413, headers: PRIVATE_JSON_HEADERS },
      )
    }
    return NextResponse.json(
      {
        error: {
          code: 'WORKBOOK_VALIDATION_FAILED',
          message: 'The workbook upload could not be read.',
        },
      },
      { status: 400, headers: PRIVATE_JSON_HEADERS },
    )
  }

  try {
    if (bytes.byteLength === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'EMPTY_WORKBOOK',
            message: 'The workbook must be a nonempty .xlsx file no larger than 20 MB.',
          },
        },
        { status: 400, headers: PRIVATE_JSON_HEADERS },
      )
    }
    const runtimeContext = await getClinicalUseReviewRuntimeContext()
    const preview = await importClinicalUseReviewWorkbook(bytes, {
      applicationBaseUrl: new URL(request.url).origin,
      fileName,
      importedAt: new Date().toISOString(),
      locale,
      currentClinicalUseManifestSha256: runtimeContext.clinicalUseManifestSha256,
    })
    return NextResponse.json(preview, {
      status: 200,
      headers: PRIVATE_JSON_HEADERS,
    })
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'WORKBOOK_VALIDATION_FAILED',
          message:
            'The workbook could not be validated. Confirm that it is an unencrypted, macro-free export from this full-catalog clinical-use workflow.',
        },
      },
      { status: 422, headers: PRIVATE_JSON_HEADERS },
    )
  }
}
