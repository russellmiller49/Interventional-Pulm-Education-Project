import { searchSite } from './site-search'

describe('CARDIOHELP ECMO site search', () => {
  it('does not expose the unlisted testing route in ordinary site search', () => {
    expect(searchSite('cardiohelp', 10)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/cardiohelp-ecmo' })]),
    )
  })

  it('indexes the draft module for authorized draft viewers', () => {
    expect(searchSite('cardiohelp', 10, { canViewDrafts: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/cardiohelp-ecmo',
          title: expect.stringContaining('CARDIOHELP-i'),
        }),
      ]),
    )
  })

  it('keeps the canonical route stable for localized search', () => {
    expect(searchSite('ecmo', 10, { canViewDrafts: true, locale: 'es' })).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/cardiohelp-ecmo' })]),
    )
  })
})
