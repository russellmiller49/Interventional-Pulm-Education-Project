export const pacGuidedSkillIds = [
  'pressure-system',
  'catheter-advancement',
  'pawp-capture',
  'thermodilution-series',
  'derived-hemodynamics',
] as const

export type PacGuidedSkillId = (typeof pacGuidedSkillIds)[number]
