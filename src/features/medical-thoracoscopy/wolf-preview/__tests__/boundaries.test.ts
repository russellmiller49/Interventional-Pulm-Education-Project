/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import sitemap from '@/app/sitemap'
import { isVisibleModulePath } from '@/lib/draft-modules'
import { isPublicPath, isPublicUnlistedPath, isStaticAssetPath } from '@/lib/site-auth/access'

import { wolfPreviewAssets } from '../server/assetManifest'

/**
 * What the preview opens, and what it does not: one page past the site's sign-in gate (which
 * then checks its own session), nothing else of the course, no public copy of a model, no secret
 * or code in the repository, and nothing server-only reachable from page code.
 */
const ROOT = process.cwd()
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT }).toString().trim().split('\n')

describe('site access', () => {
  it('lets only the preview page past the site sign-in gate, noindex', () => {
    for (const locale of ['', '/en', '/es', '/zh-CN']) {
      expect(isPublicPath(`${locale}/medical-thoracoscopy/wolf-preview`)).toBe(true)
      expect(isPublicUnlistedPath(`${locale}/medical-thoracoscopy/wolf-preview`)).toBe(true)
    }
  })

  it('opens nothing else of Medical Thoracoscopy', () => {
    for (const other of [
      '/medical-thoracoscopy',
      '/en/medical-thoracoscopy',
      '/medical-thoracoscopy/learn',
      '/medical-thoracoscopy/prototype/space',
      '/medical-thoracoscopy/prototype/tool-contact',
      '/medical-thoracoscopy/prototype/device-explorer',
      '/medical-thoracoscopy/wolf-preview/anything',
      '/medical-thoracoscopy/wolf-preview-other',
    ]) {
      expect({ other, public: isPublicPath(other) }).toEqual({ other, public: false })
    }
  })

  it('keeps the model endpoint’s own check as the guard for asset-like addresses', () => {
    // The site treats any address ending like a file as static, and all of /api/ skips the site
    // gate; the endpoint therefore checks the session itself (endpoints.test.ts).
    expect(isStaticAssetPath('/api/medical-thoracoscopy/wolf-preview/models/probe.glb')).toBe(true)
  })

  it('stays out of navigation and the sitemap', () => {
    expect(
      isVisibleModulePath('/medical-thoracoscopy/wolf-preview', { canViewDraftModules: true }),
    ).toBe(false)
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.filter((url) => /medical-thoracoscopy|wolf/.test(url))).toEqual([])
    const robots = readFileSync(path.join(ROOT, 'src/app/robots.txt'), 'utf8')
    expect(robots).not.toMatch(/wolf/i)
  })
})

describe('no public copy of a model', () => {
  const objects = Object.values(wolfPreviewAssets.models).map((model) => model.object)
  const stems = Object.keys(wolfPreviewAssets.models)

  it('commits no showcase model anywhere, and none under public/', () => {
    const committedModels = tracked.filter((file) => /\.(glb|gltf)$/i.test(file))
    for (const object of objects) {
      expect(committedModels.filter((file) => file.endsWith(object))).toEqual([])
    }
    expect(tracked.filter((file) => /^public\/.*wolf-preview/.test(file))).toEqual([])
    expect(existsSync(path.join(ROOT, 'public/models/medical-thoracoscopy'))).toBe(false)
    expect(stems.length).toBe(13)
  })

  it('adds no rewrite, public upload prefix or standalone path for the preview', () => {
    for (const file of [
      'next.config.mjs',
      'scripts/upload-module-assets-to-supabase.mjs',
      'scripts/prepare-standalone.mjs',
    ]) {
      const text = readFileSync(path.join(ROOT, file), 'utf8')
      expect({ file, hit: /wolf-preview|mt-wolf|device-explorer/.test(text) }).toEqual({
        file,
        hit: false,
      })
    }
  })

  it('keeps the private bucket out of the public module-assets bucket', () => {
    expect(wolfPreviewAssets.bucket).not.toBe('module-assets')
  })
})

describe('secrets and boundaries', () => {
  it('commits no review code, session secret or reviewer list', () => {
    const code = /MTW(-[A-HJ-NP-Z2-9]{5}){5}/
    const assignment =
      /MT_WOLF_PREVIEW_(SESSION_SECRET|REVIEWERS)\s*[=:]\s*['"]?(?!<)[A-Za-z0-9_-]{16,}/
    const hits = tracked
      .filter((file) => /\.(ts|tsx|js|mjs|cjs|json|md|env|ya?ml|txt)$/.test(file))
      .filter((file) => existsSync(path.join(ROOT, file)))
      .filter((file) => {
        const text = readFileSync(path.join(ROOT, file), 'utf8')
        return code.test(text) || assignment.test(text)
      })
    expect(hits).toEqual([])
  })

  it('keeps server-only code out of everything a page ships', () => {
    const clientDirs = [
      'src/features/medical-thoracoscopy/components/device-explorer',
      'src/features/medical-thoracoscopy/wolf-preview',
    ]
    const clientFiles = clientDirs.flatMap((dir) =>
      readdirSync(path.join(ROOT, dir))
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => path.join(ROOT, dir, file)),
    )
    for (const file of clientFiles) {
      const text = readFileSync(file, 'utf8')
      if (!text.startsWith("'use client'")) continue
      expect({
        file,
        imports: text.match(/from '[^']*(server\/|supabase\/admin|node:)[^']*'/g),
      }).toEqual({
        file,
        imports: null,
      })
    }
  })

  it('ships a catalogue without internal notes, marks, paths or storage details', () => {
    const text = readFileSync(
      path.join(
        ROOT,
        'src/features/medical-thoracoscopy/content/data/generated/deviceExplorerCatalogue.ts',
      ),
      'utf8',
    )
    expect(text).not.toMatch(
      /wolf|eragon|endocam|richard|R-DEVICE|NOT REVIEWED|Local-Data|\/Users\/|mt-wolf-preview|packet|comparison/i,
    )
    for (const model of Object.values(wolfPreviewAssets.models)) {
      expect(text).not.toContain(model.sha256)
      expect(text).not.toContain(model.object)
    }
  })
})
