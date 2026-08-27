import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { createReferenceSimulationState } from '../engine'

/**
 * That the withholding explanation is on screen wherever the withholding is.
 *
 * The map removes four sensor flags, the Δp bracket and a legend row while the flow-path lesson
 * waits for a commitment, and one sentence beside the drawing is the only thing that tells a
 * sighted learner why. It was written as a `.circuitPanHint` — the narrow-screen swipe affordance,
 * whose whole rule is `display: none` above 1000px — so the sentence rendered nowhere but mobile.
 * Measured in the production build before the fix: `display: none` at 1600×900, 1280×720 and
 * 1024×768 with the map's tabpanel open in each case, `display: block` only at 390×844. The
 * accessible description carried the explanation the whole time, which is why every DOM assertion
 * in the leak suite passed: `textContent` reads hidden text.
 *
 * Held on both sides of a seam jsdom cannot cross. The element side is a rendered assertion — the
 * note carries its own class and not the hint's. The stylesheet side is a source contract, because
 * jest stubs CSS modules and no rendered assertion in this repo can resolve a media query. Neither
 * half is sufficient: the class could be renamed to another hidden one, or the rule could be moved
 * back under a breakpoint.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}))
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const STYLESHEET = readFileSync(
  join(__dirname, '..', 'components', 'cardiohelp-ecmo.module.css'),
  'utf8',
)

/** The body of a top-level rule — one outside every `@media` block. */
function topLevelRuleBody(selector: string): string {
  const marker = `\n${selector} {`
  const at = STYLESHEET.indexOf(marker)
  if (at < 0) throw new Error(`No top-level rule for ${selector}`)
  const open = STYLESHEET.indexOf('{', at)
  return STYLESHEET.slice(open + 1, STYLESHEET.indexOf('}', open))
}

/** Every `@media` block whose prelude constrains width, with its body. */
function widthMediaBlocks(): readonly { readonly prelude: string; readonly body: string }[] {
  const blocks: { prelude: string; body: string }[] = []
  const pattern = /@media\s*([^{]*(?:min-width|max-width)[^{]*)\{/g
  for (let match = pattern.exec(STYLESHEET); match; match = pattern.exec(STYLESHEET)) {
    let depth = 1
    let index = match.index + match[0].length
    for (; index < STYLESHEET.length && depth > 0; index += 1) {
      if (STYLESHEET[index] === '{') depth += 1
      else if (STYLESHEET[index] === '}') depth -= 1
    }
    blocks.push({ prelude: match[1].trim(), body: STYLESHEET.slice(match.index, index) })
  }
  return blocks
}

function renderWithheldMap() {
  return render(
    <CircuitAndMonitors
      state={createReferenceSimulationState('vv-reference')}
      dispatch={jest.fn()}
      controlsEnabled={false}
      locationDisclosure="withheld"
    />,
  )
}

afterEach(cleanup)

describe('the withholding note carries its own class', () => {
  it('renders on the dedicated class, not the narrow-screen pan hint', () => {
    renderWithheldMap()
    const note = document.querySelector('[data-location-withheld-note]')
    expect(note).not.toBeNull()
    expect(note!.className).toBe('circuitWithheldNote')
    expect(note!.className).not.toMatch(/circuitPanHint/)
    expect(note!.textContent).toMatch(/once you have committed your prediction/i)
  })

  it('is the only thing that disappears when the placements are disclosed', () => {
    render(
      <CircuitAndMonitors
        state={createReferenceSimulationState('vv-reference')}
        dispatch={jest.fn()}
        controlsEnabled={false}
        locationDisclosure="full"
      />,
    )
    expect(document.querySelector('[data-location-withheld-note]')).toBeNull()
  })
})

describe('the dedicated class is visible at every width', () => {
  it('declares display: block outside every breakpoint', () => {
    expect(topLevelRuleBody('.circuitWithheldNote')).toMatch(/^\s*display:\s*block;?\s*$/m)
  })

  it('is never hidden or re-declared inside a width media query', () => {
    for (const { prelude, body } of widthMediaBlocks()) {
      expect(`${prelude} :: ${body.includes('.circuitWithheldNote')}`).toBe(`${prelude} :: false`)
    }
  })

  /*
   * The class it used to borrow, pinned as the reason it could not keep borrowing it. If
   * `.circuitPanHint` ever became visible by default this assertion would fail, and that is the
   * right moment to re-read the note above rather than to quietly merge the two again.
   */
  it('the pan hint it used to borrow really is hidden by default', () => {
    expect(topLevelRuleBody('.circuitPanHint')).toMatch(/^\s*display:\s*none;?\s*$/m)
    const revealing = widthMediaBlocks().filter(({ body }) => body.includes('.circuitPanHint'))
    expect(revealing.length).toBeGreaterThan(0)
    for (const { prelude } of revealing) expect(prelude).toMatch(/max-width/)
  })
})
