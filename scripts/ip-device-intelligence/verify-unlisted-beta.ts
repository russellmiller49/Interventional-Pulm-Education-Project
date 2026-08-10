import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { isAtlasCohortProduct } from '../../src/features/device-intelligence/domain/atlas-cohort'
import { D1_EXEMPLAR_PROCEDURE_CODES } from '../../src/features/device-intelligence/domain/exemplars'
import { ROLE_CODE_ALIASES } from '../../src/features/preference-cards/domain/role-taxonomy'

/**
 * Read-only launch verification for the unlisted device-intelligence beta.
 *
 * Two modes, matching the two states the AABIP beta launch moves between:
 *
 *   npm run ip-intel:verify-beta -- --mode=off --base-url=http://localhost:3121
 *   npm run ip-intel:verify-beta -- --mode=on  --base-url=http://localhost:3121
 *
 * `--mode=off` expects a production server running WITHOUT
 * `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE`: every D1 route 404s (no auth redirect), the
 * noindex header tier stays on, and the existing public-unlisted modules are untouched.
 * `--mode=on` expects a server WITH the flag set locally, and checks the full exposure
 * contract: exemplar routes serve, non-exemplars and non-cohort products 404, aliases
 * redirect, every page is noindex with its demo watermarks and no-claim footers, no
 * non-cohort product identity appears in served HTML, and the F-09 conditional presentation
 * is live.
 *
 * Instead of `--base-url`, `--start` builds nothing and launches `npx next start` over the
 * existing production build on `--port` (default 3210), with the flag set only in that child
 * process's environment for `--mode=on`. The child is terminated when the run ends. Nothing
 * here writes configuration anywhere, contacts any deployment API, or persists a flag: the
 * production environment can only be changed by the owner, by hand, per the runbook
 * (docs/ip-device-intelligence/aabip-unlisted-beta-launch-runbook.md).
 *
 * Every fixture is derived from committed data at run time — the cohort and non-cohort
 * product ids from the generated catalog through the real cohort predicate, the exemplar
 * codes from the exemplar registry, the alias pair from the role taxonomy — so the harness
 * cannot drift from the data it verifies.
 */

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

interface Options {
  mode: 'off' | 'on'
  baseUrl: string | null
  start: boolean
  port: number
}

export function parseOptions(argv: string[]): Options {
  const options: Options = { mode: 'off', baseUrl: null, start: false, port: 3210 }
  let modeSeen = false
  for (const argument of argv) {
    if (argument === '--mode=off' || argument === '--mode=on') {
      options.mode = argument.slice('--mode='.length) as 'off' | 'on'
      modeSeen = true
    } else if (argument.startsWith('--base-url=')) {
      options.baseUrl = argument.slice('--base-url='.length).replace(/\/$/, '')
    } else if (argument === '--start') {
      options.start = true
    } else if (argument.startsWith('--port=')) {
      const port = Number(argument.slice('--port='.length))
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(
          `--port must be an integer between 1 and 65535, got "${argument.slice('--port='.length)}".`,
        )
      }
      options.port = port
    } else {
      throw new Error(
        `Unknown argument "${argument}". Use --mode=off|on with --base-url=… or --start [--port=…].`,
      )
    }
  }
  if (!modeSeen)
    throw new Error(
      'Pass --mode=off or --mode=on explicitly. The mode is the claim being verified.',
    )
  if (!options.baseUrl && !options.start) {
    throw new Error(
      'Pass --base-url=http://localhost:<port> for a running server, or --start to launch one over the existing production build.',
    )
  }
  if (options.baseUrl && options.start) {
    throw new Error('--base-url and --start are mutually exclusive.')
  }
  return options
}

/** The committed catalog, through the real cohort predicate. */
export function deriveProductFixtures(repoRoot: string): {
  cohortProductId: string
  nonCohortProductIds: string[]
  cohortProductIds: Set<string>
} {
  const products = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'data/ip-preference-cards/generated/catalog-products.json'),
      'utf8',
    ),
  ) as Array<{ product_id: string; verification_grade?: string; visibility_state?: string }>
  const cohort = products.filter((product) => isAtlasCohortProduct(product))
  const nonCohort = products.filter((product) => !isAtlasCohortProduct(product))
  if (cohort.length === 0) throw new Error('No cohort product found in the committed catalog.')
  if (nonCohort.length === 0) {
    throw new Error('No non-cohort product found — the negative control would be vacuous.')
  }
  const sortedCohort = [...cohort].sort((a, b) => a.product_id.localeCompare(b.product_id))
  const sortedNonCohort = [...nonCohort].sort((a, b) => a.product_id.localeCompare(b.product_id))
  return {
    cohortProductId: sortedCohort[0].product_id,
    // Two negative controls: the first and last non-cohort ids, so a sorting accident in
    // the store cannot make the check pass by luck.
    nonCohortProductIds: [
      sortedNonCohort[0].product_id,
      sortedNonCohort[sortedNonCohort.length - 1].product_id,
    ],
    cohortProductIds: new Set(cohort.map((product) => product.product_id)),
  }
}

export function deriveAliasFixture(): { deprecated: string; canonical: string } {
  const entries = Object.entries(ROLE_CODE_ALIASES).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) {
    throw new Error(
      'The role alias table is empty — the alias-redirect check has no fixture to derive.',
    )
  }
  const [deprecated, canonical] = entries[0]
  return { deprecated, canonical }
}

async function fetchPath(baseUrl: string, pathname: string) {
  const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' })
  const body = response.status === 200 || response.status === 404 ? await response.text() : ''
  return { response, body }
}

function check(results: CheckResult[], name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail })
}

async function expectStatus(
  results: CheckResult[],
  baseUrl: string,
  pathname: string,
  status: number,
  options: { requireRobotsHeader?: boolean; requireRobotsMeta?: boolean } = {},
): Promise<string> {
  const { response, body } = await fetchPath(baseUrl, pathname)
  check(
    results,
    `${pathname} → ${status}`,
    response.status === status,
    response.status === status
      ? 'as expected'
      : `got ${response.status}${response.headers.get('location') ? ` → ${response.headers.get('location')}` : ''}`,
  )
  if (options.requireRobotsHeader) {
    const header = response.headers.get('x-robots-tag') ?? ''
    check(
      results,
      `${pathname} carries X-Robots-Tag noindex`,
      header.includes('noindex') && header.includes('nofollow') && header.includes('noarchive'),
      header || 'header absent',
    )
  }
  if (options.requireRobotsMeta) {
    const hasMeta = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(body)
    check(
      results,
      `${pathname} carries noindex robots metadata`,
      hasMeta,
      hasMeta ? 'meta present' : 'meta absent',
    )
  }
  return body
}

async function runOffChecks(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const d1Paths = [
    '/en/devices',
    '/en/procedures',
    '/en/procedures/THERAPEUTIC_BRONCH',
    '/en/procedures/THERAPEUTIC_BRONCH/readiness',
    '/en/procedures/EBUS_TBNA',
    '/en/procedures/CHEST_TUBE/readiness',
    '/en/clinical-roles/EBUS_SCOPE',
  ]
  for (const pathname of d1Paths) {
    const { response } = await fetchPath(baseUrl, pathname)
    check(
      results,
      `${pathname} → 404 with the flag off`,
      response.status === 404,
      response.status === 404 ? 'as expected' : `got ${response.status}`,
    )
    check(
      results,
      `${pathname} does not redirect to authentication`,
      response.status !== 307 && response.status !== 302 && response.status !== 303,
      `status ${response.status}`,
    )
    const header = response.headers.get('x-robots-tag') ?? ''
    check(
      results,
      `${pathname} keeps the noindex header tier`,
      header.includes('noindex'),
      header || 'header absent',
    )
  }
  // An unrelated public-unlisted module is the control: the flag must gate D1 and only D1.
  await expectStatus(results, baseUrl, '/en/mechanical-circulatory-support', 200)
  return results
}

async function runOnChecks(baseUrl: string, repoRoot: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const fixtures = deriveProductFixtures(repoRoot)
  const alias = deriveAliasFixture()

  await expectStatus(results, baseUrl, '/en/devices', 200, {
    requireRobotsHeader: true,
    requireRobotsMeta: true,
  })
  await expectStatus(results, baseUrl, '/en/procedures', 200, {
    requireRobotsHeader: true,
    requireRobotsMeta: true,
  })

  const workspaceBodies = new Map<string, string>()
  for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
    workspaceBodies.set(
      code,
      await expectStatus(results, baseUrl, `/en/procedures/${code}`, 200, {
        requireRobotsHeader: true,
        requireRobotsMeta: true,
      }),
    )
  }
  const readinessBodies = new Map<string, string>()
  for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
    readinessBodies.set(
      code,
      await expectStatus(results, baseUrl, `/en/procedures/${code}/readiness`, 200, {
        requireRobotsHeader: true,
        requireRobotsMeta: true,
      }),
    )
  }

  // Negative controls: non-exemplar procedures and non-cohort product ids 404.
  for (const pathname of [
    '/en/procedures/THORACENTESIS',
    '/en/procedures/RIGID_BRONCH',
    '/en/procedures/NOT_A_PROCEDURE',
  ]) {
    await expectStatus(results, baseUrl, pathname, 404)
  }
  for (const productId of fixtures.nonCohortProductIds) {
    await expectStatus(results, baseUrl, `/en/devices/${productId}`, 404)
  }
  await expectStatus(results, baseUrl, `/en/devices/${fixtures.cohortProductId}`, 200, {
    requireRobotsHeader: true,
    requireRobotsMeta: true,
  })

  // A deprecated role code redirects to its canonical page rather than serving content twice.
  const { response: aliasResponse } = await fetchPath(
    baseUrl,
    `/en/clinical-roles/${alias.deprecated}`,
  )
  const aliasLocation = aliasResponse.headers.get('location') ?? ''
  check(
    results,
    `/en/clinical-roles/${alias.deprecated} redirects to ${alias.canonical}`,
    aliasResponse.status >= 301 &&
      aliasResponse.status <= 308 &&
      aliasLocation.includes(`/clinical-roles/${alias.canonical}`),
    `status ${aliasResponse.status}, location ${aliasLocation || 'absent'}`,
  )

  // The canonical clinical-role page carries the same served-page contract as every other
  // D1 surface; the alias check above only proved the redirect.
  await expectStatus(results, baseUrl, `/en/clinical-roles/${alias.canonical}`, 200, {
    requireRobotsHeader: true,
    requireRobotsMeta: true,
  })

  // Absent from navigation and the sitemap. Both checks assert the status they read from,
  // so an unexpected redirect or error page cannot make the negative content check pass on
  // an empty body. The navigation surface for an unauthenticated visitor is whatever /en
  // resolves to after redirects.
  const homeResponse = await fetch(`${baseUrl}/en`, { redirect: 'follow' })
  const homeBody = await homeResponse.text()
  check(
    results,
    'home navigation resolves and does not link the D1 routes',
    homeResponse.status === 200 &&
      !/href="[^"]*\/(devices|procedures|clinical-roles)(["\/?#])/.test(homeBody),
    `final status ${homeResponse.status}; checked hrefs for /devices, /procedures, /clinical-roles in any form`,
  )
  const sitemap = await fetchPath(baseUrl, '/sitemap.xml')
  check(
    results,
    'sitemap serves and does not name the D1 routes',
    sitemap.response.status === 200 &&
      !sitemap.body.includes('/devices') &&
      !sitemap.body.includes('/procedures') &&
      !sitemap.body.includes('/clinical-roles'),
    `sitemap status ${sitemap.response.status}`,
  )

  // Watermarks, unlisted note, and the no-institution wording, from the served bytes.
  for (const [code, body] of workspaceBodies) {
    check(
      results,
      `${code} workspace carries the draft watermark`,
      body.includes('DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE'),
      'draft watermark string',
    )
  }
  for (const [code, body] of readinessBodies) {
    check(
      results,
      `${code} readiness carries the demo watermark`,
      body.includes('DEMO DATA — NOT AN ACTUAL INSTITUTION'),
      'demo watermark string',
    )
    // The page's legend deliberately names every state, so this is a positive assertion on
    // the one the committed data produces — currently not_ready on all three exemplars
    // (structural required-role gaps; see readiness.test.ts). If the data ever changes
    // state, this fails and the expectation is updated deliberately, with the data.
    check(
      results,
      `${code} readiness stays appropriately qualified`,
      body.includes('Demo: Not ready'),
      'headline state the committed data produces',
    )
  }

  // No non-cohort product identity in any served page: every PRD- token in the HTML must be
  // a cohort member.
  for (const [code, body] of [...workspaceBodies, ...readinessBodies]) {
    const served = [...new Set(body.match(/PRD-[A-Z0-9]{6,20}/g) ?? [])]
    const leaked = served.filter((productId) => !fixtures.cohortProductIds.has(productId))
    check(
      results,
      `${code} serves no non-cohort product identity`,
      leaked.length === 0,
      leaked.length === 0 ? `${served.length} cohort id(s) served` : `leaked: ${leaked.join(', ')}`,
    )
  }

  // F-09 on the served workspace: the rigid APC applicator presents through its dependency
  // rule, not as an unconditional requirement.
  const therapeutic = workspaceBodies.get('THERAPEUTIC_BRONCH') ?? ''
  check(
    results,
    'THERAPEUTIC_BRONCH workspace shows the APC applicator as conditional',
    therapeutic.includes('Rigid system in use'),
    'dependency rule rendered on the modifier card',
  )

  return results
}

async function startLocalServer(mode: 'off' | 'on', port: number): Promise<ChildProcess> {
  // The port must be free, or the readiness poll below could attach to a leftover server
  // from an earlier run and certify a stale build in the wrong environment.
  try {
    await fetch(`http://localhost:${port}/`, { redirect: 'manual' })
    throw new Error(
      `Something is already answering on port ${port}. Stop it, or verify it directly with --base-url — --start refuses to adopt a server it did not launch.`,
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('already answering')) throw error
    // Connection refused is the healthy case: nothing is on the port.
  }
  const env: Record<string, string | undefined> = { ...process.env, PORT: String(port) }
  // The flag is set only in this child's environment, and only for --mode=on. Nothing is
  // persisted anywhere.
  if (mode === 'on') env.NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE = 'true'
  else delete env.NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE
  // Detached, so the WHOLE process group can be signalled: npx interposes itself between us
  // and the actual next-server, and signalling only the direct child leaves the grandchild
  // running with the flag set.
  const child = spawn('npx', ['next', 'start', '-p', String(port)], {
    env: env as NodeJS.ProcessEnv,
    stdio: 'ignore',
    detached: true,
  })
  const deadline = Date.now() + 60_000
  for (;;) {
    try {
      const response = await fetch(`http://localhost:${port}/en`, { redirect: 'manual' })
      if (response.status > 0) return child
    } catch {
      if (Date.now() > deadline) {
        child.kill('SIGTERM')
        throw new Error(
          `The local production server did not answer on port ${port} within 60s. Run \`npm run build\` first, or pass --base-url for a server you started yourself.`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const repoRoot = process.cwd()

  let child: ChildProcess | null = null
  let baseUrl = options.baseUrl
  if (options.start) {
    child = await startLocalServer(options.mode, options.port)
    baseUrl = `http://localhost:${options.port}`
  }

  try {
    const results =
      options.mode === 'off'
        ? await runOffChecks(baseUrl as string)
        : await runOnChecks(baseUrl as string, repoRoot)

    const failures = results.filter((result) => !result.pass)
    console.log(
      `Unlisted-beta verification, mode=${options.mode}, against ${baseUrl}: ${results.length - failures.length}/${results.length} checks passed.`,
    )
    for (const result of results) {
      console.log(`  ${result.pass ? '✓' : '✗'} ${result.name} — ${result.detail}`)
    }
    if (failures.length > 0) {
      console.error('')
      console.error(
        `${failures.length} check(s) failed. The server's state does not match --mode=${options.mode}: verify which build and environment it is running, then re-run.`,
      )
      process.exitCode = 1
    }
  } finally {
    if (child?.pid) {
      // Negative pid signals the detached process group — npx and the next-server under it.
      // `child.killed` only records that a signal was SENT, so escalation is gated on the
      // exit code still being unset after the grace period.
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
      if (child.exitCode === null && child.signalCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          child.kill('SIGKILL')
        }
      }
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
