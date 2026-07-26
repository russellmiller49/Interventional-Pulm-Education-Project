/**
 * Offline visual harness for the mechanical-ventilation teaching panels.
 *
 * Same reason as `render-mv-console.mts`: the Learn workspace sits behind login and behind a
 * client-side viewport gate, so the panels cannot be screenshotted in the running app without
 * credentials. This renders every section's panel to static HTML against a warmed simulation.
 *
 * Run from the repo root:
 *
 *   npm run render:mv-teaching
 *
 * Output: public/mv-console-preview/teaching-panels.html, served through the `trainer-prod-static`
 * launch config on :8099. The output directory is gitignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MechanicalVentilationTeachingPanel } from '../../src/features/mechanical-ventilation/components/MechanicalVentilationTeachingPanel.tsx'
import { mechanicalVentilationLessons } from '../../src/features/mechanical-ventilation/content/lessons.ts'
import {
  createInitialSimulationState,
  ventilationSimulationReducer,
} from '../../src/features/mechanical-ventilation/engine/index.ts'
import type { VentilationSimulationState } from '../../src/features/mechanical-ventilation/engine/types.ts'

const WARMUP_SECONDS = 24

function warmed(caseId: string): VentilationSimulationState {
  let state = createInitialSimulationState(caseId, 'learn', 1, 'hamilton-c6')
  state = { ...state, paused: false }
  for (let tick = 0; tick < WARMUP_SECONDS * 10; tick += 1) {
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
  }
  // An inspiratory hold so the plateau-dependent panels have a measurement to report, then run on
  // past it so the most recent breath is an ordinary one rather than the occluded one.
  state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
  for (let tick = 0; tick < 100; tick += 1) {
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
  }
  return state
}

// esbuild emits the bundled CSS modules as a sibling of the JS bundle.
const css = readFileSync(__filename.replace(/\.cjs$/, '.css'), 'utf8')

const sections = mechanicalVentilationLessons
  .map((lesson) => {
    const caseId = lesson.relatedCaseIds[0] ?? 'MV-01'
    const markup = renderToStaticMarkup(
      createElement(MechanicalVentilationTeachingPanel, {
        lessonId: lesson.id,
        state: warmed(caseId),
      }),
    )
    return `<section id="${lesson.id}"><h2>${lesson.title} <small>${lesson.id} · ${caseId}</small></h2><div class="pane">${markup}</div></section>`
  })
  .join('\n')

const nav = mechanicalVentilationLessons
  .map((lesson) => `<a href="#${lesson.id}">${lesson.domain}</a>`)
  .join('')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MV teaching panels — static render</title>
<style>
  body { margin: 0; padding: 2rem; background: #101c1f; color: #eaf8f7;
         font-family: ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.2rem; margin: 0 0 0.75rem; }
  h2 { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
       color: #79daca; margin: 2.5rem 0 0.75rem; }
  h2 small { display: block; color: #6d8c8f; font-weight: 500; letter-spacing: 0;
             text-transform: none; margin-top: 0.2rem; }
  section:first-of-type h2 { margin-top: 0; }
  nav { display: flex; flex-wrap: wrap; gap: 0.9rem; margin-bottom: 1.5rem; }
  nav a { color: #79daca; font-size: 0.8rem; }
  /* The panel lives in the workspace's middle pane, so preview it at that width. */
  .pane { width: 420px; max-width: 100%; border-radius: 0.5rem; overflow: hidden; }
</style>
<style>${css}</style>
</head>
<body>
<h1>Mechanical ventilation teaching panels — static render (no login required)</h1>
<nav>${nav}</nav>
${sections}
</body>
</html>`

const outDir = join(process.cwd(), 'public', 'mv-console-preview')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, 'teaching-panels.html')
writeFileSync(file, page, 'utf8')
console.log(`wrote ${file}`)
