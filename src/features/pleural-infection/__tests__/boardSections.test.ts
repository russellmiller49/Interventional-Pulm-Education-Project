import fs from 'node:fs'
import path from 'node:path'

import { parseBoardSectionIds } from '@/lib/board-heading-parser'

import { infectionBoardSectionIds } from '../content/learnContent'

/**
 * Guard against board-content drift for the pleural-infection Learn page, which
 * bridges to the dedicated `pleural-infections` chapter. Reads the source MDX
 * and asserts every section id the Learn page relies on still resolves.
 */

const MDX_PATH = path.join(process.cwd(), 'content', 'modules', 'board', 'pleural-infections.mdx')

describe('pleural infection Learn board bridge', () => {
  it('every board section id the Learn page relies on still resolves', () => {
    const ids = parseBoardSectionIds(fs.readFileSync(MDX_PATH, 'utf8'))
    for (const id of infectionBoardSectionIds) {
      expect(ids.has(id)).toBe(true)
    }
  })
})
