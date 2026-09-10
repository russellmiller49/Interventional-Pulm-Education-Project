import case001RuntimeData from '../../../../../content/cases/case_001.runtime.json';
import case001CtUrl from '../../../../../model/case_001_ct.nrrd?url';
import case001SegmentationUrl from '../../../../../model/case_001_segmentation.nrrd?url';
import case001GlbBaseUrl from '../../../../../model/CT_segmentation_1.glb?url';
import case001GlbHighlightUrl from '../../../../../model/CT_segmentation_2.glb?url';

import type { RuntimeCaseManifest } from '../../../../../features/case3d/types';

export const case001Runtime = case001RuntimeData as unknown as RuntimeCaseManifest;

export const case001AssetUrls = {
  ct: case001CtUrl,
  segmentation: case001SegmentationUrl,
  glb: case001GlbBaseUrl,
  glbHighlight: case001GlbHighlightUrl,
} as const;
