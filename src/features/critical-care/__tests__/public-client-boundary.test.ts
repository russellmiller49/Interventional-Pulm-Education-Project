import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import ts from 'typescript'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { mergeCriticalCareSubsetProgress } from '../progress/publicAccountSync'

const sourceRoot = join(process.cwd(), 'src')
const publicClientEntries = [
  'features/critical-care/components/CriticalCareAccountSync.tsx',
  'features/critical-care/components/CriticalCareCasesLibrary.tsx',
  'features/critical-care/components/CriticalCareHub.tsx',
  'features/critical-care/components/CriticalCareLabsLibrary.tsx',
  'features/critical-care/components/CriticalCareNotebookView.tsx',
  'features/critical-care/components/CriticalCarePathways.tsx',
  'features/critical-care/components/CriticalCareProgressView.tsx',
  'features/critical-care/components/CriticalCareReferenceLibrary.tsx',
].map((path) => join(sourceRoot, path))

const forbiddenRuntimeSuffixes = [
  'features/critical-care/components/CriticalCareRestrictedAccountSync.tsx',
  'features/critical-care/content/activities.ts',
  'features/critical-care/content/assets.ts',
  'features/critical-care/content/competencies.ts',
  'features/critical-care/content/modules.ts',
  'features/critical-care/content/pathways.ts',
  'features/critical-care/content/publicCatalog.server.ts',
  'features/critical-care/content/publicVisibility.ts',
  'features/critical-care/content/references.ts',
  'features/critical-care/dashboard.ts',
  'features/critical-care/progress/accountSync.ts',
  'features/critical-care/progress/adapters/ecmo.ts',
  'features/critical-care/progress/adapters/icuSimulation.ts',
  'features/critical-care/progress/index.ts',
  'lib/critical-care-progress-sync.ts',
]

const forbiddenSerializedValues = [
  'cardiohelp-ecmo',
  'icu-simulation',
  'ECMO Management',
  'CARDIOHELP',
  'Integrated ICU Simulator',
  'ecmo:',
  'icu:practice:',
  'icu:assess:',
  'septic-ards-aki',
  'lv-cardiogenic',
  'massive-pe-rv',
  'mixed-cardiogenic-vasodilatory',
]

function resolveProjectModule(fromFile: string, specifier: string): string | null {
  let unresolved: string
  if (specifier.startsWith('@/')) unresolved = join(sourceRoot, specifier.slice(2))
  else if (specifier.startsWith('.')) unresolved = resolve(dirname(fromFile), specifier)
  else return null

  const candidates = extname(unresolved)
    ? [unresolved]
    : [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        `${unresolved}.js`,
        `${unresolved}.jsx`,
        join(unresolved, 'index.ts'),
        join(unresolved, 'index.tsx'),
      ]
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  )
}

function runtimeImports(file: string): readonly string[] {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const imports = new Set<string>()

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const namedBindings = clause?.namedBindings
      const onlyNamedTypeImports =
        clause !== undefined &&
        clause.name === undefined &&
        namedBindings !== undefined &&
        ts.isNamedImports(namedBindings) &&
        namedBindings.elements.every((element) => element.isTypeOnly)
      if (!clause?.isTypeOnly && !onlyNamedTypeImports) imports.add(node.moduleSpecifier.text)
    }
    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.add(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.add(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...imports]
}

function collectRuntimeGraph(entries: readonly string[]): ReadonlySet<string> {
  const visited = new Set<string>()
  const pending = [...entries]
  while (pending.length > 0) {
    const file = pending.pop()
    if (!file || visited.has(file)) continue
    visited.add(file)
    for (const specifier of runtimeImports(file)) {
      const resolved = resolveProjectModule(file, specifier)
      if (resolved && !visited.has(resolved)) pending.push(resolved)
    }
  }
  return visited
}

describe('critical-care public client data boundary', () => {
  it('serializes only reviewed, public-safe catalog records into client props', () => {
    const catalog = buildCriticalCarePublicClientCatalog()
    const serialized = JSON.stringify(catalog)

    for (const forbidden of forbiddenSerializedValues) expect(serialized).not.toContain(forbidden)
    expect(serialized).not.toContain('recommendedIcuScenarioIds')
    expect(catalog.modules).toHaveLength(4)
    expect(catalog.activities.every((activity) => activity.reviewStatus !== 'draft')).toBe(true)
    expect(catalog.pathways.every((pathway) => pathway.moduleIds.length > 0)).toBe(true)
    expect(catalog.modules.every((module) => !module.integrated)).toBe(true)
  })

  it('keeps full and restricted catalogs out of every public client runtime graph', () => {
    const graph = collectRuntimeGraph(publicClientEntries)
    const relativeGraph = [...graph].map((file) => normalize(file).slice(sourceRoot.length + 1))

    for (const entry of publicClientEntries) {
      expect(readFileSync(entry, 'utf8')).toMatch(/^'use client'/)
    }
    for (const forbidden of forbiddenRuntimeSuffixes) {
      expect(relativeGraph).not.toContain(normalize(forbidden))
    }
    expect(relativeGraph.some((file) => file.startsWith('features/cardiohelp-ecmo/'))).toBe(false)
    expect(relativeGraph.some((file) => file.startsWith('features/icu-simulation/'))).toBe(false)
  })

  it('reconciles account hydration without clobbering another catalog subset or its resume', () => {
    const fullEnvelope = {
      version: 1 as const,
      activities: [
        {
          activityId: 'hemodynamics:learn:pac-signal-validation',
          status: 'in-progress' as const,
          attempts: 1,
          competencyEvidenceIds: [],
          updatedAt: '2026-07-22T10:00:00.000Z',
        },
        {
          activityId: 'icu:practice:septic-ards-aki',
          status: 'in-progress' as const,
          attempts: 2,
          competencyEvidenceIds: [],
          updatedAt: '2026-07-22T11:00:00.000Z',
        },
      ],
      resume: {
        activityId: 'icu:practice:septic-ards-aki',
        pathname: '/icu-simulation/practice',
        query: { case: 'septic-ards-aki' },
        mode: 'practice' as const,
        phase: 'act' as const,
        payloadVersion: 'icu-v1',
        updatedAt: '2026-07-22T12:00:00.000Z',
      },
      updatedAt: '2026-07-22T12:00:00.000Z',
    }
    const publicHydration = {
      version: 1 as const,
      activities: [
        {
          activityId: 'hemodynamics:learn:pac-signal-validation',
          status: 'completed' as const,
          attempts: 1,
          competencyEvidenceIds: [],
          updatedAt: '2026-07-22T13:00:00.000Z',
        },
      ],
      resume: {
        activityId: 'hemodynamics:learn:pac-signal-validation',
        pathname: '/icu-hemodynamics/learn',
        query: { activity: 'pac-signal-validation' },
        mode: 'guided' as const,
        phase: 'recognize' as const,
        payloadVersion: 'hemodynamics-v1',
        updatedAt: '2026-07-22T09:00:00.000Z',
      },
      updatedAt: '2026-07-22T13:00:00.000Z',
    }

    const reconciled = mergeCriticalCareSubsetProgress(fullEnvelope, publicHydration)

    expect(reconciled.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'hemodynamics:learn:pac-signal-validation',
          status: 'completed',
        }),
        expect.objectContaining({
          activityId: 'icu:practice:septic-ards-aki',
          status: 'in-progress',
        }),
      ]),
    )
    expect(reconciled.resume).toEqual(fullEnvelope.resume)
  })

  it('keeps restricted labels and descriptions out of public route source and metadata', () => {
    const publicFiles = [
      ...publicClientEntries,
      join(sourceRoot, 'app/[locale]/critical-care/page.tsx'),
      join(sourceRoot, 'app/[locale]/critical-care/labs/page.tsx'),
      join(sourceRoot, 'app/[locale]/critical-care/pathways/page.tsx'),
      join(sourceRoot, 'app/[locale]/critical-care/pathways/[pathwayId]/page.tsx'),
    ]
    const publicSource = publicFiles.map((file) => readFileSync(file, 'utf8')).join('\n')

    for (const forbidden of forbiddenSerializedValues) {
      expect(publicSource).not.toContain(forbidden)
    }
    expect(publicSource).not.toContain('Integrated ICU')
    expect(publicSource).not.toContain('private capstone')
  })

  it('mounts the restricted sync leaf only from restricted route layouts', () => {
    const publicLayout = readFileSync(join(sourceRoot, 'app/[locale]/layout.tsx'), 'utf8')
    const restrictedLayouts = [
      'app/[locale]/cardiohelp-ecmo/layout.tsx',
      'app/[locale]/icu-simulation/layout.tsx',
    ].map((file) => readFileSync(join(sourceRoot, file), 'utf8'))

    expect(publicLayout).not.toContain('CriticalCareRestrictedAccountSync')
    for (const source of restrictedLayouts) {
      expect(source).toContain('CriticalCareRestrictedAccountSync')
    }
  })
})
