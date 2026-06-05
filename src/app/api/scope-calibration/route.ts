import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SCOPE_CALIBRATION_SCHEMA = 'bronchoedu_scope_calibration/v1'
const projectRoot = process.cwd()
const sourceAppCandidates = [
  resolve(projectRoot, '../navigation_module/web'),
  resolve(projectRoot, '../Navigation_module/web'),
]

interface ScopeCalibrationPayload {
  schema: string
  caseId?: string
  updatedAt?: string
  adjustments: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  if (!isLocalScopeCalibrationEnabled()) {
    return new NextResponse('scope calibration writes are only available in local development', {
      status: 404,
    })
  }

  const body = await readJsonBody(request)
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : ''
  if (!/^\d+$/.test(nodeId)) {
    return new NextResponse('nodeId must be a numeric string', { status: 400 })
  }

  const sourceAppDir = await findSourceAppDir()
  if (!sourceAppDir) {
    return new NextResponse(`source app not found. Checked: ${sourceAppCandidates.join(', ')}`, {
      status: 404,
    })
  }

  if (body.adjustment !== null && !isRecord(body.adjustment)) {
    return new NextResponse('adjustment must be an object or null', { status: 400 })
  }

  const calibrationPath = resolve(sourceAppDir, 'public/cases/default/scope_calibration.json')
  const payload = await readScopeCalibration(calibrationPath)
  payload.caseId = typeof body.caseId === 'string' ? body.caseId : payload.caseId
  payload.updatedAt = new Date().toISOString()

  if (body.adjustment === null) {
    delete payload.adjustments[nodeId]
  } else {
    payload.adjustments[nodeId] = body.adjustment
  }

  await mkdir(dirname(calibrationPath), { recursive: true })
  await writeFile(calibrationPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return NextResponse.json({ ok: true, path: '/cases/default/scope_calibration.json' })
}

function isLocalScopeCalibrationEnabled() {
  return (
    process.env.NODE_ENV === 'development' || process.env.ENABLE_SCOPE_CALIBRATION_WRITE === 'true'
  )
}

async function findSourceAppDir() {
  for (const candidate of sourceAppCandidates) {
    try {
      await access(resolve(candidate, 'public/cases/default/case.json'))
      return candidate
    } catch {
      // Try the next known checkout spelling.
    }
  }
  return null
}

async function readScopeCalibration(calibrationPath: string): Promise<ScopeCalibrationPayload> {
  try {
    const parsed = JSON.parse(await readFile(calibrationPath, 'utf8'))
    if (isRecord(parsed) && isRecord(parsed.adjustments)) {
      return {
        ...parsed,
        schema: SCOPE_CALIBRATION_SCHEMA,
        adjustments: parsed.adjustments as Record<string, unknown>,
      }
    }
  } catch {
    // Fall through to a fresh calibration file.
  }

  return {
    schema: SCOPE_CALIBRATION_SCHEMA,
    caseId: 'synthetic-target',
    adjustments: {} as Record<string, unknown>,
  }
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
