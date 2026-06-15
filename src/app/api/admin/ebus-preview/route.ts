import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ siteAdmin: false }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const { data: adminEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('entitlement', 'site_admin')
      .eq('status', 'active')
      .maybeSingle()

    return NextResponse.json(
      { siteAdmin: Boolean(adminEntitlement) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ siteAdmin: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
