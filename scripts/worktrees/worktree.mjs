#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  WARNING_IDS,
  WtError,
  acquireLease,
  allWorktreeStates,
  allocateTemporaryPort,
  appendAcknowledgements,
  canonicalLeaseResource,
  configureWorktreeExclude,
  configureWorktreeHooks,
  discoverGit,
  diffNameStatus,
  divergence,
  effectiveSharedPaths,
  ensureCommonExclude,
  ensureGuardContext,
  ensureNoHeldLeases,
  exclusiveCreateJson,
  findControlCheckout,
  git,
  gitOperation,
  ignoreDrift,
  ignoredWithProvenance,
  inferContext,
  isDirty,
  listLeases,
  listWorktrees,
  loadLocalConfig,
  loadRegistry,
  matchesAny,
  moduleById,
  moduleOwnedPatterns,
  orphanWorktreeDirectories,
  overlapWarnings,
  parseTaskBranch,
  processRecordPath,
  processRecords,
  processSnapshot,
  protectedLeaseForPath,
  provisionMounts,
  relevantUntracked,
  readJson,
  readWorktreeState,
  registryPath,
  releaseLease,
  removeDisposableWorktree,
  requiredInputs,
  run,
  scopeReport,
  staleLeaseFindings,
  stateForWorktree,
  validateMounts,
  validateProcessRecord,
  worktreeExcludeRules,
  writeJsonAtomic,
  writeWorktreeState,
} from './lib.mjs'

function usage() {
  return `Usage:
  npm run wt -- context [--json]
  npm run wt -- start <codex|claude> <module|platform> <task> [--resume] [--ack <warning-id>]
  npm run wt -- finish [--ack <warning-id>] [--delete-branch]
  npm run wt -- doctor [--json]
  npm run wt -- dev
  npm run wt -- claim <path-or-resource>... --reason <text>
  npm run wt -- release <path-or-resource>...

Supabase resources:
  supabase-read
  supabase-migrate | supabase-reset | supabase-seed | supabase-import | supabase-upload
  supabase-start | supabase-prepare | supabase-stop
`
}

function parseArguments(argv) {
  const positionals = []
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) {
      positionals.push(value)
      continue
    }
    const [rawName, inline] = value.slice(2).split('=', 2)
    if (['resume', 'delete-branch', 'json', 'ci'].includes(rawName)) {
      options[rawName] = true
      continue
    }
    const optionValue = inline ?? argv[index + 1]
    if (inline === undefined) index += 1
    if (optionValue === undefined) {
      throw new WtError(`--${rawName} requires a value.`, 'WT-ARGUMENT')
    }
    if (rawName === 'ack') {
      options.ack = [...(options.ack || []), ...optionValue.split(',').filter(Boolean)]
    } else {
      options[rawName] = optionValue
    }
  }
  return { positionals, options }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function printWarnings(warnings, acknowledged = []) {
  for (const warning of warnings) {
    const ack = acknowledged.includes(warning.id) ? ' (acknowledged)' : ''
    console.warn(`warning [${warning.id}]${ack}: ${warning.message}`)
    for (const pathname of warning.paths || []) console.warn(`  ${pathname}`)
  }
}

function printError(error) {
  if (error instanceof WtError) {
    console.error(`error [${error.code}]: ${error.message}`)
    for (const detail of error.details || []) {
      console.error(`  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
    }
  } else {
    console.error(error?.stack || String(error))
  }
}

function modulePatterns(registry, moduleId) {
  const module = moduleById(registry, moduleId)
  if (!module) return []
  return [...moduleOwnedPatterns(module), ...effectiveSharedPaths(registry, module)]
}

function contextSnapshot(cwd) {
  const registry = loadRegistry(cwd)
  const localConfig = loadLocalConfig(cwd, { required: false })
  const context = inferContext(cwd, registry, localConfig)
  const patterns = context.module ? modulePatterns(registry, context.module) : []
  const branchDivergence = divergence(context.topLevel)
  const warnings = []
  if (branchDivergence.behind > 0) {
    warnings.push({
      id: WARNING_IDS.STALE_BASE,
      message: `Branch is ${branchDivergence.behind} commit(s) behind origin/main.`,
    })
  }
  if (ignoreDrift(context.topLevel)) {
    warnings.push({
      id: WARNING_IDS.IGNORE_DRIFT,
      message: '.gitignore differs from origin/main.',
    })
  }
  warnings.push(...overlapWarnings(context.topLevel, context))
  const worktrees = allWorktreeStates(cwd).map(({ worktree, state }) => ({
    path: worktree.path,
    branch: worktree.branch || null,
    head: worktree.head,
    detached: Boolean(worktree.detached),
    locked: Boolean(worktree.locked),
    prunable: Boolean(worktree.prunable),
    role: state?.role || null,
    module: state?.module || parseTaskBranch(worktree.branch)?.module || null,
    port: state?.port || null,
    registered: Boolean(state),
    dirty: existsSync(worktree.path) ? isDirty(worktree.path) : null,
  }))
  const processes = processRecords(context.commonDir).map((record) => ({
    ...record,
    validation: validateProcessRecord(record),
  }))
  const mounts =
    localConfig && context.module
      ? validateMounts(context.topLevel, registry, context.module, localConfig)
      : []
  return {
    context: {
      role: context.role,
      agent: context.agent,
      module: context.module,
      task: context.task,
      branch: context.branch,
      detached: context.detached,
      registered: context.registered,
      worktree: context.topLevel,
      gitDir: context.gitDir,
      commonGitDir: context.commonDir,
      port: context.port,
      dirty: isDirty(context.topLevel),
      gitOperation: gitOperation(context.topLevel, context.gitDir),
      divergence: branchDivergence,
    },
    registry: {
      path: registryPath(context.topLevel),
      modules: registry.modules.length,
      platformIsSeparateScope: !registry.modules.some((module) => module.id === 'platform'),
    },
    localConfig: localConfig?.path || null,
    worktrees,
    leases: listLeases(context.commonDir),
    processes,
    mounts,
    untracked: patterns.length
      ? relevantFiles(() => relevantUntracked(context.topLevel, patterns))
      : [],
    ignored: patterns.length
      ? relevantFiles(() => ignoredWithProvenance(context.topLevel, patterns))
      : [],
    warnings,
  }
}

function relevantFiles(loader) {
  try {
    return loader()
  } catch (error) {
    return [{ error: error.message }]
  }
}

function printContext(snapshot) {
  const { context } = snapshot
  console.log(
    `${context.role} | ${context.branch || 'detached'} | module=${context.module || 'unknown'} | port=${context.port || 'none'}`,
  )
  console.log(`worktree: ${context.worktree}`)
  console.log(
    `state: ${context.dirty ? 'dirty' : 'clean'}; base: behind=${context.divergence.behind ?? '?'} ahead=${context.divergence.ahead ?? '?'}; registered=${context.registered}`,
  )
  if (context.gitOperation) console.log(`git operation: ${context.gitOperation}`)
  console.log(`provisioned worktrees: ${snapshot.worktrees.length}`)
  for (const worktree of snapshot.worktrees) {
    console.log(
      `  ${worktree.role || 'unregistered'} ${worktree.branch || 'detached'} ${worktree.dirty ? 'dirty' : 'clean'} ${worktree.path}`,
    )
  }
  console.log(`leases: ${snapshot.leases.length}`)
  for (const lease of snapshot.leases) {
    console.log(
      `  ${lease.resource} -> ${lease.owner?.branch || 'unknown'} (${lease.reason || 'no reason'})`,
    )
  }
  console.log(`dev processes: ${snapshot.processes.length}`)
  for (const processRecord of snapshot.processes) {
    console.log(
      `  port ${processRecord.port} pid ${processRecord.pid} ${processRecord.validation.valid ? 'valid' : processRecord.validation.reason}`,
    )
  }
  if (snapshot.mounts.length) {
    console.log('mounts:')
    for (const mount of snapshot.mounts) console.log(`  ${mount.input}: ${mount.status}`)
  }
  if (snapshot.untracked.length) {
    console.log('visible untracked files in owned/shared paths:')
    for (const item of snapshot.untracked)
      console.log(`  ${typeof item === 'string' ? item : item.error}`)
  }
  if (snapshot.ignored.length) {
    console.log('ignored files in owned/shared paths:')
    for (const item of snapshot.ignored) {
      console.log(`  ${item.path || item.error}${item.raw ? ` <- ${item.raw}` : ''}`)
    }
  }
  printWarnings(snapshot.warnings, readWorktreeState(context.gitDir)?.acknowledgements || [])
}

async function commandContext(args) {
  const { options } = parseArguments(args)
  const snapshot = contextSnapshot(process.cwd())
  if (options.json) printJson(snapshot)
  else printContext(snapshot)
}

function systemLockPath(commonDir, name) {
  return join(commonDir, 'wt', 'system-locks', `${name}.lock`)
}

function acquireSystemLock(commonDir, name, context) {
  const pathname = systemLockPath(commonDir, name)
  mkdirSync(dirname(pathname), { recursive: true, mode: 0o700 })
  try {
    mkdirSync(pathname, { mode: 0o700 })
  } catch (error) {
    if (error.code === 'EEXIST') {
      const metadata = readJson(join(pathname, 'metadata.json'), null)
      throw new WtError(
        `${name} is already running${metadata?.worktree ? ` in ${metadata.worktree}` : ''}.`,
        'WT-SYSTEM-LOCKED',
      )
    }
    throw error
  }
  const snapshot = processSnapshot(process.pid)
  try {
    writeJsonAtomic(join(pathname, 'metadata.json'), {
      pid: process.pid,
      processStartTime: snapshot?.startTime || null,
      command: snapshot?.command || null,
      worktree: context.topLevel,
      branch: context.branch,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    rmSync(pathname, { recursive: true, force: true })
    throw error
  }
  return pathname
}

function withSystemLock(commonDir, name, context, callback) {
  const pathname = acquireSystemLock(commonDir, name, context)
  try {
    return callback()
  } finally {
    rmSync(pathname, { recursive: true, force: true })
  }
}

function branchExists(cwd, ref) {
  return git(cwd, ['show-ref', '--verify', '--quiet', ref], { allowFailure: true }).status === 0
}

function safeSlug(value) {
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(value)) {
    throw new WtError(`Task must be a lowercase slug; found ${value}.`, 'WT-TASK-SLUG')
  }
  return value.replaceAll('/', '-')
}

function chooseStartSlot(cwd, agent, localConfig, commonDir) {
  const existing = allWorktreeStates(cwd)
  const primaryInUse = existing.some(({ worktree, state }) => {
    const parsed = parseTaskBranch(worktree.branch)
    return (
      (state?.role === 'active' || worktree.path.includes('/active/')) &&
      (state?.agent || parsed?.agent) === agent
    )
  })
  if (!primaryInUse) {
    return { role: 'active', port: agent === 'codex' ? 3110 : 3120 }
  }
  const states = existing.map(({ state }) => state).filter(Boolean)
  return { role: 'temporary', port: allocateTemporaryPort(commonDir, states) }
}

function assertMountSources(registry, moduleId, localConfig) {
  for (const input of requiredInputs(registry, moduleId)) {
    const source = localConfig.inputs?.[input]
    if (!source || !existsSync(source)) {
      throw new WtError(
        `Missing external input ${input}: ${source || 'not configured'}`,
        'WT-MOUNT-SOURCE-MISSING',
      )
    }
    if ((lstatSync(source).mode & 0o222) !== 0) {
      throw new WtError(
        `External input ${input} is writable: ${source}`,
        'WT-MOUNT-SOURCE-WRITABLE',
      )
    }
  }
}

async function commandStart(args) {
  const { positionals, options } = parseArguments(args)
  const [agent, moduleId, task] = positionals
  if (!agent || !moduleId || !task || positionals.length !== 3) {
    throw new WtError('start requires <agent> <module> <task>.', 'WT-ARGUMENT')
  }
  const gitInfo = discoverGit(process.cwd())
  const registry = loadRegistry(gitInfo.topLevel)
  const localConfig = loadLocalConfig(gitInfo.topLevel)
  if (!registry.branchAgents.includes(agent)) {
    throw new WtError(`Agent must be ${registry.branchAgents.join(' or ')}.`, 'WT-AGENT')
  }
  if (!moduleById(registry, moduleId)) {
    throw new WtError(`Unknown module or scope: ${moduleId}.`, 'WT-MODULE-UNKNOWN')
  }
  safeSlug(task)
  assertMountSources(registry, moduleId, localConfig)
  const worktrees = listWorktrees(gitInfo.topLevel)
  const max = localConfig.maxProvisionedWorktrees || registry.maxProvisionedWorktrees || 5
  if (worktrees.length >= max) {
    throw new WtError(
      `Provisioned worktree cap reached (${worktrees.length}/${max}). Finish an inactive task first.`,
      'WT-WORKTREE-CAP',
    )
  }
  const branch = `${agent}/${moduleId}/${task}`
  const localRef = `refs/heads/${branch}`
  const remoteRef = `refs/remotes/origin/${branch}`
  const localExists = branchExists(gitInfo.topLevel, localRef)
  const remoteExists = branchExists(gitInfo.topLevel, remoteRef)
  if ((localExists || remoteExists) && !options.resume) {
    throw new WtError(`Branch ${branch} exists; pass --resume to attach it.`, 'WT-RESUME-REQUIRED')
  }
  const alreadyAttached = worktrees.find((worktree) => worktree.branch === branch)
  if (alreadyAttached) {
    throw new WtError(
      `Branch ${branch} is already attached at ${alreadyAttached.path}.`,
      'WT-BRANCH-ATTACHED',
    )
  }

  const currentContext = inferContext(gitInfo.topLevel, registry, localConfig)
  const control = findControlCheckout(gitInfo.topLevel, localConfig)
  withSystemLock(gitInfo.commonDir, 'fetch', currentContext, () => {
    git(control, ['fetch', 'origin', '--prune'])
  })
  const refreshedLocal = branchExists(control, localRef)
  const refreshedRemote = branchExists(control, remoteRef)
  if ((refreshedLocal || refreshedRemote) && !options.resume) {
    throw new WtError(
      `Branch ${branch} appeared during fetch; pass --resume.`,
      'WT-RESUME-REQUIRED',
    )
  }
  if (options.resume && !refreshedLocal && !refreshedRemote) {
    throw new WtError(`Cannot resume missing branch ${branch}.`, 'WT-BRANCH-MISSING')
  }
  const slot = chooseStartSlot(control, agent, localConfig, gitInfo.commonDir)
  const root = resolve(localConfig.worktreesRoot)
  const parent = join(root, slot.role === 'temporary' ? 'temporary' : 'active')
  const target = join(parent, `${agent}-${moduleId}-${safeSlug(task)}`)
  if (existsSync(target))
    throw new WtError(`Worktree path already exists: ${target}`, 'WT-PATH-EXISTS')
  mkdirSync(parent, { recursive: true, mode: 0o755 })
  git(control, ['config', 'extensions.worktreeConfig', 'true'])
  let created = false
  try {
    if (options.resume) {
      if (refreshedLocal) git(control, ['worktree', 'add', target, branch])
      else git(control, ['worktree', 'add', '-b', branch, target, `origin/${branch}`])
    } else {
      git(control, ['worktree', 'add', '-b', branch, target, registry.defaultBranch])
    }
    created = true
    const targetGit = discoverGit(target)
    ensureCommonExclude(targetGit.commonDir)
    configureWorktreeExclude(target, targetGit.gitDir, registry, moduleId)
    configureWorktreeHooks(target)
    const mounts = provisionMounts(target, registry, moduleId, localConfig)
    const state = {
      schemaVersion: 1,
      role: slot.role,
      agent,
      module: moduleId,
      task,
      branch,
      port: slot.port,
      worktree: targetGit.topLevel,
      base: registry.defaultBranch,
      inputProfile: moduleById(registry, moduleId).externalInputProfile,
      acknowledgements: [...new Set(options.ack || [])].sort(),
      createdAt: new Date().toISOString(),
    }
    writeWorktreeState(targetGit.gitDir, state)
    const branchState = divergence(target)
    const warnings = []
    if (branchState.behind > 0) {
      warnings.push({
        id: WARNING_IDS.STALE_BASE,
        message: `Resumed branch is ${branchState.behind} commit(s) behind origin/main.`,
      })
    }
    warnings.push(...overlapWarnings(target, inferContext(target, registry, localConfig)))
    console.log(`Started ${branch}`)
    console.log(`worktree: ${target}`)
    console.log(`role: ${slot.role}; port: ${slot.port}; mounts: ${mounts.length}`)
    printWarnings(warnings, options.ack || [])
  } catch (error) {
    if (created) {
      const status = git(target, ['status', '--porcelain'], { allowFailure: true })
      if (status.status === 0 && !status.stdout.trim()) {
        git(control, ['worktree', 'remove', target], { allowFailure: true })
      }
    }
    throw error
  }
}

function processForWorktree(commonDir, topLevel) {
  return processRecords(commonDir).find(
    (record) => resolve(record.worktree || '') === resolve(topLevel),
  )
}

async function commandFinish(args) {
  const { options } = parseArguments(args)
  const registry = loadRegistry(process.cwd())
  const localConfig = loadLocalConfig(process.cwd())
  const context = inferContext(process.cwd(), registry, localConfig)
  if (!['active', 'temporary'].includes(context.role)) {
    throw new WtError(
      'finish only applies to active or temporary task worktrees.',
      'WT-FINISH-ROLE',
    )
  }
  ensureGuardContext(context, registry)
  if (isDirty(context.topLevel)) {
    throw new WtError(
      'Worktree is dirty; commit or preserve changes before finishing.',
      'WT-DIRTY-FINISH',
    )
  }
  const operation = gitOperation(context.topLevel, context.gitDir)
  if (operation) throw new WtError(`Active Git operation: ${operation}.`, 'WT-GIT-OPERATION')
  ensureNoHeldLeases(context.commonDir, context)
  const processRecord = processForWorktree(context.commonDir, context.topLevel)
  if (processRecord) {
    const validation = validateProcessRecord(processRecord)
    if (validation.valid) {
      throw new WtError(
        `Dev process ${processRecord.pid} is still active on port ${processRecord.port}.`,
        'WT-DEV-ACTIVE',
      )
    }
    throw new WtError(
      `A stale dev process record (${validation.reason}) must be resolved before finishing.`,
      'WT-DEV-STALE',
    )
  }
  if (options.ack?.length) appendAcknowledgements(context.gitDir, options.ack)
  const warnings = []
  const branchState = divergence(context.topLevel)
  if (branchState.behind > 0) {
    warnings.push({
      id: WARNING_IDS.STALE_BASE,
      message: `Branch is ${branchState.behind} commit(s) behind origin/main.`,
    })
  }
  warnings.push(...overlapWarnings(context.topLevel, context))
  printWarnings(warnings, options.ack || [])
  const control = findControlCheckout(context.topLevel, localConfig)
  withSystemLock(context.commonDir, 'fetch', context, () => {
    git(control, ['fetch', 'origin', '--prune'])
  })
  const ancestor = git(control, ['merge-base', '--is-ancestor', context.branch, 'origin/main'], {
    allowFailure: true,
  })
  if (ancestor.status !== 0) {
    throw new WtError(
      `${context.branch} is not an ancestor of origin/main. Merge its PR with a merge commit first.`,
      'WT-NOT-MERGED',
    )
  }
  const branch = context.branch
  const path = context.topLevel
  const invalidMounts = validateMounts(path, registry, context.module, localConfig).filter(
    (mount) => mount.status !== 'ok',
  )
  if (invalidMounts.length) {
    throw new WtError(
      'Worktree mounts must be valid before disposal.',
      'WT-DISPOSAL-MOUNT',
      invalidMounts,
    )
  }
  removeDisposableWorktree(control, path, localConfig.worktreesRoot)
  if (options['delete-branch']) git(control, ['branch', '-d', branch])
  console.log(`Finished ${branch}`)
  console.log(`removed worktree: ${path}`)
  console.log(`branch retained: ${options['delete-branch'] ? 'no' : 'yes'}`)
}

function portListener(port) {
  const result = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    allowFailure: true,
  })
  return result.status === 0 ? result.stdout.trim().split(/\s+/).filter(Boolean).map(Number) : []
}

function finding(severity, code, message, data = null) {
  return { severity, code, message, data }
}

function doctorSnapshot(cwd) {
  const registry = loadRegistry(cwd)
  const localConfig = loadLocalConfig(cwd)
  const gitInfo = discoverGit(cwd)
  const worktrees = listWorktrees(cwd)
  const findings = []
  const max = localConfig.maxProvisionedWorktrees || registry.maxProvisionedWorktrees || 5
  if (worktrees.length > max) {
    findings.push(
      finding('error', 'WT-DOCTOR-CAP', `${worktrees.length} worktrees exceed cap ${max}.`),
    )
  }
  for (const pathname of orphanWorktreeDirectories(cwd, localConfig.worktreesRoot)) {
    findings.push(
      finding(
        'error',
        'WT-DOCTOR-ORPHAN-DIRECTORY',
        `Directory is not a registered worktree: ${pathname}`,
      ),
    )
  }
  for (const inputName of Object.keys(registry.inputMountTargets || {})) {
    const source = localConfig.inputs?.[inputName]
    if (!source || !existsSync(source)) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-INPUT-SOURCE',
          `External input ${inputName} is missing: ${source || 'not configured'}.`,
        ),
      )
    } else if ((lstatSync(source).mode & 0o222) !== 0) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-INPUT-WRITABLE',
          `External input ${inputName} is writable: ${source}.`,
        ),
      )
    }
  }
  for (const worktree of worktrees) {
    if (worktree.prunable || !existsSync(worktree.path)) {
      findings.push(
        finding('error', 'WT-DOCTOR-STALE-WORKTREE', `Stale worktree: ${worktree.path}`),
      )
      continue
    }
    const state = stateForWorktree(worktree)
    const context = inferContext(worktree.path, registry, localConfig)
    if (!state) {
      findings.push(
        finding('error', 'WT-DOCTOR-UNREGISTERED', `Unregistered worktree: ${worktree.path}`),
      )
    } else if (state.branch && state.branch !== worktree.branch) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-BRANCH-MISMATCH',
          `${worktree.path} state says ${state.branch}; Git says ${worktree.branch || 'detached'}.`,
        ),
      )
    }
    if (['active', 'temporary'].includes(context.role)) {
      const parsed = parseTaskBranch(worktree.branch)
      if (!parsed || parsed.module !== context.module) {
        findings.push(
          finding('error', 'WT-DOCTOR-INVALID-BRANCH', `Invalid task branch at ${worktree.path}.`),
        )
      }
    }
    if (['control', 'review'].includes(context.role) && isDirty(worktree.path)) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-DIRTY-STABLE',
          `${context.role} worktree is dirty: ${worktree.path}`,
        ),
      )
    }
    if (context.module) {
      for (const mount of validateMounts(worktree.path, registry, context.module, localConfig)) {
        if (mount.status !== 'ok') {
          findings.push(
            finding(
              'error',
              'WT-DOCTOR-MOUNT',
              `${mount.input} mount is ${mount.status} in ${worktree.path}.`,
              mount,
            ),
          )
        }
      }
    }
    const expectedExclude = join(context.gitDir, 'wt', 'exclude')
    const configuredExclude = git(
      worktree.path,
      ['config', '--worktree', '--get', 'core.excludesFile'],
      {
        allowFailure: true,
      },
    ).stdout.trim()
    if (!configuredExclude || resolve(configuredExclude) !== resolve(expectedExclude)) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-EXCLUDE',
          `Worktree-specific exclude is not configured at ${worktree.path}.`,
        ),
      )
    } else if (
      !existsSync(expectedExclude) ||
      readFileSync(expectedExclude, 'utf8') !==
        `${worktreeExcludeRules(registry, context.module).join('\n')}\n`
    ) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-EXCLUDE-RULES',
          `Worktree-specific exclude rules are stale at ${worktree.path}.`,
        ),
      )
    }
    const configuredHooks = git(
      worktree.path,
      ['config', '--worktree', '--get', 'core.hooksPath'],
      { allowFailure: true },
    ).stdout.trim()
    if (configuredHooks !== '.husky') {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-HOOKS',
          `Worktree hook path is ${configuredHooks || 'unset'} instead of .husky at ${worktree.path}.`,
        ),
      )
    }
  }
  for (const stale of staleLeaseFindings(cwd, gitInfo.commonDir)) {
    findings.push(
      finding(
        'error',
        'WT-DOCTOR-STALE-LEASE',
        `${stale.lease.resource} lease is stale: ${stale.reason}.`,
        stale.lease,
      ),
    )
  }
  const systemLocks = join(gitInfo.commonDir, 'wt', 'system-locks')
  if (existsSync(systemLocks)) {
    for (const name of readdirSync(systemLocks).filter((entry) => entry.endsWith('.lock'))) {
      const lockPath = join(systemLocks, name)
      const metadata = readJson(join(lockPath, 'metadata.json'), null)
      const validation = metadata
        ? validateProcessRecord({
            pid: metadata.pid,
            processStartTime: metadata.processStartTime,
            command: metadata.command,
            expectedCommand: metadata.command,
          })
        : { valid: false, reason: 'missing-metadata' }
      findings.push(
        finding(
          validation.valid ? 'info' : 'error',
          validation.valid ? 'WT-DOCTOR-ACTIVE-SYSTEM-LOCK' : 'WT-DOCTOR-STALE-SYSTEM-LOCK',
          `${name} is ${validation.valid ? 'active' : `stale (${validation.reason})`}.`,
          metadata,
        ),
      )
    }
  }
  const supabaseGate = join(gitInfo.commonDir, 'wt', 'leases', 'supabase', 'gate.lock')
  if (existsSync(supabaseGate)) {
    const metadata = readJson(join(supabaseGate, 'metadata.json'), null)
    const validation = metadata
      ? validateProcessRecord({
          pid: metadata.pid,
          processStartTime: metadata.processStartTime,
          command: metadata.command,
          expectedCommand: metadata.command,
        })
      : { valid: false, reason: 'missing-metadata' }
    findings.push(
      finding(
        validation.valid ? 'info' : 'error',
        validation.valid ? 'WT-DOCTOR-ACTIVE-LEASE-GATE' : 'WT-DOCTOR-STALE-LEASE-GATE',
        `Supabase lease gate is ${validation.valid ? 'active' : `stale (${validation.reason})`}.`,
        metadata,
      ),
    )
  }
  const records = processRecords(gitInfo.commonDir)
  const worktreesByPath = new Map(worktrees.map((worktree) => [resolve(worktree.path), worktree]))
  for (const record of records) {
    const validation = validateProcessRecord(record)
    if (!validation.valid) {
      findings.push(
        finding(
          'error',
          validation.reason === 'pid-reused' ? 'WT-DOCTOR-PID-REUSED' : 'WT-DOCTOR-PROCESS',
          `Process record for port ${record.port} is invalid: ${validation.reason}.`,
          record,
        ),
      )
    }
    const ownerWorktree = worktreesByPath.get(resolve(record.worktree || ''))
    if (!ownerWorktree) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-ORPHAN-PROCESS',
          `Process record for port ${record.port} names a missing worktree.`,
          record,
        ),
      )
    } else if (ownerWorktree.branch !== record.branch) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-PROCESS-BRANCH',
          `Process record branch ${record.branch} does not match ${ownerWorktree.branch || 'detached'}.`,
          record,
        ),
      )
    } else {
      const ownerState = stateForWorktree(ownerWorktree)
      if (ownerState?.port && Number(ownerState.port) !== Number(record.port)) {
        findings.push(
          finding(
            'error',
            'WT-DOCTOR-PROCESS-PORT',
            `Process record port ${record.port} does not match assigned port ${ownerState.port}.`,
            record,
          ),
        )
      }
    }
    const listeners = portListener(record.port)
    if (validation.valid && !listeners.includes(record.pid)) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-WRONG-PORT',
          `PID ${record.pid} is valid but is not listening on port ${record.port}.`,
        ),
      )
    }
  }
  for (const port of [
    3100,
    3110,
    3120,
    ...Array.from({ length: 20 }, (_, index) => 3130 + index),
  ]) {
    const listeners = portListener(port)
    if (listeners.length && !records.some((record) => Number(record.port) === port)) {
      findings.push(
        finding(
          'error',
          'WT-DOCTOR-ORPHAN-PORT',
          `Port ${port} has listener(s) ${listeners.join(', ')} without a wt process record.`,
        ),
      )
    }
  }
  const commonExclude = join(gitInfo.commonDir, 'info', 'exclude')
  if (
    !existsSync(commonExclude) ||
    !readFileSync(commonExclude, 'utf8').includes('# BEGIN managed by wt')
  ) {
    findings.push(
      finding('error', 'WT-DOCTOR-COMMON-EXCLUDE', 'Managed common exclude block is missing.'),
    )
  }
  return {
    checkedAt: new Date().toISOString(),
    worktreeCount: worktrees.length,
    cap: max,
    findings,
    ok: findings.every((item) => item.severity !== 'error'),
  }
}

async function commandDoctor(args) {
  const { options } = parseArguments(args)
  const snapshot = doctorSnapshot(process.cwd())
  if (options.json) printJson(snapshot)
  else {
    console.log(
      `doctor: ${snapshot.ok ? 'ok' : 'issues found'} (${snapshot.worktreeCount}/${snapshot.cap} worktrees)`,
    )
    for (const item of snapshot.findings) {
      console.log(`${item.severity} [${item.code}]: ${item.message}`)
    }
  }
  if (!snapshot.ok) process.exitCode = 1
}

async function waitForSnapshot(pid, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const snapshot = processSnapshot(pid)
    if (snapshot) return snapshot
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  }
  return null
}

async function commandDev(args) {
  if (args.length) throw new WtError('dev does not accept positional arguments.', 'WT-ARGUMENT')
  const registry = loadRegistry(process.cwd())
  const localConfig = loadLocalConfig(process.cwd())
  const context = inferContext(process.cwd(), registry, localConfig)
  if (!['active', 'temporary', 'review'].includes(context.role)) {
    throw new WtError(
      'Dev servers may run only in active, temporary, or review worktrees.',
      'WT-DEV-ROLE',
    )
  }
  if (!context.port) throw new WtError('No dev port is assigned to this worktree.', 'WT-DEV-PORT')
  const target = processRecordPath(context.commonDir, context.port)
  if (existsSync(target)) {
    const existing = readJson(target)
    const validation = validateProcessRecord(existing)
    throw new WtError(
      `Port ${context.port} already has a ${validation.valid ? 'live' : 'stale'} process record. Run wt doctor.`,
      'WT-DEV-LEASE',
    )
  }
  const listeners = portListener(context.port)
  if (listeners.length) {
    throw new WtError(
      `Port ${context.port} is already listening via PID ${listeners.join(', ')}.`,
      'WT-PORT-IN-USE',
    )
  }
  const nextBin = join(context.topLevel, 'node_modules', 'next', 'dist', 'bin', 'next')
  if (!existsSync(nextBin)) {
    throw new WtError(
      'Next.js is not installed in this worktree. Run npm ci first.',
      'WT-DEPENDENCIES',
    )
  }
  exclusiveCreateJson(target, {
    schemaVersion: 1,
    status: 'starting',
    pid: process.pid,
    processStartTime: processSnapshot(process.pid)?.startTime,
    command: `${process.execPath} ${nextBin} dev --port ${context.port} --webpack`,
    expectedCommand: 'next dev',
    worktree: context.topLevel,
    branch: context.branch,
    port: context.port,
    leaseCreationTime: new Date().toISOString(),
  })
  const child = spawn(
    process.execPath,
    [nextBin, 'dev', '--port', String(context.port), '--webpack'],
    {
      cwd: context.topLevel,
      env: { ...process.env, PORT: String(context.port) },
      stdio: 'inherit',
    },
  )
  const snapshot = await waitForSnapshot(child.pid)
  if (!snapshot) {
    rmSync(target, { force: true })
    child.kill('SIGTERM')
    throw new WtError('Dev process failed to start.', 'WT-DEV-START')
  }
  const record = {
    schemaVersion: 1,
    status: 'running',
    pid: child.pid,
    processStartTime: snapshot.startTime,
    command: snapshot.command,
    expectedCommand: 'next dev',
    worktree: context.topLevel,
    branch: context.branch,
    port: context.port,
    leaseCreationTime: new Date().toISOString(),
  }
  writeJsonAtomic(target, record)
  console.log(`wt dev: ${context.branch || context.role} owns http://localhost:${context.port}`)

  const forward = (signal) => {
    if (!child.killed) child.kill(signal)
  }
  process.once('SIGINT', () => forward('SIGINT'))
  process.once('SIGTERM', () => forward('SIGTERM'))
  const exitCode = await new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)))
  })
  const current = readJson(target, null)
  if (current?.pid === child.pid) rmSync(target, { force: true })
  process.exitCode = exitCode
}

function assertClaimAllowed(registry, context, descriptor) {
  const module = moduleById(registry, context.module)
  if (!module) throw new WtError(`Unknown context module: ${context.module}`, 'WT-MODULE-UNKNOWN')
  if (descriptor.kind === 'supabase-read') return
  if (descriptor.kind === 'supabase-mutation') return
  const shared = effectiveSharedPaths(registry, module)
  const candidate = descriptor.path || descriptor.resource
  if (!matchesAny(candidate, shared) && !protectedLeaseForPath(registry, candidate)) {
    throw new WtError(`${candidate} is not a declared shared path.`, 'WT-LEASE-NOT-DECLARED')
  }
}

async function commandClaim(args) {
  const { positionals, options } = parseArguments(args)
  if (!positionals.length) throw new WtError('claim requires at least one resource.', 'WT-ARGUMENT')
  if (!options.reason) throw new WtError('claim requires --reason.', 'WT-LEASE-REASON')
  const registry = loadRegistry(process.cwd())
  const localConfig = loadLocalConfig(process.cwd())
  const context = inferContext(process.cwd(), registry, localConfig)
  ensureGuardContext(context, registry)
  const descriptors = [
    ...new Map(
      positionals
        .map((request) => canonicalLeaseResource(request, registry))
        .sort((left, right) => left.resource.localeCompare(right.resource))
        .map((descriptor) => [`${descriptor.kind}:${descriptor.resource}`, descriptor]),
    ).values(),
  ]
  for (const descriptor of descriptors) assertClaimAllowed(registry, context, descriptor)
  const acquired = []
  try {
    for (const descriptor of descriptors) {
      acquired.push({
        descriptor,
        lease: acquireLease(context.commonDir, context, descriptor, options.reason),
      })
    }
  } catch (error) {
    for (const item of acquired.reverse()) {
      releaseLease(context.commonDir, context, item.descriptor, { force: true })
    }
    throw error
  }
  for (const item of acquired) {
    console.log(`claimed ${item.lease.resource}: ${item.lease.reason}`)
  }
}

async function commandRelease(args) {
  const { positionals } = parseArguments(args)
  if (!positionals.length)
    throw new WtError('release requires at least one resource.', 'WT-ARGUMENT')
  const registry = loadRegistry(process.cwd())
  const localConfig = loadLocalConfig(process.cwd())
  const context = inferContext(process.cwd(), registry, localConfig)
  const descriptors = positionals
    .map((request) => canonicalLeaseResource(request, registry))
    .sort((left, right) => left.resource.localeCompare(right.resource))
  for (const descriptor of descriptors) {
    const lease = releaseLease(context.commonDir, context, descriptor)
    console.log(`released ${lease.resource}`)
  }
}

function printScope(report) {
  for (const file of report.files) {
    console.log(`${file.disposition.padEnd(24)} ${file.path}`)
  }
  printWarnings(report.warnings)
  for (const error of report.errors) {
    console.error(`error [${error.code}]: ${error.message}`)
  }
}

async function commandGuard(args, { ci = false } = {}) {
  const { options } = parseArguments(args)
  const registry = loadRegistry(process.cwd())
  const context = inferContext(
    process.cwd(),
    registry,
    loadLocalConfig(process.cwd(), { required: false }),
  )
  const branchOverride =
    options.branch || (ci ? process.env.WT_BRANCH || process.env.GITHUB_HEAD_REF : null)
  const parsed = ensureGuardContext(context, registry, { ci, branchOverride })
  const base = options.base || 'origin/main'
  const files = ci
    ? diffNameStatus(context.topLevel, [`${base}...HEAD`])
    : diffNameStatus(context.topLevel, ['--cached'])
  if (!files.length) {
    console.log(ci ? 'CI scope guard: no changed files.' : 'Scope guard: no staged files.')
    return
  }
  const report = scopeReport({
    cwd: context.topLevel,
    registry,
    moduleId: parsed.module,
    files,
    context,
    ci,
  })
  printScope(report)
  if (report.errors.length) {
    throw new WtError(
      `Scope validation failed with ${report.errors.length} error(s).`,
      'WT-SCOPE-FAILED',
    )
  }
  console.log(`Scope validation passed for ${parsed.module} (${files.length} path(s)).`)
}

async function commandSupabaseGuard(args) {
  const separator = args.indexOf('--')
  if (separator < 1 || separator === args.length - 1) {
    throw new WtError('supabase-guard requires <operation> -- <command...>.', 'WT-ARGUMENT')
  }
  const operation = args[0]
  const command = args[separator + 1]
  const commandArgs = args.slice(separator + 2)
  const registry = loadRegistry(process.cwd())
  const localConfig = loadLocalConfig(process.cwd())
  const context = inferContext(process.cwd(), registry, localConfig)
  ensureGuardContext(context, registry)
  const leases = listLeases(context.commonDir).filter(
    (lease) =>
      lease.kind === 'supabase-mutation' &&
      lease.owner?.worktree === context.topLevel &&
      lease.owner?.branch === context.branch,
  )
  if (!leases.length) {
    throw new WtError(
      `Supabase ${operation} is blocked. Claim supabase-${operation} first.`,
      'WT-SUPABASE-LEASE-REQUIRED',
    )
  }
  const lease = leases[0]
  if (![operation, 'mutate'].includes(lease.operation)) {
    throw new WtError(
      `Held Supabase lease identifies ${lease.operation}; requested operation is ${operation}.`,
      'WT-SUPABASE-OPERATION-MISMATCH',
    )
  }
  console.log(`Supabase ${operation} authorized by ${lease.owner.branch}: ${lease.reason}`)
  const result = run(command, commandArgs, {
    cwd: context.topLevel,
    stdio: 'inherit',
    allowFailure: true,
  })
  if (result.status !== 0) process.exitCode = result.status
}

async function commandRegisterCurrent(args) {
  const { options } = parseArguments(args)
  const registry = loadRegistry(process.cwd())
  const localConfig = loadLocalConfig(process.cwd())
  const context = inferContext(process.cwd(), registry, localConfig)
  const role = options.role || context.role
  const moduleId = options.module || context.module || 'platform'
  const agent = options.agent || context.agent
  const task = options.task || context.task
  const port = Number(options.port || context.port || (role === 'control' ? 0 : 0)) || null
  if (!['control', 'review', 'active', 'temporary'].includes(role)) {
    throw new WtError(`Invalid role ${role}.`, 'WT-REGISTER-ROLE')
  }
  if (!moduleById(registry, moduleId)) {
    throw new WtError(`Unknown module ${moduleId}.`, 'WT-MODULE-UNKNOWN')
  }
  if (['active', 'temporary'].includes(role))
    ensureGuardContext({ ...context, module: moduleId }, registry)
  git(context.topLevel, ['config', 'extensions.worktreeConfig', 'true'])
  ensureCommonExclude(context.commonDir)
  configureWorktreeExclude(context.topLevel, context.gitDir, registry, moduleId)
  configureWorktreeHooks(context.topLevel)
  const mounts = provisionMounts(context.topLevel, registry, moduleId, localConfig)
  writeWorktreeState(context.gitDir, {
    schemaVersion: 1,
    role,
    agent,
    module: moduleId,
    task,
    branch: context.branch,
    port,
    worktree: context.topLevel,
    base: registry.defaultBranch,
    inputProfile: moduleById(registry, moduleId).externalInputProfile,
    acknowledgements: [],
    createdAt: new Date().toISOString(),
  })
  console.log(`registered ${role} worktree ${context.topLevel} with ${mounts.length} mount(s)`)
}

async function commandInstallHooks(args) {
  if (args.length) throw new WtError('install-hooks accepts no arguments.', 'WT-ARGUMENT')
  const context = discoverGit(process.cwd())
  git(context.topLevel, ['config', 'extensions.worktreeConfig', 'true'])
  configureWorktreeHooks(context.topLevel)
  console.log(`configured worktree hooks at ${context.topLevel}/.husky`)
}

const commands = {
  context: commandContext,
  start: commandStart,
  finish: commandFinish,
  doctor: commandDoctor,
  dev: commandDev,
  claim: commandClaim,
  release: commandRelease,
  guard: (args) => commandGuard(args, { ci: false }),
  'ci-scope': (args) => commandGuard(args, { ci: true }),
  'supabase-guard': commandSupabaseGuard,
  'install-hooks': commandInstallHooks,
  '_register-current': commandRegisterCurrent,
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(usage())
    return
  }
  const handler = commands[command]
  if (!handler) {
    throw new WtError(`Unknown command: ${command}\n${usage()}`, 'WT-COMMAND')
  }
  await handler(args)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    printError(error)
    process.exitCode = 1
  })
}
