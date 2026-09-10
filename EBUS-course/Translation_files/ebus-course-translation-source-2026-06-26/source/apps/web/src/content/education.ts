import knobologyAdvancedData from '../../../../content/modules/knobology-advanced.json';
import mediastinalAnatomyData from '../../../../content/modules/mediastinal-anatomy.json';
import proceduralTechniqueData from '../../../../content/modules/procedural-technique.json';
import sonographicInterpretationData from '../../../../content/modules/sonographic-interpretation.json';
import stagingStrategyData from '../../../../content/modules/staging-strategy.json';

import { getKnobologyMedia, getStationMedia, getStationPrimaryMedia } from '@/content/media';
import type { EducationalModuleContent, ExplorerViewId, KnobologyControlId } from '@/content/types';

export interface RelatedImageAsset {
  id: string;
  label: string;
  note?: string;
  src: string;
}

export const knobologyAdvancedContent = knobologyAdvancedData as EducationalModuleContent;
export const mediastinalAnatomyContent = mediastinalAnatomyData as EducationalModuleContent;
export const sonographicInterpretationContent = sonographicInterpretationData as EducationalModuleContent;
export const proceduralTechniqueContent = proceduralTechniqueData as EducationalModuleContent;
export const stagingStrategyContent = stagingStrategyData as EducationalModuleContent;

export const stationEducationModules = [
  mediastinalAnatomyContent,
  sonographicInterpretationContent,
  proceduralTechniqueContent,
  stagingStrategyContent,
];

function resolveKnobologyImage(controlId: KnobologyControlId): RelatedImageAsset | null {
  const media = getKnobologyMedia(controlId);
  const src = media.comparisonImages?.[0];

  if (!src) {
    return null;
  }

  return {
    id: `knobology:${controlId}`,
    label: controlId.replace(/-/g, ' '),
    note: media.caption,
    src,
  };
}

function resolveStationImage(stationId: string, viewId: ExplorerViewId): RelatedImageAsset | null {
  const media = getStationMedia(stationId);
  const resolved = getStationPrimaryMedia(media, viewId);

  if (!resolved || resolved.kind !== 'image') {
    return null;
  }

  return {
    id: `station:${stationId}:${viewId}`,
    label: `${stationId} ${viewId === 'ct' ? 'CT' : viewId === 'bronchoscopy' ? 'bronchoscopy' : 'EBUS'}`,
    src: resolved.src,
  };
}

export function resolveEducationImages(imageIds: string[] | undefined): RelatedImageAsset[] {
  if (!imageIds?.length) {
    return [];
  }

  return imageIds.flatMap((imageId) => {
    const [kind, resourceId, variant] = imageId.split(':');

    if (kind === 'knobology' && resourceId) {
      const asset = resolveKnobologyImage(resourceId as KnobologyControlId);
      return asset ? [asset] : [];
    }

    if (kind === 'station' && resourceId && variant) {
      const asset = resolveStationImage(resourceId, variant as ExplorerViewId);
      return asset ? [asset] : [];
    }

    return [];
  });
}
