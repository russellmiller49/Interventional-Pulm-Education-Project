import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_DEVELOPMENT_COHORT_SIZE,
  LUNA_LOCKED_SANITY_COHORT_SIZE,
  LUNA_SPLIT_SEED,
  LUNA_SPLIT_VERSION,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_EXPECTED_RECORD_COUNT,
} from './constants'
import { sortedIdentityDigest } from './split'
import { readRegularFile, resolveInsideRoot, type StateRoot } from './state'

/**
 * Establishing locked membership, and refusing when it cannot be established.
 *
 * The locked 200 have no executable pathway in this release. Every selected-cohort preparation
 * path therefore has to answer one question before it creates anything: *are any of these
 * records locked?* The only acceptable answers are "no, and here is the exact canonical
 * authority that proves it" and a refusal. There is no third answer.
 *
 * That is what this module exists to enforce. A missing, malformed, truncated, over-long,
 * duplicated, misordered, digest-mismatched, symlinked, or unreadable authority all resolve
 * the same way — a `LockedAuthorityError` — because every one of them is an *inability to
 * establish membership*, and an inability to establish membership is not permission. Absence
 * is reported as a distinguishable typed result so a caller can say something useful about it,
 * but no caller may treat it as clearance.
 *
 * The stored artifacts are a cache, never an authority over themselves: their identities are
 * re-counted, re-deduplicated, re-ordered, and re-digested here, and the manifest sitting
 * beside them has to agree with what those identities actually hash to. When physician truth
 * is in reach the caller layers `assertStoredSplitIsCanonical` on top, which is strictly
 * stronger still — it proves the stored 200 are *the* canonical 200 rather than merely a
 * self-consistent 200.
 */

export class LockedAuthorityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockedAuthorityError'
  }
}

function refuse(message: string): never {
  throw new LockedAuthorityError(message)
}

export interface StoredLockedAuthority {
  readonly lockedSanityPmids: ReadonlySet<string>
  readonly developmentPmids: ReadonlySet<string>
}

/** Present-and-valid, or absent. Never "present but unproven". */
export type LockedAuthorityResolution =
  | { readonly status: 'authority'; readonly authority: StoredLockedAuthority }
  | { readonly status: 'absent'; readonly reason: string }

export interface StoredLockedAuthorityText {
  readonly lockedText: string
  readonly developmentText: string
  readonly manifestText: string
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return refuse(`The stored ${label} is not valid JSON; refusing to establish membership.`)
  }
}

/** An identity list must be an array of non-empty strings, unique, in canonical order. */
function parseIdentityList(value: unknown, label: string, expected: number): string[] {
  if (!Array.isArray(value)) {
    refuse(`The stored ${label} is not an identity list; refusing to establish membership.`)
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) {
      refuse(`The stored ${label} holds an identity that is not a string.`)
    }
  }
  const identities = value as string[]
  if (identities.length !== expected) {
    refuse(`The stored ${label} holds ${identities.length} identities, not ${expected}.`)
  }
  if (new Set(identities).size !== identities.length) {
    refuse(`The stored ${label} contains a duplicate identity.`)
  }
  for (let index = 1; index < identities.length; index += 1) {
    if (!(identities[index - 1] < identities[index])) {
      refuse(
        `The stored ${label} is not in canonical ascending order, so it is not the artifact ` +
          'this lane writes.',
      )
    }
  }
  return identities
}

function requireDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    refuse(`The stored split manifest has no ${label}.`)
  }
  return value
}

/**
 * Validate a stored split authority from its exact bytes.
 *
 * Pure, so the whole refusal surface is testable without a filesystem. Nothing here consults
 * the manifest's declared identity counts as authority: the counts are re-derived from the
 * identity lists and the manifest is required to agree with them.
 */
export function validateStoredLockedAuthority(
  text: StoredLockedAuthorityText,
): StoredLockedAuthority {
  const lockedSanity = parseIdentityList(
    parseJson(text.lockedText, 'locked-sanity authority'),
    'locked-sanity authority',
    LUNA_LOCKED_SANITY_COHORT_SIZE,
  )
  const development = parseIdentityList(
    parseJson(text.developmentText, 'development authority'),
    'development authority',
    LUNA_DEVELOPMENT_COHORT_SIZE,
  )
  const lockedSet = new Set(lockedSanity)
  const developmentSet = new Set(development)
  for (const pmid of lockedSet) {
    if (developmentSet.has(pmid)) {
      refuse('An identity appears in both stored cohorts; the stored split overlaps itself.')
    }
  }
  if (lockedSet.size + developmentSet.size !== OVERLAY_EXPECTED_RECORD_COUNT) {
    refuse(
      `The stored split covers ${lockedSet.size + developmentSet.size} identities, not the ` +
        `reviewed ${OVERLAY_EXPECTED_RECORD_COUNT}.`,
    )
  }

  const parsedManifest = parseJson(text.manifestText, 'split manifest')
  if (!parsedManifest || typeof parsedManifest !== 'object' || Array.isArray(parsedManifest)) {
    refuse('The stored split manifest is not a JSON object.')
  }
  const manifest = parsedManifest as Record<string, unknown>
  if (manifest.version !== LUNA_SPLIT_VERSION || manifest.seed !== LUNA_SPLIT_SEED) {
    refuse('The stored split manifest names another split version or seed.')
  }
  if (
    manifest.lockedSanityCount !== lockedSanity.length ||
    manifest.developmentCount !== development.length ||
    manifest.totalRecords !== OVERLAY_EXPECTED_RECORD_COUNT
  ) {
    refuse('The stored split manifest declares counts the stored identity lists do not hold.')
  }
  const lockedDigest = sortedIdentityDigest(lockedSanity)
  const developmentDigest = sortedIdentityDigest(development)
  if (requireDigest(manifest.lockedSanityIdentitySha256, 'locked-sanity digest') !== lockedDigest) {
    refuse(
      'The stored split manifest declares a locked-sanity identity digest the stored ' +
        'identities do not hash to.',
    )
  }
  if (
    requireDigest(manifest.developmentIdentitySha256, 'development digest') !== developmentDigest
  ) {
    refuse(
      'The stored split manifest declares a development identity digest the stored identities ' +
        'do not hash to.',
    )
  }
  // The manifest digest is recomputed over the *recomputed* identity digests, so a manifest
  // edited around edited identities cannot certify itself.
  const recomputedManifestSha256 = sha256(
    canonicalJson({
      version: manifest.version,
      seed: manifest.seed,
      totalRecords: manifest.totalRecords,
      developmentCount: manifest.developmentCount,
      lockedSanityCount: manifest.lockedSanityCount,
      strata: manifest.strata,
      developmentIdentitySha256: developmentDigest,
      lockedSanityIdentitySha256: lockedDigest,
    }),
  )
  if (requireDigest(manifest.manifestSha256, 'manifest digest') !== recomputedManifestSha256) {
    refuse('The stored split manifest digest does not match the manifest it sits in.')
  }
  return { lockedSanityPmids: lockedSet, developmentPmids: developmentSet }
}

function isFileNotFound(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

interface OptionalRead {
  readonly present: boolean
  readonly text: string
}

/**
 * Read one authority artifact with the state root's containment proof.
 *
 * Only "the file is not there" is optional. A symlinked component, an external target, a
 * permission failure, or anything else propagates: those are reasons membership could not be
 * established, and this module never converts one into an answer.
 */
async function readAuthorityFile(state: StateRoot, name: string): Promise<OptionalRead> {
  const path = resolveInsideRoot(state, 'split', name)
  try {
    return { present: true, text: await readRegularFile(path, state) }
  } catch (error) {
    if (isFileNotFound(error)) return { present: false, text: '' }
    throw error
  }
}

/**
 * Resolve the stored locked authority, distinguishing "no split has been built here" from
 * "a split is here and it is not trustworthy". Partial presence is the second kind.
 */
export async function readStoredLockedAuthority(
  state: StateRoot,
): Promise<LockedAuthorityResolution> {
  const locked = await readAuthorityFile(state, 'locked-sanity-pmids.json')
  const development = await readAuthorityFile(state, 'development-pmids.json')
  const manifest = await readAuthorityFile(state, 'split-manifest.json')
  const present = [locked, development, manifest].filter((read) => read.present).length
  if (present === 0) {
    return {
      status: 'absent',
      reason:
        'No split artifacts exist in this state directory, so locked membership cannot be ' +
        'established.',
    }
  }
  if (present < 3) {
    refuse(
      'The stored split authority is incomplete: some of its three artifacts are missing. A ' +
        'partial authority cannot establish locked membership.',
    )
  }
  return {
    status: 'authority',
    authority: validateStoredLockedAuthority({
      lockedText: locked.text,
      developmentText: development.text,
      manifestText: manifest.text,
    }),
  }
}

/**
 * The stored authority or a refusal. Absence is reported with the operator action that fixes
 * it — never converted into "no overlap".
 */
export async function requireStoredLockedAuthority(
  state: StateRoot,
): Promise<StoredLockedAuthority> {
  const resolution = await readStoredLockedAuthority(state)
  if (resolution.status === 'absent') {
    refuse(
      `${resolution.reason} Run \`split --artifact <path>\` first, or pass --artifact so the ` +
        'canonical split is recomputed from physician truth.',
    )
  }
  return resolution.authority
}

/** A membership set is only allowed to answer questions at the exact locked size. */
export function assertExactLockedAuthority(lockedSanityPmids: ReadonlySet<string>): void {
  if (lockedSanityPmids.size !== LUNA_LOCKED_SANITY_COHORT_SIZE) {
    refuse(
      `The locked-sanity authority holds ${lockedSanityPmids.size} identities, not ` +
        `${LUNA_LOCKED_SANITY_COHORT_SIZE}; refusing to check membership against it.`,
    )
  }
}

/**
 * The one documented exception to the membership check.
 *
 * `full-corpus` is the entire fixed corpus rather than a selection, so it necessarily contains
 * the locked identities and there is no selection to check. The exception belongs to the exact
 * complete corpus and to nothing else: an operation that merely carries the label, with any
 * other record count, is a selection wearing the exception's name and is refused. Nothing in
 * this release can send a full-corpus operation either way.
 */
export function assertFullCorpusExceptionCount(distinctRecordCount: number): void {
  if (distinctRecordCount !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) {
    refuse(
      `A full-corpus operation must hold the exact complete corpus of ` +
        `${OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT} records; this one holds ` +
        `${distinctRecordCount}. The full-corpus exception does not extend to a selection.`,
    )
  }
}
