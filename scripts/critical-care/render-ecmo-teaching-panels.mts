/**
 * Offline visual harness for every ECMO teaching panel — the ten foundation panels and all twenty
 * live drill panels (six frozen pilots plus fourteen B6 draft/non-credit panels).
 *
 * Same reason as the mechanical-ventilation harness: the Learn workspace sits behind login and
 * behind a viewport gate, so the panels cannot be screenshotted in the running app. This renders
 * every panel against the states its own lesson can actually produce — the reference circuits, the
 * post-action states, and the engine-backed teaching previews — so clipping, missing units,
 * duplicated content, overflowing tables and unreadable text are all visible in one page.
 *
 *   npm run render:ecmo-teaching
 *
 * Output: public/ecmo-teaching-preview/panels.html, served through the `trainer-prod-static`
 * launch config on :8099.
 *
 * The VV-only panels are deliberately never rendered against a VA circuit: their route cannot
 * produce that combination, and showing it here would review a state no learner can reach.
 *
 * The drill panels are rendered at compact, laptop, and wide pane widths. A table that reads well
 * at one can be unreadable at another, so the harness keeps all three states beside one another.
 *
 * Each drill is rendered both before and after a commitment, because the panels deliberately show
 * different content either side of it. A leak would appear here as mechanism text in a cell labelled
 * "before commitment".
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { EcmoFoundationTeachingPanel } from '../../src/features/cardiohelp-ecmo/components/teaching/EcmoFoundationTeachingPanel.tsx'
import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationVariant,
  ecmoInteractiveFoundationSectionIds,
  ecmoSharedFoundationSectionIds,
  ecmoVaOnlyFoundationSectionIds,
  ecmoVvOnlyFoundationSectionIds,
  isEcmoSharedFoundationSectionId,
  isEcmoVaOnlyFoundationSectionId,
  isEcmoVvOnlyFoundationSectionId,
  type EcmoInteractiveFoundationSectionId,
  type EcmoVaOnlyFoundationSectionId,
  type EcmoVvOnlyFoundationSectionId,
} from '../../src/features/cardiohelp-ecmo/content/foundationLessonRuntime.ts'
import type { EcmoReferenceProfileId } from '../../src/features/cardiohelp-ecmo/content/referenceProfiles.ts'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
  ecmoFoundationSnapshot,
  type EcmoFoundationSnapshot,
} from '../../src/features/cardiohelp-ecmo/session/foundationSession.ts'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../../src/features/cardiohelp-ecmo/engine/index.ts'
import type {
  EcmoSimulationState,
  SimulationAction,
} from '../../src/features/cardiohelp-ecmo/engine/types.ts'
import {
  EcmoDrillTeachingPanel,
  ecmoDrillPanelMetadata,
  ecmoDrillTeachingPanelScenarioIds,
} from '../../src/features/cardiohelp-ecmo/components/teaching/EcmoDrillTeachingPanel.tsx'
import { faultState } from '../../src/features/cardiohelp-ecmo/components/teaching/drills/DraftDrillPanel.tsx'
import { requireEcmoLearnPrediction } from '../../src/features/cardiohelp-ecmo/content/learnPredictionItems.ts'
import { cardiohelpScenarioById } from '../../src/features/cardiohelp-ecmo/content/scenarios.ts'

function advance(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let current = state
  for (let tick = 0; tick < seconds; tick += 1) {
    current = ecmoSimulationReducer(current, { type: 'STEP' })
  }
  return current
}

function settled(
  profileId: EcmoReferenceProfileId,
  action?: SimulationAction,
): EcmoSimulationState {
  let state = advance(createReferenceSimulationState(profileId), 8)
  if (action) state = advance(ecmoSimulationReducer(state, action), 12)
  return state
}

interface Variant {
  readonly label: string
  readonly state: EcmoSimulationState
  readonly snapshot?: EcmoFoundationSnapshot | null
}

function sharedVariants(profileId: EcmoReferenceProfileId): readonly Variant[] {
  const reference = settled(profileId)
  return [
    { label: `${profileId} · reference`, state: reference },
    {
      label: `${profileId} · after +200 rpm`,
      state: settled(profileId, { type: 'SET_RPM', rpm: reference.device.rpmSetpoint + 200 }),
    },
    {
      label: `${profileId} · after +1 L/min sweep`,
      state: settled(profileId, { type: 'SET_SWEEP', sweep: reference.gas.sweepLpm + 1 }),
    },
  ]
}

/**
 * The state a named variant of a lesson produces, reached the way the activity reaches it: through
 * the session reducer's one atomic restore. Rendering the reducer's own output is what makes this
 * page a review of the lesson rather than of a hand-built state.
 */
function variantState(
  sectionId: EcmoInteractiveFoundationSectionId,
  variantId: string,
  from?: EcmoSimulationState,
): EcmoSimulationState {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const mode = runtime.supportMode ?? 'vv'
  const variant = ecmoFoundationVariant(runtime, mode, variantId)
  if (!variant) throw new Error(`${sectionId}: no variant ${variantId}`)
  const opening = createEcmoFoundationSessionState(variant)
  const session = from
    ? ecmoFoundationSessionReducer(
        { ...opening, simulation: from },
        ecmoFoundationRestoreAction(variant),
      )
    : opening
  return session.simulation
}

function vvOnlyVariants(sectionId: EcmoVvOnlyFoundationSectionId): readonly Variant[] {
  if (sectionId === 'vv-series-physiology') {
    const reference = variantState(sectionId, 'reference-circuit')
    return [
      { label: 'VV reference — recognize and predict', state: advance(reference, 8) },
      {
        label: 'recirculation preview, settled — act and observe',
        state: variantState(sectionId, 'recirculation-preview'),
      },
      {
        label: 'transfer — preview reloaded cleanly from the reference',
        state: variantState(sectionId, 'recirculation-preview', advance(reference, 30)),
      },
    ]
  }

  if (sectionId === 'vv-normal-state') {
    const opening = variantState(sectionId, 'reference-circuit')
    const snapshot = ecmoFoundationSnapshot(opening)
    return [
      { label: 'reference at the captured snapshot', state: opening, snapshot },
      {
        label: 'after 20 modeled seconds, compared with the snapshot',
        state: advance(opening, 20),
        snapshot,
      },
      {
        label: 'transfer and narrative — compared with the retained samples',
        state: advance(opening, 40),
      },
    ]
  }

  return [
    {
      label: 'gas-source case before the change — recognize and predict',
      state: variantState(sectionId, 'gas-source-before-change'),
    },
    {
      label: 'gas-source case after the change — observe',
      state: variantState(sectionId, 'gas-source-after-change'),
    },
    {
      label: 'membrane-resistance mechanism preview — explain',
      state: variantState(sectionId, 'oxygenator-resistance-preview'),
    },
    {
      label: 'recirculation preview — transfer',
      state: variantState(sectionId, 'recirculation-preview'),
    },
  ]
}

function vaOnlyVariants(sectionId: EcmoVaOnlyFoundationSectionId): readonly Variant[] {
  if (sectionId === 'va-parallel-physiology') {
    return [
      {
        label: 'VA reference — recognize and predict',
        state: variantState(sectionId, 'reference-circuit'),
      },
      {
        label: 'differential-oxygenation preview, settled — act and observe',
        state: variantState(sectionId, 'differential-hypoxemia-preview'),
      },
      {
        label: 'loading preview, settled — observe and transfer',
        state: variantState(sectionId, 'lv-loading-preview'),
      },
    ]
  }

  if (sectionId === 'va-normal-state') {
    const opening = variantState(sectionId, 'reference-circuit')
    const snapshot = ecmoFoundationSnapshot(opening)
    return [
      { label: 'VA reference at the captured snapshot', state: opening, snapshot },
      {
        label: 'after 20 modeled seconds, compared with the snapshot',
        state: advance(opening, 20),
        snapshot,
      },
      {
        label: 'transfer and narrative — compared with the retained samples',
        state: advance(opening, 40),
      },
    ]
  }

  return [
    {
      label: 'the case as it stands — recognize and predict',
      state: variantState(sectionId, 'mixed-circulation-case'),
    },
    {
      label: 'loading mechanism preview — act and observe',
      state: variantState(sectionId, 'lv-loading-preview'),
    },
    {
      label: 'membrane-resistance mechanism preview — explain',
      state: variantState(sectionId, 'va-oxygenator-resistance-preview'),
    },
    {
      label: 'gas case before its change, held — explain',
      state: variantState(sectionId, 'va-gas-source-before-change'),
    },
    {
      label: 'gas case evolved — transfer',
      state: variantState(sectionId, 'va-gas-source-after-change'),
    },
  ]
}

const profiles: readonly EcmoReferenceProfileId[] = ['vv-reference', 'va-reference']

/**
 * Section → the states it is rendered against, dispatched on which track-scope the section belongs
 * to.
 *
 * Exhaustive on purpose. The previous shape asked one question — "is this shared?" — and sent
 * everything else down the VV branch, so a VA section added to the canonical list would have been
 * handed VV-only variant ids and thrown on the first one that did not exist. Narrowing through the
 * three guards means an unclassified section is a loud failure naming itself rather than a puzzling
 * missing-variant error, and the compiler rejects a section that belongs to no scope.
 */
function variantsFor(sectionId: EcmoInteractiveFoundationSectionId): readonly Variant[] {
  if (isEcmoSharedFoundationSectionId(sectionId)) {
    return profiles.flatMap((profileId) => sharedVariants(profileId))
  }
  if (isEcmoVvOnlyFoundationSectionId(sectionId)) return vvOnlyVariants(sectionId)
  if (isEcmoVaOnlyFoundationSectionId(sectionId)) return vaOnlyVariants(sectionId)
  throw new Error(
    `${sectionId} is in the interactive section list but belongs to no track scope, so this harness does not know which states to render it against.`,
  )
}

function scopeLabel(sectionId: EcmoInteractiveFoundationSectionId): string {
  if (isEcmoVvOnlyFoundationSectionId(sectionId)) {
    return 'VV-only — never rendered against a VA circuit'
  }
  if (isEcmoVaOnlyFoundationSectionId(sectionId)) {
    return 'VA-only — never rendered against a VV circuit'
  }
  return 'shared by both tracks'
}

/* ------------------------------------------------------------------ *
 * All twenty live drill panels
 * ------------------------------------------------------------------ */

function drillState(scenarioId: string, seconds = 12): EcmoSimulationState {
  return advance(createInitialSimulationState(scenarioId, 'guided'), seconds)
}

/** Commits one of the authored options, so the withheld half of a panel can be reviewed. */
function commit(
  state: EcmoSimulationState,
  plausibility: 'best' | 'unsafe' = 'best',
): EcmoSimulationState {
  const prediction = requireEcmoLearnPrediction(state.scenario.scenarioId)
  const choice =
    prediction.item.choices.find((item) => item.plausibility === plausibility) ??
    prediction.item.choices[0]
  const commitment = prediction.commitments[choice.id]
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: commitment.goalId,
    control: commitment.control,
    direction: commitment.direction,
  })
}

interface DrillVariant {
  readonly label: string
  readonly state: EcmoSimulationState
}

function correctAuthoredCause(state: EcmoSimulationState): EcmoSimulationState {
  const definition = cardiohelpScenarioById.get(state.scenario.scenarioId)
  if (!definition) throw new Error(`No authored Learn scenario: ${state.scenario.scenarioId}`)

  const action: SimulationAction =
    definition.expectation.correctiveFault === 'gas-source-interruption'
      ? { type: 'RESTORE_GAS_SOURCE' }
      : definition.expectation.correctiveFault === 'ac-power-loss'
        ? { type: 'RESTORE_AC_POWER' }
        : { type: 'CORRECT_FAULT', fault: definition.expectation.correctiveFault }
  return advance(ecmoSimulationReducer(state, action), 8)
}

/** Reach unavailable pressure channels through the engine by stopping pump demand at zero RPM. */
function withUnavailablePressureChannels(state: EcmoSimulationState): EcmoSimulationState {
  return advance(ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 0 }), 1)
}

function bubbleCorrectionState(state: EcmoSimulationState): EcmoSimulationState {
  const isolated = ecmoSimulationReducer(
    ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: true,
    }),
    { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
  )
  return ecmoSimulationReducer(isolated, {
    type: 'CORRECT_FAULT',
    fault: 'arterial-bubble',
  })
}

function drillVariants(scenarioId: string): readonly DrillVariant[] {
  const preEvent = createInitialSimulationState(scenarioId, 'guided')
  const definition = cardiohelpScenarioById.get(scenarioId)
  if (!definition) throw new Error(`No authored Learn scenario: ${scenarioId}`)
  const active = drillState(scenarioId)
  const committed = commit(active)
  const corrected = scenarioId.endsWith('arterial-bubble-stop')
    ? bubbleCorrectionState(committed)
    : correctAuthoredCause(committed)

  const variants: DrillVariant[] = [
    { label: 'active authored state — before commitment', state: active },
    { label: 'active authored state — after commitment', state: committed },
    { label: 'authored cause corrected — after commitment', state: corrected },
    {
      label: 'engine-reached pump stop; pressure channels unavailable — after commitment',
      state: withUnavailablePressureChannels(committed),
    },
  ]

  if (faultState(preEvent, definition.expectation.correctiveFault) === 'not active') {
    variants.unshift({
      label: 'true initial state — before the timed cause and before commitment',
      state: preEvent,
    })
  }

  // Retain two high-value pilot challenge frames in addition to the uniform four-state contract.
  if (scenarioId === 'preload-drainage-collapse') {
    variants.push({
      label: 'unsafe option committed — postcommit gate review',
      state: commit(active, 'unsafe'),
    })
  }
  if (scenarioId === 'vv-recirculation') {
    variants.push({
      label: 'speed escalated to 4400 rpm — postcommit live-pattern review',
      state: advance(ecmoSimulationReducer(committed, { type: 'SET_RPM', rpm: 4400 }), 8),
    })
  }
  return variants
}

/** Compact, laptop, and wide teaching-pane review widths. */
const PANE_WIDTHS: readonly { readonly label: string; readonly px: number }[] = [
  { label: 'compact teaching column', px: 480 },
  { label: 'laptop teaching column', px: 700 },
  { label: 'wide teaching column', px: 944 },
]

let renderedCells = 0
let renderedDrillCells = 0

const drills = ecmoDrillTeachingPanelScenarioIds
  .map((scenarioId) => {
    const metadata = ecmoDrillPanelMetadata(scenarioId)
    const columns = drillVariants(scenarioId)
      .map((variant) => {
        // Rendered once, placed at both widths: the markup is identical, only the box changes.
        const markup = renderToStaticMarkup(
          createElement(EcmoDrillTeachingPanel, { state: variant.state }),
        )
        renderedDrillCells += 1
        return PANE_WIDTHS.map(
          (width) =>
            `<div class="cell" style="width:${width.px}px"><p class="cell-label">${variant.label} · ${width.label} (${width.px}px)</p>${markup}</div>`,
        ).join('\n')
      })
      .join('\n')
    return `<section><h2>${scenarioId} <span class="scope">${metadata.reviewStatus} · ${metadata.creditEligible ? 'credit-eligible baseline' : 'non-credit draft'} · ${metadata.supportMode.toUpperCase()}</span></h2><div class="matrix matrix-drill">${columns}</div></section>`
  })
  .join('\n')

const sections = ecmoInteractiveFoundationSectionIds
  .map((sectionId) => {
    const columns = variantsFor(sectionId)
      .map((variant) => {
        renderedCells += 1
        const markup = renderToStaticMarkup(
          createElement(EcmoFoundationTeachingPanel, {
            sectionId,
            state: variant.state,
            snapshot: variant.snapshot ?? null,
          }),
        )
        return `<div class="cell"><p class="cell-label">${variant.label}</p>${markup}</div>`
      })
      .join('\n')
    return `<section><h2>${sectionId} <span class="scope">${scopeLabel(sectionId)}</span></h2><div class="matrix">${columns}</div></section>`
  })
  .join('\n')

const drillCount = ecmoDrillTeachingPanelScenarioIds.length
const foundationCount = ecmoInteractiveFoundationSectionIds.length

if (drillCount !== 20 || foundationCount !== 10) {
  throw new Error(
    `B6 render contract expected 20 drill and 10 foundation panels; found ${drillCount} and ${foundationCount}.`,
  )
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ECMO teaching panels — foundation and drill</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; background: #f6f7f9; color: #111; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; margin-top: 32px; padding-bottom: 4px; border-bottom: 2px solid #ddd; }
  h2 .scope { font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: .08em; color: #666; }
  .matrix { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; margin-top: 12px; }
  .cell { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 12px; overflow-x: auto; }
  .cell-label { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #666; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  table { border-collapse: collapse; }
  th, td { vertical-align: top; padding-right: 8px; }
  caption { text-align: left; }
  .overflow-x-auto { overflow-x: auto; }
  .grid { display: grid; }
  .rounded-2xl, .rounded-xl { border-radius: 12px; }
  .border { border: 1px solid #ddd; }
  .border-l-4 { border-left: 4px solid #bbb; }
  .border-dashed { border-style: dashed; }
  .p-4 { padding: 16px; } .p-3 { padding: 12px; }
  .px-3 { padding-left: 12px; padding-right: 12px; } .py-2 { padding-top: 8px; padding-bottom: 8px; }
  .text-muted-foreground { color: #666; }
  .font-semibold { font-weight: 600; } .font-medium { font-weight: 500; }
  .text-xs { font-size: 11px; } .text-sm { font-size: 13px; } .text-lg { font-size: 17px; }
  .text-2xl { font-size: 22px; } .text-xl { font-size: 19px; } .text-base { font-size: 15px; }
  .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: .05em; }
  .bg-muted, .bg-muted\\/30, .bg-muted\\/40 { background: #eee; }
  .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; } .mt-4 { margin-top: 16px; }
  .gap-1 { gap: 4px; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
  .h-2 { height: 8px; } .rounded-full { border-radius: 999px; }
  .bg-foreground\\/70 { background: #444; }
  .block { display: block; } .inline-block { display: inline-block; }
  .ml-1 { margin-left: 4px; }
  .py-1 { padding-top: 4px; padding-bottom: 4px; } .pb-1 { padding-bottom: 4px; }
  .pr-3 { padding-right: 12px; } .pt-3 { padding-top: 12px; }
  .align-top { vertical-align: top; } .align-bottom { vertical-align: bottom; }
  .flex { display: flex; } .flex-wrap { flex-wrap: wrap; } .flex-col { flex-direction: column; }
  .items-baseline { align-items: baseline; } .justify-between { justify-content: space-between; }
  .inline-flex { display: inline-flex; }
  .grid-cols-2 { grid-template-columns: 1fr 1fr; }
  .w-full { width: 100%; }
  .min-w-0 { min-width: 0; }
  .min-w-\\[64rem\\] { min-width: 64rem; }
  [data-reference-kind] { display: inline-block; border: 1px solid #999; border-radius: 999px; padding: 1px 8px; font-size: 10px; }
  [data-model-boundary], [data-cell-limitation] { background: #fffbe6; }
  [data-hypothesis-matrix] td, [data-hypothesis-matrix] th { border-bottom: 1px solid #eee; }
  .matrix-drill { display: flex; flex-wrap: wrap; align-items: flex-start; }
  .matrix-drill .cell { flex: 0 0 auto; }
  [data-withheld-until-commitment] { background: #f2f6ff; }
  [data-after-commitment] > * { border-left: 3px solid #94a3b8; }
  [data-signal-register] th, [data-signal-register] td { border-bottom: 1px solid #eee; padding-bottom: 6px; }
  [data-signal-kind='simulation-unmodeled'] [data-signal-value], [data-signal-kind='device-unavailable'] [data-signal-value] { color: #92400e; }
</style></head><body>
<h1>ECMO teaching panels — ${foundationCount} foundation sections and ${drillCount} drill panels</h1>
<p>Check for: clipping, unreadable text, duplicated narrative, missing units, pane overflow, table overflow, <code>--</code> readouts without an accessible reason, <code>[object Object]</code>, and universal-target copy.</p>
<p><strong>For the drill panels specifically:</strong> nothing in a cell labelled &ldquo;before commitment&rdquo; may name the mechanism, the fitting response, or the harmful reflex; every signal row must carry a site and a spelled-out kind; and each panel is shown at compact, laptop, and wide pane widths so density is reviewable at each.</p>

<h1>Drill panels — frozen pilots plus B6 drafts (${drillCount} panels, ${renderedDrillCells} states, ${PANE_WIDTHS.length} widths each)</h1>
${drills}

<h1>Foundation panels (${foundationCount} sections, ${renderedCells} states)</h1>
${sections}
</body></html>`

const outputDir = join(process.cwd(), 'public', 'ecmo-teaching-preview')
mkdirSync(outputDir, { recursive: true })
const outputPath = join(outputDir, 'panels.html')
writeFileSync(outputPath, html, 'utf8')
console.log(`Wrote ${outputPath}`)
console.log(
  `${foundationCount} foundation panels (${ecmoSharedFoundationSectionIds.length} shared × 2 profiles × 3 states, ${ecmoVvOnlyFoundationSectionIds.length} VV-only, ${ecmoVaOnlyFoundationSectionIds.length} VA-only) — ${renderedCells} rendered states`,
)
console.log(
  `${drillCount} drill panels — ${renderedDrillCells} rendered states, each at ${PANE_WIDTHS.map((width) => `${width.px}px`).join(', ')}`,
)
console.log(`${foundationCount + drillCount} panels reviewable from this one page.`)
