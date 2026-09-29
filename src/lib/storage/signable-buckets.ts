/**
 * The buckets this unauthenticated signer may sign for: those its callers use (board-review audio,
 * printable models). It signs with the service key, so any other bucket, including every private
 * one, is refused, and a path may not climb out of its bucket.
 */
export const SIGNABLE_BUCKETS: ReadonlySet<string> = new Set([
  'Audio_companion',
  '3d-models',
  'module-assets',
])

export function isSafeObjectPath(path: string): boolean {
  if (path.length > 1024 || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return false
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .every((segment) => segment !== '.' && segment !== '..' && !/%2e|%2f|%5c/i.test(segment))
}
