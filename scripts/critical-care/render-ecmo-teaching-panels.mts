/**
 * Offline visual harness for every ECMO teaching panel — the ten foundation panels and the six
 * live drill panels of the B4 pilot slice.
 *
 * Same reason as the mechanical-ventilation harness: this renders one panel at a time without
 * booting the app, which is faster than driving a route and shows every state side by side. (The
 * ECMO routes are public-unlisted rather than behind login, so the running application can also be
 * driven directly — see `src/lib/site-auth/access.ts`. Use both: the page for breadth, the route
 * for anything that depends on real layout or real interaction.) This renders
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
 * The drill panels are rendered at two pane widths. Their teaching pane is about 480px wide in the
 * three-pane arrangement and about 700px in the laptop arrangement, and a table that reads well at
 * one of those can be unreadable at the other — which is the density question this package was
 * asked about, and it cannot be answered by looking at one width.
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
  ecmoFoundationVariants,
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
import {
  ecmoCircuitWalkStops,
  ecmoCircuitWalkStopsForSection,
  type EcmoCircuitWalkStopId,
} from '../../src/features/cardiohelp-ecmo/content/circuitWalk.ts'
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
  ecmoDrillTeachingPanelScenarioIds,
} from '../../src/features/cardiohelp-ecmo/components/teaching/EcmoDrillTeachingPanel.tsx'
import { requireEcmoLearnPrediction } from '../../src/features/cardiohelp-ecmo/content/learnPredictionItems.ts'
import {
  EcmoCircuitMinimap,
  type EcmoCircuitMinimapLayoutId,
} from '../../src/features/cardiohelp-ecmo/components/teaching/EcmoCircuitMinimap.tsx'
import type { EcmoCircuitPresentation } from '../../src/features/cardiohelp-ecmo/content/circuitPresentation.ts'
import { ecmoLocalizationRowIds } from '../../src/features/cardiohelp-ecmo/content/localizationCards.ts'

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
  /** Which walk stop the panel opens at, for the two sections that carry a walk. */
  readonly walkStopId?: EcmoCircuitWalkStopId
}

function sharedVariants(profileId: EcmoReferenceProfileId): readonly Variant[] {
  const reference = settled(profileId)
  return [
    { label: `${profileId} · reference`, state: reference },
    {
      // Matches the bounded action the pump lesson actually offers. At the two hundred it used to
      // render, the drainage pressure was identical to the reference column and the page gave no
      // sign that the comparison the lesson asks for was invisible on the console.
      label: `${profileId} · after +400 rpm`,
      state: settled(profileId, { type: 'SET_RPM', rpm: reference.device.rpmSetpoint + 400 }),
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
/**
 * Every stop of a walk, against every state the section is rendered on.
 *
 * The walk shows one place at a time, so a page that rendered only the stop it happens to open at
 * would review a sixth of it. This is the matrix that makes the whole walk visible at once: each
 * stop is a column, each state a row, and both tracks appear because a stop's copy and its map
 * labels resolve per track.
 */
function walkVariants(
  sectionId: EcmoInteractiveFoundationSectionId,
  base: readonly Variant[],
): readonly Variant[] {
  const stops = ecmoCircuitWalkStopsForSection(sectionId)
  if (stops.length === 0) return base
  return base.flatMap((variant) =>
    stops.map((stop) => ({
      ...variant,
      label: `${variant.label} · stop ${stop.ordinal} (${stop.id})`,
      walkStopId: stop.id,
    })),
  )
}

/**
 * Every state a walk section itself declares, per track.
 *
 * `sharedVariants` builds three hand-written profile states, which is right for the sections that
 * only ever show a reference circuit — and wrong for a section that authors its own. The first cut
 * of the walk matrix multiplied stops across those three, so the return-resistance state this
 * package added had no cell anywhere: the comparative stop was reviewed only against circuits with
 * nothing wrong with them, which is the one thing it is not about. Reading the runtime means a
 * variant added to a lesson gets cells without this file being edited a second time.
 */
function authoredVariants(sectionId: EcmoInteractiveFoundationSectionId): readonly Variant[] {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  return (['vv', 'va'] as const).flatMap((mode) =>
    ecmoFoundationVariants(runtime, mode).map((variant) => ({
      label: `${mode} · ${variant.label}`,
      state: createEcmoFoundationSessionState(variant).simulation,
    })),
  )
}

function variantsFor(sectionId: EcmoInteractiveFoundationSectionId): readonly Variant[] {
  if (isEcmoSharedFoundationSectionId(sectionId)) {
    if (ecmoCircuitWalkStopsForSection(sectionId).length > 0) {
      return walkVariants(sectionId, authoredVariants(sectionId))
    }
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
 * The six live drill panels
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

function drillVariants(scenarioId: string): readonly DrillVariant[] {
  if (scenarioId === 'startup-sensor-orientation') {
    const stopped = drillState(scenarioId, 2)
    const running = advance(ecmoSimulationReducer(stopped, { type: 'SET_RPM', rpm: 3200 }), 6)
    return [
      { label: 'settled pump-off — before commitment', state: stopped },
      { label: 'reference demonstration running — before commitment', state: running },
      {
        label: 'returned to pre-use — after commitment',
        state: commit(
          ecmoSimulationReducer(running, {
            type: 'LOAD_SCENARIO',
            scenarioId,
            mode: 'guided',
          }),
        ),
      },
    ]
  }

  if (scenarioId === 'preload-drainage-collapse') {
    const opening = drillState(scenarioId)
    return [
      { label: 'as it stands — before commitment', state: opening },
      // The unsafe option, so the committed-choice line can be reviewed for anything that reads as
      // a verdict. Correctness belongs beside the question, never here.
      { label: 'after committing the unsafe option', state: commit(opening, 'unsafe') },
      {
        label: 'after reducing demand and correcting the cause',
        state: advance(
          ecmoSimulationReducer(
            ecmoSimulationReducer(commit(opening), { type: 'SET_RPM', rpm: 3300 }),
            { type: 'CORRECT_FAULT', fault: 'preload-limited' },
          ),
          8,
        ),
      },
    ]
  }

  if (scenarioId === 'vv-recirculation') {
    const opening = drillState(scenarioId)
    return [
      { label: 'as it stands — before commitment', state: opening },
      { label: 'after commitment, at the opening speed', state: commit(opening) },
      {
        // The A2 illusion, which is the reason this drill exists: displayed flow up, effective down.
        label: 'after commitment, speed escalated to 4400 rpm',
        state: advance(ecmoSimulationReducer(commit(opening), { type: 'SET_RPM', rpm: 4400 }), 8),
      },
    ]
  }

  if (scenarioId === 'gas-source-interruption') {
    const before = drillState(scenarioId, 3)
    const after = advance(before, 12)
    return [
      { label: 'before the interruption — before commitment', state: before },
      { label: 'after the interruption — after commitment', state: commit(after) },
      {
        label: 'after the source is restored',
        state: advance(ecmoSimulationReducer(commit(after), { type: 'RESTORE_GAS_SOURCE' }), 12),
      },
    ]
  }

  if (scenarioId === 'arterial-bubble-stop') {
    const stopped = drillState(scenarioId, 6)
    const committed = commit(stopped)
    const isolated = ecmoSimulationReducer(
      ecmoSimulationReducer(committed, {
        type: 'TOGGLE_CIRCUIT_CLAMP',
        limb: 'return',
        closed: true,
      }),
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
    )
    return [
      { label: 'pump stopped, clamps open — before commitment', state: stopped },
      { label: 'both limbs isolated — after commitment', state: isolated },
      {
        label: 'source corrected, latch still set — after commitment',
        state: ecmoSimulationReducer(isolated, {
          type: 'CORRECT_FAULT',
          fault: 'arterial-bubble',
        }),
      },
    ]
  }

  const opening = drillState(scenarioId)
  return [
    { label: 'as it stands — before commitment', state: opening },
    { label: 'after commitment', state: commit(opening) },
    {
      label: 'after the pattern is verified and escalated',
      state: advance(
        ecmoSimulationReducer(commit(opening), {
          type: 'CORRECT_FAULT',
          fault: 'differential-hypoxemia',
        }),
        12,
      ),
    },
  ]
}

/** The two pane widths the drill teaching pane actually gets in the workspace. */
const PANE_WIDTHS: readonly { readonly label: string; readonly px: number }[] = [
  { label: 'three-pane teaching column', px: 480 },
  { label: 'laptop context column', px: 700 },
]

let renderedCells = 0
let renderedDrillCells = 0

const drills = ecmoDrillTeachingPanelScenarioIds
  .map((scenarioId) => {
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
    return `<section><h2>${scenarioId} <span class="scope">drill panel — B4 pilot slice</span></h2><div class="matrix matrix-drill">${columns}</div></section>`
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
            // Naming the stop is what makes every one of them reviewable; the sensor names are
            // shown here because this page is for reading the finished copy, not for checking the
            // phase gate, which `foundation-activity.test.tsx` drives instead.
            ...(variant.walkStopId
              ? { walk: { activeStopId: variant.walkStopId, sensorNamesVisible: true } }
              : {}),
          }),
        )
        return `<div class="cell"><p class="cell-label">${variant.label}</p>${markup}</div>`
      })
      .join('\n')
    return `<section><h2>${sectionId} <span class="scope">${scopeLabel(sectionId)}</span></h2><div class="matrix">${columns}</div></section>`
  })
  .join('\n')

const walkStopCount = ecmoCircuitWalkStops.length
const drillCount = ecmoDrillTeachingPanelScenarioIds.length
const foundationCount = ecmoInteractiveFoundationSectionIds.length

/*
 * The circuit map on its own, in both geometries.
 *
 * The panels above render at the two pane widths they actually get, and at both of those the map
 * chooses its landscape geometry. The compact geometry only appears in a pane near its 280px floor,
 * which no panel cell here reproduces — and it is the geometry that exists because the landscape one
 * rendered six-pixel type down there. Rendering it beside its sibling is the only way this page
 * shows the thing the compact layout was built for.
 *
 * `layout` is named rather than measured because there is no browser here: the component measures
 * its own container, and `renderToStaticMarkup` gives it nothing to measure.
 */
const MAP_STATES: readonly (readonly [string, SupportMode, EcmoCircuitPresentation])[] = [
  ['neutral — before a commitment', 'vv', { kind: 'neutral' }],
  ['scaffold · the circuit walk', 'vv', { kind: 'scaffold', emphasis: 'path-order' }],
  ['scaffold · the console tour', 'vv', { kind: 'scaffold', emphasis: 'sensor-sites' }],
  ...ecmoLocalizationRowIds.map(
    (rowId) =>
      [
        `implicated · ${rowId}`,
        rowId === 'return-path-resistance' ? 'va' : 'vv',
        {
          kind: 'implicated',
          rowId,
        },
      ] as const,
  ),
]

const MAP_LAYOUTS: readonly (readonly [EcmoCircuitMinimapLayoutId, number])[] = [
  ['compact', 280],
  ['regular', 480],
]

const maps = MAP_LAYOUTS.map(
  ([
    layout,
    width,
  ]) => `<h2>Circuit map — ${layout} geometry <span class="scope">at a ${width}px pane</span></h2>
<div class="matrix-drill">
${MAP_STATES.map(
  ([label, supportMode, presentation]) =>
    `<div class="cell" style="width:${width}px"><p class="cell-label">${label} · ${supportMode}</p>${renderToStaticMarkup(
      createElement(EcmoCircuitMinimap, { supportMode, presentation, layout }),
    )}</div>`,
).join('\n')}
</div>`,
).join('\n')

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
  .h-auto { height: auto; }
  .max-w-\\[30rem\\] { max-width: 30rem; }
  .max-w-\\[18rem\\] { max-width: 18rem; }
  .leading-5 { line-height: 1.25rem; }
  /*
   * The circuit minimap draws itself entirely from presentation attributes and \`currentColor\`,
   * which is what lets it appear in this stylesheet-free harness at all. The only thing it needs
   * from CSS is its size, so a missing rule here shows up as a diagram at its intrinsic width
   * rather than as a diagram in the wrong colours.
   */
  [data-circuit-minimap] svg { display: block; }
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
<p><strong>For the drill panels specifically:</strong> nothing in a cell labelled &ldquo;before commitment&rdquo; may name the mechanism, the fitting response, or the harmful reflex; every signal row must carry a site and a spelled-out kind; and each panel is shown at both pane widths it actually gets, so density is reviewable at each.</p>

<h1>Drill panels — B4 pilot slice (${drillCount} panels, ${renderedDrillCells} states, ${PANE_WIDTHS.length} widths each)</h1>
${drills}

<h1>Circuit map — both geometries (${MAP_STATES.length} states each)</h1>
<p>The compact geometry is what a 280px teaching pane gets. Check that no label is smaller than the body text around it, that nothing overlaps, and that the implicated ticks and outline read without colour.</p>
${maps}

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
  `${walkStopCount} circuit-walk stops, every one against every state its section is rendered on`,
)
console.log(
  `${drillCount} drill panels — ${renderedDrillCells} rendered states, each at ${PANE_WIDTHS.map((width) => `${width.px}px`).join(' and ')}`,
)
console.log(`${foundationCount + drillCount} panels reviewable from this one page.`)
