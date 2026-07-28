import assert from 'node:assert/strict'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, test } from 'node:test'
import {
  WtError,
  acquireLease,
  canonicalLeaseResource,
  diffNameStatus,
  ensureCommonExclude,
  ensureGuardContext,
  globToRegExp,
  git,
  leaseOwnedForResource,
  loadRegistry,
  matchesPattern,
  normalizeRepoPath,
  orphanWorktreeDirectories,
  parseTaskBranch,
  processSnapshot,
  provisionMounts,
  releaseLease,
  removeDisposableWorktree,
  scopeReport,
  validateMounts,
  validateProcessRecord,
  worktreeExcludeRules,
} from '../lib.mjs'

const repositoryRoot = new URL('../../../', import.meta.url).pathname
const registry = loadRegistry(repositoryRoot)
const temporaryPaths = []

function temporaryDirectory() {
  const pathname = mkdtempSync(join(tmpdir(), 'wt-isolation-test-'))
  temporaryPaths.push(pathname)
  return pathname
}

function context(commonDir, suffix, module = 'platform') {
  return {
    role: 'active',
    agent: 'codex',
    module,
    branch: `codex/${module}/${suffix}`,
    detached: false,
    topLevel: join(commonDir, suffix),
    commonDir,
    gitDir: join(commonDir, '.git', suffix),
  }
}

afterEach(() => {
  for (const pathname of temporaryPaths.splice(0)) {
    rmSync(pathname, { recursive: true, force: true })
  }
})

describe('registry and branch contracts', () => {
  test('contains exactly the 35 learner modules and a separate platform scope', () => {
    assert.equal(registry.modules.length, 35)
    assert.equal(
      registry.modules.some((module) => module.id === 'platform'),
      false,
    )
    assert.equal(registry.platformScope.id, 'platform')
    assert.deepEqual(
      Object.fromEntries(
        [...new Set(registry.modules.map((module) => module.group))].map((group) => [
          group,
          registry.modules.filter((module) => module.group === group).length,
        ]),
      ),
      {
        'critical-care': 7,
        pleural: 11,
        'bronchoscopy-procedures': 9,
        other: 8,
      },
    )
  })

  test('parses only supported task branch forms', () => {
    assert.deepEqual(parseTaskBranch('codex/literature/fix-taxonomy'), {
      agent: 'codex',
      module: 'literature',
      task: 'fix-taxonomy',
    })
    assert.deepEqual(parseTaskBranch('claude/critical-care/ecmo/case-one'), {
      agent: 'claude',
      module: 'critical-care',
      task: 'ecmo/case-one',
    })
    assert.equal(parseTaskBranch('feature/literature'), null)
    assert.equal(parseTaskBranch('codex/Literature/task'), null)
    assert.equal(parseTaskBranch('codex/literature/task/'), null)
    assert.equal(parseTaskBranch('codex/literature/task//part'), null)
  })

  test('rejects repository paths that can escape the checkout', () => {
    assert.throws(() => normalizeRepoPath('../secret'), /Unsafe repository path/)
    assert.throws(() => normalizeRepoPath('safe/..'), /Unsafe repository path/)
    assert.throws(() => normalizeRepoPath('/absolute/path'), /Unsafe repository path/)
  })

  test('matches recursive and segment globs without crossing segment boundaries', () => {
    assert.equal(
      matchesPattern('src/features/literature/a/b.ts', 'src/features/literature/**'),
      true,
    )
    assert.equal(matchesPattern('messages/en.json', 'messages/*.json'), true)
    assert.equal(matchesPattern('messages/nested/en.json', 'messages/*.json'), false)
    assert.equal(
      globToRegExp('src/app/[locale]/literature/**').test('src/app/[locale]/literature/page.tsx'),
      true,
    )
  })
})

describe('scope enforcement', () => {
  test('uses a merge-base diff when the feature branch is behind the base branch', () => {
    const repository = temporaryDirectory()
    git(repository, ['init', '-b', 'main'])
    git(repository, ['config', 'user.email', 'worktree-tests@example.invalid'])
    git(repository, ['config', 'user.name', 'Worktree Tests'])
    writeFileSync(join(repository, 'shared.txt'), 'base\n')
    git(repository, ['add', 'shared.txt'])
    git(repository, ['commit', '-m', 'base'])
    git(repository, ['switch', '-c', 'codex/literature/test'])
    writeFileSync(join(repository, 'feature.txt'), 'feature\n')
    git(repository, ['add', 'feature.txt'])
    git(repository, ['commit', '-m', 'feature'])
    git(repository, ['switch', 'main'])
    writeFileSync(join(repository, 'main-only.txt'), 'main\n')
    git(repository, ['add', 'main-only.txt'])
    git(repository, ['commit', '-m', 'main advancement'])
    git(repository, ['switch', 'codex/literature/test'])

    assert.deepEqual(
      diffNameStatus(repository, ['main...HEAD']).map((entry) => entry.path),
      ['feature.txt'],
    )
    assert.deepEqual(
      diffNameStatus(repository, ['main', 'HEAD'])
        .map((entry) => entry.path)
        .sort(),
      ['feature.txt', 'main-only.txt'],
    )
  })

  test('accepts owned work and rejects another module’s exclusive path', () => {
    const commonDir = temporaryDirectory()
    const literatureContext = context(commonDir, 'scope', 'literature')
    const own = scopeReport({
      cwd: literatureContext.topLevel,
      registry,
      moduleId: 'literature',
      files: ['src/features/literature/components/GoldSetReviewWorkspace.tsx'],
      context: literatureContext,
    })
    assert.equal(own.errors.length, 0)

    const wrong = scopeReport({
      cwd: literatureContext.topLevel,
      registry,
      moduleId: 'literature',
      files: ['src/features/critical-care/components/CriticalCareHub.tsx'],
      context: literatureContext,
    })
    assert.equal(wrong.errors[0].code, 'WT-EXCLUSIVE-PATH')
  })

  test('always blocks private and generated paths', () => {
    const commonDir = temporaryDirectory()
    const taskContext = context(commonDir, 'private', 'platform')
    const report = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['.env.local', 'local-data/inputs/gudid/device.txt'],
      context: taskContext,
    })
    assert.deepEqual(
      report.errors.map((error) => error.code),
      ['WT-BLOCKED-PATH', 'WT-BLOCKED-PATH'],
    )
  })

  test('allows an intentional deletion while externalizing a formerly tracked private path', () => {
    const commonDir = temporaryDirectory()
    const taskContext = context(commonDir, 'private-removal', 'platform')
    const report = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: [{ path: 'IP_PubMed/nbib files/corpus.nbib', deleted: true, status: 'D' }],
      context: taskContext,
    })
    assert.equal(report.errors.length, 0)
    assert.equal(report.files[0].disposition, 'private-removal')
  })

  test('requires a local lease for protected shared paths but CI only checks declaration', () => {
    const commonDir = temporaryDirectory()
    const taskContext = context(commonDir, 'shared', 'platform')
    const local = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['package.json'],
      context: taskContext,
    })
    assert.equal(local.errors[0].code, 'WT-SHARED-LEASE-REQUIRED')

    const ci = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['package.json'],
      context: taskContext,
      ci: true,
    })
    assert.equal(ci.errors.length, 0)

    const descriptor = canonicalLeaseResource('package.json', registry)
    acquireLease(commonDir, taskContext, descriptor, 'test package script')
    assert.equal(leaseOwnedForResource(commonDir, taskContext, 'package.json'), true)
    const claimed = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['package.json'],
      context: taskContext,
    })
    assert.equal(claimed.errors.length, 0)
  })

  test('blocks control and detached commit contexts', () => {
    assert.throws(
      () =>
        ensureGuardContext(
          {
            role: 'control',
            branch: 'main',
            detached: false,
            module: null,
            topLevel: temporaryDirectory(),
            gitDir: temporaryDirectory(),
          },
          registry,
        ),
      (error) => error instanceof WtError && error.code === 'WT-CONTROL-COMMIT',
    )
  })
})

describe('atomic leases', () => {
  test('allows exactly one owner for an exclusive shared path', () => {
    const commonDir = temporaryDirectory()
    const first = context(commonDir, 'first')
    const second = context(commonDir, 'second')
    const descriptor = canonicalLeaseResource('package.json', registry)
    acquireLease(commonDir, first, descriptor, 'first owner')
    assert.throws(
      () => acquireLease(commonDir, second, descriptor, 'second owner'),
      (error) => error instanceof WtError && error.code === 'WT-LEASE-CONFLICT',
    )
    releaseLease(commonDir, first, descriptor)
    const secondLease = acquireLease(commonDir, second, descriptor, 'second after release')
    assert.equal(secondLease.owner.branch, second.branch)
  })

  test('permits multiple Supabase readers and excludes mutations in both directions', () => {
    const commonDir = temporaryDirectory()
    const first = context(commonDir, 'reader-one', 'literature')
    const second = context(commonDir, 'reader-two', 'preference-cards')
    const read = canonicalLeaseResource('supabase-read', registry)
    const mutate = canonicalLeaseResource('supabase-reset', registry)
    acquireLease(commonDir, first, read, 'read app one')
    acquireLease(commonDir, second, read, 'read app two')
    assert.throws(
      () => acquireLease(commonDir, first, mutate, 'reset database'),
      (error) => error instanceof WtError && error.code === 'WT-LEASE-CONFLICT',
    )
    releaseLease(commonDir, first, read)
    releaseLease(commonDir, second, read)
    const mutation = acquireLease(commonDir, first, mutate, 'reset database')
    assert.equal(mutation.operation, 'reset')
    assert.throws(
      () => acquireLease(commonDir, second, read, 'read during reset'),
      (error) => error instanceof WtError && error.code === 'WT-LEASE-CONFLICT',
    )
  })
})

describe('disposable worktrees', () => {
  test('removes ignored artifacts and mount symlinks without touching external inputs', () => {
    const root = temporaryDirectory()
    const repository = join(root, 'repository')
    const worktreesRoot = join(root, 'worktrees')
    const target = join(worktreesRoot, 'active', 'codex-platform-disposal-test')
    const externalInput = join(root, 'external.env')
    mkdirSync(repository)
    mkdirSync(join(worktreesRoot, 'active'), { recursive: true })
    git(repository, ['init', '-b', 'main'])
    git(repository, ['config', 'user.email', 'worktree-tests@example.invalid'])
    git(repository, ['config', 'user.name', 'Worktree Tests'])
    writeFileSync(join(repository, '.gitignore'), 'node_modules/\n.env.local\n')
    writeFileSync(join(repository, 'README.md'), 'test repository\n')
    git(repository, ['add', '.gitignore', 'README.md'])
    git(repository, ['commit', '-m', 'base'])
    git(repository, ['worktree', 'add', '-b', 'codex/platform/disposal-test', target, 'main'])
    mkdirSync(join(target, 'node_modules'))
    writeFileSync(join(target, 'node_modules', 'cache.txt'), 'disposable\n')
    writeFileSync(externalInput, 'preserve me\n')
    symlinkSync(externalInput, join(target, '.env.local'))

    assert.deepEqual(orphanWorktreeDirectories(repository, worktreesRoot), [])
    const orphan = join(worktreesRoot, 'temporary', 'orphaned-task')
    mkdirSync(orphan, { recursive: true })
    assert.deepEqual(orphanWorktreeDirectories(repository, worktreesRoot), [orphan])
    rmSync(orphan, { recursive: true })

    assert.throws(
      () => removeDisposableWorktree(repository, repository, worktreesRoot),
      (error) => error instanceof WtError && error.code === 'WT-DISPOSAL-PATH',
    )
    removeDisposableWorktree(repository, target, worktreesRoot)

    assert.equal(existsSync(target), false)
    assert.equal(readFileSync(externalInput, 'utf8'), 'preserve me\n')
  })
})

describe('mount and process validation', () => {
  test('limits per-worktree excludes to the module input profile', () => {
    const literatureRules = worktreeExcludeRules(registry, 'literature')
    assert.ok(literatureRules.includes('/.env.local'))
    assert.ok(literatureRules.includes('/IP_PubMed/nbib files'))
    assert.equal(
      literatureRules.some((rule) => rule.includes('AccessGUDID')),
      false,
    )

    const preferenceRules = worktreeExcludeRules(registry, 'preference-cards')
    assert.ok(
      preferenceRules.includes(
        '/Preference_card_module/AccessGUDID_Delimited_Full_Release_20260723',
      ),
    )
    assert.equal(preferenceRules.includes('/IP_PubMed/nbib files'), false)
  })

  test('updates the managed common exclude block without removing local rules', () => {
    const commonDir = temporaryDirectory()
    const exclude = join(commonDir, 'info', 'exclude')
    mkdirSync(join(commonDir, 'info'))
    writeFileSync(
      exclude,
      [
        '# local rule before',
        '*.machine-only',
        '# note: # BEGIN managed by wt (universal local-only paths) is reserved',
        '# BEGIN managed by wt (universal local-only paths)',
        '/old-managed-path/',
        '# END managed by wt',
        '# local rule after',
        '# note: # END managed by wt is reserved',
        '!/local-data/keep-this-file',
        '',
      ].join('\n'),
    )

    ensureCommonExclude(commonDir)

    const content = readFileSync(exclude, 'utf8')
    assert.match(content, /\*\.machine-only/)
    assert.match(content, /\/\.claude\/settings\.local\.json/)
    assert.match(
      content,
      /# note: # BEGIN managed by wt \(universal local-only paths\) is reserved/,
    )
    assert.match(content, /# note: # END managed by wt is reserved/)
    assert.doesNotMatch(content, /old-managed-path/)
    assert.ok(
      content.indexOf('# local rule before') <
        content.indexOf('# BEGIN managed by wt (universal local-only paths)'),
    )
    assert.ok(content.indexOf('# local rule after') > content.indexOf('# END managed by wt'))
    assert.equal(
      content
        .split(/\r?\n/)
        .filter((line) => line === '# BEGIN managed by wt (universal local-only paths)').length,
      1,
    )
  })

  test('rejects malformed common exclude markers without rewriting the file', () => {
    const commonDir = temporaryDirectory()
    const exclude = join(commonDir, 'info', 'exclude')
    mkdirSync(join(commonDir, 'info'))
    const malformed = [
      '# local rule',
      '# BEGIN managed by wt (universal local-only paths)',
      '/stale-managed-path/',
      '',
    ].join('\n')
    writeFileSync(exclude, malformed)

    assert.throws(
      () => ensureCommonExclude(commonDir),
      (error) => error instanceof WtError && error.code === 'WT-COMMON-EXCLUDE-MALFORMED',
    )
    assert.equal(readFileSync(exclude, 'utf8'), malformed)
  })

  test('provisions only symlinks to read-only approved inputs', () => {
    const root = temporaryDirectory()
    const source = join(root, 'external.env')
    const worktree = join(root, 'worktree')
    mkdirSync(worktree)
    writeFileSync(source, 'EXAMPLE=value\n', { mode: 0o400 })
    chmodSync(source, 0o400)
    const localConfig = { inputs: { environment: source } }
    const mounts = provisionMounts(worktree, registry, 'platform', localConfig)
    assert.equal(mounts[0].status, 'ok')
    assert.equal(lstatSync(join(worktree, '.env.local')).isSymbolicLink(), true)
    assert.equal(validateMounts(worktree, registry, 'platform', localConfig)[0].status, 'ok')
  })

  test('detects PID reuse using start time even when the PID still exists', () => {
    const snapshot = processSnapshot(process.pid)
    assert.ok(snapshot)
    const validation = validateProcessRecord({
      pid: process.pid,
      processStartTime: 'Mon Jan  1 00:00:00 1990',
      command: snapshot.command,
      expectedCommand: snapshot.command,
    })
    assert.equal(validation.valid, false)
    assert.equal(validation.reason, 'pid-reused')
  })
})
