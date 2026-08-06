import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ClinicalContextStrip } from '../ClinicalContextStrip'

/**
 * U5: the clinical-context strip is a scroll container, so a keyboard has to be able to drive it.
 *
 * The strip is `overflow: auto` with a `max-height`, and every critical-care activity fills it with
 * more content than fits: measured in a browser on the ECMO Learn route it is 3094px of content in
 * 1585px of box at 1600 × 900, and 1903px of that is off-screen at 1024 × 768. What sits in the
 * hidden half is not decoration — it is ABG/MAP, the active-alarm row, the immediate goal, and the
 * whole safety-constraints block including the manufacturer/ELSO guidance line.
 *
 * Before this it had no `tabindex`, so it could not be focused, and it holds no focusable descendant
 * that a `Tab` could land on inside it either. That is `scrollable-region-focusable`: a pointer was
 * the only way to reach half the clinical context on the screen.
 *
 * What is asserted where. Focusability, tab order, the accessible name, the keyboard handling and the
 * focus-visible rule are all deterministic in jsdom and are asserted here. The *layout* facts — how
 * much overflows, and which item is outside the visible box — jsdom cannot produce at all, because it
 * computes no layout; those were measured in a real browser and are recorded in
 * `docs/cardiohelp-ecmo/validation/b5-vertical-slice-validation-summary.md`. The overflow below is
 * therefore stubbed, which is what lets the scroll assertions be about the component's behaviour
 * rather than about jsdom's geometry.
 */

const moduleCss = readFileSync(
  join(process.cwd(), 'src/features/learning-module/components/learning-module-v2.module.css'),
  'utf8',
)

/** The shape of the real thing: the far-right blocks are the ones that were unreachable. */
function ContextContent() {
  return (
    <>
      <dl>
        <dt>Mode / indication</dt>
        <dd>VV · maintenance support</dd>
      </dl>
      <dl>
        <dt>ABG / MAP</dt>
        <dd>pH 7.38 · PaCO₂ 43 · MAP 72</dd>
      </dl>
      <dl>
        <dt>Active alarm / limitation</dt>
        <dd>No active modeled alarm</dd>
      </dl>
      <div>
        <h3>Immediate goal</h3>
        <p>Start with four information domains</p>
      </div>
      <div>
        <h3>Safety constraints</h3>
        <p>Use an independent patient review alongside console and circuit data.</p>
        <p>Follow current manufacturer instructions and ELSO guidance.</p>
      </div>
    </>
  )
}

/**
 * Give the strip the overflow a real activity gives it.
 *
 * jsdom reports every box as zero, so without this there is no overflow for a scroll assertion to be
 * about — and a test that scrolled a container with nothing to scroll would pass against a component
 * that ignored the keyboard entirely.
 */
function stubOverflow(strip: HTMLElement, { content = 3094, box = 1585 } = {}) {
  let scrollLeft = 0
  Object.defineProperty(strip, 'scrollWidth', { configurable: true, get: () => content })
  Object.defineProperty(strip, 'clientWidth', { configurable: true, get: () => box })
  Object.defineProperty(strip, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    // Clamped the way a real scroller clamps, so "End" cannot report a position past the content.
    set: (value: number) => {
      scrollLeft = Math.max(0, Math.min(value, content - box))
    },
  })
  return { maxScrollLeft: content - box }
}

function renderStrip() {
  render(
    <ClinicalContextStrip>
      <ContextContent />
    </ClinicalContextStrip>,
  )
  const strip = screen.getByRole('region', { name: 'Clinical context' })
  return { strip, ...stubOverflow(strip) }
}

describe('U5: the clinical-context strip is reachable by keyboard', () => {
  it('is in the tab sequence', async () => {
    const user = userEvent.setup()
    const { strip } = renderStrip()

    expect(strip).toHaveAttribute('tabindex', '0')
    // Not merely focusable in principle: Tab from the document actually lands on it, because the
    // strip holds no focusable descendant that could take the stop instead.
    await user.tab()
    expect(strip).toHaveFocus()
  })

  it('keeps a role and the accessible name "Clinical context"', () => {
    const { strip } = renderStrip()
    // The name is what tells a screen-reader user what they have just focused, and the landmark is
    // how they jump to it in the first place. Neither may be traded for the tab stop.
    expect(strip).toHaveAccessibleName('Clinical context')
    expect(strip.tagName).toBe('SECTION')
  })

  it('adds exactly one tab stop, and no focusable descendant', async () => {
    const user = userEvent.setup()
    const { strip } = renderStrip()

    expect(
      strip.querySelectorAll(
        'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]',
      ),
    ).toHaveLength(0)

    await user.tab()
    expect(strip).toHaveFocus()
    // One stop in, one stop out: tabbing again leaves the strip rather than walking its contents.
    await user.tab()
    expect(strip).not.toHaveFocus()
  })

  it('scrolls horizontally with the arrow keys while focused', async () => {
    const user = userEvent.setup()
    const { strip } = renderStrip()

    await user.tab()
    expect(strip).toHaveFocus()
    expect(strip.scrollLeft).toBe(0)

    await user.keyboard('{ArrowRight}')
    const afterRight = strip.scrollLeft
    expect(afterRight).toBeGreaterThan(0)

    await user.keyboard('{ArrowRight}')
    expect(strip.scrollLeft).toBeGreaterThan(afterRight)

    await user.keyboard('{ArrowLeft}')
    expect(strip.scrollLeft).toBeLessThan(afterRight * 2)
  })

  it('reaches the far end and the start with End and Home', async () => {
    const user = userEvent.setup()
    const { strip, maxScrollLeft } = renderStrip()

    await user.tab()
    await user.keyboard('{End}')
    // The safety-constraints block is the last thing in the strip, so the end of the scroll range is
    // what brings it into the box. A browser gives a focused scroller no horizontal Home/End of its
    // own, which is why this is handled rather than left to the platform.
    expect(strip.scrollLeft).toBe(maxScrollLeft)

    await user.keyboard('{Home}')
    expect(strip.scrollLeft).toBe(0)
  })

  it('leaves keys it does not own alone', async () => {
    const user = userEvent.setup()
    const { strip } = renderStrip()

    await user.tab()
    await user.keyboard('{Tab}')
    expect(strip.scrollLeft).toBe(0)
  })

  it('describes the interaction, so the scroll is not left to be guessed at', () => {
    const { strip } = renderStrip()
    const describedBy = strip.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const hint = document.getElementById(describedBy as string)
    expect(hint?.textContent ?? '').toMatch(/arrow keys/i)
    // The instruction is for assistive technology, not a visible addition to the clinical strip.
    expect(hint).toHaveClass('sr-only')
  })

  it('paints a focus ring only when focused, and only from the keyboard', () => {
    // `:focus-visible` rather than `:focus`, so a pointer drag on the strip does not leave a ring
    // behind on a surface a learner is reading.
    expect(moduleCss).toMatch(/\.contextStrip:focus-visible \{[^}]*outline:/)
    expect(moduleCss).not.toMatch(/\.contextStrip:focus \{/)
  })

  it('does not become a vertical or nested scroll trap', () => {
    const { strip } = renderStrip()
    // The strip scrolls sideways. `overscroll-behavior` keeps a trackpad gesture inside it from
    // chaining to the page, and nothing here introduces a second scroller within it.
    expect(moduleCss).toMatch(/\.contextStrip \{[^}]*overscroll-behavior-x: contain;/)
    expect(strip.querySelectorAll('[data-scroll-pane]')).toHaveLength(0)
  })
})

describe('U5: the correction reaches every consumer through one component', () => {
  it('is the single element every activity frame wraps its patient context in', () => {
    // Four frames plus the ICU simulator lab render this component, and `ActivityShell` chooses
    // between the frames. Changing the component is what makes the fix uniform; a per-module override
    // would have fixed ECMO and left the other five.
    const consumers = [
      'src/features/learning-module/components/NativeWorkbenchFrame.tsx',
      'src/features/learning-module/components/GuidedLabFrame.tsx',
      'src/features/learning-module/components/CaseWorkspaceFrame.tsx',
      'src/features/learning-module/components/DidacticLessonFrame.tsx',
      'src/features/icu-simulation/components/IcuSimulatorLab.tsx',
    ]
    for (const consumer of consumers) {
      const source = readFileSync(join(process.cwd(), consumer), 'utf8')
      expect(source).toContain('ClinicalContextStrip')
      // No consumer may reintroduce the defect by rendering its own unfocusable strip beside it.
      expect(source).not.toMatch(/className=\{styles\.contextStrip\}/)
    }
  })
})
