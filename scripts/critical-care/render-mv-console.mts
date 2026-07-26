/**
 * Offline visual harness for the mechanical-ventilation console.
 *
 * The module routes sit behind `src/proxy.ts` login, and the lesson workspace only mounts after a
 * client-side viewport measurement, so neither `curl` nor the browser can screenshot a console
 * without credentials. This renders each device's console to static HTML instead, one page per
 * device and screen, with the emitted CSS module inlined.
 *
 * Run from the repo root (tsx is broken under Node 25, so bundle first, and the bundle must run as
 * CJS — `new Function` dies on `Dynamic require of "util"`):
 *
 *   npm run render:mv-console
 *
 * Output: public/mv-console-preview/<device>.html, served through the `trainer-prod-static`
 * launch config on :8099 (http://127.0.0.1:8099/mv-console-preview/hamilton-c6.html).
 * The output directory is gitignored — it is a look-at-it artifact, not a build product.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MechanicalVentilatorConsole } from '../../src/features/mechanical-ventilation/components/MechanicalVentilatorConsole.tsx'
import { ventilatorDeviceProfiles } from '../../src/features/mechanical-ventilation/content/deviceProfiles.ts'
import {
  createInitialSimulationState,
  ventilationSimulationReducer,
} from '../../src/features/mechanical-ventilation/engine/index.ts'
import type {
  VentilationSimulationState,
  VentilatorDeviceId,
  VentilatorScreen,
} from '../../src/features/mechanical-ventilation/engine/types.ts'

/** Screens worth a look. Each renders as its own console instance on the device's page. */
const SCREENS: readonly { screen: VentilatorScreen; caption: string; hold?: boolean }[] = [
  { screen: 'main', caption: 'Monitoring — the vendor’s own parameter set, layout, and traces' },
  { screen: 'controls', caption: 'Settings — the vendor’s own control order and grouping' },
  { screen: 'tools', caption: 'Tools — maneuvers beside the trace they draw on' },
  { screen: 'tools', caption: 'Tools, mid-occlusion — inspiratory hold at end-inspiration', hold: true },
]

const CASE_ID = 'MV-01'
const WARMUP_SECONDS = 14

function warmed(deviceId: VentilatorDeviceId): VentilationSimulationState {
  let state = createInitialSimulationState(CASE_ID, 'learn', 1, deviceId)
  state = { ...state, paused: false }
  for (let tick = 0; tick < WARMUP_SECONDS * 10; tick += 1) {
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
  }
  return state
}

function stateFor(
  deviceId: VentilatorDeviceId,
  screen: VentilatorScreen,
  hold: boolean,
): VentilationSimulationState {
  let state = warmed(deviceId)
  if (hold) {
    state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
    // Run on into the occlusion so the plateau is drawn, not just the instant it began.
    for (let tick = 0; tick < 25; tick += 1) {
      state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
    }
  }
  return { ...state, ventilator: { ...state.ventilator, screen } }
}

function page(deviceId: VentilatorDeviceId, css: string): string {
  const profile = ventilatorDeviceProfiles.find((candidate) => candidate.id === deviceId)
  const sections = SCREENS.map(({ screen, caption, hold }) => {
    // createElement, not a direct call: this file is `.mts`, so esbuild parses it without JSX.
    const markup = renderToStaticMarkup(
      createElement(MechanicalVentilatorConsole, {
        state: stateFor(deviceId, screen, hold ?? false),
        dispatch: () => undefined,
        controlsEnabled: true,
      }),
    )
    return `<section><h2>${caption}</h2>${markup}</section>`
  }).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${profile?.displayName ?? deviceId} — console render</title>
<style>
  body { margin: 0; padding: 2rem; background: #101c1f; color: #eaf8f7;
         font-family: ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.2rem; margin: 0 0 1.5rem; }
  h2 { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
       color: #79daca; margin: 2.5rem 0 0.75rem; }
  section:first-of-type h2 { margin-top: 0; }
  nav a { color: #79daca; margin-right: 1rem; font-size: 0.8rem; }
</style>
<style>${css}</style>
</head>
<body>
<h1>${profile?.displayName ?? deviceId} — static console render (no login required)</h1>
<nav>${ventilatorDeviceProfiles
    .map((candidate) => `<a href="./${candidate.id}.html">${candidate.shortName}</a>`)
    .join('')}</nav>
${sections}
</body>
</html>`
}

// esbuild emits the bundled CSS modules as a sibling of the JS bundle.
const css = readFileSync(__filename.replace(/\.cjs$/, '.css'), 'utf8')
const outDir = join(process.cwd(), 'public', 'mv-console-preview')
mkdirSync(outDir, { recursive: true })

for (const profile of ventilatorDeviceProfiles) {
  const file = join(outDir, `${profile.id}.html`)
  writeFileSync(file, page(profile.id, css), 'utf8')
  console.log(`wrote ${file}`)
}
