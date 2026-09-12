import { NextResponse } from 'next/server'
import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'
import {
  MAX_SAVED_DEVICES,
  parseDeviceIds,
} from '@/features/device-intelligence/domain/saved-devices'
import { getSavedDeviceCards } from '@/features/device-intelligence/server/reference-workspace.server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (!deviceIntelligenceEnabled())
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers })
  const search = new URL(request.url).searchParams
  const ids =
    search.getAll('ids').length > 1 ? null : parseDeviceIds(search.get('ids'), MAX_SAVED_DEVICES)
  if (!ids) return NextResponse.json({ error: 'Invalid device list' }, { status: 400, headers })
  return NextResponse.json(getSavedDeviceCards(ids), { headers })
}
