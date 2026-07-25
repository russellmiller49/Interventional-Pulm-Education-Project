export const pacGuidedSkillIds = [
  'catheter-advancement',
  'pressure-system',
  'waveform-interpretation',
  'pawp-capture',
  'thermodilution-series',
  'derived-hemodynamics',
] as const

export type PacGuidedSkillId = (typeof pacGuidedSkillIds)[number]
