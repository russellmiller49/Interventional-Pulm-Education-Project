import { searchSite } from './site-search'

describe('multi-device mechanical ventilation site search', () => {
  it('indexes the draft simulator in the local draft-enabled search environment', () => {
    expect(searchSite('mechanical ventilation', 10)).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/mechanical-ventilation' })]),
    )
  })

  it('indexes the simulator for an authorized draft viewer', () => {
    expect(searchSite('mechanical ventilation', 10, { canViewDrafts: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/mechanical-ventilation',
          title: expect.stringContaining('Multi-Device'),
        }),
      ]),
    )
  })

  it('keeps reviewed-English search copy on non-English routes', () => {
    expect(searchSite('hamilton', 10, { canViewDrafts: true, locale: 'es' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/mechanical-ventilation',
          section: 'Simulation',
        }),
      ]),
    )
  })
})
