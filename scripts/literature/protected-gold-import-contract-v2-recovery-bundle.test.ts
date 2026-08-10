/** @jest-environment node */

import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
} from './protected-gold-import-contract-v2'
import {
  PROTECTED_V2_OPERATOR_BUNDLE_ROOTS,
  assertProtectedV2OperatorBundleUnchanged,
  buildProtectedV2OperatorBundle,
  protectedV2RelativeImports,
  validateProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'

describe('protected V2 deterministic recovery bundle', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  it('parses static, side-effect, re-export, and dynamic relative imports deterministically', () => {
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

  it('seals the exact transitive relative-import closure and changes on bytes or inventory drift', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'protected-v2-bundle-'))
    cleanup.push(cwd)
    await mkdir(resolve(cwd, 'src'))
    await Promise.all([
      writeFile(resolve(cwd, 'src/root.ts'), "import './dependency'\n", 'utf8'),
      writeFile(resolve(cwd, 'src/dependency.ts'), "export { value } from './leaf'\n", 'utf8'),
      writeFile(resolve(cwd, 'src/leaf.ts'), 'export const value = 1\n', 'utf8'),
    ])
    const first = await buildProtectedV2OperatorBundle({ cwd, roots: ['src/root.ts'] })
    const repeated = await buildProtectedV2OperatorBundle({ cwd, roots: ['src/root.ts'] })
    expect(repeated).toEqual(first)
    expect(first.files.map(({ path }) => path)).toEqual([
      'src/dependency.ts',
      'src/leaf.ts',
      'src/root.ts',
    ])

    await writeFile(resolve(cwd, 'src/leaf.ts'), 'export const value = 2\n', 'utf8')
    const byteDrift = await buildProtectedV2OperatorBundle({ cwd, roots: ['src/root.ts'] })
    expect(byteDrift.aggregateSha256).not.toBe(first.aggregateSha256)
    expect(() =>
      assertProtectedV2OperatorBundleUnchanged({ current: byteDrift, intent: first }),
    ).toThrow('dependency-inventory drift')

    await writeFile(resolve(cwd, 'src/new-dependency.ts'), 'export const added = true\n', 'utf8')
    await writeFile(
      resolve(cwd, 'src/root.ts'),
      "import './dependency'\nimport './new-dependency'\n",
      'utf8',
    )
    const inventoryDrift = await buildProtectedV2OperatorBundle({ cwd, roots: ['src/root.ts'] })
    expect(inventoryDrift.files.map(({ path }) => path)).toContain('src/new-dependency.ts')
    expect(inventoryDrift.aggregateSha256).not.toBe(byteDrift.aggregateSha256)
  })

  it('rejects symlinked protected dependencies', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'protected-v2-bundle-symlink-'))
    cleanup.push(cwd)
    await mkdir(resolve(cwd, 'src'))
    await writeFile(resolve(cwd, 'outside.ts'), 'export const unsafe = true\n', 'utf8')
    await symlink(resolve(cwd, 'outside.ts'), resolve(cwd, 'src/dependency.ts'))
    await writeFile(resolve(cwd, 'src/root.ts'), "import './dependency'\n", 'utf8')
    await expect(buildProtectedV2OperatorBundle({ cwd, roots: ['src/root.ts'] })).rejects.toThrow(
      'rejects symlink',
    )
  })

  it('rejects non-canonical repository-relative inventory paths', () => {
    expect(() =>
      validateProtectedV2OperatorBundle({
        aggregateSha256: '0'.repeat(64),
        files: [{ path: './src/root.ts', sha256: '1'.repeat(64) }],
        roots: ['./src/root.ts'],
        schemaVersion: 'literature-gold-protected-v2-operator-bundle/1.0.0',
      }),
    ).toThrow('unsafe file identity')
  })

  it('covers every explicit runtime contract and pinned SQL identity in the real repository', async () => {
    const cwd = process.cwd()
    const first = await buildProtectedV2OperatorBundle({ cwd })
    const repeated = await buildProtectedV2OperatorBundle({ cwd })
    expect(repeated).toEqual(first)
    expect(first.roots).toEqual([...PROTECTED_V2_OPERATOR_BUNDLE_ROOTS].sort())
    const files = new Map(first.files.map((entry) => [entry.path, entry.sha256]))
    for (const path of [
      'package.json',
      'package-lock.json',
      'scripts/require-primary-checkout.mjs',
      'scripts/literature/apply-protected-gold-import-contract-v2.ts',
      'scripts/literature/protected-gold-import-contract-v2.ts',
      'scripts/literature/protected-gold-import-contract-v2-evidence.ts',
      'scripts/literature/gold-import-contract-v2-catalog-audit.ts',
      'scripts/literature/gold-import-compensation-contract-diagnostics.ts',
      'scripts/literature/gold-import-compensation-contract-reconciliation.ts',
      'scripts/literature/local-supabase.ts',
    ]) {
      expect(files.has(path)).toBe(true)
    }
    expect(
      files.get(
        'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
      ),
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256)
    expect(
      files.get(
        'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
      ),
    ).toBe(PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256)
  })
})
