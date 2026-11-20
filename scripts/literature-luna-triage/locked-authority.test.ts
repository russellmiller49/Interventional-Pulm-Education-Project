/** @jest-environment node */
import { chmod, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runLunaTriageCli } from './cli'
import {
  LUNA_DEVELOPMENT_COHORT_SIZE,
  LUNA_LOCKED_SANITY_COHORT_SIZE,
  LUNA_SPLIT_SEED,
  LUNA_SPLIT_VERSION,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
} from './constants'
import { syntheticCorpusRecord, syntheticPmid } from './fixtures'
import {
  LockedAuthorityError,
  assertFullCorpusExceptionCount,
  validateStoredLockedAuthority,
} from './locked-authority'
import { appendJsonlRows, createOperation, operationPaths } from './operation'
import { buildPacket, type OperationSalt } from './packet'
import { buildSplitManifest } from './split'
import { ensureStateDirectory, exclusiveWriteFile, resolveStateRoot } from './state'

/**
 * Locked-membership authority must fail **closed**.
 *
 * The reproduction this suite pins: a synthetic locked member was relabelled into a
 * `development-430` operation and the stored locked-sanity authority was made malformed. The
 * previous implementation caught the resulting error and *continued*, so `prepare-requests`
 * went on to write model-request material for an operation whose membership had never been
 * established. An inability to establish locked membership is not permission to proceed.
 *
 * Every case below therefore asserts two things: the command refused, and no operation
 * artifact — request journal, request manifest, shard, plan, or estimate — was created.
 */

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '7'.repeat(64),
}

let root: string
let stateDir: string
let writeSpy: jest.SpyInstance

beforeAll(() => {
  writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((() => true) as never)
})

afterAll(() => {
  writeSpy.mockRestore()
})

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-locked-'))
  stateDir = join(root, 'lane')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const LOCKED = Array.from({ length: LUNA_LOCKED_SANITY_COHORT_SIZE }, (_unused, index) =>
  syntheticPmid(index + 1),
).sort()
const DEVELOPMENT = Array.from({ length: LUNA_DEVELOPMENT_COHORT_SIZE }, (_unused, index) =>
  syntheticPmid(index + 1_000),
).sort()

function manifestFor(development: readonly string[], lockedSanity: readonly string[]): unknown {
  return buildSplitManifest({
    version: LUNA_SPLIT_VERSION,
    seed: LUNA_SPLIT_SEED,
    developmentPmids: [...development].sort(),
    lockedSanityPmids: [...lockedSanity].sort(),
    strata: [],
  })
}

interface SeedOverrides {
  readonly lockedText?: string
  readonly developmentText?: string
  readonly manifestText?: string
}

async function seedSplit(
  state: Awaited<ReturnType<typeof resolveStateRoot>>,
  overrides: SeedOverrides = {},
): Promise<void> {
  await ensureStateDirectory(state, 'split')
  await exclusiveWriteFile(
    join(state.root, 'split', 'locked-sanity-pmids.json'),
    overrides.lockedText ?? `${JSON.stringify(LOCKED)}\n`,
  )
  await exclusiveWriteFile(
    join(state.root, 'split', 'development-pmids.json'),
    overrides.developmentText ?? `${JSON.stringify(DEVELOPMENT)}\n`,
  )
  await exclusiveWriteFile(
    join(state.root, 'split', 'split-manifest.json'),
    overrides.manifestText ?? `${JSON.stringify(manifestFor(DEVELOPMENT, LOCKED))}\n`,
  )
}

/** A `development-430`-labelled operation holding exactly the identities it is handed. */
async function relabelledOperation(
  state: Awaited<ReturnType<typeof resolveStateRoot>>,
  operationId: string,
  pmids: readonly string[],
): Promise<void> {
  const paths = await createOperation(state, operationId, 'development-430', 'test', 'now')
  const built = pmids.map((pmid) => buildPacket(SALT, syntheticCorpusRecord(pmid)))
  await appendJsonlRows(
    paths.packetsJsonl,
    built.map((item) => item.packet),
  )
  await appendJsonlRows(
    paths.mappingJsonl,
    built.map((item) => item.mapping),
  )
}

/** Nothing a preparation command would emit may exist after a refusal. */
async function expectNothingPrepared(
  state: Awaited<ReturnType<typeof resolveStateRoot>>,
  operationId: string,
): Promise<void> {
  const paths = operationPaths(state, operationId)
  await expect(readFile(paths.requestsJsonl, 'utf8')).rejects.toThrow()
  await expect(readFile(paths.requestManifestJson, 'utf8')).rejects.toThrow()
  expect(await readdir(paths.batchShardsDir)).toHaveLength(0)
}

const PREPARATION_COMMANDS = ['prepare-requests', 'estimate', 'batch-prepare'] as const

describe('a selected cohort cannot be prepared without a valid locked authority', () => {
  it.each(PREPARATION_COMMANDS)(
    '%s refuses when no split authority exists at all',
    async (command) => {
      const state = await resolveStateRoot(stateDir)
      const operationId = `op-missing-${command}`
      await relabelledOperation(state, operationId, [syntheticPmid(9_001)])
      await expect(
        runLunaTriageCli([command, '--state-dir', stateDir, '--operation', operationId]),
      ).rejects.toThrow(LockedAuthorityError)
      await expectNothingPrepared(state, operationId)
    },
  )

  it.each(PREPARATION_COMMANDS)('%s refuses a malformed authority file', async (command) => {
    const state = await resolveStateRoot(stateDir)
    await seedSplit(state, { lockedText: '{ this is not json\n' })
    const operationId = `op-malformed-${command}`
    await relabelledOperation(state, operationId, [syntheticPmid(9_002)])
    await expect(
      runLunaTriageCli([command, '--state-dir', stateDir, '--operation', operationId]),
    ).rejects.toThrow(LockedAuthorityError)
    await expectNothingPrepared(state, operationId)
  })

  it('refuses a truncated 199-identity authority', async () => {
    const state = await resolveStateRoot(stateDir)
    const truncated = LOCKED.slice(0, LUNA_LOCKED_SANITY_COHORT_SIZE - 1)
    await seedSplit(state, {
      lockedText: `${JSON.stringify(truncated)}\n`,
      manifestText: `${JSON.stringify(manifestFor(DEVELOPMENT, truncated))}\n`,
    })
    await relabelledOperation(state, 'op-truncated', [syntheticPmid(9_003)])
    await expect(
      runLunaTriageCli([
        'prepare-requests',
        '--state-dir',
        stateDir,
        '--operation',
        'op-truncated',
      ]),
    ).rejects.toThrow(/199 identities, not 200/u)
    await expectNothingPrepared(state, 'op-truncated')
  })

  it('refuses a 201-identity authority', async () => {
    const state = await resolveStateRoot(stateDir)
    const extended = [...LOCKED, syntheticPmid(9_500)].sort()
    await seedSplit(state, {
      lockedText: `${JSON.stringify(extended)}\n`,
      manifestText: `${JSON.stringify(manifestFor(DEVELOPMENT, extended))}\n`,
    })
    await relabelledOperation(state, 'op-extended', [syntheticPmid(9_004)])
    await expect(
      runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', 'op-extended']),
    ).rejects.toThrow(/201 identities, not 200/u)
    await expectNothingPrepared(state, 'op-extended')
  })

  it('refuses a duplicate locked identity even at the exact count', async () => {
    const state = await resolveStateRoot(stateDir)
    const duplicated = [...LOCKED.slice(0, LUNA_LOCKED_SANITY_COHORT_SIZE - 1), LOCKED[0]].sort()
    expect(duplicated).toHaveLength(LUNA_LOCKED_SANITY_COHORT_SIZE)
    await seedSplit(state, {
      lockedText: `${JSON.stringify(duplicated)}\n`,
      manifestText: `${JSON.stringify(manifestFor(DEVELOPMENT, duplicated))}\n`,
    })
    await relabelledOperation(state, 'op-duplicate', [syntheticPmid(9_005)])
    await expect(
      runLunaTriageCli([
        'prepare-requests',
        '--state-dir',
        stateDir,
        '--operation',
        'op-duplicate',
      ]),
    ).rejects.toThrow(/duplicate/iu)
    await expectNothingPrepared(state, 'op-duplicate')
  })

  it('refuses a noncanonically ordered authority', async () => {
    const state = await resolveStateRoot(stateDir)
    const shuffled = [...LOCKED].reverse()
    await seedSplit(state, { lockedText: `${JSON.stringify(shuffled)}\n` })
    await relabelledOperation(state, 'op-unordered', [syntheticPmid(9_006)])
    await expect(
      runLunaTriageCli([
        'prepare-requests',
        '--state-dir',
        stateDir,
        '--operation',
        'op-unordered',
      ]),
    ).rejects.toThrow(/ascending|canonical order/iu)
    await expectNothingPrepared(state, 'op-unordered')
  })

  it('refuses an authority whose declared digest does not match its identities', async () => {
    const state = await resolveStateRoot(stateDir)
    const manifest = manifestFor(DEVELOPMENT, LOCKED) as Record<string, unknown>
    await seedSplit(state, {
      manifestText: `${JSON.stringify({
        ...manifest,
        lockedSanityIdentitySha256: 'f'.repeat(64),
      })}\n`,
    })
    await relabelledOperation(state, 'op-digest', [syntheticPmid(9_007)])
    await expect(
      runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', 'op-digest']),
    ).rejects.toThrow(/digest/iu)
    await expectNothingPrepared(state, 'op-digest')
  })

  it('refuses a symlinked authority file', async () => {
    const state = await resolveStateRoot(stateDir)
    await seedSplit(state)
    const external = join(root, 'external-locked.json')
    await writeFile(external, `${JSON.stringify(LOCKED)}\n`, { mode: 0o600 })
    const lockedPath = join(state.root, 'split', 'locked-sanity-pmids.json')
    await rm(lockedPath)
    await symlink(external, lockedPath)
    await relabelledOperation(state, 'op-symlink', [syntheticPmid(9_008)])
    await expect(
      runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', 'op-symlink']),
    ).rejects.toThrow(/symbolic link/u)
    await expectNothingPrepared(state, 'op-symlink')
  })

  it('refuses an unreadable authority file', async () => {
    const state = await resolveStateRoot(stateDir)
    await seedSplit(state)
    const lockedPath = join(state.root, 'split', 'locked-sanity-pmids.json')
    await chmod(lockedPath, 0o000)
    await relabelledOperation(state, 'op-unreadable', [syntheticPmid(9_009)])
    try {
      await expect(
        runLunaTriageCli([
          'prepare-requests',
          '--state-dir',
          stateDir,
          '--operation',
          'op-unreadable',
        ]),
      ).rejects.toThrow()
      await expectNothingPrepared(state, 'op-unreadable')
    } finally {
      await chmod(lockedPath, 0o600)
    }
  })
})

describe('packets establishes the authority before it creates anything', () => {
  it.each([['development-430'], ['smoke-30'], ['pilot-1000']])(
    'refuses %s with no split authority and leaves no operation directory',
    async (cohort) => {
      const state = await resolveStateRoot(stateDir)
      const operationId = `op-packets-${cohort}`
      const argv = [
        'packets',
        '--state-dir',
        stateDir,
        '--cohort',
        cohort,
        '--operation',
        operationId,
      ]
      // pilot-1000 needs an artifact to exclude the reviewed 630; supplying a path that does
      // not resolve to physician truth still cannot become permission.
      if (cohort === 'pilot-1000') argv.push('--artifact', join(root, 'no-such-artifact.csv'))
      await expect(runLunaTriageCli(argv)).rejects.toThrow()
      // Not merely "no packets": no operation directory, no salt, no manifest.
      await expect(readdir(operationPaths(state, operationId).root)).rejects.toThrow()
    },
  )

  it('refuses a malformed authority before the operation directory exists', async () => {
    const state = await resolveStateRoot(stateDir)
    await seedSplit(state, { lockedText: '[\n' })
    await expect(
      runLunaTriageCli([
        'packets',
        '--state-dir',
        stateDir,
        '--cohort',
        'development-430',
        '--operation',
        'op-packets-malformed',
      ]),
    ).rejects.toThrow(LockedAuthorityError)
    await expect(readdir(operationPaths(state, 'op-packets-malformed').root)).rejects.toThrow()
  })
})

describe('a valid authority answers membership, and only membership', () => {
  it.each(PREPARATION_COMMANDS)(
    '%s refuses a relabelled development cohort holding one locked identity',
    async (command) => {
      const state = await resolveStateRoot(stateDir)
      await seedSplit(state)
      const operationId = `op-smuggled-${command}`
      await relabelledOperation(state, operationId, [DEVELOPMENT[0], LOCKED[7]])
      await expect(
        runLunaTriageCli([command, '--state-dir', stateDir, '--operation', operationId]),
      ).rejects.toThrow(/locked-sanity\s+members/u)
      await expectNothingPrepared(state, operationId)
    },
  )

  it('prepares an operation the valid authority proves free of locked identities', async () => {
    const state = await resolveStateRoot(stateDir)
    await seedSplit(state)
    await relabelledOperation(state, 'op-clean', [DEVELOPMENT[0], DEVELOPMENT[1]])
    await runLunaTriageCli(['prepare-requests', '--state-dir', stateDir, '--operation', 'op-clean'])
    const manifest = JSON.parse(
      await readFile(operationPaths(state, 'op-clean').requestManifestJson, 'utf8'),
    ) as { requestCount: number }
    expect(manifest.requestCount).toBe(2)
  })
})

/**
 * The one documented exception. `full-corpus` is the entire fixed corpus rather than a
 * selection, so it necessarily contains the locked identities and there is no selection to
 * check — but the exception belongs to the *exact* complete corpus, not to any operation that
 * happens to carry the label.
 */
describe('the full-corpus exception is exact', () => {
  it('accepts only the exact complete corpus count', () => {
    expect(() =>
      assertFullCorpusExceptionCount(OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT),
    ).not.toThrow()
    expect(() => assertFullCorpusExceptionCount(OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT - 1)).toThrow(
      LockedAuthorityError,
    )
    expect(() => assertFullCorpusExceptionCount(LUNA_LOCKED_SANITY_COHORT_SIZE)).toThrow(
      LockedAuthorityError,
    )
  })

  it('refuses a full-corpus-labelled operation that is not the whole corpus', async () => {
    const state = await resolveStateRoot(stateDir)
    const paths = await createOperation(state, 'op-fake-full', 'full-corpus', 'test', 'now')
    const built = [LOCKED[0], DEVELOPMENT[0]].map((pmid) =>
      buildPacket(SALT, syntheticCorpusRecord(pmid)),
    )
    await appendJsonlRows(
      paths.packetsJsonl,
      built.map((item) => item.packet),
    )
    await appendJsonlRows(
      paths.mappingJsonl,
      built.map((item) => item.mapping),
    )
    await expect(
      runLunaTriageCli([
        'prepare-requests',
        '--state-dir',
        stateDir,
        '--operation',
        'op-fake-full',
      ]),
    ).rejects.toThrow(LockedAuthorityError)
    await expectNothingPrepared(state, 'op-fake-full')
  })
})

/** The stored-authority validator itself, exercised directly on its exact inputs. */
describe('validateStoredLockedAuthority', () => {
  const lockedText = `${JSON.stringify(LOCKED)}\n`
  const developmentText = `${JSON.stringify(DEVELOPMENT)}\n`
  const manifestText = `${JSON.stringify(manifestFor(DEVELOPMENT, LOCKED))}\n`

  it('accepts the exact canonical stored authority', () => {
    const authority = validateStoredLockedAuthority({ lockedText, developmentText, manifestText })
    expect(authority.lockedSanityPmids.size).toBe(LUNA_LOCKED_SANITY_COHORT_SIZE)
    expect(authority.developmentPmids.size).toBe(LUNA_DEVELOPMENT_COHORT_SIZE)
  })

  it('refuses an identity that is not a string', () => {
    expect(() =>
      validateStoredLockedAuthority({
        lockedText: `${JSON.stringify([...LOCKED.slice(1), 12345])}\n`,
        developmentText,
        manifestText,
      }),
    ).toThrow(LockedAuthorityError)
  })

  it('refuses an authority whose cohorts overlap each other', () => {
    const overlapping = [...DEVELOPMENT.slice(1), LOCKED[0]].sort()
    expect(() =>
      validateStoredLockedAuthority({
        lockedText,
        developmentText: `${JSON.stringify(overlapping)}\n`,
        manifestText: `${JSON.stringify(manifestFor(overlapping, LOCKED))}\n`,
      }),
    ).toThrow(/both stored cohorts|overlap/iu)
  })

  it('refuses a manifest whose own digest was recomputed around edited identities', () => {
    const manifest = manifestFor(DEVELOPMENT, LOCKED) as Record<string, unknown>
    expect(() =>
      validateStoredLockedAuthority({
        lockedText,
        developmentText,
        manifestText: `${JSON.stringify({ ...manifest, manifestSha256: 'a'.repeat(64) })}\n`,
      }),
    ).toThrow(/manifest digest/iu)
  })

  it('refuses a manifest naming another split version or seed', () => {
    const manifest = manifestFor(DEVELOPMENT, LOCKED) as Record<string, unknown>
    expect(() =>
      validateStoredLockedAuthority({
        lockedText,
        developmentText,
        manifestText: `${JSON.stringify({ ...manifest, seed: 'other-seed' })}\n`,
      }),
    ).toThrow(LockedAuthorityError)
  })
})
