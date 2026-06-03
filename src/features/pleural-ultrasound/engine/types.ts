export type EffusionPattern =
  | 'simpleAnechoic'
  | 'complexNonSeptated'
  | 'septatedLoculated'
  | 'echogenic'
  | 'noDrainableEffusion'

export type ManagementImplication =
  | 'thoraReasonable'
  | 'considerTubeAndAdjuncts'
  | 'noPleuralDrainageTarget'

export interface PatternScore {
  correct: boolean
  teachingPoint: string
}
