import ebusAnnotationsData from '@/content/ebus-annotations.json';
import knobologyMediaData from '@/content/knobology-media.json';
import stationMediaData from '@/content/station-media.json';
import type {
  ExplorerViewId,
  KnobologyControlId,
  KnobologyMediaEntry,
  StationAnnotationSet,
  StationMediaEntry,
  StationMediaVariant,
} from '@/content/types';
import { mapNestedAssetPaths } from '@/lib/assets';

export const stationMedia = mapNestedAssetPaths(stationMediaData as Record<string, StationMediaEntry>);
export const knobologyMedia = mapNestedAssetPaths(
  knobologyMediaData as Record<KnobologyControlId, KnobologyMediaEntry>,
);
const ebusAnnotations = ebusAnnotationsData as unknown as Record<string, StationAnnotationSet>;

export function getStationMedia(stationId: string): StationMediaEntry {
  return stationMedia[stationId] ?? {};
}

export function getKnobologyMedia(controlId: KnobologyControlId): KnobologyMediaEntry {
  return knobologyMedia[controlId] ?? {};
}

function withAnnotations(variants: StationMediaVariant[] | undefined): StationMediaVariant[] {
  return (variants ?? []).map((variant) => {
    if (!variant.annotationKey) {
      return variant;
    }

    return {
      ...variant,
      annotations: ebusAnnotations[variant.annotationKey],
    };
  });
}

export function getStationMediaVariants(media: StationMediaEntry, viewId: ExplorerViewId): StationMediaVariant[] {
  if (viewId === 'ct') {
    if (media.ctVariants?.length) {
      return withAnnotations(media.ctVariants);
    }

    if (media.ctImage || media.ctAnnotatedImage) {
      return [
        {
          id: 'primary',
          label: 'Primary',
          image: media.ctImage ?? media.ctAnnotatedImage,
          revealImage: media.ctImage && media.ctAnnotatedImage ? media.ctAnnotatedImage : undefined,
        },
      ];
    }
  }

  if (viewId === 'bronchoscopy') {
    if (media.bronchoscopyVariants?.length) {
      return withAnnotations(media.bronchoscopyVariants);
    }

    if (media.bronchoscopyImage || media.bronchoscopyVideo) {
      return [
        {
          id: 'primary',
          label: 'Primary',
          image: media.bronchoscopyImage,
        },
      ];
    }
  }

  if (viewId === 'ultrasound') {
    if (media.ebusVariants?.length) {
      return withAnnotations(media.ebusVariants);
    }

    if (media.ebusImage || media.ebusVideo) {
      return [
        {
          id: 'primary',
          label: 'Primary',
          image: media.ebusImage,
        },
      ];
    }
  }

  return [];
}

export function getStationPrimaryMedia(
  media: StationMediaEntry,
  viewId: 'ct' | 'bronchoscopy' | 'ultrasound',
): { kind: 'image' | 'video'; src: string } | null {
  const variants = getStationMediaVariants(media, viewId);

  if (variants[0]?.image || variants[0]?.revealImage) {
    return { kind: 'image', src: variants[0].image ?? variants[0].revealImage ?? '' };
  }

  if (viewId === 'ct') {
    if (media.ctAnnotatedImage) {
      return { kind: 'image', src: media.ctAnnotatedImage };
    }

    if (media.ctImage) {
      return { kind: 'image', src: media.ctImage };
    }
  }

  if (viewId === 'bronchoscopy') {
    if (media.bronchoscopyVideo) {
      return { kind: 'video', src: media.bronchoscopyVideo };
    }

    if (media.bronchoscopyImage) {
      return { kind: 'image', src: media.bronchoscopyImage };
    }
  }

  if (viewId === 'ultrasound') {
    if (media.ebusVideo) {
      return { kind: 'video', src: media.ebusVideo };
    }

    if (media.ebusImage) {
      return { kind: 'image', src: media.ebusImage };
    }
  }

  return null;
}
