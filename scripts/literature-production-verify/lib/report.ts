/**
 * The single output boundary.
 *
 * Everything this process ever writes — stdout, stderr, and the optional receipt file — goes
 * through `redact` or `redactedJson` here. Concentrating it in one module is what makes the
 * no-credential claim auditable: there is one place to read, rather than a promise that every
 * `process.stdout.write` in the package remembered to scrub its argument.
 *
 * The exit status is equally narrow. `verified` is the only verdict that exits 0. `indeterminate`
 * exits nonzero on purpose: a run that could not observe what it needed has not verified anything,
 * and a CI step or a `&&` chain must not read "we could not tell" as "it is fine".
 */

import { redact, redactedJson } from './redaction'
import type { CheckResult } from './checks'
import type { RunVerdict, ScenarioRun } from './scenarios'

const OUTCOME_LABEL: Readonly<Record<CheckResult['outcome'], string>> = {
  pass: 'PASS',
  fail: 'FAIL',
  indeterminate: 'UNKNOWN',
}

/** Exit 0 for `verified` and nothing else. */
export function exitCodeForVerdict(verdict: RunVerdict): number {
  return verdict === 'verified' ? 0 : 1
}

export function renderScenarioRun(run: ScenarioRun): string {
  const lines: string[] = ['', `${run.title}  [${run.scenario}]`, `  claim: ${run.claim}`, '']
  for (const check of run.checks) {
    lines.push(`  [${OUTCOME_LABEL[check.outcome].padEnd(7)}] ${check.id} — ${check.title}`)
    lines.push(`             ${check.detail}`)
  }
  lines.push(
    '',
    `  ${run.summary.pass} pass, ${run.summary.fail} fail, ${run.summary.indeterminate} unknown`,
    `  verdict: ${run.verdict.toUpperCase()}`,
  )
  if (run.stopReason) lines.push(`  stop: ${run.stopReason}`)
  lines.push('')
  return redact(lines.join('\n'))
}

export interface ReceiptEnvelope {
  readonly schemaVersion: 'literature-production-verification/1.1.0'
  readonly scenario: string
  readonly verdict: RunVerdict
  readonly target: { url: string; projectRef: string; credentialPresent: boolean }
  readonly bindingStatus: string
  readonly checks: readonly CheckResult[]
  readonly summary: ScenarioRun['summary']
  readonly stopReason: string | null
  /**
   * The corpus snapshot this run observed, or `null` when it could not be taken.
   *
   * Present so a receipt can be handed straight back as the next run's `--baseline`. The file an
   * operator is told to keep and the file the idempotency check can read are now the same file.
   */
  readonly snapshot: {
    totalArticles: number
    batchCount: number
    insertedTotal: number
    updatedTotal: number
    duplicateTotal: number
    latestBatchStartedAt?: string | null
  } | null
  /**
   * Stamped by the caller from `Date.now()`. Present so a receipt can be filed, and deliberately
   * not read by any check — nothing here is authorization, and a timestamp must not look like it.
   */
  readonly capturedAt: string
  readonly notAuthorization: string
}

/**
 * A receipt, with every string scrubbed.
 *
 * The envelope carries `credentialPresent: boolean` and never a credential, a URL with userinfo,
 * or a header. `notAuthorization` is a constant sentence rather than a comment because a receipt
 * outlives the terminal it was printed in, and the next person to open it should not have to infer
 * that a passing verification did not license the next step.
 */
export function renderReceipt(envelope: ReceiptEnvelope): string {
  return redactedJson(envelope)
}

export const RECEIPT_NOT_AUTHORIZATION =
  'This receipt records what was observed. It authorizes nothing: not a canary, not an import, ' +
  'not a Railway change, and not a deployment. Each of those requires its own owner ' +
  'authorization, and a passing verification is a precondition for asking, never a substitute.'

export function writeOut(text: string): void {
  process.stdout.write(redact(text))
}

export function writeError(text: string): void {
  process.stderr.write(redact(text))
}
