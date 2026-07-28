import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { preferenceCardsEnabled } from '@/features/preference-cards/feature'
import {
  searchProductFamiliesForRole,
  searchProductsForRole,
} from '@/features/preference-cards/server/catalog'
import { supabaseServer } from '@/lib/supabase/server'
import { isPublicUnlistedPath } from '@/lib/site-auth/access'
import {
  hasValidLocalDevAuthCookie,
  LOCAL_DEV_AUTH_COOKIE_NAME,
} from '@/lib/site-auth/local-dev-auth'

/** The module this route serves; its access policy is the one applied below. */
const PREFERENCE_CARDS_PATH = '/preference-cards'

/**
 * Role-scoped catalog search backing the preference-card wizard picker.
 *
 * `src/proxy.ts` short-circuits before the Supabase gate for anything under `/api/`, so
 * this handler authenticates itself. A route handler is used rather than a server action
 * because typeahead needs parallel, abortable GETs.
 */

const querySchema = z.object({
  role: z.string().trim().min(1).max(80),
  q: z.string().trim().max(200).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  /**
   * `family` collapses the role's products into product lines, each carrying its sizes, so
   * the picker can drill from line to size without a second request. `limit` then counts
   * lines rather than products.
   */
  group: z.enum(['product', 'family']).default('product'),
})

export async function GET(request: Request) {
  if (!preferenceCardsEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  const url = new URL(request.url)

  // `/api/` bypasses the middleware gate, so this handler applies the module's own access
  // policy rather than a second one of its own. While `/preference-cards` is public-unlisted
  // — reachable by direct link for beta testers without an account — the picker behind it
  // has to be reachable too, or the wizard's catalog search 401s for exactly those users.
  // Re-gating the module automatically re-gates this route.
  if (!isPublicUnlistedPath(PREFERENCE_CARDS_PATH)) {
    // The local-dev cookie is accepted on the same terms the middleware uses — it is inert
    // unless LOCAL_DEV_AUTH_ENABLED is set outside production.
    const cookieStore = await cookies()
    const devAuthorized = hasValidLocalDevAuthCookie(
      url,
      cookieStore.get(LOCAL_DEV_AUTH_COOKIE_NAME)?.value,
    )
    if (!devAuthorized) {
      const supabase = await supabaseServer()
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error || !user) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
      }
    }
  }
  const parsed = querySchema.safeParse({
    role: url.searchParams.get('role') ?? '',
    q: url.searchParams.get('q') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
    group: url.searchParams.get('group') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid catalog search request.' },
      { status: 400 },
    )
  }

  const query = {
    roleCode: parsed.data.role,
    q: parsed.data.q,
    limit: parsed.data.limit,
  }
  const body =
    parsed.data.group === 'family'
      ? { families: searchProductFamiliesForRole(query) }
      : { options: searchProductsForRole(query) }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, max-age=30', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
