#!/usr/bin/env -S npx tsx
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImportPlan, digest, type Inspection, type Snapshot } from './import-plan'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const command = args[0]
function arg(name: string, required = false) {
  const index = args.indexOf('--' + name)
  const value = index < 0 ? undefined : args[index + 1]
  if (required && (!value || value.startsWith('--'))) throw new Error('Required option: --' + name)
  return value
}
function readJson(filename: string) {
  return JSON.parse(readFileSync(filename, 'utf8'))
}
function privateOutput(filename: string, value: unknown) {
  const destination = path.resolve(filename)
  const parent = realpathSync(path.dirname(destination))
  const ancestors = parent
    .split(path.sep)
    .map((_, index, parts) => parts.slice(0, index + 1).join(path.sep) || path.sep)
  if (
    parent === root ||
    parent.startsWith(root + path.sep) ||
    parent.split(path.sep).includes('public') ||
    ancestors.some((p) => existsSync(path.join(p, '.git')))
  )
    throw new Error('Private outputs must be outside checkouts and public assets.')
  writeFileSync(destination, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
}
function inspect(): Inspection {
  const workspace = mkdtempSync(path.join(tmpdir(), 'socrates-inspect-'))
  chmodSync(workspace, 0o700)
  try {
    const output = path.join(workspace, 'inspection.json')
    execFileSync(
      arg('python') ?? 'python3',
      [
        path.join(root, 'scripts/socrates/inspect_workbook.py'),
        arg('workbook', true)!,
        '--output',
        output,
        ...(arg('expected-sha256') ? ['--expected-sha256', arg('expected-sha256')!] : []),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return readJson(output)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
export function endpoint(raw: string, allowRemote: boolean) {
  const url = new URL(raw)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Use a base Supabase URL without credentials or path.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (!local && !allowRemote) ||
    (!local && url.protocol !== 'https:') ||
    !['https:', 'http:'].includes(url.protocol)
  )
    throw new Error('Remote operations require explicit --remote and HTTPS.')
  return url.origin
}
async function request(route: string, body?: unknown) {
  const base = endpoint(process.env.SOCRATES_IMPORT_URL ?? '', args.includes('--remote'))
  const token = process.env.SOCRATES_IMPORT_ACCESS_TOKEN
  const key = process.env.SOCRATES_IMPORT_API_KEY
  if (!token || !key)
    throw new Error(
      'Supply an authenticated editor access token and API key through the environment.',
    )
  const response = await fetch(base + '/rest/v1/' + route, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, apikey: key, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    // Server errors can contain private JSON/constraint details. Keep the report bounded.
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `Protected request rejected (HTTP ${response.status}, code ${/^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'unavailable'}). No successful batch is implied.`,
    )
  }
  return response.json()
}
async function main() {
  if (command === 'inspect' || command === 'map-template') {
    const inspection = inspect()
    const value =
      command === 'inspect'
        ? inspection
        : inspection.records.map((r) => ({
            sourceKey: r.identity.key,
            targetCaseUuid: null,
            expectedRevision: null,
            expectedImageUrl: null,
            identityVerified: false,
            reviewedCurrentDraft: false,
            approvedFields: [],
          }))
    privateOutput(arg('output', true)!, value)
    console.log(
      JSON.stringify({
        records: inspection.records.length,
        modules: inspection.modules.length,
        mappingsVerified: 0,
      }),
    )
  } else if (command === 'snapshot') {
    const [cases, modules, memberships] = await Promise.all([
      request('rpc/list_socrates_author_cases', {}),
      request('socrates_curriculum_modules?select=id,revision'),
      request(
        'socrates_curriculum_memberships?select=module_id,case_id,position,source_order,source_key,release_state,decision_note',
      ),
    ])
    // This bounded source inventory fits within the default PostgREST cap. Refuse
    // a possible truncation rather than silently treating the snapshot as complete.
    if ([cases, modules, memberships].some((rows) => !Array.isArray(rows) || rows.length >= 1000))
      throw new Error('Protected snapshot may be incomplete; reconcile before importing.')
    privateOutput(arg('output', true)!, { cases, modules, memberships })
    console.log(
      JSON.stringify({
        cases: cases.length,
        modules: modules.length,
        memberships: memberships.length,
      }),
    )
  } else if (command === 'plan') {
    const inspection = inspect()
    const snapshot: Snapshot = arg('snapshot')
      ? readJson(arg('snapshot')!)
      : { cases: [], modules: [], memberships: [] }
    const mappings = arg('mapping') ? readJson(arg('mapping')!) : []
    const plan = createImportPlan(inspection, snapshot, mappings)
    privateOutput(arg('output', true)!, plan)
    console.log(
      JSON.stringify({
        rows: plan.rows.length,
        counts: plan.counts,
        canApply: plan.canApply,
        membershipDecisions: plan.rows.filter((r) => r.membershipHold).length,
        approvalDigest: plan.approvalDigest,
        targetSnapshot: arg('snapshot') ? 'provided' : 'NOT VERIFIED',
      }),
    )
  } else if (command === 'apply') {
    const plan = readJson(arg('plan', true)!)
    const expected = digest(plan.payload)
    if (
      plan.format !== 'socrates-import-plan-v1' ||
      !plan.canApply ||
      !Array.isArray(plan.rows) ||
      !plan.rows.every((r: { status: string }) => ['ready', 'no-op'].includes(r.status)) ||
      plan.approvalDigest !== expected ||
      arg('approve', true) !== expected
    )
      throw new Error('Apply requires a conflict-free private plan and its exact approval digest.')
    if (!plan.payload.updates.length) {
      console.log(JSON.stringify({ updated: 0, unchanged: plan.rows.length }))
      return
    }
    const result = await request('rpc/socrates_apply_workbook_import', { payload: plan.payload })
    if (arg('receipt')) privateOutput(arg('receipt')!, result)
    console.log(
      JSON.stringify({
        importId: result.importId,
        updated: result.updated.length,
        unchanged: result.unchanged.length,
        modules: result.modules.length,
      }),
    )
  } else {
    throw new Error(
      'Commands: inspect, map-template, snapshot, plan, apply. See docs/socrates-workbook-import.md.',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Do not print exception objects: dependency errors may contain source content.
    console.error(
      'SOCRATES operator command failed. Check required paths/options, private plan conflicts, access and expected revisions. No batch success is claimed.',
    )
    process.exitCode = 1
  })
}
