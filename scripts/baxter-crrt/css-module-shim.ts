/**
 * Lets CRRT components render under a bare `npx tsx` run.
 *
 * Node has no idea what a `*.module.css` import means, so `CrrtPilotCircuit`
 * fails to resolve at line one without this. The shim maps every CSS module to
 * an identity proxy: `styles.panel` becomes the string `"panel"`, which is
 * exactly the selector written in the checked-in stylesheet. That means the
 * review page can inline the real CSS file verbatim and have it match the
 * rendered markup, rather than showing a re-emitted copy.
 *
 * Import this before anything that reaches a component.
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

/**
 * `registerHooks` is the synchronous, in-thread hook API. It exists on the Node
 * version this repository targets but is not yet in the installed `@types/node`,
 * so the surface it is used through is declared above rather than suppressed.
 */
const registerHooks = (nodeModule as unknown as { registerHooks: (hooks: ModuleHooks) => void })
  .registerHooks

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return {
        url: new URL(specifier, context.parentURL).href,
        shortCircuit: true,
        format: 'module',
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: [
          'const handler = { get: (_target, key) => (typeof key === "string" ? key : undefined) }',
          'export default new Proxy({}, handler)',
        ].join('\n'),
      }
    }
    return nextLoad(url, context)
  },
})
