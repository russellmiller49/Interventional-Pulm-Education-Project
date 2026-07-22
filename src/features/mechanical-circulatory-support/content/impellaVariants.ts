import type { CardiacAssetId } from '@/features/cardiac-anatomy/content/rig'

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
    productFlowFraming: 'Peak flow up to 4.3 L/min; actual flow remains loading-dependent.',
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
    productFlowFraming: 'Product-reported mean flow of 5.5 L/min; not a guaranteed maximum.',
    access: 'Surgical axillary-graft or direct-aortic route; the access boundary is authored.',
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
      'Product information frames flow up to 4.0 L/min; actual and modeled flow remain loading-dependent.',
    access: 'Femoral venous route to an IVC inlet and pulmonary-artery outlet.',
    pathway: 'Inferior vena cava/right atrium → pump → pulmonary artery',
    teachingBoundary: 'Active RV-support physiology and placement track; can run with a left pump.',
    sourceIds: ['fda-impella-rp-labeling', 'jnj-impella-rp-current'],
  },
] as const
