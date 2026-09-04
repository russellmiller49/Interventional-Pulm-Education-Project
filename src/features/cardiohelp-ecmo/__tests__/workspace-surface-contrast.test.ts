import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The lesson stage beats the shared shell whatever the stylesheet order.
 *
 * `.workspace` in `teaching-workspace.module.css` paints a light surface — `background`,
 * `color-scheme: light`, a dark ink — from a single-class selector. The stage inverts all three for
 * its dark shell, and because both rules have equal specificity the winner would otherwise be
 * decided by stylesheet order, which is a build and route-chunking detail. Every contradicting
 * declaration therefore lives on a doubled selector, and the design tokens stay on the single
 * class where nothing contests them. An owner smoke test once found the teaching pane rendered as
 * white text on a near-white surface when this tie was lost.
 */

const sharedStyles = readFileSync(
  join(process.cwd(), 'src/features/learning-module/curriculum/teaching-workspace.module.css'),
  'utf8',
)
const stageStyles = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/stage/EcmoLessonStage.module.css'),
  'utf8',
)

function block(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no rule for ${selector}`)
  const end = source.indexOf('}', start)
  return source.slice(start, end)
}

describe('the lesson stage beats the shared shell whatever the stylesheet order', () => {
  const shell = block(sharedStyles, '.workspace')
  const doubled = block(stageStyles, '.workspace.workspace')
  const single = block(stageStyles, '.workspace')

  it('contests every shell declaration from the doubled selector', () => {
    for (const property of ['color', 'color-scheme', 'background']) {
      // A property, not the design token of the same name (`--background:`).
      const declared = new RegExp(`(?<![-\\w])${property}:`)
      expect(shell).toMatch(declared)
      expect(doubled).toMatch(declared)
      expect(single).not.toMatch(declared)
    }
  })

  it('still inverts the shell rather than agreeing with it', () => {
    expect(shell).toMatch(/color-scheme:\s*light/)
    expect(doubled).toMatch(/color-scheme:\s*dark/)
    expect(doubled).toMatch(/background:\s*#061519/)
  })

  it('leaves the design tokens on the single class, where nothing contests them', () => {
    expect(single).toMatch(/--background:/)
    expect(single).toMatch(/--foreground:/)
    expect(doubled).not.toMatch(/--background:/)
  })
})
