import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (...parts: string[]) =>
  readFileSync(
    join(process.cwd(), 'src/features/mechanical-ventilation/components', ...parts),
    'utf8',
  )

/**
 * The rail at a laptop's width.
 *
 * Measured in November 2026 at 1440 × 800, the size of a 13-inch laptop: the text column took
 * 543 px and left the picture pane 814 px, too narrow for the rail. The readings, the lung drawing
 * and the teaching patient's sliders were under the console on every one of the 94 console tasks,
 * and a wrapped cue in the clock bar pushed the console's tab row below the window on one. From a
 * 1440 px window the pane now gets the width the console and the rail need, and the text column
 * takes what is left. The same now holds down to a 1280 px window.
 *
 * jsdom lays nothing out, so these tests hold the rules the stylesheet relies on; the positions
 * are measured in the browser (`e2e/mechanical-ventilation-laptop-layout.spec.ts`).
 */
describe('the two panes at a laptop width', () => {
  const flow = read('stage', 'task-flow.module.css')

  it('gives the picture pane the rail’s width first, and the text column the rest', () => {
    // One rule for every two-pane width. Below a 1440 px window the text column used to take 0.8
    // of the width (about 540 px at 1366 × 768) and left the pane 770 px: no rail.
    expect(flow).toMatch(
      /@container mv-task \(min-width: 75rem\) \{\s*\.flow\[data-stage-frame\] \.content > \[data-flow-content\]\[data-has-visual\] \{\s*grid-template-columns: clamp\(23rem, calc\(100cqw - 64rem\), 30rem\) minmax\(0, 1fr\);/,
    )
    expect(flow.match(/@container mv-task/g)).toHaveLength(1)
    expect(flow).not.toMatch(/0\.8fr/)
  })

  it('forms the rail once the pane has 50rem, a console of about 31rem beside 18.5rem', () => {
    const rail = flow.slice(flow.indexOf('@container mv-visual'))
    expect(rail).toMatch(/^@container mv-visual \(min-width: 50rem\)/)
    expect(rail).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 18\.5rem/)
    // A 1280 px window: 23rem of text, the gap and both scrollbar gutters leave the pane about
    // 50.9rem. The two-pane layout itself starts at 75rem, so only a sliver of widths (a task
    // body of 75rem to about 77rem) has two panes and the rail under the console.
    expect(23 + 2.25 + 50).toBeLessThan(77)
  })
})

/**
 * The console's tab row in a short window.
 *
 * With four traces the console is taller than its pane at 1366 × 768 and 1280 × 720, and the row
 * (Monitoring, Modes, Controls …) ended 31 px and 59 px below the fold, under tasks that begin
 * "Open Controls on the console". The row is pinned to the pane's bottom edge while the console
 * runs past it. Positions are measured in the browser.
 */
describe('the console’s tab row in the two-pane workspace', () => {
  const consoleCss = read('mechanical-ventilation.module.css')
  const flow = read('stage', 'task-flow.module.css')
  const pin = consoleCss.slice(consoleCss.indexOf('@container mv-task (min-width: 75rem)'))

  it('is pinned to the bottom of its scrolling pane, in the compact console only', () => {
    expect(pin).toMatch(
      /\[data-mv-density='laptop'\] \.consoleNav \{[^}]*position: sticky;[^}]*bottom: 0;/,
    )
    // Only where the console has its own scrolling pane: in one pane, or on a phone, the pinned
    // Continue bar already holds the bottom of the scroller.
    expect(consoleCss.slice(0, consoleCss.indexOf('@container mv-task'))).not.toMatch(
      /\.consoleNav \{[^}]*position: sticky/,
    )
  })

  it('has no scroll container between the row and the pane', () => {
    // `hidden` makes a box a scroll container, and the row would pin to that box instead.
    expect(pin).toMatch(/\[data-mv-density='laptop'\] \.consoleBezel \{[^}]*overflow: clip;/)
    expect(flow).toMatch(/\[data-flow-visual\] \.consoleFrame > div \{[^}]*overflow: clip;/)
  })
})

describe('a teaching panel in a narrow text column', () => {
  const teaching = read('mechanical-ventilation-teaching.module.css')

  it('keeps the width it is given, so nothing in it is cut off by the pane', () => {
    // Sized by its content, the oxygenation panel grew to 612 px and the pane clipped it: by
    // 111 px at 1440 and 174 px at 1600 before this, and it would be 286 px in a 23rem column.
    expect(teaching).toMatch(/\.panel \{[^}]*grid-template-columns: minmax\(0, 1fr\);/)
    expect(teaching).toMatch(/\.referenceValues \{[^}]*grid-template-columns: minmax\(0, 1fr\);/)
    // The wide PEEP and FiO2 tables scroll inside their own box.
    expect(teaching).toMatch(/\.peepTableScroll \{[^}]*overflow-x: auto;/)
  })
})
