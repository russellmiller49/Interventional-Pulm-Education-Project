import {
  AIRWAY_LABELS,
  SEGMENTAL_AIRWAY_LABELS,
  type AirwayInspectionRecord,
  type AirwayLabel,
  type DeclarableStatus,
  type InspectionLedger,
  type InspectionStatus,
  type ScopeEventId,
  type ScopeViewSpec,
} from '../../components/scope/types'

/**
 * The inspection record the survey drills keep (knowledge spec §11; drills D08 and D14).
 *
 * One row per airway the step expects. Three flags are heuristics from the tip's position and
 * view: the airway's opening came into the optical field, the tip crossed into it, and the tip
 * went far enough inside to see beyond its opening. Two are the learner's declarations:
 * identified and inspected. A declaration whose precondition does not hold is refused — or, for
 * "inspected", recorded as unsupported and kept visible — never silently upgraded. Entering an
 * airway never sets "inspected" (A07/A30), and nothing here measures a mucosal examination; the
 * pane prints the ledger caveat wherever the record shows.
 */

type MutableLedger = Partial<Record<AirwayLabel, AirwayInspectionRecord>>

function isRecord(record: AirwayInspectionRecord | undefined): record is AirwayInspectionRecord {
  return record !== undefined
}

export function inspectionRecords(ledger: InspectionLedger): readonly AirwayInspectionRecord[] {
  return Object.values(ledger).filter(isRecord)
}

/** The airways a view's record lists, in survey order. */
export function expectedLedgerAirways(view: Pick<ScopeViewSpec, 'ledger'>): readonly AirwayLabel[] {
  const expected = view.ledger?.expected
  if (!expected) return []
  if (expected === 'segmental') return SEGMENTAL_AIRWAY_LABELS
  if (expected === 'profile') return AIRWAY_LABELS
  return expected
}

export function emptyInspectionRecord(label: AirwayLabel): AirwayInspectionRecord {
  return {
    label,
    identified: false,
    ostiumVisualized: false,
    entered: false,
    distalViewObtained: false,
    inspected: 'no',
    limitation: null,
  }
}

export function createInspectionLedger(view: Pick<ScopeViewSpec, 'ledger'>): InspectionLedger {
  const ledger: MutableLedger = {}
  for (const label of expectedLedgerAirways(view)) ledger[label] = emptyInspectionRecord(label)
  return ledger
}

/** The one status a row shows: its furthest state, with a recorded inaccessibility first. */
export function ledgerStatus(record: AirwayInspectionRecord): InspectionStatus {
  if (record.limitation === 'not-safely-accessible') return 'not-safely-accessible'
  if (record.inspected === 'declared') return 'inspected'
  if (record.entered) return 'entered'
  if (record.ostiumVisualized) return 'ostium-visualized'
  if (record.identified) return 'identified'
  return 'not-observed'
}

/**
 * Whether a row has reached a status. Cumulative, so a later state never un-meets an earlier
 * one: an airway entered has also had its opening reached. "Not observed" alone is exact.
 */
export function ledgerHas(
  record: AirwayInspectionRecord | undefined,
  status: InspectionStatus,
): boolean {
  if (!record) return false
  switch (status) {
    case 'not-observed':
      return ledgerStatus(record) === 'not-observed'
    case 'identified':
      return record.identified
    case 'ostium-visualized':
      return record.ostiumVisualized || record.entered
    case 'entered':
      return record.entered
    case 'inspected':
      return record.inspected === 'declared'
    case 'not-safely-accessible':
      return record.limitation === 'not-safely-accessible'
  }
}

/** Examined, or a limitation recorded: the row needs nothing more for the record to be complete. */
export function inspectionRecordIsFinal(record: AirwayInspectionRecord): boolean {
  return (
    record.inspected === 'declared' ||
    record.limitation === 'not-safely-accessible' ||
    record.limitation === 'not-observed'
  )
}

/** Every row examined or its limitation recorded (review register R06's adopted treatment). */
export function inspectionLedgerIsFinal(ledger: InspectionLedger): boolean {
  const rows = inspectionRecords(ledger)
  return rows.length > 0 && rows.every(inspectionRecordIsFinal)
}

export interface InspectionLedgerSummary {
  readonly total: number
  readonly inspected: number
  readonly notSafelyAccessible: number
  readonly notObserved: number
  /** Rows with no final status yet. */
  readonly open: number
}

export function inspectionLedgerSummary(ledger: InspectionLedger): InspectionLedgerSummary {
  const rows = inspectionRecords(ledger)
  const inspected = rows.filter((row) => row.inspected === 'declared').length
  const notSafelyAccessible = rows.filter(
    (row) => row.limitation === 'not-safely-accessible',
  ).length
  const notObserved = rows.filter(
    (row) => row.limitation === 'not-observed' && row.inspected !== 'declared',
  ).length
  return {
    total: rows.length,
    inspected,
    notSafelyAccessible,
    notObserved,
    open: rows.filter((row) => !inspectionRecordIsFinal(row)).length,
  }
}

/** What the tip's position and view established on this command. */
export interface LedgerFacts {
  /** Airways whose opening is in the optical field now. */
  readonly visible: ReadonlySet<AirwayLabel>
  /** The current airway and its ancestors: the tip has crossed into each of them. */
  readonly entered: readonly AirwayLabel[]
  /** Airways the tip has gone far enough inside to see beyond the opening. */
  readonly distalView: ReadonlySet<AirwayLabel>
}

/** Fold the heuristics in. Returns the same object when nothing changed. */
export function advanceInspectionLedger(
  ledger: InspectionLedger,
  facts: LedgerFacts,
): InspectionLedger {
  let changed = false
  const next: MutableLedger = { ...ledger }
  for (const record of inspectionRecords(ledger)) {
    const label = record.label
    const ostiumVisualized = record.ostiumVisualized || facts.visible.has(label)
    const entered = record.entered || facts.entered.includes(label)
    const distalViewObtained = record.distalViewObtained || (entered && facts.distalView.has(label))
    // A "not observed" declaration is superseded once the airway is actually seen.
    const limitation =
      record.limitation === 'not-observed' && (ostiumVisualized || entered)
        ? null
        : record.limitation
    if (
      ostiumVisualized !== record.ostiumVisualized ||
      entered !== record.entered ||
      distalViewObtained !== record.distalViewObtained ||
      limitation !== record.limitation
    ) {
      changed = true
      next[label] = { ...record, ostiumVisualized, entered, distalViewObtained, limitation }
    }
  }
  return changed ? next : ledger
}

/** Learner-facing words for a declaration the record refuses or keeps as unsupported. */
export const DECLARATION_MESSAGES = {
  notOnRecord: 'That airway is not on the inspection record for this step.',
  identifyUnseen: 'Bring its opening into view before naming it in the inspection record.',
  inspectedWithoutView:
    'Recorded as inspected without a view beyond its opening. The inspection record keeps it that way, and it does not count as an inspection.',
  inaccessibleUnseen:
    'Bring its opening into view before recording that it could not be entered safely.',
  inaccessibleEntered:
    'The scope has already been inside this airway; record what was seen there instead.',
  notObservedSeen: 'The inspection record already shows this airway was seen.',
} as const

/** Whether the pane should offer a declaration as supported for this row now. */
export function declarationAllowed(
  record: AirwayInspectionRecord,
  status: DeclarableStatus,
): boolean {
  switch (status) {
    case 'identified':
      return record.ostiumVisualized || record.entered
    case 'inspected':
      return record.entered && record.distalViewObtained
    case 'not-safely-accessible':
      return record.ostiumVisualized && !record.entered
    case 'not-observed':
      return !record.ostiumVisualized && !record.entered
  }
}

export type DeclarationResult =
  | {
      readonly kind: 'recorded'
      readonly ledger: InspectionLedger
      readonly event: ScopeEventId
      /** Set when the declaration was kept without its precondition. */
      readonly message: string | null
    }
  | { readonly kind: 'refused'; readonly message: string }

/**
 * Record a declaration. The event fires for every declaration the record accepts, supported or
 * not, because it is what the learner did; whether it counts is the row's status (a goal that
 * needs a real inspection tests the ledger, not the event).
 */
export function declareInspection(
  ledger: InspectionLedger,
  airway: AirwayLabel,
  status: DeclarableStatus,
): DeclarationResult {
  const record = ledger[airway]
  if (!record) return { kind: 'refused', message: DECLARATION_MESSAGES.notOnRecord }
  const event = `declared:${airway}:${status}` as ScopeEventId
  const recorded = (next: AirwayInspectionRecord, message: string | null = null) =>
    ({
      kind: 'recorded',
      ledger: { ...ledger, [airway]: next },
      event,
      message,
    }) as const
  switch (status) {
    case 'identified':
      if (!declarationAllowed(record, status))
        return { kind: 'refused', message: DECLARATION_MESSAGES.identifyUnseen }
      return recorded({ ...record, identified: true })
    case 'inspected':
      if (!declarationAllowed(record, status))
        return recorded(
          {
            ...record,
            inspected: record.inspected === 'declared' ? 'declared' : 'declared-without-view',
          },
          DECLARATION_MESSAGES.inspectedWithoutView,
        )
      return recorded({ ...record, inspected: 'declared' })
    case 'not-safely-accessible':
      if (record.entered)
        return { kind: 'refused', message: DECLARATION_MESSAGES.inaccessibleEntered }
      if (!record.ostiumVisualized)
        return { kind: 'refused', message: DECLARATION_MESSAGES.inaccessibleUnseen }
      return recorded({ ...record, limitation: 'not-safely-accessible' })
    case 'not-observed':
      if (!declarationAllowed(record, status))
        return { kind: 'refused', message: DECLARATION_MESSAGES.notObservedSeen }
      return recorded({ ...record, limitation: 'not-observed' })
  }
}
