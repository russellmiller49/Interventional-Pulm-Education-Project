/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import sitemap from '@/app/sitemap'
import { isVisibleModulePath } from '@/lib/draft-modules'
import { isPublicPath, isPublicUnlistedPath, isStaticAssetPath } from '@/lib/site-auth/access'

import { WOLF_PREVIEW_CARDS, WOLF_PREVIEW_DEMOS } from '../demos'
import { WOLF_PREVIEW_ITEMS } from '../paths'
import { wolfPreviewAssets } from '../server/assetManifest'
import { wolfPreviewDemoAssets } from '../server/demoManifest'

/**
 * What the preview opens, and what it does not: the hub and its three pages past the site's
 * sign-in gate (each then checks its own session), nothing else of the course, no public copy of
 * a model or demonstration file, no secret or code in the repository, and nothing server-only
 * reachable from page code.
 */
const ROOT = process.cwd()
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT }).toString().trim().split('\n')

const PAGES = [
  '/medical-thoracoscopy/wolf-preview',
  ...WOLF_PREVIEW_ITEMS.map((item) => `/medical-thoracoscopy/wolf-preview/${item}`),
]

describe('site access', () => {
  it('lets only the hub and its three pages past the site sign-in gate, noindex', () => {
    expect(PAGES).toHaveLength(4)
    for (const locale of ['', '/en', '/es', '/zh-CN']) {
      for (const page of PAGES) {
        expect({ page, public: isPublicPath(`${locale}${page}`) }).toEqual({ page, public: true })
        expect(isPublicUnlistedPath(`${locale}${page}`)).toBe(true)
      }
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
      '/medical-thoracoscopy/wolf-preview/device-explorer/more',
      '/medical-thoracoscopy/wolf-preview/pleural-model-progress/stills',
      '/medical-thoracoscopy/wolf-preview/portable-trainer-concept/viewer',
      '/medical-thoracoscopy/wolf-preview/hub',
      '/medical-thoracoscopy/pleural-model-progress',
    ]) {
      expect({ other, public: isPublicPath(other) }).toEqual({ other, public: false })
    }
  })

  it('keeps the endpoints’ own checks as the guard for asset-like addresses', () => {
    // The site treats any address ending like a file as static, and all of /api/ skips the site
    // gate; the endpoints therefore check the session themselves (endpoints.test.ts).
    expect(isStaticAssetPath('/api/medical-thoracoscopy/wolf-preview/models/probe.glb')).toBe(true)
    expect(
      isStaticAssetPath(
        '/api/medical-thoracoscopy/wolf-preview/files/pleural-model-progress/media/a.mp4',
      ),
    ).toBe(true)
  })

  it('stays out of navigation and the sitemap', () => {
    for (const page of PAGES) {
      expect(isVisibleModulePath(page, { isAdmin: true })).toBe(false)
    }
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

  it('keeps the private buckets out of the public module-assets bucket', () => {
    expect(wolfPreviewAssets.bucket).not.toBe('module-assets')
    expect(wolfPreviewDemoAssets.bucket).not.toBe('module-assets')
  })
})

describe('no public copy of a demonstration file', () => {
  const entries = Object.values(wolfPreviewDemoAssets.groups).flatMap((files) =>
    Object.values(files as Record<string, { object: string; sha256: string }>),
  )

  it('commits no demonstration file anywhere', () => {
    const objects = new Set(entries.map((entry) => entry.object))
    expect(tracked.filter((file) => objects.has(path.basename(file)))).toEqual([])
    const media = tracked.filter((file) => /\.(mp4|glb)$/i.test(file))
    for (const name of ['pleural-model-progress', 'portable-thoracoscopy', 'trainer.glb']) {
      expect(media.filter((file) => file.includes(name))).toEqual([])
    }
  })

  it('adds no rewrite, public upload prefix or standalone path for the demonstrations', () => {
    for (const file of [
      'next.config.mjs',
      'scripts/upload-module-assets-to-supabase.mjs',
      'scripts/prepare-standalone.mjs',
    ]) {
      const text = readFileSync(path.join(ROOT, file), 'utf8')
      expect({
        file,
        hit: /pleural-model-progress|portable-trainer|wolf-preview/.test(text),
      }).toEqual({ file, hit: false })
    }
  })

  it('distributes nothing the demonstrations withheld', () => {
    const published = Object.values(wolfPreviewDemoAssets.groups).flatMap((files) =>
      Object.keys(files),
    )
    expect(
      published.filter((file) =>
        /comparison|scope-tracker|README|SERVE|diagrams|build\/|LICENSE|\.py$|\.mjs$|capture/i.test(
          file,
        ),
      ),
    ).toEqual([])
    expect(Object.keys(wolfPreviewDemoAssets.groups).sort()).toEqual(
      ['hub', 'pleural-model-progress', 'portable-trainer-concept'].sort(),
    )
  })

  it('names in page content only files the server can serve', () => {
    const groups = wolfPreviewDemoAssets.groups as Record<string, Record<string, unknown>>
    const missing: string[] = []
    const need = (group: string, file: string) => {
      if (!Object.prototype.hasOwnProperty.call(groups[group] ?? {}, file)) {
        missing.push(`${group}/${file}`)
      }
    }
    for (const card of WOLF_PREVIEW_CARDS) need('hub', card.image)
    for (const demo of Object.values(WOLF_PREVIEW_DEMOS)) {
      need(demo.id, demo.viewer.file)
      need(demo.id, demo.video.file)
      need(demo.id, demo.video.poster)
      for (const still of demo.stills) {
        need(demo.id, still.file)
        need(demo.id, still.preview)
      }
    }
    expect(missing).toEqual([])
    expect(WOLF_PREVIEW_CARDS.map((card) => card.item)).toEqual([...WOLF_PREVIEW_ITEMS])
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

  it('keeps server-only modules out of the preview’s page components', () => {
    const dir = path.join(ROOT, 'src/features/medical-thoracoscopy/wolf-preview')
    for (const file of readdirSync(dir).filter((name) => /\.tsx?$/.test(name))) {
      const text = readFileSync(path.join(dir, file), 'utf8')
      expect({
        file,
        imports: text.match(/from '[^']*(server\/|supabase\/admin|node:)[^']*'/g),
      }).toEqual({ file, imports: null })
    }
  })

  it('ships page content without storage objects, hashes or the bucket', () => {
    const text = ['demos.ts', 'paths.ts']
      .map((file) =>
        readFileSync(
          path.join(ROOT, 'src/features/medical-thoracoscopy/wolf-preview', file),
          'utf8',
        ),
      )
      .join('\n')
    expect(text).not.toContain(wolfPreviewDemoAssets.bucket)
    for (const files of Object.values(wolfPreviewDemoAssets.groups)) {
      for (const entry of Object.values(
        files as Record<string, { object: string; sha256: string }>,
      )) {
        expect(text).not.toContain(entry.object)
        expect(text).not.toContain(entry.sha256)
      }
    }
    expect(text).not.toMatch(/Local-Data|\/Users\/|R-DEVICE|NOT REVIEWED|Internal presentation/)
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
