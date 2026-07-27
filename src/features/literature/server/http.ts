import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

interface LiteratureApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function literatureJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function literatureApiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  const body: LiteratureApiErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }
  return literatureJson(body, status)
}

export function literatureValidationError(error: ZodError) {
  return literatureApiError(
    'LITERATURE_INVALID_REQUEST',
    'The literature request is invalid.',
    400,
    error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join('.'),
    })),
  )
}
