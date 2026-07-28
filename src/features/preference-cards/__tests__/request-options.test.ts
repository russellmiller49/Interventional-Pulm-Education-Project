import { parsePreferenceCardSearch } from '../data/request-options'

describe('preference-card print options', () => {
  it('reads the print layout from the query string', () => {
    expect(parsePreferenceCardSearch({ mode: 'chronological' }).mode).toBe('chronological')
    expect(parsePreferenceCardSearch({ mode: 'spatial' }).mode).toBe('spatial')
  })

  it('falls back to the spatial layout for anything unexpected', () => {
    expect(parsePreferenceCardSearch({}).mode).toBe('spatial')
    expect(parsePreferenceCardSearch({ mode: 'unexpected' }).mode).toBe('spatial')
    expect(parsePreferenceCardSearch({ mode: ['chronological', 'spatial'] }).mode).toBe(
      'chronological',
    )
  })

  it('no longer reconstructs a card from the URL', () => {
    // Cards are stored per user now. The old parser rebuilt an entire card from query
    // blobs up to 60 KB — modifiers, conditional states, item selections, waivers — because
    // saving did not work; carrying that forward would be a second, unauthenticated way to
    // materialize a card.
    const parsed = parsePreferenceCardSearch({ mode: 'spatial' } as Record<string, string>)
    expect(Object.keys(parsed)).toEqual(['mode'])
  })
})
