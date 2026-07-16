import sitemap from './sitemap'

describe('Baxter CRRT sitemap boundary', () => {
  it('does not list the authenticated draft route', () => {
    expect(sitemap().some((entry) => entry.url.endsWith('/baxter-crrt'))).toBe(false)
  })
})
