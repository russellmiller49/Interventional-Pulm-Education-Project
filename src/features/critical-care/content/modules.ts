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
    eyebrow: 'Hemodynamic reasoning',
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
      'Compare IABP counterpulsation, Impella CP-family support, and durable continuous-flow LVAD behavior through guided learning and ICU cases.',
    href: '/mechanical-circulatory-support',
    icon: 'circulatory-support',
    topics: ['IABP', 'Impella', 'LVAD'],
  },
  {
    slug: 'cardiohelp-ecmo',
    title: 'CARDIOHELP ECMO',
    eyebrow: 'Extracorporeal support',
    description:
      'Learn and practice adult VV and peripheral VA ECMO console operation, circuit review, alarms, transport, and troubleshooting.',
    href: '/cardiohelp-ecmo',
    icon: 'ecmo',
    topics: ['VV ECMO', 'VA ECMO', 'Circuit safety'],
  },
  {
    slug: 'baxter-crrt',
    title: 'Baxter CRRT',
    eyebrow: 'Renal support',
    description:
      'Work through CRRT concepts, PrisMax and Prismaflex workflows, safety drills, case-based practice, and an advanced challenge.',
    href: '/baxter-crrt',
    icon: 'crrt',
    topics: ['CRRT concepts', 'Device workflow', 'Safety drills'],
  },
] as const satisfies readonly CriticalCareModuleDefinition[]

/**
 * The five-card launcher above is a compatibility surface. The catalog below
 * adds the integrated ICU Simulator without changing that launcher or its
 * long-standing order.
 */
export const criticalCareCatalogModuleIds = [
  'icu-hemodynamics',
  'mechanical-ventilation',
  'mechanical-circulatory-support',
  'cardiohelp-ecmo',
  'baxter-crrt',
  'icu-simulation',
] as const

export type CriticalCareCatalogModuleId = (typeof criticalCareCatalogModuleIds)[number]

export const criticalCareActivityIdPrefixes = [
  'hemodynamics',
  'ventilation',
  'mcs',
  'ecmo',
  'crrt',
  'icu',
] as const

export type CriticalCareActivityIdPrefix = (typeof criticalCareActivityIdPrefixes)[number]

export interface CriticalCareCatalogModuleDefinition {
  readonly id: CriticalCareCatalogModuleId
  readonly activityIdPrefix: CriticalCareActivityIdPrefix
  readonly title: string
  readonly subtitle?: string
  readonly href: string
  readonly integrated: boolean
  readonly sections: readonly ('overview' | 'learn' | 'practice' | 'assess' | 'sandbox')[]
}

export const criticalCareModuleCatalog = [
  {
    id: 'icu-hemodynamics',
    activityIdPrefix: 'hemodynamics',
    title: 'ICU Hemodynamics Lab',
    href: '/icu-hemodynamics',
    integrated: false,
    sections: ['overview', 'learn', 'practice', 'assess'],
  },
  {
    id: 'mechanical-ventilation',
    activityIdPrefix: 'ventilation',
    title: 'Mechanical Ventilation',
    href: '/mechanical-ventilation',
    integrated: false,
    sections: ['overview', 'learn', 'practice', 'assess'],
  },
  {
    id: 'mechanical-circulatory-support',
    activityIdPrefix: 'mcs',
    title: 'Mechanical Circulatory Support',
    href: '/mechanical-circulatory-support',
    integrated: false,
    sections: ['overview', 'learn', 'practice', 'assess'],
  },
  {
    id: 'cardiohelp-ecmo',
    activityIdPrefix: 'ecmo',
    title: 'ECMO Management',
    subtitle: 'CARDIOHELP console lab',
    href: '/cardiohelp-ecmo',
    integrated: false,
    sections: ['overview', 'learn', 'practice', 'assess'],
  },
  {
    id: 'baxter-crrt',
    activityIdPrefix: 'crrt',
    title: 'CRRT',
    subtitle: 'PrisMax console lab',
    href: '/baxter-crrt',
    integrated: false,
    sections: ['overview', 'learn', 'practice', 'assess'],
  },
  {
    id: 'icu-simulation',
    activityIdPrefix: 'icu',
    title: 'Integrated ICU Simulator',
    href: '/icu-simulation',
    integrated: true,
    sections: ['overview', 'learn', 'practice', 'assess', 'sandbox'],
  },
] as const satisfies readonly CriticalCareCatalogModuleDefinition[]

export const criticalCareModuleById: ReadonlyMap<
  CriticalCareCatalogModuleId,
  CriticalCareCatalogModuleDefinition
> = new Map(criticalCareModuleCatalog.map((module) => [module.id, module]))
