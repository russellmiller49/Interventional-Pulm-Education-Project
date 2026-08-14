/**
 * Strict parsing and screening for Literature target evidence.
 *
 * Two review findings shaped this module.
 *
 * **H-2** — the old parser accepted `catalog: {"tables":[]}`, let wrong array types survive into
 * business logic where they became an uncontrolled `TypeError`, and retained unknown fields through
 * a type cast. Parsing is now: reject duplicate JSON keys, then a strict zod schema that rejects
 * unknown and missing fields and wrong types, then typed errors only.
 *
 * **M-2** — secret screening ran as a raw, case-sensitive regex over the undecoded text, so a
 * credential written with `_` escapes or in mixed case slipped through. Screening now runs
 * *after* decoding, recursively over every key and value.
 *
 * The evidence body deliberately has **no** `projectRef` or `hostname` field. Target identity comes
 * only from a provider attestation whose ref originates in the adapter context; a document that
 * tries to declare its own project is rejected as carrying an unknown field. That is the structural
 * half of the B-1 fix — relabelling is not merely detected, it is unrepresentable.
 */

import { z } from 'zod'

import { LITERATURE_CATALOG_SECTIONS } from './foundation-catalog'

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
 * Duplicate-key-rejecting JSON parser
 *
 * `JSON.parse` silently keeps the last value for a repeated key, so a document can carry a benign
 * value past a reviewer's eye and a different one into the program. A minimal recursive-descent
 * parser is the honest fix: it sees every key before the object collapses.
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
 * Post-decode credential screening
 * ------------------------------------------------------------------------------------------- */

const CREDENTIAL_VALUE_PATTERNS: readonly RegExp[] = [
  /sb_secret_/iu,
  /sb_publishable_/iu,
  /\beyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}/iu, // JWT
  /postgres(?:ql)?:\/\/[^\s]*:[^\s]*@/iu, // connection string with inline credentials
  /\bbearer\s+[a-z0-9._-]{12,}/iu,
]

const CREDENTIAL_KEY_PATTERN =
  /(secret|password|passwd|token|authorization|credential|api[_-]?key|private[_-]?key|connection[_-]?string|service[_-]?role[_-]?key)/iu

/**
 * Recursively screen decoded evidence for anything credential-shaped, in keys or values.
 *
 * Runs after decoding, so `sb_secret_…` and `SB_SECRET_…` are caught identically to the plain
 * form. Never echoes the offending value.
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
      if (CREDENTIAL_KEY_PATTERN.test(key)) {
        throw new LiteratureEvidenceError(
          'credential_shaped_value',
          `The evidence document contains a credential-shaped key at ${path}.${key}.`,
        )
      }
      assertDecodedEvidenceCarriesNoSecret(entry, `${path}.${key}`)
    }
  }
}

/* ------------------------------------------------------------------------------------------- *
 * Strict schema
 * ------------------------------------------------------------------------------------------- */

/** A catalog row: a plain object, never an array or null. */
const catalogRow = z
  .record(z.string(), z.unknown())
  .refine((value) => !Array.isArray(value), { message: 'catalog rows must be objects' })

const catalogShape = Object.fromEntries(
  LITERATURE_CATALOG_SECTIONS.map((section) => [section, z.array(catalogRow)]),
) as Record<(typeof LITERATURE_CATALOG_SECTIONS)[number], z.ZodArray<typeof catalogRow>>

/**
 * The evidence body. `.strict()` everywhere, so an unknown field — including any attempt to declare
 * `projectRef` or `hostname` — is a schema violation rather than an ignored extra.
 */
export const literatureEvidenceSchema = z
  .object({
    schemaVersion: z.literal('literature-dedicated-observation/2.0.0'),
    queryBundleSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    migrationVersions: z.array(z.string()),
    catalog: z.object(catalogShape).strict(),
    prerequisites: z
      .object({
        availableExtensions: z.array(z.string()),
        roles: z.array(z.string()),
        schemas: z.array(z.string()),
      })
      .strict(),
    totalRowCount: z.number().int().nonnegative(),
  })
  .strict()

export type LiteratureEvidenceDocument = z.infer<typeof literatureEvidenceSchema>

/**
 * Parse an evidence document: duplicate-key rejection, then strict schema, then post-decode
 * credential screening. Every failure is a `LiteratureEvidenceError` with a code.
 */
export function parseLiteratureEvidence(raw: string): LiteratureEvidenceDocument {
  const decoded = StrictJsonParser.parse(raw)
  assertDecodedEvidenceCarriesNoSecret(decoded)

  const result = literatureEvidenceSchema.safeParse(decoded)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new LiteratureEvidenceError(
      'schema_violation',
      `Evidence document rejected at ${first.path.join('.') || '$'}: ${first.message}.`,
    )
  }
  return result.data
}
