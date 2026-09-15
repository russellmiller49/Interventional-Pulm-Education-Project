import { z } from 'zod'

/**
 * The self-paced record: where the learner was, which sections and cases they opened, and which
 * sections they marked reviewed. Nothing else.
 *
 * HD-01 (September 2026, owner decision: these modules are self-paced, not examinations). It
 * replaces the two writers the module had — the Learn completion record (`icu-hemodynamics-learn-v1`,
 * earned by working every step, several of them correctness-gated) and the case ledger
 * (`icu-hemodynamics-progress-v2`: attempts, best scores, mastery). Both of those keys are left
 * exactly as they are on the device; this file never reads or writes them, so a historical score
 * cannot become a current review claim and a new session cannot add to an old grade.
 *
 * What the fields mean, and do not mean:
 * - `visitedSectionIds` / `openedCaseIds`: the learner opened it. Not that any step was done.
 * - `reviewedSectionIds`: the learner chose to mark it reviewed (finishing a section does this, and
 *   the completion card can undo it). Not a statement about answers, actions or competence.
 * - `location`: the last section or case opened, for Resume. A reload still starts a section at its
 *   first step and a case fresh; no answer, action or patient state is stored.
 */
export const ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY = 'icu-hemodynamics-self-paced-v1'
export const ICU_HEMODYNAMICS_SELF_PACED_CHANGED_EVENT = 'icu-hemodynamics-self-paced-changed'

const MAX_IDS = 64
const idSchema = z.string().min(1).max(160)
const idListSchema = z.array(idSchema).max(MAX_IDS)

const locationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('section'), sectionId: idSchema }).strict(),
  z
    .object({
      kind: z.literal('case'),
      caseId: idSchema,
      mode: z.enum(['practice', 'applied']),
    })
    .strict(),
])

const selfPacedRecordSchema = z
  .object({
    version: z.literal(1),
    visitedSectionIds: idListSchema,
    reviewedSectionIds: idListSchema,
    openedCaseIds: idListSchema,
    location: locationSchema.nullable(),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type IcuHemodynamicsSelfPacedRecord = z.infer<typeof selfPacedRecordSchema>
export type IcuHemodynamicsSelfPacedLocation = NonNullable<
  IcuHemodynamicsSelfPacedRecord['location']
>

export function createEmptySelfPacedRecord(): IcuHemodynamicsSelfPacedRecord {
  return {
    version: 1,
    visitedSectionIds: [],
    reviewedSectionIds: [],
    openedCaseIds: [],
    location: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

export function parseSelfPacedRecord(
  serialized: string | null | undefined,
): IcuHemodynamicsSelfPacedRecord | null {
  if (!serialized) return null
  try {
    const result = selfPacedRecordSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return null
    return {
      ...result.data,
      visitedSectionIds: [...new Set(result.data.visitedSectionIds)],
      reviewedSectionIds: [...new Set(result.data.reviewedSectionIds)],
      openedCaseIds: [...new Set(result.data.openedCaseIds)],
    }
  } catch {
    return null
  }
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readSelfPacedRecord(): IcuHemodynamicsSelfPacedRecord {
  const store = storage()
  if (!store) return createEmptySelfPacedRecord()
  try {
    return (
      parseSelfPacedRecord(store.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)) ??
      createEmptySelfPacedRecord()
    )
  } catch {
    return createEmptySelfPacedRecord()
  }
}

/** Writes the record. A refused or unavailable store returns false and never interrupts learning. */
export function writeSelfPacedRecord(record: IcuHemodynamicsSelfPacedRecord): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(
      ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
      JSON.stringify(selfPacedRecordSchema.parse(record)),
    )
    window.dispatchEvent(new Event(ICU_HEMODYNAMICS_SELF_PACED_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

/**
 * Read, change, write. The one way the module's components update the record.
 *
 * A stored value that cannot be read is left exactly as it is — learning carries on with an empty
 * record in memory, and nothing silently replaces what is on the device.
 */
export function updateSelfPacedRecord(
  change: (record: IcuHemodynamicsSelfPacedRecord) => IcuHemodynamicsSelfPacedRecord,
): boolean {
  const store = storage()
  if (!store) return false
  let raw: string | null
  try {
    raw = store.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)
  } catch {
    return false
  }
  const parsed = parseSelfPacedRecord(raw)
  if (raw !== null && !parsed) return false
  const current = parsed ?? createEmptySelfPacedRecord()
  const next = change(current)
  if (next === current) return true
  return writeSelfPacedRecord(next)
}

function withId(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return [...ids]
  // Keep the newest entries if a record ever reaches the cap; the ids are all known registry ids.
  return [...ids, id].slice(-MAX_IDS)
}

export function withSectionVisited(
  record: IcuHemodynamicsSelfPacedRecord,
  sectionId: string,
  now = new Date().toISOString(),
): IcuHemodynamicsSelfPacedRecord {
  if (
    record.visitedSectionIds.includes(sectionId) &&
    record.location?.kind === 'section' &&
    record.location.sectionId === sectionId
  ) {
    return record
  }
  return {
    ...record,
    visitedSectionIds: withId(record.visitedSectionIds, sectionId),
    location: { kind: 'section', sectionId },
    updatedAt: now,
  }
}

export function withSectionReviewed(
  record: IcuHemodynamicsSelfPacedRecord,
  sectionId: string,
  reviewed: boolean,
  now = new Date().toISOString(),
): IcuHemodynamicsSelfPacedRecord {
  const has = record.reviewedSectionIds.includes(sectionId)
  if (has === reviewed) return record
  return {
    ...record,
    reviewedSectionIds: reviewed
      ? withId(record.reviewedSectionIds, sectionId)
      : record.reviewedSectionIds.filter((id) => id !== sectionId),
    updatedAt: now,
  }
}

export function withCaseOpened(
  record: IcuHemodynamicsSelfPacedRecord,
  caseId: string,
  mode: 'practice' | 'applied',
  now = new Date().toISOString(),
): IcuHemodynamicsSelfPacedRecord {
  if (
    record.openedCaseIds.includes(caseId) &&
    record.location?.kind === 'case' &&
    record.location.caseId === caseId &&
    record.location.mode === mode
  ) {
    return record
  }
  return {
    ...record,
    openedCaseIds: withId(record.openedCaseIds, caseId),
    location: { kind: 'case', caseId, mode },
    updatedAt: now,
  }
}

export function isSectionReviewed(record: IcuHemodynamicsSelfPacedRecord, sectionId: string) {
  return record.reviewedSectionIds.includes(sectionId)
}

export function isSectionVisited(record: IcuHemodynamicsSelfPacedRecord, sectionId: string) {
  return record.visitedSectionIds.includes(sectionId)
}

/** The section the learner was last in, if the last thing they opened was a section. */
export function lastSectionId(record: IcuHemodynamicsSelfPacedRecord): string | null {
  return record.location?.kind === 'section' ? record.location.sectionId : null
}
