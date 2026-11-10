import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)

import { McsModuleFrame } from '../components/McsModuleFrame'

/**
 * The MCS overview and Learn page are dark (owner, 2026-11-10), like the lessons they lead into
 * and the other four critical care modules. The practice workbench and the cases stay light for
 * now, and must draw exactly what they drew.
 *
 * The stylesheet does this with tokens: each light background, dark ink and light border reads
 * `var(--mcs-<role>-<hex>, <the literal it replaced>)`, and the tokens are set only inside the
 * dark frame outside a lesson. jsdom computes no styles, so this holds the declarations.
 */
const sheet = readFileSync(
  join(
    process.cwd(),
    'src/features/mechanical-circulatory-support/components/mechanical-circulatory-support.module.css',
  ),
  'utf8',
)

describe('the MCS frame', () => {
  it('is dark on the overview and the Learn page', () => {
    const { container } = render(
      <McsModuleFrame locale="en" activeHref="/mechanical-circulatory-support">
        <p>Overview</p>
      </McsModuleFrame>,
    )
    expect(container.querySelector('[data-learning-module-v2-theme-root]')).toHaveAttribute(
      'data-theme',
      'dark',
    )
  })

  it('still lets the practice workbench ask for the light theme', () => {
    const { container } = render(
      <McsModuleFrame
        locale="en"
        activeHref="/mechanical-circulatory-support/practice"
        activityMode
        flowing
        theme="light"
      >
        <p>Workbench</p>
      </McsModuleFrame>,
    )
    expect(container.querySelector('[data-learning-module-v2-theme-root]')).toHaveAttribute(
      'data-theme',
      'light',
    )
  })
})

describe('the MCS stylesheet tokens', () => {
  const uses = [...sheet.matchAll(/var\((--mcs-(?:bg|fg|bd)-[0-9a-f]{6})(,[^)]*)?\)/g)]

  it('gives every token use the literal it replaced, so the light theme is unchanged', () => {
    expect(uses.length).toBeGreaterThan(100)
    for (const use of uses) {
      const hex = use[1].slice(-6)
      // `#abc` in the source was written short; the token carries its six-digit form.
      const short = hex[0] === hex[1] && hex[2] === hex[3] && hex[4] === hex[5]
      const literal = (use[2] ?? '').replace(/^,\s*/, '').toLowerCase()
      expect([`#${hex}`, short ? `#${hex[0]}${hex[2]}${hex[4]}` : `#${hex}`]).toContain(literal)
    }
  })

  it('sets the tokens only in the dark frame outside a lesson', () => {
    const start = sheet.indexOf(".moduleShell:not([data-activity-mode='true'])")
    expect(start).toBeGreaterThan(0)
    const block = sheet.slice(start, sheet.indexOf('\n}\n', start))
    expect(block).toContain("[data-learning-module-v2-theme-root][data-theme='dark']")
    const declared = [...sheet.matchAll(/^\s*(--mcs-(?:bg|fg|bd)-[0-9a-f]{6}):/gm)]
    expect(declared.length).toBeGreaterThan(100)
    // Every declaration sits inside that one block, and every token in use is declared there.
    for (const match of declared) {
      expect(match.index).toBeGreaterThan(start)
      expect(match.index).toBeLessThan(start + block.length)
    }
    const names = new Set(declared.map((match) => match[1]))
    for (const use of uses) expect(names).toContain(use[1])
  })
})
