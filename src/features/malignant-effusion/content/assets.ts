import type { PleuralAsset } from '@/features/pleural-procedures/content/types'

export const malignantEffusionAssets: readonly PleuralAsset[] = [
  {
    id: 'pleural-nodularity-ultrasound',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/1446/9870740/6a2bcfb957db/TCA-14-223-g001.jpg',
    alt: 'Ultrasound and CT correlation showing pleural thickening and nodularity.',
    sourceType: 'creative-commons',
    attribution: 'Diagnosis of malignant pleural disease: Ultrasound as a detective probe. 2022.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['malignant', 'pleural-thickening', 'ultrasound'],
  },
  {
    id: 'pleuroscopy-malignancy',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/fc70/7891332/3e8047b795cd/CRJ-15-91-g003.jpg',
    alt: 'Pleuroscopy images of malignant mesothelioma and lymphoma with narrow-band imaging vascular patterns.',
    sourceType: 'creative-commons',
    attribution: 'Evaluation of the efficacy and safety of a new flex-rigid pleuroscope. 2021.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['pleuroscopy', 'malignant', 'biopsy'],
  },
  {
    id: 'ipc-pleuroscope-equipment',
    kind: 'image',
    path: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/fc70/7891332/86d583d62497/CRJ-15-91-g001.jpg',
    alt: 'Pleuroscopy equipment comparison with biopsy forceps positioning.',
    sourceType: 'creative-commons',
    attribution: 'Evaluation of the efficacy and safety of a new flex-rigid pleuroscope. 2021.',
    referenceIds: ['creative-commons-catalog'],
    tags: ['equipment', 'pleuroscopy', 'procedure'],
  },
]
