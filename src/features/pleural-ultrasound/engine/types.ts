export type EffusionPattern =
  | 'simpleAnechoic'
  | 'complexNonSeptated'
  | 'septatedLoculated'
  | 'echogenic'

export type ManagementImplication = 'thoraReasonable' | 'considerTubeAndAdjuncts'

export interface PatternScore {
  correct: boolean
  teachingPoint: string
}
