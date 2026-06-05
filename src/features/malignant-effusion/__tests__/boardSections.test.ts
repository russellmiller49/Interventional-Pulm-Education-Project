import fs from 'node:fs'
import path from 'node:path'

import { parseBoardSectionIds } from '@/lib/board-heading-parser'

import { mpeBoardSectionIds } from '../content/learnContent'

/**
 * Guard against board-content drift for the malignant-effusion Learn page, which
 * bridges the Indwelling Pleural Catheters and Pleurodesis chapter. Reads the
 * source MDX and asserts every section id the Learn page relies on still resolves.
 */

const MDX_PATH = path.join(
  process.cwd(),
  'content',
  'modules',
  'board',
  'indwelling-pleural-catheters-and-pleurodesis.mdx',
)

describe('malignant effusion Learn board bridge', () => {
  it('every board section id the Learn page relies on still resolves', () => {
    const ids = parseBoardSectionIds(fs.readFileSync(MDX_PATH, 'utf8'))
    for (const id of mpeBoardSectionIds) {
      expect(ids.has(id)).toBe(true)
    }
  })
})
