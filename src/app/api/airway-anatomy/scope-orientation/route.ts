import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  SCOPE_ORIENTATION_CALIBRATION_SCHEMA,
  normalizeScopeOrientationCalibration,
  parseScopeOrientationProfileId,
  updateScopeOrientationAdjustment,
  type ScopeOrientationAdjustment,
} from '@/lib/airway-anatomy/scope-orientation'

export const runtime = 'nodejs'

const projectRoot = process.cwd()
const calibrationPath = resolve(
  projectRoot,
  'public/airway-anatomy/case-001/scope_orientation_calibration.json',
)

export async function POST(request: NextRequest) {
  if (!isLocalAirwayOrientationWriteEnabled()) {
    return new NextResponse('airway orientation writes are only available in local development', {
      status: 404,
    })
  }

  const body = await readJsonBody(request)
  const edgeId = typeof body.edgeId === 'number' ? body.edgeId : Number(body.edgeId)
  if (!Number.isInteger(edgeId) || edgeId < 0) {
    return new NextResponse('edgeId must be a non-negative integer', { status: 400 })
  }

  const profileId = parseScopeOrientationProfileId(body.profileId)
  if (!profileId) {
    return new NextResponse('profileId must be flexible or robotic', { status: 400 })
  }

  if (body.adjustment !== null && !isScopeOrientationAdjustment(body.adjustment)) {
    return new NextResponse('adjustment must contain a numeric rollDeg or be null', {
      status: 400,
    })
  }

  const payload = await readScopeOrientationCalibration()
  const nextPayload = updateScopeOrientationAdjustment(
    {
      ...payload,
      schema: SCOPE_ORIENTATION_CALIBRATION_SCHEMA,
    },
    profileId,
    edgeId,
    body.adjustment,
  )

  await mkdir(dirname(calibrationPath), { recursive: true })
  await writeFile(calibrationPath, `${JSON.stringify(nextPayload, null, 2)}\n`, 'utf8')

  return NextResponse.json({
    ok: true,
    path: '/airway-anatomy/case-001/scope_orientation_calibration.json',
    profileId,
    edgeId,
  })
}

function isLocalAirwayOrientationWriteEnabled() {
  return (
    process.env.NODE_ENV === 'development' || process.env.ENABLE_AIRWAY_ORIENTATION_WRITE === 'true'
  )
}

async function readScopeOrientationCalibration() {
  try {
    return normalizeScopeOrientationCalibration(JSON.parse(await readFile(calibrationPath, 'utf8')))
  } catch {
    return normalizeScopeOrientationCalibration(null)
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

function isScopeOrientationAdjustment(value: unknown): value is ScopeOrientationAdjustment {
  return isRecord(value) && typeof value.rollDeg === 'number' && Number.isFinite(value.rollDeg)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
