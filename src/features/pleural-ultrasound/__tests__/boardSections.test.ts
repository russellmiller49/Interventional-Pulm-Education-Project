import fs from 'node:fs'
import path from 'node:path'

import { parseBoardSectionIds } from '@/lib/board-heading-parser'

import { ultrasoundBoardSectionIds } from '../content/learnContent'

/**
 * Guard against board-content drift.
 *
 * The ultrasound Learn page pulls specific sections from the board chapter by
 * slug id (produced by the heuristic heading parser in board-review-loader.ts).
 * This reads the *source* MDX and asserts every id the Learn page relies on
 * still resolves — so a content edit that renames/reflows a heading fails CI
 * instead of silently emptying the Learn page. It reads the source file (not
 * contentlayer's gitignored generated output).
 */

const MDX_PATH = path.join(
  process.cwd(),
  'content',
  'modules',
  'board',
  'pleural-effusions-and-pleural-interventions.mdx',
)

describe('ultrasound Learn board bridge', () => {
  it('every board section id the Learn page relies on still resolves', () => {
    const ids = parseBoardSectionIds(fs.readFileSync(MDX_PATH, 'utf8'))
    for (const id of ultrasoundBoardSectionIds) {
      expect(ids.has(id)).toBe(true)
    }
  })
})
