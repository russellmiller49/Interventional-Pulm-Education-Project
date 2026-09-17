import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * G02-PI-03: at 320 px with root text at 32 px, learner-facing text in the activity was clipped
 * rather than wrapped. A long clinical term is one unbreakable word — `superimposition,` measured
 * 226 px inside a 217 px outline panel — and with no break opportunity that word sets the box's
 * min-content width, so a grid track resolved wider than its own container (the teaching column
 * to 257.5 px inside 190 px, the source list to 271.6 px inside 198.4 px). Two Course outline
 * labels were cut off, the course title pushed the page 3 px past the viewport, and 29 text runs
 * were clipped with the outline open.
 *
 * The repair is one inherited declaration on the stage root. jsdom does no layout, so this holds
 * the stylesheet's declarations; the geometry itself is checked in the browser and recorded in
 * docs/gap-remediation/self-paced/PI-WRAP-01-handoff.md.
 */
const flowStyles = readFileSync(
  join(process.cwd(), 'src/features/peripheral-imaging/components/stage/imaging-flow.module.css'),
  'utf8',
)

function ruleBody(css: string, selector: string): string {
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*{([^}]*)}`).exec(
    css,
  )
  if (!match) throw new Error(`No rule for ${selector}`)
  return match[1]
}

describe('G02-PI-03: the activity wraps long clinical terms instead of clipping them', () => {
  it('breaks over-long words at the stage root, so every surface inside the activity inherits it', () => {
    expect(ruleBody(flowStyles, '.course')).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('uses `anywhere`, the only value that also shrinks a track to its container', () => {
    // `break-word` wraps the visible line but is ignored when min-content is computed, so the
    // teaching and source grid tracks would still resolve wider than the box that holds them.
    expect(ruleBody(flowStyles, '.course')).not.toMatch(/overflow-wrap:\s*break-word/)
  })

  it('does not hide the overflow instead of reflowing it', () => {
    // Clipping the text, or replacing it with an ellipsis, would conceal the defect rather than
    // repair it: the learner still could not read the label.
    for (const selector of ['.course', '.header h1', '.outline a', '.explanation']) {
      const body = ruleBody(flowStyles, selector)
      expect(body).not.toMatch(/text-overflow:\s*ellipsis/)
      expect(body).not.toMatch(/white-space:\s*nowrap/)
    }
  })
})
