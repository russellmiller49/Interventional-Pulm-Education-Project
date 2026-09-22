/**
 * ECMO-FELLOW-02 — replay every causal plan through the reducer and write the trajectories as JSON.
 *
 *   npx esbuild scripts/cardiohelp-ecmo/dump-causal-trajectories.mts --bundle --platform=node \
 *     --format=esm --outfile=node_modules/.cache/ecmo/causal.mjs && \
 *     node node_modules/.cache/ecmo/causal.mjs <label> <out.json>
 *
 * The plans live in `src/features/cardiohelp-ecmo/test-support/causalTrajectories.ts` and use only
 * engine entry points that predate ECMO-FELLOW-02, so the same file can be dropped into a checkout
 * of the baseline and run there for the before-trajectories. Deterministic: no wall clock, no
 * randomness; re-running on the same tree produces identical output.
 */
import { writeFileSync } from 'node:fs'

import {
  CAUSAL_SAMPLE_SECONDS,
  ECMO_CAUSAL_PLANS,
  runCausalPlan,
} from '../../src/features/cardiohelp-ecmo/test-support/causalTrajectories'

const [label = 'current', out = 'causal-trajectories.json'] = process.argv.slice(2)

const cases = Object.fromEntries(
  Object.entries(ECMO_CAUSAL_PLANS).map(([scenarioId, plans]) => [
    scenarioId,
    Object.fromEntries(
      plans.map((plan) => [
        plan.id,
        { label: plan.label, rows: runCausalPlan(scenarioId, plan).rows },
      ]),
    ),
  ]),
)

writeFileSync(
  out,
  `${JSON.stringify(
    {
      engine: label,
      timeUnit: 'modeled seconds (compressed simulation steps, not bedside time)',
      sampleSeconds: CAUSAL_SAMPLE_SECONDS,
      cases,
    },
    null,
    1,
  )}\n`,
)
console.log(`wrote ${out}: ${Object.keys(cases).length} cases`)
