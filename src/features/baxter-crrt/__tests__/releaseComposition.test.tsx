import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

describe('Baxter CRRT learner composition', () => {
  it('connects the four learner surfaces to the curated content and PrisMax runtime', () => {
    const componentDirectory = join(process.cwd(), 'src/features/baxter-crrt/components')
    const entries = [
      'BaxterCrrtHub.tsx',
      'BaxterCrrtLearn.tsx',
      'BaxterCrrtPractice.tsx',
      'BaxterCrrtAssess.tsx',
    ]
    const reachable = new Set(
      entries.flatMap((entry) => [
        ...collectLocalTypeScriptDependencies(join(componentDirectory, entry)),
      ]),
    )
    const graph = [...reachable].join('\n')

    expect(graph).toMatch(/content\/learnLessons/)
    expect(graph).toMatch(/content\/curriculum/)
    expect(graph).toMatch(/deviceAdapters\/prismax/)
    expect(graph).toMatch(/CrrtPrescriptionWorkbench/)
    expect(graph).toMatch(/CrrtPressureLocalizationLab/)
    expect(graph).not.toMatch(/deviceAdapters\/prismaflex/)
    expect(graph).not.toMatch(/crossDeviceTransfer/)
    expect(graph).not.toMatch(/CrrtPhase7InstructionalTools/)
  })

  it('removes the retired monolithic and reviewer-only entry points', () => {
    const root = process.cwd()
    for (const relativePath of [
      'src/features/baxter-crrt/components/BaxterCrrtLab.tsx',
      'src/features/baxter-crrt/components/CrrtLearningWorkflow.tsx',
      'src/features/baxter-crrt/components/CrrtCrossDeviceTransferReview.tsx',
      'src/features/baxter-crrt/components/CrrtPhase7InstructionalTools.tsx',
      'src/features/baxter-crrt/engine/deviceAdapters/prismaflex.ts',
      'src/app/[locale]/baxter-crrt/review/page.tsx',
    ]) {
      expect(existsSync(join(root, relativePath))).toBe(false)
    }
  })
})

function collectLocalTypeScriptDependencies(entry: string): Set<string> {
  const visited = new Set<string>()
  function visit(file: string) {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)) {
      const dependency = resolveLocalTypeScriptImport(file, match[1])
      if (dependency) visit(dependency)
    }
  }
  visit(entry)
  return visited
}

function resolveLocalTypeScriptImport(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('.')
    ? resolve(dirname(fromFile), specifier)
    : specifier.startsWith('@/')
      ? join(process.cwd(), 'src', specifier.slice(2))
      : null
  if (!base) return null
  const candidates =
    base.endsWith('.ts') || base.endsWith('.tsx')
      ? [base]
      : [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidates.find(existsSync) ?? null
}
