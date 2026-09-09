import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repositoryRoot = resolve(__dirname, '../../../..')
const coreRoot = join(repositoryRoot, 'src/features/literature/shadow-classifier')

function coreSources() {
  return readdirSync(coreRoot)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(join(coreRoot, name), 'utf8') }))
}

describe('shadow classifier production mutation boundary', () => {
  it('has no database, network, filesystem-writer, process-launch, or production-route dependency', () => {
    const sources = coreSources()
    const forbiddenImports = [
      '@supabase/',
      'server/database-client',
      'server/queries',
      "from 'node:fs'",
      "from 'node:fs/promises'",
      "from 'node:child_process'",
      "from 'node:http'",
      "from 'node:https'",
      "from 'node:net'",
    ]
    for (const source of sources) {
      for (const forbidden of forbiddenImports) {
        expect(`${source.name}\n${source.text}`).not.toContain(forbidden)
      }
      expect(source.text).not.toMatch(/\b(fetch|createClient)\s*\(/u)
      expect(source.text).not.toMatch(/\.(?:rpc|insert|upsert|delete)\s*\(/u)
    }
  })

  it('exports no callback-taking runner or writer capability', () => {
    for (const source of coreSources()) {
      expect(source.text).not.toMatch(
        /export\s+(?:async\s+)?function\s+(?:run|execute|write|mutate)\w*\s*\(/iu,
      )
      expect(source.text).not.toMatch(/export\s+interface\s+\w*(?:Dependencies|Writer|Database)\b/u)
    }
  })

  it('adds only development file/inventory commands and no API/UI/migration/production flag', () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(
      Object.keys(packageJson.scripts).filter((name) => name.startsWith('literature:shadow')),
    ).toEqual([])

    const trackedProductionSurface = ['src/app/api', 'src/app', 'supabase/migrations'].flatMap(
      (path) => {
        try {
          return readdirSync(join(repositoryRoot, path), { recursive: true }).map(String)
        } catch {
          return []
        }
      },
    )
    expect(trackedProductionSurface.some((path) => /shadow[-_]classifier/iu.test(path))).toBe(false)
    expect(coreSources().some(({ text }) => text.includes('productionEnabled: true'))).toBe(false)
    expect(
      coreSources().some(({ text }) => text.includes('SHADOW_RUNTIME_MAX_AUTONOMY_LEVEL = 1')),
    ).toBe(true)
  })
})
