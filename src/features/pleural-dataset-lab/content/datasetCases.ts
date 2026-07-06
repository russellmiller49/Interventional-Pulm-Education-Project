import type { PleuralAsset } from '@/features/pleural-procedures/content/types'
import { filterEmbeddablePleuralAssets } from '@/features/pleural-procedures/content/sourceRegistry'

export type PleuralDatasetSourceId = 'mendeley-lus-raw-snapshot-2026-06-03'

export type PleuralDatasetLabel =
  | 'large-simple-effusion'
  | 'consolidation-no-pleural-target'
  | 'b-lines-no-pleural-target'
  | 'normal-no-pleural-target'

export interface DatasetAnswerOption {
  id: PleuralDatasetLabel
  label: string
}

export interface PleuralDatasetCollection {
  id: PleuralDatasetSourceId
  sourceDatasetId: 'mendeley-lus-katumba-2025'
  title: string
  shortLabel: string
  sourceUrl: string
  archiveName: string
  archiveSizeBytes: number
  archiveHash: string
  archiveHashAlgorithm: 'md5' | 'sha256'
  rawImageCount: number
  snapshotCount: number
  useScope: string
}

export interface PleuralDatasetCase extends PleuralAsset {
  sourceRegistryId: PleuralDatasetSourceId
  sourceDatasetId: PleuralDatasetCollection['sourceDatasetId']
  sourceDatasetTitle: string
  labelFamily: 'lus-finding'
  groundTruth: PleuralDatasetLabel
  groundTruthLabel: string
  sourceFindingLabel: string
  sourceRecordClass: string
  answerOptions: readonly DatasetAnswerOption[]
  neutralVignette: string
  revealCaption: string
  teachingPoint: string
  moduleUse: string
  originalArchiveFile: string
  originalRelativePath: string
  sourceImageName: string
  metadataLookupKey: string
  sourceRecordId: string
  sourceSplitOrSheet: string
  metadataReview: {
    worksheet: string
    row: string
    imageColumn: string
    findingColumn: string
    findingValue: string
    positiveFlag?: string
    note: string
  }
  width: number
  height: number
  sizeBytes: number
  sha256: string
  rawAssetPolicyNote: string
}

const ccBySnapshotPolicy = {
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  reusePolicy: 'embeddable',
  transformPolicy: 'derivatives-allowed',
  attributionRequired: true,
  permissionStatus: 'granted-by-license',
  reviewStatus: 'reviewed',
} as const

export const pleuralDatasetCollections: readonly PleuralDatasetCollection[] = [
  {
    id: 'mendeley-lus-raw-snapshot-2026-06-03',
    sourceDatasetId: 'mendeley-lus-katumba-2025',
    title: 'Mendeley LUS disease classification raw dataset',
    shortLabel: 'Mendeley raw LUS',
    sourceUrl: 'https://data.mendeley.com/datasets/hb3p34ytvx/2',
    archiveName: 'unprocessed_dataset.zip',
    archiveSizeBytes: 143487410,
    archiveHash: '86d1ea205a4e42f1d0f288004648a532d4c07430393be79a7197394535d5b5c8',
    archiveHashAlgorithm: 'sha256',
    rawImageCount: 1062,
    snapshotCount: 4,
    useScope:
      'Labeled lung-ultrasound findings for effusion, consolidation, B-lines, and normal-lung distractor teaching.',
  },
] as const

export const lusTeachingOptions: readonly DatasetAnswerOption[] = [
  { id: 'large-simple-effusion', label: 'Large simple effusion' },
  { id: 'consolidation-no-pleural-target', label: 'Consolidation / no pleural target' },
  { id: 'b-lines-no-pleural-target', label: 'B-lines / no pleural target' },
  { id: 'normal-no-pleural-target', label: 'Normal lung / no pleural target' },
] as const

const mendeleyAssetBase = {
  kind: 'image',
  sourceType: 'dataset',
  sourceUrl: 'https://data.mendeley.com/datasets/hb3p34ytvx/2',
  attribution:
    'Katumba A, Murindanyi S, Okila N, et al. A Dataset of Lung Ultrasound Images for Automated AI-based Lung Disease Classification. Mendeley Data, V2. 2025.',
  sourceRegistryId: 'mendeley-lus-raw-snapshot-2026-06-03',
  sourceDatasetId: 'mendeley-lus-katumba-2025',
  sourceDatasetTitle: 'Mendeley LUS disease classification raw dataset',
  labelFamily: 'lus-finding',
  answerOptions: lusTeachingOptions,
  originalArchiveFile: 'unprocessed_dataset.zip',
  sourceSplitOrSheet: 'unprocessed_dataset/train plus metadata.xlsx',
  rawAssetPolicyNote:
    'Raw public dataset image copied without cropping or pixel transformation; source overlays are retained, so this lab asks for teaching use rather than blind image-label guessing.',
  ...ccBySnapshotPolicy,
} satisfies Partial<PleuralDatasetCase>

export const pleuralDatasetCases: readonly PleuralDatasetCase[] = [
  {
    ...mendeleyAssetBase,
    id: 'mendeley-raw-effusion-lower-posterior',
    path: '/module-assets/v1/pleural-dataset-lab/mendeley/mendeley-effusion-rt-lower-post-long-12_30_33.png',
    alt: 'Raw lung ultrasound image from the Mendeley LUS dataset.',
    tags: ['dataset', 'mendeley', 'raw', 'effusion', 'lus'],
    referenceIds: ['mendeley-lus-katumba-2025'],
    groundTruth: 'large-simple-effusion',
    groundTruthLabel: 'Large simple effusion',
    sourceFindingLabel: 'Effusion',
    sourceRecordClass: 'Diseased lung but probably Not Covid',
    neutralVignette:
      'Raw Mendeley frame with local metadata. Decide how this image should be used in the pleural module.',
    revealCaption:
      'Local metadata row 19 labels the lower-posterior longitudinal image as Effusion with the effusion flag set.',
    teachingPoint:
      'Your read is the right pleural teaching target: this is best used as a large simple effusion. The dataset metadata is coarser and only records Effusion.',
    moduleUse:
      'Large simple effusion example for pleural pocket recognition and no-overclaim framing.',
    originalRelativePath: 'unprocessed_dataset/train/other/RT_LOWER_POST_LONG-12_30_33.png',
    sourceImageName: 'RT_LOWER_POST_LONG-12_30_33.png',
    metadataLookupKey: 'RT_LOWER_POST_LONG-12_30_33.png',
    sourceRecordId: 'COAST 064',
    metadataReview: {
      worksheet: 'metadata.xlsx / sheet1',
      row: '19',
      imageColumn: 'AA Lower Posterior (Longitudinal)',
      findingColumn: 'AB Findings for Lower Posterior (Longitudinal)',
      findingValue: 'Effusion',
      positiveFlag: 'AF Findings for Lower Posterior (Longitudinal)/Effusion = 1',
      note: 'Safe fields from the local workbook confirm the source finding; free-text comments and patient fields are not copied into app metadata.',
    },
    width: 640,
    height: 640,
    sizeBytes: 1231509,
    sha256: '87dd3dcc1d723cc247f59788d11f56eb0864335cbbe634687707d9f7dac8f291',
  },
  {
    ...mendeleyAssetBase,
    id: 'mendeley-raw-consolidation-upper-posterior',
    path: '/module-assets/v1/pleural-dataset-lab/mendeley/mendeley-consolidation-rt-upper-post-trans-23_0_45.png',
    alt: 'Raw lung ultrasound image from the Mendeley LUS dataset.',
    tags: ['dataset', 'mendeley', 'raw', 'consolidation', 'lus'],
    referenceIds: ['mendeley-lus-katumba-2025'],
    groundTruth: 'consolidation-no-pleural-target',
    groundTruthLabel: 'Consolidation / no pleural target',
    sourceFindingLabel: 'Consolidation',
    sourceRecordClass: 'Diseased lung but probably Not Covid',
    neutralVignette:
      'Raw Mendeley frame with local metadata. Decide how this image should be used in the pleural module.',
    revealCaption:
      'Local metadata row 5 labels the upper-posterior transverse image as Consolidation.',
    teachingPoint:
      'A subpleural lung finding can sit beside pleural symptoms; do not treat it as a drainable pleural target unless a fluid pocket is seen.',
    moduleUse: 'No-drainable-effusion distractor and consolidation context for scanning modules.',
    originalRelativePath: 'unprocessed_dataset/train/other/rt_upper_post_trans-23_0_45.png',
    sourceImageName: 'rt_upper_post_trans-23_0_45.png',
    metadataLookupKey: 'rt upper post trans-23_0_45.png',
    sourceRecordId: 'COAST-056',
    metadataReview: {
      worksheet: 'metadata.xlsx / sheet1',
      row: '5',
      imageColumn: 'S Upper Posterior (Transverse)',
      findingColumn: 'T Findings for Upper Posterior (Transverse)',
      findingValue: 'Consolidation',
      positiveFlag: 'W Findings for Upper Posterior (Transverse)/Consolidation = 1',
      note: 'Safe fields from the local workbook confirm the source finding; free-text comments and patient fields are not copied into app metadata.',
    },
    width: 1280,
    height: 720,
    sizeBytes: 113260,
    sha256: '221050b2e01ea9a5d7d7255a43bff548ca74a1d74ab604fb0ddfb0ecde133508',
  },
  {
    ...mendeleyAssetBase,
    id: 'mendeley-raw-b-lines-posterior',
    path: '/module-assets/v1/pleural-dataset-lab/mendeley/mendeley-b-lines-1646466936258.png',
    alt: 'Raw lung ultrasound image from the Mendeley LUS dataset.',
    tags: ['dataset', 'mendeley', 'raw', 'b-lines', 'lus'],
    referenceIds: ['mendeley-lus-katumba-2025'],
    groundTruth: 'b-lines-no-pleural-target',
    groundTruthLabel: 'B-lines / no pleural target',
    sourceFindingLabel: '>3 B-lines',
    sourceRecordClass: 'Probably Covid',
    neutralVignette:
      'Raw Mendeley frame with local metadata. Decide how this image should be used in the pleural module.',
    revealCaption:
      'Local metadata row 8 labels the upper-posterior longitudinal image as greater-than-three B-lines.',
    teachingPoint:
      'B-lines can explain dyspnea and abnormal LUS appearance without giving the learner a pleural drainage target.',
    moduleUse:
      'No-drainable-effusion distractor and image-quality variation for the ultrasound lab.',
    originalRelativePath: 'unprocessed_dataset/train/covid/1646466936258.png',
    sourceImageName: '1646466936258.png',
    metadataLookupKey: '1646466936258.png',
    sourceRecordId: 'COAST-017',
    metadataReview: {
      worksheet: 'metadata.xlsx / sheet1',
      row: '8',
      imageColumn: 'K Upper Posterior (Longitudinal)',
      findingColumn: 'L Findings for Upper Posterior (Longitudinal)',
      findingValue: '>3 B-lines',
      positiveFlag: 'N Findings for Upper Posterior (Longitudinal)/>3 B-lines = 1',
      note: 'Safe fields from the local workbook confirm the source finding; free-text comments and patient fields are not copied into app metadata.',
    },
    width: 1280,
    height: 720,
    sizeBytes: 126144,
    sha256: '109f1ab9089dd9349b48d9e9fabcaadf79f7f1a4d5a5a1c15912610435a9d1fa',
  },
  {
    ...mendeleyAssetBase,
    id: 'mendeley-raw-normal-lower-posterior',
    path: '/module-assets/v1/pleural-dataset-lab/mendeley/mendeley-normal-rt-lower-post-long-22_54_53.jpg',
    alt: 'Raw lung ultrasound image from the Mendeley LUS dataset.',
    tags: ['dataset', 'mendeley', 'raw', 'normal', 'lus'],
    referenceIds: ['mendeley-lus-katumba-2025'],
    groundTruth: 'normal-no-pleural-target',
    groundTruthLabel: 'Normal lung / no pleural target',
    sourceFindingLabel: 'Normal',
    sourceRecordClass: 'Healthy Lung',
    neutralVignette:
      'Raw Mendeley frame with local metadata. Decide how this image should be used in the pleural module.',
    revealCaption: 'Local metadata row 2 labels the lower-posterior longitudinal image as Normal.',
    teachingPoint:
      'Normal or aerated lung views are important negative controls when learners are scanning for a safe pleural access pocket.',
    moduleUse: 'Negative-control example for the ultrasound lab and simulator realism checks.',
    originalRelativePath: 'unprocessed_dataset/train/healthy/RT_LOWER_POST_LONG-22_54_53.jpg',
    sourceImageName: 'RT_LOWER_POST_LONG-22_54_53.jpg',
    metadataLookupKey: 'RT_LOWER_POST_LONG-22_54_53.jpg',
    sourceRecordId: 'COAST-055',
    metadataReview: {
      worksheet: 'metadata.xlsx / sheet1',
      row: '2',
      imageColumn: 'AA Lower Posterior (Longitudinal)',
      findingColumn: 'AB Findings for Lower Posterior (Longitudinal)',
      findingValue: 'Normal',
      note: 'Safe fields from the local workbook confirm the source finding; free-text comments and patient fields are not copied into app metadata.',
    },
    width: 1116,
    height: 768,
    sizeBytes: 60674,
    sha256: '669682622e7365bc106e670b9d4ce236e8eee7c6b5620a71c928fd9742de9152',
  },
] as const

export const publicPleuralDatasetCases = filterEmbeddablePleuralAssets(pleuralDatasetCases)

export function getPleuralDatasetCase(id: string) {
  return pleuralDatasetCases.find((caseItem) => caseItem.id === id)
}

export function getPleuralDatasetCollection(id: PleuralDatasetSourceId) {
  return pleuralDatasetCollections.find((collection) => collection.id === id)
}
