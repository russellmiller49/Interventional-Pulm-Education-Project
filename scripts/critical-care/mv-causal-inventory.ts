/**
 * MV-PRE-REVIEW-02 causal inventory, printed.
 *
 * Replays every live mechanical-ventilation case (MV-03 held) through the real reducer from a
 * fresh deterministic start and prints what each arm's patient is doing at identical model times.
 * The logic lives in `src/features/mechanical-ventilation/test-support/causalInventory.ts` so the
 * regression suite reads the same replay.
 *
 *     npx tsx scripts/critical-care/mv-causal-inventory.ts                 # markdown to stdout
 *     npx tsx scripts/critical-care/mv-causal-inventory.ts --json=out.json # plus the raw arms
 *     npx tsx scripts/critical-care/mv-causal-inventory.ts --speeds        # 1×/5×/30× invariance
 *
 * No package.json script, deliberately (a shared file). The `.ts` extension is load-bearing for tsx.
 */
import { writeFileSync } from 'node:fs'

import { mechanicalVentilationCaseById } from '../../src/features/mechanical-ventilation/content/runtimeCases'
import {
  ASSESSMENT_ONLY,
  INVENTORY_TIMES,
  NO_ACTION,
  PRIORITY_CASE_IDS,
  caseArms,
  liveCaseIds,
  runInventoryArm,
  type ArmRun,
  type InventorySnapshot,
} from '../../src/features/mechanical-ventilation/test-support/causalInventory'
import type { SimulationSpeed } from '../../src/features/mechanical-ventilation/engine/types'

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value ?? 'true'] as const
  }),
)

function row(snapshot: InventorySnapshot): string {
  const b = snapshot.breath
  const g = snapshot.gas
  const h = snapshot.human
  return [
    snapshot.t,
    `${b.exhaledVtMl}${b.exhaledVtSource === 'predicted' ? '*' : ''}`,
    b.totalRatePerMin,
    `${b.peakCmH2O}${b.peakSource === 'predicted' ? '*' : ''}`,
    b.plateauEstimateCmH2O,
    b.intrinsicPeepCmH2O,
    b.minuteVentilationLMin,
    `${g.pH.toFixed(2)}/${g.paCO2.toFixed(0)}/${g.hco3.toFixed(0)}`,
    g.paO2.toFixed(0),
    g.spo2.toFixed(0),
    `${snapshot.hemodynamics.map.toFixed(0)}`,
    snapshot.hemodynamics.hr,
    `${h.dyspnea.toFixed(1)}${h.reportability === 'index-only' ? '†' : ''}`,
    h.rass,
    snapshot.alarms.join(' ') || '—',
    snapshot.actions.join(' ') || '—',
  ].join(' | ')
}

const header =
  '| t (s) | VTE mL | fTot | Ppeak | Pplat est | PEEPi | MV L/min | live pH/PaCO₂/HCO₃ | PaO₂ | SpO₂ | MAP | HR | dyspnea | RASS | alarms | actions |\n' +
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'

function table(run: ArmRun): string {
  return [header, ...run.snapshots.map((snapshot) => `| ${row(snapshot)} |`)].join('\n')
}

function branchesFor(caseId: string): string[] {
  return [...mechanicalVentilationCaseById.get(caseId)!.branchOptions]
}

const runs: ArmRun[] = []
const out: string[] = []
const times = [...INVENTORY_TIMES]

out.push('# MV causal inventory')
out.push('')
out.push(
  '`*` = analytic fallback (no completed inflation in the buffer); `†` = internal symptom index, not a patient report.',
)
out.push('')

if (args.has('speeds')) {
  const speedTimes = [0, 30, 60, 150, 180]
  for (const caseId of ['MV-01', 'MV-05', 'MV-06', 'MV-13', 'MV-14']) {
    out.push(`## ${caseId} — no action at 1× / 5× / 30×`)
    for (const speed of [1, 5, 30] as SimulationSpeed[]) {
      const run = runInventoryArm({ caseId, arm: NO_ACTION, sampleTimes: speedTimes, speed })
      runs.push(run)
      out.push(`### ${speed}× (branch ${run.branch})`)
      out.push(table(run))
      out.push('')
    }
  }
} else {
  for (const caseId of liveCaseIds()) {
    const definition = mechanicalVentilationCaseById.get(caseId)!
    const priority = (PRIORITY_CASE_IDS as readonly string[]).includes(caseId)
    for (const branch of branchesFor(caseId)) {
      const arms = priority ? caseArms(caseId, branch) : [NO_ACTION, ASSESSMENT_ONLY]
      out.push(`## ${caseId} · ${definition.title} · branch \`${branch}\``)
      out.push('')
      for (const arm of arms) {
        const run = runInventoryArm({ caseId, arm, sampleTimes: times, branch })
        runs.push(run)
        out.push(
          `### ${arm.label} — attempt ${run.attempt}; first in-case completed inflation at ${run.firstInCaseInflationAt ?? '—'} s`,
        )
        out.push(table(run))
        out.push('')
      }
    }
  }
}

const json = args.get('json')
if (json) writeFileSync(json, JSON.stringify(runs, null, 1))
process.stdout.write(out.join('\n') + '\n')
