import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { criticalCareModules } from '@/features/critical-care/content/modules'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'

describe('critical care parent module release boundary', () => {
  it('keeps the parent public by direct link and unlisted for every locale', () => {
    for (const path of ['/critical-care', '/es/critical-care', '/zh-CN/critical-care']) {
      expect(isPublicPath(path)).toBe(true)
      expect(isPublicUnlistedPath(path)).toBe(true)
      expect(resolveSiteModuleId(path)).toBe('critical-care')
    }
  })

  it('does not expose the parent in search or the sitemap', () => {
    const sourceRoot = join(process.cwd(), 'src')
    const visibilitySource = readFileSync(join(sourceRoot, 'lib/draft-modules.ts'), 'utf8')
    const searchSource = readFileSync(join(sourceRoot, 'lib/site-search.ts'), 'utf8')
    const sitemapSource = readFileSync(join(sourceRoot, 'app/sitemap.ts'), 'utf8')

    expect(visibilitySource).toContain("'/critical-care'")
    expect(searchSource).not.toContain("href: '/critical-care'")
    expect(sitemapSource).not.toContain('`${baseUrl}/critical-care`')
  })

  it('contains the five requested modules with stable, unique direct URLs', () => {
    expect(criticalCareModules.map((module) => module.href)).toEqual([
      '/icu-hemodynamics',
      '/mechanical-ventilation',
      '/mechanical-circulatory-support',
      '/cardiohelp-ecmo',
      '/baxter-crrt',
    ])
    expect(new Set(criticalCareModules.map((module) => module.href))).toHaveProperty('size', 5)
  })
})
