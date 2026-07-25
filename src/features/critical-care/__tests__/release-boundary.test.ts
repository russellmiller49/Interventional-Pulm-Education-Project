import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import sitemap from '@/app/sitemap'
import { baxterCrrtReleaseStage } from '@/features/baxter-crrt/content/release'
import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'
import { criticalCareModules } from '@/features/critical-care/content/modules'
import { criticalCareActivities } from '@/features/critical-care/content/activities'
import {
  criticalCarePublicCatalogStageByModule,
  isCriticalCareActivityPubliclyCataloged,
  presentCriticalCareActivityPublicly,
} from '@/features/critical-care/content/publicVisibility'
import { ICU_HEMODYNAMICS_RELEASE_STAGE } from '@/features/icu-hemodynamics/content/release'
import { ICU_SIMULATION_RELEASE_STAGE } from '@/features/icu-simulation/content/release'
import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'
import { MCS_RELEASE_STAGE } from '@/features/mechanical-circulatory-support/content/release'
import { isDraftModulePath, isUnlistedModulePath } from '@/lib/draft-modules'
import { isPublicPath, isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'
import { searchSite } from '@/lib/site-search'

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
    expect(sitemap().some((entry) => entry.url.endsWith('/critical-care'))).toBe(false)
    expect(
      searchSite('critical care learning center', 100, { canViewDrafts: true }).some(
        (entry) => entry.href === '/critical-care',
      ),
    ).toBe(false)
  })

  it('locks every focused release and SME-review boundary at its audited stage', () => {
    expect({
      hemodynamics: ICU_HEMODYNAMICS_RELEASE_STAGE,
      ventilation: mechanicalVentilationPublicationStatus,
      mcs: MCS_RELEASE_STAGE,
      ecmo: cardiohelpEcmoPublicationStatus,
      crrt: baxterCrrtReleaseStage,
      integratedIcu: ICU_SIMULATION_RELEASE_STAGE,
    }).toEqual({
      hemodynamics: 'unlisted-preview',
      ventilation: 'tester-preview',
      mcs: 'unlisted-preview',
      ecmo: 'draft',
      crrt: 'unlisted-preview',
      integratedIcu: 'private-development',
    })
  })

  it('keeps the public-parent catalog policy aligned with source-owned release gates', () => {
    expect(criticalCarePublicCatalogStageByModule).toEqual({
      'icu-hemodynamics': 'public-unlisted',
      'mechanical-ventilation': 'public-unlisted',
      'mechanical-circulatory-support': 'public-unlisted',
      'cardiohelp-ecmo': 'draft',
      'baxter-crrt': 'public-unlisted',
      'icu-simulation': 'private',
    })

    const publicActivities = criticalCareActivities.filter(isCriticalCareActivityPubliclyCataloged)
    expect(publicActivities.some((activity) => activity.reviewStatus === 'draft')).toBe(false)
    expect(
      publicActivities.some(
        (activity) =>
          activity.moduleId === 'cardiohelp-ecmo' || activity.moduleId === 'icu-simulation',
      ),
    ).toBe(false)

    for (const assessment of publicActivities.filter(
      (activity) => activity.kind === 'assessment',
    )) {
      expect(presentCriticalCareActivityPublicly(assessment)).toEqual(
        expect.objectContaining({
          title: assessment.title,
          href: expect.stringContaining(assessment.pathname),
          maskedAssessment: false,
        }),
      )
    }
  })

  it('keeps full private ICU definitions out of public critical-care runtime imports', () => {
    const sourceRoot = join(process.cwd(), 'src')
    const publicRuntimeFiles = [
      'features/critical-care/components/CriticalCarePathways.tsx',
      'features/critical-care/progress/adapters/icuSimulation.ts',
      'features/critical-care/progress/__fixtures__/legacyProgress.ts',
    ]

    for (const relativePath of publicRuntimeFiles) {
      const source = readFileSync(join(sourceRoot, relativePath), 'utf8')
      expect(source).not.toContain('@/features/icu-simulation/content/scenarios')
    }

    const pathwaySource = readFileSync(
      join(sourceRoot, 'features/critical-care/components/CriticalCarePathways.tsx'),
      'utf8',
    )
    expect(pathwaySource).not.toContain('publicIcuScenarioManifest')
    expect(pathwaySource).not.toContain('/icu-simulation/practice')
  })

  it('preserves direct-link, unlisted, draft, and private auth exposure', () => {
    const publicUnlisted = [
      '/critical-care',
      '/icu-hemodynamics',
      '/mechanical-ventilation',
      '/mechanical-circulatory-support',
      '/cardiohelp-ecmo',
      '/baxter-crrt',
    ]
    for (const path of publicUnlisted) {
      expect(isPublicPath(path)).toBe(true)
      expect(isPublicUnlistedPath(path)).toBe(true)
      expect(isUnlistedModulePath(path)).toBe(true)
    }
    expect(isDraftModulePath('/mechanical-ventilation')).toBe(false)
    expect(isDraftModulePath('/cardiohelp-ecmo')).toBe(true)
    expect(isDraftModulePath('/baxter-crrt')).toBe(true)
    expect(isPublicPath('/icu-simulation')).toBe(false)
    expect(isPublicUnlistedPath('/icu-simulation')).toBe(false)
    expect(isDraftModulePath('/icu-simulation')).toBe(true)
  })

  it('keeps every non-published critical-care route out of sitemap and search', () => {
    const routeQueries = [
      ['/critical-care', 'critical care'],
      ['/icu-hemodynamics', 'hemodynamics'],
      ['/mechanical-ventilation', 'mechanical ventilation'],
      ['/mechanical-circulatory-support', 'mechanical circulatory support'],
      ['/cardiohelp-ecmo', 'ecmo'],
      ['/baxter-crrt', 'crrt'],
      ['/icu-simulation', 'icu simulation'],
    ] as const
    const sitemapUrls = sitemap().map((entry) => entry.url)

    for (const [path, query] of routeQueries) {
      expect(sitemapUrls.some((url) => url.endsWith(path))).toBe(false)
      expect(
        searchSite(query, 100, { canViewDrafts: true }).some(
          (entry) => entry.href === path || entry.href.startsWith(`${path}/`),
        ),
      ).toBe(false)
    }
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
