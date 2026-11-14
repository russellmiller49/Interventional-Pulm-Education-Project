/** Read-only, signed-out HTTP checks. Does not submit feedback or authenticate a tester. */
import { hubBetaModules } from '../../src/features/module-beta/rollout'
import { betaModuleReviewPath } from '../../src/features/module-beta/catalog'

async function main() {
  const argument = process.argv.find((value) => value.startsWith('--base-url='))
  if (!argument) throw new Error('Pass --base-url=https://interventionalpulm.com explicitly.')
  const base = new URL(argument.slice('--base-url='.length))
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password)
    throw new Error('Use an HTTP(S) origin without credentials.')
  let failed = false
  for (const entry of hubBetaModules) {
    const wrapperPath = `/en/development-beta/${entry.id}`
    const modulePath = `/en${betaModuleReviewPath(entry)}`
    const wrapper = await fetch(new URL(wrapperPath, base), {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    })
    const location = wrapper.headers.get('location')
    const login = location ? new URL(location, base) : null
    const gated =
      wrapper.status === 307 &&
      login?.pathname === '/en/login' &&
      login.searchParams.get('next') === wrapperPath
    const moduleResponse = await fetch(new URL(modulePath, base), {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    })
    const frameable =
      moduleResponse.headers.get('x-frame-options') === 'SAMEORIGIN' &&
      Boolean(
        moduleResponse.headers.get('content-security-policy')?.includes("frame-ancestors 'self'"),
      )
    const passed = gated && moduleResponse.status === 200 && frameable
    failed ||= !passed
    console.log(
      JSON.stringify({
        moduleId: entry.id,
        wrapperStatus: wrapper.status,
        loginGate: gated,
        modulePath,
        moduleStatus: moduleResponse.status,
        frameable,
        passed,
      }),
    )
    await wrapper.body?.cancel()
    await moduleResponse.body?.cancel()
  }
  console.log(
    'Signed-out route checks only; authenticated wrapper access and feedback are untested.',
  )
  process.exitCode = failed ? 1 : 0
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
