import type { EffusionPattern } from '../engine/types'
import type { PleuralAsset } from '@/features/pleural-procedures/content/types'

export interface UltrasoundAsset extends PleuralAsset {
  groundTruth: EffusionPattern
  clinicalLabel: string
}

export const pleuralUltrasoundAssets: readonly UltrasoundAsset[] = [
  {
    id: 'simple-anechoic-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ff17/11127929/626d2921fbee/41598_2024_62807_Fig3_HTML.jpg',
    alt: 'Composite pleural ultrasound images including anechoic and complex effusion examples.',
    sourceType: 'creative-commons',
    attribution:
      'Chest ultrasound is better than CT in identifying septated effusion of patients with pleural disease. Scientific Reports. 2024.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'effusion', 'anechoic'],
    groundTruth: 'simpleAnechoic',
    clinicalLabel: 'Simple-appearing fluid with dyspnea after diuresis',
  },
  {
    id: 'complex-nonseptated-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/f40972c6f29f/PM2019-5628267.002.jpg',
    alt: 'Pleural ultrasound with complex nonseptated effusion and internal echoes.',
    sourceType: 'creative-commons',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'complex', 'malignant'],
    groundTruth: 'complexNonSeptated',
    clinicalLabel: 'Complex nonseptated fluid in recurrent unilateral effusion',
  },
  {
    id: 'septated-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/5018901711c4/PM2019-5628267.001.jpg',
    alt: 'Pleural ultrasound showing fibrinous septation within pleural fluid.',
    sourceType: 'creative-commons',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'septated', 'loculated'],
    groundTruth: 'septatedLoculated',
    clinicalLabel: 'Septated fluid after pneumonia with persistent fever',
  },
  {
    id: 'echogenic-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/91df/6264615/26c179cbed45/12890_2018_745_Fig2_HTML.jpg',
    alt: 'Pleuroscopy image of multiloculated empyema with thick fibrin, used as a correlation image for echogenic complex pleural infection.',
    sourceType: 'creative-commons',
    attribution: 'Role of medical Thoracoscopy in the Management of Multiloculated Empyema. 2018.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['empyema', 'echogenic', 'loculated'],
    groundTruth: 'echogenic',
    clinicalLabel: 'Echogenic infected-appearing pleural space with debris',
  },
  {
    id: 'ambiguous-simple-exudate',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/5d66/6837853/b796c0a971fd/RCR2-8-e00498-g001.jpg',
    alt: 'CT image showing a large left-sided pleural effusion, used for an ambiguous simple-appearing exudate case.',
    sourceType: 'creative-commons',
    attribution:
      'Intrapleural urokinase directly under medical thoracoscopy for the diagnosis of tuberculous pleurisy. 2019.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['ct', 'effusion', 'ambiguous'],
    groundTruth: 'simpleAnechoic',
    clinicalLabel: 'Simple-looking fluid in a TB-risk vignette',
  },
]

export function getUltrasoundAsset(id: string) {
  return pleuralUltrasoundAssets.find((asset) => asset.id === id)
}
