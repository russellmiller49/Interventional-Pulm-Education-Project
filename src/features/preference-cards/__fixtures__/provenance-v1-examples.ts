import {
  REBUILD_PROVENANCE_V1_DECISION_KEYS,
  REBUILD_PROVENANCE_V1_KEYS,
  REBUILD_PROVENANCE_V1_NULLABLE_KEYS,
} from '../schemas/card-rebuild'

/**
 * One table of version-1 provenance documents, and what each of them is.
 *
 * The runtime schema and the SQL validator are two implementations of one contract, and the way
 * they drifted apart was that each had its own idea of what a bad document looks like: Zod's tests
 * omitted all twenty keys, the SQL matrix omitted seven, and nobody compared the two lists. So the
 * examples live here, once, and both sides are driven from them — `provenance-contract.test.ts`
 * parses every one through Zod and checks the SQL validator carries a rule for each category, and
 * the verification script's own loops walk the same key lists.
 *
 * Every invalid example is invalid for exactly *one* stated reason. A fixture that is wrong in two
 * ways proves only that something rejected it.
 */

export type ProvenanceExampleCategory =
  | 'valid'
  | 'unknown_top_level_key'
  | 'omitted_top_level_key'
  | 'wrong_typed_top_level_key'
  | 'null_on_non_nullable_key'
  | 'explicit_nullable_null'
  | 'padded_or_overlong_text'
  | 'malformed_uuid'
  | 'malformed_hash'
  | 'malformed_revision_number'
  | 'malformed_timestamp'
  | 'unknown_nested_key'
  | 'omitted_nested_key'
  | 'wrong_typed_nested_key'
  | 'malformed_nested_text'
  | 'malformed_reason_code'
  | 'oversized_collection'

export interface ProvenanceExample {
  label: string
  category: ProvenanceExampleCategory
  valid: boolean
  document: unknown
}

const OWNER = '00000000-0000-4000-a000-000000000001'
const CARD = '00000000-0000-4000-8000-000000000001'
const REVISION = '00000000-0000-4000-9000-000000000001'

/** The canonical positive document. Every example below is this, changed in exactly one place. */
export function validProvenanceV1Document(): Record<string, unknown> {
  return {
    version: 'ip-cards-rebuild/1',
    sourceCardId: CARD,
    sourceRevisionId: REVISION,
    sourceOwnerId: OWNER,
    sourceRevisionNumber: 1,
    sourceReleaseBundleId: 'release-fixture-procedure-v1-0',
    sourceReleaseDefinitionHash: 'e'.repeat(64),
    sourceSnapshotHash: 'a'.repeat(64),
    sourceSnapshotIntegrityHash: 'b'.repeat(64),
    sourceResolvedContentHash: 'c'.repeat(64),
    sourcePrintDocumentHash: 'd'.repeat(64),
    targetReleaseBundleId: 'release-fixture-procedure-v1-1',
    targetReleaseDefinitionHash: 'f'.repeat(64),
    targetCatalogReleaseId: 'fixture-catalog-import-0001',
    operationalReconciliationHash: '2'.repeat(64),
    authoredReleaseDiffHash: '3'.repeat(64),
    mappingPlanHash: '1'.repeat(64),
    allowedFinalStateHash: '4'.repeat(64),
    decisions: [
      {
        key: 'requirement:FIXTURE_BACKUP_SCOPE',
        kind: 'requirement',
        state: 'carried_requires_review',
        reasonCodes: ['requirement_definition_changed'],
        acknowledgement: 'confirmed',
      },
    ],
    createdAt: '2026-02-01T00:00:00.000Z',
  }
}

function withDocument(patch: (document: Record<string, unknown>) => void): unknown {
  const document = validProvenanceV1Document()
  patch(document)
  return document
}

function withDecision(patch: (decision: Record<string, unknown>) => void): unknown {
  return withDocument((document) => {
    const decision = { ...(document.decisions as Record<string, unknown>[])[0] }
    patch(decision)
    document.decisions = [decision]
  })
}

/**
 * A value of the wrong JSON type for every field version 1 defines.
 *
 * `true` is wrong for a string, a number, and an array alike, so one substitution covers the whole
 * key list without a per-key table that could drift from it.
 */
const WRONG_TYPE = true

export const PROVENANCE_V1_EXAMPLES: ProvenanceExample[] = [
  {
    label: 'the canonical version-1 document',
    category: 'valid',
    valid: true,
    document: validProvenanceV1Document(),
  },
  {
    label: 'a key version 1 does not define',
    category: 'unknown_top_level_key',
    valid: false,
    document: withDocument((document) => {
      document.invented = true
    }),
  },
  ...REBUILD_PROVENANCE_V1_KEYS.map((key) => ({
    label: `no ${key}`,
    category: 'omitted_top_level_key' as const,
    valid: false,
    document: withDocument((document) => {
      delete document[key]
    }),
  })),
  ...REBUILD_PROVENANCE_V1_KEYS.map((key) => ({
    label: `a boolean ${key}`,
    category: 'wrong_typed_top_level_key' as const,
    valid: false,
    document: withDocument((document) => {
      document[key] = WRONG_TYPE
    }),
  })),
  ...REBUILD_PROVENANCE_V1_KEYS.filter(
    (key) => !(REBUILD_PROVENANCE_V1_NULLABLE_KEYS as readonly string[]).includes(key),
  ).map((key) => ({
    label: `a null ${key}, which version 1 does not allow`,
    category: 'null_on_non_nullable_key' as const,
    valid: false,
    document: withDocument((document) => {
      document[key] = null
    }),
  })),
  ...REBUILD_PROVENANCE_V1_NULLABLE_KEYS.map((key) => ({
    label: `an explicit null ${key}`,
    category: 'explicit_nullable_null' as const,
    valid: true,
    document: withDocument((document) => {
      document[key] = null
    }),
  })),
  // Every one of these was a real divergence, not a hypothetical: PostgreSQL's `btrim` strips
  // spaces where ECMAScript `trim()` strips a much larger set, and `length(text)` counts characters
  // where JavaScript counts UTF-16 code units. Version 1 fixes the alphabet to printable ASCII so
  // both pairs of operations agree, and these are the cases that prove it.
  ...(
    [
      ['space', ' fixture-catalog-import-0001 '],
      ['a tab', '\tfixture-catalog-import-0001\t'],
      ['a newline', '\nfixture-catalog-import-0001\n'],
      ['a carriage return', '\rfixture-catalog-import-0001\r'],
      ['a nonbreaking space', '\u00a0fixture-catalog-import-0001\u00a0'],
      ['a form feed', '\ffixture-catalog-import-0001'],
    ] as const
  ).map(([what, value]) => ({
    label: `a text field padded with ${what}`,
    category: 'padded_or_overlong_text' as const,
    valid: false,
    document: withDocument((document) => {
      document.targetCatalogReleaseId = value
    }),
  })),
  {
    label: 'a text field carrying a control character',
    category: 'padded_or_overlong_text',
    valid: false,
    document: withDocument((document) => {
      document.targetCatalogReleaseId = 'fixture\u0007catalog'
    }),
  },
  {
    label: 'a text field of astral characters inside the character bound',
    category: 'padded_or_overlong_text',
    valid: false,
    document: withDocument((document) => {
      // 61 characters and 122 UTF-16 code units: it fitted a 120-character SQL bound and failed a
      // 120-unit Zod bound, which is exactly the pair of bounds version 1 refuses to have.
      document.targetCatalogReleaseId = '\u{1f600}'.repeat(61)
    }),
  },
  {
    label: 'a text field carrying one non-ASCII letter',
    category: 'padded_or_overlong_text',
    valid: false,
    document: withDocument((document) => {
      document.targetCatalogReleaseId = 'fixture-catalogué'
    }),
  },
  {
    label: 'a text field that is only whitespace',
    category: 'padded_or_overlong_text',
    valid: false,
    document: withDocument((document) => {
      document.targetCatalogReleaseId = '   '
    }),
  },
  {
    label: 'a text field longer than the bound',
    category: 'padded_or_overlong_text',
    valid: false,
    document: withDocument((document) => {
      document.targetCatalogReleaseId = 'x'.repeat(121)
    }),
  },
  {
    label: 'a uuid with an out-of-range version nibble',
    category: 'malformed_uuid',
    valid: false,
    document: withDocument((document) => {
      document.sourceOwnerId = '00000000-0000-9999-a000-000000000001'
    }),
  },
  {
    label: 'a hash that is not sixty-four hex characters',
    category: 'malformed_hash',
    valid: false,
    document: withDocument((document) => {
      document.allowedFinalStateHash = 'not-a-digest'
    }),
  },
  {
    // `sha256Schema` used to `.trim()`, so it accepted a padded digest and normalised it while SQL
    // refused the same value outright. Stricter on one side is still not parity.
    label: 'a padded sha-256 digest',
    category: 'malformed_hash',
    valid: false,
    document: withDocument((document) => {
      document.allowedFinalStateHash = ` ${'4'.repeat(64)} `
    }),
  },
  {
    label: 'an uppercase sha-256 digest',
    category: 'malformed_hash',
    valid: false,
    document: withDocument((document) => {
      document.allowedFinalStateHash = '4'.repeat(64).toUpperCase().replace(/4/g, 'A')
    }),
  },
  {
    label: 'a revision number below one',
    category: 'malformed_revision_number',
    valid: false,
    document: withDocument((document) => {
      document.sourceRevisionNumber = 0
    }),
  },
  {
    label: 'a revision number past the safe integer range',
    category: 'malformed_revision_number',
    valid: false,
    document: withDocument((document) => {
      document.sourceRevisionNumber = 9007199254740992
    }),
  },
  // `Date.parse` does not reject an impossible calendar date — it *rolls it over*. Both February
  // dates below parsed successfully and became March, and were accepted as provenance. A timestamp
  // that silently becomes a different day is not a record of when anything happened.
  ...(
    [
      ['an impossible month', '2026-99-99T00:00:00.000Z'],
      ['February 29 in a non-leap year', '2026-02-29T00:00:00.000Z'],
      ['February 30', '2026-02-30T00:00:00.000Z'],
      ['April 31', '2026-04-31T00:00:00.000Z'],
      ['no offset', '2026-02-01T00:00:00.000'],
      ['a numeric offset instead of UTC', '2026-02-01T01:00:00.000+01:00'],
      ['second precision', '2026-02-01T00:00:00Z'],
      ['microsecond precision', '2026-02-01T00:00:00.000000Z'],
      ['a lowercase separator', '2026-02-01t00:00:00.000z'],
      ['a space separator', '2026-02-01 00:00:00.000Z'],
    ] as const
  ).map(([what, value]) => ({
    label: `a createdAt with ${what}`,
    category: 'malformed_timestamp' as const,
    valid: false,
    document: withDocument((document) => {
      document.createdAt = value
    }),
  })),
  {
    label: 'a createdAt naming a real leap day in canonical form',
    category: 'valid',
    valid: true,
    document: withDocument((document) => {
      document.createdAt = '2028-02-29T00:00:00.000Z'
    }),
  },
  {
    label: 'a decision key version 1 does not define',
    category: 'unknown_nested_key',
    valid: false,
    document: withDecision((decision) => {
      decision.invented = true
    }),
  },
  {
    label: 'a decision that swaps a required key for an invented one',
    category: 'unknown_nested_key',
    valid: false,
    document: withDecision((decision) => {
      delete decision.acknowledgement
      decision.invented = true
    }),
  },
  ...REBUILD_PROVENANCE_V1_DECISION_KEYS.map((key) => ({
    label: `a decision with no ${key}`,
    category: 'omitted_nested_key' as const,
    valid: false,
    document: withDecision((decision) => {
      delete decision[key]
    }),
  })),
  {
    label: 'a decision with an empty acknowledgement',
    category: 'malformed_nested_text',
    valid: false,
    document: withDecision((decision) => {
      decision.acknowledgement = ''
    }),
  },
  {
    label: 'a decision with a padded key',
    category: 'malformed_nested_text',
    valid: false,
    document: withDecision((decision) => {
      decision.key = ' requirement:X '
    }),
  },
  {
    label: 'a decision with an overlong state',
    category: 'malformed_nested_text',
    valid: false,
    document: withDecision((decision) => {
      decision.state = 's'.repeat(61)
    }),
  },
  {
    label: 'a decision with a tab-padded kind',
    category: 'malformed_nested_text',
    valid: false,
    document: withDecision((decision) => {
      decision.kind = '\trequirement\t'
    }),
  },
  ...REBUILD_PROVENANCE_V1_DECISION_KEYS.map((key) => ({
    label: `a decision whose ${key} is a boolean`,
    category: 'wrong_typed_nested_key' as const,
    valid: false,
    document: withDecision((decision) => {
      decision[key] = true
    }),
  })),
  {
    label: 'a decision whose acknowledgement is explicitly null',
    category: 'valid',
    valid: true,
    document: withDecision((decision) => {
      decision.acknowledgement = null
    }),
  },
  {
    label: 'a reason code that is empty',
    category: 'malformed_reason_code',
    valid: false,
    document: withDecision((decision) => {
      decision.reasonCodes = ['']
    }),
  },
  {
    label: 'a reason code that is overlong',
    category: 'malformed_reason_code',
    valid: false,
    document: withDecision((decision) => {
      decision.reasonCodes = ['r'.repeat(81)]
    }),
  },
  {
    label: 'a reason code that is not a string',
    category: 'malformed_reason_code',
    valid: false,
    document: withDecision((decision) => {
      decision.reasonCodes = [7]
    }),
  },
  {
    label: 'more than forty reason codes',
    category: 'oversized_collection',
    valid: false,
    document: withDecision((decision) => {
      decision.reasonCodes = Array.from({ length: 41 }, (_, index) => `reason_${index}`)
    }),
  },
  {
    label: 'more than a thousand decisions',
    category: 'oversized_collection',
    valid: false,
    document: withDocument((document) => {
      const one = (document.decisions as Record<string, unknown>[])[0]
      document.decisions = Array.from({ length: 1001 }, (_, index) => ({
        ...one,
        key: `requirement:R${index}`,
      }))
    }),
  },
]
