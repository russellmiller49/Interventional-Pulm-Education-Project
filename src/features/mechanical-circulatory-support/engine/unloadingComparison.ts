import {
  MCS_UNLOADING_BASE_LEVEL,
  mcsUnloadingExamples,
  type McsUnloadingLevel,
} from '../content/unloadingExamples'
import { MCS_OBSERVATION_SECONDS, mcsTeachingSetup } from './learningSession'
import { advanceMcsSimulation } from './model'
import { mcsReducer } from './reducer'
import type { McsSimulationState } from './types'

export function compareMcsUnloadingState(baseline: McsSimulationState, level: McsUnloadingLevel) {
  const observe = (performanceLevel: number): McsSimulationState => {
    const set = mcsReducer(baseline, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: performanceLevel,
    })
    const observed = advanceMcsSimulation(set, MCS_OBSERVATION_SECONDS)
    return { ...mcsReducer(observed, { type: 'CLEAR_ACTION_LOG' }), responseMessage: '' }
  }
  return { baseline, control: observe(MCS_UNLOADING_BASE_LEVEL), changed: observe(level) }
}

/**
 * Replays the existing CP unloading example. Each condition forks one baseline into
 * an unchanged-setting control and a changed-setting run, observed for equal times.
 * These are provided examples, never learner actions, captures or progress evidence.
 */
export function replayMcsUnloadingComparison(level: McsUnloadingLevel = 6) {
  return mcsUnloadingExamples.map((example) => {
    const baseline = mcsTeachingSetup('impella', [
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: example.preloadPercent },
      {
        type: 'SET_IMPELLA_CONTROL',
        side: 'left',
        control: 'performanceLevel',
        value: MCS_UNLOADING_BASE_LEVEL,
      },
    ])
    return {
      ...example,
      ...compareMcsUnloadingState(baseline, level),
    }
  })
}
