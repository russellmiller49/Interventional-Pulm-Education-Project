import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  prismaflexReviewCandidateDeviceProfile,
  prismaxDraftDeviceProfile,
} from '../../src/features/baxter-crrt/content/deviceProfiles'
import {
  BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
  BAXTER_CRRT_PHASE_8_CONTENT_VERSION,
  BAXTER_CRRT_PILOT_CONTENT_VERSION,
} from '../../src/features/baxter-crrt/content/versions'
import {
  CRRT_ENGINE_VERSION,
  CRRT_SCHEMA_VERSION,
} from '../../src/features/baxter-crrt/engine/initialState'
import {
  assertSafeRepositoryRelativePath,
  buildBaxterCrrtReviewCandidateManifest,
  compareUtf8Bytes,
  sha256Hex,
  verifyBaxterCrrtReviewCandidateManifest,
  type BaxterCrrtCandidateFileDigest,
  type BaxterCrrtCandidateFileMode,
  type BaxterCrrtExternalSourceRecord,
  type BaxterCrrtGitObjectFormat,
  type BaxterCrrtReviewCandidateManifest,
} from './review-candidate-manifest'

interface CliOptions {
  readonly output: null | string
  readonly requireClean: boolean
  readonly sourceDir: null | string
  readonly verify: null | string
}

interface SourceExpectation {
  readonly artifactId: string
  readonly fileName: string
  readonly expectedSha256: string
}

const scriptPath = fileURLToPath(import.meta.url)
const scriptDirectory = dirname(scriptPath)
const repositoryRoot = resolve(scriptDirectory, '../..')

/**
 * Files that can materially affect the CRRT learner/reviewer surfaces, their
 * access, analytics, discoverability, localization boundary, or reproducible
 * build envelope. Git expands directory entries to an explicit manifest list.
 */
export const BAXTER_CRRT_CANDIDATE_PATHS = Object.freeze([
  'contentlayer.config.ts',
  'docs/baxter-crrt',
  'eslint.config.mjs',
  'jest.config.cjs',
  'messages/en.json',
  'messages/es.json',
  'messages/zh-CN.json',
  'next.config.mjs',
  'package-lock.json',
  'package.json',
  'postcss.config.js',
  'scripts/baxter-crrt',
  'scripts/prepare-standalone.mjs',
  'server.js',
  'src/app/[locale]/baxter-crrt',
  'src/app/api/analytics/route.test.ts',
  'src/app/api/analytics/route.ts',
  'src/app/sitemap.baxter-crrt.test.ts',
  'src/app/sitemap.ts',
  'src/components/analytics/SiteUsageTracker.test.tsx',
  'src/components/analytics/SiteUsageTracker.tsx',
  'src/features/baxter-crrt',
  'src/i18n/handoff-core.ts',
  'src/i18n/handoff-message-ids.ts',
  'src/i18n/handoff.tsx',
  'src/i18n/path.ts',
  'src/i18n/request.ts',
  'src/i18n/routing.ts',
  'src/lib/analytics.ts',
  'src/lib/baxter-crrt-analytics.ts',
  'src/lib/draft-module-guard.ts',
  'src/lib/draft-modules.baxter-crrt.test.ts',
  'src/lib/draft-modules.ts',
  'src/lib/site-auth/access.test.ts',
  'src/lib/site-auth/access.ts',
  'src/lib/site-search.baxter-crrt.test.ts',
  'src/lib/site-search.ts',
  'src/proxy.ts',
  'tailwind.config.ts',
  'tsconfig.json',
] as const)

export const BAXTER_CRRT_SOURCE_EXPECTATIONS = Object.freeze([
  Object.freeze({
    artifactId: 'PRISMAFLEX-G5036003-R05',
    fileName: '141000459-Prismaflex-user-manual.pdf',
    expectedSha256: '6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b',
  }),
  Object.freeze({
    artifactId: 'PRISMAX-AW8035-REV-B',
    fileName: '708933961-Prismax-Operator-s-Manual.pdf',
    expectedSha256: '204543b8c205e535cb9d45c970b8231362839177f3795b6164edcef3b834f1ff',
  }),
  Object.freeze({
    artifactId: 'PRISMAX-NORDICS-2023-SPEC-SHEET',
    fileName: 'Prismax_Spec-Sheet-2023-NORDICS.pdf',
    expectedSha256: '3265a60a947617a80628549cde84dc9a9d7e10c50d8a8b56be8acb63317b501d',
  }),
  Object.freeze({
    artifactId: 'CRRT-AI-CODING-INSTRUCTIONS',
    fileName: 'CRRT_AI_Coding_Assistant_Instructions.md',
    expectedSha256: '4a4176163e6b5a96d2133a604cc2a1bed4221d1d09d218e1d8c9f17b58d79436',
  }),
] satisfies readonly SourceExpectation[])

const RESERVED_SELF_MANIFEST_PATH = 'docs/baxter-crrt/review-candidate-manifest.generated.json'
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024

function usage(): string {
  return [
    'Usage: npm run crrt:review-candidate -- [options]',
    '',
    'Options:',
    '  --output <path>       Write the manifest to a path outside the repository.',
    '  --source-dir <path>   Verify the four supplied source artifacts in this directory.',
    '  --verify <path>       Verify a recorded manifest against the current checkout.',
    '  --require-clean       Require a fully clean committed tree and verified sources.',
    '  --help                Show this help.',
  ].join('\n')
}

function readOptionValue(args: readonly string[], index: number, label: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${label} requires a value.`)
  return value
}

function parseOptions(args: readonly string[]): CliOptions {
  let output: null | string = null
  let requireClean = false
  let sourceDir: null | string = null
  let verify: null | string = null

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--help') {
      process.stdout.write(`${usage()}\n`)
      process.exit(0)
    }
    if (argument === '--require-clean') {
      requireClean = true
      continue
    }
    if (argument === '--output') {
      output = readOptionValue(args, index, '--output')
      index += 1
      continue
    }
    if (argument === '--source-dir') {
      sourceDir = readOptionValue(args, index, '--source-dir')
      index += 1
      continue
    }
    if (argument === '--verify') {
      verify = readOptionValue(args, index, '--verify')
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  if (output && verify) throw new Error('--output and --verify cannot be used together.')
  if (requireClean && sourceDir === null) {
    throw new Error(
      '--require-clean also requires --source-dir so every external source is verified.',
    )
  }
  return Object.freeze({ output, requireClean, sourceDir, verify })
}

function gitBytes(args: readonly string[]): Buffer {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'buffer',
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function git(args: readonly string[]): string {
  return gitBytes(args).toString('utf8')
}

function literalPathspecs(paths: readonly string[]): readonly string[] {
  return paths.map((path) => `:(literal)${path}`)
}

function isInside(parent: string, child: string): boolean {
  const childRelative = relative(parent, child)
  return childRelative === '' || (!childRelative.startsWith('..') && !childRelative.startsWith('/'))
}

/**
 * A manifest describes the repository snapshot and must not become a new
 * working-tree change immediately after its clean-state check. Resolve the
 * parent as well so an outside-looking path cannot re-enter the repository
 * through a directory symlink.
 */
export function assertManifestOutputOutsideRepository(
  root: string,
  requestedOutputPath: string,
): string {
  const absoluteRoot = realpathSync(resolve(root))
  const outputPath = resolve(requestedOutputPath)
  if (isInside(absoluteRoot, outputPath)) {
    throw new Error('Manifest output must be written outside the repository.')
  }

  let existingAncestor = dirname(outputPath)
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor)
    if (parent === existingAncestor) break
    existingAncestor = parent
  }
  if (isInside(absoluteRoot, realpathSync(existingAncestor))) {
    throw new Error('Manifest output parent must resolve outside the repository.')
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  const realOutputParent = realpathSync(dirname(outputPath))
  if (isInside(absoluteRoot, realOutputParent)) {
    throw new Error('Manifest output parent must resolve outside the repository.')
  }
  return outputPath
}

function assertScopeRoots(): void {
  const realRoot = realpathSync(repositoryRoot)
  for (const path of BAXTER_CRRT_CANDIDATE_PATHS) {
    assertSafeRepositoryRelativePath(path)
    const absolutePath = resolve(repositoryRoot, path)
    if (!isInside(repositoryRoot, absolutePath) || !existsSync(absolutePath)) {
      throw new Error(`Candidate scope root is missing or outside the repository: ${path}`)
    }
    const fileStatus = lstatSync(absolutePath)
    if (fileStatus.isSymbolicLink()) {
      throw new Error(`Candidate scope root must not be a symbolic link: ${path}`)
    }
    if (!fileStatus.isFile() && !fileStatus.isDirectory()) {
      throw new Error(`Candidate scope root must be a regular file or directory: ${path}`)
    }
    if (!isInside(realRoot, realpathSync(absolutePath))) {
      throw new Error(`Candidate scope root resolves outside the repository: ${path}`)
    }
  }
}

function statusEntries(pathspecs: readonly string[] = []): readonly string[] {
  const output = git([
    'status',
    '--porcelain=v1',
    '-z',
    '--no-renames',
    '--untracked-files=all',
    ...(pathspecs.length > 0 ? ['--', ...literalPathspecs(pathspecs)] : []),
  ])
  return Object.freeze(
    output
      .split('\0')
      .filter(Boolean)
      .map((entry) => entry.slice(3))
      .sort(compareUtf8Bytes),
  )
}

function workingTreeCandidateFiles(): readonly string[] {
  const pathspecs = literalPathspecs(BAXTER_CRRT_CANDIDATE_PATHS)
  const deleted = new Set(
    git(['ls-files', '-z', '--deleted', '--', ...pathspecs])
      .split('\0')
      .filter(Boolean),
  )
  const output = git([
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    ...pathspecs,
  ])
  return Object.freeze(
    output
      .split('\0')
      .filter(Boolean)
      .filter((path) => path !== RESERVED_SELF_MANIFEST_PATH && !deleted.has(path))
      .sort(compareUtf8Bytes),
  )
}

function workingTreeMode(mode: number): BaxterCrrtCandidateFileMode {
  return (mode & 0o111) === 0 ? '100644' : '100755'
}

/** Read one provisional candidate file without following symlinks. */
export function digestWorkingTreeCandidateFile(
  root: string,
  path: string,
): BaxterCrrtCandidateFileDigest {
  assertSafeRepositoryRelativePath(path)
  const absoluteRoot = resolve(root)
  const realRoot = realpathSync(absoluteRoot)
  const absolutePath = resolve(absoluteRoot, path)
  if (!isInside(absoluteRoot, absolutePath) || !existsSync(absolutePath)) {
    throw new Error(`Candidate file is missing or outside the repository: ${path}`)
  }

  const fileStatus = lstatSync(absolutePath)
  if (fileStatus.isSymbolicLink()) {
    throw new Error(`Candidate file must not be a symbolic link: ${path}`)
  }
  if (!fileStatus.isFile()) {
    throw new Error(`Candidate path must resolve to a regular file: ${path}`)
  }
  if (!isInside(realRoot, realpathSync(absolutePath))) {
    throw new Error(`Candidate file resolves outside the repository: ${path}`)
  }

  const bytes = readFileSync(absolutePath)
  return Object.freeze({
    path,
    mode: workingTreeMode(fileStatus.mode),
    sha256: sha256Hex(bytes),
    sizeBytes: bytes.byteLength,
  })
}

function digestWorkingTreeCandidateFiles(): readonly BaxterCrrtCandidateFileDigest[] {
  return Object.freeze(
    workingTreeCandidateFiles().map((path) => digestWorkingTreeCandidateFile(repositoryRoot, path)),
  )
}

function digestCommittedCandidateFiles(): readonly BaxterCrrtCandidateFileDigest[] {
  const output = git([
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    'HEAD',
    '--',
    ...literalPathspecs(BAXTER_CRRT_CANDIDATE_PATHS),
  ])
  const files = output
    .split('\0')
    .filter(Boolean)
    .filter((record) => !record.endsWith(`\t${RESERVED_SELF_MANIFEST_PATH}`))
    .map((record): BaxterCrrtCandidateFileDigest => {
      const separator = record.indexOf('\t')
      if (separator < 0) throw new Error(`Unable to parse candidate Git tree record: ${record}`)
      const [mode, type, oid] = record.slice(0, separator).split(' ')
      const path = record.slice(separator + 1)
      assertSafeRepositoryRelativePath(path)
      if (type !== 'blob') {
        throw new Error(`Candidate Git tree entry must be a blob, not ${type}: ${path}`)
      }
      if (mode !== '100644' && mode !== '100755') {
        throw new Error(`Candidate Git tree entry has a forbidden mode ${mode}: ${path}`)
      }
      if (!oid) throw new Error(`Candidate Git tree entry has no object ID: ${path}`)
      const bytes = gitBytes(['cat-file', 'blob', oid])
      return Object.freeze({
        path,
        mode,
        sha256: sha256Hex(bytes),
        sizeBytes: bytes.byteLength,
      })
    })
    .sort((left, right) => compareUtf8Bytes(left.path, right.path))

  return Object.freeze(files)
}

function readStrictRegularFile(path: string, label: string): Buffer {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`)
  const fileStatus = lstatSync(path)
  if (fileStatus.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${path}`)
  if (!fileStatus.isFile()) throw new Error(`${label} must be a regular file: ${path}`)
  return readFileSync(path)
}

function sourceRecords(sourceDir: null | string): readonly BaxterCrrtExternalSourceRecord[] {
  let sourceRoot: null | string = null
  if (sourceDir !== null) {
    const requestedRoot = resolve(sourceDir)
    if (!existsSync(requestedRoot))
      throw new Error(`Supplied source directory is missing: ${requestedRoot}`)
    const sourceStatus = lstatSync(requestedRoot)
    if (sourceStatus.isSymbolicLink()) {
      throw new Error(`Supplied source directory must not be a symbolic link: ${requestedRoot}`)
    }
    if (!sourceStatus.isDirectory()) {
      throw new Error(`Supplied source path must be a directory: ${requestedRoot}`)
    }
    sourceRoot = realpathSync(requestedRoot)
  }

  return Object.freeze(
    BAXTER_CRRT_SOURCE_EXPECTATIONS.map((expectation) => {
      if (sourceRoot === null) {
        return Object.freeze({
          ...expectation,
          actualSha256: null,
          sizeBytes: null,
          verifiedFromSuppliedFile: false,
        })
      }

      const sourcePath = resolve(sourceRoot, expectation.fileName)
      if (!isInside(sourceRoot, sourcePath)) {
        throw new Error(
          `Supplied source artifact resolves outside its directory: ${expectation.fileName}`,
        )
      }
      const bytes = readStrictRegularFile(sourcePath, 'Supplied source artifact')
      const actualSha256 = sha256Hex(bytes)
      if (actualSha256 !== expectation.expectedSha256) {
        throw new Error(
          `Supplied source artifact digest mismatch for ${expectation.artifactId}: ${actualSha256}`,
        )
      }
      return Object.freeze({
        ...expectation,
        actualSha256,
        sizeBytes: bytes.byteLength,
        verifiedFromSuppliedFile: true,
      })
    }),
  )
}

function gitObjectFormat(): BaxterCrrtGitObjectFormat {
  const objectFormat = git(['rev-parse', '--show-object-format']).trim()
  if (objectFormat !== 'sha1' && objectFormat !== 'sha256') {
    throw new Error(`Unsupported Git object format: ${objectFormat}`)
  }
  return objectFormat
}

function createCurrentManifest(sourceDir: null | string): BaxterCrrtReviewCandidateManifest {
  assertScopeRoots()
  if (existsSync(resolve(repositoryRoot, RESERVED_SELF_MANIFEST_PATH))) {
    throw new Error(
      `A generated manifest must not exist inside the candidate scope: ${RESERVED_SELF_MANIFEST_PATH}`,
    )
  }
  const repositoryChanges = statusEntries()
  const candidateScopeChanges = statusEntries(BAXTER_CRRT_CANDIDATE_PATHS)
  const repositoryClean = repositoryChanges.length === 0
  return buildBaxterCrrtReviewCandidateManifest({
    generatedAt: new Date().toISOString(),
    git: {
      branch: git(['branch', '--show-current']).trim() || '(detached)',
      commit: git(['rev-parse', '--verify', 'HEAD^{commit}']).trim(),
      objectFormat: gitObjectFormat(),
      treeOid: git(['rev-parse', '--verify', 'HEAD^{tree}']).trim(),
      repositoryClean,
      candidateScopeClean: candidateScopeChanges.length === 0,
      candidateScopeChanges,
    },
    versions: {
      engine: CRRT_ENGINE_VERSION,
      runtimeSchema: CRRT_SCHEMA_VERSION,
      protectedPilotContent: BAXTER_CRRT_PILOT_CONTENT_VERSION,
      phase7ReviewerContent: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      phase8ReviewerContent: BAXTER_CRRT_PHASE_8_CONTENT_VERSION,
      prismaxProfile: prismaxDraftDeviceProfile.profileVersion,
      prismaflexProfile: prismaflexReviewCandidateDeviceProfile.profileVersion,
      protocolProfile: null,
    },
    sourceArtifacts: sourceRecords(sourceDir),
    files: repositoryClean ? digestCommittedCandidateFiles() : digestWorkingTreeCandidateFiles(),
  })
}

function parseRecordedManifest(path: string): BaxterCrrtReviewCandidateManifest {
  return JSON.parse(
    readStrictRegularFile(resolve(path), 'Recorded manifest').toString('utf8'),
  ) as BaxterCrrtReviewCandidateManifest
}

export function main(args: readonly string[] = process.argv.slice(2)): void {
  const options = parseOptions(args)
  const current = createCurrentManifest(options.sourceDir)

  if (options.requireClean && current.freezeEligibility !== 'eligible-clean-commit') {
    throw new Error(
      'Formal freeze requires a fully clean committed repository. Resolve every current change first.',
    )
  }

  if (options.verify) {
    const recorded = parseRecordedManifest(options.verify)
    const findings = verifyBaxterCrrtReviewCandidateManifest(recorded, current)
    if (findings.length > 0) {
      throw new Error(`Candidate verification failed:\n- ${findings.join('\n- ')}`)
    }
    process.stdout.write(`Verified ${recorded.candidateId}\n`)
    return
  }

  const serialized = `${JSON.stringify(current, null, 2)}\n`
  if (options.output) {
    const outputPath = assertManifestOutputOutsideRepository(repositoryRoot, options.output)
    if (existsSync(outputPath)) {
      const outputStatus = lstatSync(outputPath)
      if (outputStatus.isSymbolicLink() || !outputStatus.isFile()) {
        throw new Error(
          'Existing manifest output must be a regular file, not a symlink or directory.',
        )
      }
    }
    writeFileSync(outputPath, serialized, 'utf8')
    process.stdout.write(
      `Wrote ${outputPath}\nCandidate: ${current.candidateId}\nStatus: ${current.freezeEligibility}\n`,
    )
    return
  }

  process.stdout.write(serialized)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  try {
    main()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
