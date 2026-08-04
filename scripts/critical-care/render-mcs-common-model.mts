/**
 * Offline visual harness for the MCS common model and the standardized pathway cards.
 *
 * The MCS routes are public-unlisted rather than login-gated, so they *can* be opened in a browser —
 * but the surfaces this package adds sit several screens down a long page, and a scripted scroll
 * followed by a screenshot renders blank in the preview pane. This harness puts each surface at the
 * top of its own page instead, so a screenshot at scroll position zero captures it.
 *
 * It also renders the card grid on one page, which is the review that matters most: the cards are
 * only comparable if the same rows line up across all eight of them, and that is a visual property
 * no unit test can check.
 *
 * package.json is a shared file during this parallel round, so there is no npm script. Run the two
 * commands from the repo root:
 *
 *   npx esbuild scripts/critical-care/render-mcs-common-model.mts --bundle --platform=node \
 *     --format=cjs --log-level=error --loader:.module.css=local-css \
 *     --outfile=node_modules/.cache/mcs/render.cjs
 *   node node_modules/.cache/mcs/render.cjs
 *
 * The `--loader:.module.css=local-css` flag is load-bearing: every MCS component imports the
 * module stylesheet, and without it the bundle either drops the styles or fails outright. esbuild
 * emits the collected CSS as a sibling of the JS bundle, which is why the file reads itself back
 * with the `.cjs` → `.css` rename below.
 *
 * Output: node_modules/.cache/mcs/preview/*.html — beside the esbuild bundle, inside a directory
 * git already ignores, so the harness adds nothing to the repository's ignore rules and leaves no
 * build product anywhere a reviewer has to think about. Point a static server at that directory to
 * look at the pages:
 *
 *   python3 -m http.server 8100 --directory node_modules/.cache/mcs/preview
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  McsCausalLadder,
  McsCommonModel,
  McsFlowAccount,
} from '../../src/features/mechanical-circulatory-support/components/McsCommonModel.tsx'
import { McsSupportPathwayCards } from '../../src/features/mechanical-circulatory-support/components/McsSupportPathwayCards.tsx'
import {
  createInitialMcsState,
  mcsReducer,
} from '../../src/features/mechanical-circulatory-support/engine/index.ts'
import type {
  McsAction,
  McsDeviceKind,
  McsSimulationState,
} from '../../src/features/mechanical-circulatory-support/engine/types.ts'

/** Settle the fixed-step solver so the live values in the model are not first-frame transients. */
function warmed(device: McsDeviceKind, actions: readonly McsAction[] = []): McsSimulationState {
  let state = createInitialMcsState('learn', device, null, 417)
  for (const action of actions) state = mcsReducer(state, action)
  for (let tick = 0; tick < 30; tick += 1) {
    state = mcsReducer(state, { type: 'TICK', seconds: 0.2 })
  }
  return state
}

// esbuild emits the bundled CSS modules as a sibling of the JS bundle.
const css = readFileSync(__filename.replace(/\.cjs$/, '.css'), 'utf8')

function page(title: string, body: string, shellWidth = '1580px'): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0; padding: 1.5rem; background: #eef3f2;
         font-family: ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
       color: #14847f; margin: 0 0 1rem; }
  .shell { width: min(100%, ${shellWidth}); margin: 0 auto; }
</style>
<style>${css}</style>
</head>
<body>
<h1>${title}</h1>
<div class="shell moduleShell">${body}</div>
</body>
</html>`
}

const outDir = join(process.cwd(), 'node_modules', '.cache', 'mcs', 'preview')
mkdirSync(outDir, { recursive: true })

const written: string[] = []
function write(name: string, html: string): void {
  const file = join(outDir, name)
  writeFileSync(file, html, 'utf8')
  written.push(file)
}

/*
 * One page per surface, so each can be captured at the top of the viewport, plus a live-value
 * comparison across the three device topologies — the point being that the flow account reads
 * differently for a pathway that moves no blood, one that adds a parallel stream, and one running
 * two serial pumps.
 */
write(
  'common-model.html',
  page(
    'MCS common model — full block, counterpulsation state',
    renderToStaticMarkup(createElement(McsCommonModel, { state: warmed('iabp') })),
  ),
)

write(
  'pathway-cards.html',
  page(
    'MCS standardized pathway cards — all eight, same fields, same order',
    renderToStaticMarkup(createElement(McsSupportPathwayCards, {})),
  ),
)

const topologies: readonly (readonly [string, McsSimulationState])[] = [
  ['Counterpulsation — no device flow to add', warmed('iabp')],
  [
    'Left-sided pump — one parallel stream',
    warmed('impella', [
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
    ]),
  ],
  [
    'Biventricular — two serial pumps, not summed',
    warmed('impella', [
      { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
      { type: 'SET_IMPELLA_CONTROL', side: 'right', control: 'performanceLevel', value: 7 },
      { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.36 },
    ]),
  ],
  ['Durable continuous flow', warmed('lvad')],
  [
    'Left-sided pump with blood returning to its source chamber',
    warmed('impella', [
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 8 },
      { type: 'SET_PATIENT_CONTROL', control: 'aorticInsufficiencySeverity', value: 0.6 },
    ]),
  ],
]

write(
  'flow-account-by-topology.html',
  page(
    'MCS flow account and causal ladder across pathway topologies',
    topologies
      .map(
        ([label, state]) =>
          `<section style="margin-bottom:2rem"><h2 style="font-size:0.8rem;letter-spacing:0.06em;text-transform:uppercase;color:#63777c">${label}</h2>${renderToStaticMarkup(
            createElement(McsFlowAccount, { state }),
          )}${renderToStaticMarkup(createElement(McsCausalLadder, { state }))}</section>`,
      )
      .join('\n'),
  ),
)

for (const file of written) console.log(`wrote ${file}`)
