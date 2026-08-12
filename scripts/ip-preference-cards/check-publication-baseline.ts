import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  buildPublicationBaselineSnapshot,
  comparePublicationBaseline,
  type PublicationArtifacts,
  type PublicationBaselineSnapshot,
} from '../../src/features/preference-cards/domain/publication-baseline'

const run = promisify(execFile)

/**
 * The append-only publication check, run against the protected base branch.
 *
 * Every other guard in this feature checks a commit against itself. `validateReleaseBundles`
 * recomputes each frozen hash from the definitions in the same tree; `validateModuleLedger` does
 * the same for module versions. Both are real, and both share one hole: a developer can edit a
 * published definition **and** update the frozen hash beside it in the same commit. Local
 * recomputation then agrees with itself, CI is green, and the only trace is a diff nobody read.
 *
 * Self-consistency cannot detect a consistent rewrite. This is the second copy.
 *
 * ```
 *   npm run ip-cards:release:check-base
 *   npm run ip-cards:release:check-base -- --base origin/main
 *   npm run ip-cards:release:check-base -- --fixture path/to/fixture
 * ```
 *
 * ## The default, and why a missing remote is not a pass
 *
 * The base defaults to `origin/main`, and the comparison runs against the merge base rather than
 * the branch tip, so a branch that is simply behind `main` is not accused of removing everything
 * published since it was cut.
 *
 * When the base ref cannot be resolved — no remote, a shallow clone, a fresh CI checkout that
 * never fetched — this exits non-zero and says so. A check that silently passes when it cannot
 * look is worse than no check: it is a green tick that means "I did not verify anything", and the
 * one commit it would wave through is the one that rewrote a published release on a machine with
 * no remote configured.
 *
 * ## The pre-publication window
 *
 * An id absent from the protected base is reported as **new**, never as a violation. That is the
 * state the current sixteen release bundles are in — frozen on a feature branch, never merged, so
 * no card can be pinned to them and re-freezing them is legitimate. The moment they land in
 * `main`, the same act becomes `publication_definition_mutated`.
 */

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const DEFAULT_BASE = 'origin/main'

/** The artifacts the projection reads, relative to the generated directory. */
const ARTIFACT_FILES = {
  releaseBundles: 'release-bundles.json',
  moduleLedger: 'module-ledger.json',
  compositionLedger: 'composition-ledger.json',
  definitionSetLedger: 'definition-set-ledger.json',
  catalogReleases: 'catalog-release-manifests.json',
  productFamilies: 'product-family-versions.json',
} as const

interface Options {
  base: string
  fixture: string | null
  generatedDirectory: string
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    base: process.env.IP_CARDS_PROTECTED_BASE || DEFAULT_BASE,
    fixture: null,
    generatedDirectory: GENERATED_DIRECTORY,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--base') {
      const value = argv[index + 1]
      if (!value) throw new Error('`--base` needs a git ref, for example `--base origin/main`.')
      options.base = value
      index += 1
    } else if (argument.startsWith('--base=')) {
      options.base = argument.slice('--base='.length)
    } else if (argument === '--fixture') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(
          '`--fixture` needs a directory containing `base/` and `head/` artifact folders.',
        )
      }
      options.fixture = value
      index += 1
    } else if (argument.startsWith('--fixture=')) {
      options.fixture = argument.slice('--fixture='.length)
    } else if (argument.startsWith('--generated=')) {
      options.generatedDirectory = argument.slice('--generated='.length)
    }
  }
  return options
}

function parseArtifacts(files: Record<keyof typeof ARTIFACT_FILES, string | null>) {
  const parse = <T>(contents: string | null): T | null =>
    contents === null ? null : (JSON.parse(contents) as T)
  return {
    releaseBundles: parse(files.releaseBundles),
    moduleLedger: parse(files.moduleLedger),
    compositionLedger: parse(files.compositionLedger),
    definitionSetLedger: parse(files.definitionSetLedger),
    catalogReleases: parse(files.catalogReleases),
    productFamilies: parse(files.productFamilies),
  } as PublicationArtifacts
}

async function readWorkingTreeArtifacts(generatedDirectory: string) {
  const read = async (filename: string) => {
    try {
      return await readFile(path.join(generatedDirectory, filename), 'utf8')
    } catch {
      // A generated artifact this checkout does not produce is "nothing published here", which is
      // exactly what a null means to the projection. Distinct from an unreadable *ref*, which is
      // fatal and handled separately.
      return null
    }
  }
  return parseArtifacts({
    releaseBundles: await read(ARTIFACT_FILES.releaseBundles),
    moduleLedger: await read(ARTIFACT_FILES.moduleLedger),
    compositionLedger: await read(ARTIFACT_FILES.compositionLedger),
    definitionSetLedger: await read(ARTIFACT_FILES.definitionSetLedger),
    catalogReleases: await read(ARTIFACT_FILES.catalogReleases),
    productFamilies: await read(ARTIFACT_FILES.productFamilies),
  })
}

async function readFixtureArtifacts(directory: string) {
  const read = async (filename: string) => {
    try {
      return await readFile(path.join(directory, filename), 'utf8')
    } catch {
      return null
    }
  }
  return parseArtifacts({
    releaseBundles: await read(ARTIFACT_FILES.releaseBundles),
    moduleLedger: await read(ARTIFACT_FILES.moduleLedger),
    compositionLedger: await read(ARTIFACT_FILES.compositionLedger),
    definitionSetLedger: await read(ARTIFACT_FILES.definitionSetLedger),
    catalogReleases: await read(ARTIFACT_FILES.catalogReleases),
    productFamilies: await read(ARTIFACT_FILES.productFamilies),
  })
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

export class MissingBaseError extends Error {}

/**
 * The commit to compare against: the merge base of the protected branch and HEAD.
 *
 * Throws rather than falling back. Every fallback available here is a lie of a different shape —
 * comparing against nothing passes everything, comparing against HEAD passes everything, and
 * comparing against a stale local `main` passes whatever was published in between.
 */
async function resolveBaseCommit(base: string): Promise<string> {
  try {
    await git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`])
  } catch {
    throw new MissingBaseError(
      `Cannot resolve the protected base "${base}". Fetch it (\`git fetch origin main\`), name a different one with \`--base\`, or run against fixtures with \`--fixture\`. This check does not pass when it cannot see what was published.`,
    )
  }
  try {
    return (await git(['merge-base', base, 'HEAD'])).trim()
  } catch {
    throw new MissingBaseError(
      `"${base}" and HEAD have no common ancestor, so there is no baseline to compare against. In a shallow clone, deepen it with \`git fetch --unshallow\`.`,
    )
  }
}

async function readArtifactsAtCommit(commit: string, generatedDirectory: string) {
  const read = async (filename: string) => {
    try {
      return await git(['show', `${commit}:${path.posix.join(generatedDirectory, filename)}`])
    } catch {
      // The artifact did not exist at that commit. Every id in the head artifact is then new,
      // which is the correct reading of "this was introduced after the base".
      return null
    }
  }
  return parseArtifacts({
    releaseBundles: await read(ARTIFACT_FILES.releaseBundles),
    moduleLedger: await read(ARTIFACT_FILES.moduleLedger),
    compositionLedger: await read(ARTIFACT_FILES.compositionLedger),
    definitionSetLedger: await read(ARTIFACT_FILES.definitionSetLedger),
    catalogReleases: await read(ARTIFACT_FILES.catalogReleases),
    productFamilies: await read(ARTIFACT_FILES.productFamilies),
  })
}

export interface PublicationBaselineCheck {
  baseLabel: string
  base: PublicationBaselineSnapshot
  head: PublicationBaselineSnapshot
  comparison: ReturnType<typeof comparePublicationBaseline>
}

export async function checkPublicationBaseline(
  options: Options,
): Promise<PublicationBaselineCheck> {
  if (options.fixture) {
    const base = buildPublicationBaselineSnapshot(
      await readFixtureArtifacts(path.join(options.fixture, 'base')),
    )
    const head = buildPublicationBaselineSnapshot(
      await readFixtureArtifacts(path.join(options.fixture, 'head')),
    )
    return {
      baseLabel: `fixture:${options.fixture}`,
      base,
      head,
      comparison: comparePublicationBaseline({ base, head }),
    }
  }

  const commit = await resolveBaseCommit(options.base)
  const base = buildPublicationBaselineSnapshot(
    await readArtifactsAtCommit(commit, options.generatedDirectory),
  )
  const head = buildPublicationBaselineSnapshot(
    await readWorkingTreeArtifacts(options.generatedDirectory),
  )
  return {
    baseLabel: `${options.base} (merge base ${commit.slice(0, 12)})`,
    base,
    head,
    comparison: comparePublicationBaseline({ base, head }),
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const { baseLabel, base, comparison } = await checkPublicationBaseline(options)

  console.log(`Protected base: ${baseLabel}`)
  console.log(
    `${base.entries.length} published entr(y|ies) in the base; ${comparison.unchanged.length} unchanged, ${comparison.lifecycleAdvanced.length} advanced through the lifecycle, ${comparison.added.length} new on this branch.`,
  )

  if (comparison.added.length > 0) {
    console.log('')
    console.log('New on this branch (not yet published in the protected base):')
    for (const entry of comparison.added) {
      console.log(`  + ${entry.kind.padEnd(24)} ${entry.id}`)
    }
    if (base.entries.length === 0) {
      console.log('')
      console.log(
        '  The protected base publishes none of these yet, so every frozen hash here may still be',
      )
      console.log('  re-derived. Once they merge, changing any of them fails this check instead.')
    }
  }

  if (comparison.lifecycleAdvanced.length > 0) {
    console.log('')
    console.log('Permitted lifecycle transitions:')
    for (const { entry, transitions } of comparison.lifecycleAdvanced) {
      console.log(`  · ${entry.id}: ${transitions.join(', ')}`)
    }
  }

  if (comparison.violations.length > 0) {
    console.log('')
    console.error(`${comparison.violations.length} publication violation(s):`)
    for (const violation of comparison.violations) {
      console.error(`  ✗ ${violation.code}: ${violation.message}`)
    }
    process.exitCode = 1
    return
  }

  console.log('')
  console.log('No published definition was rewritten, removed, or re-pointed.')
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
