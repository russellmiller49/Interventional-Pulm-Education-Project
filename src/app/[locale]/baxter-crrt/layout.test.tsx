const assertDraftModulesEnabledMock = jest.fn()

jest.mock('@/lib/draft-module-guard', () => ({
  assertDraftModulesEnabled: () => assertDraftModulesEnabledMock(),
}))

import BaxterCrrtLayout from './layout'

describe('Baxter CRRT draft layout', () => {
  beforeEach(() => assertDraftModulesEnabledMock.mockClear())

  it('fails closed through the shared draft guard', async () => {
    const result = await BaxterCrrtLayout({ children: <div>Draft child</div> })
    expect(assertDraftModulesEnabledMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual(<div>Draft child</div>)
  })
})
