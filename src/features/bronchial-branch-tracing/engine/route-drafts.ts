import { DRAFT_PREFIX } from './ct-draft'

/**
 * Whether this device keeps a Practice or More routes draft. Reads storage keys only: a draft is a
 * saved place in a route set, never a result, and nothing is parsed, written or counted here.
 */
export function savedRouteDrafts(storage: Storage | null) {
  const found = { practice: false, assess: false }
  if (!storage) return found
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX) || key.includes('.recovery.')) continue
      const rest = key.slice(DRAFT_PREFIX.length)
      if (rest.startsWith('practice.')) found.practice = true
      if (rest.startsWith('assess.')) found.assess = true
    }
  } catch {
    /* Unavailable storage shows nothing; the route pages explain saving themselves. */
  }
  return found
}
