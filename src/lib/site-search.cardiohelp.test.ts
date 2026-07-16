import { searchSite } from './site-search'

describe('CARDIOHELP ECMO site search', () => {
  it('does not expose the unlisted testing route in ordinary or draft-preview search', () => {
    expect(searchSite('cardiohelp', 10)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/cardiohelp-ecmo' })]),
    )
    expect(searchSite('cardiohelp', 10, { canViewDrafts: true })).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/cardiohelp-ecmo',
        }),
      ]),
    )
  })

  it('does not leak the route through localized search', () => {
    expect(searchSite('ecmo', 10, { canViewDrafts: true, locale: 'es' })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/cardiohelp-ecmo' })]),
    )
  })
})
