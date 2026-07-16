import { searchSite } from './site-search'

describe('Baxter CRRT site search boundary', () => {
  it.each([
    ['ordinary', {}],
    ['draft preview', { canViewDrafts: true }],
    ['Spanish draft preview', { canViewDrafts: true, locale: 'es' as const }],
    ['Simplified Chinese draft preview', { canViewDrafts: true, locale: 'zh-CN' as const }],
  ])('keeps the authenticated unlisted route out of %s search', (_label, options) => {
    expect(searchSite('baxter crrt prismax', 20, options)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/baxter-crrt' })]),
    )
  })
})
