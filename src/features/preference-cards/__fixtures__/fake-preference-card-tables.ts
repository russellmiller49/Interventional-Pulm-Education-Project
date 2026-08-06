/**
 * A stand-in for the two preference-card tables that behaves the way the real ones do.
 *
 * Two properties are emulated rather than stubbed, because stubbing either would make the tests
 * that depend on them worth nothing:
 *
 * - **Row-level security.** A statement simply does not see another user's rows. `user-cards.ts`
 *   and `card-revisions.ts` deliberately contain no ownership check of their own, so a test that
 *   mocked one would be testing the mock.
 * - **The revision trigger.** Every write to the cards table appends a revision, in the database,
 *   atomically. The rules below mirror `20260803052432_add_ip_preference_card_revisions.sql`
 *   clause for clause — including which columns count as a content change and which JSON fields
 *   are lifted out — so a test can assert on revision behaviour without a live Postgres.
 *
 * `writes` records every mutating statement, which is how "reconciliation writes nothing" is
 * checked as a fact about the code rather than as an intention in a comment.
 */

import { storedRebuildProvenanceSchema } from '../schemas/card-rebuild'

export interface FakeCardRow {
  id: string
  user_id: string
  title: string
  physician_name: string | null
  procedure_code: string
  scenario_id: string
  status: 'draft' | 'final'
  builder_inputs: unknown
  card_snapshot: unknown
  snapshot_hash: string
  engine_version: string
  catalog_import_id: string
  share_enabled: boolean
  share_token: string
  /**
   * Set once, when a rebuilt card is created, and never again — the write-once trigger from
   * `20260804013000_add_ip_preference_card_rebuild_provenance.sql`, modelled below.
   *
   * Deliberately absent from `REVISION_CONTENT_COLUMNS`: it can never change, so it can never be
   * the reason `updated_at` advances or a revision is appended.
   */
  rebuild_provenance: unknown
  created_at: string
  updated_at: string
}

export interface FakeRevisionRow {
  id: string
  card_id: string
  user_id: string
  revision_number: number
  title: string
  physician_name: string | null
  status: 'draft' | 'final'
  procedure_code: string
  scenario_id: string
  builder_inputs: unknown
  card_snapshot: unknown
  snapshot_hash: string
  snapshot_integrity_hash: string | null
  resolved_content_hash: string | null
  engine_version: string
  release_bundle_id: string | null
  catalog_release_id: string | null
  created_at: string
  created_by: string
}

export interface FakeWrite {
  table: string
  operation: 'insert' | 'update' | 'delete'
}

/**
 * The single definition of revision-bearing content, mirroring
 * `public.ip_preference_card_content_changed`.
 *
 * Two database triggers read it — the one that moves `updated_at` and the one that appends a
 * revision — and so do the two places below, for the same reason the migration has one function
 * rather than two column lists: a content change that moved the timestamp without writing a
 * revision, or the reverse, would be silent and wrong in both directions.
 */
const REVISION_CONTENT_COLUMNS = [
  'title',
  'physician_name',
  'status',
  'procedure_code',
  'scenario_id',
  'builder_inputs',
  'card_snapshot',
  'snapshot_hash',
  'engine_version',
  'catalog_import_id',
] as const

function contentChanged(before: FakeCardRow, after: FakeCardRow): boolean {
  return REVISION_CONTENT_COLUMNS.some(
    (column) => JSON.stringify(before[column]) !== JSON.stringify(after[column]),
  )
}

function jsonField(value: unknown, ...path: string[]): string | null {
  let current: unknown = value
  for (const key of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : null
}

export class FakePreferenceCardTables {
  cards: FakeCardRow[] = []
  revisions: FakeRevisionRow[] = []
  currentUserId: string | null = null
  writes: FakeWrite[] = []
  /**
   * Which database role the next table statement runs as.
   *
   * `20260804013000_add_ip_preference_card_rebuild_provenance.sql` makes provenance authenticity a
   * role question rather than a shape question: the `authenticated` insert policy forbids a non-null
   * `rebuild_provenance`, and a `before insert` trigger forbids it for every role except the one
   * dedicated writer — which is what stops `service_role`, whose `bypassrls` makes policies
   * irrelevant to it. Modelling the role here is the only way a test can tell those three cases
   * apart, and the earlier fake could not, which is why it accepted a forged insert.
   */
  role: 'authenticated' | 'service_role' | 'ip_preference_card_rebuild_writer' = 'authenticated'

  private nextCardSequence = 1
  private nextRevisionSequence = 1
  private clock = 0

  reset(userId: string | null): void {
    this.cards = []
    this.revisions = []
    this.writes = []
    this.currentUserId = userId
    this.role = 'authenticated'
    this.nextCardSequence = 1
    this.nextRevisionSequence = 1
    this.clock = 0
  }

  /** UUID-shaped, because card ids are validated as one before they reach the server. */
  cardId(sequence: number): string {
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`
  }

  private revisionId(sequence: number): string {
    return `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`
  }

  /**
   * A strictly advancing clock, which is the property the content version depends on.
   *
   * The database gets there with `greatest(clock_timestamp(), old.updated_at + 1 microsecond)`
   * rather than `now()`, because `now()` is transaction start time and two content changes in one
   * transaction would share a version — making the second indistinguishable from a stale replay
   * of the first. A counter models the guarantee that matters here: no two content versions of a
   * card are ever equal.
   */
  private now(): string {
    this.clock += 1
    return `2026-08-02T12:00:${String(this.clock).padStart(2, '0')}.000Z`
  }

  /**
   * The `after insert or update` trigger on the cards table.
   *
   * `previous` is null on an insert. On an update, an unchanged content column set means no
   * revision — toggling sharing bumps `updated_at` and changes nothing this table records.
   */
  private appendRevision(row: FakeCardRow, previous: FakeCardRow | null): void {
    if (previous && !contentChanged(previous, row)) return

    const nextNumber =
      this.revisions
        .filter((revision) => revision.card_id === row.id)
        .reduce((highest, revision) => Math.max(highest, revision.revision_number), 0) + 1

    this.revisions.push({
      id: this.revisionId(this.nextRevisionSequence++),
      card_id: row.id,
      user_id: row.user_id,
      revision_number: nextNumber,
      title: row.title,
      physician_name: row.physician_name,
      status: row.status,
      procedure_code: row.procedure_code,
      scenario_id: row.scenario_id,
      builder_inputs: row.builder_inputs,
      card_snapshot: row.card_snapshot,
      snapshot_hash: row.snapshot_hash,
      snapshot_integrity_hash: jsonField(row.card_snapshot, 'snapshotIntegrityHash'),
      resolved_content_hash: jsonField(row.card_snapshot, 'resolvedContentHash'),
      engine_version: row.engine_version,
      release_bundle_id: jsonField(row.builder_inputs, 'releaseBundleId'),
      catalog_release_id: jsonField(row.card_snapshot, 'resolutionProvenance', 'catalogReleaseId'),
      created_at: row.updated_at,
      created_by: this.currentUserId ?? row.user_id,
    })
  }

  private visibleCards(): FakeCardRow[] {
    return this.cards.filter((row) => row.user_id === this.currentUserId)
  }

  private visibleRevisions(): FakeRevisionRow[] {
    return this.revisions.filter((row) => row.user_id === this.currentUserId)
  }

  /** A chainable stand-in for the postgrest builder, scoped to the signed-in user. */
  private table = (name: string) => {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Record<string, unknown> = {}
    const filters: Array<[string, unknown]> = []
    let orderColumn: string | null = null
    let orderAscending = true
    /** The requested column list, or null for "everything" when `select()` was called bare. */
    let projection: string[] | null = null

    const project = (row: object): Record<string, unknown> => {
      if (!projection) return row as Record<string, unknown>
      const source = row as Record<string, unknown>
      return Object.fromEntries(projection.map((column) => [column, source[column]]))
    }

    const matches = (row: Record<string, unknown>) =>
      filters.every(([column, value]) => row[column] === value)

    const visible = (): Record<string, unknown>[] =>
      name === 'ip_user_preference_cards'
        ? (this.visibleCards() as unknown as Record<string, unknown>[])
        : (this.visibleRevisions() as unknown as Record<string, unknown>[])

    const collection = (): Record<string, unknown>[] => {
      const rows = visible().filter(matches)
      if (!orderColumn) return rows
      const column = orderColumn
      return [...rows].sort((left, right) => {
        const a = left[column]
        const b = right[column]
        const compared =
          typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b))
        return orderAscending ? compared : -compared
      })
    }

    const builder = {
      select: (columns?: string) => {
        // PostgREST returns the columns it was asked for and no others. Honouring that matters
        // beyond tidiness: `duplicateUserCard` copies a card by selecting a named column list and
        // re-inserting the result, so a fake that returned whole rows would copy columns the real
        // query never sees — and would have quietly duplicated a rebuilt card's provenance onto a
        // copy that was never rebuilt.
        projection = columns ? columns.split(',').map((column) => column.trim()) : null
        return builder
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        orderColumn = column
        orderAscending = options?.ascending ?? true
        return builder
      },
      limit: (count: number) => {
        return Promise.resolve({ data: collection().slice(0, count).map(project), error: null })
      },
      insert: (next: Record<string, unknown>) => {
        operation = 'insert'
        payload = next
        return builder
      },
      update: (next: Record<string, unknown>) => {
        operation = 'update'
        payload = next
        return builder
      },
      delete: () => {
        operation = 'delete'
        return builder
      },
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        if (operation === 'delete') {
          this.writes.push({ table: name, operation: 'delete' })
          const doomed = this.cards.filter(
            (row) =>
              row.user_id === this.currentUserId &&
              matches(row as unknown as Record<string, unknown>),
          )
          this.cards = this.cards.filter((row) => !doomed.includes(row))
          // The foreign key cascades. Revisions never outlive the card they describe.
          const doomedIds = new Set(doomed.map((row) => row.id))
          this.revisions = this.revisions.filter((row) => !doomedIds.has(row.card_id))
          return Promise.resolve({ data: null, error: null })
        }
        return builder
      },
      maybeSingle: () => {
        if (operation === 'insert') {
          this.writes.push({ table: name, operation: 'insert' })
          if (name !== 'ip_user_preference_cards') {
            throw new Error(`Nothing may insert into ${name} directly; the trigger appends there.`)
          }
          // `ip_user_preference_cards_insert_own` (RLS, `authenticated`) and
          // `private.ip_reject_untrusted_preference_card_rebuild_provenance` (trigger, every role).
          if (
            payload.rebuild_provenance !== undefined &&
            payload.rebuild_provenance !== null &&
            this.role !== 'ip_preference_card_rebuild_writer'
          ) {
            throw new Error(
              'rebuild_provenance may only be written by public.ip_create_rebuilt_preference_card',
            )
          }
          const created = this.now()
          // Column defaults last, exactly as the table applies them: the insert payload has
          // no business naming an id, a share token, or a timestamp, and does not.
          const row: FakeCardRow = {
            ...(payload as unknown as FakeCardRow),
            id: this.cardId(this.nextCardSequence++),
            share_enabled: (payload.share_enabled as boolean | undefined) ?? false,
            share_token: `token-${this.nextCardSequence}`,
            rebuild_provenance: payload.rebuild_provenance ?? null,
            created_at: created,
            updated_at: created,
          }
          this.cards.push(row)
          this.appendRevision(row, null)
          return Promise.resolve({ data: project(row), error: null })
        }

        if (operation === 'update') {
          this.writes.push({ table: name, operation: 'update' })
          const index = this.cards.findIndex(
            (row) =>
              row.user_id === this.currentUserId &&
              matches(row as unknown as Record<string, unknown>),
          )
          if (index < 0) return Promise.resolve({ data: null, error: null })
          const previous = this.cards[index]
          // `private.ip_reject_preference_card_rebuild_provenance_rewrite`. Modelled rather than
          // stubbed, because "a rebuilt card's provenance cannot be edited afterwards" is a claim
          // the suite makes and a test against a stub would be testing the stub.
          if (
            Object.prototype.hasOwnProperty.call(payload, 'rebuild_provenance') &&
            JSON.stringify(payload.rebuild_provenance ?? null) !==
              JSON.stringify(previous.rebuild_provenance ?? null)
          ) {
            throw new Error(
              'ip_user_preference_cards.rebuild_provenance is write-once and cannot be changed after the card is created',
            )
          }
          // `ip_set_preference_card_content_updated_at`: the timestamp is a content version, so a
          // share-only update leaves it exactly where it was. That is what keeps a share toggle
          // from invalidating an open edit session, and it is modelled here rather than assumed
          // because the concurrency tests turn on it.
          const patched = { ...previous, ...payload } as FakeCardRow
          const updated = {
            ...patched,
            updated_at: contentChanged(previous, patched) ? this.now() : previous.updated_at,
          } as FakeCardRow
          this.cards[index] = updated
          this.appendRevision(updated, previous)
          return Promise.resolve({ data: project(updated), error: null })
        }

        const first = collection()[0]
        return Promise.resolve({ data: first ? project(first) : null, error: null })
      },
    }
    return builder
  }

  /**
   * `public.ip_create_rebuilt_preference_card`, modelled.
   *
   * The load-bearing part is the recheck: the migration performs it *in the same statement* as the
   * insert, so a source deleted between review and submission produces no card rather than a row
   * citing a revision that is gone. Here the same predicate runs immediately before the insert and
   * the write is refused when it does not match.
   */
  createRebuiltCard(write: {
    ownerId: string
    sourceCardId: string
    sourceRevisionId: string
    sourceSnapshotHash: string
    sourceReleaseBundleId: string | null
    /** Bound to the revision row, not merely to the arguments — see the migration. */
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
  }):
    | {
        ok: true
        cardId: string
      }
    | { ok: false; code: 'source_moved' | 'provenance_mismatch' | 'provenance_malformed' } {
    // The document has to describe the source the arguments are checked against, and it has to be
    // the *complete* version-1 shape — the same one `storedRebuildProvenanceSchema` reads back and
    // the SQL validator enforces. `provenance-contract.test.ts` proves those three descriptions
    // agree, which is what makes checking the schema here a faithful model of the database rather
    // than a second opinion about it.
    const parsed = storedRebuildProvenanceSchema.safeParse(write.rebuildProvenance)
    if (!parsed.success) return { ok: false, code: 'provenance_malformed' }
    const document = parsed.data

    const claims: Array<[unknown, unknown]> = [
      [document.sourceCardId, write.sourceCardId],
      [document.sourceRevisionId, write.sourceRevisionId],
      [document.sourceOwnerId, write.ownerId],
      [document.sourceSnapshotHash, write.sourceSnapshotHash],
      [document.sourceReleaseBundleId, write.sourceReleaseBundleId],
    ]
    if (claims.some(([claimed, argument]) => (claimed ?? null) !== (argument ?? null))) {
      return { ok: false, code: 'provenance_mismatch' }
    }

    const revision = this.revisions.find(
      (row) =>
        row.id === write.sourceRevisionId &&
        row.card_id === write.sourceCardId &&
        row.user_id === write.ownerId &&
        // The document's own owner claim, bound to both source rows.
        row.user_id === document.sourceOwnerId &&
        row.snapshot_hash === write.sourceSnapshotHash &&
        (row.release_bundle_id ?? null) === (write.sourceReleaseBundleId ?? null) &&
        // The remaining columns the revision knows, bound to the stored document.
        row.revision_number === document.sourceRevisionNumber &&
        (row.snapshot_integrity_hash ?? null) === document.sourceSnapshotIntegrityHash &&
        (row.resolved_content_hash ?? null) === document.sourceResolvedContentHash,
    )
    const source = revision
      ? this.cards.find(
          (row) =>
            row.id === revision.card_id &&
            row.user_id === revision.user_id &&
            row.user_id === document.sourceOwnerId,
        )
      : undefined
    if (!revision || !source) return { ok: false, code: 'source_moved' }

    const previousRole = this.role
    this.role = 'ip_preference_card_rebuild_writer'
    try {
      this.writes.push({ table: 'ip_user_preference_cards', operation: 'insert' })
      const created = this.now()
      const row: FakeCardRow = {
        id: this.cardId(this.nextCardSequence++),
        user_id: write.ownerId,
        title: write.title,
        physician_name: write.physicianName,
        procedure_code: write.procedureCode,
        scenario_id: write.scenarioId,
        status: 'draft',
        builder_inputs: write.builderInputs,
        card_snapshot: write.cardSnapshot,
        snapshot_hash: write.snapshotHash,
        engine_version: write.engineVersion,
        catalog_import_id: write.catalogImportId,
        share_enabled: false,
        share_token: `token-${this.nextCardSequence}`,
        rebuild_provenance: write.rebuildProvenance,
        created_at: created,
        updated_at: created,
      }
      this.cards.push(row)
      this.appendRevision(row, null)
      return { ok: true, cardId: row.id }
    } finally {
      this.role = previousRole
    }
  }

  /** The object `supabaseServer()` resolves to in these tests. */
  client() {
    return {
      auth: {
        getUser: async () => ({
          data: { user: this.currentUserId ? { id: this.currentUserId } : null },
        }),
      },
      from: (name: string) => this.table(name),
      rpc: async () => ({ data: [], error: null }),
    }
  }
}
