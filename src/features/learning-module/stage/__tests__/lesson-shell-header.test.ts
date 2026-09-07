import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The stage header's sticky offset, in both of the shell's two modes.
 *
 * Below the fixed-workspace threshold the stage flows with the document under the site's own sticky
 * header, so the row sticks `var(--site-header-height)` down. Inside the fixed workspace the module
 * frame is `overflow: hidden` and starts directly under the site header — and an overflow-hidden
 * ancestor is the scrollport a sticky offset resolves against, scrolled or not. The same offset
 * there pinned the row a full site-header height below the frame's top, over the context strip and
 * the head of the panes, in every adopter (measured on the mechanical-ventilation stage at
 * 1440 × 900 in September 2026: header at 162–223 px over a strip at 142–184 px). jsdom does no
 * layout, so this holds the two declarations rather than the geometry.
 */
const shellStyles = readFileSync(
  join(process.cwd(), 'src/features/learning-module/stage/lesson-shell.module.css'),
  'utf8',
)

function ruleBody(css: string, selector: string): string {
  const match = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*{([^}]*)}`,
  ).exec(css)
  if (!match) throw new Error(`No rule for ${selector}`)
  return match[1]
}

describe('the stage header', () => {
  it('sticks under the site header where the document scrolls', () => {
    const header = ruleBody(shellStyles, '.header')
    expect(header).toMatch(/position:\s*sticky/)
    expect(header).toMatch(/top:\s*var\(--site-header-height/)
  })

  it('sticks at the top of the frame inside the fixed workspace, whose top is already under the site header', () => {
    const fixed =
      /@media \(min-width: 1024px\) and \(min-height: 700px\)\s*{\s*\.header\s*{([^}]*)}/.exec(
        shellStyles,
      )
    expect(fixed).not.toBeNull()
    expect(fixed![1]).toMatch(/top:\s*0;/)
  })

  it('uses the same threshold the stage uses to decide the workspace is fixed', () => {
    // The flowing mode is `(max-width: 1023px), (max-height: 699px)` in this stylesheet and the
    // stage's; the fixed mode is its complement.
    expect(shellStyles).toMatch(/@media \(max-width: 1023px\), \(max-height: 699px\)/)
  })
})
