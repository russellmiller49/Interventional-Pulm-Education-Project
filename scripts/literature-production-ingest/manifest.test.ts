/** @jest-environment node */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from './canonical'
import {
  CANARY_MANIFEST_SCHEMA_VERSION,
  CANARY_SELECTOR_VERSION,
  DEFAULT_CANARY_SIZE,
  EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
} from './constants'
import { createCanaryManifest, readCanaryManifest, validateCanaryMixture } from './manifest'
import type { CanaryCandidate, CanaryManifestBody } from './types'

const SYNTHETIC_PMID_BASE = 900_000_000_000

function syntheticCandidates(): CanaryCandidate[] {
  return Array.from({ length: EXPECTED_DEVELOPMENT_CANDIDATE_COUNT }, (_, index) => ({
    pmid: String(SYNTHETIC_PMID_BASE + index),
    abstractPresent: index % 4 !== 0,
    publicationYear: 1975 + (index % 50),
    journal: `Synthetic Journal ${index % 7}`,
    publicationTypes:
      index % 3 === 0
        ? ['Synthetic Comparative Study', 'Synthetic Journal Article']
        : [`Synthetic Publication Type ${index % 4}`],
  }))
}

function compareNumericStrings(left: string, right: string): number {
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0)
}

describe('deterministic canary selection', () => {
  it('selects exactly 25 unique numeric sorted PMIDs independent of input order', () => {
    const candidates = syntheticCandidates()
    const forward = createCanaryManifest(candidates, 'synthetic-monday-mvp-seed')
    const reversed = createCanaryManifest([...candidates].reverse(), 'synthetic-monday-mvp-seed')

    expect(forward).toEqual(reversed)
    expect(forward.pmids).toHaveLength(DEFAULT_CANARY_SIZE)
    expect(new Set(forward.pmids).size).toBe(DEFAULT_CANARY_SIZE)
    expect(forward.pmids.every((pmid) => /^[1-9]\d*$/u.test(pmid))).toBe(true)
    expect(forward.pmids).toEqual([...forward.pmids].sort(compareNumericStrings))
  })

  it('covers abstracts, eras, journals, and publication types', () => {
    const candidates = syntheticCandidates()
    const manifest = createCanaryManifest(candidates, 'synthetic-diversity-seed')
    const byPmid = new Map(candidates.map((candidate) => [candidate.pmid, candidate]))
    const selected = manifest.pmids.map((pmid) => {
      const candidate = byPmid.get(pmid)
      if (!candidate) throw new Error('Synthetic selected candidate is missing.')
      return candidate
    })

    const mixture = validateCanaryMixture(selected)
    expect(mixture.abstractPresentCount).toBeGreaterThan(0)
    expect(mixture.abstractAbsentCount).toBeGreaterThan(0)
    expect(mixture.oldestPublicationYear).toBeLessThan(mixture.newestPublicationYear)
    expect(mixture.journalCount).toBeGreaterThan(1)
    expect(mixture.publicationTypeCount).toBeGreaterThan(1)
  })

  it('requires the exact authorized cohort size and unique candidate PMIDs', () => {
    const candidates = syntheticCandidates()
    expect(() => createCanaryManifest(candidates.slice(1), 'synthetic-seed')).toThrow(
      /exactly 630/u,
    )
    expect(() =>
      createCanaryManifest([...candidates.slice(0, -1), candidates[0]], 'synthetic-seed'),
    ).toThrow(/duplicate PMIDs/u)
  })

  it('rejects review or cohort-membership fields without reflecting their contents', () => {
    const candidates = syntheticCandidates() as Array<CanaryCandidate & Record<string, unknown>>
    candidates[0] = {
      ...candidates[0],
      heldOutMembership: false,
      reviewState: 'synthetic-sensitive-state-that-must-not-appear',
    }
    let message = ''
    try {
      createCanaryManifest(candidates, 'synthetic-seed')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/bibliography-only/u)
    expect(message).not.toContain('synthetic-sensitive-state-that-must-not-appear')
  })

  it('rejects a candidate set that cannot satisfy the diversity contract', () => {
    const homogeneous = syntheticCandidates().map((candidate) => ({
      ...candidate,
      abstractPresent: true,
      publicationYear: 2024,
      journal: 'Only Synthetic Journal',
      publicationTypes: ['Only Synthetic Type'],
    }))
    expect(() => validateCanaryMixture(homogeneous)).toThrow(/with and without abstracts/u)
    expect(() => createCanaryManifest(homogeneous, 'synthetic-seed')).toThrow(
      /with and without abstracts/u,
    )
  })

  it('binds the checksum to the canonical manifest body', () => {
    const manifest = createCanaryManifest(syntheticCandidates(), 'synthetic-checksum-seed')
    const { manifestChecksum, ...body } = manifest
    expect(manifestChecksum).toBe(sha256(canonicalJson(body)))
  })
})

describe('canary manifest validation', () => {
  let temporaryDirectory = ''

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'literature-canary-manifest-'))
  })

  afterEach(async () => {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
  })

  async function writeManifest(value: unknown): Promise<string> {
    const path = join(temporaryDirectory, 'canary-manifest.json')
    await writeFile(path, JSON.stringify(value), 'utf8')
    return path
  }

  it('reads a checksum-valid generated manifest', async () => {
    const manifest = createCanaryManifest(syntheticCandidates(), 'synthetic-read-seed')
    await expect(readCanaryManifest(await writeManifest(manifest))).resolves.toEqual(manifest)
  })

  it.each([
    ['non-numeric', (pmids: string[]) => ['not-numeric', ...pmids.slice(1)]],
    ['duplicate', (pmids: string[]) => [pmids[0], pmids[0], ...pmids.slice(2)]],
    ['unsorted', (pmids: string[]) => [pmids[1], pmids[0], ...pmids.slice(2)]],
    ['wrong size', (pmids: string[]) => pmids.slice(1)],
  ])('rejects a %s PMID manifest', async (_label, mutate) => {
    const manifest = createCanaryManifest(syntheticCandidates(), 'synthetic-invalid-seed')
    await expect(
      readCanaryManifest(await writeManifest({ ...manifest, pmids: mutate(manifest.pmids) })),
    ).rejects.toThrow()
  })

  it('rejects checksum drift and extra non-bibliographic fields', async () => {
    const manifest = createCanaryManifest(syntheticCandidates(), 'synthetic-drift-seed')
    await expect(
      readCanaryManifest(await writeManifest({ ...manifest, manifestChecksum: '0'.repeat(64) })),
    ).rejects.toThrow(/checksum/u)
    await expect(
      readCanaryManifest(await writeManifest({ ...manifest, reviewState: 'synthetic-only' })),
    ).rejects.toThrow(/non-bibliographic shape/u)
  })

  it('rejects a duplicate top-level member even when JSON.parse would keep a valid last value', async () => {
    const manifest = createCanaryManifest(syntheticCandidates(), 'synthetic-duplicate-key-seed')
    const serialized = JSON.stringify(manifest)
    const syntheticHiddenValue = '999999999999999'
    const path = join(temporaryDirectory, 'duplicate-member.json')
    await writeFile(path, `{"pmids":["${syntheticHiddenValue}"],${serialized.slice(1)}`, 'utf8')

    await expect(readCanaryManifest(path)).rejects.toThrow(/duplicate top-level member/u)
    try {
      await readCanaryManifest(path)
    } catch (error) {
      expect(String(error)).not.toContain(syntheticHiddenValue)
    }
  })

  it('rejects a correctly checksummed manifest with a non-current selector contract', async () => {
    const generated = createCanaryManifest(syntheticCandidates(), 'synthetic-version-seed')
    const body = {
      schemaVersion: CANARY_MANIFEST_SCHEMA_VERSION,
      selectorVersion: `${CANARY_SELECTOR_VERSION}-not-current`,
      selectorSeed: generated.selectorSeed,
      sourceAuthority: generated.sourceAuthority,
      size: generated.size,
      pmids: generated.pmids,
    }
    await expect(
      readCanaryManifest(
        await writeManifest({ ...body, manifestChecksum: sha256(canonicalJson(body)) }),
      ),
    ).rejects.toThrow(/selector version/u)
  })

  it('rejects malformed JSON without echoing its contents', async () => {
    const path = join(temporaryDirectory, 'malformed.json')
    const sensitiveSyntheticText = 'synthetic-sensitive-text-that-must-not-appear'
    await writeFile(path, `{${sensitiveSyntheticText}`, 'utf8')
    await expect(readCanaryManifest(path)).rejects.toThrow('Canary manifest is not valid JSON.')
    try {
      await readCanaryManifest(path)
    } catch (error) {
      expect(String(error)).not.toContain(sensitiveSyntheticText)
    }
  })

  it('documents the exact manifest body compile-time contract', () => {
    const body: CanaryManifestBody = {
      schemaVersion: CANARY_MANIFEST_SCHEMA_VERSION,
      selectorVersion: CANARY_SELECTOR_VERSION,
      selectorSeed: 'synthetic-contract-seed',
      sourceAuthority: 'owner-authorized-development-cohort-630',
      size: DEFAULT_CANARY_SIZE,
      pmids: createCanaryManifest(syntheticCandidates(), 'synthetic-contract-seed').pmids,
    }
    expect(body.pmids).toHaveLength(DEFAULT_CANARY_SIZE)
  })
})
