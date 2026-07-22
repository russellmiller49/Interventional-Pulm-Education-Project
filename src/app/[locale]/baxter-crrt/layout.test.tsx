const assertDraftModulesEnabledMock = jest.fn()

jest.mock('@/lib/draft-module-guard', () => ({
  assertDraftModulesEnabled: () => assertDraftModulesEnabledMock(),
}))

import BaxterCrrtLayout from './layout'

describe('Baxter CRRT unlisted public layout', () => {
  beforeEach(() => assertDraftModulesEnabledMock.mockClear())

  it('does not invoke the authenticated draft guard', async () => {
    const result = await BaxterCrrtLayout({ children: <div>Preview child</div> })
    expect(assertDraftModulesEnabledMock).not.toHaveBeenCalled()
    expect(result).toEqual(<div>Preview child</div>)
  })
})
