import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import * as moduleRoutes from './moduleRoutes'

describe('learning module route bases', () => {
  it('exports route strings for templated module overview pages', () => {
    for (const [key, route] of Object.entries(moduleRoutes)) {
      expect(key).toMatch(/NavBase$/)
      expect(route).toMatch(
        /^\/(baxter-crrt|cardiohelp-ecmo|mechanical-circulatory-support|pleural-procedures|rigid-bronchoscopy|tracheostomy)/,
      )
      expect(route).not.toContain('function')
    }
  })

  it('keeps server pages from importing nav bases from client nav components', () => {
    const appFiles = findFiles(join(process.cwd(), 'src/app'), '.tsx')
    const offenders = appFiles.filter((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      const imports = source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)

      for (const [, specifiers, modulePath] of imports) {
        if (
          modulePath.startsWith('@/features/') &&
          modulePath.includes('/components/') &&
          modulePath.endsWith('Nav') &&
          specifiers.includes('NavBase')
        ) {
          return true
        }
      }

      return false
    })

    expect(offenders).toEqual([])
  })
})

function findFiles(root: string, extension: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const filePath = join(root, entry)
    const stats = statSync(filePath)

    if (stats.isDirectory()) {
      return findFiles(filePath, extension)
    }

    return filePath.endsWith(extension) ? [filePath] : []
  })
}
