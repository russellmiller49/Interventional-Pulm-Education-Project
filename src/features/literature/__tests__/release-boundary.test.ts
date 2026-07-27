import { isDraftModulePath, isVisibleModulePath } from '@/lib/draft-modules'

describe('literature release boundary', () => {
  it('keeps search, article, and methods routes in the draft-module boundary', () => {
    for (const path of [
      '/literature',
      '/es/literature',
      '/zh-CN/literature/methods',
      '/literature/article/12345678',
    ]) {
      expect(isDraftModulePath(path)).toBe(true)
    }
  })

  it('allows an administrator to resolve the draft route explicitly', () => {
    expect(
      isVisibleModulePath('/literature', {
        isAdmin: true,
      }),
    ).toBe(true)
  })
})
