import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { searchSite } from '@/lib/site-search'

const modelNames = [
  'cutaway-heart-aorta.glb',
  'iabp-path.glb',
  'impella-path.glb',
  'lvad-path.glb',
] as const

describe('MCS unlisted release and 3D asset boundary', () => {
  it('does not expose the preview in ordinary or draft-enabled site search', () => {
    for (const options of [undefined, { canViewDrafts: true }]) {
      const results = searchSite('mechanical circulatory support Impella LVAD', 30, options)
      expect(results).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            href: expect.stringContaining('/mechanical-circulatory-support'),
          }),
        ]),
      )
    }
  })

  it('ships valid, small, neutral GLB assets below the 6 MB total budget', () => {
    const root = join(process.cwd(), 'public/models/mechanical-circulatory-support')
    const sizes = modelNames.map((name) => statSync(join(root, name)).size)
    expect(sizes.every((size) => size > 1000)).toBe(true)
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThan(6 * 1024 * 1024)
    for (const name of modelNames)
      expect(readFileSync(join(root, name)).subarray(0, 4).toString('ascii')).toBe('glTF')
  })

  it('keeps WebGL explanatory and supplies context-loss and text-equivalent recovery', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/mechanical-circulatory-support/components/McsAnatomy3D.tsx',
      ),
      'utf8',
    )
    expect(source).toContain('aria-hidden="true"')
    expect(source).toContain('webglcontextlost')
    expect(source).toContain('Reload 3D view')
    expect(source).toContain('Text equivalent')
  })
})
