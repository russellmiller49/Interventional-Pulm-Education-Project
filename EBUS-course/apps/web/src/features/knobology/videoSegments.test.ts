import { describe, expect, it } from 'vitest';

import {
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
