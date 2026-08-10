import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'

import { canonicalJson } from './gold-import-compensation-migration-operations'

export const PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION =
  'literature-gold-protected-v2-operator-bundle/1.0.0' as const

/**
 * Files that define the protected application boundary even when they are not
 * reached by a TypeScript import (package runtime, shell guard, and SQL bytes).
 * Every relative source import reachable from these roots is added
 * transitively and deterministically by buildProtectedV2OperatorBundle.
 */
export const PROTECTED_V2_OPERATOR_BUNDLE_ROOTS = [
  'package-lock.json',
  'package.json',
  'scripts/require-primary-checkout.mjs',
  'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  'scripts/literature/audit-gold-import-compensation-v2.ts',
  'scripts/literature/gold-import-contract-v2-catalog-audit.ts',
  'scripts/literature/local-supabase.ts',
  'scripts/literature/protected-gold-import-contract-v2-evidence.ts',
  'scripts/literature/protected-gold-import-contract-v2-recovery-bundle.ts',
  'scripts/literature/protected-gold-import-contract-v2.ts',
  'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
  'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
] as const

export interface ProtectedV2OperatorBundleFile {
  path: string
  sha256: string
}

export interface ProtectedV2OperatorBundle {
  aggregateSha256: string
  files: ProtectedV2OperatorBundleFile[]
  roots: readonly string[]
  schemaVersion: typeof PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION
}

export function validateProtectedV2OperatorBundle(input: unknown): ProtectedV2OperatorBundle {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Protected operator bundle must be an object.')
  }
  const bundle = input as Partial<ProtectedV2OperatorBundle>
  if (
    bundle.schemaVersion !== PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION ||
    !Array.isArray(bundle.roots) ||
    !Array.isArray(bundle.files) ||
    typeof bundle.aggregateSha256 !== 'string'
  ) {
    throw new Error('Protected operator bundle shape or schema version drifted.')
  }
  if (bundle.roots.some((path) => typeof path !== 'string')) {
    throw new Error('Protected operator bundle contains a non-string root path.')
  }
  const roots = bundle.roots as string[]
  const files = bundle.files.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.path !== 'string' ||
      typeof entry.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256) ||
      !isSafeRepositoryRelativePath(entry.path)
    ) {
      throw new Error('Protected operator bundle contains an unsafe file identity.')
    }
    return { path: entry.path, sha256: entry.sha256 }
  })
  if (
    roots.length === 0 ||
    new Set(roots).size !== roots.length ||
    new Set(files.map(({ path }) => path)).size !== files.length ||
    canonicalJson(roots) !== canonicalJson([...roots].sort(compareCodeUnits)) ||
    canonicalJson(files) !==
      canonicalJson([...files].sort((left, right) => compareCodeUnits(left.path, right.path))) ||
    roots.some(
      (path) => !isSafeRepositoryRelativePath(path) || !files.some((file) => file.path === path),
    )
  ) {
    throw new Error('Protected operator bundle inventory is incomplete, unsafe, or unordered.')
  }
  const content = {
    files,
    roots,
    schemaVersion: PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
  } as const
  if (sha256(canonicalJson(content)) !== bundle.aggregateSha256) {
    throw new Error('Protected operator bundle aggregate identity is invalid.')
  }
  return { ...content, aggregateSha256: bundle.aggregateSha256 }
}

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx'])
const RESOLUTION_SUFFIXES = ['', '.ts', '.tsx', '.mjs', '.js', '.json'] as const
const RELATIVE_IMPORT_PATTERN =
  /(?:\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?|\bimport\s*\()(['"])(\.[^'"]+)\1/gmu

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isSafeRepositoryRelativePath(path: string): boolean {
  const segments = path.split('/')
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
  )
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

async function regularFile(path: string): Promise<boolean> {
  try {
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error(`Protected operator bundle rejects symlink: ${path}`)
    return stat.isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function resolveRelativeImport(input: {
  cwd: string
  importer: string
  specifier: string
}): Promise<string> {
  const importerDirectory = dirname(resolve(input.cwd, input.importer))
  const base = resolve(importerDirectory, input.specifier)
  if (!isWithin(input.cwd, base)) {
    throw new Error(`Protected operator import escapes the repository: ${input.specifier}`)
  }
  const candidates = [
    ...RESOLUTION_SUFFIXES.map((suffix) => `${base}${suffix}`),
    ...RESOLUTION_SUFFIXES.slice(1).map((suffix) => resolve(base, `index${suffix}`)),
  ]
  for (const candidate of candidates) {
    if (await regularFile(candidate)) {
      return relative(input.cwd, candidate).split(sep).join('/')
    }
  }
  throw new Error(
    `Protected operator relative import cannot be resolved: ${input.importer} -> ${input.specifier}`,
  )
}

export function protectedV2RelativeImports(source: string): string[] {
  const imports: string[] = []
  for (const match of source.matchAll(RELATIVE_IMPORT_PATTERN)) {
    const specifier = match[2]
    if (specifier) imports.push(specifier)
  }
  return [...new Set(imports)].sort(compareCodeUnits)
}

export async function buildProtectedV2OperatorBundle(input: {
  cwd: string
  roots?: readonly string[]
}): Promise<ProtectedV2OperatorBundle> {
  const cwd = resolve(input.cwd)
  const roots = [...(input.roots ?? PROTECTED_V2_OPERATOR_BUNDLE_ROOTS)].sort(compareCodeUnits)
  const pending = [...roots]
  const files = new Map<string, string>()

  while (pending.length > 0) {
    const path = pending.shift()!
    if (files.has(path)) continue
    if (!isSafeRepositoryRelativePath(path)) {
      throw new Error(`Protected operator bundle path is not repository-relative: ${path}`)
    }
    const absolute = resolve(cwd, path)
    if (!isWithin(cwd, absolute) || !(await regularFile(absolute))) {
      throw new Error(`Protected operator bundle file is absent or unsafe: ${path}`)
    }
    const bytes = await readFile(absolute)
    files.set(path, sha256(bytes))
    if (!SOURCE_EXTENSIONS.has(extname(path))) continue
    for (const specifier of protectedV2RelativeImports(bytes.toString('utf8'))) {
      const dependency = await resolveRelativeImport({ cwd, importer: path, specifier })
      if (!files.has(dependency) && !pending.includes(dependency)) pending.push(dependency)
    }
    pending.sort(compareCodeUnits)
  }

  const inventory = [...files]
    .map(([path, fileSha256]) => ({ path, sha256: fileSha256 }))
    .sort((left, right) => compareCodeUnits(left.path, right.path))
  const content = {
    files: inventory,
    roots,
    schemaVersion: PROTECTED_V2_OPERATOR_BUNDLE_SCHEMA_VERSION,
  } as const
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
    canonicalJson(intent.roots) !== canonicalJson(current.roots) ||
    canonicalJson(intent.files) !== canonicalJson(current.files) ||
    intent.aggregateSha256 !== current.aggregateSha256
  ) {
    throw new Error(
      'Protected V2 recovery rejected protected operator-bundle or dependency-inventory drift.',
    )
  }
}
