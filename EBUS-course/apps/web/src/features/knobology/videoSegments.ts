import { resolveCourseAssetPath } from '@/lib/assets';

export const KNOBOLOGY_LOOKUP_SRC = resolveCourseAssetPath('/media/knobology/knobology_lookup.json');
export const KNOBOLOGY_SEGMENT_VIDEO_DIR = resolveCourseAssetPath('/media/knobology/Depth_segments');
export const KNOBOLOGY_DEPTH_FILE_SEGMENT_DURATION_SECONDS = 2;

export const KNOBOLOGY_VIDEO_DEPTH_LEVELS = [20, 40, 60, 72, 84, 100] as const;
export const KNOBOLOGY_VIDEO_DEPTHS_CM = [2, 3, 4, 5, 6, 8] as const;
export const KNOBOLOGY_VIDEO_VALUE_LEVELS = [0, 14, 29, 43, 57, 71, 86, 100] as const;

export type KnobologyVideoDepthCm = (typeof KNOBOLOGY_VIDEO_DEPTHS_CM)[number];
export type KnobologyVideoValueIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type KnobologyFlowSegmentMode = 'color' | 'power' | 'h-flow';
export type KnobologyBModeSegmentControl = 'depth' | 'gain' | 'contrast';

export interface KnobologyVideoSegmentSequence {
  start_frame: number;
  end_frame: number;
  start_seconds: number;
  end_seconds: number;
  duration_frames: number;
  duration_seconds: number;
}

export interface KnobologyVideoSegment {
  name: string;
  depth: number;
  control: 'gain' | 'contrast' | 'flow_mode' | string;
  value: number | string;
  sequence: KnobologyVideoSegmentSequence;
  source?: {
    file: string | null;
    in_frame: number;
    out_frame: number;
    in_seconds: number;
    out_seconds: number;
    source_duration_frames: number;
    source_duration_seconds: number;
  };
}

export interface KnobologyVideoLookup {
  meta?: {
    fps?: number;
    clip_count?: number;
    description?: string;
    source_xml?: string;
  };
  by_name: Record<string, KnobologyVideoSegment>;
}

export interface KnobologyVideoSegmentRequest {
  depth: number;
  gain: number;
  contrast: number;
  control: KnobologyBModeSegmentControl;
  flowMode?: KnobologyFlowSegmentMode | null;
}

export interface ResolvedKnobologyVideoSegment {
  segment: KnobologyVideoSegment;
  label: string;
  isPreferredBestView: boolean;
}

export const PREFERRED_BEST_VIEW_SEGMENT_NAMES = [
  'Depth4_Gain_3',
  'Depth4_Contrast_4',
  'Depth3_Gain_4',
  'Depth3_Contrast_4',
] as const;

const PREFERRED_BEST_VIEW_SEGMENTS = new Set<string>(PREFERRED_BEST_VIEW_SEGMENT_NAMES);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getNearestIndex(values: readonly number[], value: number): number {
  const safeValue = Number.isFinite(value) ? value : values[0];

  return values.reduce((closestIndex, level, index) => {
    const closestDelta = Math.abs(values[closestIndex] - safeValue);
    const currentDelta = Math.abs(level - safeValue);

    return currentDelta < closestDelta ? index : closestIndex;
  }, 0);
}

export function getKnobologyVideoDepthCm(depth: number): KnobologyVideoDepthCm {
  return KNOBOLOGY_VIDEO_DEPTHS_CM[getNearestIndex(KNOBOLOGY_VIDEO_DEPTH_LEVELS, clamp(depth, 0, 100))];
}

export function getKnobologyVideoValueIndex(value: number): KnobologyVideoValueIndex {
  return (getNearestIndex(KNOBOLOGY_VIDEO_VALUE_LEVELS, clamp(value, 0, 100)) + 1) as KnobologyVideoValueIndex;
}

export function getKnobologyVideoValueForIndex(index: KnobologyVideoValueIndex): number {
  return KNOBOLOGY_VIDEO_VALUE_LEVELS[index - 1];
}

export function stepKnobologyVideoValue(value: number, direction: -1 | 1): number {
  const currentIndex = getKnobologyVideoValueIndex(value) - 1;
  const nextIndex = clamp(currentIndex + direction, 0, KNOBOLOGY_VIDEO_VALUE_LEVELS.length - 1);

  return KNOBOLOGY_VIDEO_VALUE_LEVELS[nextIndex];
}

export function getPreferredDepthSegmentName(depthCm: KnobologyVideoDepthCm): string | null {
  if (depthCm === 4) {
    return 'Depth4_Gain_3';
  }

  if (depthCm === 3) {
    return 'Depth3_Gain_4';
  }

  return null;
}

function getFlowSegmentCandidates(depthCm: KnobologyVideoDepthCm, mode: KnobologyFlowSegmentMode): string[] {
  if (mode === 'color') {
    return [`Depth${depthCm}_Color_Flow`, `Depth${depthCm}_Color.mp4`];
  }

  if (mode === 'power') {
    return [`Depth${depthCm}_Power_Flow`];
  }

  return [`Depth${depthCm}_H_Flow`];
}

export function getKnobologyVideoSegmentCandidates(request: KnobologyVideoSegmentRequest): string[] {
  const depthCm = getKnobologyVideoDepthCm(request.depth);

  if (request.flowMode) {
    return getFlowSegmentCandidates(depthCm, request.flowMode);
  }

  if (request.control === 'depth') {
    const preferredSegment = getPreferredDepthSegmentName(depthCm);

    if (preferredSegment) {
      return [preferredSegment, `Depth${depthCm}_Gain_${getKnobologyVideoValueIndex(request.gain)}`];
    }
  }

  if (request.control === 'contrast') {
    return [`Depth${depthCm}_Contrast_${getKnobologyVideoValueIndex(request.contrast)}`];
  }

  return [`Depth${depthCm}_Gain_${getKnobologyVideoValueIndex(request.gain)}`];
}

export function formatKnobologyVideoSegmentLabel(segment: KnobologyVideoSegment): string {
  if (segment.control === 'flow_mode') {
    const flowLabel =
      segment.value === 'power' ? 'Power Flow' : segment.value === 'h_flow' ? 'H-flow' : 'Color Flow';

    return `Depth ${segment.depth} cm · ${flowLabel}`;
  }

  const controlLabel = segment.control === 'contrast' ? 'Contrast' : 'Gain';

  return `Depth ${segment.depth} cm · ${controlLabel} ${segment.value}`;
}

export function getKnobologyVideoSegmentSrc(depthCm: KnobologyVideoDepthCm | number): string {
  return resolveCourseAssetPath(`/media/knobology/Depth_segments/Depth${depthCm}.mp4`);
}

function getNumericSegmentValue(value: number | string): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getDepthFileOffsetForFlowMode(value: number | string): number | null {
  if (value === 'color') {
    return 32;
  }

  if (value === 'power') {
    return 34;
  }

  if (value === 'h_flow') {
    return 36;
  }

  return null;
}

function getDepthFileSegmentStart(segment: KnobologyVideoSegment): number | null {
  const numericValue = getNumericSegmentValue(segment.value);

  if (segment.control === 'gain' && numericValue !== null && numericValue >= 1 && numericValue <= 8) {
    return (numericValue - 1) * KNOBOLOGY_DEPTH_FILE_SEGMENT_DURATION_SECONDS;
  }

  if (segment.control === 'contrast' && numericValue !== null && numericValue >= 1 && numericValue <= 8) {
    return 16 + (numericValue - 1) * KNOBOLOGY_DEPTH_FILE_SEGMENT_DURATION_SECONDS;
  }

  if (segment.control === 'flow_mode') {
    return getDepthFileOffsetForFlowMode(segment.value);
  }

  return null;
}

export function getKnobologyVideoSegmentStart(segment: KnobologyVideoSegment): number {
  const depthFileStart = getDepthFileSegmentStart(segment);

  if (depthFileStart !== null) {
    return depthFileStart;
  }

  return typeof segment.source?.in_seconds === 'number' ? segment.source.in_seconds : segment.sequence.start_seconds;
}

export function getKnobologyVideoSegmentEnd(segment: KnobologyVideoSegment): number {
  const depthFileStart = getDepthFileSegmentStart(segment);

  if (depthFileStart !== null) {
    return depthFileStart + KNOBOLOGY_DEPTH_FILE_SEGMENT_DURATION_SECONDS;
  }

  return typeof segment.source?.out_seconds === 'number' ? segment.source.out_seconds : segment.sequence.end_seconds;
}

export function resolveKnobologyVideoSegment(
  lookup: KnobologyVideoLookup,
  request: KnobologyVideoSegmentRequest,
): ResolvedKnobologyVideoSegment | null {
  const segmentName = getKnobologyVideoSegmentCandidates(request).find((candidate) => lookup.by_name[candidate]);
  const segment = segmentName ? lookup.by_name[segmentName] : null;

  if (!segment) {
    return null;
  }

  return {
    segment,
    label: formatKnobologyVideoSegmentLabel(segment),
    isPreferredBestView: PREFERRED_BEST_VIEW_SEGMENTS.has(segment.name),
  };
}

export function isKnobologyVideoLookup(value: unknown): value is KnobologyVideoLookup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const byName = (value as { by_name?: unknown }).by_name;

  if (!byName || typeof byName !== 'object') {
    return false;
  }

  return Object.values(byName).every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const segment = entry as Partial<KnobologyVideoSegment>;
    const sequence = segment.sequence as Partial<KnobologyVideoSegmentSequence> | undefined;

    return (
      typeof segment.name === 'string' &&
      isFiniteNumber(segment.depth) &&
      Boolean(sequence) &&
      isFiniteNumber(sequence?.start_seconds) &&
      isFiniteNumber(sequence?.end_seconds)
    );
  });
}
