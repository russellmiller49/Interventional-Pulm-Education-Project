/**
 * Strict parsing and screening for Literature target evidence.
 *
 * Review findings shaped every layer of this module.
 *
 * **H-2** — the first parser was strict only at the outer levels: a relation row `{name: 5}`
 * survived into business logic as a `TypeError`, a nested `projectRef` or differently cased
 * `HostName` rode along inside a row, and a literal newline inside a JSON string was accepted.
 * Every row of every catalog section now has its own `.strict()` runtime schema with exact field
 * types, and the JSON parser rejects unescaped control characters (U+0000–U+001F) inside strings.
 * Every failure is a controlled `LiteratureEvidenceError`; nothing downstream can see a raw
 * `TypeError`.
 *
 * **M-2** — secret screening previously covered decoded *keys* but accepted decoded string
 * *values* such as `"password"` or `"Authorization"`. Screening now runs post-decode over both
 * keys and values, case-insensitively, against the full prohibited vocabulary, with a small closed
 * allowance list for the legitimate catalog tokens (the literal role name `service_role` in role
 * positions, PostgreSQL ACL grammar entries, and this contract's own `serviceRoleExecute` field).
 * Rejected content is never echoed into an error message.
 *
 * **L-1** — evidence is phase-specific. The preflight document carries existence-safe facts only
 * and has **no** `totalRowCount`; the postflight document carries the existence probe, migration
 * versions, the complete catalog, and the row count. Each binds the identity of the query plan
 * that produced it, so the plans cannot be substituted for one another.
 *
 * The evidence bodies deliberately have **no** `projectRef` or `hostname` field. Target identity
 * can only ever come from a provider-bound adapter (Layer 3, not implemented in this PR); a
 * document that tries to declare its own project is rejected as carrying an unknown field. That is
 * the structural half of the B-1 fix — relabelling is not merely detected, it is unrepresentable.
 */

import { z } from 'zod'

import { LITERATURE_CATALOG_SECTIONS } from './foundation-catalog'
import type { LiteratureCatalogSection } from './foundation-catalog'

export type LiteratureEvidenceErrorCode =
  | 'duplicate_json_key'
  | 'malformed_json'
  | 'schema_violation'
  | 'credential_shaped_value'

/** A controlled, typed parse failure. Nothing here ever throws a bare TypeError. */
export class LiteratureEvidenceError extends Error {
  readonly code: LiteratureEvidenceErrorCode

  constructor(code: LiteratureEvidenceErrorCode, message: string) {
    super(message)
    this.name = 'LiteratureEvidenceError'
    this.code = code
  }
}

/* ------------------------------------------------------------------------------------------- *
 * Duplicate-key-rejecting, control-character-rejecting JSON parser
 *
 * `JSON.parse` silently keeps the last value for a repeated key, so a document can carry a benign
 * value past a reviewer's eye and a different one into the program. A minimal recursive-descent
 * parser is the honest fix: it sees every key before the object collapses. It remains strictly
 * JSON-compliant — and RFC 8259 requires control characters inside strings to be escaped, so a
 * literal newline, tab, or NUL inside a string is a parse error here, never silently accepted.
 * ------------------------------------------------------------------------------------------- */

class StrictJsonParser {
  private index = 0

  constructor(private readonly text: string) {}

  static parse(text: string): unknown {
    const parser = new StrictJsonParser(text)
    parser.skipWhitespace()
    const value = parser.parseValue()
    parser.skipWhitespace()
    if (parser.index !== parser.text.length) {
      throw new LiteratureEvidenceError('malformed_json', 'Trailing content after the JSON value.')
    }
    return value
  }

  private fail(message: string): never {
    throw new LiteratureEvidenceError('malformed_json', `${message} at offset ${this.index}.`)
  }

  private skipWhitespace() {
    while (this.index < this.text.length && ' \t\n\r'.includes(this.text[this.index])) {
      this.index += 1
    }
  }

  private expect(character: string) {
    if (this.text[this.index] !== character) this.fail(`Expected ${character}`)
    this.index += 1
  }

  private parseValue(): unknown {
    this.skipWhitespace()
    const character = this.text[this.index]
    if (character === undefined) this.fail('Unexpected end of input')
    if (character === '{') return this.parseObject()
    if (character === '[') return this.parseArray()
    if (character === '"') return this.parseString()
    if (this.text.startsWith('true', this.index)) return ((this.index += 4), true)
    if (this.text.startsWith('false', this.index)) return ((this.index += 5), false)
    if (this.text.startsWith('null', this.index)) return ((this.index += 4), null)
    return this.parseNumber()
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{')
    const result: Record<string, unknown> = {}
    const seen = new Set<string>()
    this.skipWhitespace()
    if (this.text[this.index] === '}') {
      this.index += 1
      return result
    }
    for (;;) {
      this.skipWhitespace()
      const key = this.parseString()
      if (seen.has(key)) {
        throw new LiteratureEvidenceError(
          'duplicate_json_key',
          `The evidence document repeats the key ${JSON.stringify(key)}. Duplicate keys are ` +
            'rejected rather than resolved last-value-wins.',
        )
      }
      seen.add(key)
      this.skipWhitespace()
      this.expect(':')
      result[key] = this.parseValue()
      this.skipWhitespace()
      if (this.text[this.index] === ',') {
        this.index += 1
        continue
      }
      this.expect('}')
      return result
    }
  }

  private parseArray(): unknown[] {
    this.expect('[')
    const result: unknown[] = []
    this.skipWhitespace()
    if (this.text[this.index] === ']') {
      this.index += 1
      return result
    }
    for (;;) {
      result.push(this.parseValue())
      this.skipWhitespace()
      if (this.text[this.index] === ',') {
        this.index += 1
        continue
      }
      this.expect(']')
      return result
    }
  }

  private parseString(): string {
    this.expect('"')
    let out = ''
    for (;;) {
      const character = this.text[this.index]
      if (character === undefined) this.fail('Unterminated string')
      this.index += 1
      if (character === '"') return out
      if (character !== '\\') {
        // RFC 8259 §7: U+0000 through U+001F must be escaped inside a string. A literal
        // newline/tab/NUL is malformed JSON, not content.
        if (character.charCodeAt(0) < 0x20) {
          this.fail('Unescaped control character inside a string')
        }
        out += character
        continue
      }
      const escape = this.text[this.index]
      this.index += 1
      switch (escape) {
        case '"':
          out += '"'
          break
        case '\\':
          out += '\\'
          break
        case '/':
          out += '/'
          break
        case 'b':
          out += '\b'
          break
        case 'f':
          out += '\f'
          break
        case 'n':
          out += '\n'
          break
        case 'r':
          out += '\r'
          break
        case 't':
          out += '\t'
          break
        case 'u': {
          const hex = this.text.slice(this.index, this.index + 4)
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) this.fail('Invalid \\u escape')
          out += String.fromCharCode(Number.parseInt(hex, 16))
          this.index += 4
          break
        }
        default:
          this.fail('Invalid escape')
      }
    }
  }

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(this.text.slice(this.index))
    if (!match) this.fail('Invalid number')
    this.index += match[0].length
    return Number(match[0])
  }
}

/* ------------------------------------------------------------------------------------------- *
 * Post-decode credential screening (M-2)
 * ------------------------------------------------------------------------------------------- */

/** Value shapes that are credentials regardless of surrounding text. Always rejected. */
const CREDENTIAL_VALUE_PATTERNS: readonly RegExp[] = [
  /sb_secret_/iu,
  /sb_publishable_/iu,
  /\beyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}/iu, // JWT-shaped
  /postgres(?:ql)?:\/\/[^\s]*:[^\s]*@/iu, // connection string with inline credentials
  /\bbearer\s+[a-z0-9._-]{12,}/iu,
]

/**
 * The prohibited secret vocabulary, matched case-insensitively in decoded keys *and* decoded
 * string values. `_`, `-`, `.`, and space separators are all recognized, so `api key`, `api_key`,
 * and `apikey` are equally caught.
 */
const SECRET_VOCABULARY_PATTERN =
  /(secret|passwd|password|token|credential|authorization|bearer|api[\s_.-]?key|private[\s_.-]?key|connection[\s_.-]?string|database[\s_.-]?url|service[\s_.-]?role)/iu

/**
 * Closed allowances for legitimate catalog content that would otherwise trip the vocabulary.
 * Rather than weakening the screening, each allowance admits one *typed, exact* representation:
 *
 *   - the literal role name `service_role`, exactly, as emitted by role and privilege probes;
 *   - a single PostgreSQL ACL-grammar entry (`grantee=privileges/grantor`), the only shape the
 *     `acl` arrays contain;
 *   - this contract's own `serviceRoleExecute` field name.
 *
 * Anything else that matches the vocabulary — including free text containing these tokens — is
 * rejected.
 */
const EXACT_ALLOWED_KEYS: ReadonlySet<string> = new Set(['serviceRoleExecute'])
const EXACT_ALLOWED_VALUES: ReadonlySet<string> = new Set(['service_role'])
const ACL_ENTRY_PATTERN =
  /^(?:"?[A-Za-z_][A-Za-z0-9_]*"?)?=[A-Za-z*]*\/"?[A-Za-z_][A-Za-z0-9_]*"?$/u

function redactedKeyPath(parentPath: string): string {
  return `${parentPath}.[redacted-key]`
}

/**
 * Recursively screen decoded evidence for anything credential-shaped, in keys and values.
 *
 * Runs after decoding, so `sb_secret_…`, `SB_SECRET_…`, and `sb_secret_…` are caught
 * identically. Never echoes the offending key or value: messages carry only a path whose
 * offending segment is redacted.
 */
export function assertDecodedEvidenceCarriesNoSecret(value: unknown, path = '$'): void {
  if (typeof value === 'string') {
    for (const pattern of CREDENTIAL_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        throw new LiteratureEvidenceError(
          'credential_shaped_value',
          `The evidence document contains a credential-shaped value at ${path}. Remove it; the ` +
            'verifiers never need a credential.',
        )
      }
    }
    if (
      SECRET_VOCABULARY_PATTERN.test(value) &&
      !EXACT_ALLOWED_VALUES.has(value) &&
      !ACL_ENTRY_PATTERN.test(value)
    ) {
      throw new LiteratureEvidenceError(
        'credential_shaped_value',
        `The evidence document contains prohibited secret vocabulary in the value at ${path}. ` +
          'Remove it; if genuine catalog content requires such a token, represent it as a ' +
          'canonical hash or a typed non-secret value instead.',
      )
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertDecodedEvidenceCarriesNoSecret(entry, `${path}[${index}]`)
    })
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (!EXACT_ALLOWED_KEYS.has(key)) {
        if (CREDENTIAL_VALUE_PATTERNS.some((pattern) => pattern.test(key))) {
          throw new LiteratureEvidenceError(
            'credential_shaped_value',
            `The evidence document contains a credential-shaped key at ${redactedKeyPath(path)}.`,
          )
        }
        if (SECRET_VOCABULARY_PATTERN.test(key)) {
          throw new LiteratureEvidenceError(
            'credential_shaped_value',
            `The evidence document contains a credential-shaped key at ${redactedKeyPath(path)}.`,
          )
        }
      }
      assertDecodedEvidenceCarriesNoSecret(entry, `${path}.${key}`)
    }
  }
}

/* ------------------------------------------------------------------------------------------- *
 * Strict per-row catalog schemas (H-2)
 *
 * Every row of every section is `.strict()`: unknown nested fields (including any spelling or
 * casing of `projectRef` / `hostname`), missing fields, and wrong field types are all schema
 * violations. Field types mirror exactly what the read-only inspection SQL emits.
 * ------------------------------------------------------------------------------------------- */

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/u)

const extensionRow = z
  .object({ name: z.string(), schema: z.string(), version: z.string() })
  .strict()

const relationRow = z
  .object({
    schema: z.string(),
    name: z.string(),
    relkind: z.enum(['r', 'p', 'f', 'v', 'm', 'S']),
    owner: z.string(),
    persistence: z.enum(['p', 'u', 't']),
    rowLevelSecurity: z.boolean(),
    forcedRowLevelSecurity: z.boolean(),
  })
  .strict()

const indexNameRow = z.object({ schema: z.string(), name: z.string() }).strict()

const typeRow = z
  .object({ schema: z.string(), name: z.string(), typtype: z.enum(['e', 'd', 'c']) })
  .strict()

const columnRow = z
  .object({
    table: z.string(),
    ordinal: z.number().int().positive(),
    name: z.string(),
    type: z.string(),
    notNull: z.boolean(),
    default: z.string().nullable(),
    generated: z.string(),
    identity: z.string(),
    collation: z.string().nullable(),
  })
  .strict()

const constraintRow = z
  .object({
    table: z.string(),
    name: z.string(),
    type: z.string(),
    definition: z.string(),
    validated: z.boolean(),
    deferrable: z.boolean(),
    deferred: z.boolean(),
  })
  .strict()

const functionRow = z
  .object({
    schema: z.string(),
    name: z.string(),
    argumentTypes: z.string(),
    identityArguments: z.string(),
    returnType: z.string(),
    language: z.string(),
    owner: z.string(),
    volatility: z.string(),
    strict: z.boolean(),
    parallel: z.string(),
    securityDefiner: z.boolean(),
    leakproof: z.boolean(),
    config: z.array(z.string()).nullable(),
    definition: z.string(),
    acl: z.array(z.string()).nullable(),
    publicExecute: z.boolean(),
    anonExecute: z.boolean(),
    authenticatedExecute: z.boolean(),
    serviceRoleExecute: z.boolean(),
  })
  .strict()

const triggerRow = z
  .object({
    table: z.string(),
    name: z.string(),
    definition: z.string(),
    enabled: z.string(),
    function: z.string(),
  })
  .strict()

const indexRow = z
  .object({
    name: z.string(),
    table: z.string(),
    definition: z.string(),
    unique: z.boolean(),
    primary: z.boolean(),
    valid: z.boolean(),
    ready: z.boolean(),
    method: z.string(),
  })
  .strict()

const policyRow = z
  .object({
    table: z.string(),
    name: z.string(),
    command: z.string(),
    permissive: z.boolean(),
    using: z.string().nullable(),
    withCheck: z.string().nullable(),
  })
  .strict()

const tablePrivilegeRow = z
  .object({
    table: z.string(),
    role: z.string(),
    privilege: z.string(),
    granted: z.boolean(),
  })
  .strict()

const schemaPrivilegeRow = z
  .object({
    schema: z.string(),
    role: z.string(),
    privilege: z.string(),
    granted: z.boolean(),
  })
  .strict()

const defaultPrivilegeRow = z
  .object({
    owner: z.string(),
    schema: z.string(),
    objectType: z.string(),
    acl: z.array(z.string()),
  })
  .strict()

const roleAttributeRow = z
  .object({
    role: z.string(),
    superuser: z.boolean(),
    bypassRls: z.boolean(),
    canLogin: z.boolean(),
    inherit: z.boolean(),
  })
  .strict()

const CATALOG_ROW_SCHEMAS = {
  extensions: extensionRow,
  relations: relationRow,
  indexNames: indexNameRow,
  types: typeRow,
  columns: columnRow,
  constraints: constraintRow,
  functions: functionRow,
  triggers: triggerRow,
  indexes: indexRow,
  policies: policyRow,
  tablePrivileges: tablePrivilegeRow,
  schemaPrivileges: schemaPrivilegeRow,
  defaultPrivileges: defaultPrivilegeRow,
  roleAttributes: roleAttributeRow,
} as const satisfies Record<LiteratureCatalogSection, z.ZodTypeAny>

const catalogSchema = z
  .object(
    Object.fromEntries(
      LITERATURE_CATALOG_SECTIONS.map((section) => [
        section,
        z.array(CATALOG_ROW_SCHEMAS[section]),
      ]),
    ) as {
      [Section in LiteratureCatalogSection]: z.ZodArray<(typeof CATALOG_ROW_SCHEMAS)[Section]>
    },
  )
  .strict()

export type LiteratureEvidenceCatalog = z.infer<typeof catalogSchema>

const prerequisitesSchema = z
  .object({
    availableExtensions: z.array(z.string()),
    roles: z.array(z.string()),
    schemas: z.array(z.string()),
  })
  .strict()

/* ------------------------------------------------------------------------------------------- *
 * Phase-specific evidence documents (L-1)
 * ------------------------------------------------------------------------------------------- */

export const LITERATURE_PREFLIGHT_EVIDENCE_SCHEMA_VERSION =
  'literature-dedicated-preflight-observation/3.0.0'

export const LITERATURE_POSTFLIGHT_EVIDENCE_SCHEMA_VERSION =
  'literature-dedicated-postflight-observation/3.0.0'

/**
 * Preflight evidence: existence-safe facts only. There is deliberately **no** `totalRowCount`
 * (before the migration no Literature table exists to count) and no direct migration-history
 * dump requirement: `versions` may only be non-null when the existence probe proved the history
 * table present, so the adaptive plan never references a missing relation.
 */
export const literaturePreflightEvidenceSchema = z
  .object({
    schemaVersion: z.literal(LITERATURE_PREFLIGHT_EVIDENCE_SCHEMA_VERSION),
    queryPlanSha256: sha256Hex,
    migrationHistory: z
      .object({
        tableExists: z.boolean(),
        versions: z.array(z.string()).nullable(),
      })
      .strict()
      .superRefine((history, context) => {
        if (history.tableExists && history.versions === null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'migrationHistory.versions must be captured when the history table exists',
          })
        }
        if (!history.tableExists && history.versions !== null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'migrationHistory.versions must be null when the history table does not exist — ' +
              'a versions list for an absent table is fabricated evidence',
          })
        }
      }),
    catalog: catalogSchema,
    prerequisites: prerequisitesSchema,
  })
  .strict()

export type LiteraturePreflightEvidenceDocument = z.infer<typeof literaturePreflightEvidenceSchema>

/**
 * Postflight evidence: begins with the existence probe, and only because the probe proves the
 * relations present are the row count and history dump meaningful. `totalRowCount` is required
 * here (a foundation-only rollout must show zero), unlike the preflight document.
 */
export const literaturePostflightEvidenceSchema = z
  .object({
    schemaVersion: z.literal(LITERATURE_POSTFLIGHT_EVIDENCE_SCHEMA_VERSION),
    queryPlanSha256: sha256Hex,
    existenceProbe: z
      .object({
        migrationHistoryTableExists: z.boolean(),
        presentLiteratureTables: z.array(z.string()),
      })
      .strict(),
    migrationVersions: z.array(z.string()),
    catalog: catalogSchema,
    prerequisites: prerequisitesSchema,
    totalRowCount: z.number().int().nonnegative(),
  })
  .strict()

export type LiteraturePostflightEvidenceDocument = z.infer<
  typeof literaturePostflightEvidenceSchema
>

function parseEvidence<Schema extends z.ZodTypeAny>(raw: string, schema: Schema): z.infer<Schema> {
  const decoded = StrictJsonParser.parse(raw)
  assertDecodedEvidenceCarriesNoSecret(decoded)

  const result = schema.safeParse(decoded)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new LiteratureEvidenceError(
      'schema_violation',
      `Evidence document rejected at ${first.path.join('.') || '$'}: ${first.message}.`,
    )
  }
  return result.data as z.infer<Schema>
}

/**
 * Parse a preflight evidence document: duplicate-key and control-character rejection, post-decode
 * credential screening, then the strict phase schema. Every failure is a
 * `LiteratureEvidenceError` with a code.
 */
export function parseLiteraturePreflightEvidence(raw: string): LiteraturePreflightEvidenceDocument {
  return parseEvidence(raw, literaturePreflightEvidenceSchema)
}

/** Parse a postflight evidence document. Same pipeline, postflight phase schema. */
export function parseLiteraturePostflightEvidence(
  raw: string,
): LiteraturePostflightEvidenceDocument {
  return parseEvidence(raw, literaturePostflightEvidenceSchema)
}
