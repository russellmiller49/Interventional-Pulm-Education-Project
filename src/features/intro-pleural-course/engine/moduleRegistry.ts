import type { PleuralModule, PleuralSection } from '@/features/pleural-procedures/content/types'

export const introPleuralModules: readonly PleuralModule[] = [
  {
    id: 'pleural-ultrasound',
    title: 'Pleural Ultrasound Pattern Lab',
    route: '/pleural-procedures/pleural-ultrasound',
    section: 'ultrasound',
    minutes: 18,
    status: 'live',
  },
  {
    id: 'pleural-fluid-analysis',
    title: 'Pleural Fluid Analysis',
    route: '/pleural-procedures/pleural-fluid-analysis',
    section: 'fluid',
    minutes: 25,
    status: 'live',
  },
  {
    id: 'thoracentesis-planner',
    title: 'Thoracentesis Planner',
    route: '/pleural-procedures/thoracentesis-planner',
    section: 'thoracentesis',
    minutes: 22,
    status: 'live',
  },
  {
    id: 'chest-drainage',
    title: 'Chest Drainage Systems',
    route: '/pleural-procedures/chest-drainage',
    section: 'chest-tube',
    minutes: 35,
    status: 'live',
  },
  {
    id: 'pleural-infection',
    title: 'Pleural Infection Workflow',
    route: '/pleural-procedures/pleural-infection',
    section: 'infection',
    minutes: 25,
    status: 'live',
  },
  {
    id: 'pneumothorax-pathway',
    title: 'Pneumothorax Pathway',
    route: '/pleural-procedures/pneumothorax-pathway',
    section: 'pneumothorax',
    minutes: 22,
    status: 'live',
  },
  {
    id: 'malignant-effusion',
    title: 'Malignant Pleural Effusion Pathway',
    route: '/pleural-procedures/malignant-effusion',
    section: 'malignant',
    minutes: 24,
    status: 'live',
  },
  {
    id: 'outpatient-pleural',
    title: 'Outpatient Pleural Clinic',
    route: '/coming-soon',
    section: 'outpatient',
    minutes: 20,
    status: 'planned',
  },
  {
    id: 'pleural-algorithms',
    title: 'Integrated Pleural Algorithms',
    route: '/pleural-procedures/intro-course',
    section: 'algorithms',
    minutes: 15,
    status: 'live',
  },
  {
    id: 'pleural-anatomy',
    title: 'Pleural Anatomy and Access Windows',
    route: '/pleural-procedures/thoracentesis-planner',
    section: 'anatomy',
    minutes: 15,
    status: 'live',
  },
] as const

export function getModulesForSection(section: PleuralSection) {
  return introPleuralModules.filter((module) => module.section === section)
}
