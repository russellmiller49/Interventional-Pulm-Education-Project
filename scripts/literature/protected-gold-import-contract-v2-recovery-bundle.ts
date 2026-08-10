import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

import ts from 'typescript'

import { canonicalJson } from './gold-import-compensation-migration-operations'
import {
  buildProtectedV2ModuleResolutionAudit,
  isSafeProtectedV2RepositoryPath,
  validateProtectedV2ModuleResolutionAudit,
  type ProtectedV2ModuleResolutionAudit,
} from './protected-gold-import-contract-v2-module-resolution'
import {
  PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS,
  PROTECTED_V2_PROTECTED_DIRECTORIES,
  PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS,
  PROTECTED_V2_RUNTIME_ENTRY_POINTS,
  PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SHA256,
  PROTECTED_V2_PACKAGE_SCRIPT_DECLARATIONS,
  buildProtectedV2RuntimeInputAudit,
  discoverProtectedV2RuntimeCallSites,
  validateProtectedV2RuntimeInputAudit,
  type ProtectedV2RuntimeInputAudit,
} from './protected-gold-import-contract-v2-runtime-inputs'

export const PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION =
  'literature-gold-protected-v2-operator-bundle/2.0.0' as const

/**
 * Backward-compatible export name. These are explicit configuration/runtime
 * roots, not the old regex import closure. The authorizing boundary also
 * contains every tracked file under PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES.
 */
export const PROTECTED_V2_OPERATOR_BUNDLE_ROOTS = PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS
export const PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES = PROTECTED_V2_PROTECTED_DIRECTORIES

export interface ProtectedV2OperatorBundleFile {
  gitMode: '100644' | '100755'
  path: string
  sha256: string
}

export interface ProtectedV2OperatorBundle {
  aggregateSha256: string
  files: ProtectedV2OperatorBundleFile[]
  moduleResolutionAudit: ProtectedV2ModuleResolutionAudit
  protectedDirectories: string[]
  roots: readonly string[]
  runtimeInputAudit: ProtectedV2RuntimeInputAudit
  schemaVersion: typeof PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION
}

export interface ValidatedProtectedV2OperatorBundle extends ProtectedV2OperatorBundle {
  files: Array<Required<ProtectedV2OperatorBundleFile>>
  moduleResolutionAudit: ProtectedV2ModuleResolutionAudit
  protectedDirectories: string[]
  runtimeInputAudit: ProtectedV2RuntimeInputAudit
}

interface GitTrackedEntry {
  gitMode: string
  objectId: string
  path: string
  stage: string
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

function gitOutput(cwd: string, arguments_: readonly string[]): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      'git',
      [...arguments_],
      { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          rejectPromise(
            new Error(`Protected bundle Git inspection failed: ${stderr.trim() || error.message}`),
          )
          return
        }
        resolvePromise(stdout)
      },
    )
  })
}

async function canonicalRepositoryRoot(cwd: string): Promise<string> {
  const requested = await realpath(resolve(cwd))
  const reported = (await gitOutput(requested, ['rev-parse', '--show-toplevel'])).trim()
  const canonical = await realpath(reported)
  if (canonical !== requested) {
    throw new Error('Protected operator bundle cwd must be the exact repository root.')
  }
  return canonical
}

function parseTrackedEntries(output: string): Map<string, GitTrackedEntry> {
  const entries = new Map<string, GitTrackedEntry>()
  for (const raw of output.split('\0')) {
    if (!raw) continue
    const match = raw.match(/^([0-9]{6}) ([a-f0-9]{40,64}) ([0-3])\t([\s\S]+)$/u)
    if (!match) throw new Error('Protected bundle received malformed Git tracked-file output.')
    const entry: GitTrackedEntry = {
      gitMode: match[1]!,
      objectId: match[2]!,
      stage: match[3]!,
      path: match[4]!,
    }
    if (!isSafeProtectedV2RepositoryPath(entry.path)) {
      throw new Error(`Protected bundle received an unsafe Git path: ${entry.path}`)
    }
    if (entry.stage !== '0') {
      throw new Error(`Protected bundle rejects an unmerged tracked path: ${entry.path}`)
    }
    if (entries.has(entry.path)) {
      throw new Error(`Protected bundle received a duplicate Git path: ${entry.path}`)
    }
    entries.set(entry.path, entry)
  }
  return entries
}

async function trackedEntries(cwd: string): Promise<Map<string, GitTrackedEntry>> {
  return parseTrackedEntries(await gitOutput(cwd, ['ls-files', '--stage', '-z']))
}

function selectProtectedDirectoryFiles(tracked: ReadonlyMap<string, GitTrackedEntry>): Set<string> {
  const selected = new Set<string>()
  for (const path of tracked.keys()) {
    if (
      PROTECTED_V2_PROTECTED_DIRECTORIES.some(
        (directory) => path.startsWith(`${directory}/`) && path.length > directory.length + 1,
      )
    ) {
      selected.add(path)
    }
  }
  for (const directory of PROTECTED_V2_PROTECTED_DIRECTORIES) {
    if (![...selected].some((path) => path.startsWith(`${directory}/`))) {
      throw new Error(`Protected tracked directory is absent or empty: ${directory}`)
    }
  }
  return selected
}

function addTrackedPath(input: {
  path: string
  selected: Set<string>
  tracked: ReadonlyMap<string, GitTrackedEntry>
}): void {
  if (!isSafeProtectedV2RepositoryPath(input.path) || !input.tracked.has(input.path)) {
    throw new Error(`Protected operator bundle required path is not Git-tracked: ${input.path}`)
  }
  input.selected.add(input.path)
}

async function protectedFileIdentity(input: {
  cwd: string
  entry: GitTrackedEntry
}): Promise<ProtectedV2OperatorBundleFile> {
  if (input.entry.gitMode !== '100644' && input.entry.gitMode !== '100755') {
    throw new Error(
      `Protected operator bundle rejects non-regular Git mode ${input.entry.gitMode}: ${input.entry.path}`,
    )
  }
  const absolutePath = resolve(input.cwd, input.entry.path)
  if (!isWithin(input.cwd, absolutePath)) {
    throw new Error(`Protected operator bundle path escapes the repository: ${input.entry.path}`)
  }
  let stat
  try {
    stat = await lstat(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Protected tracked file is deleted or missing: ${input.entry.path}`)
    }
    throw error
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Protected tracked path is not a regular non-symlink file: ${input.entry.path}`)
  }
  const canonical = await realpath(absolutePath)
  if (canonical !== absolutePath) {
    throw new Error(`Protected tracked path resolves through a symlink: ${input.entry.path}`)
  }
  return {
    gitMode: input.entry.gitMode,
    path: input.entry.path,
    sha256: sha256(await readFile(absolutePath)),
  }
}

function validateFileInventory(input: unknown): Array<Required<ProtectedV2OperatorBundleFile>> {
  if (!Array.isArray(input)) {
    throw new Error('Protected operator bundle files must be an array.')
  }
  const files = input.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('path' in entry) ||
      typeof entry.path !== 'string' ||
      !('sha256' in entry) ||
      typeof entry.sha256 !== 'string' ||
      !('gitMode' in entry) ||
      (entry.gitMode !== '100644' && entry.gitMode !== '100755') ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256) ||
      !isSafeProtectedV2RepositoryPath(entry.path)
    ) {
      throw new Error('Protected operator bundle contains an unsafe file identity.')
    }
    return { gitMode: entry.gitMode, path: entry.path, sha256: entry.sha256 }
  })
  if (
    files.length === 0 ||
    new Set(files.map(({ path }) => path)).size !== files.length ||
    canonicalJson(files) !==
      canonicalJson([...files].sort((left, right) => compareCodeUnits(left.path, right.path)))
  ) {
    throw new Error('Protected operator bundle file inventory is empty, duplicated, or unordered.')
  }
  return files
}

export function validateProtectedV2OperatorBundle(
  input: unknown,
): ValidatedProtectedV2OperatorBundle {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Protected operator bundle must be an object.')
  }
  const bundle = input as Partial<ValidatedProtectedV2OperatorBundle>
  if (
    bundle.schemaVersion !== PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION ||
    !Array.isArray(bundle.roots) ||
    !Array.isArray(bundle.protectedDirectories) ||
    typeof bundle.aggregateSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(bundle.aggregateSha256)
  ) {
    throw new Error('Protected operator bundle shape or schema version drifted.')
  }
  const files = validateFileInventory(bundle.files)
  const roots = bundle.roots.map((path) => {
    if (typeof path !== 'string' || !isSafeProtectedV2RepositoryPath(path)) {
      throw new Error('Protected operator bundle contains an unsafe explicit root.')
    }
    return path
  })
  const protectedDirectories = bundle.protectedDirectories.map((path) => {
    if (typeof path !== 'string' || !isSafeProtectedV2RepositoryPath(path)) {
      throw new Error('Protected operator bundle contains an unsafe protected directory.')
    }
    return path
  })
  if (
    new Set(roots).size !== roots.length ||
    canonicalJson(roots) !== canonicalJson([...roots].sort(compareCodeUnits)) ||
    canonicalJson(protectedDirectories) !==
      canonicalJson([...PROTECTED_V2_PROTECTED_DIRECTORIES].sort(compareCodeUnits))
  ) {
    throw new Error('Protected operator bundle roots or directories drifted or are unordered.')
  }
  const paths = new Set(files.map(({ path }) => path))
  for (const required of PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS) {
    if (!roots.includes(required) || !paths.has(required)) {
      throw new Error(`Protected operator bundle omitted an explicit runtime root: ${required}`)
    }
  }
  if (roots.some((path) => !paths.has(path))) {
    throw new Error('Protected operator bundle explicit root is absent from its file inventory.')
  }
  const moduleResolutionAudit = validateProtectedV2ModuleResolutionAudit(
    bundle.moduleResolutionAudit,
  )
  const runtimeInputAudit = validateProtectedV2RuntimeInputAudit(bundle.runtimeInputAudit)
  if (runtimeInputAudit.declarationSha256 !== PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SHA256) {
    throw new Error('Protected operator bundle runtime-input declaration identity drifted.')
  }
  const expectedRoots = [
    ...new Set([
      ...PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS,
      ...moduleResolutionAudit.tsconfigPaths,
      ...runtimeInputAudit.repositoryInputs,
    ]),
  ].sort(compareCodeUnits)
  if (canonicalJson(roots) !== canonicalJson(expectedRoots)) {
    throw new Error('Protected operator bundle derived root inventory drifted.')
  }
  for (const path of [
    ...moduleResolutionAudit.repositoryModules,
    ...moduleResolutionAudit.tsconfigPaths,
    ...runtimeInputAudit.repositoryInputs,
  ]) {
    if (!paths.has(path)) {
      throw new Error(`Protected operator bundle audit references an unsealed file: ${path}`)
    }
  }
  const content = {
    files,
    moduleResolutionAudit,
    protectedDirectories,
    roots,
    runtimeInputAudit,
    schemaVersion: PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
  }
  if (sha256(canonicalJson(content)) !== bundle.aggregateSha256) {
    throw new Error('Protected operator bundle aggregate identity is invalid.')
  }
  return { ...content, aggregateSha256: bundle.aggregateSha256 }
}

/**
 * Retained only as a non-authorizing diagnostic for callers/tests that need to
 * display literal relative ECMAScript imports. It never selects bundle files.
 */
export function protectedV2RelativeImports(source: string): string[] {
  const sourceFile = ts.createSourceFile('diagnostic.ts', source, ts.ScriptTarget.Latest, true)
  const imports: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith('.')
    ) {
      imports.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!) &&
      node.arguments[0]!.text.startsWith('.')
    ) {
      imports.push(node.arguments[0]!.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...new Set(imports)].sort(compareCodeUnits)
}

export async function buildProtectedV2OperatorBundle(input: {
  cwd: string
}): Promise<ValidatedProtectedV2OperatorBundle> {
  const cwd = await canonicalRepositoryRoot(input.cwd)
  const tracked = await trackedEntries(cwd)
  const trackedPaths = new Set(tracked.keys())
  const selected = selectProtectedDirectoryFiles(tracked)
  for (const path of PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS) {
    addTrackedPath({ path, selected, tracked })
  }

  const moduleResolutionAudit = buildProtectedV2ModuleResolutionAudit({
    cwd,
    entryPoints: PROTECTED_V2_RUNTIME_ENTRY_POINTS,
    packageJsonPath: 'package.json',
    packageLockPath: 'package-lock.json',
    trackedPaths,
    tsconfigPath: 'tsconfig.json',
  })
  for (const path of [
    ...moduleResolutionAudit.repositoryModules,
    ...moduleResolutionAudit.tsconfigPaths,
  ]) {
    addTrackedPath({ path, selected, tracked })
  }

  const discoveredCallSites = discoverProtectedV2RuntimeCallSites({
    cwd,
    sourcePaths: moduleResolutionAudit.repositoryModules,
    trackedPaths,
  })
  for (const path of [
    ...discoveredCallSites.flatMap(({ staticRepositoryInputs }) => staticRepositoryInputs),
    ...PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS.flatMap(
      ({ repositoryInputs }) => repositoryInputs,
    ),
  ]) {
    addTrackedPath({ path, selected, tracked })
  }

  const runtimeInputAudit = buildProtectedV2RuntimeInputAudit({
    callSiteDeclarations: PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS,
    cwd,
    packageJsonPath: 'package.json',
    packageLockPath: 'package-lock.json',
    packageScripts: PROTECTED_V2_PACKAGE_SCRIPT_DECLARATIONS,
    sealedPaths: selected,
    sourcePaths: moduleResolutionAudit.repositoryModules,
    trackedPaths,
  })
  const roots = [
    ...new Set([
      ...PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS,
      ...moduleResolutionAudit.tsconfigPaths,
      ...runtimeInputAudit.repositoryInputs,
    ]),
  ].sort(compareCodeUnits)
  const files = await Promise.all(
    [...selected]
      .sort(compareCodeUnits)
      .map((path) => protectedFileIdentity({ cwd, entry: tracked.get(path)! })),
  )
  const content = {
    files,
    moduleResolutionAudit,
    protectedDirectories: [...PROTECTED_V2_PROTECTED_DIRECTORIES].sort(compareCodeUnits),
    roots,
    runtimeInputAudit,
    schemaVersion: PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
  }
  return validateProtectedV2OperatorBundle({
    ...content,
    aggregateSha256: sha256(canonicalJson(content)),
  })
}

export function assertProtectedV2OperatorBundleUnchanged(input: {
  current: ProtectedV2OperatorBundle
  intent: ProtectedV2OperatorBundle
}): void {
  const current = validateProtectedV2OperatorBundle(input.current)
  const intent = validateProtectedV2OperatorBundle(input.intent)
  if (
    canonicalJson(intent) !== canonicalJson(current) ||
    intent.aggregateSha256 !== current.aggregateSha256
  ) {
    throw new Error(
      'Protected V2 recovery rejected protected runtime-bundle, configuration, or dependency drift.',
    )
  }
}

export const PROTECTED_V2_RUNTIME_INPUT_DECLARATION_IDENTITY_SHA256 =
  PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SHA256
