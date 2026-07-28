type SearchValue = string | string[] | undefined

export interface PreferenceCardSearchParams {
  mode?: SearchValue
}

/**
 * Print-view options.
 *
 * This module used to reconstruct a whole card from the query string — modifiers,
 * conditional states, item selections, waivers, in blobs up to 60 KB — because saving did
 * not work and the wizard had to encode its result into a URL. Cards are stored per user
 * now, so the only thing left to read from the URL is which print layout to render.
 */
export function parsePreferenceCardSearch(params: PreferenceCardSearchParams): {
  mode: 'spatial' | 'chronological'
} {
  const raw = Array.isArray(params.mode) ? params.mode[0] : params.mode
  return { mode: raw === 'chronological' ? 'chronological' : 'spatial' }
}
