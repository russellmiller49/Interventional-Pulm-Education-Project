/**
 * Offline visual harness for the ECMO foundation teaching panels.
 *
 * Same reason as the mechanical-ventilation harness: the Learn workspace sits behind login and
 * behind a viewport gate, so the panels cannot be screenshotted in the running app. This renders
 * every shared foundation panel against both reference circuits, plus the post-action states, so
 * clipping, missing units, duplicated content, and unreadable text are visible in one page.
 *
 *   npm run render:ecmo-teaching
 *
 * Output: public/ecmo-teaching-preview/panels.html, served through the `trainer-prod-static`
 * launch config on :8099.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { EcmoFoundationTeachingPanel } from '../../src/features/cardiohelp-ecmo/components/teaching/EcmoFoundationTeachingPanel.tsx'
import { ecmoSharedFoundationSectionIds } from '../../src/features/cardiohelp-ecmo/content/foundationLessonRuntime.ts'
import type { EcmoReferenceProfileId } from '../../src/features/cardiohelp-ecmo/content/referenceProfiles.ts'
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
}

function variantsFor(profileId: EcmoReferenceProfileId): readonly Variant[] {
  const reference = settled(profileId)
  return [
    { label: 'reference', state: reference },
    {
      label: 'after +200 rpm',
      state: settled(profileId, { type: 'SET_RPM', rpm: reference.device.rpmSetpoint + 200 }),
    },
    {
      label: 'after +1 L/min sweep',
      state: settled(profileId, { type: 'SET_SWEEP', sweep: reference.gas.sweepLpm + 1 }),
    },
  ]
}

const profiles: readonly EcmoReferenceProfileId[] = ['vv-reference', 'va-reference']

const sections = ecmoSharedFoundationSectionIds
  .map((sectionId) => {
    const columns = profiles
      .flatMap((profileId) =>
        variantsFor(profileId).map((variant) => {
          const markup = renderToStaticMarkup(
            createElement(EcmoFoundationTeachingPanel, { sectionId, state: variant.state }),
          )
          return `<div class="cell"><p class="cell-label">${profileId} · ${variant.label}</p>${markup}</div>`
        }),
      )
      .join('\n')
    return `<section><h2>${sectionId}</h2><div class="matrix">${columns}</div></section>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ECMO foundation teaching panels</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; background: #f6f7f9; color: #111; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; margin-top: 32px; padding-bottom: 4px; border-bottom: 2px solid #ddd; }
  .matrix { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; margin-top: 12px; }
  .cell { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 12px; overflow-x: auto; }
  .cell-label { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #666; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  table { border-collapse: collapse; }
  .grid { display: grid; }
  .rounded-2xl, .rounded-xl { border-radius: 12px; }
  .border { border: 1px solid #ddd; }
  .border-dashed { border-style: dashed; }
  .p-4 { padding: 16px; } .p-3 { padding: 12px; }
  .text-muted-foreground { color: #666; }
  .font-semibold { font-weight: 600; }
  .text-xs { font-size: 11px; } .text-sm { font-size: 13px; } .text-lg { font-size: 17px; }
  .text-2xl { font-size: 22px; } .text-xl { font-size: 19px; } .text-base { font-size: 15px; }
  .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: .05em; }
  .bg-muted, .bg-muted\\/30, .bg-muted\\/40 { background: #eee; }
  .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; } .mt-4 { margin-top: 16px; }
  .gap-1 { gap: 4px; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
  .h-2 { height: 8px; } .rounded-full { border-radius: 999px; }
  .bg-foreground\\/70 { background: #444; }
  .flex { display: flex; } .flex-wrap { flex-wrap: wrap; } .flex-col { flex-direction: column; }
  .items-baseline { align-items: baseline; } .justify-between { justify-content: space-between; }
  .inline-flex { display: inline-flex; }
  .grid-cols-2 { grid-template-columns: 1fr 1fr; }
  [data-reference-kind] { display: inline-block; border: 1px solid #999; border-radius: 999px; padding: 1px 8px; font-size: 10px; }
  [data-model-boundary] { background: #fffbe6; }
</style></head><body>
<h1>ECMO foundation teaching panels — ${ecmoSharedFoundationSectionIds.length} sections × ${profiles.length} reference circuits × 3 states</h1>
<p>Check for: clipping, unreadable text, duplicated narrative, missing units, pane overflow, <code>--</code> readouts without an accessible reason, and universal-target language.</p>
${sections}
</body></html>`

const outputDir = join(process.cwd(), 'public', 'ecmo-teaching-preview')
mkdirSync(outputDir, { recursive: true })
const outputPath = join(outputDir, 'panels.html')
writeFileSync(outputPath, html, 'utf8')
console.log(`Wrote ${outputPath}`)
console.log(
  `${ecmoSharedFoundationSectionIds.length} panels × ${profiles.length} profiles × 3 states`,
)
