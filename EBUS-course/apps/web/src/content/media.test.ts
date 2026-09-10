import { describe, expect, it } from 'vitest';

import { getStationMedia, getStationMediaVariants, getStationPrimaryMedia } from '@/content/media';

describe('getStationMediaVariants', () => {
  it('attaches EBUS annotation sets for configured variants', () => {
    const variants = getStationMediaVariants(getStationMedia('10R'), 'ultrasound');

    expect(variants).toHaveLength(1);
    expect(variants[0]?.annotations?.regions.length).toBeGreaterThan(0);
    expect(variants[0]?.annotationKey).toBe('EBUS_10R.png');
  });

  it('preserves multi-orientation CT variants for station explorer cards', () => {
    const variants = getStationMediaVariants(getStationMedia('7'), 'ct');

    expect(variants.map((variant) => variant.id)).toEqual(['axial', 'coronal', 'sagittal']);
    expect(variants.every((variant) => Boolean(variant.image))).toBe(true);
  });

  it('uses paired unmarked and marked CT variants for refreshed station image sets', () => {
    const stations = ['2R', '4R', '11Rs'] as const;

    stations.forEach((stationId) => {
      const variants = getStationMediaVariants(getStationMedia(stationId), 'ct');

      expect(variants.map((variant) => variant.id)).toEqual(['axial', 'coronal', 'sagittal']);
      expect(variants.every((variant) => Boolean(variant.image))).toBe(true);
      expect(variants.every((variant) => Boolean(variant.revealImage))).toBe(true);
    });
  });

  it('supports the split right interlobar media entries', () => {
    const superior = getStationMediaVariants(getStationMedia('11Rs'), 'ultrasound');
    const inferior = getStationMediaVariants(getStationMedia('11Ri'), 'ultrasound');

    expect(superior[0]?.annotationKey).toBe('EBUS_11Rs.png');
    expect(inferior[0]?.annotationKey).toBe('EBUS_11Ri.png');
  });

  it('loads the newly added 11L EBUS image', () => {
    const variants = getStationMediaVariants(getStationMedia('11L'), 'ultrasound');

    expect(variants).toHaveLength(1);
    expect(variants[0]?.image).toBe('/media/stations/11L/ultrasound/view.jpg');
    expect(variants[0]?.annotationKey).toBe('EBUS_11L.jpg');
    expect(variants[0]?.annotations?.regions.map((region) => region.label)).toEqual([
      'Station 11L',
      'Lung',
      'Pulmonary Artery',
    ]);
  });

  it('falls back to legacy media fields when explicit variants are absent', () => {
    const media = {
      ctImage: '/legacy/ct.jpg',
      ctAnnotatedImage: '/legacy/ct-marked.jpg',
    };

    expect(getStationMediaVariants(media, 'ct')).toEqual([
      {
        id: 'primary',
        label: 'Primary',
        image: '/legacy/ct.jpg',
        revealImage: '/legacy/ct-marked.jpg',
      },
    ]);
    expect(getStationPrimaryMedia(media, 'ct')).toEqual({ kind: 'image', src: '/legacy/ct.jpg' });
  });
});
