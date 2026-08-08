import { z } from 'zod'

import { verifySnapshotIntegrity } from '../domain/card-hashes'
import type { ResolvedCard } from '../domain/types'

/**
 * The stored form of `card_snapshot`, and the one check that decides whether it may be trusted.
 *
 * This lives on its own because two tables now hold the same payload — the card row and every
 * revision of it — and a stored snapshot that the card loader would reject must not become
 * readable by going through the revision loader instead. One schema, one verification, both
 * callers.
 */

/**
 * `passthrough` keeps fields the schema does not enumerate; the hash checks in
 * `parsePersistedSnapshot` are what actually guarantee the payload is the one that was written.
 */
export const persistedSnapshotSchema = z
  .object({
    recipeVersionId: z.string().min(1),
    recipeName: z.string().min(1),
    recipeVersion: z.string().min(1),
    sourceProcedureCode: z.string().min(1),
    selectedModifiers: z.array(z.string()),
    /**
     * Absent on snapshots written before composition. Those cards stay viewable and
     * printable from what they recorded; only the builder needs the manifest.
     */
    includedModules: z.array(z.unknown()).optional(),
    items: z.array(z.unknown()),
    suppressedItems: z.array(z.unknown()),
    warnings: z.array(z.unknown()),
    readinessState: z.enum(['blocked', 'complete_with_warnings', 'complete']),
    governanceState: z.enum(['draft', 'in_review', 'approved', 'retired']),
    ruleTrace: z.array(z.unknown()),
    engineVersion: z.string().min(1),
    catalogImportId: z.string().min(1),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    /**
     * Absent on snapshots written before the hashes were split. Those rows stay viewable and
     * printable and keep verifying against the storage identity they were written with; nothing is
     * rewritten on read. Present, they are checked — see `parsePersistedSnapshot`.
     */
    snapshotIntegrityHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    resolvedContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    generatedAt: z.string().datetime(),
  })
  .passthrough()

/**
 * A stored snapshot is only usable if it still verifies.
 *
 * Two checks, because rows exist in two shapes and neither may be rewritten on read. Every row
 * carries the storage identity hash the `snapshot_hash` column holds, and that is compared as it
 * always was. Rows written from the split onward *also* carry an integrity hash over the complete
 * snapshot — including `generatedAt` and the warning acknowledgements, the fields the storage hash
 * deliberately excludes — and where one is present it is recomputed and must match. Its absence on
 * an older row is not a failure: an unverifiable-by-that-means row is not a tampered row, and
 * treating it as one would make every pre-existing card unopenable.
 */
export function parsePersistedSnapshot(
  snapshot: unknown,
  expectedHash: string,
): ResolvedCard | null {
  const parsed = persistedSnapshotSchema.safeParse(snapshot)
  if (!parsed.success || parsed.data.snapshotHash !== expectedHash) return null
  if (verifySnapshotIntegrity(snapshot) === false) return null
  return parsed.data as unknown as ResolvedCard
}
