/**
 * The Learn workspace layout contract, expressed as checks over stylesheet text.
 *
 * jsdom performs no layout, so a jest test cannot ask "is the waveform on screen at 1280x720".
 * What it can do is hold the two rules the browser measurements showed to be load-bearing:
 *
 *  1. the Learn viewport is a fixed-height grid that does not scroll as one block, and whose last
 *     row is the workspace;
 *  2. the workspace frame has a definite height, because `ResizableTeachingWorkspace` is
 *     `height: 100%` and only becomes three independently scrolling panes when something resolves
 *     that percentage.
 *
 * Before this package both were false: the viewport was `overflow: auto` with content-sized rows
 * and the frame was `min-h-[40rem]`, so at 1280x720 a 638px workspace sat in a 377px window and
 * the whole viewport scrolled — 948px of content, five levels of nested scrolling, and the
 * ventilator leaving the screen whenever the learner reached for a control.
 *
 * The real acceptance evidence is `scripts/critical-care/measure-mv-learn-layout.mjs`, which drives
 * Chromium at four viewports; this file is the cheap guard that keeps the rules from drifting
 * between those runs.
 */

function ruleBody(css: string, selector: string): string | null {
  // Matches `.name` or `.name[attr='value']` at the start of a rule, up to the first closing brace.
  const pattern = new RegExp(`\\.${selector}\\s*(?:\\[[^\\]]*\\])?\\s*{([^}]*)}`)
  const match = pattern.exec(css)
  return match ? match[1] : null
}

export function learnViewportContractViolations(css: string): string[] {
  const body = ruleBody(css, 'learnViewport')
  if (!body) return ['learnViewport rule is missing']

  const violations: string[] = []
  if (!/display:\s*grid/.test(body)) {
    violations.push('learnViewport must be a grid so its rows can be sized independently')
  }
  if (!/height:\s*100%/.test(body)) {
    violations.push('learnViewport must declare height: 100% to take the shell row it is given')
  }
  if (!/min-height:\s*0/.test(body)) {
    violations.push('learnViewport must declare min-height: 0 so a tall pane cannot inflate it')
  }
  if (!/overflow:\s*hidden/.test(body)) {
    violations.push('learnViewport must not scroll as one block: expected overflow: hidden')
  }
  if (!/grid-template-rows:[^;]*minmax\(\s*0\s*,\s*1fr\s*\)\s*;/.test(body)) {
    violations.push(
      'learnViewport must end in a minmax(0, 1fr) row so the workspace takes the remaining height',
    )
  }
  return violations
}

export function learnWorkspaceFrameContractViolations(css: string): string[] {
  const body = ruleBody(css, 'workspaceFrame')
  if (!body) return ['workspaceFrame rule is missing']

  const violations: string[] = []
  if (!/height:\s*100%/.test(body)) {
    violations.push(
      'workspaceFrame must declare height: 100% so the shared workspace can resolve its own height',
    )
  }
  if (!/min-height:\s*0/.test(body)) {
    violations.push('workspaceFrame must declare min-height: 0 so its panes can shrink and scroll')
  }
  if (/min-height:\s*\d+(\.\d+)?rem/.test(body)) {
    violations.push(
      'workspaceFrame must not pin a rem minimum height: that is the pre-D2 min-h-[40rem] defect',
    )
  }
  return violations
}
