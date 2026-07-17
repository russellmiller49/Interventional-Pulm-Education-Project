import {
  createPrismaflexReviewConsoleState,
  getPrismaflexReviewSetupStepId,
  reducePrismaflexReviewConsole,
} from '../prismaflexReviewConsoleModel'

describe('Prismaflex reviewer console model', () => {
  it('browses the sourced setup sequence without changing a device state', () => {
    const initial = createPrismaflexReviewConsoleState()
    const next = reducePrismaflexReviewConsole(initial, {
      type: 'MOVE_SETUP_STEP',
      direction: 'next',
    })

    expect(getPrismaflexReviewSetupStepId(initial)).toBe('choose-patient')
    expect(getPrismaflexReviewSetupStepId(next)).toBe('enter-patient-information')
    expect(next).toEqual({ viewId: 'setup', setupStepIndex: 1 })
    expect(Object.isFrozen(next)).toBe(true)
  })

  it('clamps setup browsing and ignores step actions outside the setup view', () => {
    const initial = createPrismaflexReviewConsoleState()
    expect(
      reducePrismaflexReviewConsole(initial, {
        type: 'MOVE_SETUP_STEP',
        direction: 'previous',
      }),
    ).toBe(initial)

    const profile = reducePrismaflexReviewConsole(initial, {
      type: 'SELECT_VIEW',
      viewId: 'profile',
    })
    expect(
      reducePrismaflexReviewConsole(profile, {
        type: 'MOVE_SETUP_STEP',
        direction: 'next',
      }),
    ).toBe(profile)
  })

  it('resets navigation to an isolated initial review state', () => {
    const changed = reducePrismaflexReviewConsole(
      reducePrismaflexReviewConsole(createPrismaflexReviewConsoleState(), {
        type: 'MOVE_SETUP_STEP',
        direction: 'next',
      }),
      { type: 'SELECT_VIEW', viewId: 'alarm-taxonomy' },
    )

    expect(reducePrismaflexReviewConsole(changed, { type: 'RESET' })).toEqual({
      viewId: 'setup',
      setupStepIndex: 0,
    })
  })
})
