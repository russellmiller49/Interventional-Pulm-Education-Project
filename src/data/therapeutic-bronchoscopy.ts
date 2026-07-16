export const therapeuticBronchoscopyModules = [
  {
    id: 'rigidBronchoscopy',
    href: '/rigid-bronchoscopy',
  },
  {
    id: 'thermalAblation',
    href: '/thermal-ablation',
  },
  {
    id: 'peripheralAblation',
    href: '/peripheral-ablation',
  },
  {
    id: 'airwayStents',
    href: '/airway-stent-mechanics',
  },
] as const

export type TherapeuticBronchoscopyModuleId = (typeof therapeuticBronchoscopyModules)[number]['id']
