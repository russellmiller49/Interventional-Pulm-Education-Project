/**
 * One review page carrying every staged-prescription state and the whole citrate comparison.
 *
 * The CRRT routes are behind a login, so neither curl nor the browser can reach the real surface.
 * This renders the components themselves, offline, with the real checked-in stylesheets inlined
 * verbatim — the CSS-module shim maps class names through unchanged, so the source selectors match
 * the rendered markup.
 *
 * Nothing is added to package.json. Run it directly from the repo root:
 *
 *   npx tsx scripts/baxter-crrt/render-crrt-prescription-citrate.ts
 *
 * Two viewports are emitted side by side — a standard laptop column and a narrow column — because
 * the failures this page exists to catch (clipped controls, nested scrolling, hidden step
 * navigation, colliding labels) only appear at one width or the other.
 *
 * Writes node_modules/.cache/baxter-crrt/prescription-citrate.html and prints the path.
 */
import './css-module-shim'
import './i18n-navigation-shim'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LAPTOP_WIDTH_PX = 1280
const NARROW_WIDTH_PX = 720

const REVIEW_CHECKLIST: readonly string[] = [
  'The three steps appear in the order Goals, Construction, Predicted consequences, and the current one is named in words as well as marked.',
  'No control is clipped at either width, and no panel scrolls inside another scrolling panel.',
  'The step rail stays visible and reachable at the narrow width; it does not collapse into something unreachable.',
  'Every construction group states why it is asked at that point.',
  'In the downtime state, prescribed and delivered intensity are two visibly different numbers, and the prescribed figure is unchanged from the running state.',
  'In the unresolved-makeup state the ledger rows read as withheld, no conservation check reports "Balances", and no volume is attributed to patient loss.',
  'No stale consequence value survives a change: the resolved and the higher-dialysate states share no effluent figure.',
  'Nothing reads as a target, a normal range, an alarm limit, or a recommended set of flows.',
  'No value renders as undefined, NaN, Infinity, or an empty cell.',
  'Selected goals, the current step, and the open citrate question are all distinguishable without colour — check the border weight and the written state text.',
  'Every citrate row is tagged in words as either following from the circuit or an open question.',
  'All four citrate categories are named in the always-visible summary, not only inside the open panel.',
  'No evidence-record id or implementation id appears as primary learner copy.',
]

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function main(): Promise<void> {
  // Dynamic imports: the shim above must be installed before any component module resolves.
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { CrrtStagedPrescriptionBuilder } =
    await import('../../src/features/baxter-crrt/components/CrrtStagedPrescriptionBuilder')
  const { CrrtCitrateDifferential } =
    await import('../../src/features/baxter-crrt/components/CrrtCitrateDifferential')
  const { BaxterCrrtLearnLanding } =
    await import('../../src/features/baxter-crrt/components/BaxterCrrtLearnLanding')
  const { CRRT_STARTING_CONSTRUCTION, calculateCrrtPredictedConsequences, crrtPrescriptionStages } =
    await import('../../src/features/baxter-crrt/stagedPrescriptionModel')
  const { crrtCitrateDifferentialCategories } =
    await import('../../src/features/baxter-crrt/content/citrateDifferential')
  const { criticalCareLearningPathway } =
    await import('../../src/features/critical-care/content/learningPathways')

  const componentDirectory = join(process.cwd(), 'src/features/baxter-crrt/components')
  const css = [
    'crrt-staged-prescription-builder.module.css',
    'crrt-citrate-differential.module.css',
    'crrt-pilot-circuit.module.css',
  ]
    .map((file) => readFileSync(join(componentDirectory, file), 'utf8'))
    .join('\n')

  type Section = {
    readonly id: string
    readonly title: string
    readonly note: string
    readonly markup: string
  }
  const sections: Section[] = []

  /* ---------------- pathway front door ---------------- */

  const pathway = criticalCareLearningPathway('baxter-crrt')
  sections.push({
    id: 'front-door',
    title: 'Pathway front door',
    note: 'The order a novice meets, plus what the page says is assumed and what finishing it does not settle.',
    markup: renderToStaticMarkup(createElement(BaxterCrrtLearnLanding)),
  })

  /* ---------------- the three steps ---------------- */

  // Server rendering shows the initial stage only, so the three steps are rendered as three
  // separate mounts driven by the model rather than by simulated clicks.
  for (const stage of crrtPrescriptionStages) {
    sections.push({
      id: `stage-${stage.id}`,
      title: `Step ${stage.ordinal} — ${stage.shortTitle}`,
      note: stage.question,
      markup: renderToStaticMarkup(
        createElement(CrrtStagedPrescriptionBuilder, { initialStageId: stage.id }),
      ),
    })
  }

  /* ---------------- consequence states ---------------- */

  const consequenceStates = [
    {
      id: 'resolved',
      title: 'Predicted consequences — a normal resolved prescription',
      note: 'The authored starting construction: a large effluent beside a small patient loss, every millilitre attributable.',
      overrides: {},
    },
    {
      id: 'downtime',
      title: 'Predicted consequences — six hours lost from a twenty-four hour window',
      note: 'The prescription is unchanged. Prescribed and delivered intensity must be two different numbers here.',
      overrides: { downtimeHours: 6 },
    },
    {
      id: 'more-dialysate',
      title: 'Predicted consequences — dialysate doubled',
      note: 'Clearance intensity moves and net patient removal does not. No figure from the resolved state above may survive here.',
      overrides: { dialysateMlPerHour: 2_000 },
    },
    {
      id: 'unresolved-makeup',
      title: 'Predicted consequences — a non-zero makeup flow',
      note: 'The registered sources disagree about where that volume belongs, so every dependent quantity is withheld rather than guessed.',
      overrides: { makeupMlPerHour: 40 },
    },
  ] as const

  for (const state of consequenceStates) {
    sections.push({
      id: `consequences-${state.id}`,
      title: state.title,
      note: state.note,
      markup: renderToStaticMarkup(
        createElement(CrrtStagedPrescriptionBuilder, {
          initialStageId: 'predicted-consequences' as const,
          initialConstruction: { ...CRRT_STARTING_CONSTRUCTION, ...state.overrides },
        }),
      ),
    })
  }

  /* ---------------- citrate ---------------- */

  for (const category of crrtCitrateDifferentialCategories) {
    sections.push({
      id: `citrate-${category.id}`,
      title: `Citrate question ${category.ordinal} — ${category.name}`,
      note: category.clinicalQuestion,
      markup: renderToStaticMarkup(
        createElement(CrrtCitrateDifferential, { initialCategoryId: category.id }),
      ),
    })
  }

  /* ---------------- numeric cross-check printed on the page ---------------- */

  const numericRows = consequenceStates.map((state) => {
    const consequences = calculateCrrtPredictedConsequences({
      ...CRRT_STARTING_CONSTRUCTION,
      ...state.overrides,
    })
    const withheld = (value: number | null) => (value === null ? 'WITHHELD' : value.toFixed(1))
    return [
      state.id,
      consequences.ledger.totalEffluentMlHour.toFixed(1),
      withheld(consequences.ledger.machinePatientFluidRemovalMlHour),
      consequences.intensity.prescribedDoseMlPerKgHour.toFixed(2),
      consequences.intensity.deliveredDoseMlPerKgHour.toFixed(2),
      consequences.resolution,
    ]
  })

  const nonFinite = numericRows.flatMap((row) =>
    row.filter((cell) => /NaN|Infinity|undefined|null/i.test(cell)),
  )

  const page = [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>CRRT staged prescription and citrate — review</title>',
    '<style>',
    'body{margin:0;padding:24px;background:#04141a;color:#e8f4f6;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}',
    'h1{font-size:1.6rem;margin:0 0 .4rem}',
    '.review-item{margin:0 0 48px;padding:20px;border:1px solid rgba(159,205,214,.28);border-radius:20px}',
    '.review-item h2{font-size:1.15rem;margin:0 0 .3rem}',
    '.review-item code{color:#75dce3;font-size:.8rem}',
    '.review-summary{margin:0 0 16px;color:#a8c1c8;font-size:.9rem}',
    '.viewports{display:grid;gap:20px;grid-template-columns:minmax(0,1fr)}',
    '@media (min-width: 1500px){.viewports{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}',
    '.viewport{min-width:0;border:1px dashed rgba(159,205,214,.3);border-radius:14px;padding:10px;overflow-x:auto}',
    '.viewport > .frame{margin:0 auto}',
    `.viewport[data-width="laptop"] > .frame{width:${LAPTOP_WIDTH_PX}px;max-width:100%}`,
    `.viewport[data-width="narrow"] > .frame{width:${NARROW_WIDTH_PX}px;max-width:100%}`,
    '.viewport h3{margin:0 0 8px;font-size:.8rem;color:#75dce3;text-transform:uppercase;letter-spacing:.08em}',
    '.checklist{margin:0 0 40px;padding:20px;border:1px solid rgba(159,205,214,.28);border-radius:20px;background:#071f26}',
    '.checklist li{margin:.3rem 0}',
    'nav a{color:#75dce3;margin-right:12px;font-size:.85rem}',
    'table{border-collapse:collapse;width:100%;font-size:.82rem}',
    'th,td{border:1px solid rgba(159,205,214,.3);padding:6px 10px;text-align:left}',
    'th{color:#75dce3}',
    css,
    '</style>',
    '<h1>CRRT staged prescription and citrate — review</h1>',
    `<p>Rendered offline from the checked-in components and stylesheets, at a ${LAPTOP_WIDTH_PX}px laptop column and a ${NARROW_WIDTH_PX}px narrow column. Pathway order: ${escapeHtml(
      pathway.sections.map((section) => section.shortTitle).join(' → '),
    )}.</p>`,
    `<nav>${sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`).join('')}</nav>`,
    '<section class="checklist"><h2>Review checklist</h2><ul>',
    REVIEW_CHECKLIST.map((line) => `<li>${escapeHtml(line)}</li>`).join(''),
    '</ul>',
    '<h2>Numeric cross-check</h2>',
    '<table><thead><tr><th>state</th><th>total effluent mL/h</th><th>machine removal mL/h</th><th>prescribed mL/kg/h</th><th>delivered mL/kg/h</th><th>resolution</th></tr></thead><tbody>',
    numericRows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join(''),
    '</tbody></table>',
    `<p>${nonFinite.length === 0 ? 'No undefined, NaN, or non-finite cell in the table above.' : `NON-FINITE CELLS: ${escapeHtml(nonFinite.join(', '))}`}</p>`,
    '</section>',
    sections
      .map((section) =>
        [
          `<section class="review-item" id="${escapeHtml(section.id)}">`,
          `<h2>${escapeHtml(section.title)}</h2>`,
          `<p class="review-summary">${escapeHtml(section.note)}</p>`,
          '<div class="viewports">',
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
  const outputPath = join(outputDir, 'prescription-citrate.html')
  writeFileSync(outputPath, page, 'utf8')

  console.log(
    `Rendered ${sections.length} states: front door, ${crrtPrescriptionStages.length} steps, ${consequenceStates.length} consequence states, ${crrtCitrateDifferentialCategories.length} citrate questions.`,
  )
  for (const row of numericRows) {
    console.log(
      `  ${row[0].padEnd(18)} effluent ${row[1].padStart(8)}  removal ${row[2].padStart(8)}  presc ${row[3].padStart(6)}  deliv ${row[4].padStart(6)}  ${row[5]}`,
    )
  }
  if (nonFinite.length > 0) {
    console.error(`Non-finite values printed: ${nonFinite.join(', ')}`)
    process.exitCode = 1
  }
  console.log(`Wrote ${outputPath}`)
}

void main()
