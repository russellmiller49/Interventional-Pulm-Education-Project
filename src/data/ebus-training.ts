import { buildEmbeddedAppSrc, socalEbusCourseAppPath } from '@/lib/embedded-app-locale'

export interface EmbeddedTrainingModule {
  slug: string
  title: string
  shortTitle: string
  kicker: string
  description: string
  appHashPath: string
  publicScope: 'ebus' | 'tnm'
  href: string
  highlights: string[]
  keywords: string[]
}

export const publicEbusTrainingModules: EmbeddedTrainingModule[] = [
  {
    slug: 'knobology',
    title: 'EBUS Knobology',
    shortTitle: 'Knobology',
    kicker: 'EBUS training',
    description:
      'Practice EBUS ultrasound controls, image optimization, Doppler safety checks, and troubleshooting without the participant-course lecture sequence.',
    appHashPath: '/knobology',
    publicScope: 'ebus',
    href: '/ebus-training/knobology',
    highlights: [
      'Depth, gain, contrast, Doppler, caliper, freeze, and save controls.',
      'Fix-the-image exercises with immediate teaching feedback.',
      'Doppler safety framing for vessel-aware needle trajectory practice.',
    ],
    keywords: ['ebus', 'knobology', 'ultrasound', 'doppler', 'gain', 'depth'],
  },
  {
    slug: 'stations',
    title: 'Mediastinal Stations',
    shortTitle: 'Stations',
    kicker: 'EBUS training',
    description:
      'Explore mediastinal lymph node stations with station maps, CT correlation, bronchoscopy views, EBUS ultrasound images, flashcards, quizzes, and handbook material.',
    appHashPath: '/stations/explore',
    publicScope: 'ebus',
    href: '/ebus-training/stations',
    highlights: [
      'Core stations 2R, 2L, 4R, 4L, 7, 10R/L, and 11R/L.',
      'CT, bronchoscopy, and EBUS image correlation for each station.',
      'Flashcards, station quiz mode, and concise handbook review.',
    ],
    keywords: ['ebus', 'stations', 'mediastinum', 'lymph nodes', 'iaslc', 'staging'],
  },
  {
    slug: 'simulator',
    title: 'EBUS Simulator + Virtual Bronchoscopy',
    shortTitle: 'Simulator',
    kicker: 'Updated EBUS training',
    description:
      'Navigate the updated simulator with synchronized external anatomy, first-person virtual bronchoscopy, and EBUS sector views.',
    appHashPath: '/simulator',
    publicScope: 'ebus',
    href: '/ebus-training/simulator',
    highlights: [
      'Drive the scope through a synchronized external airway and first-person endoluminal view.',
      'Correlate scope position with station-specific EBUS sector imaging and anatomy targets.',
      'Use the updated three-pane workspace to rehearse spatial orientation before hands-on simulation.',
    ],
    keywords: [
      'ebus',
      'simulator',
      'virtual bronchoscopy',
      'airway',
      'stations',
      'ultrasound',
      'navigation',
    ],
  },
]

export const allEbusTrainingModules = publicEbusTrainingModules

export const tnm9TrainingModule: EmbeddedTrainingModule = {
  slug: 'tnm-9-staging',
  title: 'TNM-9 Staging',
  shortTitle: 'TNM-9',
  kicker: 'Lung cancer staging',
  description:
    'A standalone TNM-9 lung cancer staging module with searchable descriptors, interactive stage grouping, T descriptor builder, N map, and case practice.',
  appHashPath: '/tnm-staging',
  publicScope: 'tnm',
  href: '/tnm-9-staging',
  highlights: [
    'Searchable T, N, M, and stage-group reference cards.',
    'Interactive stager and T descriptor builder for lung cancer staging practice.',
    'Nodal station map and case-based staging decisions independent of the EBUS course.',
  ],
  keywords: ['tnm', 'tnm 9', 'tnm-9', 'lung cancer staging', 'stage grouping', 'n map'],
}

export function getEmbeddedCourseModuleSrc(module: EmbeddedTrainingModule, locale: string) {
  return buildEmbeddedAppSrc(
    socalEbusCourseAppPath,
    locale,
    {
      publicTraining: '1',
      publicScope: module.publicScope,
    },
    module.appHashPath,
  )
}

export function getPublicEbusTrainingModule(slug: string) {
  return publicEbusTrainingModules.find((module) => module.slug === slug)
}

export function getAnyEbusTrainingModule(slug: string) {
  return allEbusTrainingModules.find((module) => module.slug === slug)
}

export function getEbusTrainingModule(slug: string) {
  return getPublicEbusTrainingModule(slug)
}
