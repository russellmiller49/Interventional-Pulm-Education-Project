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
 * takes what is left.
 *
 * jsdom lays nothing out, so these tests hold the rules the stylesheet relies on; the positions
 * are measured in the browser (`e2e/mechanical-ventilation-laptop-layout.spec.ts`).
 */
describe('the two panes at a laptop width', () => {
  const flow = read('stage', 'task-flow.module.css')

  it('gives the picture pane the rail’s width first, and the text column the rest', () => {
    const band = flow.slice(flow.indexOf('@container mv-task (min-width: 86.5rem)'))
    expect(band).toMatch(
      /^@container mv-task \(min-width: 86\.5rem\) \{\s*\.flow\[data-stage-frame\] \.content > \[data-flow-content\]\[data-has-visual\] \{\s*grid-template-columns: clamp\(23rem, calc\(100cqw - 64rem\), 30rem\) minmax\(0, 1fr\);/,
    )
    // One rule from 1440 px up: the old 90rem rule gave the text 30rem at once and the pane the
    // rest, which left the pane short of the rail until a 1600 px window.
    expect(flow).not.toMatch(/@container mv-task \(min-width: 90rem\)/)
  })

  it('still makes two panes from a 75rem task body, text never under 20rem', () => {
    expect(flow).toMatch(
      /@container mv-task \(min-width: 75rem\) \{[^}]*\{[^}]*grid-template-columns: minmax\(20rem, 0\.8fr\) minmax\(0, 1\.2fr\);/,
    )
  })

  it('forms the rail once the pane has 60rem, a console of about 40rem beside 18.5rem', () => {
    const rail = flow.slice(flow.indexOf('@container mv-visual'))
    expect(rail).toMatch(/^@container mv-visual \(min-width: 60rem\)/)
    expect(rail).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 18\.5rem/)
    // 23rem of text, the 1.25rem gap and the pane's 60rem fit the 86.5rem at which the split
    // starts, with room for both panes' scrollbar gutters.
    expect(23 + 1.25 + 60).toBeLessThan(86.5 - 2)
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
