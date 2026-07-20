import type { CardiacAssetId } from '@/features/cardiac-anatomy/content/rig'

export interface ImpellaAnatomyVariant {
  id: 'cp' | '55' | 'rp'
  label: string
  asset: CardiacAssetId
  pathway: string
  teachingBoundary: string
}

export const impellaAnatomyVariants: readonly ImpellaAnatomyVariant[] = [
  {
    id: 'cp',
    label: 'Impella CP',
    asset: 'impellaCp',
    pathway: 'Left ventricle → pump across the aortic valve → ascending aorta',
    teachingBoundary: 'Active device used by this module’s physiology and placement states.',
  },
  {
    id: '55',
    label: 'Impella 5.5',
    asset: 'impella55',
    pathway: 'Left ventricle → transvalvular pump → ascending aorta',
    teachingBoundary: 'Anatomy comparison only; no 5.5 console or physiology track is modeled.',
  },
  {
    id: 'rp',
    label: 'Impella RP',
    asset: 'impellaRp',
    pathway: 'Inferior vena cava/right atrium → pump → pulmonary artery',
    teachingBoundary:
      'Anatomy comparison only; no temporary-RV-support physiology track is modeled.',
  },
] as const
