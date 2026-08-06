/**
 * Offline review surface for the nine live MCS teaching panels.
 *
 * The Learn workspace is public-unlisted rather than logged-in, so these panels *can* be reviewed in
 * a browser — but not all of them at once, not at four reveal stages each, and not at two pane
 * widths without thirty-six navigations. This renders every panel against states the reducer
 * actually produced, at every reveal stage, at both widths the secondary pane really gets, onto one
 * page a reviewer can scroll.
 *
 * It is also a gate rather than a picture. The checks below are the ones a screenshot cannot make:
 * a missing text equivalent, a figure with no model boundary, a non-finite reading, an evidence
 * record that stopped rendering, a clarification and a held disagreement swapped, two serial pump
 * flows added together, a universal target, an answer leaking into a pre-commitment state, and a
 * figure wide enough to push the workspace column sideways. Any of them exits non-zero.
 *
 * Run it directly — there is deliberately no package.json script, because package.json is a shared
 * file during this parallel round:
 *
 *     npx tsx scripts/critical-care/render-mcs-teaching-panels.ts
 *     MCS_SECTION=impella-unloading-placement npx tsx scripts/critical-care/render-mcs-teaching-panels.ts
 *     MCS_REVEAL_STAGE=orientation npx tsx scripts/critical-care/render-mcs-teaching-panels.ts
 *
 * Output: public/mcs-teaching-preview/panels.html
 *
 * The `.ts` extension is load-bearing, exactly as it is for `review-mcs-section-contracts.ts`: tsx
 * resolves a `.ts` entrypoint against this project's ESM/CJS mix and an `.mts` one does not — an
 * `.mts` entrypoint fails on the first named import from a transpiled `.ts` module. The panels carry
 * no CSS-module import, so no bundler step is needed on top of that.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  McsTeachingPanel,
  mcsTeachingPanelSectionIds,
  validateMcsTeachingPanelRegistry,
} from '../../src/features/mechanical-circulatory-support/components/teaching/McsTeachingPanel'
import {
  MCS_REVEAL_STAGES,
  type McsRevealStage,
} from '../../src/features/mechanical-circulatory-support/components/teaching/revealStage'
import {
  mcsSectionLearningContracts,
  type McsSectionLearningContract,
} from '../../src/features/mechanical-circulatory-support/content/sectionLearningContracts'
import { mcsLessonTransferByLessonId } from '../../src/features/mechanical-circulatory-support/content/lessonTransfers'
import { createInitialMcsState } from '../../src/features/mechanical-circulatory-support/engine/model'
import { mcsReducer } from '../../src/features/mechanical-circulatory-support/engine/reducer'
import type {
  McsAction,
  McsDerivedMetrics,
  McsSimulationState,
} from '../../src/features/mechanical-circulatory-support/engine/types'

const ONLY_SECTION = process.env.MCS_SECTION
const ONLY_STAGE = process.env.MCS_REVEAL_STAGE as McsRevealStage | undefined

const flags: { readonly where: string; readonly reason: string }[] = []
function flag(where: string, reason: string): void {
  flags.push({ where, reason })
}

/* ------------------------------------------------------------------ *
 * States, driven through the reducer
 * ------------------------------------------------------------------ */

/**
 * The learner action each section is authored around.
 *
 * Eight of the nine are the section's own `targetControl` expressed as the action that control
 * dispatches. The first is a patient control, because that section is inspect-only by contract and
 * the point of the harness is to review a panel that has something to compare against.
 */
const sectionActions: Readonly<Record<string, McsAction>> = {
  'mcs-foundations-signals': {
    type: 'SET_PATIENT_CONTROL',
    control: 'leftVentricularContractility',
    value: 0.4,
  },
  'mcs-foundations-mechanisms': { type: 'SELECT_DEVICE', device: 'impella' },
  'iabp-timing-triggering': {
    type: 'SET_IABP_CONTROL',
    control: 'inflationOffsetMs',
    value: 0,
  },
  'iabp-efficacy-limits': {
    type: 'SET_PATIENT_CONTROL',
    control: 'rightVentricularContractility',
    value: 0.3,
  },
  'impella-unloading-placement': {
    type: 'SET_IMPELLA_CONTROL',
    side: 'left',
    control: 'position',
    value: 'too-deep',
  },
  'impella-suction-purge-rv': {
    type: 'SET_IMPELLA_CONFIGURATION',
    control: 'rightEnabled',
    value: true,
  },
  'lvad-parameters-assessment': {
    type: 'SET_PATIENT_CONTROL',
    control: 'systemicVascularResistanceDynSecCm5',
    value: 1900,
  },
  'lvad-alarms-emergencies': {
    type: 'SET_LVAD_CONTROL',
    control: 'suspectedPumpThrombosis',
    value: true,
  },
  'mcs-device-selection-integration': {
    type: 'SET_IMPELLA_CONTROL',
    side: 'left',
    control: 'performanceLevel',
    value: 8,
  },
}

function tick(state: McsSimulationState, steps: number): McsSimulationState {
  let next = state
  for (let index = 0; index < steps; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.1 })
  }
  return next
}

function openedState(contract: McsSectionLearningContract): McsSimulationState {
  let state = createInitialMcsState('learn', contract.startingDevice)
  for (const action of contract.startingActions) state = mcsReducer(state, action)
  return tick(state, 80)
}

function actedState(contract: McsSectionLearningContract): McsSimulationState {
  return tick(mcsReducer(openedState(contract), sectionActions[contract.sectionId]), 40)
}

/**
 * The state each reveal stage is reviewed against.
 *
 * Orientation and mechanism are before the action, which is where the learner really is at those
 * stages; observation and explanation are after it; transfer is the section's own transfer setup,
 * driven the way the runtime drives it, so the panel is reviewed against a genuinely different
 * patient rather than against the same one relabelled.
 */
function stateFor(
  contract: McsSectionLearningContract,
  stage: McsRevealStage,
): { readonly state: McsSimulationState; readonly baseline: McsDerivedMetrics | null } {
  const opened = openedState(contract)
  if (stage === 'orientation' || stage === 'mechanism') return { state: opened, baseline: null }
  if (stage === 'transfer') {
    const transfer = transferState(contract)
    return { state: transfer, baseline: opened.metrics }
  }
  return { state: actedState(contract), baseline: opened.metrics }
}

/** The transfer patient, reached with the same two dispatches the runtime uses. */
function transferState(contract: McsSectionLearningContract): McsSimulationState {
  const transfer = mcsLessonTransferByLessonId.get(contract.sectionId)
  if (!transfer) return actedState(contract)
  let state = mcsReducer(actedState(contract), {
    type: 'OPEN_STUDIO',
    device: transfer.setupDevice,
  })
  for (const setup of transfer.setupActions) state = mcsReducer(state, setup)
  return tick(state, 60)
}

/* ------------------------------------------------------------------ *
 * The checks
 * ------------------------------------------------------------------ */

const universalTargetPatterns: readonly RegExp[] = [
  /\btarget of\s*\d/i,
  /\bshould (always )?be (above|below|over|under|greater than|less than)\s*\d/i,
  /\bkeep\b[^.]{0,32}\b(above|below|over|under)\s*\d/i,
  /\bnormal is\s*\d/i,
  /\bnormal range is\s*\d/i,
  /\baim for\s*\d/i,
  /\btarget flow\b/i,
  /\bflow target\b/i,
]

function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
}

function count(markup: string, needle: string): number {
  return markup.split(needle).length - 1
}

function reviewCell(
  contract: McsSectionLearningContract,
  stage: McsRevealStage,
  state: McsSimulationState,
  markup: string,
): void {
  const where = `${contract.sectionId} · ${stage}`
  const text = textOf(markup)

  if (!markup.includes('data-text-equivalent'))
    flag(where, 'no text equivalent anywhere in the panel')

  /*
   * Per figure, not per panel. Split on the section markers and require an equivalent in any block
   * that draws something — a trace, a schematic, a flow account, or a table this package authored.
   * The shared evidence renderers name every value in words already, so their tables are exempt.
   */
  const blocks = markup.split('data-panel-section="').slice(1)
  for (const block of blocks) {
    const id = block.slice(0, block.indexOf('"'))
    const withoutEvidence = block
      .split('data-measurement-clarification')[0]
      .split('data-held-disagreement')[0]
      .split('data-derived-value')[0]
    const drawsAFigure =
      withoutEvidence.includes('<svg') ||
      withoutEvidence.includes('data-flow-account') ||
      withoutEvidence.includes('<table')
    if (drawsAFigure && !block.includes('data-text-equivalent')) {
      flag(where, `the ${id} figure has no text equivalent`)
    }
  }
  if (!markup.includes('data-model-boundary'))
    flag(where, 'no model boundary anywhere in the panel')
  if (!markup.includes(`data-teaching-panel="${contract.sectionId}"`)) {
    flag(where, 'the panel does not carry its own section id')
  }

  if (/\bNaN\b|\bInfinity\b|\bundefined\b|\[object Object\]/.test(text)) {
    flag(where, 'a non-finite or unrendered value reached the markup')
  }

  for (const pattern of universalTargetPatterns) {
    if (pattern.test(text)) flag(where, `unsupported target language: ${pattern}`)
  }

  // An empty live figure: a flow line, a live value, or a table cell with nothing in it.
  if (/data-flow-line="[^"]*"[^>]*>\s*<\/(?:div|dd)>/.test(markup)) {
    flag(where, 'a flow line rendered with no content')
  }
  if (markup.includes('<svg') && !markup.includes('<path') && !markup.includes('<rect')) {
    flag(where, 'an SVG rendered with no geometry in it')
  }

  // Two serial pump flows must never be presented as one total.
  const summed = (state.metrics.leftDeviceFlowLMin + state.metrics.rightDeviceFlowLMin).toFixed(1)
  if (
    state.metrics.rightDeviceFlowLMin > 0.05 &&
    text.includes(`${summed} L/min`) &&
    summed !== state.metrics.effectiveSystemicFlowLMin.toFixed(1) &&
    summed !== state.metrics.leftDeviceFlowLMin.toFixed(1)
  ) {
    flag(where, `the sum of the two serial pump flows (${summed} L/min) appears in the panel`)
  }

  // A figure wide enough to widen the pane, rather than to scroll inside its own wrapper.
  let index = markup.indexOf('min-w-[')
  while (index >= 0) {
    const preceding = markup.slice(Math.max(0, index - 260), index)
    if (!preceding.includes('overflow-x-auto')) {
      flag(where, 'a minimum-width figure sits outside a scrolling wrapper')
    }
    index = markup.indexOf('min-w-[', index + 1)
  }

  if (stage === 'orientation') {
    const correct = contract.predictionItem.choices.find((choice) =>
      contract.predictionItem.correctChoiceIds.includes(choice.id),
    )
    const withheld: readonly (readonly [string, string])[] = [
      ['the correct choice label', correct?.label ?? ''],
      ['the correct-choice rationale', correct?.rationale ?? ''],
      ['the prediction explanation', contract.predictionItem.explanation],
      ['the section explanation', contract.explanation],
      ['how the action affects the model', contract.teaching.howTheActionAffectsTheModel],
      ['the flow-account note', contract.teaching.flowAccountNote],
      ['what this establishes', contract.whatThisEstablishes],
      ['the common misinterpretation', contract.commonMisinterpretation],
      ['the pressure rung', contract.pressureLevelExplanation],
      ['the flow rung', contract.flowLevelExplanation],
      ['the oxygen rung', contract.oxygenDeliveryExplanation],
      ['the organ rung', contract.organResponseExplanation],
    ]
    for (const [label, sentence] of withheld) {
      if (sentence && text.includes(textOf(sentence).trim())) {
        flag(where, `answer leakage before commitment: ${label} is in the pre-commitment markup`)
      }
    }
  }

  if (contract.sectionId === 'impella-unloading-placement' && stage !== 'orientation') {
    const hasClarification = markup.includes(
      'data-measurement-clarification="clarification.mcs.impella-cp-flow-measurands"',
    )
    const hasConflict = markup.includes(
      'data-held-disagreement="conflict.mcs.impella-cp-textbook-flow"',
    )
    if (!hasClarification) flag(where, 'the Impella measurement clarification is not rendered')
    if (!hasConflict) flag(where, 'the Impella held disagreement is not rendered')
    if (hasClarification && count(markup, 'data-clarified-quantity') !== 3) {
      flag(where, 'the clarification does not render all three manufacturer measurands')
    }
    if (hasConflict && count(markup, 'data-conflict-position') !== 2) {
      flag(where, 'the held disagreement does not render both textbook positions')
    }
    // The semantic reversal: manufacturer figures inside a disagreement, or textbook figures
    // presented as the current specification.
    const clarificationBlock = markup.slice(
      markup.indexOf('data-measurement-clarification'),
      markup.indexOf('data-held-disagreement'),
    )
    if (clarificationBlock.includes('data-conflict-position')) {
      flag(where, 'the manufacturer figures are rendered as a held disagreement')
    }
    if (clarificationBlock.includes('3.5 L/min')) {
      flag(where, 'a textbook figure is rendered inside the manufacturer clarification')
    }
    if (text.includes('3.65')) flag(where, 'two published figures appear to have been averaged')
  }
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

const registryErrors = validateMcsTeachingPanelRegistry()
for (const error of registryErrors) flag('registry', error)

const stages = (
  ONLY_STAGE ? MCS_REVEAL_STAGES.filter((stage) => stage === ONLY_STAGE) : MCS_REVEAL_STAGES
) as readonly McsRevealStage[]
if (stages.length === 0) {
  console.error(`MCS_REVEAL_STAGE=${ONLY_STAGE} is not one of ${MCS_REVEAL_STAGES.join(', ')}`)
  process.exit(1)
}

const contracts = mcsSectionLearningContracts.filter(
  (contract) => !ONLY_SECTION || contract.sectionId === ONLY_SECTION,
)
if (contracts.length === 0) {
  console.error(
    `MCS_SECTION=${ONLY_SECTION} is not one of ${mcsTeachingPanelSectionIds.join(', ')}`,
  )
  process.exit(1)
}

/** The two widths the secondary pane really gets: a 1280×720 laptop, and a wide desktop. */
const PANE_WIDTHS: readonly { readonly label: string; readonly px: number }[] = [
  { label: '1280×720 teaching column', px: 384 },
  { label: 'wide desktop teaching column', px: 560 },
]

let renderedCells = 0

const sections = contracts
  .map((contract) => {
    const columns = stages
      .map((stage) => {
        const { state, baseline } = stateFor(contract, stage)
        const markup = renderToStaticMarkup(
          createElement(McsTeachingPanel, {
            contract,
            state,
            reveal: stage,
            beforeMetrics: baseline,
          }),
        )
        reviewCell(contract, stage, state, markup)
        renderedCells += 1
        return PANE_WIDTHS.map(
          (width) =>
            `<div class="cell" style="width:${width.px}px"><p class="cell-label">${stage} · ${width.label} (${width.px}px)</p>${markup}</div>`,
        ).join('\n')
      })
      .join('\n')
    return `<section><h2>${contract.sectionId} <span class="scope">${contract.lessonSequenceLabel}</span></h2><p class="question">${contract.clinicalQuestion}</p><div class="matrix">${columns}</div></section>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MCS live teaching panels</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font: 13px/1.5 system-ui, sans-serif; background: #f6f7f9; color: #111; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; margin-top: 32px; padding-bottom: 4px; border-bottom: 2px solid #ddd; }
  h2 .scope { font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: .08em; color: #666; }
  .question { margin: 4px 0 0; font-size: 13px; color: #333; }
  .matrix { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; margin-top: 12px; }
  .cell { flex: 0 0 auto; background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 12px; overflow-x: hidden; }
  .cell-label { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #666; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  table { border-collapse: collapse; }
  th, td { vertical-align: top; padding-right: 8px; }
  caption { text-align: left; }
  svg { max-width: 100%; height: auto; }
  .overflow-x-auto { overflow-x: auto; }
  .grid { display: grid; }
  .rounded-2xl, .rounded-xl { border-radius: 10px; }
  .rounded-full { border-radius: 999px; }
  .border { border: 1px solid #ddd; }
  .border-l-4 { border-left: 4px solid #bbb; }
  .border-dashed { border-style: dashed; }
  .p-4 { padding: 14px; } .p-3 { padding: 10px; } .p-2 { padding: 7px; }
  .px-3 { padding-left: 10px; padding-right: 10px; } .py-2 { padding-top: 7px; padding-bottom: 7px; }
  .py-1 { padding-top: 4px; padding-bottom: 4px; } .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
  .px-2 { padding-left: 7px; padding-right: 7px; }
  .pb-1 { padding-bottom: 4px; } .pr-3 { padding-right: 10px; }
  .text-muted-foreground { color: #666; }
  .font-semibold { font-weight: 600; } .font-medium { font-weight: 500; } .font-normal { font-weight: 400; }
  .text-xs { font-size: 11px; } .text-sm { font-size: 12px; } .text-base { font-size: 13px; }
  .text-lg { font-size: 15px; } .text-xl { font-size: 17px; } .text-2xl { font-size: 20px; }
  .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: .05em; }
  .bg-muted\\/40, .bg-background { background: #f4f4f5; }
  .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 7px; } .mt-3 { margin-top: 10px; } .mt-4 { margin-top: 14px; }
  .ml-1 { margin-left: 4px; } .ml-2 { margin-left: 7px; }
  .gap-1 { gap: 4px; } .gap-2 { gap: 7px; } .gap-3 { gap: 10px; } .gap-4 { gap: 14px; }
  .h-2 { height: 8px; } .w-full { width: 100%; } .h-auto { height: auto; }
  .min-w-0 { min-width: 0; }
  .block { display: block; } .inline-block { display: inline-block; } .inline-flex { display: inline-flex; }
  .flex-col { flex-direction: column; } .items-center { align-items: center; }
  .grid-cols-2 { grid-template-columns: 1fr 1fr; }
  /* Matches the pane rule that neutralises the shared renderers' viewport-based grid. */
  .md\\:grid-cols-2 { grid-template-columns: minmax(0, 1fr); }
  .grid-cols-\\[repeat\\(auto-fit\\,minmax\\(11rem\\,1fr\\)\\)\\] { grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
  .align-top { vertical-align: top; }
  .leading-5 { line-height: 1.5; } .leading-6 { line-height: 1.6; }
  .cursor-pointer { cursor: pointer; }
  .border-amber-500\\/30 { border-color: #f59e0b55; } .bg-amber-500\\/5 { background: #f59e0b0d; }
  .max-w-3xl { max-width: 48rem; }
  [data-reference-kind] { display: inline-block; border: 1px solid #999; border-radius: 999px; padding: 1px 8px; font-size: 10px; }
  [data-model-boundary] { background: #fffbe6; }
  [data-text-equivalent] { background: #f0f6ff; }
  [data-transfer-state] { border-left: 4px solid #94a3b8; padding-left: 8px; }
  [data-flow-bar] { background: #64748b; }
</style></head><body>
<h1>MCS live teaching panels — ${contracts.length} section(s), ${stages.length} reveal stage(s), ${renderedCells} rendered states</h1>
<p>Check for: clipping, unreadable tables, duplicated narrative, missing units, a figure wider than its column, a stale baseline in the transfer column, and anything in an <strong>orientation</strong> cell that answers that section&rsquo;s prediction.</p>
<p>Widths are the two the secondary pane really gets: 384&nbsp;px on a 1280&times;720 laptop, 560&nbsp;px on a wide desktop.</p>
${sections}
</body></html>`

const outputDir = join(process.cwd(), 'public', 'mcs-teaching-preview')
mkdirSync(outputDir, { recursive: true })
/*
 * The sibling preview directories are excluded by a line each in the root .gitignore, which this
 * package does not own. A nested ignore file has the same effect and touches nothing shared, so the
 * harness rewrites it rather than relying on someone remembering it exists.
 */
writeFileSync(
  join(outputDir, '.gitignore'),
  '# Everything in here is regenerated by:\n#   npx tsx scripts/critical-care/render-mcs-teaching-panels.ts\n#\n# The sibling preview directories are excluded by a line each in the root .gitignore. This package\n# does not own that file, so the exclusion lives here instead — same effect, nothing shared touched.\n*\n!.gitignore\n',
  'utf8',
)
const outputPath = join(outputDir, 'panels.html')
writeFileSync(outputPath, html, 'utf8')

console.log(`Wrote ${outputPath}`)
console.log(
  `${contracts.length} panel(s) × ${stages.length} reveal stage(s) × ${PANE_WIDTHS.length} width(s) — ${renderedCells} rendered states`,
)

if (flags.length > 0) {
  console.error(`\n${flags.length} flag(s):`)
  for (const entry of flags) console.error(`  ${entry.where.padEnd(48)} ${entry.reason}`)
  process.exit(1)
}
console.log('0 flag(s)')
