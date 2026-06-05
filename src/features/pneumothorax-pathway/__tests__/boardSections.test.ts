import fs from 'node:fs'
import path from 'node:path'

import { parseBoardSectionIds } from '@/lib/board-heading-parser'

import { pneumothoraxBoardSectionIds } from '../content/learnContent'

/**
 * Guard against board-content drift for the pneumothorax Learn page, which
 * bridges the Pneumothorax, Prolonged Air Leaks, and Bronchopleural Fistula
 * chapter. Reads the source MDX and asserts every section id resolves.
 */

const MDX_PATH = path.join(
  process.cwd(),
  'content',
  'modules',
  'board',
  'pneumothorax-prolonged-air-leaks-and-bronchopleural-fistula.mdx',
)

describe('pneumothorax Learn board bridge', () => {
  it('every board section id the Learn page relies on still resolves', () => {
    const ids = parseBoardSectionIds(fs.readFileSync(MDX_PATH, 'utf8'))
    for (const id of pneumothoraxBoardSectionIds) {
      expect(ids.has(id)).toBe(true)
    }
  })
})
