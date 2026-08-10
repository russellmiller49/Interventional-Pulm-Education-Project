import { createHash } from 'node:crypto'
import { builtinModules } from 'node:module'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

import ts from 'typescript'

import { canonicalJson } from './gold-import-compensation-migration-operations'

export const PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION =
  'literature-gold-protected-v2-module-resolution-audit/1.0.0' as const

export type ProtectedV2ModuleSyntax =
  | 'create_require'
  | 'dynamic_import'
  | 'export'
  | 'import'
  | 'import_equals'
  | 'import_type'
  | 'require'
  | 'require_resolve'

export type ProtectedV2ModuleResolutionKind = 'builtin' | 'external_package' | 'repository'

export interface ProtectedV2ModuleResolutionRecord {
  importer: string
  kind: ProtectedV2ModuleResolutionKind
  packageName: string | null
  resolvedPath: string | null
  sourceOffset: number
  specifier: string
  syntax: ProtectedV2ModuleSyntax
}

export interface ProtectedV2ModuleResolutionAudit {
  compilerOptionsSha256: string
  externalPackages: string[]
  records: ProtectedV2ModuleResolutionRecord[]
  repositoryModules: string[]
  schemaVersion: typeof PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION
  sha256: string
  tsconfigPaths: string[]
}

export interface BuildProtectedV2ModuleResolutionAuditInput {
  cwd: string
  entryPoints: readonly string[]
  packageJsonPath: string
  packageLockPath: string
  trackedPaths: ReadonlySet<string>
  tsconfigPath: string
}

interface ModuleReference {
  sourceOffset: number
  specifier: string
  syntax: ProtectedV2ModuleSyntax
}

const SOURCE_EXTENSIONS = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'])
const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((name) => {
    const bare = name.replace(/^node:/u, '')
    return [bare, `node:${bare}`]
  }),
)

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

export function isSafeProtectedV2RepositoryPath(path: string): boolean {
  const segments = path.split('/')
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
  )
}

function repositoryPath(cwd: string, absolutePath: string, label: string): string {
  const canonical = resolve(absolutePath)
  if (!isWithin(cwd, canonical)) {
    throw new Error(`${label} escapes the protected repository: ${absolutePath}`)
  }
  const path = relative(cwd, canonical).split(sep).join('/')
  if (!isSafeProtectedV2RepositoryPath(path)) {
    throw new Error(`${label} is not a canonical repository-relative path: ${path}`)
  }
  return path
}

function assertTrackedRegularFile(input: {
  absolutePath: string
  cwd: string
  label: string
  trackedPaths: ReadonlySet<string>
}): string {
  const path = repositoryPath(input.cwd, input.absolutePath, input.label)
  if (!input.trackedPaths.has(path)) {
    throw new Error(`${input.label} is not Git-tracked: ${path}`)
  }
  const stat = lstatSync(input.absolutePath)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${input.label} must be a tracked regular non-symlink file: ${path}`)
  }
  const canonical = realpathSync(input.absolutePath)
  if (canonical !== resolve(input.absolutePath)) {
    throw new Error(`${input.label} resolves through a symlinked repository path: ${path}`)
  }
  return path
}

function diagnosticsText(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    .join('\n')
}

function loadCommittedTsconfig(input: BuildProtectedV2ModuleResolutionAuditInput): {
  compilerOptionsSha256: string
  options: ts.CompilerOptions
  tsconfigPaths: string[]
} {
  const configPath = resolve(input.cwd, input.tsconfigPath)
  assertTrackedRegularFile({
    absolutePath: configPath,
    cwd: input.cwd,
    label: 'Protected TypeScript configuration',
    trackedPaths: input.trackedPaths,
  })
  const source = ts.readJsonConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonSourceFileConfigFileContent(
    source,
    ts.sys,
    dirname(configPath),
    undefined,
    configPath,
  )
  if (parsed.errors.length > 0) {
    throw new Error(
      `Protected TypeScript configuration is invalid:\n${diagnosticsText(parsed.errors)}`,
    )
  }
  const configFiles = [configPath, ...(source.extendedSourceFiles ?? [])]
  const tsconfigPaths = [...new Set(configFiles.map((path) => resolve(path)))]
    .map((absolutePath) =>
      assertTrackedRegularFile({
        absolutePath,
        cwd: input.cwd,
        label: 'Protected recursively extended TypeScript configuration',
        trackedPaths: input.trackedPaths,
      }),
    )
    .sort(compareCodeUnits)
  const normalizeCompilerOption = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (!isAbsolute(value)) return value
      const absolute = resolve(value)
      return isWithin(input.cwd, absolute)
        ? `<repository>/${relative(input.cwd, absolute).split(sep).join('/')}`
        : value
    }
    if (Array.isArray(value)) return value.map(normalizeCompilerOption)
    if (value && typeof value === 'object') {
      if ('kind' in value && typeof (value as { kind?: unknown }).kind === 'number')
        return undefined
      return Object.fromEntries(
        Object.entries(value)
          .map(([key, child]) => [key, normalizeCompilerOption(child)] as const)
          .filter((entry) => entry[1] !== undefined),
      )
    }
    return value
  }
  const normalizedOptions = normalizeCompilerOption(parsed.options)
  return {
    compilerOptionsSha256: sha256(canonicalJson(normalizedOptions)),
    options: parsed.options,
    tsconfigPaths,
  }
}

function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    if (!scope || !name)
      throw new Error(`Protected external package specifier is malformed: ${specifier}`)
    return `${scope}/${name}`
  }
  const [name] = specifier.split('/')
  if (!name) throw new Error(`Protected external package specifier is malformed: ${specifier}`)
  return name
}

const PACKAGE_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

function packageDependencyMap(
  input: Record<string, unknown>,
  field: string,
): Record<string, string> {
  const value = input[field]
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Protected package ${field} inventory is malformed.`)
  }
  const entries = Object.entries(value)
  if (entries.some(([, specifier]) => typeof specifier !== 'string' || specifier.length === 0)) {
    throw new Error(`Protected package ${field} inventory contains a malformed specifier.`)
  }
  return Object.fromEntries(entries) as Record<string, string>
}

export function loadProtectedV2PackageInventory(
  input: Pick<
    BuildProtectedV2ModuleResolutionAuditInput,
    'cwd' | 'packageJsonPath' | 'packageLockPath' | 'trackedPaths'
  >,
): { boundPackages: Set<string>; packageJson: Record<string, unknown> } {
  const packageJsonAbsolute = resolve(input.cwd, input.packageJsonPath)
  const packageLockAbsolute = resolve(input.cwd, input.packageLockPath)
  assertTrackedRegularFile({
    absolutePath: packageJsonAbsolute,
    cwd: input.cwd,
    label: 'Protected package manifest',
    trackedPaths: input.trackedPaths,
  })
  assertTrackedRegularFile({
    absolutePath: packageLockAbsolute,
    cwd: input.cwd,
    label: 'Protected package lock',
    trackedPaths: input.trackedPaths,
  })
  const packageJson = JSON.parse(readFileSync(packageJsonAbsolute, 'utf8')) as Record<
    string,
    unknown
  >
  const packageLock = JSON.parse(readFileSync(packageLockAbsolute, 'utf8')) as Record<
    string,
    unknown
  >
  if (packageLock.lockfileVersion !== 3) {
    throw new Error('Protected package lock must use the reviewed lockfileVersion 3 format.')
  }
  const lockPackages = packageLock.packages
  if (!lockPackages || typeof lockPackages !== 'object' || Array.isArray(lockPackages)) {
    throw new Error('Protected package lock does not contain a packages inventory.')
  }
  const lockRoot = (lockPackages as Record<string, unknown>)['']
  if (!lockRoot || typeof lockRoot !== 'object' || Array.isArray(lockRoot)) {
    throw new Error('Protected package lock does not contain an exact root package inventory.')
  }
  const declared = new Set<string>()
  for (const field of PACKAGE_DEPENDENCY_FIELDS) {
    const manifestDependencies = packageDependencyMap(packageJson, field)
    const lockDependencies = packageDependencyMap(lockRoot as Record<string, unknown>, field)
    if (canonicalJson(manifestDependencies) !== canonicalJson(lockDependencies)) {
      throw new Error(`Protected package manifest and lock root ${field} inventories drifted.`)
    }
    for (const [name, specifier] of Object.entries(manifestDependencies)) {
      if (/^(?:file|link|portal|workspace):|^(?:\.{0,2}\/|\/)/u.test(specifier)) {
        throw new Error(`Protected external package uses an unsealed local dependency: ${name}`)
      }
      const lockEntry = (lockPackages as Record<string, unknown>)[`node_modules/${name}`]
      if (!lockEntry || typeof lockEntry !== 'object' || Array.isArray(lockEntry)) {
        throw new Error(`Protected external package has no exact package-lock entry: ${name}`)
      }
      const entry = lockEntry as Record<string, unknown>
      if (
        entry.link === true ||
        typeof entry.version !== 'string' ||
        entry.version.length === 0 ||
        typeof entry.resolved !== 'string' ||
        !entry.resolved.startsWith('https://') ||
        typeof entry.integrity !== 'string' ||
        !/^sha(?:1|512)-[A-Za-z0-9+/=]+$/u.test(entry.integrity)
      ) {
        throw new Error(`Protected external package lock entry is not immutable: ${name}`)
      }
      declared.add(name)
    }
  }
  return { boundPackages: declared, packageJson }
}

function isImportMetaUrl(node: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'url' &&
    ts.isMetaProperty(node.expression) &&
    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.expression.name.text === 'meta'
  )
}

function literalModuleSpecifier(node: ts.Expression | undefined, label: string): string {
  if (!node || !ts.isStringLiteralLike(node)) {
    throw new Error(
      `${label} must use one exact string literal; dynamic or assembled modules fail closed.`,
    )
  }
  return node.text
}

function collectCreateRequireBindings(sourceFile: ts.SourceFile): {
  factories: Set<string>
  requireFunctions: Set<string>
} {
  const factories = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue
    if (!['module', 'node:module'].includes(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === 'createRequire')
        factories.add(element.name.text)
    }
  }
  const requireFunctions = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      factories.has(node.initializer.expression.text)
    ) {
      if (
        node.initializer.arguments.length !== 1 ||
        !isImportMetaUrl(node.initializer.arguments[0]!)
      ) {
        throw new Error(
          `createRequire in ${sourceFile.fileName} must be initialized exactly from import.meta.url.`,
        )
      }
      requireFunctions.add(node.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return { factories, requireFunctions }
}

function collectModuleReferences(sourceFile: ts.SourceFile): ModuleReference[] {
  const references: ModuleReference[] = []
  const { factories, requireFunctions } = collectCreateRequireBindings(sourceFile)
  const add = (syntax: ProtectedV2ModuleSyntax, specifier: string, node: ts.Node): void => {
    references.push({ sourceOffset: node.getStart(sourceFile), specifier, syntax })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      add('import', literalModuleSpecifier(node.moduleSpecifier, 'Protected import'), node)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add('export', literalModuleSpecifier(node.moduleSpecifier, 'Protected export'), node)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(
        'import_equals',
        literalModuleSpecifier(node.moduleReference.expression, 'Protected import-equals'),
        node,
      )
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument
      if (!ts.isLiteralTypeNode(argument) || !ts.isStringLiteralLike(argument.literal)) {
        throw new Error(`Protected import type in ${sourceFile.fileName} is not a string literal.`)
      }
      add('import_type', argument.literal.text, node)
    } else if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'eval' || node.expression.text === 'Function')
      ) {
        throw new Error(`Unsupported executable module-loader syntax in ${sourceFile.fileName}.`)
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length !== 1) {
          throw new Error(
            `Protected dynamic import in ${sourceFile.fileName} must have one argument.`,
          )
        }
        add(
          'dynamic_import',
          literalModuleSpecifier(node.arguments[0], 'Protected dynamic import'),
          node,
        )
      } else if (ts.isIdentifier(node.expression) && factories.has(node.expression.text)) {
        // The initializer was validated in the first pass. Any other call is unsupported.
        const parent = node.parent
        if (!ts.isVariableDeclaration(parent) || parent.initializer !== node) {
          throw new Error(`Unsupported createRequire use in ${sourceFile.fileName}.`)
        }
      } else if (
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'require' || requireFunctions.has(node.expression.text))
      ) {
        if (node.arguments.length !== 1) {
          throw new Error(`Protected require in ${sourceFile.fileName} must have one argument.`)
        }
        add(
          requireFunctions.has(node.expression.text) ? 'create_require' : 'require',
          literalModuleSpecifier(node.arguments[0], 'Protected require'),
          node,
        )
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'resolve' &&
        ts.isIdentifier(node.expression.expression) &&
        (node.expression.expression.text === 'require' ||
          requireFunctions.has(node.expression.expression.text))
      ) {
        if (node.arguments.length !== 1) {
          throw new Error(
            `Protected require.resolve in ${sourceFile.fileName} must have one argument.`,
          )
        }
        add(
          'require_resolve',
          literalModuleSpecifier(node.arguments[0], 'Protected require.resolve'),
          node,
        )
      } else if (
        (ts.isPropertyAccessExpression(node.expression) &&
          ['createRequire', 'require'].includes(node.expression.name.text)) ||
        (ts.isElementAccessExpression(node.expression) &&
          ts.isStringLiteralLike(node.expression.argumentExpression) &&
          ['createRequire', 'require'].includes(node.expression.argumentExpression.text))
      ) {
        throw new Error(`Unsupported module-loader syntax in ${sourceFile.fileName}.`)
      }
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Function'
    ) {
      throw new Error(`Unsupported executable module-loader syntax in ${sourceFile.fileName}.`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const assertLoaderIdentifiers = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const isDirectRequire = node.text === 'require'
      const isFactory = factories.has(node.text)
      const isCreatedRequire = requireFunctions.has(node.text)
      const isCreateRequireName = node.text === 'createRequire'
      if (isDirectRequire || isFactory || isCreatedRequire || isCreateRequireName) {
        const parent = node.parent
        const allowed =
          (ts.isImportSpecifier(parent) &&
            (parent.name === node || parent.propertyName === node)) ||
          (isCreatedRequire && ts.isVariableDeclaration(parent) && parent.name === node) ||
          (ts.isCallExpression(parent) &&
            parent.expression === node &&
            (isDirectRequire || isFactory || isCreatedRequire)) ||
          (ts.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            parent.name.text === 'resolve' &&
            ts.isCallExpression(parent.parent) &&
            parent.parent.expression === parent)
        if (!allowed) {
          throw new Error(`Unsupported module-loader reference in ${sourceFile.fileName}.`)
        }
      }
    }
    ts.forEachChild(node, assertLoaderIdentifiers)
  }
  assertLoaderIdentifiers(sourceFile)
  return references.sort(
    (left, right) =>
      left.sourceOffset - right.sourceOffset ||
      compareCodeUnits(left.syntax, right.syntax) ||
      compareCodeUnits(left.specifier, right.specifier),
  )
}

function sourceFileForPath(path: string): ts.SourceFile {
  const source = readFileSync(path, 'utf8')
  const scriptKind = (() => {
    switch (extname(path)) {
      case '.js':
      case '.cjs':
      case '.mjs':
        return ts.ScriptKind.JS
      case '.jsx':
        return ts.ScriptKind.JSX
      case '.tsx':
        return ts.ScriptKind.TSX
      default:
        return ts.ScriptKind.TS
    }
  })()
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind)
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics
  if (parseDiagnostics && parseDiagnostics.length > 0) {
    throw new Error(
      `Protected runtime source contains TypeScript syntax errors (${path}):\n${diagnosticsText(parseDiagnostics)}`,
    )
  }
  return sourceFile
}

function resolutionRecord(input: {
  boundExternalPackages: ReadonlySet<string>
  cwd: string
  importer: string
  moduleResolutionCache: ts.ModuleResolutionCache
  options: ts.CompilerOptions
  reference: ModuleReference
  trackedPaths: ReadonlySet<string>
}): ProtectedV2ModuleResolutionRecord {
  const { reference } = input
  if (BUILTIN_MODULES.has(reference.specifier)) {
    return {
      importer: input.importer,
      kind: 'builtin',
      packageName: null,
      resolvedPath: null,
      ...reference,
    }
  }
  const importerAbsolute = resolve(input.cwd, input.importer)
  const resolution = ts.resolveModuleName(
    reference.specifier,
    importerAbsolute,
    input.options,
    ts.sys,
    input.moduleResolutionCache,
  ).resolvedModule
  if (!resolution) {
    throw new Error(
      `Protected module cannot be resolved with committed tsconfig: ${input.importer} -> ${reference.specifier}`,
    )
  }
  const resolvedAbsolute = resolve(resolution.resolvedFileName)
  const nodeModulesSegment = `${sep}node_modules${sep}`
  if (!resolvedAbsolute.includes(nodeModulesSegment) && isWithin(input.cwd, resolvedAbsolute)) {
    const resolvedPath = assertTrackedRegularFile({
      absolutePath: resolvedAbsolute,
      cwd: input.cwd,
      label: `Protected repository module ${input.importer} -> ${reference.specifier}`,
      trackedPaths: input.trackedPaths,
    })
    return {
      importer: input.importer,
      kind: 'repository',
      packageName: null,
      resolvedPath,
      ...reference,
    }
  }
  if (reference.specifier.startsWith('.') || reference.specifier.startsWith('/')) {
    throw new Error(
      `Protected relative module resolved outside the repository: ${input.importer} -> ${reference.specifier}`,
    )
  }
  if (!resolvedAbsolute.includes(nodeModulesSegment) || !resolution.isExternalLibraryImport) {
    throw new Error(
      `Protected bare module resolved outside the repository and package tree: ${input.importer} -> ${reference.specifier}`,
    )
  }
  const packageName = packageNameFromSpecifier(reference.specifier)
  const expectedPackageSegment = `${sep}node_modules${sep}${packageName.split('/').join(sep)}${sep}`
  if (!resolvedAbsolute.includes(expectedPackageSegment)) {
    throw new Error(
      `Protected external module resolved outside its exact package-lock tree: ${input.importer} -> ${reference.specifier}`,
    )
  }
  if (!input.boundExternalPackages.has(packageName)) {
    throw new Error(
      `Protected external package is not directly bound by package.json and package-lock.json: ${packageName}`,
    )
  }
  return {
    importer: input.importer,
    kind: 'external_package',
    packageName,
    resolvedPath: null,
    ...reference,
  }
}

export function validateProtectedV2ModuleResolutionAudit(
  input: unknown,
): ProtectedV2ModuleResolutionAudit {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Protected module-resolution audit must be an object.')
  }
  const audit = input as Partial<ProtectedV2ModuleResolutionAudit>
  if (
    audit.schemaVersion !== PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION ||
    typeof audit.compilerOptionsSha256 !== 'string' ||
    !Array.isArray(audit.externalPackages) ||
    !Array.isArray(audit.records) ||
    !Array.isArray(audit.repositoryModules) ||
    !Array.isArray(audit.tsconfigPaths) ||
    typeof audit.sha256 !== 'string'
  ) {
    throw new Error('Protected module-resolution audit shape or schema version drifted.')
  }
  const hash = /^[a-f0-9]{64}$/u
  if (!hash.test(audit.compilerOptionsSha256) || !hash.test(audit.sha256)) {
    throw new Error('Protected module-resolution audit contains a malformed identity.')
  }
  const strings = [audit.externalPackages, audit.repositoryModules, audit.tsconfigPaths]
  if (
    strings.some(
      (values) =>
        values.some((value) => typeof value !== 'string') ||
        new Set(values).size !== values.length ||
        canonicalJson(values) !== canonicalJson([...values].sort(compareCodeUnits)),
    ) ||
    audit.repositoryModules.some((path) => !isSafeProtectedV2RepositoryPath(path)) ||
    audit.tsconfigPaths.some((path) => !isSafeProtectedV2RepositoryPath(path))
  ) {
    throw new Error('Protected module-resolution audit inventories are unsafe or unordered.')
  }
  for (const record of audit.records) {
    if (
      !record ||
      typeof record !== 'object' ||
      !isSafeProtectedV2RepositoryPath(record.importer) ||
      typeof record.specifier !== 'string' ||
      typeof record.sourceOffset !== 'number' ||
      !Number.isSafeInteger(record.sourceOffset) ||
      record.sourceOffset < 0 ||
      record.specifier.length === 0 ||
      !['builtin', 'external_package', 'repository'].includes(record.kind) ||
      ![
        'create_require',
        'dynamic_import',
        'export',
        'import',
        'import_equals',
        'import_type',
        'require',
        'require_resolve',
      ].includes(record.syntax) ||
      (record.kind === 'repository'
        ? typeof record.resolvedPath !== 'string' ||
          !isSafeProtectedV2RepositoryPath(record.resolvedPath) ||
          record.packageName !== null
        : record.resolvedPath !== null) ||
      (record.kind === 'external_package'
        ? typeof record.packageName !== 'string' || record.packageName.length === 0
        : record.packageName !== null)
    ) {
      throw new Error('Protected module-resolution audit contains an invalid record.')
    }
  }
  const repositoryModules = new Set(audit.repositoryModules)
  const externalPackages = new Set(audit.externalPackages)
  if (
    audit.records.some(
      (record) =>
        !repositoryModules.has(record.importer) ||
        (record.kind === 'repository' && !repositoryModules.has(record.resolvedPath!)) ||
        (record.kind === 'external_package' && !externalPackages.has(record.packageName!)),
    )
  ) {
    throw new Error('Protected module-resolution records reference an uninventoried dependency.')
  }
  const referencedExternalPackages = [
    ...new Set(
      audit.records.flatMap((record) =>
        record.kind === 'external_package' ? [record.packageName!] : [],
      ),
    ),
  ].sort(compareCodeUnits)
  if (
    audit.repositoryModules.length === 0 ||
    audit.tsconfigPaths.length === 0 ||
    canonicalJson(referencedExternalPackages) !== canonicalJson(audit.externalPackages)
  ) {
    throw new Error('Protected module-resolution dependency inventories are not exact.')
  }
  const records = [...audit.records].sort((left, right) =>
    compareCodeUnits(canonicalJson(left), canonicalJson(right)),
  )
  if (canonicalJson(records) !== canonicalJson(audit.records)) {
    throw new Error('Protected module-resolution records are not canonically ordered.')
  }
  const content = {
    compilerOptionsSha256: audit.compilerOptionsSha256,
    externalPackages: audit.externalPackages as string[],
    records: audit.records,
    repositoryModules: audit.repositoryModules as string[],
    schemaVersion: PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION,
    tsconfigPaths: audit.tsconfigPaths as string[],
  }
  if (sha256(canonicalJson(content)) !== audit.sha256) {
    throw new Error('Protected module-resolution audit identity is invalid.')
  }
  return { ...content, sha256: audit.sha256 }
}

export function buildProtectedV2ModuleResolutionAudit(
  input: BuildProtectedV2ModuleResolutionAuditInput,
): ProtectedV2ModuleResolutionAudit {
  const cwd = realpathSync(resolve(input.cwd))
  const normalizedInput = { ...input, cwd }
  const { compilerOptionsSha256, options, tsconfigPaths } = loadCommittedTsconfig(normalizedInput)
  const { boundPackages: boundExternalPackages } = loadProtectedV2PackageInventory(normalizedInput)
  const entryPoints = [...new Set(input.entryPoints)].sort(compareCodeUnits)
  if (entryPoints.length === 0)
    throw new Error('Protected module-resolution entry points are empty.')
  const pending = [...entryPoints]
  const repositoryModules = new Set<string>()
  const records: ProtectedV2ModuleResolutionRecord[] = []
  const externalPackages = new Set<string>()
  const moduleResolutionCache = ts.createModuleResolutionCache(
    cwd,
    (fileName) => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
    options,
  )

  while (pending.length > 0) {
    const path = pending.shift()!
    if (repositoryModules.has(path)) continue
    if (!isSafeProtectedV2RepositoryPath(path)) {
      throw new Error(`Protected module entry is not repository-relative: ${path}`)
    }
    const absolutePath = resolve(cwd, path)
    const canonicalPath = assertTrackedRegularFile({
      absolutePath,
      cwd,
      label: 'Protected runtime module',
      trackedPaths: input.trackedPaths,
    })
    repositoryModules.add(canonicalPath)
    if (!SOURCE_EXTENSIONS.has(extname(canonicalPath))) continue
    const sourceFile = sourceFileForPath(absolutePath)
    for (const reference of collectModuleReferences(sourceFile)) {
      const record = resolutionRecord({
        boundExternalPackages,
        cwd,
        importer: canonicalPath,
        moduleResolutionCache,
        options,
        reference,
        trackedPaths: input.trackedPaths,
      })
      records.push(record)
      if (record.kind === 'repository' && record.resolvedPath) {
        if (!repositoryModules.has(record.resolvedPath) && !pending.includes(record.resolvedPath)) {
          pending.push(record.resolvedPath)
          pending.sort(compareCodeUnits)
        }
      } else if (record.kind === 'external_package' && record.packageName) {
        externalPackages.add(record.packageName)
      }
    }
  }

  records.sort((left, right) => compareCodeUnits(canonicalJson(left), canonicalJson(right)))
  const content = {
    compilerOptionsSha256,
    externalPackages: [...externalPackages].sort(compareCodeUnits),
    records,
    repositoryModules: [...repositoryModules].sort(compareCodeUnits),
    schemaVersion: PROTECTED_V2_MODULE_RESOLUTION_AUDIT_SCHEMA_VERSION,
    tsconfigPaths,
  }
  return validateProtectedV2ModuleResolutionAudit({
    ...content,
    sha256: sha256(canonicalJson(content)),
  })
}
