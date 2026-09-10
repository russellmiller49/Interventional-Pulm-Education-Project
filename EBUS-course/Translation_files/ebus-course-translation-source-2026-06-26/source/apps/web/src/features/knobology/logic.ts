import type { KnobologyCorrectionExercise } from '@/content/types';
import {
  getKnobologyVideoDepthCm,
  getKnobologyVideoValueForIndex,
  KNOBOLOGY_VIDEO_DEPTH_LEVELS,
  stepKnobologyVideoValue,
} from '@/features/knobology/videoSegments';

export type KnobologyImagingMode = 'b' | 'flow' | 'pw';
export type KnobologyMeasurementMode = 'off' | 'measure' | 'trace';
export type KnobologyMenuMode = 'none' | 'main' | 'image-adjust';
export type KnobologyHarmonicMode = 'off' | 'p' | 'r';
export type KnobologyObservationPreset = 'GI' | 'PB' | 'RSP' | null;
export type KnobologyMeasurementMarkerIndex = 0 | 1;

export type KnobologyProcessorActionId =
  | 'SAVE_REC'
  | 'RELEASE'
  | 'TOGGLE_PIP'
  | 'PW_MODE'
  | 'FLOW_MODE'
  | 'B_MODE'
  | 'CLEAR'
  | 'TRACE_MODE'
  | 'MEASURE_MODE'
  | 'CURSOR_MODE'
  | 'COMMENT_ADD'
  | 'COMMENT_CLEAR'
  | 'MEASURE_SET'
  | 'PAGE_UP'
  | 'HOME'
  | 'END'
  | 'PAGE_DOWN'
  | 'IR_MODE'
  | 'SCROLL_MODE'
  | 'CINE_REVIEW_MODE'
  | 'POWER_DOWN'
  | 'POWER_UP'
  | 'GAIN_DOWN'
  | 'GAIN_UP'
  | 'DEPTH_UP'
  | 'FOCUS_CYCLE'
  | 'CINE_STEP_BACK'
  | 'CINE_PLAY_PAUSE'
  | 'CINE_STEP_FORWARD'
  | 'TOGGLE_FREEZE'
  | 'OPEN_MAIN_MENU'
  | 'OPEN_IMAGE_ADJUST'
  | 'DISPLAY_LEFT'
  | 'DISPLAY_CENTER'
  | 'DISPLAY_RIGHT'
  | 'TOGGLE_ENHANCE'
  | 'THE_OFF'
  | 'THE_P'
  | 'THE_R'
  | 'ELST'
  | 'FREQUENCY_DOWN'
  | 'FREQUENCY_UP'
  | 'FOCUS_DOWN'
  | 'FOCUS_UP'
  | 'OBS_GI'
  | 'OBS_PB'
  | 'OBS_RSP';

export interface KnobologyFrameState {
  depth: number;
  gain: number;
  contrast: number;
  colorDoppler: boolean;
  calipers: boolean;
  frozen: boolean;
  saved: boolean;
  pipEnabled: boolean;
  mode: KnobologyImagingMode;
  measurementMode: KnobologyMeasurementMode;
  measurementPoints: number;
  measurementStart: KnobologyMeasurementPoint | null;
  measurementEnd: KnobologyMeasurementPoint | null;
  activeMeasurementMarker: KnobologyMeasurementMarkerIndex | null;
  commentCount: number;
  irMode: boolean;
  scrollMode: boolean;
  cineReviewMode: boolean;
  cineFrame: number;
  cinePlaying: boolean;
  menu: KnobologyMenuMode;
  enhanceEnabled: boolean;
  harmonicMode: KnobologyHarmonicMode;
  acousticPower: number;
  frequencyIndex: number;
  focusIndex: number;
  observationPreset: KnobologyObservationPreset;
  lastActionId: KnobologyProcessorActionId | null;
  statusMessage: string;
}

export interface KnobologyFrameMetrics {
  brightness: number;
  hazeOpacity: number;
  nodeSize: number;
  nodeY: number;
  borderOpacity: number;
  colorSignalOpacity: number;
  realFrameBrightness: number;
  realFrameContrast: number;
  pipOpacity: number;
  waveformOpacity: number;
  focusMarkerY: number;
  imageShiftX: number;
  imageScale: number;
}

export interface ExerciseEvaluation {
  score: number;
  solved: boolean;
  feedback: string;
}

export interface KnobologyMeasurementPoint {
  x: number;
  y: number;
}

export type KnobologySimulatorAction =
  | {
      type: 'RESET_FOR_EXERCISE';
      exercise: KnobologyCorrectionExercise;
    }
  | {
      type: 'SET_NUMERIC_FIELD';
      field: 'depth' | 'gain' | 'contrast';
      value: number;
    }
  | {
      type: 'SET_COLOR_DOPPLER';
      enabled: boolean;
    }
  | {
      type: 'MOVE_TRACKBALL';
      deltaX: number;
      deltaY: number;
    }
  | {
      type: 'PROCESSOR_ACTION';
      actionId: KnobologyProcessorActionId;
    };

const DEFAULT_DEPTH_FRAME_LEVELS = KNOBOLOGY_VIDEO_DEPTH_LEVELS;
const FOCUS_MARKER_LEVELS = [26, 42, 58, 74] as const;
export const FREQUENCY_LABELS = ['5.0 MHz', '6.5 MHz', '7.5 MHz'] as const;
const CINE_FRAME_COUNT = 7;
const MEASUREMENT_DEFAULT_POINT = {
  x: 0.49,
  y: 0.44,
} as const satisfies KnobologyMeasurementPoint;
const MEASUREMENT_TRACKBALL_SENSITIVITY = 0.0012;
const MEASUREMENT_SECTOR = {
  apexX: 0.5,
  apexY: 0.055,
  baseY: 0.905,
  baseWidth: 0.92,
  sectorAngleDegrees: 72,
} as const;
const MEASUREMENT_CURSOR_BOUNDS = {
  minX: 0.045,
  maxX: 0.94,
  minY: 0.065,
  maxY: 0.895,
} as const;
const CONTRAST_PRESETS = {
  off: getKnobologyVideoValueForIndex(1),
  p: getKnobologyVideoValueForIndex(4),
  r: getKnobologyVideoValueForIndex(8),
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cycleIndex(current: number, length: number, step: number = 1): number {
  return (current + step + length) % length;
}

function cycleDepth(depth: number): number {
  const currentIndex = DEFAULT_DEPTH_FRAME_LEVELS.findIndex((level) => level >= depth);
  const nextIndex = currentIndex >= 0 ? cycleIndex(currentIndex, DEFAULT_DEPTH_FRAME_LEVELS.length) : 0;

  return DEFAULT_DEPTH_FRAME_LEVELS[nextIndex];
}

function getMeasurementDepthFraction(y: number) {
  return clamp((y - MEASUREMENT_SECTOR.apexY) / (MEASUREMENT_SECTOR.baseY - MEASUREMENT_SECTOR.apexY), 0.04, 1);
}

function clampMeasurementPoint(point: KnobologyMeasurementPoint): KnobologyMeasurementPoint {
  return {
    x: clamp(point.x, MEASUREMENT_CURSOR_BOUNDS.minX, MEASUREMENT_CURSOR_BOUNDS.maxX),
    y: clamp(point.y, MEASUREMENT_CURSOR_BOUNDS.minY, MEASUREMENT_CURSOR_BOUNDS.maxY),
  };
}

function createDefaultMeasurementPoint() {
  return clampMeasurementPoint(MEASUREMENT_DEFAULT_POINT);
}

function moveMeasurementPoint(point: KnobologyMeasurementPoint, deltaX: number, deltaY: number): KnobologyMeasurementPoint {
  return clampMeasurementPoint({
    x: point.x + deltaX * MEASUREMENT_TRACKBALL_SENSITIVITY,
    y: point.y + deltaY * MEASUREMENT_TRACKBALL_SENSITIVITY,
  });
}

function resetMeasurementState(): Pick<
  KnobologyFrameState,
  'calipers' | 'measurementMode' | 'measurementPoints' | 'measurementStart' | 'measurementEnd' | 'activeMeasurementMarker'
> {
  return {
    calipers: false,
    measurementMode: 'off',
    measurementPoints: 0,
    measurementStart: null,
    measurementEnd: null,
    activeMeasurementMarker: null,
  };
}

function getHarmonicModeForContrast(contrast: number): KnobologyHarmonicMode {
  if (contrast < getKnobologyVideoValueForIndex(3)) {
    return 'off';
  }

  if (contrast < getKnobologyVideoValueForIndex(6)) {
    return 'p';
  }

  return 'r';
}

function withAction(
  state: KnobologyFrameState,
  actionId: KnobologyProcessorActionId,
  patch: Partial<KnobologyFrameState>,
): KnobologyFrameState {
  return {
    ...state,
    ...patch,
    lastActionId: actionId,
  };
}

export function createKnobologyFrameState(exercise: KnobologyCorrectionExercise): KnobologyFrameState {
  return {
    ...exercise.start,
    colorDoppler: false,
    calipers: false,
    frozen: false,
    saved: false,
    pipEnabled: false,
    mode: 'b',
    measurementMode: 'off',
    measurementPoints: 0,
    measurementStart: null,
    measurementEnd: null,
    activeMeasurementMarker: null,
    commentCount: 0,
    irMode: false,
    scrollMode: false,
    cineReviewMode: false,
    cineFrame: 0,
    cinePlaying: false,
    menu: 'none',
    enhanceEnabled: false,
    harmonicMode: 'off',
    acousticPower: 50,
    frequencyIndex: 1,
    focusIndex: 1,
    observationPreset: null,
    lastActionId: null,
    statusMessage: 'Ready',
  };
}

function applyProcessorAction(
  state: KnobologyFrameState,
  actionId: KnobologyProcessorActionId,
): KnobologyFrameState {
  switch (actionId) {
    case 'SAVE_REC':
      return withAction(state, actionId, {
        saved: true,
        statusMessage: 'Saved still frame.',
      });
    case 'RELEASE':
      return withAction(state, actionId, {
        menu: 'none',
        statusMessage: 'Release acknowledged.',
      });
    case 'TOGGLE_PIP':
      return withAction(state, actionId, {
        pipEnabled: !state.pipEnabled,
        statusMessage: state.pipEnabled ? 'PIP closed.' : 'PIP opened.',
      });
    case 'PW_MODE':
      return withAction(state, actionId, {
        mode: 'pw',
        colorDoppler: false,
        cinePlaying: false,
        statusMessage: 'PW mode active.',
      });
    case 'FLOW_MODE':
      return withAction(state, actionId, {
        mode: 'flow',
        colorDoppler: true,
        statusMessage: 'Flow mode active.',
      });
    case 'B_MODE':
      return withAction(state, actionId, {
        mode: 'b',
        colorDoppler: false,
        statusMessage: 'B mode active.',
      });
    case 'CLEAR':
      return withAction(state, actionId, {
        ...resetMeasurementState(),
        commentCount: 0,
        statusMessage: 'Measurements and comments cleared.',
      });
    case 'TRACE_MODE':
      if (!state.frozen) {
        return withAction(state, actionId, {
          statusMessage: 'Freeze the image before using trace.',
        });
      }

      return withAction(state, actionId, {
        calipers: false,
        measurementMode: 'trace',
        measurementPoints: 0,
        measurementStart: null,
        measurementEnd: null,
        activeMeasurementMarker: null,
        statusMessage: 'Trace mode ready.',
      });
    case 'MEASURE_MODE':
      if (!state.frozen) {
        return withAction(state, actionId, {
          statusMessage: 'Freeze the image before measuring.',
        });
      }

      return withAction(state, actionId, {
        calipers: true,
        measurementMode: 'measure',
        measurementPoints: 1,
        measurementStart: createDefaultMeasurementPoint(),
        measurementEnd: null,
        activeMeasurementMarker: 0,
        statusMessage: 'Trackball moves the first caliper.',
      });
    case 'COMMENT_ADD':
      return withAction(state, actionId, {
        commentCount: Math.min(3, state.commentCount + 1),
        statusMessage: 'Comment marker added.',
      });
    case 'COMMENT_CLEAR':
      return withAction(state, actionId, {
        commentCount: 0,
        statusMessage: 'Comments cleared.',
      });
    case 'MEASURE_SET':
      if (!state.frozen || state.measurementMode !== 'measure' || !state.measurementStart) {
        return withAction(state, actionId, {
          statusMessage: 'Freeze and place a caliper before setting a measurement.',
        });
      }

      if (state.measurementPoints <= 1) {
        return withAction(state, actionId, {
          calipers: true,
          measurementMode: 'measure',
          measurementPoints: 2,
          measurementEnd: state.measurementStart,
          activeMeasurementMarker: 1,
          statusMessage: 'First caliper fixed. Move the second marker.',
        });
      }

      return withAction(state, actionId, {
        calipers: true,
        measurementMode: 'measure',
        measurementPoints: 2,
        statusMessage: 'Measurement updated.',
      });
    case 'IR_MODE':
      return withAction(state, actionId, {
        irMode: !state.irMode,
        statusMessage: state.irMode ? 'I.R. off.' : 'I.R. on.',
      });
    case 'SCROLL_MODE':
      return withAction(state, actionId, {
        scrollMode: !state.scrollMode,
        statusMessage: state.scrollMode ? 'Trackball scroll off.' : 'Trackball scroll on.',
      });
    case 'CINE_REVIEW_MODE':
      return withAction(state, actionId, {
        cineReviewMode: !state.cineReviewMode,
        cinePlaying: false,
        frozen: true,
        statusMessage: state.cineReviewMode ? 'Cine review off.' : 'Cine review on.',
      });
    case 'POWER_DOWN':
      return withAction(state, actionId, {
        acousticPower: clamp(state.acousticPower - 10, 0, 100),
        statusMessage: 'Acoustic output reduced.',
      });
    case 'POWER_UP':
      return withAction(state, actionId, {
        acousticPower: clamp(state.acousticPower + 10, 0, 100),
        statusMessage: 'Acoustic output increased.',
      });
    case 'GAIN_DOWN':
      return withAction(state, actionId, {
        gain: stepKnobologyVideoValue(state.gain, -1),
        statusMessage: 'Gain decreased.',
      });
    case 'GAIN_UP':
      return withAction(state, actionId, {
        gain: stepKnobologyVideoValue(state.gain, 1),
        statusMessage: 'Gain increased.',
      });
    case 'DEPTH_UP':
      return withAction(state, actionId, {
        depth: cycleDepth(state.depth),
        statusMessage: 'Depth advanced.',
      });
    case 'FOCUS_CYCLE':
      return withAction(state, actionId, {
        focusIndex: cycleIndex(state.focusIndex, FOCUS_MARKER_LEVELS.length),
        statusMessage: 'Focus target cycled.',
      });
    case 'CINE_STEP_BACK':
      return withAction(state, actionId, {
        cineReviewMode: true,
        cinePlaying: false,
        frozen: true,
        cineFrame: cycleIndex(state.cineFrame, CINE_FRAME_COUNT, -1),
        statusMessage: 'Cine stepped backward.',
      });
    case 'CINE_PLAY_PAUSE':
      return withAction(state, actionId, {
        cineReviewMode: true,
        frozen: true,
        cinePlaying: !state.cinePlaying,
        statusMessage: state.cinePlaying ? 'Cine paused.' : 'Cine playing.',
      });
    case 'CINE_STEP_FORWARD':
      return withAction(state, actionId, {
        cineReviewMode: true,
        cinePlaying: state.cinePlaying,
        frozen: true,
        cineFrame: cycleIndex(state.cineFrame, CINE_FRAME_COUNT, 1),
        statusMessage: 'Cine stepped forward.',
      });
    case 'TOGGLE_FREEZE':
      if (state.frozen) {
        return withAction(state, actionId, {
          frozen: false,
          cinePlaying: false,
          cineReviewMode: false,
          scrollMode: false,
          ...resetMeasurementState(),
          statusMessage: 'Live imaging resumed.',
        });
      }

      return withAction(state, actionId, {
        frozen: true,
        cinePlaying: false,
        cineReviewMode: false,
        statusMessage: 'Image frozen.',
      });
    case 'CURSOR_MODE':
      if (!state.frozen || state.measurementMode !== 'measure') {
        return withAction(state, actionId, {
          statusMessage: 'Freeze and enable calipers before selecting a cursor.',
        });
      }

      if (state.measurementPoints <= 1) {
        return withAction(state, actionId, {
          activeMeasurementMarker: 0,
          statusMessage: 'First caliper active.',
        });
      }

      return withAction(state, actionId, {
        activeMeasurementMarker: state.activeMeasurementMarker === 1 ? 0 : 1,
        statusMessage: state.activeMeasurementMarker === 1 ? 'First caliper active.' : 'Second caliper active.',
      });
    case 'OPEN_MAIN_MENU':
      return withAction(state, actionId, {
        menu: state.menu === 'main' ? 'none' : 'main',
        statusMessage: state.menu === 'main' ? 'Main menu closed.' : 'Main menu opened.',
      });
    case 'OPEN_IMAGE_ADJUST':
      return withAction(state, actionId, {
        menu: state.menu === 'image-adjust' ? 'none' : 'image-adjust',
        statusMessage: state.menu === 'image-adjust' ? 'Image adjust closed.' : 'Image adjust opened.',
      });
    case 'TOGGLE_ENHANCE':
      return withAction(state, actionId, {
        enhanceEnabled: !state.enhanceEnabled,
        statusMessage: state.enhanceEnabled ? 'Image enhance off.' : 'Image enhance on.',
      });
    case 'THE_OFF':
      if (state.menu === 'image-adjust') {
        const contrast = stepKnobologyVideoValue(state.contrast, -1);

        return withAction(state, actionId, {
          contrast,
          harmonicMode: getHarmonicModeForContrast(contrast),
          statusMessage: 'Contrast decreased.',
        });
      }

      return withAction(state, actionId, {
        harmonicMode: 'off',
        contrast: CONTRAST_PRESETS.off,
        statusMessage: 'Contrast set low.',
      });
    case 'THE_P':
      if (state.menu === 'image-adjust') {
        return withAction(state, actionId, {
          contrast: CONTRAST_PRESETS.p,
          harmonicMode: 'p',
          statusMessage: 'Contrast balanced.',
        });
      }

      return withAction(state, actionId, {
        harmonicMode: 'p',
        contrast: CONTRAST_PRESETS.p,
        statusMessage: 'Contrast set mid.',
      });
    case 'THE_R':
      if (state.menu === 'image-adjust') {
        const contrast = stepKnobologyVideoValue(state.contrast, 1);

        return withAction(state, actionId, {
          contrast,
          harmonicMode: getHarmonicModeForContrast(contrast),
          statusMessage: 'Contrast increased.',
        });
      }

      return withAction(state, actionId, {
        harmonicMode: 'r',
        contrast: CONTRAST_PRESETS.r,
        statusMessage: 'Contrast set high.',
      });
    case 'FREQUENCY_DOWN':
      return withAction(state, actionId, {
        frequencyIndex: clamp(state.frequencyIndex - 1, 0, FREQUENCY_LABELS.length - 1),
        statusMessage: 'Frequency decreased.',
      });
    case 'FREQUENCY_UP':
      return withAction(state, actionId, {
        frequencyIndex: clamp(state.frequencyIndex + 1, 0, FREQUENCY_LABELS.length - 1),
        statusMessage: 'Frequency increased.',
      });
    case 'FOCUS_DOWN':
      return withAction(state, actionId, {
        focusIndex: clamp(state.focusIndex - 1, 0, FOCUS_MARKER_LEVELS.length - 1),
        statusMessage: 'Focus moved shallower.',
      });
    case 'FOCUS_UP':
      return withAction(state, actionId, {
        focusIndex: clamp(state.focusIndex + 1, 0, FOCUS_MARKER_LEVELS.length - 1),
        statusMessage: 'Focus moved deeper.',
      });
    case 'OBS_GI':
      return withAction(state, actionId, {
        observationPreset: 'GI',
        statusMessage: 'Observation preset GI.',
      });
    case 'OBS_PB':
      return withAction(state, actionId, {
        observationPreset: 'PB',
        statusMessage: 'Observation preset PB.',
      });
    case 'OBS_RSP':
      return withAction(state, actionId, {
        observationPreset: 'RSP',
        statusMessage: 'Observation preset RSP.',
      });
    default:
      return withAction(state, actionId, {
        statusMessage: `${actionId.replace(/_/g, ' ')} not linked yet.`,
      });
  }
}

export function reduceKnobologyFrameState(
  state: KnobologyFrameState,
  action: KnobologySimulatorAction,
): KnobologyFrameState {
  switch (action.type) {
    case 'RESET_FOR_EXERCISE':
      return createKnobologyFrameState(action.exercise);
    case 'SET_NUMERIC_FIELD':
      return {
        ...state,
        [action.field]: clamp(action.value, 0, 100),
        lastActionId: null,
      };
    case 'SET_COLOR_DOPPLER':
      return {
        ...state,
        colorDoppler: action.enabled,
        mode: action.enabled ? 'flow' : state.mode === 'flow' ? 'b' : state.mode,
        lastActionId: null,
      };
    case 'MOVE_TRACKBALL': {
      if (!state.frozen || state.measurementMode !== 'measure' || !state.measurementStart) {
        return state;
      }

      if (state.activeMeasurementMarker === 1 && state.measurementPoints > 1 && state.measurementEnd) {
        return {
          ...state,
          measurementEnd: moveMeasurementPoint(state.measurementEnd, action.deltaX, action.deltaY),
          lastActionId: null,
        };
      }

      return {
        ...state,
        measurementStart: moveMeasurementPoint(state.measurementStart, action.deltaX, action.deltaY),
        lastActionId: null,
      };
    }
    case 'PROCESSOR_ACTION':
      return applyProcessorAction(state, action.actionId);
    default:
      return state;
  }
}

export function getMeasurementDistanceMmForDepthCm(
  depthCm: number,
  measurementStart: KnobologyMeasurementPoint | null,
  measurementEnd: KnobologyMeasurementPoint | null,
) {
  if (!measurementStart || !measurementEnd) {
    return null;
  }

  const averageY = (measurementStart.y + measurementEnd.y) / 2;
  const depthFraction = getMeasurementDepthFraction(averageY);
  const totalDepthMm = depthCm * 10;
  const averageDepthMm = totalDepthMm * depthFraction;
  const sectorWidthAtDepth = Math.max(0.04, MEASUREMENT_SECTOR.baseWidth * depthFraction);
  const sectorWidthMm =
    2 * averageDepthMm * Math.tan((MEASUREMENT_SECTOR.sectorAngleDegrees * Math.PI) / 360);
  const horizontalMm = (Math.abs(measurementEnd.x - measurementStart.x) / sectorWidthAtDepth) * sectorWidthMm;
  const verticalMm =
    (Math.abs(measurementEnd.y - measurementStart.y) / (MEASUREMENT_SECTOR.baseY - MEASUREMENT_SECTOR.apexY)) *
    totalDepthMm;

  return Math.sqrt(horizontalMm ** 2 + verticalMm ** 2);
}

export function getMeasurementDistanceMm(state: Pick<KnobologyFrameState, 'depth' | 'measurementStart' | 'measurementEnd'>) {
  return getMeasurementDistanceMmForDepthCm(
    getKnobologyVideoDepthCm(state.depth),
    state.measurementStart,
    state.measurementEnd,
  );
}

export function getDepthFrameIndex(
  depth: number,
  frameCount: number = DEFAULT_DEPTH_FRAME_LEVELS.length,
): number {
  if (frameCount <= 1) {
    return 0;
  }

  const clampedDepth = Math.max(0, Math.min(100, depth));
  const frameLevels =
    frameCount === DEFAULT_DEPTH_FRAME_LEVELS.length
      ? [...DEFAULT_DEPTH_FRAME_LEVELS]
      : Array.from({ length: frameCount }, (_, index) => Math.round(((index + 1) / frameCount) * 100));

  return frameLevels.reduce((closestIndex, level, index) => {
    const closestDelta = Math.abs(frameLevels[closestIndex] - clampedDepth);
    const currentDelta = Math.abs(level - clampedDepth);

    return currentDelta < closestDelta ? index : closestIndex;
  }, 0);
}

export function buildFrameMetrics(state: KnobologyFrameState): KnobologyFrameMetrics {
  const harmonicBoost = state.harmonicMode === 'off' ? 0 : state.harmonicMode === 'p' ? 0.08 : 0.12;

  return {
    brightness: 0.16 + state.gain / 135,
    hazeOpacity: 0.08 + (100 - state.contrast) / 200 - (state.enhanceEnabled ? 0.03 : 0),
    nodeSize: 26 + (100 - state.depth) * 0.52,
    nodeY: 16 + state.depth * 0.58,
    borderOpacity: Math.min(0.82, 0.18 + state.contrast / 140 + harmonicBoost / 2),
    colorSignalOpacity: state.colorDoppler ? 0.78 : 0,
    realFrameBrightness: 0.48 + state.gain / 82 + (state.acousticPower - 50) / 240,
    realFrameContrast: 0.64 + state.contrast / 92 + (state.enhanceEnabled ? 0.14 : 0) + harmonicBoost,
    pipOpacity: state.pipEnabled ? 1 : 0,
    waveformOpacity: state.mode === 'pw' ? 0.88 : 0,
    focusMarkerY: FOCUS_MARKER_LEVELS[state.focusIndex],
    imageShiftX: (state.cineFrame - Math.floor(CINE_FRAME_COUNT / 2)) * 2.4,
    imageScale: 1 + state.frequencyIndex * 0.018,
  };
}

export function evaluateExercise(
  exercise: KnobologyCorrectionExercise,
  state: KnobologyFrameState,
): ExerciseEvaluation {
  const deltas = {
    depth: Math.abs(state.depth - exercise.target.depth),
    gain: Math.abs(state.gain - exercise.target.gain),
    contrast: Math.abs(state.contrast - exercise.target.contrast),
  };
  const totalDelta = deltas.depth + deltas.gain + deltas.contrast;
  const solved = totalDelta <= 24 && deltas[exercise.focusControl] <= 8;
  const score = Math.max(0, Math.round(100 - totalDelta * 1.25));

  if (solved) {
    return {
      score,
      solved: true,
      feedback: exercise.successMessage,
    };
  }

  if (exercise.focusControl === 'depth') {
    return {
      score,
      solved: false,
      feedback:
        state.depth < exercise.target.depth
          ? 'Increase depth until the target settles closer to the middle of the frame.'
          : 'Trim depth slightly so the node is not buried in unused space.',
    };
  }

  if (exercise.focusControl === 'gain') {
    return {
      score,
      solved: false,
      feedback:
        state.gain < exercise.target.gain
          ? 'The frame is still too dark. Raise gain until the border becomes readable.'
          : 'Back gain down a little. The image is starting to look washed out.',
    };
  }

  return {
    score,
    solved: false,
    feedback:
      state.contrast < exercise.target.contrast
        ? 'Increase contrast to recover edge definition.'
        : 'The frame has enough contrast. Fine-tune gain so the border stays clean.',
  };
}
