import { readFile } from 'node:fs/promises'

import { assertSha256, canonicalJson, sha256 } from './canonical'
import {
  CANARY_MANIFEST_SCHEMA_VERSION,
  CANARY_SELECTOR_VERSION,
  CANARY_SOURCE_AUTHORITY,
  DEFAULT_CANARY_SIZE,
  EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
} from './constants'
import type { CanaryCandidate, CanaryManifest, CanaryManifestBody } from './types'

// The receipt binding compares a canary receipt's source authority against this same constant, so
// the manifest and the receipt cannot disagree about which cohort was authorized.
const SOURCE_AUTHORITY = CANARY_SOURCE_AUTHORITY
const MAX_MANIFEST_BYTES = 64 * 1024
const CANDIDATE_KEYS = [
  'abstractPresent',
  'journal',
  'pmid',
  'publicationTypes',
  'publicationYear',
] as const
const MANIFEST_KEYS = [
  'manifestChecksum',
  'pmids',
  'schemaVersion',
  'selectorSeed',
  'selectorVersion',
  'size',
  'sourceAuthority',
] as const

export interface CanaryMixtureSummary {
  abstractAbsentCount: number
  abstractPresentCount: number
  journalCount: number
  newestPublicationYear: number
  oldestPublicationYear: number
  publicationTypeCount: number
}

interface RankedCandidate {
  candidate: CanaryCandidate
  score: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

/**
 * JSON.parse accepts duplicate object members and silently keeps the last value. The manifest is
 * intentionally flat, so reject duplicate top-level members before trusting the parsed shape.
 */
function hasDuplicateTopLevelKey(content: string): boolean {
  const seen = new Set<string>()
  let objectDepth = 0
  let arrayDepth = 0
  let inString = false
  let escaped = false
  let stringStart = -1
  let expectingTopLevelKey = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (character === '\\') {
        escaped = true
        continue
      }
      if (character !== '"') continue

      inString = false
      if (expectingTopLevelKey && objectDepth === 1 && arrayDepth === 0) {
        const key = JSON.parse(content.slice(stringStart, index + 1)) as string
        if (seen.has(key)) return true
        seen.add(key)
        expectingTopLevelKey = false
      }
      continue
    }

    if (character === '"') {
      inString = true
      stringStart = index
      continue
    }
    if (character === '{') {
      objectDepth += 1
      if (objectDepth === 1 && arrayDepth === 0) expectingTopLevelKey = true
      continue
    }
    if (character === '}') {
      objectDepth -= 1
      continue
    }
    if (character === '[') {
      arrayDepth += 1
      continue
    }
    if (character === ']') {
      arrayDepth -= 1
      continue
    }
    if (character === ',' && objectDepth === 1 && arrayDepth === 0) {
      expectingTopLevelKey = true
    }
  }
  return false
}

function comparePmids(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length
  if (left === right) return 0
  return left < right ? -1 : 1
}

function assertPmid(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,11}$/u.test(value)) {
    throw new Error(`${label} must be a 1-12 digit positive PMID string.`)
  }
}

function validateSeed(seed: unknown): asserts seed is string {
  const hasControlCharacter =
    typeof seed === 'string' &&
    Array.from(seed).some((character) => {
      const codePoint = character.codePointAt(0) as number
      return codePoint <= 0x1f || codePoint === 0x7f
    })
  if (
    typeof seed !== 'string' ||
    seed.length === 0 ||
    seed.length > 256 ||
    seed !== seed.trim() ||
    hasControlCharacter
  ) {
    throw new Error(
      'Canary selector seed must be a non-empty printable string of at most 256 characters.',
    )
  }
}

function normalizeCandidate(value: unknown, index: number): CanaryCandidate {
  if (!isObject(value) || !hasExactKeys(value, CANDIDATE_KEYS)) {
    throw new Error('Canary candidates must contain bibliography-only selector fields.')
  }

  assertPmid(value.pmid, `Canary candidate ${index + 1} PMID`)
  if (typeof value.abstractPresent !== 'boolean') {
    throw new Error(`Canary candidate ${index + 1} abstractPresent must be boolean.`)
  }
  if (
    value.publicationYear !== null &&
    (typeof value.publicationYear !== 'number' ||
      !Number.isInteger(value.publicationYear) ||
      value.publicationYear < 1000 ||
      value.publicationYear > 9999)
  ) {
    throw new Error(`Canary candidate ${index + 1} publicationYear is invalid.`)
  }
  if (
    value.journal !== null &&
    (typeof value.journal !== 'string' ||
      value.journal.length === 0 ||
      value.journal !== value.journal.trim())
  ) {
    throw new Error(`Canary candidate ${index + 1} journal is invalid.`)
  }
  if (
    !Array.isArray(value.publicationTypes) ||
    value.publicationTypes.some(
      (entry) => typeof entry !== 'string' || entry.length === 0 || entry !== entry.trim(),
    )
  ) {
    throw new Error(`Canary candidate ${index + 1} publicationTypes are invalid.`)
  }

  return {
    pmid: value.pmid,
    abstractPresent: value.abstractPresent,
    publicationYear: value.publicationYear as number | null,
    journal: value.journal as string | null,
    publicationTypes: [...new Set(value.publicationTypes as string[])].sort(),
  }
}

function normalizeCandidates(values: readonly CanaryCandidate[]): CanaryCandidate[] {
  if (!Array.isArray(values)) throw new Error('Canary candidates must be an array.')
  const candidates = values.map(normalizeCandidate)
  const pmids = new Set<string>()
  for (const candidate of candidates) {
    if (pmids.has(candidate.pmid)) throw new Error('Canary candidates contain duplicate PMIDs.')
    pmids.add(candidate.pmid)
  }
  return candidates
}

function journalIdentity(candidate: CanaryCandidate): string | null {
  return candidate.journal?.toLowerCase() ?? null
}

function publicationTypeIdentities(candidates: readonly CanaryCandidate[]): Set<string> {
  return new Set(
    candidates.flatMap((candidate) => candidate.publicationTypes.map((type) => type.toLowerCase())),
  )
}

/** Validate the minimum diversity contract for a selected canary candidate set. */
export function validateCanaryMixture(
  candidatesInput: readonly CanaryCandidate[],
): CanaryMixtureSummary {
  const candidates = normalizeCandidates(candidatesInput)
  const abstractPresentCount = candidates.filter((candidate) => candidate.abstractPresent).length
  const abstractAbsentCount = candidates.length - abstractPresentCount
  if (abstractPresentCount === 0 || abstractAbsentCount === 0) {
    throw new Error('Canary mixture must contain records both with and without abstracts.')
  }

  const years = candidates
    .map((candidate) => candidate.publicationYear)
    .filter((year): year is number => year !== null)
  const distinctYears = [...new Set(years)].sort((left, right) => left - right)
  if (distinctYears.length < 2) {
    throw new Error('Canary mixture must contain both older and newer publication years.')
  }

  const journals = new Set(
    candidates.map(journalIdentity).filter((journal): journal is string => journal !== null),
  )
  if (journals.size < 2) {
    throw new Error('Canary mixture must contain more than one journal.')
  }

  const publicationTypes = publicationTypeIdentities(candidates)
  if (publicationTypes.size < 2) {
    throw new Error('Canary mixture must contain multiple publication types.')
  }

  return {
    abstractAbsentCount,
    abstractPresentCount,
    journalCount: journals.size,
    newestPublicationYear: distinctYears.at(-1) as number,
    oldestPublicationYear: distinctYears[0],
    publicationTypeCount: publicationTypes.size,
  }
}

function rankCandidates(candidates: readonly CanaryCandidate[], seed: string): RankedCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: sha256(`${CANARY_SELECTOR_VERSION}\n${seed}\n${candidate.pmid}`),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score < right.score ? -1 : 1
      return comparePmids(left.candidate.pmid, right.candidate.pmid)
    })
}

function addFirstMatching(
  ranked: readonly RankedCandidate[],
  selected: Map<string, CanaryCandidate>,
  predicate: (candidate: CanaryCandidate) => boolean,
  failureMessage: string,
): void {
  const match = ranked.find(({ candidate }) => predicate(candidate))?.candidate
  if (!match) throw new Error(failureMessage)
  selected.set(match.pmid, match)
}

/**
 * Select the exact deterministic production canary from the owner-authorized 630-row development
 * cohort. Only the five bibliography-only selector fields are accepted at this boundary.
 */
export function createCanaryManifest(
  candidatesInput: readonly CanaryCandidate[],
  seed: string,
): CanaryManifest {
  validateSeed(seed)
  const candidates = normalizeCandidates(candidatesInput)
  if (candidates.length !== EXPECTED_DEVELOPMENT_CANDIDATE_COUNT) {
    throw new Error(
      `Canary selection requires exactly ${EXPECTED_DEVELOPMENT_CANDIDATE_COUNT} authorized development candidates.`,
    )
  }
  validateCanaryMixture(candidates)

  const ranked = rankCandidates(candidates, seed)
  const selected = new Map<string, CanaryCandidate>()

  addFirstMatching(
    ranked,
    selected,
    (candidate) => candidate.abstractPresent,
    'Authorized candidates do not include an abstract-present record.',
  )
  addFirstMatching(
    ranked,
    selected,
    (candidate) => !candidate.abstractPresent,
    'Authorized candidates do not include an abstract-absent record.',
  )

  const knownYears = candidates
    .map((candidate) => candidate.publicationYear)
    .filter((year): year is number => year !== null)
  const oldestYear = Math.min(...knownYears)
  const newestYear = Math.max(...knownYears)
  addFirstMatching(
    ranked,
    selected,
    (candidate) => candidate.publicationYear === oldestYear,
    'Authorized candidates do not include an older publication year.',
  )
  addFirstMatching(
    ranked,
    selected,
    (candidate) => candidate.publicationYear === newestYear,
    'Authorized candidates do not include a newer publication year.',
  )

  const firstJournal = ranked.find(
    ({ candidate }) => journalIdentity(candidate) !== null,
  )?.candidate
  if (!firstJournal) throw new Error('Authorized candidates do not include journal metadata.')
  selected.set(firstJournal.pmid, firstJournal)
  const firstJournalIdentity = journalIdentity(firstJournal)
  addFirstMatching(
    ranked,
    selected,
    (candidate) => {
      const identity = journalIdentity(candidate)
      return identity !== null && identity !== firstJournalIdentity
    },
    'Authorized candidates do not include more than one journal.',
  )

  while (publicationTypeIdentities([...selected.values()]).size < 2) {
    const selectedTypes = publicationTypeIdentities([...selected.values()])
    addFirstMatching(
      ranked,
      selected,
      (candidate) =>
        candidate.publicationTypes.some((type) => !selectedTypes.has(type.toLowerCase())),
      'Authorized candidates do not include multiple publication types.',
    )
  }

  for (const { candidate } of ranked) {
    if (selected.size >= DEFAULT_CANARY_SIZE) break
    selected.set(candidate.pmid, candidate)
  }
  if (selected.size !== DEFAULT_CANARY_SIZE) {
    throw new Error(`Canary selector could not produce exactly ${DEFAULT_CANARY_SIZE} records.`)
  }

  const selectedCandidates = [...selected.values()]
  validateCanaryMixture(selectedCandidates)
  const body: CanaryManifestBody = {
    schemaVersion: CANARY_MANIFEST_SCHEMA_VERSION,
    selectorVersion: CANARY_SELECTOR_VERSION,
    selectorSeed: seed,
    sourceAuthority: SOURCE_AUTHORITY,
    size: DEFAULT_CANARY_SIZE,
    pmids: selectedCandidates.map((candidate) => candidate.pmid).sort(comparePmids),
  }
  return {
    ...body,
    manifestChecksum: sha256(canonicalJson(body)),
  }
}

function validateManifest(value: unknown): CanaryManifest {
  if (!isObject(value) || !hasExactKeys(value, MANIFEST_KEYS)) {
    throw new Error('Canary manifest has an invalid or non-bibliographic shape.')
  }
  if (value.schemaVersion !== CANARY_MANIFEST_SCHEMA_VERSION) {
    throw new Error('Canary manifest schema version is not supported.')
  }
  if (value.selectorVersion !== CANARY_SELECTOR_VERSION) {
    throw new Error('Canary selector version is not supported.')
  }
  validateSeed(value.selectorSeed)
  if (value.sourceAuthority !== SOURCE_AUTHORITY) {
    throw new Error('Canary manifest source authority is invalid.')
  }
  if (value.size !== DEFAULT_CANARY_SIZE) {
    throw new Error(`Canary manifest size must be exactly ${DEFAULT_CANARY_SIZE}.`)
  }
  if (!Array.isArray(value.pmids) || value.pmids.length !== DEFAULT_CANARY_SIZE) {
    throw new Error(`Canary manifest must contain exactly ${DEFAULT_CANARY_SIZE} PMIDs.`)
  }

  const pmids = value.pmids.map((pmid, index) => {
    assertPmid(pmid, `Canary manifest PMID ${index + 1}`)
    return pmid
  })
  if (new Set(pmids).size !== pmids.length) {
    throw new Error('Canary manifest PMIDs must be unique.')
  }
  const sortedPmids = [...pmids].sort(comparePmids)
  if (pmids.some((pmid, index) => pmid !== sortedPmids[index])) {
    throw new Error('Canary manifest PMIDs must be sorted in numeric order.')
  }

  assertSha256(value.manifestChecksum, 'Canary manifest checksum')
  const body: CanaryManifestBody = {
    schemaVersion: CANARY_MANIFEST_SCHEMA_VERSION,
    selectorVersion: CANARY_SELECTOR_VERSION,
    selectorSeed: value.selectorSeed,
    sourceAuthority: SOURCE_AUTHORITY,
    size: DEFAULT_CANARY_SIZE,
    pmids,
  }
  const expectedChecksum = sha256(canonicalJson(body))
  if (value.manifestChecksum !== expectedChecksum) {
    throw new Error('Canary manifest checksum does not match its canonical body.')
  }

  return { ...body, manifestChecksum: value.manifestChecksum }
}

/** Read and fully validate an authorized canary manifest without logging its PMIDs. */
export async function readCanaryManifest(path: string): Promise<CanaryManifest> {
  const content = await readFile(path, 'utf8')
  if (Buffer.byteLength(content) > MAX_MANIFEST_BYTES) {
    throw new Error('Canary manifest exceeds the maximum allowed size.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    throw new Error('Canary manifest is not valid JSON.')
  }
  if (hasDuplicateTopLevelKey(content)) {
    throw new Error('Canary manifest contains a duplicate top-level member.')
  }
  return validateManifest(parsed)
}
