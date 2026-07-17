import {
  prismaflexSetupSteps,
  type PrismaflexSetupStepId,
} from './engine/deviceAdapters/prismaflex'

export const PRISMAFLEX_REVIEW_CONSOLE_VIEW_IDS = [
  'setup',
  'profile',
  'calculations',
  'alarm-taxonomy',
] as const

export type PrismaflexReviewConsoleViewId = (typeof PRISMAFLEX_REVIEW_CONSOLE_VIEW_IDS)[number]

export interface PrismaflexReviewConsoleState {
  readonly viewId: PrismaflexReviewConsoleViewId
  readonly setupStepIndex: number
}

export type PrismaflexReviewConsoleAction =
  | { readonly type: 'SELECT_VIEW'; readonly viewId: PrismaflexReviewConsoleViewId }
  | { readonly type: 'MOVE_SETUP_STEP'; readonly direction: 'previous' | 'next' }
  | { readonly type: 'RESET' }

export function createPrismaflexReviewConsoleState(): PrismaflexReviewConsoleState {
  return Object.freeze({ viewId: 'setup', setupStepIndex: 0 })
}

export function getPrismaflexReviewSetupStepId(
  state: PrismaflexReviewConsoleState,
): PrismaflexSetupStepId {
  const step = prismaflexSetupSteps[state.setupStepIndex]
  if (!step) throw new Error('Prismaflex reviewer setup-step index is out of range.')
  return step.id
}

export function reducePrismaflexReviewConsole(
  state: PrismaflexReviewConsoleState,
  action: PrismaflexReviewConsoleAction,
): PrismaflexReviewConsoleState {
  if (action.type === 'RESET') return createPrismaflexReviewConsoleState()
  if (action.type === 'SELECT_VIEW') {
    if (action.viewId === state.viewId) return state
    return Object.freeze({ ...state, viewId: action.viewId })
  }
  if (action.type === 'MOVE_SETUP_STEP') {
    if (state.viewId !== 'setup') return state
    const offset = action.direction === 'next' ? 1 : -1
    const nextIndex = Math.min(
      prismaflexSetupSteps.length - 1,
      Math.max(0, state.setupStepIndex + offset),
    )
    if (nextIndex === state.setupStepIndex) return state
    return Object.freeze({ ...state, setupStepIndex: nextIndex })
  }
  return assertNever(action)
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Prismaflex reviewer-console action: ${JSON.stringify(value)}`)
}
