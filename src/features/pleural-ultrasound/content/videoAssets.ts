import type { PleuralAsset, PleuralLicenseLabel } from '@/features/pleural-procedures/content/types'
import { filterEmbeddablePleuralAssets } from '@/features/pleural-procedures/content/sourceRegistry'

export type DynamicUltrasoundSign =
  | 'normalALines'
  | 'bLinesPleuralIrregularity'
  | 'subpleuralConsolidation'
  | 'lungCurtainNoTarget'
  | 'effusionAdjacentConsolidation'

export interface PleuralUltrasoundVideoAsset extends PleuralAsset {
  groundTruth: DynamicUltrasoundSign
  neutralVignette: string
  revealCaption: string
  teachingPoint: string
  sourceFilename: string
  sourceRepositoryUrl: string
  sourceMetadataUrl: string
  originalFormat: 'mov' | 'gif' | 'avi'
  convertedToMp4: boolean
}

interface ReviewedVideoSource {
  sourceUrl: string
  license: PleuralLicenseLabel
  licenseUrl: string
}

const repositoryUrl = 'https://github.com/jannisborn/covid19_ultrasound'
const metadataUrl =
  'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/dataset_metadata.csv'

function reviewedVideoSource({ sourceUrl, license, licenseUrl }: ReviewedVideoSource) {
  return {
    sourceUrl,
    license,
    licenseUrl,
    reusePolicy: 'embeddable',
    transformPolicy: 'derivatives-allowed',
    attributionRequired: true,
    permissionStatus: 'granted-by-license',
    reviewStatus: 'reviewed',
  } as const
}

export const dynamicSignOptions: readonly {
  id: DynamicUltrasoundSign
  label: string
}[] = [
  { id: 'normalALines', label: 'Normal A-lines' },
  { id: 'bLinesPleuralIrregularity', label: 'B-lines with pleural-line irregularity' },
  { id: 'subpleuralConsolidation', label: 'Subpleural consolidation' },
  { id: 'lungCurtainNoTarget', label: 'Lung curtain / no drainable target' },
  { id: 'effusionAdjacentConsolidation', label: 'Effusion with adjacent consolidation' },
]

export const pleuralUltrasoundVideoAssets: readonly PleuralUltrasoundVideoAsset[] = [
  {
    id: 'dynamic-normal-a-lines',
    kind: 'clip',
    path: 'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Reg_recommendations_alines_mov1.mov',
    localPath: '/module-assets/v1/pleural-ultrasound/video/dynamic-normal-a-lines.mp4',
    alt: 'Lung ultrasound clip used for dynamic-sign classification.',
    sourceType: 'dataset',
    attribution:
      'jannisborn/covid19_ultrasound row Reg_recommendations_alines_mov1; source article: Role of point-of-care ultrasound during the COVID-19 pandemic.',
    ...reviewedVideoSource({
      sourceUrl:
        'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Reg_recommendations_alines_mov1.mov',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    }),
    referenceIds: ['jannisborn-covid19-ultrasound'],
    tags: ['ultrasound', 'a-lines', 'normal-lung', 'dynamic-sign'],
    groundTruth: 'normalALines',
    neutralVignette:
      'Anterior chest scan in a patient where the question is whether the pleural line is behaving like aerated lung.',
    revealCaption:
      'The teaching target is normal A-line reverberation below a sliding pleural line.',
    teachingPoint:
      'A-lines are horizontal reverberation artifacts from aerated lung. They are useful distractors in a pleural module because they do not create a drainage target.',
    sourceFilename: 'Reg_recommendations_alines_mov1',
    sourceRepositoryUrl: repositoryUrl,
    sourceMetadataUrl: metadataUrl,
    originalFormat: 'mov',
    convertedToMp4: true,
  },
  {
    id: 'dynamic-b-lines-pleural-irregularity',
    kind: 'clip',
    path: 'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Cov_convex_volpecelli_sonographic_v1.mov',
    localPath:
      '/module-assets/v1/pleural-ultrasound/video/dynamic-b-lines-pleural-irregularity.mp4',
    alt: 'Lung ultrasound clip used for dynamic-sign classification.',
    sourceType: 'dataset',
    attribution:
      'jannisborn/covid19_ultrasound row Cov_convex_volpecelli_sonographic_v1; source article: Sonographic signs and patterns of COVID-19 pneumonia.',
    ...reviewedVideoSource({
      sourceUrl:
        'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Cov_convex_volpecelli_sonographic_v1.mov',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    }),
    referenceIds: ['jannisborn-covid19-ultrasound'],
    tags: ['ultrasound', 'b-lines', 'pleural-line-irregularity', 'dynamic-sign'],
    groundTruth: 'bLinesPleuralIrregularity',
    neutralVignette:
      'Convex-probe lung clip where vertical artifacts and pleural-line texture should be classified before thinking about drainage.',
    revealCaption:
      'The teaching target is B-line activity with pleural-line irregularity, not a pleural fluid pocket.',
    teachingPoint:
      'B-lines arise from the pleural line and move with lung sliding. They answer an interstitial or inflammatory lung question, but they are not a thoracentesis target.',
    sourceFilename: 'Cov_convex_volpecelli_sonographic_v1',
    sourceRepositoryUrl: repositoryUrl,
    sourceMetadataUrl: metadataUrl,
    originalFormat: 'mov',
    convertedToMp4: true,
  },
  {
    id: 'dynamic-subpleural-consolidation',
    kind: 'clip',
    path: 'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Cov_recommendations_likebutterfly_mov5.mov',
    localPath: '/module-assets/v1/pleural-ultrasound/video/dynamic-subpleural-consolidation.mp4',
    alt: 'Lung ultrasound clip used for dynamic-sign classification.',
    sourceType: 'dataset',
    attribution:
      'jannisborn/covid19_ultrasound row Cov_recommendations_likebutterfly_mov5; source article: Role of point-of-care ultrasound during the COVID-19 pandemic.',
    ...reviewedVideoSource({
      sourceUrl:
        'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Cov_recommendations_likebutterfly_mov5.mov',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    }),
    referenceIds: ['jannisborn-covid19-ultrasound'],
    tags: ['ultrasound', 'consolidation', 'pleural-line-irregularity', 'dynamic-sign'],
    groundTruth: 'subpleuralConsolidation',
    neutralVignette:
      'Focused lung clip in a patient with focal pleural-adjacent abnormality; decide whether the view shows a drainable pocket.',
    revealCaption:
      'The teaching target is subpleural consolidation with pleural-line irregularity.',
    teachingPoint:
      'Subpleural consolidation can sit right against the pleura and mimic a procedural target at first glance. The key is to keep scanning for an actual fluid window.',
    sourceFilename: 'Cov_recommendations_likebutterfly_mov5',
    sourceRepositoryUrl: repositoryUrl,
    sourceMetadataUrl: metadataUrl,
    originalFormat: 'mov',
    convertedToMp4: true,
  },
  {
    id: 'dynamic-lung-curtain-no-target',
    kind: 'clip',
    path: 'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Reg-Atlas-lungcurtain.gif',
    localPath: '/module-assets/v1/pleural-ultrasound/video/dynamic-lung-curtain-no-target.mp4',
    alt: 'Lung ultrasound clip used for dynamic-sign classification.',
    sourceType: 'dataset',
    attribution:
      'jannisborn/covid19_ultrasound row Reg-Atlas-lungcurtain; source noted as a normal lung curtain clip from The POCUS Atlas.',
    ...reviewedVideoSource({
      sourceUrl:
        'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Reg-Atlas-lungcurtain.gif',
      license: 'CC BY-NC 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    }),
    referenceIds: ['jannisborn-covid19-ultrasound'],
    tags: ['ultrasound', 'curtain-sign', 'normal-lung', 'no-drainable-effusion'],
    groundTruth: 'lungCurtainNoTarget',
    neutralVignette:
      'Right lower chest clip where the moving aerated lung boundary must be separated from a pleural fluid target.',
    revealCaption:
      'The teaching target is a lung curtain sweeping over the liver, not a safe fluid pocket.',
    teachingPoint:
      'The curtain sign is dynamic aerated lung movement. In a pleural procedure module it is a critical no-target pattern, especially near the diaphragm.',
    sourceFilename: 'Reg-Atlas-lungcurtain',
    sourceRepositoryUrl: repositoryUrl,
    sourceMetadataUrl: metadataUrl,
    originalFormat: 'gif',
    convertedToMp4: true,
  },
  {
    id: 'dynamic-effusion-adjacent-consolidation',
    kind: 'clip',
    path: 'https://raw.githubusercontent.com/jannisborn/covid19_ultrasound/master/data/pocus_videos/convex/Pneu_northumbria_0409_set6_vid8.avi',
    localPath:
      '/module-assets/v1/pleural-ultrasound/video/dynamic-effusion-adjacent-consolidation.mp4',
    alt: 'Lung ultrasound clip used for dynamic-sign classification.',
    sourceType: 'dataset',
    attribution:
      'jannisborn/covid19_ultrasound row Pneu_northumbria_0409_set6_vid8; Northumbria Specialist Emergency Care Hospital contribution.',
    ...reviewedVideoSource({
      sourceUrl:
        'https://github.com/jannisborn/covid19_ultrasound/blob/master/data/pocus_videos/convex/Pneu_northumbria_0409_set6_vid8.avi',
      license: 'CC BY-NC 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    }),
    referenceIds: ['jannisborn-covid19-ultrasound'],
    tags: ['ultrasound', 'effusion', 'consolidation', 'dynamic-sign'],
    groundTruth: 'effusionAdjacentConsolidation',
    neutralVignette:
      'Pneumonia-context clip where the learner must decide whether dark space and adjacent tissue represent a pleural-procedure target.',
    revealCaption:
      'The teaching target is effusion with adjacent consolidation, a higher-risk context than an isolated simple pocket.',
    teachingPoint:
      'Fluid plus consolidated lung should shift thinking away from “simple tap” autopilot and toward infection, access-window adequacy, and source-control planning.',
    sourceFilename: 'Pneu_northumbria_0409_set6_vid8',
    sourceRepositoryUrl: repositoryUrl,
    sourceMetadataUrl: metadataUrl,
    originalFormat: 'avi',
    convertedToMp4: true,
  },
]

export const publicPleuralUltrasoundVideoAssets = filterEmbeddablePleuralAssets(
  pleuralUltrasoundVideoAssets,
)

export function getUltrasoundVideoAsset(id: string) {
  return pleuralUltrasoundVideoAssets.find((asset) => asset.id === id)
}
