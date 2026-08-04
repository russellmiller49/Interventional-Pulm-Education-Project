/**
 * One review page carrying every CRRT circuit overlay and its full text
 * equivalent, for visual and semantic review.
 *
 * The CRRT routes are behind a login, so neither curl nor the browser can reach
 * the real surface. This renders the component itself, offline, with the real
 * checked-in stylesheet inlined verbatim — the CSS-module shim maps class names
 * through unchanged, so the source selectors match the rendered markup.
 *
 * Nothing is added to package.json. Run it directly from the repo root:
 *
 *   npx tsx scripts/baxter-crrt/render-crrt-circuit.ts
 *
 * Writes node_modules/.cache/baxter-crrt/circuit-overlays.html and prints the
 * path. The file is self-contained; open it with file:// or serve the directory.
 */
import './css-module-shim'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REVIEW_CHECKLIST: readonly string[] = [
  'Every overlay keeps the same component positions and the same orientation.',
  'Access and return lumens are separately visible and separately labelled.',
  'No label is clipped by the viewBox or overlapped by another label.',
  'Every active path is distinguishable without relying on colour — check the dash pattern and the written legend.',
  'The four directly modelled pressure sites are marked differently from the two calculated relationships.',
  'TMP and filter pressure drop are never drawn as a site on the circuit.',
  'No number renders as undefined, NaN, or an empty cell.',
  'The fluid-conservation ledger balances, and total effluent is visibly distinct from machine patient removal.',
  'The text equivalent below each figure names every path drawn as active in it.',
  'No universal pressure target, normal range, or alarm threshold appears anywhere.',
]

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function main(): Promise<void> {
  // Dynamic imports: the shim above must be installed before any component
  // module is resolved, or the CSS import fails first.
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { CrrtPilotCircuit } =
    await import('../../src/features/baxter-crrt/components/CrrtPilotCircuit')
  const { crrtCircuitOverlays, crrtCircuitTextEquivalent } =
    await import('../../src/features/baxter-crrt/content/circuitModel')
  const { crrtWorkedLedgerExample } =
    await import('../../src/features/baxter-crrt/circuitFluidLedger')

  const css = readFileSync(
    join(process.cwd(), 'src/features/baxter-crrt/components/crrt-pilot-circuit.module.css'),
    'utf8',
  )

  const sections = crrtCircuitOverlays.map((overlay) => {
    const markup = renderToStaticMarkup(
      createElement(CrrtPilotCircuit, {
        running: true,
        setReady: true,
        fluidsReady: true,
        bloodFlowMlMin: crrtWorkedLedgerExample.flows.bloodFlowMlMin,
        dialysateFlowMlHour: crrtWorkedLedgerExample.flows.dialysateFlowMlHour,
        patientFluidRemovalMlHour: crrtWorkedLedgerExample.flows.patientFluidRemovalMlHour,
        flows: crrtWorkedLedgerExample.flows,
        initialOverlayId: overlay.id,
        pressure: {
          access: -72,
          filter: 146,
          return: 64,
          effluent: 28,
          TMP: 77,
          filterDrop: 82,
        },
      }),
    )

    return [
      `<section class="review-item" id="${escapeHtml(overlay.id)}">`,
      `<h2>${escapeHtml(overlay.label)} <code>${escapeHtml(overlay.id)}</code></h2>`,
      `<p class="review-summary">${escapeHtml(overlay.summary)}</p>`,
      markup,
      '<h3>Full text equivalent</h3>',
      `<pre class="review-text">${escapeHtml(crrtCircuitTextEquivalent(overlay.id))}</pre>`,
      `<p class="review-sources">Sources: ${escapeHtml(overlay.sourceIds.join(', '))}</p>`,
      '</section>',
    ].join('\n')
  })

  const page = [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>CRRT universal circuit — overlay review</title>',
    '<style>',
    'body{margin:0;padding:24px;background:#04141a;color:#e8f4f6;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}',
    'h1{font-size:1.6rem;margin:0 0 .4rem}',
    '.review-item{margin:0 0 48px;padding:20px;border:1px solid rgba(159,205,214,.28);border-radius:20px}',
    '.review-item h2{font-size:1.2rem;margin:0 0 .3rem}',
    '.review-item code{color:#75dce3;font-size:.8rem}',
    '.review-summary{margin:0 0 16px;color:#a8c1c8;font-size:.9rem}',
    '.review-text{white-space:pre-wrap;padding:12px;border-radius:12px;background:#071f26;color:#cfe2e6;font-size:.8rem}',
    '.review-sources{color:#a8c1c8;font-size:.78rem}',
    '.checklist{margin:0 0 40px;padding:20px;border:1px solid rgba(159,205,214,.28);border-radius:20px;background:#071f26}',
    '.checklist li{margin:.3rem 0}',
    'nav a{color:#75dce3;margin-right:12px;font-size:.85rem}',
    css,
    '</style>',
    '<h1>CRRT universal circuit — every overlay</h1>',
    `<p>Rendered offline from the checked-in component and stylesheet. Flows: the authored worked example (${escapeHtml(crrtWorkedLedgerExample.title)}).</p>`,
    `<nav>${crrtCircuitOverlays.map((overlay) => `<a href="#${escapeHtml(overlay.id)}">${escapeHtml(overlay.label)}</a>`).join('')}</nav>`,
    '<section class="checklist"><h2>Review checklist</h2><ul>',
    REVIEW_CHECKLIST.map((line) => `<li>${escapeHtml(line)}</li>`).join(''),
    '</ul></section>',
    sections.join('\n'),
  ].join('\n')

  const outputDir = join(process.cwd(), 'node_modules', '.cache', 'baxter-crrt')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'circuit-overlays.html')
  writeFileSync(outputPath, page, 'utf8')

  console.log(`Rendered ${crrtCircuitOverlays.length} overlays.`)
  console.log(`Wrote ${outputPath}`)
}

void main()
