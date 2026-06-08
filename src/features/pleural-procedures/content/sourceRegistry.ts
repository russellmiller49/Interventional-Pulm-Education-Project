import type {
  PleuralAsset,
  PleuralLicenseLabel,
  PleuralPermissionStatus,
  PleuralReusePolicy,
  PleuralReviewStatus,
  PleuralTransformPolicy,
} from './types'

export interface PleuralModuleSource {
  id: string
  name: string
  url: string
  license: PleuralLicenseLabel
  licenseUrl?: string
  reusePolicy: PleuralReusePolicy
  transformPolicy: PleuralTransformPolicy
  attributionRequired: boolean
  permissionStatus: PleuralPermissionStatus
  reviewStatus: PleuralReviewStatus
  useScope: string
  sourceNote: string
}

export const pleuralModuleSourceRegistry: readonly PleuralModuleSource[] = [
  {
    id: 'mendeley-lus-katumba-2025',
    name: 'Mendeley LUS disease classification dataset',
    url: 'https://data.mendeley.com/datasets/hb3p34ytvx/2',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reusePolicy: 'audit-required',
    transformPolicy: 'derivatives-allowed',
    attributionRequired: true,
    permissionStatus: 'granted-by-license',
    reviewStatus: 'pending-audit',
    useScope:
      'Candidate still-image source for normal, B-line, diseased-lung, and image-quality distractor examples.',
    sourceNote:
      'CC BY allows reuse with attribution, but each selected frame still needs clinical relevance, deidentification, and pleural-module review before public embedding.',
  },
  {
    id: 'figshare-lung-ultrasound-2025',
    name: 'figshare Lung Ultrasound Dataset',
    url: 'https://figshare.com/articles/dataset/Lung_Ultrasound_Dataset/30093577',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reusePolicy: 'audit-required',
    transformPolicy: 'derivatives-allowed',
    attributionRequired: true,
    permissionStatus: 'granted-by-license',
    reviewStatus: 'pending-audit',
    useScope:
      'Candidate still-image source for lung ultrasound context and malignant-vs-benign framing after download review.',
    sourceNote:
      'Listed as CC BY on figshare, but the files must be inspected before use because the dataset focus is not specifically pleural effusion teaching.',
  },
  {
    id: 'jannisborn-covid19-ultrasound',
    name: 'jannisborn/covid19_ultrasound',
    url: 'https://github.com/jannisborn/covid19_ultrasound',
    license: 'Mixed or row-level',
    reusePolicy: 'audit-required',
    transformPolicy: 'not-reviewed',
    attributionRequired: true,
    permissionStatus: 'audit-required',
    reviewStatus: 'pending-audit',
    useScope:
      'Useful metadata and pattern taxonomy; public media use requires row-level license confirmation.',
    sourceNote:
      'The repository includes mixed sources and explicitly asks users to verify individual licenses before use.',
  },
  {
    id: 'mendeley-lus-raw-snapshot-2026-06-03',
    name: 'Embedded Mendeley raw LUS snapshot',
    url: 'https://data.mendeley.com/datasets/hb3p34ytvx/2',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reusePolicy: 'embeddable',
    transformPolicy: 'derivatives-allowed',
    attributionRequired: true,
    permissionStatus: 'granted-by-license',
    reviewStatus: 'reviewed',
    useScope:
      'Repository-bundled raw-pixel examples for effusion, consolidation, B-lines, and normal lung labels.',
    sourceNote:
      'Small public-teaching snapshot copied from the CC BY raw archive without cropping or label rewriting; the full source archive still needs case-by-case audit before broad embedding.',
  },
  {
    id: 'figshare-lung-ultrasound-raw-snapshot-2026-06-03',
    name: 'Embedded figshare lung ultrasound raw snapshot',
    url: 'https://figshare.com/articles/dataset/Lung_Ultrasound_Dataset/30093577',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    reusePolicy: 'embeddable',
    transformPolicy: 'derivatives-allowed',
    attributionRequired: true,
    permissionStatus: 'granted-by-license',
    reviewStatus: 'reviewed',
    useScope:
      'Repository-bundled raw-pixel examples for benign and malignant peripheral lung lesion context.',
    sourceNote:
      'Selected from the CC BY archive after workbook inspection; app metadata keeps translated class labels and deidentified folder IDs, not patient names or free-text pathology.',
  },
  {
    id: 'nrc-cnrc-covid-us',
    name: 'nrc-cnrc/COVID-US',
    url: 'https://github.com/nrc-cnrc/COVID-US',
    license: 'Mixed or row-level',
    reusePolicy: 'reference-only',
    transformPolicy: 'not-reviewed',
    attributionRequired: true,
    permissionStatus: 'reference-only',
    reviewStatus: 'reference-only',
    useScope:
      'Reference for processing, masks, severity scoring, and metadata structure rather than public media embedding.',
    sourceNote:
      'The benchmark aggregates several sources with mixed or unclear data licenses; keep it out of public asset rendering by default.',
  },
  {
    id: 'covid-blues',
    name: 'COVID-BLUES',
    url: 'https://github.com/NinaWie/COVID-BLUES',
    license: 'CC BY-NC-ND 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
    reusePolicy: 'reference-only',
    transformPolicy: 'no-derivatives',
    attributionRequired: true,
    permissionStatus: 'reference-only',
    reviewStatus: 'reference-only',
    useScope:
      'Reference for standardized BLUE-point protocol, clinical variables, and severity labels.',
    sourceNote:
      'No-derivatives licensing makes cropping, frame extraction, remixing, and transformed teaching assets unsuitable without separate permission.',
  },
  {
    id: 'iame-sonoworld-archive',
    name: 'IAME Sonoworld archive',
    url: 'https://iame.com/sonoworld-archive',
    license: 'All rights reserved',
    reusePolicy: 'permission-required',
    transformPolicy: 'no-derivatives',
    attributionRequired: true,
    permissionStatus: 'permission-needed',
    reviewStatus: 'reference-only',
    useScope:
      'Educator reference and permission target only; do not download, copy, archive, embed, or deep-link media.',
    sourceNote:
      'The archive policy says video content remains under IAME copyright and requires express written permission for reuse.',
  },
  {
    id: 'gusi-pleural-effusion-videos',
    name: 'Global Ultrasound Institute pleural effusion videos',
    url: 'https://globalultrasoundinstitute.com/video-category/pleural-effusion/',
    license: 'All rights reserved',
    reusePolicy: 'permission-required',
    transformPolicy: 'no-derivatives',
    attributionRequired: true,
    permissionStatus: 'permission-needed',
    reviewStatus: 'reference-only',
    useScope:
      'Educator reference and permission target for pleural effusion, atelectasis, consolidation, and spine-sign clips.',
    sourceNote:
      'The public page lists valuable examples, but the site footer is all-rights-reserved and no reuse license is visible.',
  },
]

const defaultEmbeddableLicenses = new Set<PleuralLicenseLabel>(['CC BY 4.0', 'CC BY-NC 4.0'])

type PleuralAssetPolicyFields = Pick<
  PleuralAsset,
  'license' | 'reusePolicy' | 'permissionStatus' | 'reviewStatus'
>

export function canEmbedPleuralAsset(asset: PleuralAssetPolicyFields) {
  if (asset.reusePolicy !== 'embeddable' || asset.reviewStatus !== 'reviewed') {
    return false
  }

  if (asset.permissionStatus === 'permission-granted') {
    return true
  }

  return (
    asset.permissionStatus === 'granted-by-license' && defaultEmbeddableLicenses.has(asset.license)
  )
}

export function filterEmbeddablePleuralAssets<T extends PleuralAssetPolicyFields>(
  assets: readonly T[],
) {
  return assets.filter(canEmbedPleuralAsset)
}

export function getPleuralReusePolicyLabel(policy: PleuralReusePolicy) {
  switch (policy) {
    case 'embeddable':
      return 'Embeddable'
    case 'audit-required':
      return 'Audit required'
    case 'reference-only':
      return 'Reference only'
    case 'permission-required':
      return 'Permission required'
  }
}
