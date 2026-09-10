import { describe, expect, it } from 'vitest';

import {
  createKnobologyFrameState,
  getDepthFrameIndex,
  getMeasurementDistanceMmForDepthCm,
  reduceKnobologyFrameState,
} from '@/features/knobology/logic';

const exercise = {
  id: 'test',
  title: 'Test exercise',
  symptom: 'Too dark.',
  instructions: 'Raise gain.',
  focusControl: 'gain' as const,
  start: {
    depth: 40,
    gain: 20,
    contrast: 40,
  },
  target: {
    depth: 40,
    gain: 60,
    contrast: 40,
  },
  successMessage: 'Solved.',
};

describe('getDepthFrameIndex', () => {
  it('maps depth values to the nearest real EBUS depth frame', () => {
    expect(getDepthFrameIndex(0, 6)).toBe(0);
    expect(getDepthFrameIndex(28, 6)).toBe(0);
    expect(getDepthFrameIndex(40, 6)).toBe(1);
    expect(getDepthFrameIndex(60, 6)).toBe(2);
    expect(getDepthFrameIndex(68, 6)).toBe(3);
    expect(getDepthFrameIndex(100, 6)).toBe(5);
  });

  it('falls back safely when only one frame is available', () => {
    expect(getDepthFrameIndex(55, 1)).toBe(0);
  });
});

describe('reduceKnobologyFrameState', () => {
  it('uses step-based contrast changes on the image-adjust screen', () => {
    let state = createKnobologyFrameState(exercise);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'GAIN_UP' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'OPEN_IMAGE_ADJUST' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'THE_R' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'THE_R' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'THE_OFF' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'THE_P' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'TOGGLE_PIP' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'TOGGLE_FREEZE' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'CINE_REVIEW_MODE' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'CINE_STEP_FORWARD' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'MEASURE_MODE' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'MEASURE_SET' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'FLOW_MODE' });

    expect(state.gain).toBe(29);
    expect(state.contrast).toBe(43);
    expect(state.menu).toBe('image-adjust');
    expect(state.pipEnabled).toBe(true);
    expect(state.frozen).toBe(true);
    expect(state.cineReviewMode).toBe(true);
    expect(state.cineFrame).toBe(1);
    expect(state.calipers).toBe(true);
    expect(state.measurementPoints).toBe(2);
    expect(state.measurementStart).not.toBeNull();
    expect(state.measurementEnd).not.toBeNull();
    expect(state.activeMeasurementMarker).toBe(1);
    expect(state.mode).toBe('flow');
    expect(state.colorDoppler).toBe(true);
    expect(state.statusMessage).toBe('Flow mode active.');
  });

  it('keeps the preset contrast shortcuts outside image-adjust mode', () => {
    let state = createKnobologyFrameState(exercise);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'THE_R' });

    expect(state.contrast).toBe(100);
    expect(state.harmonicMode).toBe('r');
    expect(state.statusMessage).toBe('Contrast set high.');
  });

  it('requires freeze before live caliper measurement and clears it when live imaging resumes', () => {
    let state = createKnobologyFrameState(exercise);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'MEASURE_MODE' });
    expect(state.measurementPoints).toBe(0);
    expect(state.statusMessage).toBe('Freeze the image before measuring.');

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'TOGGLE_FREEZE' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'MEASURE_MODE' });
    state = reduceKnobologyFrameState(state, { type: 'MOVE_TRACKBALL', deltaX: -120, deltaY: -90 });

    expect(state.measurementPoints).toBe(1);
    expect(state.measurementStart?.x).not.toBe(0.49);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'MEASURE_SET' });
    state = reduceKnobologyFrameState(state, { type: 'MOVE_TRACKBALL', deltaX: 86, deltaY: 0 });

    expect(state.measurementPoints).toBe(2);
    expect(state.activeMeasurementMarker).toBe(1);
    expect(getMeasurementDistanceMmForDepthCm(4, state.measurementStart, state.measurementEnd)).toBeGreaterThan(0);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'CURSOR_MODE' });
    expect(state.activeMeasurementMarker).toBe(0);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'TOGGLE_FREEZE' });
    expect(state.frozen).toBe(false);
    expect(state.measurementPoints).toBe(0);
    expect(state.measurementStart).toBeNull();
    expect(state.measurementEnd).toBeNull();
  });

  it('lets frozen calipers travel across the ultrasound screen at shallow depths', () => {
    let state = createKnobologyFrameState(exercise);

    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'TOGGLE_FREEZE' });
    state = reduceKnobologyFrameState(state, { type: 'PROCESSOR_ACTION', actionId: 'MEASURE_MODE' });
    state = reduceKnobologyFrameState(state, { type: 'MOVE_TRACKBALL', deltaX: 500, deltaY: -300 });

    expect(state.measurementStart).not.toBeNull();
    expect(state.measurementStart?.y).toBeLessThan(0.1);
    expect(state.measurementStart?.x).toBeCloseTo(0.94);

    state = reduceKnobologyFrameState(state, { type: 'MOVE_TRACKBALL', deltaX: -1_000, deltaY: 0 });

    expect(state.measurementStart?.x).toBeCloseTo(0.045);
  });
});
