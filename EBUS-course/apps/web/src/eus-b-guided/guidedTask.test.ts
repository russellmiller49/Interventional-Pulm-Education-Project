import { describe, expect, it } from 'vitest';

import { DEFAULT_EUS_CONTROLS, sectorGeometry } from '@/features/eus-b-simulator/eusAcoustic';
import { structureAreaMm2 } from '@/features/eus-b-simulator/findTarget';
import { applyScopeChange } from '@/features/eus-b-simulator/useEusScopeSession';
import type { EusbHeld } from '../../../../../src/lib/eus-b-guided-bridge';
import {
  EUSB_HOLD_AREA_FRACTION,
  EUSB_HOLD_MS,
} from '../../../../../src/lib/eus-b-guided-contract';
import { frameAt, labelId, manifest, path, volume } from './caseFixture';
import {
  REACH_START,
  reachHeldMs,
  reachReducer,
  reachTimeLeftMs,
  targetIsHeld,
  type ReachState,
} from './guidedTask';
import {
  blockingLabelIds,
  labelFrameAt,
  visibleAreaMm2,
  type LabelFrame,
} from './visibleArea';

const image = (sMm: number): EusbHeld => ({
  pose: { sMm, rollDeg: 0, flexDeg: 0 },
  depthMm: 50,
  gainDb: 0,
  frameId: `case:v:${sMm}:0:0:50:0`,
  source: 'learner',
});
const held = (state: ReachState, now: number, at = 100) =>
  reachReducer(state, { type: 'frame', areaRatio: 0.8, now, image: image(at) });
const lost = (state: ReachState, now: number) =>
  reachReducer(state, { type: 'frame', areaRatio: 0.1, now, image: image(0) });
const tick = (state: ReachState, now: number) => reachReducer(state, { type: 'tick', now });

describe('the hold task', () => {
  it('counts the target as held from the share the contract sets', () => {
    expect(targetIsHeld(EUSB_HOLD_AREA_FRACTION)).toBe(true);
    expect(targetIsHeld(EUSB_HOLD_AREA_FRACTION - 0.001)).toBe(false);
  });

  it('is done only after the target has been held for the whole time', () => {
    let state = held(REACH_START, 1000);
    expect(state.found).toBe(false);
    expect(reachTimeLeftMs(state, 1000)).toBe(EUSB_HOLD_MS);
    state = tick(state, 1000 + EUSB_HOLD_MS - 1);
    expect(state.found).toBe(false);
    expect(reachHeldMs(state, 1000 + EUSB_HOLD_MS - 1)).toBe(EUSB_HOLD_MS - 1);
    state = tick(state, 1000 + EUSB_HOLD_MS);
    expect(state.found).toBe(true);
    expect(state.foundAt).toEqual(image(100));
    expect(reachHeldMs(state, 0)).toBe(EUSB_HOLD_MS);
    expect(reachTimeLeftMs(state, 0)).toBeNull();
  });

  it('finishes on a frame too, when one arrives after the time is up', () => {
    const state = held(held(REACH_START, 0, 100), EUSB_HOLD_MS + 20, 101);
    expect(state.found).toBe(true);
    expect(state.foundAt).toEqual(image(101));
  });

  it('starts the time again when the target leaves the image', () => {
    let state = held(REACH_START, 0);
    state = lost(state, 500);
    expect(state.heldSince).toBeNull();
    expect(reachHeldMs(state, 600)).toBe(0);
    state = held(state, 600);
    expect(tick(state, EUSB_HOLD_MS + 100).found).toBe(false);
    expect(tick(state, EUSB_HOLD_MS + 600).found).toBe(true);
  });

  it('keeps the newest held image, not the first', () => {
    let state = held(REACH_START, 0, 100);
    state = held(state, 400, 104);
    state = tick(state, EUSB_HOLD_MS);
    expect(state.foundAt?.pose.sMm).toBe(104);
  });

  it('a timer with no hold running does nothing', () => {
    expect(tick(REACH_START, 99999)).toEqual(REACH_START);
    expect(tick(lost(held(REACH_START, 0), 10), 99999).found).toBe(false);
  });

  it('stays done whatever arrives afterwards', () => {
    const done = tick(held(REACH_START, 0, 100), EUSB_HOLD_MS);
    expect(lost(done, EUSB_HOLD_MS + 50)).toBe(done);
    expect(held(done, EUSB_HOLD_MS + 60, 300)).toBe(done);
    expect(tick(done, EUSB_HOLD_MS + 70)).toBe(done);
  });

  it('starts over on reset', () => {
    const done = tick(held(REACH_START, 0), EUSB_HOLD_MS);
    expect(reachReducer(done, { type: 'reset' })).toEqual(REACH_START);
  });

  it('treats a share that is not a number as nothing in view', () => {
    const state = reachReducer(REACH_START, {
      type: 'frame',
      areaRatio: Number.NaN,
      now: 0,
      image: image(0),
    });
    expect(state.heldSince).toBeNull();
    expect(state.areaRatio).toBe(0);
  });
});

describe('the area the beam reaches', () => {
  const blocking = blockingLabelIds(volume);

  it('reads the blocking tissues from the case: air in any lumen, and bone', () => {
    const keys = blocking.map((id) => volume.metadata.labels[id].key).sort();
    expect(keys).toEqual(['air', 'airway', 'bone', 'bowel_gas', 'gastric_gas']);
  });

  it('reads labels exactly as the renderer does', () => {
    for (const key of ['station_7', 'liver', 'left_adrenal']) {
      const landmark = manifest.landmarks.find((entry) => entry.key === key)!;
      const rendered = frameAt(landmark);
      const labels = labelFrameAt(volume, path, manifest, landmark);
      expect(Array.from(labels.labelImage)).toEqual(Array.from(rendered.labelImage));
    }
  });

  it('agrees with the whole-structure area at every landmark view of the case', () => {
    const differing: string[] = [];
    for (const landmark of manifest.landmarks) {
      const frame = frameAt(landmark);
      const id = labelId(landmark.key);
      const whole = structureAreaMm2(frame, id);
      const reached = visibleAreaMm2(frame, id, blocking);
      expect(whole, landmark.key).toBeGreaterThan(0);
      expect(reached, landmark.key).toBeLessThanOrEqual(whole + 1e-6);
      if (Math.abs(reached - whole) / whole > 0.1)
        differing.push(`${landmark.key}: reached ${reached.toFixed(1)} of ${whole.toFixed(1)} mm²`);
    }
    expect(manifest.landmarks).toHaveLength(19);
    expect(differing).toEqual([]);
  });

  /** A hand-made label image: `paint` gives the label at a depth share and an angle share. */
  function synthetic(paint: (depth: number, across: number) => number): LabelFrame {
    const width = 96,
      height = 96,
      controls = { ...DEFAULT_EUS_CONTROLS };
    const { halfAngle, radius, apexX, apexY } = sectorGeometry(
      width,
      height,
      controls.sectorAngleDeg,
    );
    const labelImage = new Uint8Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const px = x - apexX,
          py = y - apexY,
          distance = Math.hypot(px, py) / radius,
          angle = Math.atan2(px, py);
        if (py < 0 || distance > 1 || Math.abs(angle) > halfAngle) continue;
        labelImage[y * width + x] = paint(distance, (angle + halfAngle) / (2 * halfAngle)) || 1;
      }
    return { labelImage, width, height, controls };
  }
  const TARGET = 30,
    AIR = 255,
    BONE = 4;

  it('does not count a structure that lies behind air', () => {
    const open = synthetic((depth) => (depth > 0.5 && depth < 0.8 ? TARGET : 0));
    const shadowed = synthetic((depth) =>
      depth > 0.2 && depth < 0.3 ? AIR : depth > 0.5 && depth < 0.8 ? TARGET : 0,
    );
    const whole = visibleAreaMm2(open, TARGET, [0, BONE]);
    expect(whole).toBeGreaterThan(100);
    expect(visibleAreaMm2(shadowed, TARGET, [0, BONE])).toBe(0);
    // Without anything named as blocking, the same image counts in full.
    expect(visibleAreaMm2(shadowed, TARGET, [])).toBeCloseTo(whole, 6);
  });

  it('counts only the beams that are clear when bone covers half the sector', () => {
    const half = synthetic((depth, across) =>
      depth > 0.2 && depth < 0.3 && across < 0.5 ? BONE : depth > 0.5 && depth < 0.8 ? TARGET : 0,
    );
    const open = synthetic((depth) => (depth > 0.5 && depth < 0.8 ? TARGET : 0));
    const share = visibleAreaMm2(half, TARGET, [0, BONE]) / visibleAreaMm2(open, TARGET, [0, BONE]);
    expect(share).toBeGreaterThan(0.44);
    expect(share).toBeLessThan(0.52);
  });

  it('still counts a structure in front of air, and one beside it', () => {
    const front = synthetic((depth) =>
      depth > 0.2 && depth < 0.5 ? TARGET : depth > 0.6 ? AIR : 0,
    );
    const alone = synthetic((depth) => (depth > 0.2 && depth < 0.5 ? TARGET : 0));
    const whole = visibleAreaMm2(alone, TARGET, [0]);
    expect(visibleAreaMm2(front, TARGET, [0]) / whole).toBeGreaterThan(0.97);
  });
});

describe('a scope movement', () => {
  const at = { sMm: 100, rollDeg: 10, flexDeg: 5 };

  it('merges the change and leaves the rest', () => {
    expect(applyScopeChange(path, at, { sMm: 120 })).toEqual({ ...at, sMm: 120 });
    expect(applyScopeChange(path, at, (c) => ({ rollDeg: c.rollDeg + 5 }))).toEqual({
      ...at,
      rollDeg: 15,
    });
    expect(applyScopeChange(path, at, {})).toEqual(at);
  });

  it('keeps the scope on the path', () => {
    expect(applyScopeChange(path, at, { sMm: -20 }).sMm).toBe(0);
    expect(applyScopeChange(path, at, { sMm: 9999 }).sMm).toBe(path.totalLengthMm);
  });

  it('wraps the rotation and never shows -180 for what is 180', () => {
    expect(applyScopeChange(path, at, { rollDeg: 190 }).rollDeg).toBe(-170);
    expect(applyScopeChange(path, at, { rollDeg: -190 }).rollDeg).toBe(170);
    expect(applyScopeChange(path, at, { rollDeg: -180 }).rollDeg).toBe(180);
    expect(applyScopeChange(path, at, { rollDeg: 540 }).rollDeg).toBe(180);
  });

  it('keeps the tip angle within its range', () => {
    expect(applyScopeChange(path, at, { flexDeg: 80 }).flexDeg).toBe(45);
    expect(applyScopeChange(path, at, { flexDeg: -80 }).flexDeg).toBe(-45);
  });
});
