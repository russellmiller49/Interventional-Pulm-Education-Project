import { stableSnapshotHash } from './stable-hash'

/**
 * What was actually printed, hashed.
 *
 * The audit that produced this module: `card_snapshot` was being described as the immutable record
 * of what a preference card said, and the printed page contains fields that are not in it. The
 * print route renders `GeneratedCardHeader` from the *row*, not the snapshot, and the header prints
 * a heading, a physician, a draft/final badge, and a last-updated timestamp — all four stored in
 * their own columns, all four editable by `renameUserCard` and by an ordinary save, and none of
 * them covered by any hash the card carried.
 *
 * That mattered in a specific and unglamorous way: `renameUserCard` deliberately does not touch the
 * snapshot, so the title on a printed card could change with nothing about the card's own integrity
 * moving, and the module still called the snapshot hash proof of what was printed.
 *
 * Rather than fold row metadata into the snapshot — which would make a rename re-resolve a card,
 * churn its identity, and lose the property that re-saving unchanged content is a no-op — the
 * document gets its own hash, over the snapshot's integrity hash plus every printed field beside it.
 * `card_snapshot` remains the record of what the *resolver* decided; this is the record of what the
 * *page* said.
 *
 * ## What is in, and what is presentation
 *
 * In: the card identity, the snapshot integrity hash, and every value the header prints from
 * outside the snapshot.
 *
 * Out, and deliberately: the print `mode` (spatial versus chronological groups the same items under
 * different headings and drops nothing), the locale (which selects label translations and date
 * formatting for the same underlying values), and the viewer's own clock. A hash that moved when a
 * colleague opened the same card in Spanish would not be telling anyone anything about the card.
 */

/** Bumped when the *meaning* of the projection below changes. Carried inside the hash. */
export const PRINT_DOCUMENT_HASH_VERSION = 'ip-cards-print-document/1'

/**
 * Everything printed on a preference card that lives outside `card_snapshot`.
 *
 * Every field is required and nullable rather than optional, so a caller that has no status — the
 * shared read-only view does not render one — has to say `null` instead of omitting the key and
 * silently producing a different document hash for the same document.
 */
export interface PrintedCardMetadata {
  cardId: string
  title: string
  physicianName: string | null
  status: 'draft' | 'final' | null
  updatedAt: string | null
}

/** The audited list, as data, so the test that keeps it honest reads the same one a reviewer does. */
export const PRINTED_FIELDS_OUTSIDE_SNAPSHOT: Readonly<Record<keyof PrintedCardMetadata, string>> =
  {
    cardId:
      'Identifies which stored card the page rendered. Printed indirectly, in the print link.',
    title:
      'The heading. The owner’s own name for the card, changed by rename without re-resolving.',
    physicianName: 'Printed in the metadata grid. Changed by rename without re-resolving.',
    status: 'The draft/final badge. Absent on the shared read-only view.',
    updatedAt: 'Printed in the metadata grid as "updated". A row timestamp, not a snapshot field.',
  }

/**
 * The canonical print-document hash.
 *
 * Takes the snapshot's integrity hash rather than the snapshot, so this covers the complete stored
 * snapshot transitively without re-hashing several hundred kilobytes on every render, and so a
 * tampered snapshot and a tampered title are both caught by one value.
 */
export function printDocumentHash(input: {
  snapshotIntegrityHash: string
  metadata: PrintedCardMetadata
}): string {
  return stableSnapshotHash({
    v: PRINT_DOCUMENT_HASH_VERSION,
    kind: 'print-document',
    payload: {
      snapshotIntegrityHash: input.snapshotIntegrityHash,
      cardId: input.metadata.cardId,
      title: input.metadata.title,
      physicianName: input.metadata.physicianName,
      status: input.metadata.status,
      updatedAt: input.metadata.updatedAt,
    },
  })
}
