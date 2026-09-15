import { z } from 'zod'

/**
 * The legacy Learn record — read-only.
 *
 * Between the flow rebuild (September 2026) and HD-01 the stage wrote here which sections had been
 * "worked through" — a completion earned by doing every step, several of which required a correct
 * answer (five correct tracings, every atrial component identified, a defensible provenance
 * choice). Under the self-paced decision that is not a claim the module makes any more, and an old
 * completion is not converted into a current "reviewed" mark. Nothing in the module reads or writes
 * this key now; the parser stays so a stored record can still be recognised, and whatever is on a
 * device is left exactly as it was. Current state lives in `selfPacedProgress.ts`.
 */
export const ICU_HEMODYNAMICS_LEARN_STORAGE_KEY = 'icu-hemodynamics-learn-v1'

const learnRecordSchema = z
  .object({
    version: z.literal(1),
    completedSectionIds: z.array(z.string().min(1).max(160)).max(64),
    lastSectionId: z.string().min(1).max(160).nullable(),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type IcuHemodynamicsLearnRecord = z.infer<typeof learnRecordSchema>

export function parseLearnRecord(
  serialized: string | null | undefined,
): IcuHemodynamicsLearnRecord | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    const result = learnRecordSchema.safeParse(parsed)
    if (!result.success) return null
    return {
      ...result.data,
      completedSectionIds: [...new Set(result.data.completedSectionIds)],
    }
  } catch {
    return null
  }
}
