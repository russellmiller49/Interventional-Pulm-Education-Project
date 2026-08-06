import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The Learn workspace inverts a shared shell, and the inversion has to win regardless of load order.
 *
 * Owner smoke test, 2026-08-06: the teaching pane rendered white text on a near-white surface — the
 * "Why this step matters" wash went cream, and the drill panel's sections, which carry no
 * background of their own, went white under white type.
 *
 * The cause is a specificity tie, not a colour choice. `.workspace` in `teaching-workspace.module.css`
 * paints a light surface; `.deviceWorkspace` in this module inverts it. Both are single-class
 * selectors in different stylesheets, so the winner is decided by stylesheet order — a build and
 * route-chunking detail. `color` had already been doubled for exactly that reason; `background` and
 * `color-scheme` had not, so half the inversion could lose while the other half won.
 *
 * These are source contracts because that is where the defect lives: jsdom does not resolve a
 * cascade across CSS-module files, so no rendered assertion in this suite can see it.
 */

const MODULE_ROOT = join(__dirname, '..', 'components')
const SHARED_SHELL = join(
  __dirname,
  '..',
  '..',
  'learning-module',
  'curriculum',
  'teaching-workspace.module.css',
)

/**
 * A real declaration of `prop`, anchored to the start of a line.
 *
 * Not `\bbackground\s*:` — that also matches the custom property `--background`, which is a
 * design token nothing contests and which lives on the single class quite legitimately.
 */
function declaration(prop: string): RegExp {
  return new RegExp(`^\\s*${prop}\\s*:`, 'm')
}

function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`)
  if (at < 0) throw new Error(`No rule for ${selector}`)
  const open = css.indexOf('{', at)
  return css.slice(open + 1, css.indexOf('}', open))
}

describe('the Learn workspace beats the shared shell whatever the stylesheet order', () => {
  const shell = readFileSync(SHARED_SHELL, 'utf8')
  const learn = readFileSync(join(MODULE_ROOT, 'EcmoLearnWorkspace.module.css'), 'utf8')

  const shellBody = ruleBody(shell, '.workspace')
  const single = ruleBody(learn, '.deviceWorkspace')
  const doubled = ruleBody(learn, '.deviceWorkspace.deviceWorkspace')

  // The shell really is the light surface this module has to override.
  it.each(['color', 'color-scheme', 'background'])('the shared shell still declares %s', (prop) => {
    expect(shellBody).toMatch(new RegExp(`\\b${prop}\\s*:`))
  })

  it.each(['color', 'color-scheme', 'background'])(
    '%s is declared on the doubled selector, which outranks the shell',
    (prop) => {
      expect(doubled).toMatch(declaration(prop))
    },
  )

  it.each(['color', 'color-scheme', 'background'])(
    '%s is not left on the single class, where the tie is decided by load order',
    (prop) => {
      expect(single).not.toMatch(declaration(prop))
    },
  )

  it('still inverts the shell rather than agreeing with it', () => {
    expect(doubled).toContain('color-scheme: dark')
    expect(shellBody).toContain('color-scheme: light')
    expect(doubled).toMatch(/background:\s*#061519/)
    expect(shellBody).toMatch(/background:\s*#eaf1ef/)
  })

  it('leaves the design tokens on the single class, where nothing contests them', () => {
    // The shell declares no Tailwind tokens, so these cannot lose a tie and do not need doubling.
    expect(single).toMatch(/--card:/)
    expect(shellBody).not.toMatch(/--card:/)
  })
})

describe('the foundation workspace agrees with the shell rather than inverting it', () => {
  const shell = readFileSync(SHARED_SHELL, 'utf8')
  const foundation = readFileSync(join(MODULE_ROOT, 'EcmoFoundationWorkspace.module.css'), 'utf8')

  it('never contradicts the shared surface, so no tie can leave it half-applied', () => {
    const single = ruleBody(foundation, '.readableWorkspace')
    // It asks for the same light scheme the shell paints, and sets no competing background: losing
    // the tie changes nothing. Only an inverting workspace needs the doubled selector.
    expect(single).toContain('color-scheme: light')
    expect(ruleBody(shell, '.workspace')).toContain('color-scheme: light')
    expect(single).not.toMatch(declaration('background'))
  })
})
