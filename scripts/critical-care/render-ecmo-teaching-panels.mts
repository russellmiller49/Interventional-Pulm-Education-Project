/**
 * Offline visual harness for the ECMO foundation teaching panels.
 *
 * Same reason as the mechanical-ventilation harness: the Learn workspace sits behind login and
 * behind a viewport gate, so the panels cannot be screenshotted in the running app. This renders
 * every interactive foundation panel against the states its own lesson can actually produce — the
 * reference circuits, the post-action states, and the engine-backed teaching previews — so
 * clipping, missing units, duplicated content, overflowing tables and unreadable text are all
 * visible in one page.
 *
 *   npm run render:ecmo-teaching
 *
 * Output: public/ecmo-teaching-preview/panels.html, served through the `trainer-prod-static`
 * launch config on :8099.
 *
 * The VV-only panels are deliberately never rendered against a VA circuit: their route cannot
 * produce that combination, and showing it here would review a state no learner can reach.
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
  ecmoVvOnlyFoundationSectionIds,
  type EcmoInteractiveFoundationSectionId,
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
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../../src/features/cardiohelp-ecmo/engine/index.ts'
import type {
  EcmoSimulationState,
  SimulationAction,
} from '../../src/features/cardiohelp-ecmo/engine/types.ts'

function advance(state: EcmoSimulationState, seconds: number): EcmoSimulationState {
  let current = state
  for (let tick = 0; tick < seconds; tick += 1) {
    current = ecmoSimulationReducer(current, { type: 'STEP' })
  }
  return current
}

function settled(profileId: EcmoReferenceProfileId, action?: SimulationAction): EcmoSimulationState {
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

function vvOnlyVariants(sectionId: EcmoInteractiveFoundationSectionId): readonly Variant[] {
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
      { label: 'after 20 modeled seconds, compared with the snapshot', state: advance(opening, 20), snapshot },
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

const profiles: readonly EcmoReferenceProfileId[] = ['vv-reference', 'va-reference']

function variantsFor(sectionId: EcmoInteractiveFoundationSectionId): readonly Variant[] {
  return (ecmoSharedFoundationSectionIds as readonly string[]).includes(sectionId)
    ? profiles.flatMap((profileId) => sharedVariants(profileId))
    : vvOnlyVariants(sectionId)
}

let renderedCells = 0

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
    const scope = (ecmoVvOnlyFoundationSectionIds as readonly string[]).includes(sectionId)
      ? 'VV-only — never rendered against a VA circuit'
      : 'shared by both tracks'
    return `<section><h2>${sectionId} <span class="scope">${scope}</span></h2><div class="matrix">${columns}</div></section>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ECMO foundation teaching panels</title>
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
</style></head><body>
<h1>ECMO foundation teaching panels — ${ecmoInteractiveFoundationSectionIds.length} sections, ${renderedCells} states</h1>
<p>Check for: clipping, unreadable text, duplicated narrative, missing units, pane overflow, table overflow, <code>--</code> readouts without an accessible reason, <code>[object Object]</code>, and universal-target copy.</p>
${sections}
</body></html>`

const outputDir = join(process.cwd(), 'public', 'ecmo-teaching-preview')
mkdirSync(outputDir, { recursive: true })
const outputPath = join(outputDir, 'panels.html')
writeFileSync(outputPath, html, 'utf8')
console.log(`Wrote ${outputPath}`)
console.log(
  `${ecmoInteractiveFoundationSectionIds.length} panels (${ecmoSharedFoundationSectionIds.length} shared × 2 profiles × 3 states, ${ecmoVvOnlyFoundationSectionIds.length} VV-only) — ${renderedCells} rendered states`,
)
