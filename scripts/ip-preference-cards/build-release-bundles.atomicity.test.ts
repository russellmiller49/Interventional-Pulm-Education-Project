import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { getReleaseDefinitionSources } from '../../src/features/preference-cards/data/demo-context.server'
import type { ReleaseDefinitionSources } from '../../src/features/preference-cards/domain/release-bundle'

import {
  RELEASE_GENERATION_TARGET_FILENAMES,
  runBuildReleaseBundles,
} from './build-release-bundles'

/**
 * P91-C5b — the release-generation *command* is validation-before-write.
 *
 * `build-release-bundles.test.ts` exercises the pure builder, which cannot prove write
 * ordering: the Codex reproduction planted a sentinel in `resolver-release.json`, poisoned a
 * modifier with `future_unknown_action`, ran the real generator, and found the sentinel
 * overwritten even though the command exited nonzero — `catalog-release.json` and
 * `resolver-release.json` were written before validation ran. These tests run the command
 * against isolated copies of the authoritative directories and assert the contract directly:
 *
 * - the Codex poison through the real orchestration (`runBuildReleaseBundles`, exactly what
 *   `main()` calls) leaves every target file byte-identical and no partial output behind;
 * - an independent failure mode — a mutated frozen definition hash, a blocking validation
 *   message rather than a thrown impact error — does the same through the *literal CLI*,
 *   exit code and all, so the guarantee is not coupled to one failure location;
 * - the literal CLI with valid inputs still writes every artifact, byte-identical to the
 *   canonical committed generation, and a second run changes nothing.
 */

// The in-process poisoned run fails long before anything is formatted, but prettier's CJS
// entry starts a top-level `import("./index.mjs")` that jest's VM cannot service — mocked so
// requiring the command module does not leak that rejection into the test. The subprocess
// runs use the real prettier, which is where formatting actually matters.
jest.mock('prettier', () => ({
  format: async (text: string) => text,
  resolveConfig: async () => ({}),
}))

jest.setTimeout(240_000)

const REPO_GENERATED = path.join(process.cwd(), 'data/ip-preference-cards/generated')
const REPO_SEED = path.join(process.cwd(), 'data/ip-preference-cards/seed')
const REPO_REVIEWED = path.join(process.cwd(), 'data/ip-preference-cards/reviewed')

/** The write-only targets — never read back by the command, safe to delete before a run. */
const WRITE_ONLY_TARGETS = [
  'catalog-release.json',
  'resolver-release.json',
  'product-family-versions.json',
  'release-bundles.json',
  'release-impact-report.json',
] as const

interface Fixture {
  root: string
  generated: string
  seed: string
  reviewed: string
}

const fixtures: string[] = []

function makeFixture(): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), 'ip-cards-release-atomicity-'))
  fixtures.push(root)
  const fixture = {
    root,
    generated: path.join(root, 'generated'),
    seed: path.join(root, 'seed'),
    reviewed: path.join(root, 'reviewed'),
  }
  cpSync(REPO_GENERATED, fixture.generated, { recursive: true })
  cpSync(REPO_SEED, fixture.seed, { recursive: true })
  cpSync(REPO_REVIEWED, fixture.reviewed, { recursive: true })
  return fixture
}

afterAll(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true })
})

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** Distinct sentinel bytes into every target file the command writes. */
function plantSentinels(generated: string): Map<string, string> {
  const planted = new Map<string, string>()
  for (const filename of RELEASE_GENERATION_TARGET_FILENAMES) {
    const file = path.join(generated, filename)
    writeFileSync(file, `SENTINEL ${filename} — a failing run must not overwrite this\n`)
    planted.set(filename, sha256(file))
  }
  return planted
}

function expectSentinelsUntouched(generated: string, planted: Map<string, string>) {
  for (const [filename, digest] of planted) {
    expect(`${filename}:${sha256(path.join(generated, filename))}`).toBe(`${filename}:${digest}`)
  }
}

/** Recursive sorted listing, so "no partial or temporary output" is a single comparison. */
function listing(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' }).sort()
}

/** The literal CLI, exactly as `npm run ip-cards:releases` invokes it, against the fixture. */
function spawnCli(fixture: Fixture) {
  return spawnSync(
    'npx',
    [
      'tsx',
      'scripts/ip-preference-cards/build-release-bundles.ts',
      fixture.generated,
      fixture.seed,
      fixture.reviewed,
    ],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 180_000 },
  )
}

/** The Codex poison: `future_unknown_action` on a modifier the med-thoracoscopy recipe offers. */
function poisonedLoadSources(
  recipeVersionId: string,
  resolverContract: { version: string; implementationHash: string },
): ReleaseDefinitionSources | null {
  const sources = getReleaseDefinitionSources(recipeVersionId, resolverContract)
  if (!sources || recipeVersionId !== 'recipe-med-thoracoscopy-v0-3') return sources
  const offeredCode = sources.recipe.allowedModifierCodes[0]
  expect(offeredCode).toBeDefined()
  return {
    ...sources,
    modifiers: sources.modifiers.map((definition) =>
      definition.code === offeredCode
        ? {
            ...definition,
            actions: [
              ...definition.actions,
              {
                id: 'poisoned-unknown-action',
                modifierCode: definition.code,
                sequence: 9_999,
                actionType: 'future_unknown_action' as never,
                payload: {},
              },
            ],
          }
        : definition,
    ),
  }
}

describe('release generation writes nothing when validation fails', () => {
  it('a poisoned modifier action fails the real orchestration and leaves every target byte-identical', async () => {
    const fixture = makeFixture()
    const planted = plantSentinels(fixture.generated)
    const before = listing(fixture.root)

    // The real command path — main() is exactly this call with argv directories — with the
    // definition sources poisoned the way the Codex reproduction poisoned them.
    await expect(
      runBuildReleaseBundles({
        generatedDirectory: fixture.generated,
        seedDirectory: fixture.seed,
        reviewedDirectory: fixture.reviewed,
        loadSources: poisonedLoadSources,
      }),
    ).rejects.toThrow(
      'Unknown modifier action type "future_unknown_action" in action ' +
        '"poisoned-unknown-action" while building release-impact evidence for modifier',
    )

    expectSentinelsUntouched(fixture.generated, planted)
    expect(listing(fixture.root)).toEqual(before)
  })

  it('a mutated frozen definition hash fails the literal CLI with exit 1 and zero writes', () => {
    const fixture = makeFixture()
    const seedFile = path.join(fixture.seed, 'release-bundles.json')
    const seed = JSON.parse(readFileSync(seedFile, 'utf8')) as {
      releases: Array<{ releaseState: string; definitionHash?: string }>
    }
    const published = seed.releases.find((release) => release.releaseState === 'published')
    expect(published).toBeDefined()
    published!.definitionHash = 'a'.repeat(64)
    writeFileSync(seedFile, JSON.stringify(seed))

    const planted = plantSentinels(fixture.generated)
    const before = listing(fixture.root)

    const run = spawnCli(fixture)

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('release_definition_mutated')
    expectSentinelsUntouched(fixture.generated, planted)
    expect(listing(fixture.root)).toEqual(before)
  })
})

describe('release generation with valid inputs still writes everything', () => {
  it('the literal CLI recreates every artifact canonically and a second run changes nothing', () => {
    const fixture = makeFixture()
    const before = listing(fixture.root)
    // Deleting the write-only targets forces real writes; the read-and-merge ledgers stay
    // pristine so the run reproduces the committed generation rather than a first-run state.
    for (const filename of WRITE_ONLY_TARGETS) {
      unlinkSync(path.join(fixture.generated, filename))
    }

    const first = spawnCli(fixture)
    expect(first.status).toBe(0)
    expect(first.stdout).toContain('retained release bundles')

    // Every target exists again, nothing else appeared, and each one matches the canonical
    // committed generation as a JSON document — the writer's own no-change contract
    // (`writeJsonWhenChanged` compares parsed values, and e.g. the committed
    // release-bundles.json carries a legacy — escape a fresh write serializes as the
    // literal character, byte-different and semantically identical).
    expect(listing(fixture.root)).toEqual(before)
    const firstRun = new Map<string, string>()
    for (const filename of RELEASE_GENERATION_TARGET_FILENAMES) {
      const generatedDocument = JSON.parse(
        readFileSync(path.join(fixture.generated, filename), 'utf8'),
      ) as unknown
      const committedDocument = JSON.parse(
        readFileSync(path.join(REPO_GENERATED, filename), 'utf8'),
      ) as unknown
      expect(generatedDocument).toEqual(committedDocument)
      firstRun.set(filename, sha256(path.join(fixture.generated, filename)))
    }

    const second = spawnCli(fixture)
    expect(second.status).toBe(0)

    for (const [filename, digest] of firstRun) {
      expect(`${filename}:${sha256(path.join(fixture.generated, filename))}`).toBe(
        `${filename}:${digest}`,
      )
    }
    expect(listing(fixture.root)).toEqual(before)
  })
})
