import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The circulation map's words fit the pane; only its drawing pans.
 *
 * The map is a one-column grid and its drawing has a minimum width, so that it pans on a narrow
 * pane instead of shrinking its labels. That minimum used to set the column, and the caption, the
 * key and the answer rows were laid out as wide as the drawing: measured in November 2026 with
 * the map open, their last characters were cut off on 56 of 67 tasks at 1600 x 852, 29 at
 * 1280 x 720 and all 67 at 390 x 844. jsdom does no layout, so this holds the two declarations
 * that fix it; the measurement itself is a browser walk recorded with the change.
 */
const sheet = readFileSync(
  join(
    process.cwd(),
    'src/features/mechanical-circulatory-support/components/stage/mcs-stage.module.css',
  ),
  'utf8',
)

describe('the circulation map in the simulator pane', () => {
  it('sizes its column to the pane, not to the drawing', () => {
    expect(sheet).toMatch(
      /\.readableMap \[data-circulation-map\]\s*{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    )
  })

  it('keeps the drawing’s minimum width, so the drawing still pans', () => {
    expect(sheet).toMatch(
      /\.readableMap \[data-circulation-map\] > div:first-of-type\s*{\s*min-width:\s*680px;/,
    )
    expect(sheet).toMatch(/\.readableMap\s*{[^}]*overflow-x:\s*auto;/)
  })

  it('holds the words in place while the drawing is panned', () => {
    expect(sheet).toMatch(
      /\.readableMap \[data-circulation-map\] > :not\(div:first-of-type\)\s*{\s*position:\s*sticky;\s*left:\s*0;/,
    )
  })
})
