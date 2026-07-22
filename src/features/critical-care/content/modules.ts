export type CriticalCareModuleIcon =
  | 'hemodynamics'
  | 'ventilation'
  | 'circulatory-support'
  | 'ecmo'
  | 'crrt'

export interface CriticalCareModuleDefinition {
  slug: string
  title: string
  eyebrow: string
  description: string
  href: string
  icon: CriticalCareModuleIcon
  topics: readonly string[]
}

export const criticalCareModules = [
  {
    slug: 'icu-hemodynamics',
    title: 'ICU Hemodynamics Lab',
    eyebrow: 'Hemodynamic assessment',
    description:
      'Build fluency with pulmonary artery catheter waveforms, thermodilution, derived values, shock physiology, and bedside management cases.',
    href: '/icu-hemodynamics',
    icon: 'hemodynamics',
    topics: ['PAC skills', 'Waveforms', 'Shock cases'],
  },
  {
    slug: 'mechanical-ventilation',
    title: 'Mechanical Ventilation',
    eyebrow: 'Respiratory support',
    description:
      'Practice ventilator setup, waveform interpretation, patient–ventilator interaction, and case-based troubleshooting across multiple training consoles.',
    href: '/mechanical-ventilation',
    icon: 'ventilation',
    topics: ['Ventilator setup', 'Waveforms', 'Troubleshooting'],
  },
  {
    slug: 'mechanical-circulatory-support',
    title: 'Mechanical Circulatory Support',
    eyebrow: 'Circulatory support',
    description:
      'Compare IABP counterpulsation, Impella CP-family support, and durable continuous-flow LVAD assessment through guided learning and ICU cases.',
    href: '/mechanical-circulatory-support',
    icon: 'circulatory-support',
    topics: ['IABP', 'Impella', 'LVAD'],
  },
  {
    slug: 'cardiohelp-ecmo',
    title: 'CARDIOHELP ECMO',
    eyebrow: 'Extracorporeal support',
    description:
      'Learn and practice adult VV and peripheral VA ECMO console operation, circuit assessment, alarms, transport, and troubleshooting.',
    href: '/cardiohelp-ecmo',
    icon: 'ecmo',
    topics: ['VV ECMO', 'VA ECMO', 'Circuit safety'],
  },
  {
    slug: 'baxter-crrt',
    title: 'Baxter CRRT',
    eyebrow: 'Renal support',
    description:
      'Work through CRRT concepts, PrisMax and Prismaflex workflows, safety drills, case-based practice, and mastery assessment.',
    href: '/baxter-crrt',
    icon: 'crrt',
    topics: ['CRRT concepts', 'Device workflow', 'Safety drills'],
  },
] as const satisfies readonly CriticalCareModuleDefinition[]
