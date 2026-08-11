import { execFile } from 'node:child_process'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { posix, resolve } from 'node:path'
import { promisify } from 'node:util'

import ts from 'typescript'

import {
  buildProtectedV2ReceiptRecoveryBundle,
  canonicalProtectedV2ReceiptRecoveryJson,
  type ProtectedV2ReceiptRecoveryBundle,
  type ProtectedV2ReceiptRecoveryBundleFile,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'

export const PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_SCRIPT =
  'literature:recover-protected-gold-import-contract-v2-receipt' as const
export const PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_COMMAND =
  'node scripts/require-primary-checkout.mjs -- tsx scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts' as const

export const PROTECTED_V2_RECEIPT_RECOVERY_TOOL_BUNDLE_ENTRY_POINT =
  'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts' as const

export const PROTECTED_V2_RECEIPT_RECOVERY_TOOL_BUNDLE_AUXILIARY_ENTRY_POINTS = [
  'scripts/literature/finalize-protected-v2-receipt-recovery-amendment.ts',
] as const

export const PROTECTED_V2_RECEIPT_RECOVERY_TOOL_BUNDLE_CONTROL_INPUTS = [
  'package-lock.json',
  'package.json',
  'scripts/require-primary-checkout.mjs',
  'tsconfig.json',
] as const

const execFileAsync = promisify(execFile)
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u

interface TrackedEntry {
  gitMode: string
  path: string
  stage: string
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

async function gitOutput(cwd: string, arguments_: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...arguments_], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return result.stdout
}

async function canonicalRepositoryRoot(cwd: string): Promise<string> {
  const requested = await realpath(resolve(cwd))
  const reported = (await gitOutput(requested, ['rev-parse', '--show-toplevel'])).trim()
  const canonical = await realpath(reported)
  if (canonical !== requested) {
    throw new Error('Recovery-tool bundle cwd must be the exact repository root.')
  }
  return canonical
}

function trackedEntries(bytes: string): ReadonlyMap<string, TrackedEntry> {
  const entries = new Map<string, TrackedEntry>()
  for (const raw of bytes.split('\0')) {
    if (!raw) continue
    const match = raw.match(/^([0-9]{6}) [a-f0-9]{40,64} ([0-3])\t([\s\S]+)$/u)
    if (!match) throw new Error('Recovery-tool bundle received malformed Git inventory.')
    const entry = { gitMode: match[1]!, path: match[3]!, stage: match[2]! }
    if (!SAFE_PATH.test(entry.path) || entries.has(entry.path)) {
      throw new Error(`Recovery-tool bundle received an unsafe or duplicate path: ${entry.path}`)
    }
    if (entry.stage !== '0') {
      throw new Error(`Recovery-tool bundle rejects an unmerged path: ${entry.path}`)
    }
    entries.set(entry.path, entry)
  }
  return entries
}

function packageName(specifier: string): string {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/')
  return specifier.split('/')[0]!
}

function literalModuleSpecifiers(source: string, sourcePath: string): string[] {
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!)
    ) {
      specifiers.push(node.arguments[0]!.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...new Set(specifiers)].sort(compareCodeUnits)
}

function relativeCandidates(importer: string, specifier: string): string[] {
  const base = posix.normalize(posix.join(posix.dirname(importer), specifier))
  if (!SAFE_PATH.test(base)) {
    throw new Error(`Recovery-tool dependency escapes the repository: ${importer} -> ${specifier}`)
  }
  const extension = posix.extname(base)
  const candidates = extension
    ? [
        base,
        ...(extension === '.js' || extension === '.mjs'
          ? [`${base.slice(0, -extension.length)}.ts`, `${base.slice(0, -extension.length)}.tsx`]
          : []),
      ]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.mts`,
        `${base}.cts`,
        `${base}.mjs`,
        `${base}.js`,
        `${base}.json`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
        `${base}/index.mjs`,
        `${base}/index.js`,
      ]
  return [...new Set(candidates)]
}

function resolveRepositoryImport(input: {
  importer: string
  specifier: string
  tracked: ReadonlyMap<string, TrackedEntry>
}): string | undefined {
  if (!input.specifier.startsWith('.')) return undefined
  const matches = relativeCandidates(input.importer, input.specifier).filter((path) =>
    input.tracked.has(path),
  )
  if (matches.length !== 1) {
    throw new Error(
      `Recovery-tool import must resolve to exactly one tracked file: ${input.importer} -> ${input.specifier}`,
    )
  }
  return matches[0]
}

async function assertRegularTrackedFile(input: {
  cwd: string
  entry: TrackedEntry
}): Promise<ProtectedV2ReceiptRecoveryBundleFile> {
  if (input.entry.gitMode !== '100644' && input.entry.gitMode !== '100755') {
    throw new Error(
      `Recovery-tool bundle rejects Git mode ${input.entry.gitMode}: ${input.entry.path}`,
    )
  }
  const absolutePath = resolve(input.cwd, input.entry.path)
  const stat = await lstat(absolutePath)
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(absolutePath)) !== absolutePath) {
    throw new Error(
      `Recovery-tool bundle path is not a regular canonical file: ${input.entry.path}`,
    )
  }
  const bytes = await readFile(absolutePath)
  return {
    gitMode: input.entry.gitMode,
    path: input.entry.path,
    sha256: await cryptoSha256(bytes),
  }
}

async function cryptoSha256(bytes: Uint8Array): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(bytes).digest('hex')
}

async function parsePackageControl(cwd: string): Promise<ReadonlySet<string>> {
  const packagePath = resolve(cwd, 'package.json')
  const parsed = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies?: Record<string, unknown>
    devDependencies?: Record<string, unknown>
    optionalDependencies?: Record<string, unknown>
    peerDependencies?: Record<string, unknown>
    scripts?: Record<string, unknown>
  }
  if (
    parsed.scripts?.[PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_SCRIPT] !==
    PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_COMMAND
  ) {
    throw new Error('Recovery package script is absent or differs from the reviewed command.')
  }
  return new Set(
    [
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
      ...Object.keys(parsed.optionalDependencies ?? {}),
      ...Object.keys(parsed.peerDependencies ?? {}),
    ].sort(compareCodeUnits),
  )
}

async function selectedRecoveryPaths(input: {
  cwd: string
  tracked: ReadonlyMap<string, TrackedEntry>
}): Promise<string[]> {
  const allowedPackages = await parsePackageControl(input.cwd)
  const entryPoints = [
    PROTECTED_V2_RECEIPT_RECOVERY_TOOL_BUNDLE_ENTRY_POINT,
    ...PROTECTED_V2_RECEIPT_RECOVERY_TOOL_BUNDLE_AUXILIARY_ENTRY_POINTS,
  ]
  const selected: Set<string> = new Set([
    ...PROTECTED_V2_RECEIPT_RECOVERY_TOOL_BUNDLE_CONTROL_INPUTS,
    ...entryPoints,
  ])
  const pending: string[] = [...entryPoints]
  while (pending.length > 0) {
    const path = pending.shift()!
    const entry = input.tracked.get(path)
    if (!entry) throw new Error(`Recovery-tool required path is not Git-tracked: ${path}`)
    const source = await readFile(resolve(input.cwd, path), 'utf8')
    for (const specifier of literalModuleSpecifiers(source, path)) {
      if (specifier.startsWith('.')) {
        const dependency = resolveRepositoryImport({
          importer: path,
          specifier,
          tracked: input.tracked,
        })!
        if (!selected.has(dependency)) {
          selected.add(dependency)
          pending.push(dependency)
        }
        continue
      }
      if (specifier.startsWith('node:')) continue
      const dependency = packageName(specifier)
      if (!allowedPackages.has(dependency)) {
        throw new Error(
          `Recovery-tool bare import is neither a sealed package nor a relative tracked file: ${path} -> ${specifier}`,
        )
      }
    }
  }
  for (const path of selected) {
    if (!input.tracked.has(path)) {
      throw new Error(`Recovery-tool required control input is not Git-tracked: ${path}`)
    }
  }
  return [...selected].sort(compareCodeUnits)
}

export async function buildCurrentProtectedV2ReceiptRecoveryToolBundle(input: {
  cwd: string
}): Promise<ProtectedV2ReceiptRecoveryBundle> {
  const cwd = await canonicalRepositoryRoot(input.cwd)
  const tracked = trackedEntries(await gitOutput(cwd, ['ls-files', '--stage', '-z']))
  const selected = await selectedRecoveryPaths({ cwd, tracked })
  const files = await Promise.all(
    selected.map((path) => assertRegularTrackedFile({ cwd, entry: tracked.get(path)! })),
  )
  return buildProtectedV2ReceiptRecoveryBundle(files)
}

export async function assertProtectedV2ReceiptRecoveryToolBundleStaticClosure(input: {
  bundle: ProtectedV2ReceiptRecoveryBundle
  cwd: string
}): Promise<void> {
  const rebuilt = await buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd: input.cwd })
  if (
    canonicalProtectedV2ReceiptRecoveryJson(rebuilt) !==
    canonicalProtectedV2ReceiptRecoveryJson(input.bundle)
  ) {
    throw new Error(
      'Recovery-tool bundle omits or changes a control input or transitive dependency.',
    )
  }
}
