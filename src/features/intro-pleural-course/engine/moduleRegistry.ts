import type { PleuralModule, PleuralSection } from '@/features/pleural-procedures/content/types'

/**
 * Single source of truth for the pleural curriculum.
 *
 * Drives BOTH the pretest prescription (section → modules) and the ordered
 * learning-path landing page. `order` sets the path sequence; the experimental
 * 3D simulator is flagged so the landing page shows it outside the numbered
 * path. Every PleuralSection used by the pretest keeps at least one module here
 * so prescription links never come up empty.
 */
export const introPleuralModules: readonly PleuralModule[] = [
  {
    id: 'pleural-anatomy',
    title: 'Pleural Anatomy & Access Windows',
    route: '/pleural-procedures/thoracentesis-planner',
    section: 'anatomy',
    minutes: 15,
    status: 'live',
    order: 1,
    summary: 'Triangle of safety, intercostal vessel anatomy, and where it is safe to enter.',
  },
  {
    id: 'pleural-ultrasound',
    title: 'Pleural Ultrasound',
    route: '/pleural-procedures/pleural-ultrasound',
    section: 'ultrasound',
    minutes: 30,
    status: 'live',
    order: 2,
    summary:
      'The ultrasound-first foundation: learn the four effusion patterns, practice on real images, then check your reasoning.',
  },
  {
    id: 'pleural-dataset-lab',
    title: 'Pleural Dataset Source Lab',
    route: '/pleural-procedures/dataset-lab',
    section: 'ultrasound',
    minutes: 16,
    status: 'live',
    order: 3,
    summary:
      'Inspect raw CC BY ultrasound examples with provenance, checksums, and teaching limits.',
  },
  {
    id: 'pleural-fluid-analysis',
    title: 'Pleural Fluid Analysis',
    route: '/pleural-procedures/pleural-fluid-analysis',
    section: 'fluid',
    minutes: 25,
    status: 'live',
    order: 4,
    summary: 'Light criteria, ranked differentials, pseudoexudates, and clinical reconciliation.',
  },
  {
    id: 'thoracentesis-planner',
    title: 'Thoracentesis & Pleural Access',
    route: '/pleural-procedures/thoracentesis-planner',
    section: 'thoracentesis',
    minutes: 22,
    status: 'live',
    order: 5,
    summary: 'Bleeding-risk framing, vessel risk, and a manometry trainer for safe drainage.',
  },
  {
    id: 'chest-drainage',
    title: 'Chest Drainage Systems',
    route: '/pleural-procedures/chest-drainage',
    section: 'chest-tube',
    minutes: 35,
    status: 'live',
    order: 6,
    summary: 'Water seal, dry suction, air-leak interpretation, and patient-first troubleshooting.',
  },
  {
    id: 'pleural-infection',
    title: 'Pleural Infection Pathways',
    route: '/pleural-procedures/pleural-infection',
    section: 'infection',
    minutes: 25,
    status: 'live',
    order: 7,
    summary: 'Stage parapneumonic effusions, choose drainage, and evaluate tPA/DNase.',
  },
  {
    id: 'pneumothorax-pathway',
    title: 'Pneumothorax Pathway',
    route: '/pleural-procedures/pneumothorax-pathway',
    section: 'pneumothorax',
    minutes: 22,
    status: 'live',
    order: 8,
    summary: 'Physiology-first primary/secondary pneumothorax pathway and persistent air leak.',
  },
  {
    id: 'malignant-effusion',
    title: 'Malignant Pleural Effusion',
    route: '/pleural-procedures/malignant-effusion',
    section: 'malignant',
    minutes: 24,
    status: 'live',
    order: 9,
    summary: 'Diagnostic escalation, lung expandability, and IPC vs. pleurodesis tradeoffs.',
  },
  {
    id: 'pleural-algorithms',
    title: 'Integrated Pleural Algorithms',
    route: '/pleural-procedures/intro-course',
    section: 'algorithms',
    minutes: 15,
    status: 'live',
    order: 10,
    summary: 'Adaptive pretest that ties the modules together and prescribes a study path.',
  },
  {
    id: 'outpatient-pleural',
    title: 'Outpatient Pleural Clinic',
    route: '/coming-soon',
    section: 'outpatient',
    minutes: 20,
    status: 'planned',
    order: 11,
    summary: 'Ambulatory pleural care and follow-up. Coming soon.',
  },
  {
    id: 'pleural-ultrasound-simulator',
    title: 'Pleural Ultrasound Simulator',
    route: '/pleural-procedures/pleural-ultrasound-simulator',
    section: 'ultrasound',
    minutes: 20,
    status: 'planned',
    experimental: true,
    summary: 'Single-case 3D probe prototype that generates synthetic B-mode views.',
  },
] as const

export function getModulesForSection(section: PleuralSection) {
  return introPleuralModules.filter((module) => module.section === section)
}
