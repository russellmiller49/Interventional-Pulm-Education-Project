/** @jest-environment node */

import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import {
  buildProtectedV2ModuleResolutionAudit,
  type BuildProtectedV2ModuleResolutionAuditInput,
} from './protected-gold-import-contract-v2-module-resolution'

interface ModuleFixture {
  cwd: string
  input: BuildProtectedV2ModuleResolutionAuditInput
  trackedPaths: Set<string>
  writeTracked: (path: string, bytes: string) => Promise<void>
}

describe('protected V2 TypeScript compiler module resolution', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  async function fixture(
    rootSource: string,
    tsconfig?: Record<string, unknown>,
  ): Promise<ModuleFixture> {
    const cwd = await mkdtemp(resolve(tmpdir(), 'protected-v2-module-resolution-'))
    cleanup.push(cwd)
    const trackedPaths = new Set<string>()
    const writeTracked = async (path: string, bytes: string) => {
      await mkdir(dirname(resolve(cwd, path)), { recursive: true })
      await writeFile(resolve(cwd, path), bytes, 'utf8')
      trackedPaths.add(path)
    }
    await writeTracked(
      'package.json',
      `${JSON.stringify(
        {
          dependencies: { 'fixture-package': '1.0.0' },
          devDependencies: { typescript: '5.9.3' },
        },
        null,
        2,
      )}\n`,
    )
    await writeTracked(
      'package-lock.json',
      `${JSON.stringify(
        {
          lockfileVersion: 3,
          name: 'fixture',
          packages: {
            '': {
              dependencies: { 'fixture-package': '1.0.0' },
              devDependencies: { typescript: '5.9.3' },
            },
            'node_modules/fixture-package': {
              integrity: 'sha512-YQ==',
              resolved: 'https://registry.npmjs.org/fixture-package/-/fixture-package-1.0.0.tgz',
              version: '1.0.0',
            },
            'node_modules/typescript': {
              integrity: 'sha512-Yg==',
              resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz',
              version: '5.9.3',
            },
          },
        },
        null,
        2,
      )}\n`,
    )
    await mkdir(resolve(cwd, 'node_modules/fixture-package'), { recursive: true })
    await writeFile(
      resolve(cwd, 'node_modules/fixture-package/package.json'),
      JSON.stringify({ name: 'fixture-package', types: 'index.d.ts', version: '1.0.0' }),
      'utf8',
    )
    await writeFile(
      resolve(cwd, 'node_modules/fixture-package/index.d.ts'),
      'declare const value: string; export default value\n',
      'utf8',
    )
    await writeTracked(
      'tsconfig.json',
      `${JSON.stringify(
        tsconfig ?? {
          compilerOptions: {
            module: 'ESNext',
            moduleResolution: 'Bundler',
            resolveJsonModule: true,
          },
        },
        null,
        2,
      )}\n`,
    )
    await writeTracked('src/root.ts', rootSource)
    return {
      cwd,
      input: {
        cwd,
        entryPoints: ['src/root.ts'],
        packageJsonPath: 'package.json',
        packageLockPath: 'package-lock.json',
        trackedPaths,
        tsconfigPath: 'tsconfig.json',
      },
      trackedPaths,
      writeTracked,
    }
  }

  it('uses the compiler API for every supported module syntax, JSON, and external packages', async () => {
    const test = await fixture(`
      import './side-effect'
      export { exported } from './exported'
      import equals = require('./equals')
      const required = require('./required')
      const resolved = require.resolve('./resolved')
      const lazy = import('./lazy')
      import { createRequire } from 'node:module'
      const localRequire = createRequire(import.meta.url)
      const created = localRequire('./created')
      type Imported = import('./types').Imported
      import data from './data.json'
      import fixturePackage from 'fixture-package'
      void [equals, required, resolved, lazy, created, data, fixturePackage]
      export type { Imported }
    `)
    for (const path of [
      'side-effect',
      'exported',
      'equals',
      'required',
      'resolved',
      'lazy',
      'created',
      'types',
    ]) {
      await test.writeTracked(
        `src/${path}.ts`,
        `export const exported = '${path}'\nexport type Imported = string\n`,
      )
    }
    await test.writeTracked('src/data.json', '{"exact":true}\n')

    const first = buildProtectedV2ModuleResolutionAudit(test.input)
    const repeated = buildProtectedV2ModuleResolutionAudit(test.input)

    expect(repeated).toEqual(first)
    expect(new Set(first.records.map(({ syntax }) => syntax))).toEqual(
      new Set([
        'create_require',
        'dynamic_import',
        'export',
        'import',
        'import_equals',
        'import_type',
        'require',
        'require_resolve',
      ]),
    )
    expect(first.repositoryModules).toEqual(
      expect.arrayContaining(['src/data.json', 'src/created.ts', 'src/root.ts']),
    )
    expect(first.externalPackages).toEqual(['fixture-package'])
    expect(first.records).toContainEqual(
      expect.objectContaining({ kind: 'builtin', specifier: 'node:module' }),
    )
  })

  it('honors committed baseUrl/paths and seals bare imports redirected to local files', async () => {
    const test = await fixture("import value from 'fixture-package'\nvoid value\n", {
      compilerOptions: {
        baseUrl: '.',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        paths: { 'fixture-package': ['./src/local-one.ts'] },
      },
    })
    await test.writeTracked('src/local-one.ts', "export default 'one'\n")
    await test.writeTracked('src/local-two.ts', "export default 'two'\n")
    const first = buildProtectedV2ModuleResolutionAudit(test.input)
    expect(first.records).toContainEqual(
      expect.objectContaining({
        kind: 'repository',
        resolvedPath: 'src/local-one.ts',
        specifier: 'fixture-package',
      }),
    )

    await test.writeTracked(
      'tsconfig.json',
      `${JSON.stringify(
        {
          compilerOptions: {
            baseUrl: '.',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            paths: { 'fixture-package': ['./src/local-two.ts'] },
          },
        },
        null,
        2,
      )}\n`,
    )
    const redirected = buildProtectedV2ModuleResolutionAudit(test.input)
    expect(redirected.sha256).not.toBe(first.sha256)
    expect(redirected.records).toContainEqual(
      expect.objectContaining({ resolvedPath: 'src/local-two.ts' }),
    )
  })

  it('uses and inventories every recursively extended committed tsconfig', async () => {
    const test = await fixture("import './dependency'\n", { extends: './config/base.json' })
    await test.writeTracked('src/dependency.ts', 'export const dependency = true\n')
    await test.writeTracked(
      'config/base.json',
      JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' } }),
    )
    const first = buildProtectedV2ModuleResolutionAudit(test.input)
    expect(first.tsconfigPaths).toEqual(['config/base.json', 'tsconfig.json'])

    await test.writeTracked(
      'config/base.json',
      JSON.stringify({
        compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', strict: true },
      }),
    )
    const changed = buildProtectedV2ModuleResolutionAudit(test.input)
    expect(changed.compilerOptionsSha256).not.toBe(first.compilerOptionsSha256)
    expect(changed.sha256).not.toBe(first.sha256)
  })

  it.each([
    [
      "const name = './dependency'; void import(name)\n",
      'dynamic or assembled modules fail closed',
    ],
    ["const name = './dependency'; require(name)\n", 'dynamic or assembled modules fail closed'],
    [
      "const part = 'dependency'; require(`./${part}`)\n",
      'dynamic or assembled modules fail closed',
    ],
    [
      "import { createRequire } from 'node:module'; const load = createRequire(process.cwd()); load('./dependency')\n",
      'exactly from import.meta.url',
    ],
    ["const load = require; load('./dependency')\n", 'Unsupported module-loader reference'],
    [
      "import * as moduleApi from 'node:module'; const load = moduleApi.createRequire(import.meta.url); load('./dependency')\n",
      'Unsupported module-loader syntax',
    ],
    [
      "import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const load = localRequire; load('./dependency')\n",
      'Unsupported module-loader reference',
    ],
    [
      "import { createRequire } from 'node:module'; const { resolve: load } = createRequire(import.meta.url); load('./dependency')\n",
      'Unsupported createRequire use',
    ],
    ["module.require('./dependency')\n", 'Unsupported module-loader syntax'],
    ['eval("require(\'./dependency\')")\n', 'Unsupported executable module-loader syntax'],
    [
      `const evaluate = eval; void evaluate("require('./dependency')")`,
      'Unsupported executable module-loader reference',
    ],
    [
      `const Constructor = Function; void new Constructor("return require('./dependency')")`,
      'Unsupported executable module-loader reference',
    ],
    [
      `const Constructor = (() => {}).constructor; void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const Constructor = ({}).constructor.constructor; void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const Constructor = (() => {})['constructor']; void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const key = 'constructor'; const Constructor = (() => {})[key]; void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const suffix = 'structor'; const key = \`con\${suffix}\`; const Constructor = (() => {})[key]; void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const { constructor: Constructor } = (() => {}); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const key = 'con' + 'structor'; const { [key]: Constructor } = (() => {}); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `let Constructor; ({ constructor: Constructor } = (() => {})); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `let Constructor; ({ holder: { constructor: Constructor } } = { holder: () => {} }); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `let Constructor; ({ holder: [{ constructor: Constructor }] } = { holder: [() => {}] }); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `let Constructor; const key = 'con' + 'structor'; ({ holder: { [key]: Constructor } } = { holder: () => {} }); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported executable constructor reference',
    ],
    [
      `const Constructor = Reflect.get(() => {}, 'constructor'); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported reflective constructor reference',
    ],
    [
      `const key = 'con' + 'structor'; const get = Reflect.get; const Constructor = get(() => {}, key); void Constructor("return process.getBuiltinModule('module')")()`,
      'Unsupported reflective constructor reference',
    ],
  ])('fails closed for unsupported module-loader syntax', async (source, message) => {
    const test = await fixture(source)
    await test.writeTracked('src/dependency.ts', 'export const dependency = true\n')
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(message)
  })

  it('allows constructor as an inert object property name', async () => {
    const test = await fixture(
      "const metadata = { constructor: 'descriptor', nested: { ['constructor']: 'computed' } }; let holder; ({ holder = { constructor: 'default' } } = {}); class Example { constructor() {} }; void metadata; void holder; void Example\n",
    )
    expect(buildProtectedV2ModuleResolutionAudit(test.input).records).toEqual([])
  })

  it.each([
    [
      'assembled createRequire member',
      "import * as moduleApi from 'node:module'; const property = `create${'Require'}`; const localRequire = moduleApi[property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'bracket-literal createRequire member',
      "import * as moduleApi from 'node:module'; const localRequire = moduleApi['createRequire'](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'namespace alias',
      "import * as moduleApi from 'node:module'; const escaped = moduleApi; void escaped",
    ],
    [
      'namespace call argument',
      "import * as moduleApi from 'node:module'; function consume(value: unknown) { void value }; consume(moduleApi)",
    ],
    [
      'returned namespace',
      "import * as moduleApi from 'node:module'; function expose() { return moduleApi }; void expose",
    ],
    [
      'namespace in object and array values',
      "import * as moduleApi from 'node:module'; const wrapped = { moduleApi, values: [moduleApi] }; void wrapped",
    ],
    [
      'default module binding',
      "import moduleApi from 'node:module'; const property = 'createRequire'; void moduleApi[property]",
    ],
    [
      'named-default module binding',
      "import { default as moduleApi } from 'node:module'; const property = `create${'Require'}`; const localRequire = moduleApi[property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'named Module binding',
      "import { Module as moduleApi } from 'node:module'; const property = `create${'Require'}`; const localRequire = moduleApi[property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'register binding',
      "import { register as loadHook } from 'node:module'; void loadHook('./dependency')",
    ],
    [
      'registerHooks binding',
      "import { registerHooks as loadHooks } from 'node:module'; void loadHooks({ resolve() { return { shortCircuit: true, url: './dependency' } } })",
    ],
    [
      'import-equals module binding',
      "import moduleApi = require('node:module'); function expose() { return moduleApi }; void expose",
    ],
    [
      'CommonJS module binding',
      "const moduleApi = require('node:module'); function expose() { return moduleApi }; void expose",
    ],
    [
      'parenthesized CommonJS module binding',
      "const moduleApi = (require('node:module') as typeof import('node:module')); const property = `create${'Require'}`; void moduleApi[property]",
    ],
    [
      'inline CommonJS module namespace',
      "const property = `create${'Require'}`; void require('node:module')[property](import.meta.url)",
    ],
    [
      'assembled global CommonJS module member',
      "const property = `re${'quire'}`; const localRequire = module[property]; void localRequire('./dependency')",
    ],
    [
      'bracket-literal global CommonJS module alias',
      "const localRequire = module['require']; void localRequire('./dependency')",
    ],
    [
      'globalThis module namespace',
      "const property = 'create' + 'Require'; const localRequire = globalThis.module[property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'global module namespace',
      "const property = 'create' + 'Require'; const localRequire = global.module[property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'bracket globalThis module namespace',
      "const property = 'create' + 'Require'; const localRequire = globalThis['module'][property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'aliased global root with assembled properties',
      "const root = globalThis; const moduleName = 'mod' + 'ule'; const property = 'create' + 'Require'; const localRequire = root[moduleName][property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'process getBuiltinModule',
      "const property = 'create' + 'Require'; const localRequire = process.getBuiltinModule('module')[property](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'computed process getBuiltinModule alias',
      "const property = 'getBuiltin' + 'Module'; const getBuiltin = process[property]; const moduleApi = getBuiltin('module'); const localRequire = moduleApi['createRequire'](import.meta.url); void localRequire('./dependency')",
    ],
    [
      'globalThis process getBuiltinModule',
      "const moduleApi = globalThis.process.getBuiltinModule('module'); const localRequire = moduleApi.createRequire(import.meta.url); void localRequire('./dependency')",
    ],
    [
      'assembled process mainModule require',
      "const property = 're' + 'quire'; const localRequire = process.mainModule[property]; void localRequire('./dependency')",
    ],
    [
      'bracket process mainModule require',
      "const property = 're' + 'quire'; const localRequire = process['mainModule'][property]; void localRequire('./dependency')",
    ],
    [
      'imported process namespace',
      "import processApi from 'node:process'; const moduleApi = processApi.getBuiltinModule('module'); void moduleApi",
    ],
    [
      'created-require process namespace',
      "import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const processApi = localRequire('node:process'); void processApi",
    ],
    [
      'created-require node:module namespace',
      "import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const moduleApi = localRequire('node:module'); const property = 'create' + 'Require'; const nestedRequire = moduleApi[property](import.meta.url); void nestedRequire('./dependency')",
    ],
    [
      'created-require bare module namespace',
      "import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const moduleApi = localRequire('module'); const property = 'create' + 'Require'; const nestedRequire = moduleApi[property](import.meta.url); void nestedRequire('./dependency')",
    ],
    [
      'dynamic module namespace import',
      "async function load() { const moduleApi = await import('node:module'); return moduleApi }; void load",
    ],
    ['module namespace export', "export * from 'node:module'"],
  ])('rejects module namespace escape through %s', async (_label, source) => {
    const test = await fixture(source)
    await test.writeTracked('src/dependency.ts', 'export const dependency = true\n')
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      /Unsupported (?:.*module namespace|.*module-loader|CommonJS module reference|node:module named binding|.*node:process)/u,
    )
  })

  it.each(['default', 'Module'])(
    'rejects cross-file %s module namespace re-exports',
    async (name) => {
      const test = await fixture(`
      import { moduleApi } from './bridge'
      const property = \`create\${'Require'}\`
      const localRequire = moduleApi[property](import.meta.url)
      void localRequire('./dependency')
    `)
      await test.writeTracked(
        'src/bridge.ts',
        `export { ${name} as moduleApi } from 'node:module'\n`,
      )
      await test.writeTracked('src/dependency.ts', 'export const dependency = true\n')
      expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
        'Unsupported module namespace export',
      )
    },
  )

  it('rejects unresolved and untracked repository-local modules', async () => {
    const unresolved = await fixture("import './missing'\n")
    expect(() => buildProtectedV2ModuleResolutionAudit(unresolved.input)).toThrow(
      'cannot be resolved',
    )

    const untracked = await fixture("import './untracked'\n")
    await mkdir(resolve(untracked.cwd, 'src'), { recursive: true })
    await writeFile(resolve(untracked.cwd, 'src/untracked.ts'), 'export const value = true\n')
    expect(() => buildProtectedV2ModuleResolutionAudit(untracked.input)).toThrow(
      'is not Git-tracked',
    )
  })

  it('rejects repository modules reached through a symlinked ancestor directory', async () => {
    const test = await fixture("import './dependency'\n")
    await test.writeTracked('src/dependency.ts', 'export const dependency = true\n')
    await rename(resolve(test.cwd, 'src'), resolve(test.cwd, 'actual-src'))
    await symlink('actual-src', resolve(test.cwd, 'src'), 'dir')
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      'symlinked repository path',
    )
  })

  it('rejects external packages absent from either package binding', async () => {
    const test = await fixture("import value from 'fixture-package'\nvoid value\n")
    await test.writeTracked(
      'package.json',
      JSON.stringify({ dependencies: {}, devDependencies: { typescript: '5.9.3' } }),
    )
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      'manifest and lock root dependencies inventories drifted',
    )
  })

  it('requires exact immutable package-lock entries for every direct manifest declaration', async () => {
    const test = await fixture("import value from 'fixture-package'\nvoid value\n")
    const lock = JSON.parse(await readFile(resolve(test.cwd, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, unknown>
    }
    lock.packages['node_modules/fixture-package'] = null
    await test.writeTracked('package-lock.json', `${JSON.stringify(lock)}\n`)
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      'has no exact package-lock entry',
    )

    const localPackage = JSON.stringify({
      dependencies: { 'fixture-package': 'file:../mutable-package' },
      devDependencies: { typescript: '5.9.3' },
    })
    await test.writeTracked('package.json', localPackage)
    const localLock = {
      lockfileVersion: 3,
      packages: {
        '': {
          dependencies: { 'fixture-package': 'file:../mutable-package' },
          devDependencies: { typescript: '5.9.3' },
        },
        'node_modules/fixture-package': { link: true, resolved: '../mutable-package' },
        'node_modules/typescript': {
          integrity: 'sha512-Yg==',
          resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz',
          version: '5.9.3',
        },
      },
    }
    await test.writeTracked('package-lock.json', JSON.stringify(localLock))
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      'uses an unsealed local dependency',
    )
  })

  it('rejects a bound bare package redirected outside both the repository and package tree', async () => {
    const outside = await mkdtemp(resolve(tmpdir(), 'protected-v2-outside-module-'))
    cleanup.push(outside)
    await writeFile(resolve(outside, 'target.ts'), "export default 'outside'\n", 'utf8')
    const test = await fixture("import value from 'fixture-package'\nvoid value\n", {
      compilerOptions: {
        baseUrl: '.',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        paths: { 'fixture-package': [resolve(outside, 'target.ts')] },
      },
    })
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      'resolved outside the repository and package tree',
    )
  })

  it('requires external resolution to stay inside the declared package tree', async () => {
    const test = await fixture("import value from 'fixture-package'\nvoid value\n")
    await mkdir(resolve(test.cwd, 'node_modules/typescript/lib'), { recursive: true })
    await writeFile(
      resolve(test.cwd, 'node_modules/typescript/lib/typescript.d.ts'),
      'declare const value: string; export default value\n',
      'utf8',
    )
    await writeFile(
      resolve(test.cwd, 'node_modules/fixture-package/package.json'),
      JSON.stringify({
        name: 'fixture-package',
        types: '../typescript/lib/typescript.d.ts',
        version: '1.0.0',
      }),
      'utf8',
    )
    expect(() => buildProtectedV2ModuleResolutionAudit(test.input)).toThrow(
      'outside its exact package-lock tree',
    )
  })
})
