const assertDraftModulesEnabledMock = jest.fn()

jest.mock('@/lib/draft-module-guard', () => ({
  assertDraftModulesEnabled: (options?: unknown) => assertDraftModulesEnabledMock(options),
}))

import IntroBronchoscopyCourseLayout from './layout'

describe('Intro bronchoscopy course layout', () => {
  beforeEach(() => assertDraftModulesEnabledMock.mockClear())

  it('keeps the course pages behind the enrollment guard', async () => {
    const result = await IntroBronchoscopyCourseLayout({ children: <div>Course child</div> })
    expect(assertDraftModulesEnabledMock).toHaveBeenCalledTimes(1)
    expect(assertDraftModulesEnabledMock).toHaveBeenCalledWith({ allowPccmIntroCourse: true })
    expect(result).toEqual(<div>Course child</div>)
  })
})
