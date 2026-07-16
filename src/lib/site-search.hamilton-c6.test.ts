import { searchSite } from './site-search'

describe('HAMILTON-C6 ventilation site search', () => {
  it('indexes the draft simulator in the local draft-enabled search environment', () => {
    expect(searchSite('mechanical ventilation', 10)).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/hamilton-c6-ventilation' })]),
    )
  })

  it('indexes the simulator for an authorized draft viewer', () => {
    expect(searchSite('mechanical ventilation', 10, { canViewDrafts: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/hamilton-c6-ventilation',
          title: expect.stringContaining('HAMILTON-C6'),
        }),
      ]),
    )
  })

  it('keeps reviewed-English search copy on non-English routes', () => {
    expect(searchSite('hamilton', 10, { canViewDrafts: true, locale: 'es' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/hamilton-c6-ventilation',
          section: 'Simulation',
        }),
      ]),
    )
  })
})
