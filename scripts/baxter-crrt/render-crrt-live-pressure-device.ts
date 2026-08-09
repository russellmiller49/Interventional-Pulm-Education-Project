/**
 * One review page carrying every engine state the live pressure profile can
 * reach, plus the states it cannot and why.
 *
 * The CRRT routes are behind a login, so neither curl nor the browser can reach
 * the real surface. This renders the components themselves, offline, with the
 * real checked-in stylesheets inlined verbatim — the CSS-module shim maps class
 * names through unchanged, so the source selectors match the rendered markup.
 *
 * Nothing is added to package.json. Run it directly from the repo root:
 *
 *   npx tsx scripts/baxter-crrt/render-crrt-live-pressure-device.ts
 *
 * Three viewports are emitted because the failures this page exists to catch —
 * clipped values, wrapped units, a selected state that stops being legible,
 * horizontal overflow — appear at one width and not another.
 *
 * Writes node_modules/.cache/baxter-crrt/live-pressure-device.html.
 * The harness exits non-zero on a nonfinite value or on any disagreement
 * between the engine and the adapter.
 */
import './css-module-shim'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WIDE_WIDTH_PX = 1600
const LAPTOP_WIDTH_PX = 1280
const NARROW_WIDTH_PX = 1024

const REVIEW_CHECKLIST: readonly string[] = [
  'Exactly four channels read "Directly modelled site" and exactly two read "Calculated relationship", in words, not by colour.',
  'TMP and filter pressure drop never claim a place on the circuit, and never get a marker of their own.',
  'Each calculated relationship names the sites it is built from.',
  'Selecting a channel marks its site on the circuit below, and every node keeps the same coordinates in every selection.',
  'When the pump is stopped the surface says so; the zero-flow reference values are not presented as treatment readings.',
  'When no pressure model is loaded every channel reads "Unavailable" with a stated reason — never a dash, never a zero.',
  'The recorded series is drawn only for the four channels the model actually samples; the other two say they are current values only.',
  'No value renders as undefined, NaN, Infinity, or an empty cell.',
  'No target, normal range, alarm limit, or corrective sequence appears anywhere.',
  'Nothing claims an exact screen layout, menu, button behaviour, or alarm appearance.',
  'No value or unit is clipped at any of the three widths, and no panel scrolls sideways inside another scrolling panel.',
  'Between the two blood-flow states, five channels move and effluent pressure does not — matching what the surface says about each.',
]

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function cell(value: number | null): string {
  return value === null ? 'unavailable' : value.toFixed(1)
}

async function main(): Promise<void> {
  // Dynamic imports: the shim above must be installed before any component
  // module is resolved, or the CSS import fails first.
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { CrrtLivePressureDevice } =
    await import('../../src/features/baxter-crrt/components/CrrtLivePressureDevice')
  const { CrrtPilotCircuit } =
    await import('../../src/features/baxter-crrt/components/CrrtPilotCircuit')
  const { createInitialPrismaxPilotInterfaceState, selectPrismaxPilotCaseOperationsDisplay } =
    await import('../../src/features/baxter-crrt/engine/deviceAdapters/prismax')
  const { crrtLivePressureReviewStates, crrtLivePressureModelBoundaries } =
    await import('../../src/features/baxter-crrt/engine/testSupport/livePressureStates')
  const { crrtPressureSignalIds } =
    await import('../../src/features/baxter-crrt/content/circuitModel')

  const componentDir = join(process.cwd(), 'src/features/baxter-crrt/components')
  const css = [
    readFileSync(join(componentDir, 'crrt-live-pressure-device.module.css'), 'utf8'),
    readFileSync(join(componentDir, 'crrt-live-pressure-station.module.css'), 'utf8'),
    readFileSync(join(componentDir, 'crrt-pilot-circuit.module.css'), 'utf8'),
  ].join('\n')

  const ui = createInitialPrismaxPilotInterfaceState()
  const reviewStates = crrtLivePressureReviewStates()

  const problems: string[] = []
  const numericRows: string[][] = []

  const sections = reviewStates.flatMap((review) => {
    const operations = selectPrismaxPilotCaseOperationsDisplay(ui, review.state)
    const engine = review.state.circuit.pressures
    const context = operations.treatmentContext

    // The gate: the adapter must publish exactly what the engine holds.
    const enginePairs: readonly (readonly [string, number | null, number | null])[] = [
      ['access', engine.accessPressureMmHg, operations.pressures.accessPressureMmHg],
      ['filter', engine.filterPressureMmHg, operations.pressures.filterPressureMmHg],
      ['return', engine.returnPressureMmHg, operations.pressures.returnPressureMmHg],
      ['effluent', engine.effluentPressureMmHg, operations.pressures.effluentPressureMmHg],
      [
        'tmp',
        engine.prismaxTransmembranePressureMmHg,
        operations.pressures.transmembranePressureMmHg,
      ],
      [
        'filter-drop',
        engine.prismaxFilterPressureDropMmHg,
        operations.pressures.filterPressureDropMmHg,
      ],
    ]
    const byId = new Map(operations.pressureSignals.map((signal) => [signal.id, signal]))
    for (const [id, engineValue, adapterValue] of enginePairs) {
      const signalValue = byId.get(id as never)?.valueMmHg ?? null
      if (engineValue !== adapterValue || engineValue !== signalValue) {
        problems.push(
          `${review.id}/${id}: engine ${String(engineValue)} vs adapter ${String(adapterValue)} vs described ${String(signalValue)}`,
        )
      }
      if (engineValue !== null && !Number.isFinite(engineValue)) {
        problems.push(`${review.id}/${id}: nonfinite engine value ${String(engineValue)}`)
      }
    }
    for (const signal of operations.pressureSignals) {
      if (signal.valueMmHg === null && signal.unavailableReason === null) {
        problems.push(`${review.id}/${signal.id}: unavailable with no stated reason`)
      }
      if (signal.kind === 'calculated-relationship' && signal.nodeId !== null) {
        problems.push(`${review.id}/${signal.id}: a calculated relationship claimed a circuit node`)
      }
      if (signal.kind === 'directly-modelled-site' && signal.nodeId === null) {
        problems.push(`${review.id}/${signal.id}: a modelled site has no circuit node`)
      }
      for (const sample of signal.history) {
        if (sample.valueMmHg !== null && !Number.isFinite(sample.valueMmHg)) {
          problems.push(`${review.id}/${signal.id}: nonfinite recorded point`)
        }
      }
    }

    numericRows.push([
      review.id,
      context.deliveryState,
      context.bloodFlowContributesToPressures ? 'yes' : 'no',
      context.modality ? context.modality.toUpperCase() : '—',
      String(context.bloodFlowMlMin ?? '—'),
      ...enginePairs.flatMap(([, engineValue, adapterValue]) => [
        cell(engineValue),
        cell(adapterValue),
      ]),
      operations.pressureSignals.map((signal) => (signal.history.length > 0 ? '1' : '0')).join(''),
    ])

    // Every channel selected once, so the review sees each site marked on the
    // circuit and each relationship refusing to claim one.
    return crrtPressureSignalIds.map((signalId) => {
      const markup = renderToStaticMarkup(
        createElement(
          CrrtLivePressureDevice,
          { operations, selectedSignalId: signalId, onSelectSignal: () => {} },
          createElement(CrrtPilotCircuit, {
            running: context.bloodFlowContributesToPressures,
            setReady: true,
            fluidsReady: true,
            bloodFlowMlMin: context.bloodFlowMlMin,
            dialysateFlowMlHour: context.dialysateFlowMlHour,
            patientFluidRemovalMlHour: context.patientFluidRemovalMlHour,
            flows: operations.flows,
            initialOverlayId: 'pressure-profile' as const,
            highlightedSignalId: signalId,
            pressure: {
              access: operations.pressures.accessPressureMmHg,
              filter: operations.pressures.filterPressureMmHg,
              return: operations.pressures.returnPressureMmHg,
              effluent: operations.pressures.effluentPressureMmHg,
              TMP: operations.pressures.transmembranePressureMmHg,
              filterDrop: operations.pressures.filterPressureDropMmHg,
            },
          }),
        ),
      )
      return {
        id: `${review.id}--${signalId}`,
        title: `${review.label} · ${signalId} selected`,
        note: review.focus,
        markup,
      }
    })
  })

  for (const section of sections) {
    if (/>\s*(undefined|NaN|Infinity)\s*</.test(section.markup)) {
      problems.push(`${section.id}: rendered undefined, NaN, or Infinity`)
    }
  }

  const page = [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>CRRT live pressure profile — review</title>',
    '<style>',
    'body{margin:0;padding:24px;background:#04141a;color:#e8f4f6;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}',
    'h1{font-size:1.6rem;margin:0 0 .4rem}',
    '.review-item{margin:0 0 48px;padding:20px;border:1px solid rgba(159,205,214,.28);border-radius:20px}',
    '.review-item h2{font-size:1.15rem;margin:0 0 .3rem}',
    '.review-summary{margin:0 0 16px;color:#a8c1c8;font-size:.9rem}',
    '.viewports{display:grid;gap:20px;grid-template-columns:minmax(0,1fr)}',
    '@media (min-width: 1700px){.viewports{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}',
    '.viewport{min-width:0;border:1px dashed rgba(159,205,214,.3);border-radius:14px;padding:10px;overflow-x:auto}',
    '.viewport > .frame{margin:0 auto}',
    `.viewport[data-width="wide"] > .frame{width:${WIDE_WIDTH_PX}px;max-width:100%}`,
    `.viewport[data-width="laptop"] > .frame{width:${LAPTOP_WIDTH_PX}px;max-width:100%}`,
    `.viewport[data-width="narrow"] > .frame{width:${NARROW_WIDTH_PX}px;max-width:100%}`,
    '.viewport h3{margin:0 0 8px;font-size:.8rem;color:#75dce3;text-transform:uppercase;letter-spacing:.08em}',
    '.checklist{margin:0 0 40px;padding:20px;border:1px solid rgba(159,205,214,.28);border-radius:20px;background:#071f26}',
    '.checklist li{margin:.3rem 0}',
    'nav a{color:#75dce3;margin-right:12px;font-size:.85rem}',
    'table{border-collapse:collapse;width:100%;font-size:.74rem}',
    'th,td{border:1px solid rgba(159,205,214,.3);padding:5px 7px;text-align:left}',
    'th{color:#75dce3}',
    '.boundaries li{margin:.4rem 0;color:#ffd7a8}',
    css,
    '</style>',
    '<h1>CRRT live pressure profile — review</h1>',
    `<p>Rendered offline from the checked-in components and stylesheets at ${WIDE_WIDTH_PX}px, ${LAPTOP_WIDTH_PX}px, and ${NARROW_WIDTH_PX}px. ${reviewStates.length} engine states × ${crrtPressureSignalIds.length} channel selections.</p>`,
    '<section class="checklist"><h2>Review checklist</h2><ul>',
    REVIEW_CHECKLIST.map((line) => `<li>${escapeHtml(line)}</li>`).join(''),
    '</ul>',
    '<h2>What this model cannot produce</h2><ul class="boundaries">',
    crrtLivePressureModelBoundaries.map((line) => `<li>${escapeHtml(line)}</li>`).join(''),
    '</ul>',
    '<h2>Engine versus adapter</h2>',
    '<table><thead><tr><th>state</th><th>delivery</th><th>Q acts</th><th>mode</th><th>Q</th>',
    ['access', 'filter', 'return', 'effluent', 'TMP', 'ΔP']
      .map((name) => `<th>${name} eng</th><th>${name} adp</th>`)
      .join(''),
    '<th>history</th></tr></thead><tbody>',
    numericRows
      .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
      .join(''),
    '</tbody></table>',
    '<p>History column is one digit per channel in the order access, filter, return, effluent, TMP, filter drop: 1 means the model kept a series, 0 means current value only.</p>',
    `<p>${problems.length === 0 ? 'Engine and adapter agree on every channel in every state, and no value is nonfinite.' : `PROBLEMS: ${escapeHtml(problems.join(' | '))}`}</p>`,
    '</section>',
    sections
      .map((section) =>
        [
          `<section class="review-item" id="${escapeHtml(section.id)}">`,
          `<h2>${escapeHtml(section.title)}</h2>`,
          `<p class="review-summary">${escapeHtml(section.note)}</p>`,
          '<div class="viewports">',
          `<div class="viewport" data-width="wide"><h3>Wide · ${WIDE_WIDTH_PX}px</h3><div class="frame">${section.markup}</div></div>`,
          `<div class="viewport" data-width="laptop"><h3>Laptop · ${LAPTOP_WIDTH_PX}px</h3><div class="frame">${section.markup}</div></div>`,
          `<div class="viewport" data-width="narrow"><h3>Narrow · ${NARROW_WIDTH_PX}px</h3><div class="frame">${section.markup}</div></div>`,
          '</div>',
          '</section>',
        ].join('\n'),
      )
      .join('\n'),
  ].join('\n')

  const outputDir = join(process.cwd(), 'node_modules', '.cache', 'baxter-crrt')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'live-pressure-device.html')
  writeFileSync(outputPath, page, 'utf8')

  console.log(
    `Rendered ${reviewStates.length} engine states x ${crrtPressureSignalIds.length} selections = ${sections.length} panels.`,
  )
  for (const row of numericRows) {
    console.log(
      `  ${row[0].padEnd(26)} ${row[1].padEnd(8)} Qacts=${row[2].padEnd(3)} Q=${row[4].padStart(4)}  ` +
        `access ${row[5].padStart(8)}  filter ${row[7].padStart(8)}  return ${row[9].padStart(8)}  ` +
        `effluent ${row[11].padStart(8)}  TMP ${row[13].padStart(8)}  dP ${row[15].padStart(8)}  hist ${row[17]}`,
    )
  }
  console.log('Model boundaries reported on the page:')
  for (const line of crrtLivePressureModelBoundaries) {
    console.log(`  - ${line.split('.')[0]}.`)
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`PROBLEM ${problem}`)
    process.exitCode = 1
  }
  console.log(`Wrote ${outputPath}`)
}

void main()
