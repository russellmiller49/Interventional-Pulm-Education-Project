/**
 * Lets CRRT components that link between routes render under a bare `npx tsx` run.
 *
 * `@/i18n/navigation` builds its `Link` and `useRouter` from next-intl's shared navigation
 * factory, which reads the locale out of a React context that only exists inside a running Next
 * request. Wrapping the tree in a provider does not help: the factory resolves its own copy of the
 * context module, so the offline render still throws at the first `useLocale()`.
 *
 * The review harness only needs the markup, so this maps the module to plain anchors and a no-op
 * router — exactly what the jest suites already do with `jest.mock('@/i18n/navigation', …)`. Hrefs
 * are resolved the same way, so a link's destination is still reviewable on the page.
 *
 * Import this before anything that reaches a component, and alongside `./css-module-shim`.
 */
import * as nodeModule from 'node:module'

interface ResolveContext {
  readonly parentURL?: string
}

interface ResolveResult {
  readonly url: string
  readonly shortCircuit?: boolean
  readonly format?: string
}

interface LoadContext {
  readonly format?: string
}

interface LoadResult {
  readonly format: string
  readonly shortCircuit?: boolean
  readonly source: string
}

interface ModuleHooks {
  readonly resolve?: (
    specifier: string,
    context: ResolveContext,
    nextResolve: (specifier: string, context: ResolveContext) => ResolveResult,
  ) => ResolveResult
  readonly load?: (
    url: string,
    context: LoadContext,
    nextLoad: (url: string, context: LoadContext) => LoadResult,
  ) => LoadResult
}

const NAVIGATION_SPECIFIER = '@/i18n/navigation'
/** A synthetic URL the load hook recognises. Nothing on disk has to exist at this path. */
const NAVIGATION_STUB_URL = 'crrt-review:i18n-navigation'

const NAVIGATION_STUB_SOURCE = [
  "import { createElement } from 'react'",
  '',
  'function resolveHref(href) {',
  "  if (typeof href === 'string') return href",
  '  const query = new URLSearchParams(href.query ?? {}).toString()',
  '  return query ? `${href.pathname}?${query}` : href.pathname',
  '}',
  '',
  'export function Link({ href, children, ...rest }) {',
  "  return createElement('a', { href: resolveHref(href), ...rest }, children)",
  '}',
  '',
  'const noop = () => {}',
  'export function useRouter() {',
  '  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop }',
  '}',
  '',
  "export const usePathname = () => '/'",
  'export const redirect = noop',
  'export const permanentRedirect = noop',
  'export const getPathname = resolveHref',
].join('\n')

const registerHooks = (nodeModule as unknown as { registerHooks: (hooks: ModuleHooks) => void })
  .registerHooks

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === NAVIGATION_SPECIFIER) {
      return { url: NAVIGATION_STUB_URL, shortCircuit: true, format: 'module' }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === NAVIGATION_STUB_URL) {
      return { format: 'module', shortCircuit: true, source: NAVIGATION_STUB_SOURCE }
    }
    return nextLoad(url, context)
  },
})
