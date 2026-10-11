/**
 * The numbers register: every clinical number a module teaches, written once with its source.
 *
 * A module keeps its register in `content/teachingNumbers.ts` and builds it with
 * `defineTeachingNumbers`. Copy and components read a value from the register rather than typing
 * it, so a guideline update is one edit and a value cannot drift from its source.
 *
 * An agent may add a guideline-, consensus- or device-class row without waiting for a reviewer,
 * provided the row carries its source, year, grade and locator. The number then renders as
 * ordinary teaching; nothing tells the learner it is pending. `unsignedTeachingNumbers` is the
 * owner's weekly sign-off list (`npm run numbers:signoff`). See `docs/teaching-first-rules.md`.
 */
export type TeachingNumberClass =
  /** A value a clinical practice guideline recommends. */
  | 'guideline'
  /** A value from a consensus statement, a landmark trial protocol or a society position paper. */
  | 'consensus'
  /** A property or limit of a device, from its instructions for use or operator's manual. */
  | 'device'
  /** A value an authoritative textbook chapter or review recommends as one sound approach. */
  | 'expert-reference'
  /** A normal value or a physiological relationship from a standard reference. */
  | 'physiology'
  /** A round figure chosen for teaching, with no external authority. Says so in `note`. */
  | 'teaching-convention'

export interface TeachingNumberCitation {
  /** An id in the module's own source registry. */
  readonly sourceId: string
  /** The year the source was published. */
  readonly year: number
  /** The source's own grade for this recommendation, as printed. Null when it prints none. */
  readonly grade: string | null
  /** Recommendation number, table, figure, section or page. */
  readonly locator: string
}

export interface TeachingNumberRow {
  /** What the number is, as a learner would name it. */
  readonly label: string
  /** The words that render, units included: "≤30 cmH₂O", "4–8 mL/kg PBW". */
  readonly value: string
  /** The population or situation the value applies to, when it is narrower than the label. */
  readonly appliesTo?: string
  readonly class: TeachingNumberClass
  readonly sources: readonly TeachingNumberCitation[]
  /** ISO date the value was checked against its source. */
  readonly checkedOn: string
  readonly checkedBy: string
  /** The owner's signature and its date. Null until signed; the row teaches meanwhile. */
  readonly signedBy: string | null
  readonly signedOn: string | null
  /** Where sources differ, or what a teaching convention rounds. Shown with the sources. */
  readonly note?: string
}

export type TeachingNumber<Id extends string = string> = TeachingNumberRow & { readonly id: Id }

export interface TeachingNumberRegister<Id extends string = string> {
  readonly moduleId: string
  readonly rows: readonly TeachingNumber<Id>[]
  /** The row, or a thrown error naming the id: a typo fails the build, not the learner. */
  readonly get: (id: Id) => TeachingNumber<Id>
  /** The words that render for this row. */
  readonly value: (id: Id) => string
}

export function defineTeachingNumbers<const Rows extends Record<string, TeachingNumberRow>>(
  moduleId: string,
  rows: Rows,
): TeachingNumberRegister<Extract<keyof Rows, string>> {
  type Id = Extract<keyof Rows, string>
  const list = (Object.keys(rows) as Id[]).map((id) => ({ id, ...rows[id] }))
  const byId = new Map<Id, TeachingNumber<Id>>(list.map((row) => [row.id, row]))
  const get = (id: Id): TeachingNumber<Id> => {
    const row = byId.get(id)
    if (!row) throw new Error(`${moduleId}: no teaching number "${id}"`)
    return row
  }
  return { moduleId, rows: list, get, value: (id) => get(id).value }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * What is wrong with a register. Empty when every row can be traced.
 *
 * `registeredSourceIds` is the module's source registry; a citation that names nothing in it fails.
 */
export function teachingNumberErrors(
  register: Pick<TeachingNumberRegister, 'moduleId' | 'rows'>,
  registeredSourceIds: ReadonlySet<string>,
): readonly string[] {
  const errors: string[] = []
  for (const row of register.rows) {
    const where = `${register.moduleId} number "${row.id}"`
    if (row.label.trim().length === 0) errors.push(`${where}: no label`)
    if (row.value.trim().length === 0) errors.push(`${where}: no value`)
    if (!ISO_DATE.test(row.checkedOn)) errors.push(`${where}: checkedOn is not an ISO date`)
    if (row.checkedBy.trim().length === 0) errors.push(`${where}: no checkedBy`)
    if ((row.signedBy === null) !== (row.signedOn === null)) {
      errors.push(`${where}: signedBy and signedOn must be set together`)
    }
    if (row.signedOn !== null && !ISO_DATE.test(row.signedOn)) {
      errors.push(`${where}: signedOn is not an ISO date`)
    }
    if (row.class === 'teaching-convention') {
      if (!row.note?.trim()) errors.push(`${where}: a teaching convention says so in its note`)
    } else if (row.sources.length === 0) {
      errors.push(`${where}: a ${row.class} number names its source`)
    }
    for (const citation of row.sources) {
      if (!registeredSourceIds.has(citation.sourceId)) {
        errors.push(`${where}: source "${citation.sourceId}" is not in the module's registry`)
      }
      if (!Number.isInteger(citation.year) || citation.year < 1950 || citation.year > 2100) {
        errors.push(`${where}: source "${citation.sourceId}" has no publication year`)
      }
      if (citation.locator.trim().length === 0) {
        errors.push(`${where}: source "${citation.sourceId}" has no locator`)
      }
    }
  }
  return errors
}

/** The rows the owner has not signed yet. The weekly sign-off list. */
export function unsignedTeachingNumbers<Id extends string>(
  register: Pick<TeachingNumberRegister<Id>, 'rows'>,
): readonly TeachingNumber<Id>[] {
  return register.rows.filter((row) => row.signedBy === null)
}

/** One line a sources panel can print under a number: "ATS/ESICM/SCCM 2017, strong". */
export function teachingNumberCitationLine(
  row: TeachingNumberRow,
  sourceLabel: (sourceId: string) => string,
): string {
  return row.sources
    .map((citation) => {
      const grade = citation.grade ? `, ${citation.grade}` : ''
      return `${sourceLabel(citation.sourceId)} (${citation.year}${grade}; ${citation.locator})`
    })
    .join(' · ')
}
