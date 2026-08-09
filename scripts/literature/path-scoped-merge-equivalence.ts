import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { posix, resolve } from 'node:path'
import { promisify } from 'node:util'

import {
  assertExclusiveOutputDirectoryIdentity,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'

const execFileAsync = promisify(execFile)

export const PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION =
  'literature-path-scoped-merge-equivalence-input/1.0.0' as const
export const PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION =
  'literature-path-scoped-merge-equivalence-receipt/1.0.0' as const
export const SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION =
  'literature-subsequent-mainline-compatibility-input/1.0.0' as const
export const SUBSEQUENT_MAINLINE_COMPATIBILITY_RECEIPT_SCHEMA_VERSION =
  'literature-subsequent-mainline-compatibility-receipt/1.0.0' as const

export const HISTORICAL_MERGE_EQUIVALENCE_MODE = 'historical_merge_equivalence' as const
export const SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE = 'subsequent_mainline_compatibility' as const

export const PACKAGE_JSON_STRUCTURED_COMPARATOR =
  'strict_package_json_pr86_ip_intel_audit_and_pr87_import_compensation_v1' as const
export const PR_86_MERGE_COMMIT = 'da4420f9053a4fe681ab05b078fd5952611eb41e' as const
export const PR_86_IDENTITY = 'PR #86' as const
export const HISTORICAL_PR84_PR85_RECEIPT_SHA256 =
  '4772d0a7da8e4f0c4ecd359d26fb114181a1f8cf0e1a95f542b848b8ccfed962' as const

export const PR_86_PACKAGE_JSON_ADDITION = {
  pointer: '/scripts/ip-intel:audit',
  value: 'tsx scripts/ip-device-intelligence/audit-data-readiness.ts',
} as const

export const PR_87_PACKAGE_JSON_ADDITIONS = [
  {
    pointer: '/scripts/literature:verify-gold-import-compensation-merge',
    value: 'tsx scripts/literature/verify-gold-import-compensation-merge.ts',
  },
  {
    pointer: '/scripts/literature:prepare-gold-import-compensation-migration',
    value: 'tsx scripts/literature/prepare-gold-import-compensation-migration.ts',
  },
  {
    pointer: '/scripts/literature:audit-gold-import-compensation-migration',
    value: 'tsx scripts/literature/audit-gold-import-compensation-migration.ts',
  },
  {
    pointer: '/scripts/literature:generate-gold-import-compensation-package',
    value: 'tsx scripts/literature/generate-gold-import-compensation-package-v1.ts',
  },
  {
    pointer: '/scripts/literature:rehearse-exact-gold-import-compensation-package',
    value: 'tsx scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  },
] as const

export const MERGE_EQUIVALENCE_JSON_FILENAME = 'merge-equivalence-receipt.json' as const
export const MERGE_EQUIVALENCE_MARKDOWN_FILENAME = 'merge-equivalence-receipt.md' as const
export const MERGE_EQUIVALENCE_MANIFEST_FILENAME = 'manifest.sha256' as const
export const MAINLINE_COMPATIBILITY_JSON_FILENAME =
  'subsequent-mainline-compatibility-receipt.json' as const
export const MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME =
  'subsequent-mainline-compatibility-receipt.md' as const
export const MAINLINE_COMPATIBILITY_MANIFEST_FILENAME = 'manifest.sha256' as const

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u

export interface AcceptedUnrelatedMergeInput {
  identity: string
  mergeCommit: string
}

export interface PathScopedMergeEquivalenceInput {
  acceptedUnrelatedMerges: AcceptedUnrelatedMergeInput[]
  featureHead: string
  mergeCommit: string
  mergedMain: string
  protectedPaths: string[]
  schemaVersion: typeof PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION
}

export interface TreeIdentity {
  mode: string
  objectId: string
  type: string
}

export interface CommitIdentity {
  parents: string[]
  sha: string
  tree: string
}

export interface ProtectedPathIdentity {
  featureHead: TreeIdentity
  mergedMain: TreeIdentity
  path: string
  result: 'identical'
}

export interface AcceptedUnrelatedMergeProof {
  changedPathCount: number
  changedPathInventorySha256: string
  changedPaths: string[]
  firstParent: string
  identity: string
  mergeCommit: CommitIdentity
}

export interface AdditionalPathAttribution {
  acceptedMerge: {
    identity: string
    mergeCommit: string
    treeEntry: TreeIdentity | null
  }
  featureHead: TreeIdentity | null
  mergedMain: TreeIdentity | null
  path: string
  result: 'attributed_to_accepted_unrelated_merge'
}

export interface PathScopedMergeEquivalenceReceipt {
  acceptedUnrelatedMerges: AcceptedUnrelatedMergeProof[]
  additionalMergedMainPaths: AdditionalPathAttribution[]
  ancestry: {
    featureHeadDirectParentIndex: number | null
    featureHeadIsAncestorOfMergeCommit: true
    featureHeadIsDirectParentOfMergeCommit: boolean
    mergeCommitIsAncestorOfMergedMain: true
  }
  commits: {
    featureHead: CommitIdentity
    mergeCommit: CommitIdentity
    mergedMain: CommitIdentity
  }
  counts: {
    acceptedUnrelatedMergeCount: number
    additionalMergedMainPathCount: number
    identicalProtectedPathCount: number
    overlapPathCount: 0
    protectedPathCount: number
  }
  databaseAccessed: false
  inventories: {
    additionalMergedMainPathSha256: string
    protectedPathSha256: string
  }
  kind: 'path_scoped_merge_equivalence'
  overlapPaths: []
  protectedPaths: ProtectedPathIdentity[]
  result: 'accepted_exact_tree' | 'accepted_unrelated_mainline_delta'
  schemaVersion: typeof PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION
}

export type StrictJsonValue =
  | null
  | boolean
  | number
  | string
  | StrictJsonValue[]
  | { [key: string]: StrictJsonValue }

export interface JsonPointerAuthorization {
  pointer: string
  value: string
}

export interface StructuredProtectedPathAuthorization {
  acceptedMergeCommit: typeof PR_86_MERGE_COMMIT
  acceptedMergeIdentity: typeof PR_86_IDENTITY
  authorizedAdditions: JsonPointerAuthorization[]
  candidateRequiredAdditions: JsonPointerAuthorization[]
  comparator: typeof PACKAGE_JSON_STRUCTURED_COMPARATOR
  path: 'package.json'
}

export interface SubsequentMainlineCompatibilityInput {
  acceptedLaterMerges: AcceptedUnrelatedMergeInput[]
  candidateHead: string
  currentMain: string
  historicalMergeEquivalence: PathScopedMergeEquivalenceInput
  historicalReceiptSha256: typeof HISTORICAL_PR84_PR85_RECEIPT_SHA256
  mode: typeof SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE
  schemaVersion: typeof SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION
  structuredProtectedPaths: StructuredProtectedPathAuthorization[]
}

export interface JsonValuePresence {
  exists: boolean
  value?: StrictJsonValue
}

export interface JsonSemanticChange {
  after: JsonValuePresence
  before: JsonValuePresence
  kind: 'addition' | 'deletion' | 'substitution'
  pointer: string
}

export interface PreservedJsonPointerValue extends JsonPointerAuthorization {
  provenance:
    | 'historical_import_compensation_script'
    | 'pr86_authorized_addition'
    | 'pr87_required_candidate_addition'
}

export interface StructuredProtectedPathProof {
  acceptedMergeBase: TreeIdentity
  acceptedMergeResult: TreeIdentity
  acceptedMergeSemanticDiff: JsonSemanticChange[]
  authorizationSha256: string
  authorizedAdditions: JsonPointerAuthorization[]
  candidateHead: TreeIdentity
  candidateRequiredAdditions: JsonPointerAuthorization[]
  candidateSemanticDiff: JsonSemanticChange[]
  comparator: typeof PACKAGE_JSON_STRUCTURED_COMPARATOR
  contentSha256: {
    acceptedMergeBase: string
    acceptedMergeResult: string
    candidateHead: string
    currentMain: string
    historicalMergedMain: string
  }
  currentMain: TreeIdentity
  currentMainSemanticDiff: JsonSemanticChange[]
  historicalMergedMain: TreeIdentity
  path: 'package.json'
  preservedJsonPointers: PreservedJsonPointerValue[]
  result: 'accepted_authorized_semantic_additions'
  semanticDiffSha256: {
    acceptedMerge: string
    candidate: string
    currentMain: string
  }
}

export interface SubsequentMainlineCompatibilityReceipt {
  acceptedLaterMerges: AcceptedUnrelatedMergeProof[]
  ancestry: {
    acceptedLaterMergesAreAncestorsOfCurrentMain: true
    currentMainIsAncestorOfCandidateHead: true
    historicalMergedMainIsAncestorOfCurrentMain: true
  }
  commits: {
    candidateHead: CommitIdentity
    currentMain: CommitIdentity
    historicalMergedMain: CommitIdentity
  }
  counts: {
    acceptedLaterMergeCount: number
    byteIdenticalProtectedPathCount: number
    currentMainAdditionalPathCount: number
    protectedPathCount: number
    structuredProtectedPathCount: number
  }
  currentMainAdditionalPaths: AdditionalPathAttribution[]
  databaseAccessed: false
  historicalMergeReceipt: {
    canonicalJsonSha256: string
    commits: PathScopedMergeEquivalenceReceipt['commits']
    counts: PathScopedMergeEquivalenceReceipt['counts']
    inventories: PathScopedMergeEquivalenceReceipt['inventories']
    result: PathScopedMergeEquivalenceReceipt['result']
    schemaVersion: typeof PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION
  }
  inventories: {
    byteIdenticalProtectedPathSha256: string
    currentMainAdditionalPathSha256: string
    protectedPathSha256: string
    structuredProtectedPathSha256: string
  }
  inputIdentitySha256: string
  kind: typeof SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE
  overlapPaths: ['package.json']
  protectedPaths: {
    byteIdentical: ProtectedPathIdentity[]
    structured: StructuredProtectedPathProof[]
  }
  result: 'accepted_structured_unrelated_mainline_delta'
  schemaVersion: typeof SUBSEQUENT_MAINLINE_COMPATIBILITY_RECEIPT_SCHEMA_VERSION
}

export type PathScopedMergeEquivalenceErrorCode =
  | 'ambiguous_additional_path_attribution'
  | 'invalid_input'
  | 'invalid_topology'
  | 'protected_path_failure'
  | 'protected_path_overlap'
  | 'structured_comparison_failure'
  | 'unapproved_additional_path'
  | 'unauthorized_structured_change'

export class PathScopedMergeEquivalenceError extends Error {
  constructor(
    readonly code: PathScopedMergeEquivalenceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PathScopedMergeEquivalenceError'
  }
}

export interface MergeEquivalenceGitReader {
  blobText(commit: string, path: string): Promise<string>
  changedPaths(from: string, to: string): Promise<string[]>
  commitIdentity(sha: string): Promise<CommitIdentity>
  isAncestor(ancestor: string, descendant: string): Promise<boolean>
  resolveCommit(sha: string): Promise<string>
  treeEntry(commit: string, path: string): Promise<TreeIdentity | null>
}

interface GitExecutionError extends Error {
  code?: number | string
  stderr?: string
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort(compareText)
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    )
  }
  return value
}

export function canonicalMergeEquivalenceJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function pathInventorySha256(paths: readonly string[]): string {
  return sha256(paths.length === 0 ? '' : `${paths.join('\n')}\n`)
}

function inputError(message: string): never {
  throw new PathScopedMergeEquivalenceError('invalid_input', message)
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return inputError(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return inputError(`${label} must be a non-empty string.`)
  }
  return value
}

function fullSha(value: unknown, label: string): string {
  const normalized = stringValue(value, label).toLowerCase()
  if (!FULL_SHA_PATTERN.test(normalized)) {
    return inputError(`${label} must be a full 40-character Git commit SHA.`)
  }
  return normalized
}

function protectedPath(value: unknown, label: string): string {
  const path = stringValue(value, label)
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.startsWith(':') ||
    path.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(path) ||
    posix.normalize(path) !== path ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    return inputError(`${label} is not a normalized repository-relative Git path: ${path}`)
  }
  return path
}

export function parsePathScopedMergeEquivalenceInput(
  value: unknown,
): PathScopedMergeEquivalenceInput {
  const input = objectValue(value, 'Merge-equivalence input')
  if (input.schemaVersion !== PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION) {
    return inputError(
      `schemaVersion must equal ${PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION}.`,
    )
  }

  if (!Array.isArray(input.protectedPaths) || input.protectedPaths.length === 0) {
    return inputError('protectedPaths must be a non-empty array.')
  }
  const protectedPaths = input.protectedPaths.map((path, index) =>
    protectedPath(path, `protectedPaths[${index}]`),
  )
  if (new Set(protectedPaths).size !== protectedPaths.length) {
    return inputError('protectedPaths must not contain duplicates.')
  }

  if (!Array.isArray(input.acceptedUnrelatedMerges)) {
    return inputError('acceptedUnrelatedMerges must be an array.')
  }
  const acceptedUnrelatedMerges = input.acceptedUnrelatedMerges.map((raw, index) => {
    const merge = objectValue(raw, `acceptedUnrelatedMerges[${index}]`)
    return {
      identity: stringValue(merge.identity, `acceptedUnrelatedMerges[${index}].identity`).trim(),
      mergeCommit: fullSha(merge.mergeCommit, `acceptedUnrelatedMerges[${index}].mergeCommit`),
    }
  })
  if (
    new Set(acceptedUnrelatedMerges.map(({ identity }) => identity)).size !==
    acceptedUnrelatedMerges.length
  ) {
    return inputError('Accepted unrelated merge identities must be unique.')
  }
  if (
    new Set(acceptedUnrelatedMerges.map(({ mergeCommit }) => mergeCommit)).size !==
    acceptedUnrelatedMerges.length
  ) {
    return inputError('Accepted unrelated merge commit SHAs must be unique.')
  }

  return {
    schemaVersion: PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION,
    featureHead: fullSha(input.featureHead, 'featureHead'),
    mergeCommit: fullSha(input.mergeCommit, 'mergeCommit'),
    mergedMain: fullSha(input.mergedMain, 'mergedMain'),
    protectedPaths: sorted(protectedPaths),
    acceptedUnrelatedMerges: [...acceptedUnrelatedMerges].sort((left, right) =>
      compareText(
        `${left.identity}\u0000${left.mergeCommit}`,
        `${right.identity}\u0000${right.mergeCommit}`,
      ),
    ),
  }
}

function strictObjectKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actual = sorted(Object.keys(value))
  const expected = sorted(expectedKeys)
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    inputError(`${label} must contain exactly these keys: ${expected.join(', ')}.`)
  }
}

function strictJsonFailure(message: string): never {
  throw new PathScopedMergeEquivalenceError('structured_comparison_failure', message)
}

function jsonPointerToken(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1')
}

function childJsonPointer(parent: string, token: string): string {
  return `${parent}/${jsonPointerToken(token)}`
}

class StrictJsonParser {
  private index = 0

  constructor(
    private readonly source: string,
    private readonly label: string,
  ) {}

  parse(): StrictJsonValue {
    this.skipWhitespace()
    const value = this.parseValue('')
    this.skipWhitespace()
    if (this.index !== this.source.length) {
      return strictJsonFailure(`${this.label} has trailing content at byte ${this.index}.`)
    }
    return value
  }

  private skipWhitespace(): void {
    while (
      this.index < this.source.length &&
      (this.source[this.index] === ' ' ||
        this.source[this.index] === '\t' ||
        this.source[this.index] === '\n' ||
        this.source[this.index] === '\r')
    ) {
      this.index += 1
    }
  }

  private parseValue(pointer: string): StrictJsonValue {
    this.skipWhitespace()
    const character = this.source[this.index]
    if (character === '{') return this.parseObject(pointer)
    if (character === '[') return this.parseArray(pointer)
    if (character === '"') return this.parseString()
    if (character === 't') return this.parseLiteral('true', true)
    if (character === 'f') return this.parseLiteral('false', false)
    if (character === 'n') return this.parseLiteral('null', null)
    if (character === '-' || (character !== undefined && /[0-9]/u.test(character))) {
      return this.parseNumber()
    }
    return strictJsonFailure(
      `${this.label} has an invalid JSON value at ${pointer || '(document root)'}.`,
    )
  }

  private parseLiteral<T extends boolean | null>(token: string, value: T): T {
    if (!this.source.startsWith(token, this.index)) {
      return strictJsonFailure(`${this.label} has an invalid literal at byte ${this.index}.`)
    }
    this.index += token.length
    return value
  }

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(
      this.source.slice(this.index),
    )
    if (!match)
      return strictJsonFailure(`${this.label} has an invalid number at byte ${this.index}.`)
    this.index += match[0].length
    const value = Number(match[0])
    if (!Number.isFinite(value)) {
      return strictJsonFailure(`${this.label} contains a non-finite JSON number.`)
    }
    return value
  }

  private parseString(): string {
    const start = this.index
    this.index += 1
    while (this.index < this.source.length) {
      const character = this.source[this.index]
      if (character === '\\') {
        this.index += 2
        continue
      }
      if (character === '"') {
        this.index += 1
        const token = this.source.slice(start, this.index)
        try {
          const value = JSON.parse(token) as unknown
          if (typeof value !== 'string') {
            return strictJsonFailure(`${this.label} contains an invalid JSON string.`)
          }
          return value
        } catch (error) {
          return strictJsonFailure(
            `${this.label} contains an invalid JSON string: ${error instanceof Error ? error.message : String(error)}.`,
          )
        }
      }
      this.index += 1
    }
    return strictJsonFailure(`${this.label} contains an unterminated JSON string.`)
  }

  private parseObject(pointer: string): { [key: string]: StrictJsonValue } {
    this.index += 1
    const result = Object.create(null) as { [key: string]: StrictJsonValue }
    const keys = new Set<string>()
    this.skipWhitespace()
    if (this.source[this.index] === '}') {
      this.index += 1
      return result
    }
    while (this.index < this.source.length) {
      this.skipWhitespace()
      if (this.source[this.index] !== '"') {
        return strictJsonFailure(`${this.label} has an invalid object key at byte ${this.index}.`)
      }
      const key = this.parseString()
      const keyPointer = childJsonPointer(pointer, key)
      if (keys.has(key)) {
        return strictJsonFailure(
          `${this.label} contains duplicate object key ${JSON.stringify(key)} at ${keyPointer}.`,
        )
      }
      keys.add(key)
      this.skipWhitespace()
      if (this.source[this.index] !== ':') {
        return strictJsonFailure(`${this.label} is missing ':' after ${keyPointer}.`)
      }
      this.index += 1
      const value = this.parseValue(keyPointer)
      Object.defineProperty(result, key, {
        configurable: false,
        enumerable: true,
        value,
        writable: false,
      })
      this.skipWhitespace()
      if (this.source[this.index] === '}') {
        this.index += 1
        return result
      }
      if (this.source[this.index] !== ',') {
        return strictJsonFailure(
          `${this.label} has an invalid object delimiter at byte ${this.index}.`,
        )
      }
      this.index += 1
    }
    return strictJsonFailure(`${this.label} contains an unterminated JSON object.`)
  }

  private parseArray(pointer: string): StrictJsonValue[] {
    this.index += 1
    const result: StrictJsonValue[] = []
    this.skipWhitespace()
    if (this.source[this.index] === ']') {
      this.index += 1
      return result
    }
    while (this.index < this.source.length) {
      result.push(this.parseValue(childJsonPointer(pointer, String(result.length))))
      this.skipWhitespace()
      if (this.source[this.index] === ']') {
        this.index += 1
        return result
      }
      if (this.source[this.index] !== ',') {
        return strictJsonFailure(
          `${this.label} has an invalid array delimiter at byte ${this.index}.`,
        )
      }
      this.index += 1
    }
    return strictJsonFailure(`${this.label} contains an unterminated JSON array.`)
  }
}

export function parseStrictJson(text: string, label = 'Structured JSON'): StrictJsonValue {
  return new StrictJsonParser(text, label).parse()
}

function parseJsonPointerAuthorizations(value: unknown, label: string): JsonPointerAuthorization[] {
  if (!Array.isArray(value) || value.length === 0) {
    return inputError(`${label} must be a non-empty array.`)
  }
  const result = value.map((raw, index) => {
    const authorization = objectValue(raw, `${label}[${index}]`)
    strictObjectKeys(authorization, ['pointer', 'value'], `${label}[${index}]`)
    const pointer = stringValue(authorization.pointer, `${label}[${index}].pointer`)
    if (!pointer.startsWith('/') || pointer.includes('~')) {
      return inputError(`${label}[${index}].pointer must be a normalized JSON Pointer.`)
    }
    return { pointer, value: stringValue(authorization.value, `${label}[${index}].value`) }
  })
  if (new Set(result.map(({ pointer }) => pointer)).size !== result.length) {
    return inputError(`${label} contains duplicate JSON Pointers.`)
  }
  return [...result].sort((left, right) => compareText(left.pointer, right.pointer))
}

function exactAuthorizationSet(
  actual: readonly JsonPointerAuthorization[],
  expected: readonly JsonPointerAuthorization[],
  label: string,
): void {
  const normalizedExpected = [...expected].sort((left, right) =>
    compareText(left.pointer, right.pointer),
  )
  if (canonicalMergeEquivalenceJson(actual) !== canonicalMergeEquivalenceJson(normalizedExpected)) {
    inputError(`${label} does not match the code-pinned structured authorization.`)
  }
}

export function exactPackageJsonStructuredAuthorization(): StructuredProtectedPathAuthorization {
  return {
    path: 'package.json',
    comparator: PACKAGE_JSON_STRUCTURED_COMPARATOR,
    acceptedMergeIdentity: PR_86_IDENTITY,
    acceptedMergeCommit: PR_86_MERGE_COMMIT,
    authorizedAdditions: [{ ...PR_86_PACKAGE_JSON_ADDITION }],
    candidateRequiredAdditions: PR_87_PACKAGE_JSON_ADDITIONS.map((entry) => ({ ...entry })),
  }
}

export function parseSubsequentMainlineCompatibilityInput(
  value: unknown,
): SubsequentMainlineCompatibilityInput {
  const input = objectValue(value, 'Subsequent-mainline compatibility input')
  strictObjectKeys(
    input,
    [
      'acceptedLaterMerges',
      'candidateHead',
      'currentMain',
      'historicalMergeEquivalence',
      'historicalReceiptSha256',
      'mode',
      'schemaVersion',
      'structuredProtectedPaths',
    ],
    'Subsequent-mainline compatibility input',
  )
  if (input.schemaVersion !== SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION) {
    return inputError(
      `schemaVersion must equal ${SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION}.`,
    )
  }
  if (input.mode !== SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE) {
    return inputError(`mode must equal ${SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE}.`)
  }
  if (input.historicalReceiptSha256 !== HISTORICAL_PR84_PR85_RECEIPT_SHA256) {
    return inputError(`historicalReceiptSha256 must equal ${HISTORICAL_PR84_PR85_RECEIPT_SHA256}.`)
  }

  if (!Array.isArray(input.acceptedLaterMerges) || input.acceptedLaterMerges.length !== 1) {
    return inputError('acceptedLaterMerges must contain exactly the authorized PR #86 merge.')
  }
  const laterMerge = objectValue(input.acceptedLaterMerges[0], 'acceptedLaterMerges[0]')
  strictObjectKeys(laterMerge, ['identity', 'mergeCommit'], 'acceptedLaterMerges[0]')
  const acceptedLaterMerges = [
    {
      identity: stringValue(laterMerge.identity, 'acceptedLaterMerges[0].identity').trim(),
      mergeCommit: fullSha(laterMerge.mergeCommit, 'acceptedLaterMerges[0].mergeCommit'),
    },
  ]
  if (
    acceptedLaterMerges[0].identity !== PR_86_IDENTITY ||
    acceptedLaterMerges[0].mergeCommit !== PR_86_MERGE_COMMIT
  ) {
    return inputError('acceptedLaterMerges must bind the exact authorized PR #86 merge identity.')
  }

  if (
    !Array.isArray(input.structuredProtectedPaths) ||
    input.structuredProtectedPaths.length !== 1
  ) {
    return inputError('structuredProtectedPaths must contain exactly package.json.')
  }
  const rawStructured = objectValue(
    input.structuredProtectedPaths[0],
    'structuredProtectedPaths[0]',
  )
  strictObjectKeys(
    rawStructured,
    [
      'acceptedMergeCommit',
      'acceptedMergeIdentity',
      'authorizedAdditions',
      'candidateRequiredAdditions',
      'comparator',
      'path',
    ],
    'structuredProtectedPaths[0]',
  )
  if (
    rawStructured.path !== 'package.json' ||
    rawStructured.comparator !== PACKAGE_JSON_STRUCTURED_COMPARATOR ||
    rawStructured.acceptedMergeIdentity !== PR_86_IDENTITY ||
    rawStructured.acceptedMergeCommit !== PR_86_MERGE_COMMIT
  ) {
    return inputError('structuredProtectedPaths[0] is not the exact package.json PR #86 policy.')
  }
  const authorizedAdditions = parseJsonPointerAuthorizations(
    rawStructured.authorizedAdditions,
    'structuredProtectedPaths[0].authorizedAdditions',
  )
  const candidateRequiredAdditions = parseJsonPointerAuthorizations(
    rawStructured.candidateRequiredAdditions,
    'structuredProtectedPaths[0].candidateRequiredAdditions',
  )
  exactAuthorizationSet(authorizedAdditions, [PR_86_PACKAGE_JSON_ADDITION], 'authorizedAdditions')
  exactAuthorizationSet(
    candidateRequiredAdditions,
    PR_87_PACKAGE_JSON_ADDITIONS,
    'candidateRequiredAdditions',
  )

  const historicalMergeEquivalence = parsePathScopedMergeEquivalenceInput(
    input.historicalMergeEquivalence,
  )
  if (
    historicalMergeEquivalence.mergedMain !== '858018c247c5fef177bd57b7bef686db2918333e' ||
    historicalMergeEquivalence.protectedPaths.length !== 34 ||
    !historicalMergeEquivalence.protectedPaths.includes('package.json')
  ) {
    return inputError('Historical merge input is not the reviewed PR #84/PR #85 34-path contract.')
  }

  return {
    schemaVersion: SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION,
    mode: SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE,
    historicalMergeEquivalence,
    historicalReceiptSha256: HISTORICAL_PR84_PR85_RECEIPT_SHA256,
    currentMain: fullSha(input.currentMain, 'currentMain'),
    candidateHead: fullSha(input.candidateHead, 'candidateHead'),
    acceptedLaterMerges,
    structuredProtectedPaths: [
      {
        path: 'package.json',
        comparator: PACKAGE_JSON_STRUCTURED_COMPARATOR,
        acceptedMergeIdentity: PR_86_IDENTITY,
        acceptedMergeCommit: PR_86_MERGE_COMMIT,
        authorizedAdditions,
        candidateRequiredAdditions,
      },
    ],
  }
}

function validateDiscoveredPath(path: string): string {
  return protectedPath(path, 'Git-discovered path')
}

function sameTreeIdentity(left: TreeIdentity | null, right: TreeIdentity | null): boolean {
  if (left === null || right === null) return left === right
  return left.mode === right.mode && left.type === right.type && left.objectId === right.objectId
}

export class LocalGitReader implements MergeEquivalenceGitReader {
  private readonly blobTextCache = new Map<string, Promise<string>>()
  private readonly treeEntryCache = new Map<string, Promise<TreeIdentity | null>>()

  constructor(private readonly repositoryRoot: string) {}

  private async git(arguments_: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', arguments_, {
      cwd: this.repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    return stdout
  }

  private gitBuffer(arguments_: string[]): Promise<Buffer> {
    return new Promise((resolvePromise, reject) => {
      execFile(
        'git',
        arguments_,
        {
          cwd: this.repositoryRoot,
          encoding: null,
          maxBuffer: 16 * 1024 * 1024,
        },
        (error, stdout) => {
          if (error) reject(error)
          else resolvePromise(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout))
        },
      )
    })
  }

  async resolveCommit(sha: string): Promise<string> {
    if (!FULL_SHA_PATTERN.test(sha)) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_input',
        `Git identity must be a full 40-character SHA: ${sha}`,
      )
    }
    let resolved: string
    try {
      resolved = (await this.git(['rev-parse', '--verify', `${sha}^{commit}`])).trim().toLowerCase()
    } catch {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git commit does not exist in the repository: ${sha}`,
      )
    }
    if (resolved !== sha) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git commit identity did not resolve exactly: expected ${sha}; received ${resolved}.`,
      )
    }
    return resolved
  }

  async commitIdentity(sha: string): Promise<CommitIdentity> {
    const [parentsText, tree] = await Promise.all([
      this.git(['show', '--no-patch', '--format=%P', sha]),
      this.git(['rev-parse', '--verify', `${sha}^{tree}`]),
    ])
    const parents = parentsText.trim() === '' ? [] : parentsText.trim().split(/\s+/u)
    if (parents.some((parent) => !FULL_SHA_PATTERN.test(parent))) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git returned invalid parent identities for ${sha}.`,
      )
    }
    const treeSha = tree.trim()
    if (!FULL_SHA_PATTERN.test(treeSha)) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git returned an invalid tree identity for ${sha}.`,
      )
    }
    return { sha, tree: treeSha, parents }
  }

  async isAncestor(ancestor: string, descendant: string): Promise<boolean> {
    try {
      await this.git(['merge-base', '--is-ancestor', ancestor, descendant])
      return true
    } catch (error: unknown) {
      const gitError = error as GitExecutionError
      if (gitError.code === 1) return false
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Unable to verify Git ancestry for ${ancestor} and ${descendant}: ${gitError.stderr?.trim() || gitError.message}`,
      )
    }
  }

  async changedPaths(from: string, to: string): Promise<string[]> {
    const output = await this.git([
      '--literal-pathspecs',
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      from,
      to,
      '--',
    ])
    const paths = output
      .split('\u0000')
      .filter((path) => path !== '')
      .map(validateDiscoveredPath)
    return sorted(new Set(paths))
  }

  blobText(commit: string, path: string): Promise<string> {
    const cacheKey = `${commit}\u0000${path}`
    const cached = this.blobTextCache.get(cacheKey)
    if (cached) return cached
    const pending = this.readBlobText(commit, path)
    this.blobTextCache.set(cacheKey, pending)
    return pending
  }

  private async readBlobText(commit: string, path: string): Promise<string> {
    const entry = await this.treeEntry(commit, path)
    if (!entry || entry.type !== 'blob') {
      throw new PathScopedMergeEquivalenceError(
        'structured_comparison_failure',
        `Structured file ${path} is not a blob at ${commit}.`,
      )
    }
    const bytes = await this.gitBuffer(['cat-file', 'blob', entry.objectId])
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new PathScopedMergeEquivalenceError(
        'structured_comparison_failure',
        `Structured file ${path} is not valid UTF-8 at ${commit}.`,
      )
    }
  }

  treeEntry(commit: string, path: string): Promise<TreeIdentity | null> {
    const cacheKey = `${commit}\u0000${path}`
    const cached = this.treeEntryCache.get(cacheKey)
    if (cached) return cached
    const pending = this.readTreeEntry(commit, path)
    this.treeEntryCache.set(cacheKey, pending)
    return pending
  }

  private async readTreeEntry(commit: string, path: string): Promise<TreeIdentity | null> {
    const output = await this.git(['--literal-pathspecs', 'ls-tree', '-z', commit, '--', path])
    if (output === '') return null
    const records = output.split('\u0000').filter((record) => record !== '')
    if (records.length !== 1) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Expected one tree entry for ${path} at ${commit}; received ${records.length}.`,
      )
    }
    const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]{40})\t(.+)$/u.exec(records[0])
    if (!match || match[4] !== path) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Unable to parse the exact tree identity for ${path} at ${commit}.`,
      )
    }
    return { mode: match[1], type: match[2], objectId: match[3] }
  }
}

interface AcceptedMergeRuntime extends AcceptedUnrelatedMergeProof {
  changedPathSet: Set<string>
}

function topologyError(message: string): never {
  throw new PathScopedMergeEquivalenceError('invalid_topology', message)
}

async function acceptedMergeProofs(
  input: PathScopedMergeEquivalenceInput,
  git: MergeEquivalenceGitReader,
): Promise<AcceptedMergeRuntime[]> {
  return Promise.all(
    input.acceptedUnrelatedMerges.map(async ({ identity, mergeCommit }) => {
      if (mergeCommit === input.mergeCommit) {
        return topologyError(
          `Accepted unrelated merge ${identity} cannot be the actual merge commit under verification.`,
        )
      }
      const commit = await git.commitIdentity(mergeCommit)
      if (commit.parents.length < 2) {
        return topologyError(
          `Accepted unrelated merge ${identity} (${mergeCommit}) is not a merge commit.`,
        )
      }
      if (!(await git.isAncestor(mergeCommit, input.mergedMain))) {
        return topologyError(
          `Accepted unrelated merge ${identity} (${mergeCommit}) is not an ancestor of merged main ${input.mergedMain}.`,
        )
      }
      if (await git.isAncestor(mergeCommit, input.featureHead)) {
        return topologyError(
          `Accepted unrelated merge ${identity} (${mergeCommit}) is already in validated feature-head ancestry and cannot authorize a merged-main-only delta.`,
        )
      }
      const changedPaths = await git.changedPaths(commit.parents[0], mergeCommit)
      return {
        identity,
        mergeCommit: commit,
        firstParent: commit.parents[0],
        changedPaths,
        changedPathCount: changedPaths.length,
        changedPathInventorySha256: pathInventorySha256(changedPaths),
        changedPathSet: new Set(changedPaths),
      }
    }),
  )
}

export async function verifyPathScopedMergeEquivalence(
  rawInput: PathScopedMergeEquivalenceInput | unknown,
  options: { git?: MergeEquivalenceGitReader; repositoryRoot?: string } = {},
): Promise<PathScopedMergeEquivalenceReceipt> {
  const input = parsePathScopedMergeEquivalenceInput(rawInput)
  const git = options.git ?? new LocalGitReader(resolve(options.repositoryRoot ?? process.cwd()))

  await Promise.all([
    git.resolveCommit(input.featureHead),
    git.resolveCommit(input.mergeCommit),
    git.resolveCommit(input.mergedMain),
    ...input.acceptedUnrelatedMerges.map(({ mergeCommit }) => git.resolveCommit(mergeCommit)),
  ])

  const [featureHead, mergeCommit, mergedMain] = await Promise.all([
    git.commitIdentity(input.featureHead),
    git.commitIdentity(input.mergeCommit),
    git.commitIdentity(input.mergedMain),
  ])
  if (mergeCommit.parents.length < 2) {
    return topologyError(`Actual merge commit ${input.mergeCommit} is not a merge commit.`)
  }
  if (!(await git.isAncestor(input.featureHead, input.mergeCommit))) {
    return topologyError(
      `Validated feature head ${input.featureHead} is not an ancestor of actual merge commit ${input.mergeCommit}.`,
    )
  }
  if (!(await git.isAncestor(input.mergeCommit, input.mergedMain))) {
    return topologyError(
      `Actual merge commit ${input.mergeCommit} is not an ancestor of merged main ${input.mergedMain}.`,
    )
  }

  const accepted = await acceptedMergeProofs(input, git)
  const protectedSet = new Set(input.protectedPaths)
  const overlapPaths = sorted(
    new Set(
      accepted.flatMap(({ changedPaths }) => changedPaths.filter((path) => protectedSet.has(path))),
    ),
  )
  if (overlapPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'protected_path_overlap',
      `Accepted unrelated merge changes overlap protected paths: ${overlapPaths.join(', ')}`,
    )
  }

  const protectedFailures: string[] = []
  const protectedPathIdentities = await Promise.all(
    input.protectedPaths.map(async (path): Promise<ProtectedPathIdentity | null> => {
      const [featureEntry, mainEntry] = await Promise.all([
        git.treeEntry(input.featureHead, path),
        git.treeEntry(input.mergedMain, path),
      ])
      if (!featureEntry) {
        protectedFailures.push(`${path}: missing from validated feature head`)
        return null
      }
      if (!mainEntry) {
        protectedFailures.push(`${path}: missing from merged main`)
        return null
      }
      if (featureEntry.type !== 'blob' || mainEntry.type !== 'blob') {
        protectedFailures.push(
          `${path}: expected blob entries; received ${featureEntry.type}/${mainEntry.type}`,
        )
        return null
      }
      if (!sameTreeIdentity(featureEntry, mainEntry)) {
        const changedFields = (
          [
            ['mode', featureEntry.mode, mainEntry.mode],
            ['type', featureEntry.type, mainEntry.type],
            ['blob', featureEntry.objectId, mainEntry.objectId],
          ] as const
        )
          .filter(([, featureValue, mainValue]) => featureValue !== mainValue)
          .map(([field]) => field)
        protectedFailures.push(`${path}: ${changedFields.join('/')} identity differs`)
        return null
      }
      return { path, featureHead: featureEntry, mergedMain: mainEntry, result: 'identical' }
    }),
  )
  if (protectedFailures.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'protected_path_failure',
      `Protected path verification failed: ${sorted(protectedFailures).join('; ')}`,
    )
  }

  const allTreeDifferences = await git.changedPaths(input.featureHead, input.mergedMain)
  const additionalPaths = allTreeDifferences.filter((path) => !protectedSet.has(path))
  const additionalAttributions: AdditionalPathAttribution[] = []
  const unapprovedPaths: string[] = []
  const ambiguousPaths: string[] = []

  for (const path of additionalPaths) {
    const [featureEntry, mainEntry] = await Promise.all([
      git.treeEntry(input.featureHead, path),
      git.treeEntry(input.mergedMain, path),
    ])
    const candidates: Array<{
      identity: string
      mergeCommit: string
      treeEntry: TreeIdentity | null
    }> = []
    for (const acceptedMerge of accepted) {
      if (!acceptedMerge.changedPathSet.has(path)) continue
      const acceptedEntry = await git.treeEntry(acceptedMerge.mergeCommit.sha, path)
      if (sameTreeIdentity(acceptedEntry, mainEntry)) {
        candidates.push({
          identity: acceptedMerge.identity,
          mergeCommit: acceptedMerge.mergeCommit.sha,
          treeEntry: acceptedEntry,
        })
      }
    }
    if (candidates.length === 0) {
      unapprovedPaths.push(path)
      continue
    }
    if (candidates.length > 1) {
      ambiguousPaths.push(
        `${path} (${candidates
          .map(({ identity }) => identity)
          .sort(compareText)
          .join(', ')})`,
      )
      continue
    }
    additionalAttributions.push({
      path,
      featureHead: featureEntry,
      mergedMain: mainEntry,
      acceptedMerge: candidates[0],
      result: 'attributed_to_accepted_unrelated_merge',
    })
  }
  if (unapprovedPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'unapproved_additional_path',
      `Merged main contains additional paths not attributable to an accepted unrelated merge: ${unapprovedPaths.join(', ')}`,
    )
  }
  if (ambiguousPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'ambiguous_additional_path_attribution',
      `Additional paths have ambiguous accepted-merge attribution: ${ambiguousPaths.join('; ')}`,
    )
  }

  const featureHeadDirectParentIndex = mergeCommit.parents.indexOf(input.featureHead)
  return {
    schemaVersion: PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION,
    kind: 'path_scoped_merge_equivalence',
    result:
      additionalPaths.length === 0 ? 'accepted_exact_tree' : 'accepted_unrelated_mainline_delta',
    commits: { featureHead, mergeCommit, mergedMain },
    ancestry: {
      featureHeadIsAncestorOfMergeCommit: true,
      featureHeadIsDirectParentOfMergeCommit: featureHeadDirectParentIndex >= 0,
      featureHeadDirectParentIndex:
        featureHeadDirectParentIndex >= 0 ? featureHeadDirectParentIndex + 1 : null,
      mergeCommitIsAncestorOfMergedMain: true,
    },
    counts: {
      protectedPathCount: input.protectedPaths.length,
      identicalProtectedPathCount: input.protectedPaths.length,
      acceptedUnrelatedMergeCount: accepted.length,
      additionalMergedMainPathCount: additionalPaths.length,
      overlapPathCount: 0,
    },
    inventories: {
      protectedPathSha256: pathInventorySha256(input.protectedPaths),
      additionalMergedMainPathSha256: pathInventorySha256(additionalPaths),
    },
    protectedPaths: protectedPathIdentities.filter(
      (entry): entry is ProtectedPathIdentity => entry !== null,
    ),
    acceptedUnrelatedMerges: accepted.map((proof) => ({
      identity: proof.identity,
      mergeCommit: proof.mergeCommit,
      firstParent: proof.firstParent,
      changedPaths: proof.changedPaths,
      changedPathCount: proof.changedPathCount,
      changedPathInventorySha256: proof.changedPathInventorySha256,
    })),
    additionalMergedMainPaths: additionalAttributions,
    overlapPaths: [],
    databaseAccessed: false,
  }
}

function isStrictJsonObject(value: StrictJsonValue): value is { [key: string]: StrictJsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function strictJsonEqual(left: StrictJsonValue, right: StrictJsonValue): boolean {
  return canonicalMergeEquivalenceJson(left) === canonicalMergeEquivalenceJson(right)
}

function jsonValuePresence(value: StrictJsonValue): JsonValuePresence {
  return { exists: true, value }
}

function missingJsonValue(): JsonValuePresence {
  return { exists: false }
}

function semanticJsonDiff(
  before: StrictJsonValue,
  after: StrictJsonValue,
  pointer = '',
): JsonSemanticChange[] {
  if (strictJsonEqual(before, after)) return []

  if (isStrictJsonObject(before) && isStrictJsonObject(after)) {
    const changes: JsonSemanticChange[] = []
    const keys = sorted(new Set([...Object.keys(before), ...Object.keys(after)]))
    for (const key of keys) {
      const childPointer = childJsonPointer(pointer, key)
      const beforeHasKey = Object.hasOwn(before, key)
      const afterHasKey = Object.hasOwn(after, key)
      if (!beforeHasKey) {
        changes.push({
          pointer: childPointer,
          kind: 'addition',
          before: missingJsonValue(),
          after: jsonValuePresence(after[key]),
        })
      } else if (!afterHasKey) {
        changes.push({
          pointer: childPointer,
          kind: 'deletion',
          before: jsonValuePresence(before[key]),
          after: missingJsonValue(),
        })
      } else {
        changes.push(...semanticJsonDiff(before[key], after[key], childPointer))
      }
    }
    return changes
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: JsonSemanticChange[] = []
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      const childPointer = childJsonPointer(pointer, String(index))
      if (index >= before.length) {
        changes.push({
          pointer: childPointer,
          kind: 'addition',
          before: missingJsonValue(),
          after: jsonValuePresence(after[index]),
        })
      } else if (index >= after.length) {
        changes.push({
          pointer: childPointer,
          kind: 'deletion',
          before: jsonValuePresence(before[index]),
          after: missingJsonValue(),
        })
      } else {
        changes.push(...semanticJsonDiff(before[index], after[index], childPointer))
      }
    }
    return changes
  }

  return [
    {
      pointer,
      kind: 'substitution',
      before: jsonValuePresence(before),
      after: jsonValuePresence(after),
    },
  ]
}

function expectedAdditionChanges(
  authorizations: readonly JsonPointerAuthorization[],
): JsonSemanticChange[] {
  return [...authorizations]
    .sort((left, right) => compareText(left.pointer, right.pointer))
    .map(({ pointer, value }) => ({
      pointer,
      kind: 'addition' as const,
      before: missingJsonValue(),
      after: jsonValuePresence(value),
    }))
}

function assertAuthorizedSemanticDiff(
  actual: JsonSemanticChange[],
  expectedAdditions: readonly JsonPointerAuthorization[],
  label: string,
): void {
  const expected = expectedAdditionChanges(expectedAdditions)
  if (canonicalMergeEquivalenceJson(actual) !== canonicalMergeEquivalenceJson(expected)) {
    throw new PathScopedMergeEquivalenceError(
      'unauthorized_structured_change',
      `${label} contains an undeclared structured change. Expected ${expected
        .map(({ pointer }) => pointer)
        .join(', ')}; received ${
        actual.map(({ kind, pointer }) => `${kind}:${pointer || '(document root)'}`).join(', ') ||
        '(none)'
      }.`,
    )
  }
}

function decodeJsonPointerToken(token: string): string {
  if (/~(?:[^01]|$)/u.test(token)) {
    return strictJsonFailure(`Invalid JSON Pointer token: ${token}.`)
  }
  return token.replaceAll('~1', '/').replaceAll('~0', '~')
}

function jsonPointerPresence(root: StrictJsonValue, pointer: string): JsonValuePresence {
  if (pointer === '') return jsonValuePresence(root)
  if (!pointer.startsWith('/')) return strictJsonFailure(`Invalid JSON Pointer: ${pointer}.`)
  let current = root
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = decodeJsonPointerToken(rawToken)
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(token)) return missingJsonValue()
      const index = Number(token)
      if (index >= current.length) return missingJsonValue()
      current = current[index]
    } else if (isStrictJsonObject(current) && Object.hasOwn(current, token)) {
      current = current[token]
    } else {
      return missingJsonValue()
    }
  }
  return jsonValuePresence(current)
}

function requireJsonPointerValue(
  root: StrictJsonValue,
  authorization: JsonPointerAuthorization,
  label: string,
): void {
  const actual = jsonPointerPresence(root, authorization.pointer)
  if (
    !actual.exists ||
    canonicalMergeEquivalenceJson(actual.value) !==
      canonicalMergeEquivalenceJson(authorization.value)
  ) {
    throw new PathScopedMergeEquivalenceError(
      'unauthorized_structured_change',
      `${label} does not preserve ${authorization.pointer} with its exact authorized value.`,
    )
  }
}

interface ParsedStructuredBlob {
  entry: TreeIdentity
  json: StrictJsonValue
  sha256: string
  text: string
}

async function parsedStructuredBlob(
  git: MergeEquivalenceGitReader,
  commit: string,
  path: string,
  label: string,
): Promise<ParsedStructuredBlob> {
  const [entry, text] = await Promise.all([git.treeEntry(commit, path), git.blobText(commit, path)])
  if (!entry || entry.type !== 'blob') {
    return strictJsonFailure(`${label} is not a Git blob.`)
  }
  return { entry, text, sha256: sha256(text), json: parseStrictJson(text, label) }
}

function assertStructuredTreeModes(blobs: readonly ParsedStructuredBlob[], path: string): void {
  const first = blobs[0]?.entry
  if (
    !first ||
    first.type !== 'blob' ||
    blobs.some(({ entry }) => entry.type !== first.type || entry.mode !== first.mode)
  ) {
    throw new PathScopedMergeEquivalenceError(
      'structured_comparison_failure',
      `${path} mode/type changed across the structured comparison.`,
    )
  }
}

function historicalImportCompensationScripts(
  historicalPackage: StrictJsonValue,
): JsonPointerAuthorization[] {
  const scripts = jsonPointerPresence(historicalPackage, '/scripts')
  if (!scripts.exists || scripts.value === undefined || !isStrictJsonObject(scripts.value)) {
    return strictJsonFailure('Historical package.json does not contain a scripts object.')
  }
  const result = Object.entries(scripts.value)
    .filter(([key]) => key.includes('import-compensation'))
    .map(([key, value]) => {
      if (typeof value !== 'string') {
        return strictJsonFailure(`Historical import-compensation script ${key} is not a string.`)
      }
      return { pointer: childJsonPointer('/scripts', key), value }
    })
    .sort((left, right) => compareText(left.pointer, right.pointer))
  if (result.length === 0) {
    return strictJsonFailure('Historical package.json contains no import-compensation scripts.')
  }
  return result
}

async function verifyPackageJsonStructuredOverlap(input: {
  acceptedMerge: AcceptedMergeRuntime
  authorization: StructuredProtectedPathAuthorization
  candidateHead: string
  currentMain: string
  git: MergeEquivalenceGitReader
  historicalMergedMain: string
}): Promise<StructuredProtectedPathProof> {
  const path = input.authorization.path
  const [historical, acceptedBase, acceptedResult, current, candidate] = await Promise.all([
    parsedStructuredBlob(input.git, input.historicalMergedMain, path, 'Historical package.json'),
    parsedStructuredBlob(
      input.git,
      input.acceptedMerge.firstParent,
      path,
      'PR #86 first-parent package.json',
    ),
    parsedStructuredBlob(
      input.git,
      input.acceptedMerge.mergeCommit.sha,
      path,
      'PR #86 merged package.json',
    ),
    parsedStructuredBlob(input.git, input.currentMain, path, 'Current-main package.json'),
    parsedStructuredBlob(input.git, input.candidateHead, path, 'Candidate package.json'),
  ])
  assertStructuredTreeModes([historical, acceptedBase, acceptedResult, current, candidate], path)
  if (!sameTreeIdentity(historical.entry, acceptedBase.entry)) {
    throw new PathScopedMergeEquivalenceError(
      'structured_comparison_failure',
      'PR #86 package.json base is not the historical merged-main package.json blob.',
    )
  }

  const acceptedMergeSemanticDiff = semanticJsonDiff(acceptedBase.json, acceptedResult.json)
  const currentMainSemanticDiff = semanticJsonDiff(historical.json, current.json)
  const candidateSemanticDiff = semanticJsonDiff(current.json, candidate.json)
  assertAuthorizedSemanticDiff(
    acceptedMergeSemanticDiff,
    input.authorization.authorizedAdditions,
    'PR #86 package.json',
  )
  assertAuthorizedSemanticDiff(
    currentMainSemanticDiff,
    input.authorization.authorizedAdditions,
    'Current-main package.json',
  )
  assertAuthorizedSemanticDiff(
    candidateSemanticDiff,
    input.authorization.candidateRequiredAdditions,
    'Candidate package.json',
  )

  const historicalScripts = historicalImportCompensationScripts(historical.json)
  for (const authorization of [
    ...historicalScripts,
    ...input.authorization.authorizedAdditions,
    ...input.authorization.candidateRequiredAdditions,
  ]) {
    requireJsonPointerValue(candidate.json, authorization, 'Candidate package.json')
  }

  const preservedJsonPointers: PreservedJsonPointerValue[] = [
    ...historicalScripts.map((entry) => ({
      ...entry,
      provenance: 'historical_import_compensation_script' as const,
    })),
    ...input.authorization.authorizedAdditions.map((entry) => ({
      ...entry,
      provenance: 'pr86_authorized_addition' as const,
    })),
    ...input.authorization.candidateRequiredAdditions.map((entry) => ({
      ...entry,
      provenance: 'pr87_required_candidate_addition' as const,
    })),
  ].sort((left, right) => compareText(left.pointer, right.pointer))

  const authorizationIdentity = {
    acceptedMergeCommit: input.authorization.acceptedMergeCommit,
    acceptedMergeIdentity: input.authorization.acceptedMergeIdentity,
    authorizedAdditions: input.authorization.authorizedAdditions,
    candidateRequiredAdditions: input.authorization.candidateRequiredAdditions,
    comparator: input.authorization.comparator,
    path,
  }
  return {
    path,
    comparator: input.authorization.comparator,
    result: 'accepted_authorized_semantic_additions',
    authorizationSha256: sha256(canonicalMergeEquivalenceJson(authorizationIdentity)),
    authorizedAdditions: input.authorization.authorizedAdditions,
    candidateRequiredAdditions: input.authorization.candidateRequiredAdditions,
    preservedJsonPointers,
    historicalMergedMain: historical.entry,
    acceptedMergeBase: acceptedBase.entry,
    acceptedMergeResult: acceptedResult.entry,
    currentMain: current.entry,
    candidateHead: candidate.entry,
    contentSha256: {
      historicalMergedMain: historical.sha256,
      acceptedMergeBase: acceptedBase.sha256,
      acceptedMergeResult: acceptedResult.sha256,
      currentMain: current.sha256,
      candidateHead: candidate.sha256,
    },
    acceptedMergeSemanticDiff,
    currentMainSemanticDiff,
    candidateSemanticDiff,
    semanticDiffSha256: {
      acceptedMerge: sha256(canonicalMergeEquivalenceJson(acceptedMergeSemanticDiff)),
      currentMain: sha256(canonicalMergeEquivalenceJson(currentMainSemanticDiff)),
      candidate: sha256(canonicalMergeEquivalenceJson(candidateSemanticDiff)),
    },
  }
}

async function acceptedLaterMergeProofs(
  input: SubsequentMainlineCompatibilityInput,
  git: MergeEquivalenceGitReader,
): Promise<AcceptedMergeRuntime[]> {
  return Promise.all(
    input.acceptedLaterMerges.map(async ({ identity, mergeCommit }) => {
      const commit = await git.commitIdentity(mergeCommit)
      if (commit.parents.length < 2) {
        return topologyError(
          `Accepted later merge ${identity} (${mergeCommit}) is not a merge commit.`,
        )
      }
      if (commit.parents[0] !== input.historicalMergeEquivalence.mergedMain) {
        return topologyError(
          `Accepted later merge ${identity} first parent must be the historical merged main ${input.historicalMergeEquivalence.mergedMain}.`,
        )
      }
      if (!(await git.isAncestor(mergeCommit, input.currentMain))) {
        return topologyError(
          `Accepted later merge ${identity} (${mergeCommit}) is not an ancestor of current main ${input.currentMain}.`,
        )
      }
      if (await git.isAncestor(mergeCommit, input.historicalMergeEquivalence.mergedMain)) {
        return topologyError(
          `Accepted later merge ${identity} is already in historical merged-main ancestry.`,
        )
      }
      const changedPaths = await git.changedPaths(commit.parents[0], mergeCommit)
      return {
        identity,
        mergeCommit: commit,
        firstParent: commit.parents[0],
        changedPaths,
        changedPathCount: changedPaths.length,
        changedPathInventorySha256: pathInventorySha256(changedPaths),
        changedPathSet: new Set(changedPaths),
      }
    }),
  )
}

export async function verifySubsequentMainlineCompatibility(
  rawInput: SubsequentMainlineCompatibilityInput | unknown,
  options: { git?: MergeEquivalenceGitReader; repositoryRoot?: string } = {},
): Promise<SubsequentMainlineCompatibilityReceipt> {
  const input = parseSubsequentMainlineCompatibilityInput(rawInput)
  const git = options.git ?? new LocalGitReader(resolve(options.repositoryRoot ?? process.cwd()))
  const historicalReceipt = await verifyPathScopedMergeEquivalence(
    input.historicalMergeEquivalence,
    { git },
  )
  const historicalReceiptSha256 = sha256(canonicalMergeEquivalenceJson(historicalReceipt))
  if (historicalReceiptSha256 !== input.historicalReceiptSha256) {
    throw new PathScopedMergeEquivalenceError(
      'structured_comparison_failure',
      `Historical merge receipt identity changed: expected ${input.historicalReceiptSha256}; received ${historicalReceiptSha256}.`,
    )
  }

  await Promise.all([
    git.resolveCommit(input.currentMain),
    git.resolveCommit(input.candidateHead),
    ...input.acceptedLaterMerges.map(({ mergeCommit }) => git.resolveCommit(mergeCommit)),
  ])
  const historicalMergedMainSha = input.historicalMergeEquivalence.mergedMain
  const [historicalMergedMain, currentMain, candidateHead] = await Promise.all([
    git.commitIdentity(historicalMergedMainSha),
    git.commitIdentity(input.currentMain),
    git.commitIdentity(input.candidateHead),
  ])
  if (!(await git.isAncestor(historicalMergedMainSha, input.currentMain))) {
    return topologyError(
      `Historical merged main ${historicalMergedMainSha} is not an ancestor of current main ${input.currentMain}.`,
    )
  }
  if (!(await git.isAncestor(input.currentMain, input.candidateHead))) {
    return topologyError(
      `Current main ${input.currentMain} is not an ancestor of candidate head ${input.candidateHead}.`,
    )
  }

  const accepted = await acceptedLaterMergeProofs(input, git)
  const protectedSet = new Set(input.historicalMergeEquivalence.protectedPaths)
  const structuredPaths = input.structuredProtectedPaths.map(({ path }) => path)
  const structuredSet = new Set<string>(structuredPaths)
  const overlapPaths = sorted(
    new Set(
      accepted.flatMap(({ changedPaths }) => changedPaths.filter((path) => protectedSet.has(path))),
    ),
  )
  if (
    overlapPaths.length !== structuredPaths.length ||
    overlapPaths.some((path, index) => path !== [...structuredPaths].sort(compareText)[index])
  ) {
    throw new PathScopedMergeEquivalenceError(
      'protected_path_overlap',
      `Accepted later-merge protected overlap must equal the declared structured paths. Expected ${structuredPaths.join(', ')}; received ${overlapPaths.join(', ') || '(none)'}.`,
    )
  }

  const byteIdenticalPaths = input.historicalMergeEquivalence.protectedPaths.filter(
    (path) => !structuredSet.has(path),
  )
  const protectedFailures: string[] = []
  const byteIdenticalIdentities = await Promise.all(
    byteIdenticalPaths.map(async (path): Promise<ProtectedPathIdentity | null> => {
      const [historicalEntry, currentEntry] = await Promise.all([
        git.treeEntry(historicalMergedMainSha, path),
        git.treeEntry(input.currentMain, path),
      ])
      if (!historicalEntry || !currentEntry) {
        protectedFailures.push(`${path}: missing historical/current tree entry`)
        return null
      }
      if (
        historicalEntry.type !== 'blob' ||
        currentEntry.type !== 'blob' ||
        !sameTreeIdentity(historicalEntry, currentEntry)
      ) {
        protectedFailures.push(`${path}: mode/type/blob identity differs`)
        return null
      }
      return {
        path,
        featureHead: historicalEntry,
        mergedMain: currentEntry,
        result: 'identical',
      }
    }),
  )
  if (protectedFailures.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'protected_path_failure',
      `Subsequent-mainline protected path verification failed: ${sorted(protectedFailures).join('; ')}`,
    )
  }

  const structuredProofs = await Promise.all(
    input.structuredProtectedPaths.map((authorization) => {
      const acceptedMerge = accepted.find(
        ({ identity, mergeCommit }) =>
          identity === authorization.acceptedMergeIdentity &&
          mergeCommit.sha === authorization.acceptedMergeCommit,
      )
      if (!acceptedMerge) {
        throw new PathScopedMergeEquivalenceError(
          'unauthorized_structured_change',
          `No accepted merge matches the structured authorization for ${authorization.path}.`,
        )
      }
      return verifyPackageJsonStructuredOverlap({
        historicalMergedMain: historicalMergedMainSha,
        currentMain: input.currentMain,
        candidateHead: input.candidateHead,
        acceptedMerge,
        authorization,
        git,
      })
    }),
  )

  const allCurrentDifferences = await git.changedPaths(historicalMergedMainSha, input.currentMain)
  const additionalPaths = allCurrentDifferences.filter((path) => !protectedSet.has(path))
  const additionalAttributions: AdditionalPathAttribution[] = []
  const unapprovedPaths: string[] = []
  const ambiguousPaths: string[] = []
  for (const path of additionalPaths) {
    const [historicalEntry, currentEntry] = await Promise.all([
      git.treeEntry(historicalMergedMainSha, path),
      git.treeEntry(input.currentMain, path),
    ])
    const candidates: AdditionalPathAttribution['acceptedMerge'][] = []
    for (const acceptedMerge of accepted) {
      if (!acceptedMerge.changedPathSet.has(path)) continue
      const acceptedEntry = await git.treeEntry(acceptedMerge.mergeCommit.sha, path)
      if (sameTreeIdentity(acceptedEntry, currentEntry)) {
        candidates.push({
          identity: acceptedMerge.identity,
          mergeCommit: acceptedMerge.mergeCommit.sha,
          treeEntry: acceptedEntry,
        })
      }
    }
    if (candidates.length === 0) {
      unapprovedPaths.push(path)
    } else if (candidates.length > 1) {
      ambiguousPaths.push(path)
    } else {
      additionalAttributions.push({
        path,
        featureHead: historicalEntry,
        mergedMain: currentEntry,
        acceptedMerge: candidates[0],
        result: 'attributed_to_accepted_unrelated_merge',
      })
    }
  }
  if (unapprovedPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'unapproved_additional_path',
      `Current main contains paths not attributable to an accepted later merge: ${unapprovedPaths.join(', ')}`,
    )
  }
  if (ambiguousPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'ambiguous_additional_path_attribution',
      `Current-main paths have ambiguous later-merge attribution: ${ambiguousPaths.join(', ')}`,
    )
  }

  return {
    schemaVersion: SUBSEQUENT_MAINLINE_COMPATIBILITY_RECEIPT_SCHEMA_VERSION,
    kind: SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE,
    result: 'accepted_structured_unrelated_mainline_delta',
    inputIdentitySha256: sha256(canonicalMergeEquivalenceJson(input)),
    historicalMergeReceipt: {
      schemaVersion: historicalReceipt.schemaVersion,
      canonicalJsonSha256: historicalReceiptSha256,
      result: historicalReceipt.result,
      commits: historicalReceipt.commits,
      counts: historicalReceipt.counts,
      inventories: historicalReceipt.inventories,
    },
    commits: { historicalMergedMain, currentMain, candidateHead },
    ancestry: {
      historicalMergedMainIsAncestorOfCurrentMain: true,
      acceptedLaterMergesAreAncestorsOfCurrentMain: true,
      currentMainIsAncestorOfCandidateHead: true,
    },
    counts: {
      protectedPathCount: input.historicalMergeEquivalence.protectedPaths.length,
      byteIdenticalProtectedPathCount: byteIdenticalPaths.length,
      structuredProtectedPathCount: structuredPaths.length,
      acceptedLaterMergeCount: accepted.length,
      currentMainAdditionalPathCount: additionalPaths.length,
    },
    inventories: {
      protectedPathSha256: pathInventorySha256(input.historicalMergeEquivalence.protectedPaths),
      byteIdenticalProtectedPathSha256: pathInventorySha256(byteIdenticalPaths),
      structuredProtectedPathSha256: pathInventorySha256(structuredPaths),
      currentMainAdditionalPathSha256: pathInventorySha256(additionalPaths),
    },
    protectedPaths: {
      byteIdentical: byteIdenticalIdentities.filter(
        (entry): entry is ProtectedPathIdentity => entry !== null,
      ),
      structured: structuredProofs,
    },
    acceptedLaterMerges: accepted.map((proof) => ({
      identity: proof.identity,
      mergeCommit: proof.mergeCommit,
      firstParent: proof.firstParent,
      changedPaths: proof.changedPaths,
      changedPathCount: proof.changedPathCount,
      changedPathInventorySha256: proof.changedPathInventorySha256,
    })),
    currentMainAdditionalPaths: additionalAttributions,
    overlapPaths: ['package.json'],
    databaseAccessed: false,
  }
}

function markdownCell(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|')
}

function treeIdentityText(entry: TreeIdentity | null): string {
  return entry ? `${entry.mode} ${entry.type} ${entry.objectId}` : '(missing)'
}

export function serializePathScopedMergeEquivalenceMarkdown(
  receipt: PathScopedMergeEquivalenceReceipt,
  canonicalJsonSha256 = sha256(canonicalMergeEquivalenceJson(receipt)),
): string {
  const protectedRows = receipt.protectedPaths
    .map(
      ({ path, mergedMain }) =>
        `| ${markdownCell(path)} | ${mergedMain.mode} | ${mergedMain.type} | \`${mergedMain.objectId}\` | identical |`,
    )
    .join('\n')
  const acceptedSections = receipt.acceptedUnrelatedMerges
    .map(
      (merge) =>
        `### ${markdownCell(merge.identity)}\n\n- Merge commit: \`${merge.mergeCommit.sha}\`\n- First parent: \`${merge.firstParent}\`\n- Changed paths: ${merge.changedPathCount}\n- Path inventory SHA-256: \`${merge.changedPathInventorySha256}\`\n\n${merge.changedPaths.map((path) => `- \`${path}\``).join('\n')}`,
    )
    .join('\n\n')
  const additionalRows = receipt.additionalMergedMainPaths
    .map(
      ({ path, featureHead, mergedMain, acceptedMerge }) =>
        `| ${markdownCell(path)} | ${markdownCell(acceptedMerge.identity)} | \`${acceptedMerge.mergeCommit}\` | \`${treeIdentityText(featureHead)}\` | \`${treeIdentityText(mergedMain)}\` |`,
    )
    .join('\n')

  return `# Path-scoped merge-equivalence receipt

- Result: **${receipt.result}**
- Canonical JSON SHA-256: \`${canonicalJsonSha256}\`
- Protected paths: ${receipt.counts.identicalProtectedPathCount}/${receipt.counts.protectedPathCount} identical
- Additional merged-main paths: ${receipt.counts.additionalMergedMainPathCount}
- Protected-path overlap: ${receipt.counts.overlapPathCount}
- Database accessed: no

## Commit identities

- Validated feature head: \`${receipt.commits.featureHead.sha}\`
- Actual merge commit: \`${receipt.commits.mergeCommit.sha}\`
- Merged main: \`${receipt.commits.mergedMain.sha}\`
- Feature head is an ancestor of the merge commit: yes
- Feature head is a direct parent: ${receipt.ancestry.featureHeadIsDirectParentOfMergeCommit ? `yes (parent ${receipt.ancestry.featureHeadDirectParentIndex})` : 'no'}
- Merge commit is an ancestor of merged main: yes

## Protected paths

| Path | Mode | Type | Blob ID | Result |
| --- | --- | --- | --- | --- |
${protectedRows}

## Accepted unrelated merges

${acceptedSections || '_None._'}

## Additional merged-main paths and exact attribution

| Path | Accepted identity | Merge commit | Feature-head tree entry | Merged-main tree entry |
| --- | --- | --- | --- | --- |
${additionalRows || '| _None_ | — | — | — | — |'}

## Conclusion

All protected paths have identical mode, type, and blob identities. Every additional merged-main path is attributed to exactly one explicitly accepted, nonoverlapping merge. This receipt was produced without database access.
`
}

export function serializeSubsequentMainlineCompatibilityMarkdown(
  receipt: SubsequentMainlineCompatibilityReceipt,
  canonicalJsonSha256 = sha256(canonicalMergeEquivalenceJson(receipt)),
): string {
  const structured = receipt.protectedPaths.structured[0]
  const authorizedRows = structured.authorizedAdditions
    .map(
      ({ pointer, value }) =>
        `| \`${markdownCell(pointer)}\` | \`${markdownCell(value)}\` | PR #86 |`,
    )
    .join('\n')
  const candidateRows = structured.candidateRequiredAdditions
    .map(
      ({ pointer, value }) =>
        `| \`${markdownCell(pointer)}\` | \`${markdownCell(value)}\` | PR #87 candidate |`,
    )
    .join('\n')
  const ordinaryRows = receipt.protectedPaths.byteIdentical
    .map(
      ({ path, mergedMain }) =>
        `| ${markdownCell(path)} | ${mergedMain.mode} | ${mergedMain.type} | \`${mergedMain.objectId}\` | identical |`,
    )
    .join('\n')

  return `# Subsequent-mainline compatibility receipt

- Result: **${receipt.result}**
- Canonical JSON SHA-256: \`${canonicalJsonSha256}\`
- Parsed input identity SHA-256: \`${receipt.inputIdentitySha256}\`
- Historical receipt SHA-256: \`${receipt.historicalMergeReceipt.canonicalJsonSha256}\`
- Byte-identical protected paths: ${receipt.counts.byteIdenticalProtectedPathCount}
- Structured protected paths: ${receipt.counts.structuredProtectedPathCount}
- Accepted protected overlap: \`${receipt.overlapPaths.join('`, `')}\`
- Comparator: \`${structured.comparator}\`
- Authorization SHA-256: \`${structured.authorizationSha256}\`
- Database accessed: no

## Commit identities

- Historical merged main: \`${receipt.commits.historicalMergedMain.sha}\`
- Current main: \`${receipt.commits.currentMain.sha}\`
- Candidate head: \`${receipt.commits.candidateHead.sha}\`
- Current main is an ancestor of candidate head: yes

## Authorized structured values

| JSON Pointer | Exact value | Provenance |
| --- | --- | --- |
${authorizedRows}
${candidateRows}

## Byte-identical protected paths

| Path | Mode | Type | Blob ID | Result |
| --- | --- | --- | --- | --- |
${ordinaryRows}

## Conclusion

The historical receipt is unchanged. Every ordinary protected path has identical mode, type, and blob identity between historical and current main. The only protected overlap is package.json, whose strict duplicate-key-safe semantic comparison contains exactly the authorized PR #86 addition; the candidate adds exactly the five required PR #87 script values and preserves every historical import-compensation script. This receipt was produced without database access.
`
}

export interface PublishedMergeEquivalenceReceipt {
  json: { filename: typeof MERGE_EQUIVALENCE_JSON_FILENAME; sha256: string }
  manifest: { filename: typeof MERGE_EQUIVALENCE_MANIFEST_FILENAME; sha256: string }
  markdown: { filename: typeof MERGE_EQUIVALENCE_MARKDOWN_FILENAME; sha256: string }
  outputDirectory: string
}

export interface PublishedMainlineCompatibilityReceipt {
  json: { filename: typeof MAINLINE_COMPATIBILITY_JSON_FILENAME; sha256: string }
  manifest: { filename: typeof MAINLINE_COMPATIBILITY_MANIFEST_FILENAME; sha256: string }
  markdown: { filename: typeof MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME; sha256: string }
  outputDirectory: string
}

export interface ReceiptPublicationOptions {
  beforeAnchoredWrite?: (outputDirectory: string) => Promise<void> | void
}

export async function publishPathScopedMergeEquivalenceReceipt(
  receipt: PathScopedMergeEquivalenceReceipt,
  outputDirectory: string,
  outputRoot: string,
  options: ReceiptPublicationOptions = {},
): Promise<PublishedMergeEquivalenceReceipt> {
  const json = canonicalMergeEquivalenceJson(receipt)
  const jsonSha256 = sha256(json)
  const markdown = serializePathScopedMergeEquivalenceMarkdown(receipt, jsonSha256)
  const markdownSha256 = sha256(markdown)
  const manifest =
    [
      `${jsonSha256}  ${MERGE_EQUIVALENCE_JSON_FILENAME}`,
      `${markdownSha256}  ${MERGE_EQUIVALENCE_MARKDOWN_FILENAME}`,
    ].join('\n') + '\n'

  const target = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  await options.beforeAnchoredWrite?.(target.outputDirectory)
  writeExclusiveOutputFiles(target, [
    { bytes: Buffer.from(json, 'utf8'), name: MERGE_EQUIVALENCE_JSON_FILENAME },
    { bytes: Buffer.from(markdown, 'utf8'), name: MERGE_EQUIVALENCE_MARKDOWN_FILENAME },
    { bytes: Buffer.from(manifest, 'utf8'), name: MERGE_EQUIVALENCE_MANIFEST_FILENAME },
  ])
  await assertExclusiveOutputDirectoryIdentity(target)

  return {
    outputDirectory: target.outputDirectory,
    json: { filename: MERGE_EQUIVALENCE_JSON_FILENAME, sha256: jsonSha256 },
    markdown: { filename: MERGE_EQUIVALENCE_MARKDOWN_FILENAME, sha256: markdownSha256 },
    manifest: { filename: MERGE_EQUIVALENCE_MANIFEST_FILENAME, sha256: sha256(manifest) },
  }
}

export async function publishSubsequentMainlineCompatibilityReceipt(
  receipt: SubsequentMainlineCompatibilityReceipt,
  outputDirectory: string,
  outputRoot: string,
  options: ReceiptPublicationOptions = {},
): Promise<PublishedMainlineCompatibilityReceipt> {
  const json = canonicalMergeEquivalenceJson(receipt)
  const jsonSha256 = sha256(json)
  const markdown = serializeSubsequentMainlineCompatibilityMarkdown(receipt, jsonSha256)
  const markdownSha256 = sha256(markdown)
  const manifest =
    [
      `${jsonSha256}  ${MAINLINE_COMPATIBILITY_JSON_FILENAME}`,
      `${markdownSha256}  ${MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME}`,
    ].join('\n') + '\n'

  const target = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  await options.beforeAnchoredWrite?.(target.outputDirectory)
  writeExclusiveOutputFiles(target, [
    { bytes: Buffer.from(json, 'utf8'), name: MAINLINE_COMPATIBILITY_JSON_FILENAME },
    { bytes: Buffer.from(markdown, 'utf8'), name: MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME },
    { bytes: Buffer.from(manifest, 'utf8'), name: MAINLINE_COMPATIBILITY_MANIFEST_FILENAME },
  ])
  await assertExclusiveOutputDirectoryIdentity(target)
  return {
    outputDirectory: target.outputDirectory,
    json: { filename: MAINLINE_COMPATIBILITY_JSON_FILENAME, sha256: jsonSha256 },
    markdown: { filename: MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME, sha256: markdownSha256 },
    manifest: { filename: MAINLINE_COMPATIBILITY_MANIFEST_FILENAME, sha256: sha256(manifest) },
  }
}
