import type { EffusionPattern } from '../engine/types'
import type { PleuralAsset } from '@/features/pleural-procedures/content/types'
import { filterEmbeddablePleuralAssets } from '@/features/pleural-procedures/content/sourceRegistry'

export interface UltrasoundAsset extends PleuralAsset {
  groundTruth: EffusionPattern
  neutralVignette: string
  revealCaption: string
}

function reviewedCcBySource(sourceUrl: string) {
  return {
    sourceUrl,
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reusePolicy: 'embeddable',
    transformPolicy: 'derivatives-allowed',
    attributionRequired: true,
    permissionStatus: 'granted-by-license',
    reviewStatus: 'reviewed',
  } as const
}

export const pleuralUltrasoundAssets: readonly UltrasoundAsset[] = [
  {
    id: 'simple-anechoic-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ff17/11127929/626d2921fbee/41598_2024_62807_Fig3_HTML.jpg',
    alt: 'Pleural-space image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution:
      'Chest ultrasound is better than CT in identifying septated effusion of patients with pleural disease. Scientific Reports. 2024.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC11127929/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'effusion', 'anechoic'],
    groundTruth: 'simpleAnechoic',
    neutralVignette:
      '74-year-old with dyspnea after diuresis and a unilateral effusion on chest imaging.',
    revealCaption:
      'The teaching target is a simple anechoic pocket; simple appearance does not prove a transudate.',
  },
  {
    id: 'complex-nonseptated-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/f40972c6f29f/PM2019-5628267.002.jpg',
    alt: 'Pleural-space image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC6398002/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'complex', 'malignant'],
    groundTruth: 'complexNonSeptated',
    neutralVignette:
      '68-year-old with recurrent unilateral effusion, chest discomfort, and weight loss.',
    revealCaption:
      'The teaching target is complex nonseptated fluid with internal echoes but no clear fibrin strands.',
  },
  {
    id: 'septated-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/5018901711c4/PM2019-5628267.001.jpg',
    alt: 'Pleural-space image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC6398002/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'septated', 'loculated'],
    groundTruth: 'septatedLoculated',
    neutralVignette:
      '62-year-old with pneumonia, persistent fever, and a pleural collection after antibiotics.',
    revealCaption:
      'The teaching target is septated or loculated fluid, suggesting fibrinous organization.',
  },
  {
    id: 'echogenic-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/91df/6264615/26c179cbed45/12890_2018_745_Fig2_HTML.jpg',
    alt: 'Pleural-space image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution: 'Role of medical Thoracoscopy in the Management of Multiloculated Empyema. 2018.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC6264615/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['empyema', 'echogenic', 'loculated'],
    groundTruth: 'echogenic',
    neutralVignette:
      '56-year-old with fever, pleuritic pain, and poor clinical improvement despite antibiotics.',
    revealCaption:
      'The teaching target is echogenic pleural material; pus, blood, cellular debris, or malignancy can create this appearance.',
  },
  {
    id: 'ambiguous-simple-exudate',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/5d66/6837853/b796c0a971fd/RCR2-8-e00498-g001.jpg',
    alt: 'Pleural-space image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution:
      'Intrapleural urokinase directly under medical thoracoscopy for the diagnosis of tuberculous pleurisy. 2019.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC6837853/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ct', 'effusion', 'ambiguous'],
    groundTruth: 'simpleAnechoic',
    neutralVignette:
      '37-year-old with tuberculosis exposure risk, night sweats, and a unilateral effusion.',
    revealCaption:
      'The teaching target is a simple-appearing effusion in a high-risk story; the clinical context still drives testing.',
  },
  {
    id: 'b-lines-no-effusion-distractor',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/3901/5234763/f5a7096c0f31/1679-4508-eins-14-03-0443-gf03.jpg',
    alt: 'Lung ultrasound image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution: 'Advances in lung ultrasound. Einstein (Sao Paulo). 2016.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC5234763/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'b-lines', 'no-drainable-effusion', 'distractor'],
    groundTruth: 'noDrainableEffusion',
    neutralVignette:
      '70-year-old with dyspnea and diffuse interstitial findings on chest imaging, but no known pleural collection.',
    revealCaption:
      'The teaching target is a lung artifact pattern without a drainable pleural fluid pocket in this view.',
  },
  {
    id: 'subpleural-consolidation-distractor',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/3901/5234763/fc258bc6a417/1679-4508-eins-14-03-0443-gf04.jpg',
    alt: 'Lung ultrasound image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution: 'Advances in lung ultrasound. Einstein (Sao Paulo). 2016.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC5234763/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'consolidation', 'no-drainable-effusion', 'distractor'],
    groundTruth: 'noDrainableEffusion',
    neutralVignette:
      '59-year-old with pleuritic symptoms and focal lung findings where the question is whether there is a pleural pocket to access.',
    revealCaption:
      'The teaching target is subpleural consolidation rather than a pleural fluid collection; continue scanning if drainage is the clinical question.',
  },
  {
    id: 'atelectasis-with-effusion-reference',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/ebf3/6398002/40f9ffb61505/PM2019-5628267.003.jpg',
    alt: 'Pleural-space image used for pattern classification.',
    sourceType: 'creative-commons',
    attribution:
      'A Retrospective Study of Ultrasound Characteristics and Macroscopic Findings in Confirmed Malignant Pleural Effusion. 2019.',
    ...reviewedCcBySource('https://pmc.ncbi.nlm.nih.gov/articles/PMC6398002/'),
    referenceIds: ['creative-commons-catalog'],
    tags: ['ultrasound', 'effusion', 'atelectasis', 'malignant'],
    groundTruth: 'complexNonSeptated',
    neutralVignette:
      '66-year-old with recurrent unilateral effusion and mobile tissue seen within the pleural-space view.',
    revealCaption:
      'The teaching target is an effusion with floating visceral pleura or atelectatic lung, reminding learners not to label every internal structure as debris.',
  },
]

export const publicPleuralUltrasoundAssets = filterEmbeddablePleuralAssets(pleuralUltrasoundAssets)

export function getUltrasoundAsset(id: string) {
  return pleuralUltrasoundAssets.find((asset) => asset.id === id)
}
