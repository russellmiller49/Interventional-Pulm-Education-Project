import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

export const WARNING_IDS = Object.freeze({
  STALE_BASE: 'WT-WARN-STALE-BASE',
  PATH_OVERLAP: 'WT-WARN-PATH-OVERLAP',
  OWNERSHIP_AMBIGUITY: 'WT-WARN-OWNERSHIP-AMBIGUITY',
  IGNORE_DRIFT: 'WT-WARN-IGNORE-DRIFT',
  UNRELATED_SUITE_FAILURE: 'WT-WARN-UNRELATED-SUITE-FAILURE',
})

export class WtError extends Error {
  constructor(message, code = 'WT-ERROR', details = []) {
    super(message)
    this.name = 'WtError'
    this.code = code
    this.details = details
  }
}

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.encoding ?? 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0 && !options.allowFailure) {
    const detail = String(result.stderr || result.stdout || '').trim()
    throw new WtError(
      `${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`,
      'WT-COMMAND-FAILED',
    )
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

export function git(cwd, args, options = {}) {
  return run('git', args, { ...options, cwd })
}

function absoluteGitPath(topLevel, value) {
  return realpathIfPossible(isAbsolute(value) ? value : resolve(topLevel, value))
}

export function realpathIfPossible(value) {
  try {
    return realpathSync(value)
  } catch {
    return resolve(value)
  }
}

export function discoverGit(cwd = process.cwd()) {
  const topLevel = realpathIfPossible(git(cwd, ['rev-parse', '--show-toplevel']).stdout.trim())
  const commonDir = absoluteGitPath(
    topLevel,
    git(topLevel, ['rev-parse', '--git-common-dir']).stdout.trim(),
  )
  const gitDir = absoluteGitPath(topLevel, git(topLevel, ['rev-parse', '--git-dir']).stdout.trim())
  return { topLevel, commonDir, gitDir }
}

export function parseNullList(value) {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value)
  return text.split('\0').filter(Boolean)
}

export function currentBranch(cwd) {
  const result = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowFailure: true,
  })
  return result.status === 0 ? result.stdout.trim() : null
}

export function parseTaskBranch(branch) {
  const match =
    /^(codex|claude)\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)$/.exec(
      branch || '',
    )
  if (!match) return null
  return { agent: match[1], module: match[2], task: match[3] }
}

export function readJson(pathname, fallback = null) {
  if (!existsSync(pathname)) return fallback
  try {
    return JSON.parse(readFileSync(pathname, 'utf8'))
  } catch (error) {
    throw new WtError(`Invalid JSON at ${pathname}: ${error.message}`, 'WT-INVALID-JSON')
  }
}

export function writeJsonAtomic(pathname, value, mode = 0o600) {
  mkdirSync(dirname(pathname), { recursive: true, mode: 0o700 })
  const temporary = `${pathname}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode,
    flag: 'wx',
  })
  renameSync(temporary, pathname)
  chmodSync(pathname, mode)
}

export function stateRoot(commonDir) {
  return join(commonDir, 'wt')
}

export function worktreeStatePath(gitDir) {
  return join(gitDir, 'wt', 'context.json')
}

export function readWorktreeState(gitDir) {
  return readJson(worktreeStatePath(gitDir), null)
}

export function writeWorktreeState(gitDir, state) {
  writeJsonAtomic(worktreeStatePath(gitDir), state)
}

export function registryPath(topLevel) {
  return join(topLevel, 'config', 'worktrees', 'modules.json')
}

export function flattenOwned(module) {
  return Object.values(module.owned || {}).flat()
}

export function validateRegistry(registry) {
  const errors = []
  if (registry?.version !== 1) errors.push('registry version must be 1')
  if (!Array.isArray(registry?.modules)) errors.push('modules must be an array')
  if (registry?.modules?.length !== 35) {
    errors.push(`expected 35 learner modules; found ${registry?.modules?.length ?? 0}`)
  }
  const ids = new Set()
  for (const module of registry?.modules || []) {
    if (!module.id || ids.has(module.id))
      errors.push(`duplicate or missing module id: ${module.id}`)
    ids.add(module.id)
    for (const key of ['source', 'routes', 'tests', 'documentation', 'assets']) {
      if (!Array.isArray(module.owned?.[key])) {
        errors.push(`${module.id}.owned.${key} must be an array`)
      }
    }
    if (!Array.isArray(module.sharedPaths)) errors.push(`${module.id}.sharedPaths must be an array`)
    if (!Array.isArray(module.exclusivePaths)) {
      errors.push(`${module.id}.exclusivePaths must be an array`)
    }
    if (!(module.externalInputProfile in (registry.inputProfiles || {}))) {
      errors.push(`${module.id} references an unknown external input profile`)
    }
  }
  if (ids.has('platform')) errors.push('platform must be a scope, not a learner module')
  if (!registry?.platformScope || registry.platformScope.id !== 'platform') {
    errors.push('platformScope is missing')
  } else if (!(registry.platformScope.externalInputProfile in (registry.inputProfiles || {}))) {
    errors.push('platformScope references an unknown external input profile')
  }
  for (const [profile, inputs] of Object.entries(registry?.inputProfiles || {})) {
    if (!Array.isArray(inputs)) errors.push(`input profile ${profile} must be an array`)
    for (const input of inputs || []) {
      if (!registry.inputMountTargets?.[input]) {
        errors.push(`input ${input} in profile ${profile} has no declared mount target`)
      }
    }
  }
  if (errors.length) {
    throw new WtError('The worktree registry is invalid.', 'WT-INVALID-REGISTRY', errors)
  }
  return registry
}

export function loadRegistry(topLevel) {
  return validateRegistry(readJson(registryPath(topLevel)))
}

export function listWorktrees(cwd) {
  const text = git(cwd, ['worktree', 'list', '--porcelain']).stdout
  const records = []
  let record = null
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (record) records.push(record)
      record = { path: realpathIfPossible(line.slice('worktree '.length)) }
    } else if (!record) {
      continue
    } else if (line.startsWith('HEAD ')) {
      record.head = line.slice(5)
    } else if (line.startsWith('branch ')) {
      record.branchRef = line.slice(7)
      record.branch = record.branchRef.replace(/^refs\/heads\//, '')
    } else if (line === 'detached') {
      record.detached = true
    } else if (line.startsWith('locked')) {
      record.locked = true
      record.lockReason = line.slice('locked'.length).trim()
    } else if (line.startsWith('prunable')) {
      record.prunable = true
      record.prunableReason = line.slice('prunable'.length).trim()
    }
  }
  if (record) records.push(record)
  return records
}

export function assertDisposableWorktreePath(worktreePath, worktreesRoot) {
  const root = realpathIfPossible(worktreesRoot)
  const target = realpathIfPossible(worktreePath)
  const pathname = relative(root, target)
  const area = pathname.split(sep)[0]
  if (
    !pathname ||
    pathname === '..' ||
    pathname.startsWith(`..${sep}`) ||
    isAbsolute(pathname) ||
    !['active', 'temporary'].includes(area)
  ) {
    throw new WtError(
      `Refusing to dispose a worktree outside ${root}/active or ${root}/temporary: ${target}`,
      'WT-DISPOSAL-PATH',
    )
  }
  return target
}

export function removeDisposableWorktree(control, worktreePath, worktreesRoot) {
  const target = assertDisposableWorktreePath(worktreePath, worktreesRoot)
  const registered = listWorktrees(control).some(
    (worktree) => realpathIfPossible(worktree.path) === target,
  )
  if (!registered) {
    throw new WtError(`Worktree is no longer registered: ${target}`, 'WT-DISPOSAL-UNREGISTERED')
  }
  git(control, ['worktree', 'remove', '--force', target])
  if (existsSync(target)) {
    throw new WtError(
      `Git unregistered the worktree but did not remove its directory: ${target}`,
      'WT-DISPOSAL-INCOMPLETE',
    )
  }
}

export function orphanWorktreeDirectories(cwd, worktreesRoot) {
  const registered = new Set(
    listWorktrees(cwd)
      .filter((worktree) => existsSync(worktree.path))
      .map((worktree) => realpathIfPossible(worktree.path)),
  )
  const orphans = []
  for (const area of ['active', 'temporary', 'review']) {
    const parent = join(resolve(worktreesRoot), area)
    if (!existsSync(parent)) continue
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      const candidate = join(parent, entry.name)
      if (!registered.has(realpathIfPossible(candidate))) orphans.push(candidate)
    }
  }
  return orphans.sort()
}

export function findControlCheckout(cwd, localConfig = null) {
  if (localConfig?.controlCheckout) return realpathIfPossible(localConfig.controlCheckout)
  const main = listWorktrees(cwd).find((item) => item.branch === 'main')
  if (!main) throw new WtError('No main/control worktree is registered.', 'WT-NO-CONTROL')
  return main.path
}

export function localConfigCandidates(cwd, gitInfo = discoverGit(cwd)) {
  const configured = git(cwd, ['config', '--get', 'worktree.localConfigPath'], {
    allowFailure: true,
  }).stdout.trim()
  const control = listWorktrees(cwd).find((item) => item.branch === 'main')?.path
  return [
    process.env.WT_LOCAL_CONFIG,
    configured,
    control
      ? join(dirname(control), 'Interventional-Pulm-Local-Data', 'config', 'worktrees.local.json')
      : null,
    join(
      dirname(gitInfo.topLevel),
      'Interventional-Pulm-Local-Data',
      'config',
      'worktrees.local.json',
    ),
  ].filter(Boolean)
}

export function loadLocalConfig(cwd, { required = true } = {}) {
  const gitInfo = discoverGit(cwd)
  for (const candidate of localConfigCandidates(cwd, gitInfo)) {
    if (existsSync(candidate)) {
      const config = readJson(candidate)
      return { ...config, path: realpathIfPossible(candidate) }
    }
  }
  if (!required) return null
  throw new WtError(
    'Machine-local worktree configuration was not found.',
    'WT-LOCAL-CONFIG-MISSING',
    [
      'Set WT_LOCAL_CONFIG or run:',
      'git config worktree.localConfigPath /absolute/path/to/worktrees.local.json',
    ],
  )
}

export function normalizeRepoPath(value) {
  const normalized = String(value)
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/')
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new WtError(`Unsafe repository path: ${value}`, 'WT-UNSAFE-PATH')
  }
  return normalized.replace(/\/$/, '')
}

export function globToRegExp(glob) {
  const normalized = String(glob).replaceAll('\\', '/')
  let expression = ''
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        index += 1
        if (normalized[index + 1] === '/') {
          index += 1
          expression += '(?:.*/)?'
        } else {
          expression += '.*'
        }
      } else {
        expression += '[^/]*'
      }
    } else if (char === '?') {
      expression += '[^/]'
    } else {
      expression += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }
  return new RegExp(`^${expression}$`)
}

const globCache = new Map()

export function matchesPattern(pathname, pattern) {
  const normalized = String(pathname)
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
  if (!globCache.has(pattern)) globCache.set(pattern, globToRegExp(pattern))
  return globCache.get(pattern).test(normalized)
}

export function matchesAny(pathname, patterns = []) {
  return patterns.some((pattern) => matchesPattern(pathname, pattern))
}

export function moduleById(registry, id) {
  if (id === 'platform') return registry.platformScope
  return registry.modules.find((item) => item.id === id) || null
}

export function moduleOwnedPatterns(module) {
  return module.id === 'platform' ? module.ownedPaths || [] : flattenOwned(module)
}

export function effectiveSharedPaths(registry, module) {
  return [...(registry.defaultSharedPaths || []), ...(module.sharedPaths || [])]
}

export function ownersForPath(registry, pathname) {
  return registry.modules
    .filter((module) => matchesAny(pathname, moduleOwnedPatterns(module)))
    .map((module) => module.id)
}

export function protectedLeaseForPath(registry, pathname) {
  return (
    registry.protectedSharedPaths.find((item) => matchesPattern(pathname, item.pattern)) || null
  )
}

export function inferContext(cwd, registry = null, localConfig = null) {
  const gitInfo = discoverGit(cwd)
  const branch = currentBranch(gitInfo.topLevel)
  const parsed = parseTaskBranch(branch)
  const state = readWorktreeState(gitInfo.gitDir)
  const config = localConfig || loadLocalConfig(cwd, { required: false })
  const controlPath = config?.controlCheckout
    ? realpathIfPossible(config.controlCheckout)
    : listWorktrees(cwd).find((item) => item.branch === 'main')?.path
  let role = state?.role
  if (!role) {
    if (controlPath && gitInfo.topLevel === realpathIfPossible(controlPath)) role = 'control'
    else if (gitInfo.topLevel.includes(`${sep}review${sep}`)) role = 'review'
    else if (gitInfo.topLevel.includes(`${sep}temporary${sep}`)) role = 'temporary'
    else role = 'active'
  }
  const agent = state?.agent || parsed?.agent || (role === 'review' ? 'review' : null)
  const module = state?.module || parsed?.module || (role === 'review' ? 'platform' : null)
  const task = state?.task || parsed?.task || null
  const port =
    state?.port ??
    (role === 'review'
      ? 3100
      : role === 'active' && agent === 'codex'
        ? 3110
        : role === 'active' && agent === 'claude'
          ? 3120
          : null)
  return {
    ...state,
    role,
    agent,
    module,
    task,
    port,
    branch,
    detached: !branch,
    topLevel: gitInfo.topLevel,
    commonDir: gitInfo.commonDir,
    gitDir: gitInfo.gitDir,
    registered: Boolean(state),
    moduleDefinition: registry && module ? moduleById(registry, module) : null,
  }
}

export function gitOperation(cwd, gitDir = discoverGit(cwd).gitDir) {
  const candidates = [
    ['merge', 'MERGE_HEAD'],
    ['cherry-pick', 'CHERRY_PICK_HEAD'],
    ['revert', 'REVERT_HEAD'],
    ['bisect', 'BISECT_LOG'],
    ['rebase', 'rebase-merge'],
    ['rebase', 'rebase-apply'],
    ['sequencer', 'sequencer'],
  ]
  return candidates.find(([, path]) => existsSync(join(gitDir, path)))?.[0] || null
}

export function statusPaths(cwd, { staged = false } = {}) {
  const args = staged
    ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRDTUXB']
    : ['status', '--porcelain=v1', '-z', '--untracked-files=all']
  const output = git(cwd, args, { encoding: 'buffer' }).stdout
  if (staged) return parseNullList(output).map(normalizeRepoPath)
  const entries = parseNullList(output)
  const paths = []
  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index]
    const code = item.slice(0, 2)
    const pathname = item.slice(3)
    if (code.includes('R') || code.includes('C')) {
      paths.push(normalizeRepoPath(entries[index + 1]))
      index += 1
    } else {
      paths.push(normalizeRepoPath(pathname))
    }
  }
  return [...new Set(paths)]
}

export function diffNameStatus(cwd, args) {
  const output = git(cwd, ['diff', '--name-status', '-z', ...args], {
    encoding: 'buffer',
  }).stdout
  const tokens = parseNullList(output)
  const entries = []
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index]
    index += 1
    if (!/^[A-Z][0-9]*$/.test(status) || index >= tokens.length) {
      throw new WtError('Unable to parse git diff --name-status output.', 'WT-DIFF-PARSE')
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      const source = normalizeRepoPath(tokens[index])
      const pathname = normalizeRepoPath(tokens[index + 1])
      index += 2
      entries.push({ path: pathname, sourcePath: source, status, deleted: false })
    } else {
      const pathname = normalizeRepoPath(tokens[index])
      index += 1
      entries.push({ path: pathname, status, deleted: status === 'D' })
    }
  }
  return entries
}

export function isDirty(cwd) {
  return git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal']).stdout.trim().length > 0
}

export function divergence(cwd, base = 'origin/main') {
  const result = git(cwd, ['rev-list', '--left-right', '--count', `${base}...HEAD`], {
    allowFailure: true,
  })
  if (result.status !== 0) return { behind: null, ahead: null }
  const [behind, ahead] = result.stdout.trim().split(/\s+/).map(Number)
  return { behind, ahead }
}

export function changedFromBase(cwd, base = 'origin/main') {
  const committed = git(cwd, ['diff', '--name-only', '-z', `${base}...HEAD`], {
    encoding: 'buffer',
    allowFailure: true,
  })
  const paths = committed.status === 0 ? parseNullList(committed.stdout).map(normalizeRepoPath) : []
  return [...new Set([...paths, ...statusPaths(cwd)])]
}

export function relevantUntracked(cwd, patterns) {
  const output = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'], {
    encoding: 'buffer',
  }).stdout
  return parseNullList(output)
    .map(normalizeRepoPath)
    .filter((pathname) => matchesAny(pathname, patterns))
    .slice(0, 200)
}

export function ignoredWithProvenance(cwd, patterns) {
  const output = git(
    cwd,
    ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
    { encoding: 'buffer' },
  ).stdout
  const relevant = parseNullList(output)
    .map((pathname) => pathname.replace(/\/$/, ''))
    .filter((pathname) => matchesAny(pathname, patterns))
    .slice(0, 100)
  return relevant.map((pathname) => {
    const result = git(cwd, ['check-ignore', '-v', '--', pathname], { allowFailure: true })
    const [source = '', line = '', pattern = ''] =
      result.stdout.trim().split('\t')[0]?.split(':') || []
    return {
      path: pathname,
      source,
      line: Number(line) || null,
      pattern,
      raw: result.stdout.trim() || null,
    }
  })
}

export function ignoreDrift(cwd, base = 'origin/main') {
  const committed = git(cwd, ['diff', '--quiet', `${base}...HEAD`, '--', '.gitignore'], {
    allowFailure: true,
  }).status
  const local = git(cwd, ['diff', '--quiet', 'HEAD', '--', '.gitignore'], {
    allowFailure: true,
  }).status
  return committed === 1 || local === 1
}

function ownerKey(context) {
  return createHash('sha256')
    .update(`${context.topLevel}\0${context.branch || 'detached'}`)
    .digest('hex')
    .slice(0, 24)
}

function resourceKey(resource) {
  const label = resource.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48) || 'resource'
  const digest = createHash('sha256').update(resource).digest('hex').slice(0, 16)
  return `${label}-${digest}`
}

export function leasesRoot(commonDir) {
  return join(stateRoot(commonDir), 'leases')
}

function normalLeaseDir(commonDir, resource) {
  return join(leasesRoot(commonDir), 'resources', `${resourceKey(resource)}.lock`)
}

function supabaseRoot(commonDir) {
  return join(leasesRoot(commonDir), 'supabase')
}

function leaseMetadata(pathname) {
  return readJson(join(pathname, 'metadata.json'), null)
}

function writeLease(pathname, metadata) {
  writeJsonAtomic(join(pathname, 'metadata.json'), metadata)
}

function acquireGate(gate) {
  mkdirSync(dirname(gate), { recursive: true, mode: 0o700 })
  try {
    mkdirSync(gate, { mode: 0o700 })
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new WtError('Supabase lease coordination is busy; retry.', 'WT-LEASE-BUSY')
    }
    throw error
  }
  try {
    const snapshot = processSnapshot(process.pid)
    writeJsonAtomic(join(gate, 'metadata.json'), {
      pid: process.pid,
      processStartTime: snapshot?.startTime || null,
      command: snapshot?.command || null,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    rmSync(gate, { recursive: true, force: true })
    throw error
  }
}

function releaseGate(gate) {
  rmSync(gate, { recursive: true, force: true })
}

export function canonicalLeaseResource(request, registry) {
  const value = String(request)
  if (value === 'supabase-read') return { resource: value, kind: 'supabase-read' }
  if (/^supabase-(mutate|migrate|reset|seed|import|upload|start|prepare|stop)$/.test(value)) {
    return {
      resource: value,
      kind: 'supabase-mutation',
      operation: value.slice('supabase-'.length),
    }
  }
  const pathname = normalizeRepoPath(value)
  const protectedPath = protectedLeaseForPath(registry, pathname)
  return {
    resource: protectedPath?.lease || pathname,
    kind: protectedPath?.lease === 'supabase-mutate' ? 'supabase-mutation' : 'exclusive',
    operation: protectedPath?.lease === 'supabase-mutate' ? 'migrate' : null,
    path: pathname,
  }
}

function baseLeaseMetadata(context, descriptor, reason) {
  return {
    schemaVersion: 1,
    resource: descriptor.resource,
    kind: descriptor.kind,
    operation: descriptor.operation || null,
    reason,
    owner: {
      key: ownerKey(context),
      worktree: context.topLevel,
      branch: context.branch,
      module: context.module,
      agent: context.agent,
    },
    createdAt: new Date().toISOString(),
  }
}

export function acquireLease(commonDir, context, descriptor, reason) {
  if (
    !context.branch ||
    context.detached ||
    context.role === 'control' ||
    context.role === 'review'
  ) {
    throw new WtError('Leases require an attached task worktree.', 'WT-LEASE-CONTEXT')
  }
  if (!reason?.trim()) throw new WtError('A non-empty --reason is required.', 'WT-LEASE-REASON')
  const metadata = baseLeaseMetadata(context, descriptor, reason.trim())
  if (descriptor.kind === 'supabase-read' || descriptor.kind === 'supabase-mutation') {
    const root = supabaseRoot(commonDir)
    const gate = join(root, 'gate.lock')
    acquireGate(gate)
    try {
      const mutation = join(root, 'mutation.lock')
      const readers = join(root, 'readers')
      mkdirSync(readers, { recursive: true, mode: 0o700 })
      if (descriptor.kind === 'supabase-read') {
        if (existsSync(mutation)) {
          throw new WtError(
            `Supabase mutation lease is held by ${leaseMetadata(mutation)?.owner?.branch || 'another task'}.`,
            'WT-LEASE-CONFLICT',
          )
        }
        const target = join(readers, `${ownerKey(context)}.lock`)
        try {
          mkdirSync(target, { mode: 0o700 })
        } catch (error) {
          if (error.code === 'EEXIST') {
            throw new WtError('This worktree already holds a Supabase read lease.', 'WT-LEASE-HELD')
          }
          throw error
        }
        try {
          writeLease(target, metadata)
        } catch (error) {
          rmSync(target, { recursive: true, force: true })
          throw error
        }
        return metadata
      }
      const readerNames = readdirSync(readers).filter((name) => name.endsWith('.lock'))
      if (readerNames.length) {
        const owners = readerNames
          .map((name) => leaseMetadata(join(readers, name))?.owner?.branch)
          .filter(Boolean)
        throw new WtError(
          `Supabase has active read lease(s): ${owners.join(', ') || readerNames.length}.`,
          'WT-LEASE-CONFLICT',
        )
      }
      try {
        mkdirSync(mutation, { mode: 0o700 })
      } catch (error) {
        if (error.code === 'EEXIST') {
          throw new WtError(
            `Supabase mutation lease is held by ${leaseMetadata(mutation)?.owner?.branch || 'another task'}.`,
            'WT-LEASE-CONFLICT',
          )
        }
        throw error
      }
      try {
        writeLease(mutation, metadata)
      } catch (error) {
        rmSync(mutation, { recursive: true, force: true })
        throw error
      }
      return metadata
    } finally {
      releaseGate(gate)
    }
  }

  const target = normalLeaseDir(commonDir, descriptor.resource)
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
  try {
    mkdirSync(target, { mode: 0o700 })
  } catch (error) {
    if (error.code === 'EEXIST') {
      const current = leaseMetadata(target)
      throw new WtError(
        `${descriptor.resource} is claimed by ${current?.owner?.branch || 'another task'}${current?.reason ? `: ${current.reason}` : ''}.`,
        'WT-LEASE-CONFLICT',
      )
    }
    throw error
  }
  try {
    writeLease(target, metadata)
  } catch (error) {
    rmSync(target, { recursive: true, force: true })
    throw error
  }
  return metadata
}

export function listLeases(commonDir) {
  const root = leasesRoot(commonDir)
  const leases = []
  const resources = join(root, 'resources')
  if (existsSync(resources)) {
    for (const name of readdirSync(resources)) {
      if (!name.endsWith('.lock')) continue
      const pathname = join(resources, name)
      const metadata = leaseMetadata(pathname)
      if (metadata) leases.push({ ...metadata, leasePath: pathname })
    }
  }
  const supabase = supabaseRoot(commonDir)
  const mutation = join(supabase, 'mutation.lock')
  if (existsSync(mutation)) {
    const metadata = leaseMetadata(mutation)
    if (metadata) leases.push({ ...metadata, leasePath: mutation })
  }
  const readers = join(supabase, 'readers')
  if (existsSync(readers)) {
    for (const name of readdirSync(readers)) {
      if (!name.endsWith('.lock')) continue
      const pathname = join(readers, name)
      const metadata = leaseMetadata(pathname)
      if (metadata) leases.push({ ...metadata, leasePath: pathname })
    }
  }
  return leases
}

export function ownedLeases(commonDir, context) {
  const key = ownerKey(context)
  return listLeases(commonDir).filter((lease) => lease.owner?.key === key)
}

export function leaseOwnedForResource(commonDir, context, resource) {
  const key = ownerKey(context)
  if (resource === 'supabase-mutate') {
    return listLeases(commonDir).some(
      (lease) => lease.kind === 'supabase-mutation' && lease.owner?.key === key,
    )
  }
  return listLeases(commonDir).some(
    (lease) => lease.resource === resource && lease.owner?.key === key,
  )
}

export function releaseLease(commonDir, context, descriptor, { force = false } = {}) {
  const key = ownerKey(context)
  let lease
  if (descriptor.kind === 'supabase-read') {
    const target = join(supabaseRoot(commonDir), 'readers', `${key}.lock`)
    lease = { leasePath: target, ...leaseMetadata(target) }
  } else if (descriptor.kind === 'supabase-mutation') {
    const target = join(supabaseRoot(commonDir), 'mutation.lock')
    lease = { leasePath: target, ...leaseMetadata(target) }
  } else {
    const target = normalLeaseDir(commonDir, descriptor.resource)
    lease = { leasePath: target, ...leaseMetadata(target) }
  }
  if (!lease.leasePath || !existsSync(lease.leasePath)) {
    throw new WtError(`No lease exists for ${descriptor.resource}.`, 'WT-LEASE-NOT-FOUND')
  }
  if (!force && lease.owner?.key !== key) {
    throw new WtError(
      `${descriptor.resource} is owned by ${lease.owner?.branch || 'another task'}.`,
      'WT-LEASE-NOT-OWNER',
    )
  }
  rmSync(lease.leasePath, { recursive: true, force: false })
  return lease
}

export function ensureNoHeldLeases(commonDir, context) {
  const leases = ownedLeases(commonDir, context)
  if (leases.length) {
    throw new WtError(
      'Release this worktree’s leases before finishing.',
      'WT-LEASES-HELD',
      leases.map((lease) => lease.resource),
    )
  }
}

export function scopeReport({ cwd, registry, moduleId, files, context, ci = false }) {
  const module = moduleById(registry, moduleId)
  if (!module) {
    return {
      errors: [{ code: 'WT-MODULE-UNKNOWN', message: `Unknown module scope: ${moduleId}` }],
      warnings: [],
      files: [],
    }
  }
  const owned = moduleOwnedPatterns(module)
  const shared = effectiveSharedPaths(registry, module)
  const errors = []
  const warnings = []
  const reports = []

  for (const original of files) {
    const pathname = normalizeRepoPath(typeof original === 'string' ? original : original.path)
    const deleted = typeof original === 'object' && original.deleted === true
    const owners = ownersForPath(registry, pathname)
    const blocked = matchesAny(pathname, registry.blockedPaths)
    const ownedHere = matchesAny(pathname, owned)
    const sharedHere = matchesAny(pathname, shared)
    const explicitExclusive = matchesAny(pathname, module.exclusivePaths || [])
    const protectedPath = protectedLeaseForPath(registry, pathname)
    const platformCrossModule = moduleId === 'platform' && !protectedPath
    let disposition = 'owned'

    if (blocked && !deleted) {
      disposition = 'blocked'
      errors.push({
        code: 'WT-BLOCKED-PATH',
        path: pathname,
        message: `${pathname} is private, generated, or worktree-local and may not be staged.`,
      })
    } else if (blocked && deleted) {
      disposition = 'private-removal'
    } else if (!ownedHere && !sharedHere && !platformCrossModule) {
      disposition = owners.length || explicitExclusive ? 'exclusive-other-module' : 'out-of-scope'
      errors.push({
        code: owners.length || explicitExclusive ? 'WT-EXCLUSIVE-PATH' : 'WT-OUT-OF-SCOPE',
        path: pathname,
        message: owners.length
          ? `${pathname} belongs to ${owners.join(', ')}.`
          : explicitExclusive
            ? `${pathname} is explicitly reserved for another scope.`
            : `${pathname} is not declared for ${moduleId}.`,
      })
    } else if (protectedPath) {
      disposition = 'shared'
      if (!sharedHere) {
        errors.push({
          code: 'WT-UNDECLARED-SHARED-PATH',
          path: pathname,
          message: `${pathname} is protected but not declared as shared for ${moduleId}.`,
        })
      } else if (!ci && !leaseOwnedForResource(context.commonDir, context, protectedPath.lease)) {
        errors.push({
          code: 'WT-SHARED-LEASE-REQUIRED',
          path: pathname,
          message: `Claim ${protectedPath.lease} before staging ${pathname}.`,
        })
      }
    } else if (owners.length > 1) {
      disposition = 'ambiguous'
      warnings.push({
        id: WARNING_IDS.OWNERSHIP_AMBIGUITY,
        path: pathname,
        message: `${pathname} matches multiple module owners: ${owners.join(', ')}.`,
      })
    } else if (!ownedHere && platformCrossModule) {
      disposition = 'platform-cross-module'
    }
    reports.push({ path: pathname, disposition, owners, deleted })
  }
  return { errors, warnings, files: reports }
}

export function ensureGuardContext(context, registry, { ci = false, branchOverride = null } = {}) {
  const branch = branchOverride || context.branch
  const parsed = parseTaskBranch(branch)
  if (!ci && context.role === 'control') {
    throw new WtError('Commits are blocked in the control checkout.', 'WT-CONTROL-COMMIT')
  }
  if (!ci && context.detached) {
    throw new WtError('Commits are blocked while HEAD is detached.', 'WT-DETACHED-COMMIT')
  }
  if (!parsed) {
    throw new WtError(
      `Task branch must match codex/<module>/<task> or claude/<module>/<task>; found ${branch || 'detached HEAD'}.`,
      'WT-BRANCH-NAME',
    )
  }
  if (!moduleById(registry, parsed.module)) {
    throw new WtError(`Branch names unknown module ${parsed.module}.`, 'WT-MODULE-UNKNOWN')
  }
  if (!ci && context.module && context.module !== parsed.module) {
    throw new WtError(
      `Branch module ${parsed.module} does not match registered module ${context.module}.`,
      'WT-BRANCH-MODULE-MISMATCH',
    )
  }
  const operation = gitOperation(context.topLevel, context.gitDir)
  if (!ci && operation) {
    throw new WtError(`Active Git operation detected: ${operation}.`, 'WT-GIT-OPERATION')
  }
  return parsed
}

export function overlapWarnings(cwd, context, base = 'origin/main') {
  const current = new Set(changedFromBase(cwd, base))
  if (!current.size) return []
  const warnings = []
  for (const worktree of listWorktrees(cwd)) {
    if (worktree.path === context.topLevel || !worktree.branch || !existsSync(worktree.path))
      continue
    const otherPaths = changedFromBase(worktree.path, base)
    const overlap = otherPaths.filter((pathname) => current.has(pathname))
    if (overlap.length) {
      warnings.push({
        id: WARNING_IDS.PATH_OVERLAP,
        branch: worktree.branch,
        worktree: worktree.path,
        paths: overlap.slice(0, 50),
        message: `${overlap.length} changed path(s) overlap ${worktree.branch}.`,
      })
    }
  }
  return warnings
}

export function processSnapshot(pid) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return null
  const start = run('ps', ['-p', String(pid), '-o', 'lstart='], {
    allowFailure: true,
  })
  if (start.status !== 0 || !start.stdout.trim()) return null
  const command = run('ps', ['-p', String(pid), '-o', 'command='], {
    allowFailure: true,
  })
  if (command.status !== 0) return null
  return { pid: Number(pid), startTime: start.stdout.trim(), command: command.stdout.trim() }
}

export function processRecords(commonDir) {
  const root = join(stateRoot(commonDir), 'processes')
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ ...readJson(join(root, name)), recordPath: join(root, name) }))
}

export function validateProcessRecord(record) {
  const snapshot = processSnapshot(record.pid)
  if (!snapshot) return { valid: false, reason: 'pid-not-running', snapshot: null }
  if (snapshot.startTime !== record.processStartTime) {
    return { valid: false, reason: 'pid-reused', snapshot }
  }
  if (
    record.expectedCommand &&
    !snapshot.command.includes(record.expectedCommand) &&
    snapshot.command !== record.command
  ) {
    return { valid: false, reason: 'wrong-command', snapshot }
  }
  let listenerSnapshot = null
  if (record.listenerPid) {
    listenerSnapshot = processSnapshot(record.listenerPid)
    if (!listenerSnapshot) {
      return {
        valid: false,
        reason: 'listener-pid-not-running',
        snapshot,
        listenerSnapshot: null,
      }
    }
    if (listenerSnapshot.startTime !== record.listenerProcessStartTime) {
      return {
        valid: false,
        reason: 'listener-pid-reused',
        snapshot,
        listenerSnapshot,
      }
    }
    if (
      record.expectedListenerCommand &&
      !listenerSnapshot.command.includes(record.expectedListenerCommand) &&
      listenerSnapshot.command !== record.listenerCommand
    ) {
      return {
        valid: false,
        reason: 'wrong-listener-command',
        snapshot,
        listenerSnapshot,
      }
    }
  }
  return { valid: true, reason: null, snapshot, listenerSnapshot }
}

export function processRecordPath(commonDir, port) {
  return join(stateRoot(commonDir), 'processes', `port-${port}.json`)
}

export function allocateTemporaryPort(commonDir, states = []) {
  const occupied = new Set([
    ...processRecords(commonDir).map((record) => Number(record.port)),
    ...states.map((state) => Number(state.port)).filter(Boolean),
  ])
  for (let port = 3130; port <= 3149; port += 1) {
    if (!occupied.has(port)) return port
  }
  throw new WtError('No temporary dev ports are available in 3130–3149.', 'WT-NO-PORT')
}

export function stateForWorktree(worktree) {
  if (!existsSync(worktree.path)) return null
  try {
    return readWorktreeState(discoverGit(worktree.path).gitDir)
  } catch {
    return null
  }
}

export function allWorktreeStates(cwd) {
  return listWorktrees(cwd).map((worktree) => ({ worktree, state: stateForWorktree(worktree) }))
}

export function ensureCommonExclude(commonDir) {
  const pathname = join(commonDir, 'info', 'exclude')
  mkdirSync(dirname(pathname), { recursive: true })
  const start = '# BEGIN managed by wt (universal local-only paths)'
  const end = '# END managed by wt'
  const blockLines = [
    start,
    '/.wt-runtime/',
    '/.claude/settings.local.json',
    '/.claude/scheduled_tasks.lock',
    '/.claude/scheduled_tasks.json',
    '/.claude/routines/.state/',
    '/.claude/worktrees/',
    '/.claude/checkpoints/',
    '/.claude/mailbox/',
    '/.claude/agent-registry.json',
    '/.claude/agent-memory-local',
    '/.claude/first-run',
    '/.claude/assistant-daemon-state.json',
    '/local-data/',
    '/public/ecmo-teaching-preview/',
    '/playwright-report/',
    '/test-results/',
    end,
  ]
  const existing = existsSync(pathname) ? readFileSync(pathname, 'utf8') : ''
  const newline = existing.includes('\r\n') ? '\r\n' : '\n'
  const block = blockLines.join(newline)
  const startMatches = [
    ...existing.matchAll(/^# BEGIN managed by wt \(universal local-only paths\)\r?$/gm),
  ]
  const endMatches = [...existing.matchAll(/^# END managed by wt\r?$/gm)]
  if (startMatches.length !== endMatches.length || startMatches.length > 1) {
    throw new WtError(
      `Managed exclude markers are malformed in ${pathname}; repair them before continuing.`,
      'WT-COMMON-EXCLUDE-MALFORMED',
    )
  }
  const startMatch = startMatches[0]
  const endMatch = endMatches[0]
  if (startMatch && endMatch.index < startMatch.index) {
    throw new WtError(
      `Managed exclude markers are out of order in ${pathname}; repair them before continuing.`,
      'WT-COMMON-EXCLUDE-MALFORMED',
    )
  }
  const content =
    startMatch && endMatch
      ? `${existing.slice(0, startMatch.index)}${block}${existing.slice(endMatch.index + endMatch[0].length)}`
      : `${existing}${existing && !existing.endsWith(newline) ? newline : ''}${block}${newline}`
  writeFileSync(pathname, content, { encoding: 'utf8', mode: 0o600 })
  return pathname
}

export function gitignoreLiteralPath(value) {
  const pathname = normalizeRepoPath(value)
  let escaped = ''
  for (const character of pathname) {
    escaped += ['\\', '*', '?', '[', ']'].includes(character) ? `\\${character}` : character
  }
  return `/${escaped}`
}

export function worktreeExcludeRules(registry, moduleId) {
  return [
    '# Per-worktree local-only paths',
    '/.agent-scratch/',
    '/.wt-local/',
    '# Approved read-only external mounts',
    ...requiredInputs(registry, moduleId).map((inputName) =>
      gitignoreLiteralPath(registry.inputMountTargets[inputName]),
    ),
  ]
}

export function configureWorktreeExclude(cwd, gitDir, registry, moduleId) {
  const pathname = join(gitDir, 'wt', 'exclude')
  mkdirSync(dirname(pathname), { recursive: true, mode: 0o700 })
  writeFileSync(pathname, `${worktreeExcludeRules(registry, moduleId).join('\n')}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  git(cwd, ['config', '--worktree', 'core.excludesFile', pathname])
  return pathname
}

export function configureWorktreeHooks(cwd) {
  git(cwd, ['config', '--worktree', 'core.hooksPath', '.husky'])
  return '.husky'
}

export function mountTarget(topLevel, registry, inputName) {
  const configured = registry.inputMountTargets?.[inputName]
  if (!configured) {
    throw new WtError(`No mount target is declared for ${inputName}.`, 'WT-MOUNT-TARGET')
  }
  const normalized = normalizeRepoPath(configured)
  return join(topLevel, ...normalized.split('/'))
}

export function requiredInputs(registry, moduleId) {
  const module = moduleById(registry, moduleId)
  if (!module) throw new WtError(`Unknown module: ${moduleId}`, 'WT-MODULE-UNKNOWN')
  const profile = registry.inputProfiles[module.externalInputProfile]
  if (!profile) {
    throw new WtError(`Unknown input profile: ${module.externalInputProfile}`, 'WT-INPUT-PROFILE')
  }
  return profile
}

function sourceIsReadOnly(source) {
  return (statSync(source).mode & 0o222) === 0
}

function lstatIfExists(pathname) {
  try {
    return lstatSync(pathname)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export function validateMounts(topLevel, registry, moduleId, localConfig) {
  const results = []
  for (const inputName of requiredInputs(registry, moduleId)) {
    const source = localConfig.inputs?.[inputName]
    const target = mountTarget(topLevel, registry, inputName)
    let status = 'ok'
    let detail = null
    if (!source || !existsSync(source)) {
      status = 'missing-source'
      detail = source || 'not configured'
    } else if (!lstatIfExists(target)) {
      status = 'missing-mount'
    } else {
      const info = lstatSync(target)
      if (!info.isSymbolicLink()) {
        status = 'not-symlink'
      } else {
        const actual = realpathIfPossible(target)
        const expected = realpathIfPossible(source)
        if (actual !== expected) {
          status = 'wrong-target'
          detail = actual
        } else if (!sourceIsReadOnly(source)) {
          status = 'source-writable'
        }
      }
    }
    results.push({ input: inputName, source, target, status, detail })
  }
  return results
}

export function provisionMounts(topLevel, registry, moduleId, localConfig) {
  const inputs = requiredInputs(registry, moduleId)
  for (const inputName of inputs) {
    const source = localConfig.inputs?.[inputName]
    if (!source || !existsSync(source)) {
      throw new WtError(
        `Required external input ${inputName} is missing: ${source || 'not configured'}`,
        'WT-MOUNT-SOURCE-MISSING',
      )
    }
    if (!sourceIsReadOnly(source)) {
      throw new WtError(
        `External input ${inputName} is writable; make the source read-only before mounting it.`,
        'WT-MOUNT-SOURCE-WRITABLE',
      )
    }
    const target = mountTarget(topLevel, registry, inputName)
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
    const targetInfo = lstatIfExists(target)
    if (targetInfo) {
      if (!targetInfo.isSymbolicLink()) {
        throw new WtError(
          `Mount target already exists and is not a symlink: ${target}`,
          'WT-MOUNT-TARGET',
        )
      }
      if (realpathIfPossible(target) !== realpathIfPossible(source)) {
        throw new WtError(`Mount target points to the wrong source: ${target}`, 'WT-MOUNT-TARGET')
      }
      continue
    }
    symlinkSync(source, target, statSync(source).isDirectory() ? 'dir' : 'file')
  }
  const invalid = validateMounts(topLevel, registry, moduleId, localConfig).filter(
    (item) => item.status !== 'ok',
  )
  if (invalid.length) {
    throw new WtError('One or more external mounts failed validation.', 'WT-MOUNT-INVALID', invalid)
  }
  return validateMounts(topLevel, registry, moduleId, localConfig)
}

export function staleLeaseFindings(cwd, commonDir) {
  const worktrees = new Map(listWorktrees(cwd).map((item) => [item.path, item]))
  return listLeases(commonDir)
    .map((lease) => {
      const ownerPath = lease.owner?.worktree && realpathIfPossible(lease.owner.worktree)
      const worktree = ownerPath ? worktrees.get(ownerPath) : null
      if (!worktree) return { lease, stale: true, reason: 'owner-worktree-missing' }
      if (worktree.branch !== lease.owner?.branch) {
        return { lease, stale: true, reason: 'owner-branch-changed' }
      }
      return { lease, stale: false, reason: null }
    })
    .filter((item) => item.stale)
}

export function appendAcknowledgements(gitDir, ids) {
  if (!ids.length) return
  const state = readWorktreeState(gitDir) || {}
  const acknowledgements = new Set(state.acknowledgements || [])
  for (const id of ids) acknowledgements.add(id)
  writeWorktreeState(gitDir, { ...state, acknowledgements: [...acknowledgements].sort() })
}

export function deleteSymlink(pathname) {
  if (existsSync(pathname) && lstatSync(pathname).isSymbolicLink()) unlinkSync(pathname)
}

export function relativeTo(root, pathname) {
  return relative(root, pathname).split(sep).join('/')
}

export function exclusiveCreateJson(pathname, value) {
  mkdirSync(dirname(pathname), { recursive: true, mode: 0o700 })
  const fd = openSync(pathname, 'wx', 0o600)
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  } finally {
    closeSync(fd)
  }
}
