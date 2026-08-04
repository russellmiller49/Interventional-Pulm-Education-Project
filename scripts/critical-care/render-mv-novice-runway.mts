/**
 * Offline visual harness for the "Before lesson 1" novice runway.
 *
 * Same reason as the other two MV harnesses: the Learn landing sits behind login, so the runway
 * cannot be screenshotted in the running app without credentials. This renders every panel state at
 * the four widths the D0/D1 package calls for, each in a fixed-width frame, so the review question
 * — does the primer overflow, trap a scroll, or hide a control at 1024×768? — can be answered by
 * looking rather than by guessing.
 *
 * package.json is locked for this parallel round, so run it directly:
 *
 *   npx esbuild scripts/critical-care/render-mv-novice-runway.mts --bundle --platform=node \
 *     --format=cjs --log-level=error --loader:.module.css=local-css \
 *     --outfile=node_modules/.cache/mv-console/runway.cjs && node node_modules/.cache/mv-console/runway.cjs
 *
 * Output: public/mv-console-preview/novice-runway.html, served through the `trainer-prod-static`
 * launch config on :8099. The output directory is gitignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MechanicalVentilationNoviceRunway } from '../../src/features/mechanical-ventilation/components/MechanicalVentilationNoviceRunway.tsx'

/**
 * The runway keeps its open panel in local state, and `renderToStaticMarkup` gives no way to press
 * a button. Each state is therefore rendered from a fresh mount with the panel forced open through
 * the same prop the component uses for its initial value — so what is reviewed here is the real
 * markup for that state rather than a screenshot of one tab.
 */
const PANELS = ['controls', 'breath', 'modes', 'setup', 'urgency'] as const
const PANEL_TITLES: Record<(typeof PANELS)[number], string> = {
  controls: 'A · The controls',
  breath: 'B · One normal breath',
  modes: 'C · Mode names',
  setup: 'D · Starting a patient',
  urgency: 'E · Urgent, or abnormal?',
}

/** The four review widths from the package, with the content column each would actually give. */
const VIEWPORTS = [
  { label: '1600 × 900', width: 1600 },
  { label: '1440 × 900', width: 1440 },
  { label: '1280 × 720', width: 1280 },
  { label: '1024 × 768', width: 1024 },
] as const

/**
 * `PathwayLanding` wraps its content in `main.mx-auto.max-w-6xl.px-4 sm:px-6 lg:px-8`, so the
 * runway never sees the full viewport width. max-w-6xl is 72rem = 1152px; padding is 32px at these
 * breakpoints. Reproduce that, because reviewing the primer at 1600px of unconstrained width would
 * answer a question nobody is asking.
 */
function contentWidth(viewport: number): number {
  return Math.min(1152, viewport - 64)
}

// esbuild emits the bundled CSS modules as a sibling of the JS bundle.
const css = readFileSync(__filename.replace(/\.cjs$/, '.css'), 'utf8')

const blocks = VIEWPORTS.map((viewport) => {
  const inner = contentWidth(viewport.width)
  const panels = PANELS.map((panel) => {
    const markup = renderToStaticMarkup(
      createElement(MechanicalVentilationNoviceRunway, { initialPanel: panel }),
    )
    return `<section><h3>${PANEL_TITLES[panel]}</h3><div class="frame" style="width:${inner}px">${markup}</div></section>`
  }).join('\n')
  return `<article id="w${viewport.width}"><h2>${viewport.label} <small>content column ${inner}px</small></h2>${panels}</article>`
}).join('\n')

const nav = VIEWPORTS.map((v) => `<a href="#w${v.width}">${v.label}</a>`).join('')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MV novice runway — static render</title>
<style>
  body { margin: 0; padding: 2rem; background: #101c1f; color: #eaf8f7;
         font-family: ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
  p.lede { color: #9fc4c2; font-size: 0.85rem; margin: 0 0 1.5rem; max-width: 60rem; }
  h2 { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
       color: #79daca; margin: 3rem 0 0.5rem; }
  h2 small { color: #6d8c8f; font-weight: 500; letter-spacing: 0; text-transform: none; }
  h3 { font-size: 0.72rem; font-weight: 700; color: #9fc4c2; margin: 1.5rem 0 0.5rem; }
  article:first-of-type h2 { margin-top: 0; }
  nav { display: flex; flex-wrap: wrap; gap: 0.9rem; margin-bottom: 1.5rem; }
  nav a { color: #79daca; font-size: 0.8rem; }
  /*
   * A hard border at the content width, and no overflow rule of its own: anything that spills past
   * this edge, or that would need its own scrollbar, is the defect being looked for.
   */
  .frame { border: 1px dashed #3d5f63; border-radius: 0.5rem; }
</style>
<style>${css}</style>
</head>
<body>
<h1>Mechanical ventilation — “Before lesson 1” runway, static render (no login required)</h1>
<p class="lede">
  Every panel state at each review width, framed at the content column
  <code>PathwayLanding</code> actually gives it. The dashed border is the available width: content
  crossing it is an overflow, and any inner scrollbar is a nested-scroll trap.
</p>
<nav>${nav}</nav>
${blocks}
</body>
</html>`

const outDir = join(process.cwd(), 'public', 'mv-console-preview')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, 'novice-runway.html')
writeFileSync(file, page, 'utf8')
console.log(`wrote ${file}`)
console.log(
  `rendered ${PANELS.length} panel states × ${VIEWPORTS.length} widths = ${PANELS.length * VIEWPORTS.length} blocks`,
)
