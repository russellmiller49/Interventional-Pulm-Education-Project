import type { SupabaseClient } from '@supabase/supabase-js'

import { executeDatabaseCall } from './database'

export const GOLD_SET_V1_BATCH_NAME = 'gold-set-v1' as const
export const GOLD_SET_V1_DATASET_SPLIT = 'development' as const

const SCOPE_PAGE_SIZE = 1_000
const MAX_SCOPE_PMIDS = 10_000

interface GoldSetBatchRow {
  id: string
  name: string
}

interface GoldSetItemPmidRow {
  pmid: string
}

export interface GoldSetV1DevelopmentScope {
  batchId: string
  batchName: typeof GOLD_SET_V1_BATCH_NAME
  datasetSplit: typeof GOLD_SET_V1_DATASET_SPLIT
  pmids: string[]
}

/**
 * Loads only the fixed gold-set-v1 development membership. This boundary deliberately selects
 * neither review fields nor held-out test rows.
 */
export async function loadGoldSetV1DevelopmentScope(
  client: SupabaseClient,
): Promise<GoldSetV1DevelopmentScope> {
  const batches = await executeDatabaseCall<GoldSetBatchRow[]>('gold-set-v1 batch lookup', () =>
    client
      .from('literature_gold_set_batches')
      .select('id,name')
      .eq('name', GOLD_SET_V1_BATCH_NAME)
      .limit(2),
  )
  if (!batches?.[0]) throw new Error(`${GOLD_SET_V1_BATCH_NAME} was not found.`)
  if (batches.length !== 1) throw new Error(`${GOLD_SET_V1_BATCH_NAME} is not unique.`)
  if (batches[0].name !== GOLD_SET_V1_BATCH_NAME) {
    throw new Error(`Unexpected data-quality batch name ${batches[0].name}.`)
  }

  const rows: GoldSetItemPmidRow[] = []
  for (let start = 0; start < MAX_SCOPE_PMIDS; start += SCOPE_PAGE_SIZE) {
    const page = await executeDatabaseCall<GoldSetItemPmidRow[]>(
      `gold-set-v1 development PMID page ${start / SCOPE_PAGE_SIZE + 1}`,
      () =>
        client
          .from('literature_gold_set_items')
          .select('pmid')
          .eq('batch_id', batches[0].id)
          .eq('dataset_split', GOLD_SET_V1_DATASET_SPLIT)
          .order('pmid', { ascending: true })
          .range(start, start + SCOPE_PAGE_SIZE - 1),
    )
    rows.push(...(page ?? []))
    if ((page?.length ?? 0) < SCOPE_PAGE_SIZE) break
  }
  if (rows.length >= MAX_SCOPE_PMIDS) {
    throw new Error(`gold-set-v1 development scope exceeds ${MAX_SCOPE_PMIDS} PMIDs.`)
  }

  const pmids = [...new Set(rows.map((row) => String(row.pmid).trim()))]
  for (const pmid of pmids) {
    if (!/^\d{1,12}$/u.test(pmid)) {
      throw new Error(`gold-set-v1 development scope contains invalid PMID "${pmid}".`)
    }
  }
  pmids.sort((left, right) => Number(left) - Number(right))
  if (pmids.length === 0) throw new Error('gold-set-v1 development scope is empty.')

  return {
    batchId: batches[0].id,
    batchName: GOLD_SET_V1_BATCH_NAME,
    datasetSplit: GOLD_SET_V1_DATASET_SPLIT,
    pmids,
  }
}
