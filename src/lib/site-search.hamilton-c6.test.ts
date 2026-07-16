import { searchSite } from './site-search'

describe('multi-device mechanical ventilation site search', () => {
  it('does not expose the unlisted tester route in ordinary or draft-preview search', () => {
    expect(searchSite('mechanical ventilation', 10)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/mechanical-ventilation' })]),
    )
    expect(searchSite('mechanical ventilation', 10, { canViewDrafts: true })).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/mechanical-ventilation',
        }),
      ]),
    )
  })

  it('does not leak the route through localized search', () => {
    expect(searchSite('hamilton', 10, { canViewDrafts: true, locale: 'es' })).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/mechanical-ventilation',
        }),
      ]),
    )
  })
})
