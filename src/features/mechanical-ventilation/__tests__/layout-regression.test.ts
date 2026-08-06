import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  learnViewportContractViolations,
  learnWorkspaceFrameContractViolations,
} from '../test-support/learn-layout-contract'

describe('mechanical ventilation activity layout', () => {
  const componentStyles = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/mechanical-ventilation.module.css',
    ),
    'utf8',
  )
  const activityStyles = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/mechanical-ventilation-v2.module.css',
    ),
    'utf8',
  )

  it('keeps waveform palette variables on the standalone console surface', () => {
    expect(componentStyles).toMatch(
      /\.moduleRoot,\s*\.bedsidePanel,\s*\.workflowPanel,\s*\.consoleShell\s*{[\s\S]*?--screen-line:\s*#[0-9a-f]+;[\s\S]*?--wave:\s*#[0-9a-f]+;/i,
    )
  })

  it('constrains case content to an owned scroll viewport', () => {
    expect(activityStyles).toMatch(
      /\.caseViewport\s*{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/,
    )
  })

  /*
   * The Learn viewport is checked against a stated contract rather than against a literal class
   * attribute. The previous assertion pinned the exact Tailwind string
   * `"grid h-full min-h-0 content-start gap-3 overflow-auto bg-background p-3"`, which described
   * the defect this package removed: one scroll container, sized by its content, holding a 40rem
   * workspace. Any reordering of that string broke the test while the layout was fine, and the
   * layout could break while the string was intact.
   */
  it('gives the Learn viewport a fixed height whose last row is the workspace', () => {
    expect(learnViewportContractViolations(activityStyles)).toEqual([])
  })

  it('hands the workspace frame a definite height so its panes scroll on their own', () => {
    expect(learnWorkspaceFrameContractViolations(activityStyles)).toEqual([])
  })

  /*
   * The contract has to be able to fail. These reconstruct the pre-D2 rules and prove the checker
   * rejects them, so a future edit that reintroduces the defect is caught rather than passing on a
   * rule that merely parses.
   */
  it('rejects the pre-D2 viewport, which scrolled as one block sized by its content', () => {
    const beforeD2 = `
      .learnViewport {
        display: grid;
        height: 100%;
        min-height: 0;
        align-content: start;
        gap: 0.75rem;
        overflow: auto;
        padding: 0.75rem;
      }
    `
    expect(learnViewportContractViolations(beforeD2)).toEqual(
      expect.arrayContaining([
        'learnViewport must not scroll as one block: expected overflow: hidden',
        'learnViewport must end in a minmax(0, 1fr) row so the workspace takes the remaining height',
      ]),
    )
  })

  it('rejects a workspace frame pinned to a minimum height instead of the space available', () => {
    const beforeD2 = `
      .workspaceFrame {
        min-height: 40rem;
        overflow: hidden;
      }
    `
    expect(learnWorkspaceFrameContractViolations(beforeD2)).toEqual(
      expect.arrayContaining([
        'workspaceFrame must declare height: 100% so the shared workspace can resolve its own height',
      ]),
    )
  })

  it('re-scopes the compact console sizes to the measured laptop density', () => {
    // The compaction existed but was reachable only from the unrouted lab surface, so the Learn
    // workspace always paid full price for the console.
    expect(componentStyles).toMatch(
      /\[data-mv-density='laptop'\]\s+\.consoleScreen[\s\S]{0,400}?min-height:\s*345px;/,
    )
    expect(componentStyles).toMatch(
      /\[data-mv-density='laptop'\]\s+\.waveformSvg\s*{[\s\S]{0,120}?min-height:\s*105px;/,
    )
  })

  it('keeps the run control in a strip that costs the workspace no height', () => {
    const teachingStyles = readFileSync(
      join(
        process.cwd(),
        'src/features/mechanical-ventilation/components/mechanical-ventilation-teaching.module.css',
      ),
      'utf8',
    )
    expect(teachingStyles).toMatch(/\[data-mv-run-control='strip'\]\s+\.runControl\s*{/)
    // The run control renders on a light card in the viewport as well as inside the light activity
    // pane, so it cannot inherit its ink from whichever surface it lands on.
    expect(teachingStyles).toMatch(/\.runControl\s*{[\s\S]*?color:\s*#[0-9a-f]{6};[\s\S]*?}/i)
  })
})
