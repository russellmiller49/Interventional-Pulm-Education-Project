import fs from 'node:fs'
import path from 'node:path'

import { parseBoardSectionIds } from '@/lib/board-heading-parser'

import { thoracentesisBoardSectionIds } from '../content/learnContent'

/**
 * Guard against board-content drift for the thoracentesis Learn page (same
 * chapter as ultrasound, different sections). Reads the source MDX and asserts
 * every section id the Learn page relies on still resolves.
 */

const MDX_PATH = path.join(
  process.cwd(),
  'content',
  'modules',
  'board',
  'pleural-effusions-and-pleural-interventions.mdx',
)

describe('thoracentesis Learn board bridge', () => {
  it('every board section id the Learn page relies on still resolves', () => {
    const ids = parseBoardSectionIds(fs.readFileSync(MDX_PATH, 'utf8'))
    for (const id of thoracentesisBoardSectionIds) {
      expect(ids.has(id)).toBe(true)
    }
  })
})
