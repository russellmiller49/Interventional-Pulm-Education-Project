import { render, screen } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

jest.mock('../content/deviceProfiles', () => ({
  ...jest.requireActual('../content/deviceProfiles'),
  baxterCrrtPublicationStatus: 'published',
}))

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: jest.fn(),
}))

import BaxterCrrtLab from '../components/BaxterCrrtLab'

describe('Baxter CRRT published learner composition', () => {
  beforeEach(() => window.localStorage.clear())

  it('does not mount the Phase 7 reviewer registry, cases, or tools when publication is enabled', () => {
    render(<BaxterCrrtLab />)

    expect(
      screen.queryByRole('heading', { name: 'Full PrisMax curriculum—mapped, not activated' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Reviewer-only case candidates')).not.toBeInTheDocument()
    expect(screen.queryByText('Reviewer-only instructional tools')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Open CRRT reviewer workspace' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Reviewed source and release boundary' }),
    ).toBeInTheDocument()
  })

  it('keeps reviewer components out of the full transitive learner client graph', () => {
    const entry = join(process.cwd(), 'src/features/baxter-crrt/components/BaxterCrrtLab.tsx')
    const reachable = collectLocalTypeScriptDependencies(entry)

    expect(reachable.size).toBeGreaterThan(40)
    expect([...reachable].join('\n')).not.toMatch(
      /CrrtPhase7ReviewPanel|CrrtPhase8ReviewPanel|phase7ReviewCases|instructionalToolsModel|prescriptionWorkbenchModel|pressureLocalizationLabModel|PrismaflexReviewerConsole|prismaflexReviewConsoleModel|prismaflexCalculations|deviceAdapters\/prismaflex|crossDeviceTransfer/,
    )
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
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}
