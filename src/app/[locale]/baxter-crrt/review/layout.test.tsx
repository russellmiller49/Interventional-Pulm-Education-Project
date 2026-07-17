const assertDraftModulesEnabledMock = jest.fn()

jest.mock('@/lib/draft-module-guard', () => ({
  assertDraftModulesEnabled: () => assertDraftModulesEnabledMock(),
}))

import BaxterCrrtReviewLayout from './layout'

describe('Baxter CRRT reviewer-route guard', () => {
  beforeEach(() => assertDraftModulesEnabledMock.mockClear())

  it('always requires draft/admin authorization before composing reviewer code', async () => {
    const child = <div>review workspace</div>

    await expect(BaxterCrrtReviewLayout({ children: child })).resolves.toBe(child)
    expect(assertDraftModulesEnabledMock).toHaveBeenCalledTimes(1)
  })
})
