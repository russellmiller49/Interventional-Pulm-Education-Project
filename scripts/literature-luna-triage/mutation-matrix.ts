import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Mutation-sensitivity harness for the five corrected findings.
 *
 * Each entry restores one original defect inside the corrected implementation by exact textual
 * substitution, runs the regressions that are supposed to catch it, and requires them to fail.
 * A surviving mutation means the regression is decorative, so this exits non-zero and names it.
 * Every source file is restored byte-for-byte whether the run succeeds, fails, or throws.
 *
 * Offline and read-only with respect to everything outside the repository working tree:
 *
 *   npx tsx scripts/literature-luna-triage/mutation-matrix.ts
 */

interface Edit {
  readonly from: string
  readonly to: string
}

interface Mutation {
  readonly id: string
  readonly finding: string
  readonly description: string
  readonly file: string
  readonly edits: readonly Edit[]
  readonly tests: readonly string[]
}

const ROUTING = 'scripts/literature-luna-triage/routing.ts'
const CONTRACT = 'src/features/literature/classifier/stage-a-contract.ts'
const OPENAI = 'scripts/literature-luna-triage/openai.ts'
const BATCH = 'scripts/literature-luna-triage/batch.ts'
const QUALIFY = 'scripts/literature-luna-triage/qualify.ts'
const REVIEW_APP = 'scripts/literature-luna-triage/review-app.ts'

const ROUTING_TESTS = [
  'scripts/literature-luna-triage/routing.test.ts',
  'src/features/literature/classifier/stage-a-contract.test.ts',
]

const MUTATIONS: readonly Mutation[] = [
  {
    id: 'route-coverage-dropped',
    finding: 'LUNA-ROUTE-001',
    description: 'coordinator stops asserting exact one-to-one risk coverage',
    file: ROUTING,
    edits: [
      {
        from: `  const riskByRecordId = assertExactRiskAnalysisCoverage(
    inputs.assignments.map((assignment) => assignment.recordId),
    inputs.riskAnalysisResults,
  )`,
        to: `  const riskByRecordId = new Map<string, StageARiskAnalysisResult>()
  for (const value of inputs.riskAnalysisResults) {
    const validation = validateStageARiskAnalysisResult(value)
    if (validation.ok) riskByRecordId.set(validation.result.recordId, validation.result)
  }`,
      },
    ],
    tests: ROUTING_TESTS,
  },
  {
    id: 'route-missing-means-no-risk',
    finding: 'LUNA-ROUTE-001',
    description: 'routing function reads unusable risk evidence as zero risk',
    file: CONTRACT,
    edits: [
      {
        from: `  const risk = validateStageARiskAnalysisResult(input.riskAnalysisResult)
  if (!risk.ok || risk.result.recordId !== input.recordId) {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['risk_evidence_missing_or_unusable_advances_by_default'],
    }
  }`,
        to: `  const risk = validateStageARiskAnalysisResult(input.riskAnalysisResult)
  const permissiveRiskFlags: readonly string[] = risk.ok ? risk.result.riskFlags : []`,
      },
      {
        from: `  if (risk.result.riskFlags.length > 0) {`,
        to: `  if (permissiveRiskFlags.length > 0) {`,
      },
    ],
    tests: ROUTING_TESTS,
  },
  {
    id: 'spend-numeric-validation-dropped',
    finding: 'LUNA-SPEND-001',
    description: 'record-count validation removed from the envelope',
    file: OPENAI,
    edits: [
      {
        from: `  if (!isNonNegativeSafeInteger(recordCount)) {
    refuse('The authorized record count must be a non-negative safe integer.')
  }
  if (RECORD_SPENDING_ACTIONS.has(action) ? recordCount < 1 : recordCount !== 0) {
    refuse(\`The authorized record count \${recordCount} is impossible for a \${action} spend.\`)
  }`,
        to: '',
      },
    ],
    tests: ['scripts/literature-luna-triage/openai.test.ts'],
  },
  {
    id: 'spend-consumption-dropped',
    finding: 'LUNA-SPEND-001',
    description: 'capability becomes an unlimited reusable bearer token again',
    file: OPENAI,
    edits: [
      {
        from: `  const ledger = ledgerOf(capability)
  if (ledger.consumed >= ledger.envelope.maxNetworkRequests) {`,
        to: `  const ledger = ledgerOf(capability)
  if (ledger.consumed < Number.POSITIVE_INFINITY) return
  if (ledger.consumed >= ledger.envelope.maxNetworkRequests) {`,
      },
    ],
    tests: [
      'scripts/literature-luna-triage/openai.test.ts',
      'scripts/literature-luna-triage/batch.test.ts',
    ],
  },
  {
    id: 'spend-plan-binding-dropped',
    finding: 'LUNA-SPEND-001',
    description: 'authorization stops binding the exact plan digest',
    file: OPENAI,
    edits: [
      {
        from: `  if (envelope.planSha256 !== expected.planSha256) {
    refuse('The plan digest changed after authorization; the authorized plan no longer exists.')
  }`,
        to: '',
      },
    ],
    tests: [
      'scripts/literature-luna-triage/openai.test.ts',
      'scripts/literature-luna-triage/runner.test.ts',
      'scripts/literature-luna-triage/batch.test.ts',
    ],
  },
  {
    id: 'batch-oversized-request-accepted',
    finding: 'LUNA-BATCH-001',
    description: 'individually oversized requests are packed instead of refused',
    file: BATCH,
    edits: [
      {
        from: `    if (lineTokens > ceilings.maxEstimatedTokensPerShard) {
      throw new Error(
        \`A single batch request estimates \${lineTokens} tokens, above the per-shard ceiling \` +
          \`\${ceilings.maxEstimatedTokensPerShard}. Refusing to shard.\`,
      )
    }`,
        to: '',
      },
    ],
    tests: ['scripts/literature-luna-triage/batch.test.ts'],
  },
  {
    id: 'qualify-evidence-unchecked',
    finding: 'LUNA-QUALIFY-001',
    description: 'qualification trusts the evaluation report without bound evidence',
    file: QUALIFY,
    edits: [
      {
        from: `function assertQualificationEvidence(inputs: QualificationInputs): void {
  const { evidence, evaluation } = inputs`,
        to: `function assertQualificationEvidence(inputs: QualificationInputs): void {
  if (inputs.evaluation.cohortLabel !== '') return
  const { evidence, evaluation } = inputs`,
      },
    ],
    tests: ['scripts/literature-luna-triage/qualify.test.ts'],
  },
  {
    id: 'qualify-cohort-size-unchecked',
    finding: 'LUNA-QUALIFY-001',
    description: 'qualification accepts any cohort label and any selected count',
    file: QUALIFY,
    edits: [
      {
        from: `  if (
    evidence.cohortLabel !== LUNA_LOCKED_SANITY_COHORT_LABEL ||
    evaluation.cohortLabel !== LUNA_LOCKED_SANITY_COHORT_LABEL
  ) {`,
        to: `  if (false) {`,
      },
      {
        from: `  if (
    evidence.selectedCount !== LUNA_LOCKED_SANITY_COHORT_SIZE ||
    evaluation.denominators.selected !== LUNA_LOCKED_SANITY_COHORT_SIZE
  ) {`,
        to: `  if (false) {`,
      },
    ],
    tests: ['scripts/literature-luna-triage/qualify.test.ts'],
  },
  {
    id: 'review-host-prefix-check',
    finding: 'LUNA-REVIEW-001',
    description: 'Host validation reverts to the original prefix check',
    file: REVIEW_APP,
    edits: [
      {
        from: `function hostAllowed(request: IncomingMessage): boolean {
  return parseLoopbackHostHeader(request.headers.host).ok
}`,
        to: `function hostAllowed(request: IncomingMessage): boolean {
  const host = request.headers.host ?? ''
  return host.startsWith('127.0.0.1') || host.startsWith('localhost')
}`,
      },
    ],
    tests: ['scripts/literature-luna-triage/review-app.test.ts'],
  },
]

function runTests(tests: readonly string[]): boolean {
  const result = spawnSync('npx', ['jest', '--runInBand', '--silent', ...tests], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: false,
  })
  return result.status === 0
}

async function main(): Promise<void> {
  const originals = new Map<string, string>()
  const results: { id: string; finding: string; detected: boolean }[] = []
  try {
    // Baseline: with no mutation applied, everything the matrix touches must be green.
    const baselineTests = [...new Set(MUTATIONS.flatMap((mutation) => mutation.tests))].sort()
    if (!runTests(baselineTests)) {
      throw new Error('The unmutated suites are not green; fix them before measuring sensitivity.')
    }
    process.stdout.write(`baseline green over ${baselineTests.length} suites\n`)

    for (const mutation of MUTATIONS) {
      const path = resolve(process.cwd(), mutation.file)
      if (!originals.has(path)) originals.set(path, readFileSync(path, 'utf8'))
      const original = originals.get(path) as string
      let mutated = original
      for (const edit of mutation.edits) {
        if (!mutated.includes(edit.from)) {
          throw new Error(`Mutation ${mutation.id} no longer matches ${mutation.file}.`)
        }
        mutated = mutated.replace(edit.from, edit.to)
      }
      writeFileSync(path, mutated)
      let detected: boolean
      try {
        detected = !runTests(mutation.tests)
      } finally {
        writeFileSync(path, original)
      }
      results.push({ id: mutation.id, finding: mutation.finding, detected })
      process.stdout.write(
        `${detected ? 'killed  ' : 'SURVIVED'} ${mutation.finding} ${mutation.id} — ${mutation.description}\n`,
      )
    }
  } finally {
    for (const [path, original] of originals) writeFileSync(path, original)
  }
  const survivors = results.filter((result) => !result.detected)
  process.stdout.write(
    `\n${results.length - survivors.length}/${results.length} mutations killed\n`,
  )
  if (survivors.length > 0) {
    process.exitCode = 1
  }
}

void main()
