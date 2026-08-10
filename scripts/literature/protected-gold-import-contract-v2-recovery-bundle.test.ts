/** @jest-environment node */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
} from './protected-gold-import-contract-v2'
import {
  PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES,
  PROTECTED_V2_OPERATOR_BUNDLE_ROOTS,
  assertProtectedV2OperatorBundleUnchanged,
  buildProtectedV2OperatorBundle,
  protectedV2RelativeImports,
  validateProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'

const execFileAsync = promisify(execFile)

describe('protected V2 deterministic tracked runtime bundle', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  async function git(cwd: string, arguments_: readonly string[]): Promise<string> {
    const result = await execFileAsync('git', [...arguments_], { cwd, encoding: 'utf8' })
    return result.stdout
  }

  async function copyRepositoryFixture(): Promise<string> {
    const source = process.cwd()
    const cwd = await mkdtemp(resolve(tmpdir(), 'protected-v2-runtime-bundle-'))
    cleanup.push(cwd)
    const tracked = (await git(source, ['ls-files', '-z'])).split('\0').filter(Boolean)
    const selected = tracked.filter(
      (path) =>
        PROTECTED_V2_OPERATOR_BUNDLE_ROOTS.includes(path as never) ||
        PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES.some((directory) =>
          path.startsWith(`${directory}/`),
        ),
    )
    for (const path of selected) {
      await mkdir(dirname(resolve(cwd, path)), { recursive: true })
      await copyFile(resolve(source, path), resolve(cwd, path))
    }
    await git(cwd, ['init', '--quiet'])
    await git(cwd, ['add', '--', ...selected])
    await symlink(resolve(source, 'node_modules'), resolve(cwd, 'node_modules'), 'dir')
    return cwd
  }

  async function append(path: string, value = '\n'): Promise<void> {
    const bytes = await readFile(path, 'utf8')
    await writeFile(path, `${bytes}${value}`, 'utf8')
  }

  it('keeps the old relative-import parser diagnostic-only', () => {
    expect(
      protectedV2RelativeImports(`
        import './side-effect'
        import value from './value.js'
        export type { Shape } from './shape'
        export { helper } from './helper'
        const lazy = import('./lazy')
      `),
    ).toEqual(['./helper', './lazy', './shape', './side-effect', './value.js'])
  })

  it('builds the real repository boundary deterministically with exact runtime audits', async () => {
    const first = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
    const repeated = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
    expect(repeated).toEqual(first)
    expect(first.protectedDirectories).toEqual([...PROTECTED_V2_OPERATOR_BUNDLE_DIRECTORIES].sort())
    expect(first.files.length).toBeGreaterThan(31)
    expect(first.moduleResolutionAudit.repositoryModules.length).toBeGreaterThan(20)
    expect(first.runtimeInputAudit.callSites.length).toBeGreaterThan(100)
    expect(first.runtimeInputAudit.declarationSha256).toMatch(/^[a-f0-9]{64}$/u)

    const files = new Map(first.files.map((entry) => [entry.path, entry]))
    for (const path of [
      '.nvmrc',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'supabase/config.toml',
      'scripts/require-primary-checkout.mjs',
      ...PROTECTED_V2_OPERATOR_BUNDLE_ROOTS,
    ]) {
      expect(files.has(path)).toBe(true)
    }
    expect(
      files.get(
        'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
      )?.sha256,
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256)
    expect(
      files.get(
        'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
      )?.sha256,
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256)
  })

  it('changes for every protected configuration, package, migration, verifier, and source class', async () => {
    const cwd = await copyRepositoryFixture()
    const baseline = await buildProtectedV2OperatorBundle({ cwd })
    const paths = [
      'tsconfig.json',
      'package.json',
      'package-lock.json',
      'supabase/config.toml',
      'scripts/require-primary-checkout.mjs',
      'supabase/migrations/20260727032621_add_literature_explorer.sql',
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
      'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
      'scripts/literature/apply-protected-gold-import-contract-v2.ts',
      'scripts/literature/gold-import-compensation-migration-operations.ts',
    ]
    for (const path of paths) {
      const absolutePath = resolve(cwd, path)
      const original = await readFile(absolutePath)
      await append(absolutePath, path.endsWith('.json') ? '\n' : undefined)
      const changed = await buildProtectedV2OperatorBundle({ cwd })
      expect(changed.aggregateSha256).not.toBe(baseline.aggregateSha256)
      await writeFile(absolutePath, original)
      expect((await buildProtectedV2OperatorBundle({ cwd })).aggregateSha256).toBe(
        baseline.aggregateSha256,
      )
    }
  })

  it('seals recursive tsconfig extensions and locally redirected bare-import targets', async () => {
    const cwd = await copyRepositoryFixture()
    const originalConfig = JSON.parse(await readFile(resolve(cwd, 'tsconfig.json'), 'utf8')) as {
      compilerOptions: Record<string, unknown>
      exclude?: unknown
      include?: unknown
    }
    await writeFile(
      resolve(cwd, 'tsconfig.base.json'),
      JSON.stringify({ compilerOptions: originalConfig.compilerOptions }),
      'utf8',
    )
    await writeFile(
      resolve(cwd, 'tsconfig.json'),
      JSON.stringify({
        exclude: originalConfig.exclude,
        extends: './tsconfig.base.json',
        include: originalConfig.include,
      }),
      'utf8',
    )
    await git(cwd, ['add', 'tsconfig.base.json'])
    const extended = await buildProtectedV2OperatorBundle({ cwd })
    expect(extended.roots).toContain('tsconfig.base.json')
    await append(resolve(cwd, 'tsconfig.base.json'), '\n')
    expect((await buildProtectedV2OperatorBundle({ cwd })).aggregateSha256).not.toBe(
      extended.aggregateSha256,
    )

    const target = 'runtime-fixtures/zod-redirect.ts'
    await mkdir(resolve(cwd, 'runtime-fixtures'), { recursive: true })
    await writeFile(resolve(cwd, target), 'export const z = {}\n', 'utf8')
    await git(cwd, ['add', target])
    const redirectedConfig = {
      ...originalConfig,
      compilerOptions: {
        ...originalConfig.compilerOptions,
        paths: {
          ...(originalConfig.compilerOptions.paths as Record<string, string[]>),
          zod: [`./${target}`],
        },
      },
    }
    await writeFile(resolve(cwd, 'tsconfig.json'), JSON.stringify(redirectedConfig), 'utf8')
    const redirected = await buildProtectedV2OperatorBundle({ cwd })
    expect(redirected.files.map(({ path }) => path)).toContain(target)
    expect(redirected.moduleResolutionAudit.records).toContainEqual(
      expect.objectContaining({ kind: 'repository', resolvedPath: target, specifier: 'zod' }),
    )
    await append(resolve(cwd, target), '// target mutation\n')
    expect((await buildProtectedV2OperatorBundle({ cwd })).aggregateSha256).not.toBe(
      redirected.aggregateSha256,
    )
  })

  it('changes for expected artifacts and newly tracked protected files but ignores untracked ones', async () => {
    const cwd = await copyRepositoryFixture()
    const baseline = await buildProtectedV2OperatorBundle({ cwd })
    const untracked = resolve(cwd, 'scripts/literature/untracked-shadow.ts')
    await writeFile(untracked, 'export const shadow = true\n')
    expect((await buildProtectedV2OperatorBundle({ cwd })).aggregateSha256).toBe(
      baseline.aggregateSha256,
    )

    await git(cwd, ['add', 'scripts/literature/untracked-shadow.ts'])
    const newlyTracked = await buildProtectedV2OperatorBundle({ cwd })
    expect(newlyTracked.aggregateSha256).not.toBe(baseline.aggregateSha256)
    expect(newlyTracked.files.map(({ path }) => path)).toContain(
      'scripts/literature/untracked-shadow.ts',
    )

    const artifact = resolve(cwd, 'scripts/literature/contracts/profile.json')
    await mkdir(dirname(artifact), { recursive: true })
    await writeFile(artifact, '{"profile":"exact"}\n')
    await git(cwd, ['add', 'scripts/literature/contracts/profile.json'])
    const artifactBaseline = await buildProtectedV2OperatorBundle({ cwd })
    await writeFile(artifact, '{"profile":"drifted"}\n')
    expect((await buildProtectedV2OperatorBundle({ cwd })).aggregateSha256).not.toBe(
      artifactBaseline.aggregateSha256,
    )
  })

  it('rejects deleted, symlinked, and untracked shadow dependencies', async () => {
    const deleted = await copyRepositoryFixture()
    await rm(resolve(deleted, 'supabase/config.toml'))
    await expect(buildProtectedV2OperatorBundle({ cwd: deleted })).rejects.toThrow(
      /deleted|missing|configuration/u,
    )

    const symlinked = await copyRepositoryFixture()
    await writeFile(resolve(symlinked, 'outside.ts'), 'export const outside = true\n')
    await symlink(
      resolve(symlinked, 'outside.ts'),
      resolve(symlinked, 'scripts/literature/symlink.ts'),
    )
    await git(symlinked, ['add', 'scripts/literature/symlink.ts'])
    await expect(buildProtectedV2OperatorBundle({ cwd: symlinked })).rejects.toThrow(
      'non-regular Git mode',
    )

    const ancestorSymlink = await copyRepositoryFixture()
    await rename(
      resolve(ancestorSymlink, 'scripts/literature'),
      resolve(ancestorSymlink, 'scripts/redirected-literature'),
    )
    await symlink('redirected-literature', resolve(ancestorSymlink, 'scripts/literature'), 'dir')
    await expect(buildProtectedV2OperatorBundle({ cwd: ancestorSymlink })).rejects.toThrow(
      'resolves through a symlink',
    )

    const shadowed = await copyRepositoryFixture()
    await writeFile(
      resolve(shadowed, 'scripts/literature/untracked-module.ts'),
      'export const untracked = true\n',
    )
    await append(
      resolve(shadowed, 'scripts/literature/apply-protected-gold-import-contract-v2.ts'),
      "\nimport './untracked-module'\n",
    )
    await expect(buildProtectedV2OperatorBundle({ cwd: shadowed })).rejects.toThrow(
      'is not Git-tracked',
    )
  })

  it('permits unrelated tracked documentation and source outside the sealed boundary', async () => {
    const cwd = await copyRepositoryFixture()
    const baseline = await buildProtectedV2OperatorBundle({ cwd })
    await mkdir(resolve(cwd, 'docs'), { recursive: true })
    await writeFile(resolve(cwd, 'docs/unrelated.md'), '# Unrelated\n')
    await mkdir(resolve(cwd, 'src/unrelated'), { recursive: true })
    await writeFile(resolve(cwd, 'src/unrelated/example.ts'), 'export const unrelated = true\n')
    await git(cwd, ['add', 'docs/unrelated.md', 'src/unrelated/example.ts'])
    const descendant = await buildProtectedV2OperatorBundle({ cwd })
    expect(descendant).toEqual(baseline)
    expect(() =>
      assertProtectedV2OperatorBundleUnchanged({ current: descendant, intent: baseline }),
    ).not.toThrow()
  })

  it('validates canonical inventory and rejects protected descendant drift', async () => {
    const cwd = await copyRepositoryFixture()
    const intent = await buildProtectedV2OperatorBundle({ cwd })
    expect(validateProtectedV2OperatorBundle(intent)).toEqual(intent)
    await append(resolve(cwd, 'tsconfig.json'), '\n')
    const current = await buildProtectedV2OperatorBundle({ cwd })
    expect(() => assertProtectedV2OperatorBundleUnchanged({ current, intent })).toThrow(
      'runtime-bundle',
    )

    const tampered = structuredClone(intent)
    tampered.files[0]!.sha256 = '0'.repeat(64)
    expect(() => validateProtectedV2OperatorBundle(tampered)).toThrow('aggregate identity')
  })

  it('preserves the pinned V1, V2, and verifier source identities', async () => {
    const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    expect(
      sha256(
        await readFile(
          resolve(
            process.cwd(),
            'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
          ),
        ),
      ),
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256)
    expect(
      sha256(
        await readFile(
          resolve(
            process.cwd(),
            'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
          ),
        ),
      ),
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256)
    expect(
      sha256(
        await readFile(
          resolve(
            process.cwd(),
            'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
          ),
        ),
      ),
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256)
  })
})
