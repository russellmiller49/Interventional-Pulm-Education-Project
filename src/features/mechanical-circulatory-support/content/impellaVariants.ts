import type { CardiacAssetId } from '@/features/cardiac-anatomy/content/rig'

import { MCS_NUMBERS } from './teachingNumbers'

export interface ImpellaAnatomyVariant {
  id: 'cp' | '55' | 'rp'
  label: string
  asset: CardiacAssetId
  supportSide: 'left' | 'right'
  modeledReferenceFlowLMin: number
  productFlowFraming: string
  access: string
  pathway: string
  teachingBoundary: string
  sourceIds: readonly string[]
}

export const impellaAnatomyVariants: readonly ImpellaAnatomyVariant[] = [
  {
    id: 'cp',
    label: 'Impella CP',
    asset: 'impellaCp',
    supportSide: 'left',
    modeledReferenceFlowLMin: 4.3,
    productFlowFraming: `Mean flow ${MCS_NUMBERS.value('impella-cp-flow-by-level')}. Peak flow in systole at P-9 is ${MCS_NUMBERS.value('impella-cp-peak-flow')}: a peak, not a mean.`,
    access: 'Percutaneous arterial route; peripheral access is outside the supplied CT field.',
    pathway: 'Left ventricle → pump across the aortic valve → ascending aorta',
    teachingBoundary: 'Active LV-support physiology and placement track.',
    sourceIds: ['fda-impella-cp-labeling', 'jnj-impella-cp-current'],
  },
  {
    id: '55',
    label: 'Impella 5.5',
    asset: 'impella55',
    supportSide: 'left',
    modeledReferenceFlowLMin: 5.5,
    productFlowFraming: `Mean flow ${MCS_NUMBERS.value('impella-55-flow-by-level')}.`,
    access: 'Surgical axillary-graft or direct-aortic route.',
    pathway: 'Left ventricle → transvalvular pump → ascending aorta',
    teachingBoundary: 'Active LV-support physiology and placement track.',
    sourceIds: ['fda-impella-55-labeling', 'jnj-impella-55-current'],
  },
  {
    id: 'rp',
    label: 'Impella RP',
    asset: 'impellaRp',
    supportSide: 'right',
    modeledReferenceFlowLMin: 4,
    productFlowFraming:
      'Up to 4.0 L/min in the product information; delivered flow depends on loading.',
    access: 'Femoral venous route to an IVC inlet and pulmonary-artery outlet.',
    pathway: 'Inferior vena cava/right atrium → pump → pulmonary artery',
    teachingBoundary: 'Active RV-support physiology and placement track; can run with a left pump.',
    sourceIds: ['fda-impella-rp-labeling', 'jnj-impella-rp-current'],
  },
] as const
