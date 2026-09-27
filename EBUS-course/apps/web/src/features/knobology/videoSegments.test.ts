import { describe, expect, it } from 'vitest';

import recordedLookup from '../../../public/media/knobology/knobology_lookup.json';
import {
  DEPTH3_MEDIA_VERSION,
  KNOBOLOGY_VIDEO_DEPTHS_CM,
  getKnobologyVideoDepthCm,
  getKnobologyVideoSegmentCandidates,
  getKnobologyVideoSegmentEnd,
  getKnobologyVideoSegmentSrc,
  getKnobologyVideoSegmentStart,
  getKnobologyVideoValueIndex,
  resolveKnobologyVideoSegment,
  type KnobologyVideoLookup,
  type KnobologyVideoSegment,
} from '@/features/knobology/videoSegments';

function makeSegment(name: string, depth: number, control: KnobologyVideoSegment['control'], value: number | string) {
  return {
    name,
    depth,
    control,
    value,
    sequence: {
      start_frame: 0,
      end_frame: 120,
      start_seconds: 0,
      end_seconds: 2,
      duration_frames: 120,
      duration_seconds: 2,
    },
    source: {
      file: `${name}.mp4`,
      in_frame: 0,
      out_frame: 120,
      in_seconds: 0,
      out_seconds: 2,
      source_duration_frames: 120,
      source_duration_seconds: 2,
    },
  };
}

const lookup: KnobologyVideoLookup = {
  by_name: {
    Depth4_Gain_3: makeSegment('Depth4_Gain_3', 4, 'gain', 3),
    Depth3_Gain_4: makeSegment('Depth3_Gain_4', 3, 'gain', 4),
    Depth4_Contrast_4: makeSegment('Depth4_Contrast_4', 4, 'contrast', 4),
    'Depth5_Color.mp4': makeSegment('Depth5_Color.mp4', 5, 'flow_mode', 'color'),
    Depth4_Power_Flow: makeSegment('Depth4_Power_Flow', 4, 'flow_mode', 'power'),
  },
};

describe('knobology video segment mapping', () => {
  it('maps the internal depth scale to the available EBUS depth clips', () => {
    expect(getKnobologyVideoDepthCm(20)).toBe(2);
    expect(getKnobologyVideoDepthCm(40)).toBe(3);
    expect(getKnobologyVideoDepthCm(60)).toBe(4);
    expect(getKnobologyVideoDepthCm(72)).toBe(5);
    expect(getKnobologyVideoDepthCm(84)).toBe(6);
    expect(getKnobologyVideoDepthCm(100)).toBe(8);
  });

  it('maps gain and contrast values to the eight recorded steps', () => {
    expect(getKnobologyVideoValueIndex(0)).toBe(1);
    expect(getKnobologyVideoValueIndex(29)).toBe(3);
    expect(getKnobologyVideoValueIndex(43)).toBe(4);
    expect(getKnobologyVideoValueIndex(100)).toBe(8);
  });

  it('prefers the best-view clips when depth is the active control', () => {
    const segment = resolveKnobologyVideoSegment(lookup, {
      depth: 60,
      gain: 100,
      contrast: 43,
      control: 'depth',
    });

    expect(segment?.segment.name).toBe('Depth4_Gain_3');
    expect(segment?.isPreferredBestView).toBe(true);
  });

  it('uses contrast-specific clips when contrast is active', () => {
    expect(
      getKnobologyVideoSegmentCandidates({
        depth: 60,
        gain: 29,
        contrast: 43,
        control: 'contrast',
      }),
    ).toEqual(['Depth4_Contrast_4']);
  });

  it('falls back to the Depth5 color-flow key emitted by the lookup file', () => {
    const segment = resolveKnobologyVideoSegment(lookup, {
      depth: 72,
      gain: 29,
      contrast: 43,
      control: 'depth',
      flowMode: 'color',
    });

    expect(segment?.segment.name).toBe('Depth5_Color.mp4');
  });

  it('resolves per-depth source files and prefers source-local timing when present', () => {
    const contrastSegment: KnobologyVideoSegment = {
      ...makeSegment('Depth4_Contrast_4', 4, 'contrast', 4),
      sequence: {
        start_frame: 8160,
        end_frame: 8280,
        start_seconds: 136,
        end_seconds: 138,
        duration_frames: 120,
        duration_seconds: 2,
      },
      source: {
        file: null,
        in_frame: 360,
        out_frame: 480,
        in_seconds: 6,
        out_seconds: 8,
        source_duration_frames: 960,
        source_duration_seconds: 16,
      },
    };
    const flowSegment: KnobologyVideoSegment = {
      ...makeSegment('Depth5_Power_Flow', 5, 'flow_mode', 'power'),
      sequence: {
        start_frame: 6600,
        end_frame: 6720,
        start_seconds: 110,
        end_seconds: 112,
        duration_frames: 120,
        duration_seconds: 2,
      },
      source: {
        file: null,
        in_frame: 120,
        out_frame: 240,
        in_seconds: 2,
        out_seconds: 4,
        source_duration_frames: 360,
        source_duration_seconds: 6,
      },
    };

    expect(getKnobologyVideoSegmentSrc(4)).toBe('/media/knobology/Depth_segments/Depth4.mp4');
    expect(getKnobologyVideoSegmentStart(contrastSegment)).toBe(22);
    expect(getKnobologyVideoSegmentEnd(contrastSegment)).toBe(24);
    expect(getKnobologyVideoSegmentStart(flowSegment)).toBe(34);
    expect(getKnobologyVideoSegmentEnd(flowSegment)).toBe(36);
  });
});

describe('Depth3 media cache version', () => {
  const recorded = recordedLookup as KnobologyVideoLookup;

  it('versions only the de-identified Depth3 recording URL', () => {
    expect(DEPTH3_MEDIA_VERSION).toBe('9780f54a');
    expect(getKnobologyVideoSegmentSrc(3)).toBe('/media/knobology/Depth_segments/Depth3.mp4?v=9780f54a');
    expect(getKnobologyVideoSegmentSrc(4)).toBe('/media/knobology/Depth_segments/Depth4.mp4');
    expect(getKnobologyVideoSegmentSrc(2)).toBe('/media/knobology/Depth_segments/Depth2.mp4');
    expect(getKnobologyVideoSegmentSrc(8)).toBe('/media/knobology/Depth_segments/Depth8.mp4');
  });

  it('changes no asset path, only the Depth3 query', () => {
    for (const depthCm of KNOBOLOGY_VIDEO_DEPTHS_CM) {
      const [path, query] = getKnobologyVideoSegmentSrc(depthCm).split('?');

      expect(path).toBe(`/media/knobology/Depth_segments/Depth${depthCm}.mp4`);
      expect(query).toBe(depthCm === 3 ? `v=${DEPTH3_MEDIA_VERSION}` : undefined);
    }
  });

  it('is stable across calls', () => {
    expect(getKnobologyVideoSegmentSrc(3)).toBe(getKnobologyVideoSegmentSrc(3));
  });

  it('keeps every recorded Depth3 segment id and window unchanged', () => {
    const expectedWindows: Record<string, [number, number]> = {
      Depth3_Gain_1: [0, 2],
      Depth3_Gain_2: [2, 4],
      Depth3_Gain_3: [4, 6],
      Depth3_Gain_4: [6, 8],
      Depth3_Gain_5: [8, 10],
      Depth3_Gain_6: [10, 12],
      Depth3_Gain_7: [12, 14],
      Depth3_Gain_8: [14, 16],
      Depth3_Contrast_1: [16, 18],
      Depth3_Contrast_2: [18, 20],
      Depth3_Contrast_3: [20, 22],
      Depth3_Contrast_4: [22, 24],
      Depth3_Contrast_5: [24, 26],
      Depth3_Contrast_6: [26, 28],
      Depth3_Contrast_7: [28, 30],
      Depth3_Contrast_8: [30, 32],
      Depth3_Color_Flow: [32, 34],
      Depth3_Power_Flow: [34, 36],
      Depth3_H_Flow: [36, 38],
    };
    const depth3Names = Object.keys(recorded.by_name).filter((name) => name.startsWith('Depth3'));

    expect(depth3Names.sort()).toEqual(Object.keys(expectedWindows).sort());

    for (const [name, [start, end]] of Object.entries(expectedWindows)) {
      const segment = recorded.by_name[name];

      expect(segment.depth).toBe(3);
      expect([getKnobologyVideoSegmentStart(segment), getKnobologyVideoSegmentEnd(segment)]).toEqual([start, end]);
    }
  });

  it('keeps the Depth3 gain, contrast and flow lookup unchanged', () => {
    const depth3 = { depth: 40, gain: 43, contrast: 43 };

    expect(resolveKnobologyVideoSegment(recorded, { ...depth3, control: 'gain' })?.segment.name).toBe(
      'Depth3_Gain_4',
    );
    expect(resolveKnobologyVideoSegment(recorded, { ...depth3, gain: 71, control: 'gain' })?.segment.name).toBe(
      'Depth3_Gain_6',
    );
    expect(resolveKnobologyVideoSegment(recorded, { ...depth3, contrast: 71, control: 'contrast' })?.segment.name).toBe(
      'Depth3_Contrast_6',
    );
    expect(resolveKnobologyVideoSegment(recorded, { ...depth3, gain: 100, control: 'depth' })?.segment.name).toBe(
      'Depth3_Gain_4',
    );
    expect(
      resolveKnobologyVideoSegment(recorded, { ...depth3, control: 'depth', flowMode: 'color' })?.segment.name,
    ).toBe('Depth3_Color_Flow');
    expect(
      resolveKnobologyVideoSegment(recorded, { ...depth3, control: 'depth', flowMode: 'power' })?.segment.name,
    ).toBe('Depth3_Power_Flow');
    expect(
      resolveKnobologyVideoSegment(recorded, { ...depth3, control: 'depth', flowMode: 'h-flow' })?.segment.name,
    ).toBe('Depth3_H_Flow');
    expect(
      resolveKnobologyVideoSegment(recorded, { depth: 60, gain: 43, contrast: 43, control: 'depth' })?.segment.name,
    ).toBe('Depth4_Gain_3');
  });
});
