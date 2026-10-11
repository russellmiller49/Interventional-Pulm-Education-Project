const assertDraftModulesEnabledMock = jest.fn()

jest.mock('@/lib/draft-module-guard', () => ({
  assertDraftModulesEnabled: () => assertDraftModulesEnabledMock(),
}))

import MechanicalVentilationLayout from './layout'

describe('Mechanical Ventilation tester-preview layout', () => {
  beforeEach(() => assertDraftModulesEnabledMock.mockClear())

  it('does not invoke the authenticated draft guard', async () => {
    const result = await MechanicalVentilationLayout({ children: <div>Preview child</div> })
    expect(assertDraftModulesEnabledMock).not.toHaveBeenCalled()
    expect(result).toEqual(<div>Preview child</div>)
  })
})
