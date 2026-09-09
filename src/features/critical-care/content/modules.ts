export type CriticalCareModuleIcon =
  | 'hemodynamics'
  | 'ventilation'
  | 'circulatory-support'
  | 'ecmo'
  | 'crrt'

/**
 * The catalog: every module the learning center knows, including the integrated ICU Simulator.
 *
 * Two lists live in this file on purpose. This one is the complete, internal catalog — activity-id
 * prefixes, sections, the integrated flag — read by the dashboard, the pathways and the activity
 * registry. The five-card launcher below it is the hub's compatibility surface: the same modules
 * minus the simulator, with the icon, eyebrow, description and topics the launcher card prints,
 * in the order it has always had. What the two must never do is disagree about a module's name: a
 * learner met "CARDIOHELP ECMO" on the hub card and "ECMO Management" on the pathway, the lab
 * library and the module's own page. So the launcher takes its title and subtitle from here, and
 * `__tests__/catalogs.test.ts` pins the agreement.
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

export interface CriticalCareModuleDefinition {
  slug: string
  /** From the catalog entry of the same id — one name per module across every surface. */
  title: string
  /** From the catalog entry of the same id, where it has one. */
  subtitle?: string
  eyebrow: string
  description: string
  href: string
  icon: CriticalCareModuleIcon
  topics: readonly string[]
}

/**
 * A module's name and subtitle as the catalog states them. The launcher entries spread this in so
 * the card can never say something the module's own page does not.
 */
function catalogIdentity(id: CriticalCareCatalogModuleId): {
  readonly title: string
  readonly subtitle?: string
} {
  const entry = criticalCareModuleById.get(id)
  if (!entry) throw new Error(`No critical-care catalog entry for ${id}`)
  return entry.subtitle ? { title: entry.title, subtitle: entry.subtitle } : { title: entry.title }
}

/**
 * The five-card launcher on the hub. A compatibility surface: its order is the one the hub has
 * always had, and it omits the integrated ICU Simulator.
 */
export const criticalCareModules = [
  {
    slug: 'icu-hemodynamics',
    ...catalogIdentity('icu-hemodynamics'),
    eyebrow: 'Hemodynamic reasoning',
    description:
      'Build fluency with pulmonary artery catheter waveforms, thermodilution, derived values, shock physiology, and bedside management cases.',
    href: '/icu-hemodynamics',
    icon: 'hemodynamics',
    topics: ['PAC skills', 'Waveforms', 'Shock cases'],
  },
  {
    slug: 'mechanical-ventilation',
    ...catalogIdentity('mechanical-ventilation'),
    eyebrow: 'Respiratory support',
    description:
      'Practice ventilator setup, waveform interpretation, patient–ventilator interaction, and case-based troubleshooting across multiple training consoles.',
    href: '/mechanical-ventilation',
    icon: 'ventilation',
    topics: ['Ventilator setup', 'Waveforms', 'Troubleshooting'],
  },
  {
    slug: 'mechanical-circulatory-support',
    ...catalogIdentity('mechanical-circulatory-support'),
    eyebrow: 'Circulatory support',
    description:
      'Compare IABP counterpulsation, Impella CP-family support, and durable continuous-flow LVAD behavior through guided learning and ICU cases.',
    href: '/mechanical-circulatory-support',
    icon: 'circulatory-support',
    topics: ['IABP', 'Impella', 'LVAD'],
  },
  {
    slug: 'cardiohelp-ecmo',
    ...catalogIdentity('cardiohelp-ecmo'),
    eyebrow: 'Extracorporeal support',
    description:
      'Learn and practice adult VV and peripheral VA ECMO console operation, circuit review, alarms, transport, and troubleshooting.',
    href: '/cardiohelp-ecmo',
    icon: 'ecmo',
    topics: ['VV ECMO', 'VA ECMO', 'Circuit safety'],
  },
  {
    slug: 'baxter-crrt',
    ...catalogIdentity('baxter-crrt'),
    eyebrow: 'Renal support',
    description:
      'Work through CRRT concepts, PrisMax and Prismaflex workflows, safety drills, case-based practice, and an advanced challenge.',
    href: '/baxter-crrt',
    icon: 'crrt',
    topics: ['CRRT concepts', 'Device workflow', 'Safety drills'],
  },
] as const satisfies readonly CriticalCareModuleDefinition[]
