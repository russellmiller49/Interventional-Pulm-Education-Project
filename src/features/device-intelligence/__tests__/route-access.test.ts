import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { isPublicUnlistedPath, resolveSiteModuleId } from '@/lib/site-auth/access'
import { isUnlistedModulePath, isVisibleModulePath } from '@/lib/draft-modules'
import { moduleAccessMode } from '@/lib/non-public-modules'
import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'

const REPO_ROOT = join(__dirname, '../../../..')
const ROUTE_DIRS = ['devices', 'clinical-roles', 'procedures'].map((dir) =>
  join(REPO_ROOT, 'src/app/[locale]', dir),
)

const D1_PATHS = [
  '/devices',
  '/devices/PRD-ABCDEF1234',
  '/clinical-roles/EBUS_SCOPE',
  '/procedures',
  '/procedures/EBUS_TBNA',
  '/procedures/EBUS_TBNA/readiness',
]

describe('D1 route access model', () => {
  it('treats every D1 route as public-unlisted (direct link, noindex header tier)', () => {
    for (const path of D1_PATHS) {
      expect({ path, unlisted: isPublicUnlistedPath(path) }).toEqual({ path, unlisted: true })
      expect({ path, unlisted: isPublicUnlistedPath(`/es${path}`) }).toEqual({
        path,
        unlisted: true,
      })
    }
  })

  it('keeps every D1 route out of site navigation', () => {
    for (const path of D1_PATHS) {
      expect({ path, hidden: isUnlistedModulePath(path) }).toEqual({ path, hidden: true })
      expect({ path, visible: isVisibleModulePath(path) }).toEqual({ path, visible: false })
    }
  })

  it('computes direct-link access mode for the admin module index', () => {
    expect(moduleAccessMode('/devices')).toBe('direct-link')
    expect(moduleAccessMode('/clinical-roles')).toBe('direct-link')
    expect(moduleAccessMode('/procedures')).toBe('direct-link')
  })

  it('assigns analytics module ids distinct from preference-cards', () => {
    expect(resolveSiteModuleId('/en/devices')).toBe('device-intelligence:devices')
    expect(resolveSiteModuleId('/en/devices/PRD-ABC123')).toBe('device-intelligence:devices')
    expect(resolveSiteModuleId('/en/clinical-roles/EBUS_SCOPE')).toBe(
      'device-intelligence:clinical-roles',
    )
    expect(resolveSiteModuleId('/en/procedures/EBUS_TBNA/readiness')).toBe(
      'device-intelligence:procedures',
    )
    expect(resolveSiteModuleId('/en/preference-cards/catalog')).toBe('preference-cards')
  })

  it('does not swallow the distinct pleural-procedures module id', () => {
    // '/procedures' is a new prefix; '/pleural-procedures' must keep its own identity.
    expect(resolveSiteModuleId('/en/pleural-procedures/pleuroscopy')).toBe(
      'pleural-procedures:pleuroscopy',
    )
    expect(isPublicUnlistedPath('/pleural-procedures')).toBe(false)
  })

  it('is enabled outside production and requires an explicit flag in production', () => {
    expect(deviceIntelligenceEnabled()).toBe(true) // NODE_ENV === 'test'
    const source = readFileSync(
      join(REPO_ROOT, 'src/features/device-intelligence/feature.ts'),
      'utf8',
    )
    expect(source).toContain("process.env.NODE_ENV !== 'production'")
    expect(source).toContain("NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE === 'true'")
  })

  it('gates every D1 route directory behind the feature flag layout', () => {
    for (const dir of ROUTE_DIRS) {
      const layout = readFileSync(join(dir, 'layout.tsx'), 'utf8')
      expect(layout).toContain('deviceIntelligenceEnabled')
      expect(layout).toContain('notFound()')
    }
  })

  it('declares noindex robots metadata on every D1 page', () => {
    const collectPages = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) return collectPages(path)
        return entry === 'page.tsx' ? [path] : []
      })
    const pages = ROUTE_DIRS.flatMap(collectPages)
    expect(pages.length).toBe(6)
    for (const page of pages) {
      const source = readFileSync(page, 'utf8')
      expect(source).toContain('robots: { index: false, follow: false, noarchive: true }')
      expect(source).toContain("export const dynamic = 'force-dynamic'")
    }
  })

  it('exposes no server action, API route, or other write path under the D1 areas', () => {
    for (const dir of ROUTE_DIRS) {
      const offenders: string[] = []
      const walk = (current: string) => {
        for (const entry of readdirSync(current)) {
          const path = join(current, entry)
          if (statSync(path).isDirectory()) {
            walk(path)
            continue
          }
          if (/^(actions|route)\.tsx?$/.test(entry)) offenders.push(path)
          const source = readFileSync(path, 'utf8')
          if (source.includes("'use server'") || source.includes('"use server"')) {
            offenders.push(`${path} (use server)`)
          }
        }
      }
      walk(dir)
      expect(offenders).toEqual([])
    }
    expect(existsSync(join(REPO_ROOT, 'src/app/api/device-intelligence'))).toBe(false)
  })

  it('performs no persistence from the device-intelligence feature', () => {
    const featureDir = join(REPO_ROOT, 'src/features/device-intelligence')
    const offenders: string[] = []
    const walk = (current: string) => {
      for (const entry of readdirSync(current)) {
        const path = join(current, entry)
        if (statSync(path).isDirectory()) {
          if (entry === '__tests__') continue
          walk(path)
          continue
        }
        if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
        const source = readFileSync(path, 'utf8')
        if (
          /localStorage|supabase|createServerClient|writeFileSync|\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(
            source,
          )
        ) {
          offenders.push(path)
        }
      }
    }
    walk(featureDir)
    expect(offenders).toEqual([])
  })
})
