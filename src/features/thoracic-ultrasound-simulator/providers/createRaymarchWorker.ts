/**
 * Isolated so the webpack-specific `new Worker(new URL(...), import.meta.url)`
 * syntax is only parsed in browser bundles. Consumers must load this module via
 * dynamic import() after confirming `typeof Worker !== 'undefined'` — Jest's
 * CJS transform never evaluates it, and jsdom falls back to the synchronous
 * render path.
 */
export function createRaymarchWorker(): Worker {
  return new Worker(new URL('./raymarch.worker.ts', import.meta.url))
}
