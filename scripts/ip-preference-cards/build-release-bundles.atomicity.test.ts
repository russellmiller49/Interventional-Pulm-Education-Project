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

import {
  getReleaseDefinitionSources,
  type ReleaseDefinitionSetPins,
} from '../../src/features/preference-cards/data/demo-context.server'
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

/**
 * The write-only targets — never read back by the command, safe to delete or corrupt before
 * a run. Everything else in `RELEASE_GENERATION_TARGET_FILENAMES` is read-and-merge retained
 * history (the four ledgers, the catalog retention pair, and — since definition-set
 * retention — `release-bundles.json` itself, whose recorded whole-set pins are what let a
 * frozen release keep resolving the sets it published with). Deleting a read-and-merge
 * target is destroying retained history, and corrupting one fails the run loudly
 * (`readJsonOrDefault` refuses non-ENOENT read failures), so the failure-mode tests plant
 * sentinels only here and prove the read-and-merge targets untouched by hash instead.
 */
const WRITE_ONLY_TARGETS = [
  'catalog-release.json',
  'resolver-release.json',
  'product-family-versions.json',
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

/**
 * Arm every target for the untouched-after-failure assertion: distinct sentinel bytes into
 * each write-only target (the command never reads them, so even an invalid file proves only
 * that nothing wrote), and a pristine-content hash of each read-and-merge target (which must
 * stay readable for the run to reach the failure under test at all).
 */
function armTargets(generated: string): Map<string, string> {
  const armed = new Map<string, string>()
  for (const filename of WRITE_ONLY_TARGETS) {
    const file = path.join(generated, filename)
    writeFileSync(file, `SENTINEL ${filename} — a failing run must not overwrite this\n`)
  }
  for (const filename of RELEASE_GENERATION_TARGET_FILENAMES) {
    armed.set(filename, sha256(path.join(generated, filename)))
  }
  return armed
}

function expectTargetsUntouched(generated: string, armed: Map<string, string>) {
  for (const [filename, digest] of armed) {
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
  setPins?: ReleaseDefinitionSetPins,
): ReleaseDefinitionSources | null {
  const sources = getReleaseDefinitionSources(recipeVersionId, resolverContract, setPins)
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
    const armed = armTargets(fixture.generated)
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

    expectTargetsUntouched(fixture.generated, armed)
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

    const armed = armTargets(fixture.generated)
    const before = listing(fixture.root)

    const run = spawnCli(fixture)

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('release_definition_mutated')
    expectTargetsUntouched(fixture.generated, armed)
    expect(listing(fixture.root)).toEqual(before)
  })

  it('a retained definition-set payload edited under its recorded hash fails the CLI before any write', () => {
    const fixture = makeFixture()
    const ledgerFile = path.join(fixture.generated, 'definition-set-ledger.json')
    const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8')) as {
      entries: Array<{ definitionSetId: string; definitionHash: string; definition: unknown[] }>
    }
    // The superseded modifier set — the entry historical releases depend on. Content edited,
    // recorded hash left intact: invisible to the content-addressed key, caught by re-hash.
    const entry = ledger.entries.find(
      (candidate) =>
        candidate.definitionSetId === 'definition-set-modifiers' &&
        candidate.definitionHash.startsWith('e3335096'),
    )
    expect(entry).toBeDefined()
    ;(entry!.definition[0] as { label?: string }).label = 'Tampered retained content'
    writeFileSync(ledgerFile, JSON.stringify(ledger))

    const armed = armTargets(fixture.generated)
    const before = listing(fixture.root)

    const run = spawnCli(fixture)

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('definition_set_ledger_entry_mutated')
    expectTargetsUntouched(fixture.generated, armed)
    expect(listing(fixture.root)).toEqual(before)
  })

  it('a missing pinned definition set fails the real orchestration before any write', async () => {
    // A deleted retained entry surfaces at the source loader as a null resolution — the
    // resolver has nothing under the pinned hash and nothing may substitute for it
    // (`createDefinitionSetResolver` pins that null in definition-set-ledger.test.ts). The
    // fixture cannot exercise the deletion end-to-end through the CLI: the resolver reads
    // the repository's committed ledger through a static import, so a copy-directory
    // deletion self-heals from the untouched original. What the command must guarantee is
    // that the null fails the build before any write — proven here through the real
    // orchestration with a loader that answers the superseded modifier-set pin with null.
    const fixture = makeFixture()
    const armed = armTargets(fixture.generated)
    const before = listing(fixture.root)

    await expect(
      runBuildReleaseBundles({
        generatedDirectory: fixture.generated,
        seedDirectory: fixture.seed,
        reviewedDirectory: fixture.reviewed,
        loadSources: (recipeVersionId, resolverContract, setPins) =>
          setPins?.modifierSetHash.startsWith('e3335096')
            ? null
            : getReleaseDefinitionSources(recipeVersionId, resolverContract, setPins),
      }),
    ).rejects.toThrow('pins definitions the generated data no longer supplies')

    expectTargetsUntouched(fixture.generated, armed)
    expect(listing(fixture.root)).toEqual(before)
  })

  it('a corrupted retained recipe pin fails the CLI before any write', () => {
    const fixture = makeFixture()
    const ledgerFile = path.join(fixture.generated, 'composition-ledger.json')
    const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8')) as {
      entries: Array<{ recipeVersionId: string; definition: { allowedModifierCodes: string[] } }>
    }
    // A retained superseded composition — the recipe historical releases resolve through.
    const entry = ledger.entries.find(
      (candidate) => candidate.recipeVersionId === 'recipe-med-thoracoscopy-v0-2',
    )
    expect(entry).toBeDefined()
    entry!.definition.allowedModifierCodes = [...entry!.definition.allowedModifierCodes, 'TAMPERED']
    writeFileSync(ledgerFile, JSON.stringify(ledger))

    const armed = armTargets(fixture.generated)
    const before = listing(fixture.root)

    const run = spawnCli(fixture)

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('composition_ledger_entry_mutated')
    expectTargetsUntouched(fixture.generated, armed)
    expect(listing(fixture.root)).toEqual(before)
  })

  it('a retained record parsed to the wrong shape fails the CLI loudly before any write', () => {
    const fixture = makeFixture()
    // Valid JSON, wrong shape: without the shape guard this degrades to an empty recorded-
    // pin map and every frozen release quietly re-resolves the live sets.
    writeFileSync(path.join(fixture.generated, 'release-bundles.json'), '{}')
    const armed = new Map<string, string>()
    for (const filename of RELEASE_GENERATION_TARGET_FILENAMES) {
      armed.set(filename, sha256(path.join(fixture.generated, filename)))
    }
    const before = listing(fixture.root)

    const run = spawnCli(fixture)

    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('does not carry a bundles array')
    expectTargetsUntouched(fixture.generated, armed)
    expect(listing(fixture.root)).toEqual(before)
  })

  it('a corrupted (unparseable) retained artifact fails the CLI loudly before any write', () => {
    const fixture = makeFixture()
    // Read-and-merge retained history must never silently degrade to "empty and rebuilt":
    // an unreadable ledger is corruption, and the run refuses it rather than converting it
    // into a cascade of misleading retention errors — or a quietly regenerated file.
    writeFileSync(
      path.join(fixture.generated, 'release-bundles.json'),
      'NOT JSON — corrupted retained record\n',
    )
    const armed = new Map<string, string>()
    for (const filename of RELEASE_GENERATION_TARGET_FILENAMES) {
      armed.set(filename, sha256(path.join(fixture.generated, filename)))
    }
    const before = listing(fixture.root)

    const run = spawnCli(fixture)

    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('exists but could not be read as JSON')
    expectTargetsUntouched(fixture.generated, armed)
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
