import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'

import type { ResolvedCard } from '../domain/types'

const persistedSnapshotSchema = z
  .object({
    recipeVersionId: z.string().min(1),
    recipeName: z.string().min(1),
    recipeVersion: z.string().min(1),
    sourceProcedureCode: z.string().min(1),
    organizationName: z.string().min(1),
    siteName: z.string().min(1),
    locationName: z.string().min(1),
    selectedModifiers: z.array(z.string()),
    items: z.array(z.unknown()),
    suppressedItems: z.array(z.unknown()),
    warnings: z.array(z.unknown()),
    readinessState: z.enum(['blocked', 'complete_with_warnings', 'complete']),
    governanceState: z.enum(['draft', 'in_review', 'approved', 'retired']),
    ruleTrace: z.array(z.unknown()),
    engineVersion: z.string().min(1),
    catalogImportId: z.string().min(1),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    generatedAt: z.string().datetime(),
    prototype: z.boolean(),
  })
  .passthrough()

export async function loadPersistedResolvedCard(cardId: string): Promise<ResolvedCard | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cardId)) {
    return null
  }
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('ip_case_cards')
    .select('snapshot_hash, snapshot_json')
    .eq('id', cardId)
    .maybeSingle()
  if (error || !data) return null
  const parsed = persistedSnapshotSchema.safeParse(data.snapshot_json)
  if (!parsed.success || parsed.data.snapshotHash !== data.snapshot_hash) {
    return null
  }
  return parsed.data as ResolvedCard
}
