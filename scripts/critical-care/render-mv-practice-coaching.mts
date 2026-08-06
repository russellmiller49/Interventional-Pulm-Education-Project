/**
 * Offline visual harness for the Practice post-action coaching block (package D3).
 *
 * The Practice route itself is reachable in a browser — mechanical ventilation is public-unlisted —
 * and the layout geometry in the D3 review was measured there. What a browser run cannot give
 * cheaply is every response branch: a branch is a function of the attempt number, so reaching
 * MV-08's leak version or MV-13's tube version through the interface means finishing the case
 * several times over. This renders each of them directly from the engine.
 *
 * Twelve runs: the four response shapes, every MV-13 branch with the treatment that reaches it and
 * one that does not, decompression followed by definitive drainage as a real sequence, and the
 * neuromuscular-blockade copy. Each action is watched to its own observation point, so the renders
 * follow the authored latencies rather than a number picked here.
 *
 * Every block is framed at the geometry the browser reported for the task drawer at that viewport —
 * 448px wide at all four, and the pane height the shell actually gave it:
 *
 *   1600x900  448 x 606      1280x720  448 x 510
 *   1440x900  448 x 606      1024x768  448 x 558
 *
 * The frame is `overflow: hidden` with a hard border, so anything wider than the pane is visible as
 * an overflow rather than hidden behind a scrollbar, and the pane's own scroll is drawn as the
 * dashed continuation rule at the bottom edge.
 *
 * package.json is locked for this round, so run it directly:
 *
 *   npx esbuild scripts/critical-care/render-mv-practice-coaching.mts --bundle --platform=node \
 *     --format=cjs --log-level=error --loader:.module.css=local-css \
 *     --outfile=node_modules/.cache/mv-console/practice-coaching.cjs \
 *     && node node_modules/.cache/mv-console/practice-coaching.cjs
 *
 * Output: public/mv-console-preview/practice-coaching.html, served through the `trainer-prod-static`
 * launch config on :8099. The output directory is gitignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PostActionCoachingPanel } from '../../src/features/mechanical-ventilation/components/PostActionCoachingPanel.tsx'
/*
 * The block reads every one of its colours from the token set `.workflowPanel` declares, so it has
 * to be rendered inside one. A first pass framed the panel bare and produced a block of pale text on
 * white — not a defect in the component, but a defect in the harness, and one that would have made
 * the whole review meaningless.
 */
import moduleStyles from '../../src/features/mechanical-ventilation/components/mechanical-ventilation.module.css'
import { mechanicalVentilationCaseById } from '../../src/features/mechanical-ventilation/content/runtimeCases.ts'
import {
  capturePostActionBaseline,
  postActionObservation,
  ventilationPostActionCoaching,
  type PostActionCoaching,
} from '../../src/features/mechanical-ventilation/content/postActionCoaching.ts'
import {
  advanceSimulation,
  applyIntervention,
  createInitialSimulationState,
} from '../../src/features/mechanical-ventilation/engine/simulation.ts'
import { ventilationSimulationReducer } from '../../src/features/mechanical-ventilation/engine/reducer.ts'
import type {
  VentilationCaseDefinition,
  VentilationSimulationState,
} from '../../src/features/mechanical-ventilation/engine/types.ts'

/** The measured task-drawer geometry, per review viewport. Width is constant; height is not. */
const VIEWPORTS = [
  { label: '1600 × 900', paneWidth: 448, paneHeight: 606 },
  { label: '1440 × 900', paneWidth: 448, paneHeight: 606 },
  { label: '1280 × 720', paneWidth: 448, paneHeight: 510 },
  { label: '1024 × 768', paneWidth: 448, paneHeight: 558 },
] as const

interface Run {
  readonly title: string
  readonly note: string
  readonly caseId: string
  readonly branch: string
  readonly actions: readonly string[]
  readonly settleSeconds: number
}

const RUNS: readonly Run[] = [
  {
    title: 'Successful — the action addressed what this patient had',
    note: 'MV-08, the version with water at the flow sensor, drained after inspection.',
    caseId: 'MV-08',
    branch: 'condensate',
    actions: ['inspect-circuit', 'drain-condensate'],
    settleSeconds: 40,
  },
  {
    title: 'Ineffective — the same action on the version it does not fit',
    note: 'MV-08, the version with a circuit leak. Nothing about the trigger changes.',
    caseId: 'MV-08',
    branch: 'leak',
    actions: ['inspect-circuit', 'drain-condensate'],
    settleSeconds: 40,
  },
  {
    title: 'Harmful — effort suppressed, mechanism untouched',
    note: 'MV-15. The safety interruption is raised immediately, above this block.',
    caseId: 'MV-15',
    branch: 'pain-bladder-delirium',
    actions: ['deepen-sedation'],
    settleSeconds: 90,
  },
  {
    title: 'Safety-interrupted — a rescue that works, with an interruption still open',
    note: 'MV-14. Every reading improves and the interruption still takes precedence.',
    caseId: 'MV-14',
    branch: 'unstable',
    actions: ['decompress-pneumothorax'],
    settleSeconds: 40,
  },
  {
    title: 'Definitive drainage — judged on the mechanics, not the blood pressure',
    note: 'MV-14, the decompression watched to its own observation point first. The blood pressure was rescued by the action before this one, so it is not the reading that answers whether the drainage responded.',
    caseId: 'MV-14',
    branch: 'unstable',
    actions: ['decompress-pneumothorax', 'pleural-drainage'],
    settleSeconds: 40,
  },
  {
    title: 'MV-13 secretions — suction reaches it',
    note: 'The treatment that matches this version of the patient.',
    caseId: 'MV-13',
    branch: 'secretions',
    actions: ['suction-airway'],
    settleSeconds: 40,
  },
  {
    title: 'MV-13 secretions — a bronchodilator does not',
    note: 'Nothing this relaxes is what is in the way here, and the block declines to credit it.',
    caseId: 'MV-13',
    branch: 'secretions',
    actions: ['bronchodilator'],
    settleSeconds: 40,
  },
  {
    title: 'MV-13 tube or filter — taking the obstruction out of the path reaches it',
    note: 'The apparatus version, with the inspection its removal requires.',
    caseId: 'MV-13',
    branch: 'hme-or-ett',
    actions: ['inspect-circuit', 'remove-hme'],
    settleSeconds: 40,
  },
  {
    title: 'MV-13 tube or filter — suction does not',
    note: 'A suction catheter removes material from a lumen that has none to remove.',
    caseId: 'MV-13',
    branch: 'hme-or-ett',
    actions: ['suction-airway'],
    settleSeconds: 40,
  },
  {
    title: 'MV-13 bronchospasm — a bronchodilator reaches it',
    note: 'The airway-wall version, treated over its authored five minutes.',
    caseId: 'MV-13',
    branch: 'bronchospasm',
    actions: ['bronchodilator'],
    settleSeconds: 40,
  },
  {
    title: 'MV-13 bronchospasm — correcting the tube does not',
    note: 'The narrowing is in the airway walls, so the apparatus has nothing to give back.',
    caseId: 'MV-13',
    branch: 'bronchospasm',
    actions: ['inspect-circuit', 'reposition-ett'],
    settleSeconds: 40,
  },
  {
    title: 'Neuromuscular blockade — the plateau wording, and the indication boundary',
    note: 'The reassessment names the condition under which the split can be repeated, and says plainly that blockade is not a way of obtaining one.',
    caseId: 'MV-03',
    branch: 'short-machine-ti',
    actions: ['neuromuscular-blockade'],
    settleSeconds: 60,
  },
] as const

function definitionFor(caseId: string): VentilationCaseDefinition {
  const definition = mechanicalVentilationCaseById.get(caseId)
  if (!definition) throw new Error(`Unknown case ${caseId}`)
  return definition
}

function attemptForBranch(caseId: string, branch: string): number {
  for (let attempt = 1; attempt <= 64; attempt += 1) {
    if (createInitialSimulationState(caseId, 'practice', attempt).branch === branch) return attempt
  }
  throw new Error(`No Practice attempt selects ${caseId}:${branch}`)
}

function coachingFor(run: Run): PostActionCoaching {
  const definition = definitionFor(run.caseId)
  const initial = createInitialSimulationState(
    run.caseId,
    'practice',
    attemptForBranch(run.caseId, run.branch),
  )
  let state: VentilationSimulationState = advanceSimulation(
    ventilationSimulationReducer({ ...initial, paused: false }, {
      type: 'COMMIT_PREDICTION',
      mechanismId: definition.mechanismOptions[0].id,
      priorityId: definition.priorityOptions[0].id,
      responseId: definition.responseOptions[0].id,
    }),
    30,
    definition,
  )
  let baseline = null as ReturnType<typeof capturePostActionBaseline> | null
  /*
   * Each action is watched to its *own* observation point rather than for a fixed number of seconds,
   * so a change to an authored latency or to the trace window moves these renders with it. That also
   * makes the two-action runs real sequences: the decompression is watched to completion before the
   * drainage is performed, which is the whole point of that pair.
   */
  for (const id of run.actions) {
    const before = state
    state = applyIntervention(state, definition, id)
    const record = state.interventions.at(-1)
    if (!record) throw new Error(`${run.caseId}: ${id} produced no record`)
    baseline = capturePostActionBaseline(before, definition, record)
    for (let guard = 0; !postActionObservation(state, baseline).complete && guard < 20000; guard += 1) {
      state = advanceSimulation(state, 0.1, definition)
    }
    state = advanceSimulation(state, run.settleSeconds, definition)
  }
  if (!baseline) throw new Error(`${run.caseId}: no action performed`)
  const observation = postActionObservation(state, baseline)
  if (!observation.complete) {
    throw new Error(
      `${run.caseId}: the observation interval has not completed (${observation.secondsRemaining.toFixed(1)}s remaining)`,
    )
  }
  const coaching = ventilationPostActionCoaching(state, definition, baseline)
  if (!coaching) throw new Error(`${run.caseId}: no coaching once the interval completed`)
  return coaching
}

const rendered = RUNS.map((run) => ({ run, coaching: coachingFor(run) }))

// esbuild emits the bundled CSS modules as a sibling of the JS bundle.
const css = readFileSync(__filename.replace(/\.cjs$/, '.css'), 'utf8')

const blocks = VIEWPORTS.map((viewport) => {
  const panels = rendered
    .map(({ run, coaching }) => {
      const markup = renderToStaticMarkup(
        createElement(
          'div',
          { className: moduleStyles.workflowPanel },
          createElement(PostActionCoachingPanel, { coaching }),
        ),
      )
      return `<section>
  <h3>${run.title}</h3>
  <p class="note">${run.note} <em>Verdict: ${coaching.verdictLabel}.</em></p>
  <div class="pane" style="width:${viewport.paneWidth}px;height:${viewport.paneHeight}px">
    <div class="paneInner">${markup}</div>
  </div>
</section>`
    })
    .join('\n')
  return `<article id="w${viewport.label.replace(/\D/g, '')}">
  <h2>${viewport.label} <small>task drawer ${viewport.paneWidth} × ${viewport.paneHeight}px</small></h2>
  ${panels}
</article>`
}).join('\n')

const nav = VIEWPORTS.map(
  (v) => `<a href="#w${v.label.replace(/\D/g, '')}">${v.label}</a>`,
).join('')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MV Practice post-action coaching — static render</title>
<style>
  body { margin: 0; padding: 2rem; background: #101c1f; color: #eaf8f7;
         font-family: ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
  p.lede { color: #9fc4c2; font-size: 0.85rem; margin: 0 0 1.5rem; max-width: 62rem; }
  h2 { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
       color: #79daca; margin: 3rem 0 0.5rem; }
  h2 small { color: #6d8c8f; font-weight: 500; letter-spacing: 0; text-transform: none; }
  h3 { font-size: 0.75rem; font-weight: 700; color: #eaf8f7; margin: 1.5rem 0 0.25rem; }
  p.note { color: #9fc4c2; font-size: 0.72rem; margin: 0 0 0.5rem; }
  article:first-of-type h2 { margin-top: 0; }
  article { display: grid; grid-template-columns: repeat(auto-fit, minmax(29rem, 1fr)); gap: 1.5rem; }
  article > h2 { grid-column: 1 / -1; }
  nav { display: flex; flex-wrap: wrap; gap: 0.9rem; margin-bottom: 1.5rem; }
  nav a { color: #79daca; font-size: 0.8rem; }
  /*
   * The pane the drawer actually gives this block. Hidden rather than scrolling, so content past the
   * right edge shows as an overflow and content past the bottom shows as the pane scroll it is.
   */
  .pane { position: relative; overflow: hidden; border: 1px dashed #3d5f63; border-radius: 0.5rem;
          background: #ffffff; }
  /* The app measures 448px of drawer against a 396px block: 52px of the shell's own horizontal
     chrome. Reproduced here so the harness frames the block at the width it really gets, which is
     the harder case. */
  .paneInner { padding: 0 26px; }
  /* The app gets this from the global utility layer; the harness has to restate it or the block's
     screen-reader-only "to" between the two values renders as visible text. */
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
             overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border-width: 0; }
  .pane::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
                 background: repeating-linear-gradient(90deg, #3d5f63 0 6px, transparent 6px 12px); }
</style>
<style>${css}</style>
</head>
<body>
<h1>Mechanical ventilation — Practice post-action coaching, static render</h1>
<p class="lede">
  Four response branches at the four review widths, each framed at the task drawer's measured
  geometry. The dashed border is the pane: anything crossing the right edge is a horizontal overflow,
  and the dashed rule at the bottom is where the pane's own scroll continues. The pane is the only
  scroll container — the block adds none of its own.
</p>
<nav>${nav}</nav>
${blocks}
</body>
</html>`

const outDir = join(process.cwd(), 'public', 'mv-console-preview')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, 'practice-coaching.html')
writeFileSync(file, page, 'utf8')
console.log(`wrote ${file}`)
for (const { run, coaching } of rendered) {
  console.log(
    `  ${run.caseId} ${run.title.split(' — ')[0].replace(/^MV-\d+ /, '').padEnd(34)} verdict=${coaching.verdict.padEnd(9)} readings=${coaching.observed.length} target=${(coaching.observed.find((r) => r.targeted)?.id ?? '—').padEnd(14)} stabilize=${coaching.stabilizationRequired}`,
  )
}
console.log(
  `rendered ${RUNS.length} branches × ${VIEWPORTS.length} widths = ${RUNS.length * VIEWPORTS.length} blocks`,
)
