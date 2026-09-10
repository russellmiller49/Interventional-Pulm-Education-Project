import modulesData from '../../../../content/modules/modules.json';

import type { AppModuleCard, ModuleContent } from '@/content/types';

export const moduleContent = modulesData as ModuleContent[];

export const homeModuleCards: AppModuleCard[] = [
  {
    id: 'pretest',
    title: 'Pre-course Survey and Test',
    description: 'Pre-course survey and 25-question baseline assessment with hidden answers.',
    accent: 'var(--accent-rose)',
    icon: '◇',
    path: '/pretest',
  },
  {
    id: 'lectures',
    title: 'Pre-Course Lectures',
    description: 'Sequential videos with in-module post-lecture quizzes, final post-test, survey, and certificate.',
    accent: 'var(--accent-gold)',
    icon: '▶',
    path: '/lectures',
  },
  {
    id: 'knobology',
    title: 'EBUS Knobology',
    description: 'Primer, fix-the-image labs, Doppler safety check, and a focused quiz.',
    accent: 'var(--accent-green)',
    icon: '◐',
    path: '/knobology',
  },
  {
    id: 'stations',
    title: 'Mediastinal Stations',
    description: 'IASLC map, focused sub-tabs, flashcards, quizzes, and correlated CT/bronchoscopy/EBUS views.',
    accent: 'var(--accent-cyan)',
    icon: '◎',
    path: '/stations/explore',
  },
  {
    id: 'tnm-staging',
    title: 'TNM-9 Staging',
    description: 'IASLC 9th-edition T/N/M reference, stage matrix, descriptor builders, N map, and case practice.',
    accent: 'var(--accent-gold)',
    icon: '◆',
    path: '/tnm-staging',
  },
  {
    id: 'simulator',
    title: 'EBUS Simulator',
    description: 'Static anatomy-correlation simulator with guided centerline motion and station snap targets.',
    accent: 'var(--accent-green)',
    icon: '◌',
    path: '/simulator',
  },
];

export function getModuleById(moduleId: ModuleContent['id']): ModuleContent | undefined {
  return moduleContent.find((entry) => entry.id === moduleId);
}
