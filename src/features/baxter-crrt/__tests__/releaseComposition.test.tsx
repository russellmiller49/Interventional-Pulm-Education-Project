import { render, screen } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import BaxterCrrtLab from '../components/BaxterCrrtLab'

describe('Baxter CRRT v1 private composition', () => {
  it('mounts complete functionality in SME review without an activation registry', () => {
    render(<BaxterCrrtLab sessionMode="review-preview" />)

    expect(screen.getByRole('main')).toHaveAttribute('data-release-stage', 'sme-review')
    expect(screen.getByRole('tab', { name: /^Mastery/ })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Device profile' })).toHaveLength(2)
    expect(screen.getByRole('combobox', { name: 'Station-grouped case' })).toHaveLength(18)
  })

  it('includes operational v1 artifacts while excluding retired authorization machinery', () => {
    const entry = join(process.cwd(), 'src/features/baxter-crrt/components/BaxterCrrtLab.tsx')
    const reachable = collectLocalTypeScriptDependencies(entry)
    const graph = [...reachable].join('\n')

    expect(graph).toMatch(/deviceAdapters\/registry/)
    expect(graph).toMatch(/deviceAdapters\/prismaflex/)
    expect(graph).toMatch(/crossDeviceTransfer/)
    expect(graph).toMatch(/instructionalTools/)
    expect(graph).not.toMatch(
      /content\/(activation|authorization|candidateIdentity|reviewAttestation|phase7Evidence|masteryReviewPlanner)|reviewBuildIdentity/,
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
  return candidates.find(existsSync) ?? null
}
