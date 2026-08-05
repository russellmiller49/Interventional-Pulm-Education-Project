import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * The one privileged call in the rebuild, and nothing else.
 *
 * Every owner-scoped read in this workflow — the source card, its revision, the current release,
 * plan reconstruction, review validation, the final resolve — runs on the authenticated cookie
 * client under row-level security, and must keep doing so. A service client reads *every* owner's
 * cards; swapping it in globally would turn an owner-scoped feature into an unscoped one to solve a
 * write problem. So the split is deliberate: authenticated authority validates, and this module
 * writes.
 *
 * `import 'server-only'` is the mechanical guard. This module reads `SUPABASE_SERVICE_ROLE_KEY`, and
 * a build that ever pulls it into a client bundle should fail rather than ship it.
 *
 * It exports one function. There is no general admin client here on purpose: the point of the
 * database-side boundary is that `service_role` can execute one narrow RPC and still cannot insert a
 * forged provenance row directly, and re-exporting a general client from the rebuild module would
 * make that boundary a matter of who remembers to use which import.
 */

/** What the trusted RPC needs. Every field is server-computed; none comes from the browser. */
export interface RebuiltCardWrite {
  ownerId: string
  sourceCardId: string
  sourceRevisionId: string
  /** Re-checked against the stored revision inside the same statement that inserts. */
  sourceSnapshotHash: string
  sourceReleaseBundleId: string | null
  title: string
  physicianName: string | null
  procedureCode: string
  scenarioId: string
  builderInputs: unknown
  cardSnapshot: unknown
  snapshotHash: string
  engineVersion: string
  catalogImportId: string
  rebuildProvenance: unknown
}

export type RebuiltCardWriteResult =
  | { ok: true; cardId: string }
  /** `source_moved` is the RPC's own recheck failing: the revision changed or is gone. */
  | { ok: false; code: 'source_moved' | 'write_failed' | 'not_configured'; message: string }

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  // No session, no refresh, no persistence: this client exists for the duration of one RPC call and
  // must never adopt or write a user session.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

/**
 * Create the rebuilt card through the narrow trusted RPC.
 *
 * The RPC re-derives the source facts from the database and refuses if they have moved, so a source
 * deleted between review and submission produces no card rather than a row citing a revision that no
 * longer exists.
 */
export async function writeRebuiltCard(write: RebuiltCardWrite): Promise<RebuiltCardWriteResult> {
  const client = serviceClient()
  if (!client) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'The rebuild writer is not configured on this deployment.',
    }
  }

  const { data, error } = await client.rpc('ip_create_rebuilt_preference_card', {
    p_owner_id: write.ownerId,
    p_source_card_id: write.sourceCardId,
    p_source_revision_id: write.sourceRevisionId,
    p_source_snapshot_hash: write.sourceSnapshotHash,
    p_source_release_bundle_id: write.sourceReleaseBundleId,
    p_title: write.title,
    p_physician_name: write.physicianName,
    p_procedure_code: write.procedureCode,
    p_scenario_id: write.scenarioId,
    p_builder_inputs: write.builderInputs,
    p_card_snapshot: write.cardSnapshot,
    p_snapshot_hash: write.snapshotHash,
    p_engine_version: write.engineVersion,
    p_catalog_import_id: write.catalogImportId,
    p_rebuild_provenance: write.rebuildProvenance,
  })

  if (error) {
    // `no_data_found` is the RPC's deliberate signal that its own recheck failed — the source card
    // or revision no longer matches what the review was taken against.
    if (error.code === '02000' || /no longer matches the database/i.test(error.message)) {
      return {
        ok: false,
        code: 'source_moved',
        message:
          'The card this rebuild was taken from has changed or been deleted, so nothing was created.',
      }
    }
    return { ok: false, code: 'write_failed', message: error.message }
  }
  if (typeof data !== 'string') {
    return {
      ok: false,
      code: 'write_failed',
      message: 'The database did not return a card identifier.',
    }
  }
  return { ok: true, cardId: data }
}
