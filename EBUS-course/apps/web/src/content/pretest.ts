import pretestData from '../../../../content/modules/pretest.json';

import { assessmentImageUrls } from '@/content/assessmentImages';
import type { PretestContent, PretestImageAssetKey } from '@/content/types';

export const pretestContent = pretestData as PretestContent;

const pretestImages: Partial<Record<PretestImageAssetKey, { alt: string; caption: string; src: string }>> = {
  'ebus-2026-final-station-4r': {
    alt: 'EBUS ultrasound image of a measured right paratracheal lymph node.',
    caption: 'Figure: cpEBUS view of the sampled right paratracheal node.',
    src: assessmentImageUrls.station4r,
  },
  'ebus-2026-final-mediastinal-pet': {
    alt: 'Axial fused PET/CT showing FDG-avid thoracic lymph nodes.',
    caption: 'Figure: PET/CT with multifocal FDG-avid mediastinal lymph nodes.',
    src: assessmentImageUrls.mediastinalPet,
  },
  'ebus-2026-final-reverberation': {
    alt: 'EBUS image showing horizontal reverberation artifact after needle puncture.',
    caption: 'Figure: loss of probe-wall coupling with reverberation artifact.',
    src: assessmentImageUrls.reverberation,
  },
};

export function getPretestImage(imageAssetKey: PretestImageAssetKey) {
  return pretestImages[imageAssetKey];
}
