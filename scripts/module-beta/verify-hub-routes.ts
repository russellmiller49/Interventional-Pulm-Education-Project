import path from 'node:path'

import { betaModules } from '../../src/features/module-beta/catalog'
import { buildEmbeddedAppSrc, socalEusBSimulatorAppPath } from '../../src/lib/embedded-app-locale'
import { resolveRouteDirectories, staticPageAddresses } from './hub-route-files'

/**
 * Read-only check that every development-beta hub module loads for someone who is not an admin.
 *
 *   npx tsx scripts/module-beta/verify-hub-routes.ts --base-url=https://interventionalpulm.com
 *   npx tsx scripts/module-beta/verify-hub-routes.ts --base-url=http://localhost:3130
 *
 * Run it against a production build (`next start`) or the deployment. A development server always
 * enables draft modules, so it cannot show a layout guard that answers 404 in production; two hub
 * modules stayed unreachable for every tester that way while the hub's browser suite passed.
 *
 * Requests are signed out, the strictest case for these direct-link routes, and redirects are not
 * followed: a redirect to the sign-in page answers 200 once followed and would read as a pass.
 * The asset checks matter on the deployment only — files the deployed bundle leaves out are served
 * from the module asset origin there, while a local server reads them straight from `public/`.
 * Nothing is written anywhere.
 */

interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

export function parseBaseUrl(argv: readonly string[]): string {
  const argument = argv.find((value) => value.startsWith('--base-url='))
  const unknown = argv.filter((value) => !value.startsWith('--base-url='))
  if (unknown.length > 0) throw new Error(`Unknown argument "${unknown[0]}". Use --base-url=….`)
  if (!argument) throw new Error('Pass --base-url=https://… for the server to check.')
  const baseUrl = argument.slice('--base-url='.length).replace(/\/$/, '')
  if (!/^https?:\/\/[^/]+$/.test(baseUrl)) {
    throw new Error(`--base-url must be an origin such as http://localhost:3130, got "${baseUrl}".`)
  }
  return baseUrl
}

const request = (url: string, headers: Record<string, string> = {}) =>
  fetch(url, { redirect: 'manual', headers })

function describeResponse(response: Response) {
  const location = response.headers.get('location')
  return location ? `${response.status} → ${location}` : String(response.status)
}

/** Every static page of every hub module answers 200, and the module's own page may be framed. */
async function checkModulePages(baseUrl: string, repoRoot: string): Promise<CheckResult[]> {
  const appRoot = path.join(repoRoot, 'src/app/[locale]')
  const results: CheckResult[] = []
  for (const entry of betaModules) {
    const directories = resolveRouteDirectories(appRoot, entry.path)
    if (!directories) {
      results.push({ name: `${entry.id} ${entry.path}`, pass: false, detail: 'no page file found' })
      continue
    }
    for (const address of staticPageAddresses(directories[directories.length - 1], entry.path)) {
      const response = await request(`${baseUrl}/en${address}`)
      const problems: string[] = []
      if (response.status !== 200) problems.push(describeResponse(response))
      if (address === entry.path && response.status === 200) {
        // The testing page shows the module in a same-origin frame, and the module is unlisted.
        if ((response.headers.get('x-frame-options') ?? '').toUpperCase() !== 'SAMEORIGIN')
          problems.push('not frameable by the testing page')
        if (
          !(response.headers.get('content-security-policy') ?? '').includes(
            "frame-ancestors 'self'",
          )
        )
          problems.push('frame-ancestors is not self')
        if (!(response.headers.get('x-robots-tag') ?? '').includes('noindex'))
          problems.push('not marked noindex')
      }
      results.push({
        name: `${entry.id} /en${address}`,
        pass: problems.length === 0,
        detail: problems.length === 0 ? '200' : problems.join('; '),
      })
    }
  }
  return results
}

/** The hub itself still asks a signed-out visitor to sign in. */
async function checkHubGate(baseUrl: string): Promise<CheckResult> {
  const response = await request(`${baseUrl}/en/development-beta`)
  const location = response.headers.get('location') ?? ''
  const pass = response.status >= 300 && response.status < 400 && location.includes('/login')
  return {
    name: 'hub /en/development-beta asks for sign-in',
    pass,
    detail: pass
      ? describeResponse(response)
      : `${describeResponse(response)} — expected a redirect to sign-in (a development server or owner-local mode opens the hub without one)`,
  }
}

async function checkAsset(baseUrl: string, name: string, address: string): Promise<CheckResult> {
  // Only the first kilobyte: several of these are large binaries.
  const response = await request(`${baseUrl}${address}`, { Range: 'bytes=0-1023' })
  const pass = response.status === 200 || response.status === 206
  return { name: `${name} ${address}`, pass, detail: describeResponse(response) }
}

/** The files the anatomy and EBUS modules fetch first, read from the same places the pages do. */
async function checkAssets(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const manifestAddress = '/airway-anatomy/case-001/case_manifest.json'
  const manifestResponse = await request(`${baseUrl}${manifestAddress}`)
  if (manifestResponse.status !== 200) {
    results.push({
      name: `synchronized-anatomy ${manifestAddress}`,
      pass: false,
      detail: describeResponse(manifestResponse),
    })
  } else {
    const manifest = (await manifestResponse.json()) as { assets?: Record<string, string> }
    const assets = manifest.assets ?? {}
    results.push({
      name: `synchronized-anatomy ${manifestAddress}`,
      pass: true,
      detail: '200',
    })
    // What `AirwayAnatomyModule` loads before it can draw anything.
    const needed = [
      assets.airwayGraphJson,
      assets.centerlineLabelsJson,
      assets.ctPreviewRaw,
      assets.reviewedLumenGlb ?? assets.airwayStl,
    ]
    for (const address of needed) {
      results.push(
        address
          ? await checkAsset(baseUrl, 'synchronized-anatomy', address)
          : { name: 'synchronized-anatomy manifest', pass: false, detail: 'an asset is unnamed' },
      )
    }
  }
  results.push(
    await checkAsset(baseUrl, 'live-anatomy', '/fluoroview/airway_segments_new.glb'),
    await checkAsset(
      baseUrl,
      'ebus-guided',
      '/socal-ebus-course/app/guided.html?locale=en&publicTraining=1&publicScope=ebus',
    ),
    await checkAsset(
      baseUrl,
      'eus-b-simulator',
      buildEmbeddedAppSrc(socalEusBSimulatorAppPath, 'en', {
        publicTraining: '1',
        publicScope: 'ebus',
      }),
    ),
    await checkAsset(
      baseUrl,
      'eus-b-simulator',
      '/socal-ebus-course/app/simulator/eus-b-case-001/case_manifest.json',
    ),
  )
  return results
}

async function main() {
  const baseUrl = parseBaseUrl(process.argv.slice(2))
  const repoRoot = path.resolve(__dirname, '../..')
  const results = [
    ...(await checkModulePages(baseUrl, repoRoot)),
    await checkHubGate(baseUrl),
    ...(await checkAssets(baseUrl)),
  ]
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}  ${result.detail}`)
  }
  const failed = results.filter((result) => !result.pass)
  console.log(
    `\n${results.length - failed.length} of ${results.length} checks passed against ${baseUrl}.`,
  )
  if (failed.length > 0) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
