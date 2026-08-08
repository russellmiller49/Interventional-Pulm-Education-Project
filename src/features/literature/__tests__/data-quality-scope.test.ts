/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  GOLD_SET_V1_BATCH_NAME,
  GOLD_SET_V1_DATASET_SPLIT,
  loadGoldSetV1DevelopmentScope,
} from '../../../../scripts/literature/lib/data-quality-scope'

interface QueryCall {
  arguments: unknown[]
  method: string
  table: string
}

function scopedClient() {
  const calls: QueryCall[] = []
  const client = {
    from(table: string) {
      const result =
        table === 'literature_gold_set_batches'
          ? [{ id: 'batch-id', name: GOLD_SET_V1_BATCH_NAME }]
          : [{ pmid: '39414327' }, { pmid: '12345678' }]
      const query = {
        select(...arguments_: unknown[]) {
          calls.push({ table, method: 'select', arguments: arguments_ })
          return query
        },
        eq(...arguments_: unknown[]) {
          calls.push({ table, method: 'eq', arguments: arguments_ })
          return query
        },
        limit(...arguments_: unknown[]) {
          calls.push({ table, method: 'limit', arguments: arguments_ })
          return query
        },
        order(...arguments_: unknown[]) {
          calls.push({ table, method: 'order', arguments: arguments_ })
          return query
        },
        range(...arguments_: unknown[]) {
          calls.push({ table, method: 'range', arguments: arguments_ })
          return query
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: result, error: null }).then(resolve)
        },
      }
      return query
    },
  }
  return { calls, client: client as unknown as SupabaseClient }
}

describe('gold-set-v1 data-quality scope', () => {
  it('loads only fixed development PMIDs without reading test or review data', async () => {
    const { calls, client } = scopedClient()

    const scope = await loadGoldSetV1DevelopmentScope(client)

    expect(scope).toEqual({
      batchId: 'batch-id',
      batchName: GOLD_SET_V1_BATCH_NAME,
      datasetSplit: GOLD_SET_V1_DATASET_SPLIT,
      pmids: ['12345678', '39414327'],
    })
    expect(calls).toContainEqual({
      table: 'literature_gold_set_batches',
      method: 'select',
      arguments: ['id,name'],
    })
    expect(calls).toContainEqual({
      table: 'literature_gold_set_items',
      method: 'select',
      arguments: ['pmid'],
    })
    expect(calls).toContainEqual({
      table: 'literature_gold_set_items',
      method: 'eq',
      arguments: ['dataset_split', 'development'],
    })
    expect(calls.some((call) => call.arguments.includes('test'))).toBe(false)
    expect(calls.some((call) => /review/iu.test(call.table))).toBe(false)
  })
})
