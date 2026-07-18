import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

describe('Baxter CRRT consolidated evidence record', () => {
  const evidencePath = join(process.cwd(), 'docs/baxter-crrt/evidence.md')

  it('resolves every implementation path recorded in the evidence map', () => {
    const evidence = readFileSync(evidencePath, 'utf8')
    const recordedPaths = [...evidence.matchAll(/`(src\/[^`]+)`/gu)].map((match) => match[1])
    const uniquePaths = [...new Set(recordedPaths)]

    expect(uniquePaths.length).toBeGreaterThan(20)
    for (const relativePath of uniquePaths) {
      const absolutePath = join(process.cwd(), relativePath)
      expect(existsSync(absolutePath)).toBe(true)
      expect(statSync(absolutePath).isFile()).toBe(true)
    }
  })

  it('records the active sources, formula conflicts, and non-authoritative draft boundary', () => {
    const evidence = readFileSync(evidencePath, 'utf8')

    expect(evidence).toContain('AW8035 Rev B')
    expect(evidence).toContain('G5036003 Revision 05.2011')
    expect(evidence).toContain('NICE NG148')
    expect(evidence).toContain('2026 multidisciplinary ICU RRT guideline')
    expect(evidence).toContain('2025 CKRT Core Curriculum')
    expect(evidence).toContain('CONFLICT-001')
    expect(evidence).toContain('CONFLICT-002')
    expect(evidence).toMatch(/KDIGO 2026[\s\S]*not authority for runtime rules/i)
  })

  it('states that provenance is informational and never a runtime activation switch', () => {
    const evidence = readFileSync(evidencePath, 'utf8')

    expect(evidence).toMatch(/informational[\s\S]*do not activate or\s+deactivate runtime content/i)
    expect(evidence).not.toContain('candidate-manifest')
    expect(evidence).not.toContain('signed attestation')
    expect(evidence).not.toContain('phase authorization')
  })
})
