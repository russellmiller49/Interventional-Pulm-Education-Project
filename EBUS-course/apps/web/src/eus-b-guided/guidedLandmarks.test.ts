import { describe, expect, it } from 'vitest';

import { DEFAULT_EUS_CONTROLS, sectorGeometry } from '@/features/eus-b-simulator/eusAcoustic';
import {
  EUSB_BRIDGE_VERSION,
  isEusbMessage,
  isEusbObservation,
} from '../../../../../src/lib/eus-b-guided-bridge';
import {
  EUSB_LAB_IDS,
  eusbLab,
  type EusbLabId,
} from '../../../../../src/lib/eus-b-guided-contract';
import { frameAt, labelId, manifest, path, volume } from './caseFixture';
import {
  IDENTIFY_START,
  identifyAsked,
  identifyDone,
  identifyReducer,
  identifyReport,
  type IdentifyState,
} from './guidedIdentify';
import {
  clickedLandmark,
  clickHits,
  clickTolerancePx,
  labelUnder,
  landmarkPoint,
  pointFraction,
  reachedLabelIds,
} from './guidedLandmarks';
import { buildObservation, type GuidedFrameTag } from './guidedObservation';
import { labReviewPose } from './guidedViews';
import {
  blockingLabelIds,
  labelFrameAt,
  reachMask,
  visibleAreaMm2,
  type LabelFrame,
} from './visibleArea';

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
  BONE = 4,
  BLOCKING = [0, BONE];
const at = (frame: LabelFrame, x: number, y: number) => frame.labelImage[y * frame.width + x];

describe('what the beam reaches, pixel by pixel', () => {
  it('counts the same pixels as the area measure', () => {
    const frame = synthetic((depth, across) =>
      depth > 0.2 && depth < 0.3 && across < 0.5 ? BONE : depth > 0.5 && depth < 0.8 ? TARGET : 0,
    );
    const mask = reachMask(frame, BLOCKING);
    let count = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i] && frame.labelImage[i] === TARGET) count++;
    const { radius } = sectorGeometry(frame.width, frame.height, frame.controls.sectorAngleDeg);
    expect(count * (frame.controls.depthMm / radius) ** 2).toBeCloseTo(
      visibleAreaMm2(frame, TARGET, BLOCKING),
      6,
    );
  });

  it('is empty outside the sector', () => {
    const frame = synthetic(() => 0);
    const mask = reachMask(frame, BLOCKING);
    for (let i = 0; i < mask.length; i++) if (frame.labelImage[i] === 0) expect(mask[i]).toBe(0);
    expect(mask[0]).toBe(0);
  });
});

describe('the point a landmark is numbered at', () => {
  it('lies on the structure, near its middle', () => {
    const frame = synthetic((depth, across) =>
      depth > 0.4 && depth < 0.7 && across > 0.3 && across < 0.7 ? TARGET : 0,
    );
    const mask = reachMask(frame, BLOCKING);
    const point = landmarkPoint(frame, mask, TARGET)!;
    expect(at(frame, point.x, point.y)).toBe(TARGET);
    expect(mask[point.y * frame.width + point.x]).toBe(1);
    // The patch is centered on the image's middle line.
    expect(Math.abs(point.x - (frame.width - 1) / 2)).toBeLessThanOrEqual(1);
  });

  it('lies on the structure even when its middle is a hole', () => {
    // A ring across the sector: the middle of its pixels lies in the gap between two arms.
    const frame = synthetic((depth, across) =>
      depth > 0.5 && depth < 0.7 && (across < 0.25 || across > 0.75) ? TARGET : 0,
    );
    const mask = reachMask(frame, BLOCKING);
    const point = landmarkPoint(frame, mask, TARGET)!;
    expect(at(frame, point.x, point.y)).toBe(TARGET);
  });

  it('stays on the part the beam reaches when the rest is in shadow', () => {
    const frame = synthetic((depth, across) =>
      depth > 0.2 && depth < 0.3 && across < 0.5 ? BONE : depth > 0.5 && depth < 0.8 ? TARGET : 0,
    );
    const mask = reachMask(frame, BLOCKING);
    const point = landmarkPoint(frame, mask, TARGET)!;
    expect(at(frame, point.x, point.y)).toBe(TARGET);
    expect(mask[point.y * frame.width + point.x]).toBe(1);
    // The clear half is the right half of the image.
    expect(point.x).toBeGreaterThan((frame.width - 1) / 2);
  });

  it('is nowhere when the beam reaches none of the structure, or it is not in the image', () => {
    const shadowed = synthetic((depth) =>
      depth > 0.2 && depth < 0.3 ? AIR : depth > 0.5 && depth < 0.8 ? TARGET : 0,
    );
    expect(landmarkPoint(shadowed, reachMask(shadowed, BLOCKING), TARGET)).toBeNull();
    const empty = synthetic(() => 0);
    expect(landmarkPoint(empty, reachMask(empty, BLOCKING), TARGET)).toBeNull();
  });

  it('is given to the page as fractions of the image, at the middle of its pixel', () => {
    const frame = synthetic(() => 0);
    expect(pointFraction(frame, { x: 0, y: 95 })).toEqual({ x: 0.5 / 96, y: 95.5 / 96 });
  });
});

describe('a click on the image', () => {
  const frame = synthetic((depth, across) =>
    depth > 0.2 && depth < 0.3 && across < 0.5
      ? BONE
      : depth > 0.5 && depth < 0.8
        ? TARGET
        : depth > 0.85
          ? 12
          : 0,
  );
  const mask = reachMask(frame, BLOCKING);
  const point = landmarkPoint(frame, mask, TARGET)!;

  it('lands on the structure under it', () => {
    expect(clickHits(frame, mask, TARGET, point, 2)).toBe(true);
    expect(labelUnder(frame, mask, point)).toBe(TARGET);
    expect(clickHits(frame, mask, 12, point, 2)).toBe(false);
  });

  it('counts within a small distance of the structure, and not further off', () => {
    // Walk up from the landmark point until the structure ends.
    let y = point.y;
    while (at(frame, point.x, y) === TARGET) y--;
    expect(clickHits(frame, mask, TARGET, { x: point.x, y: y - 1 }, 2)).toBe(true);
    expect(clickHits(frame, mask, TARGET, { x: point.x, y: y - 6 }, 2)).toBe(false);
  });

  it('does not count on a part of the structure the image does not show', () => {
    // The left half lies behind bone.
    const hidden = { x: Math.round(frame.width * 0.36), y: point.y };
    expect(at(frame, hidden.x, hidden.y)).toBe(TARGET);
    expect(mask[hidden.y * frame.width + hidden.x]).toBe(0);
    expect(clickHits(frame, mask, TARGET, hidden, 1)).toBe(false);
    expect(labelUnder(frame, mask, hidden)).toBeNull();
  });

  it('lists among the reached labels only those with a pixel the beam reaches', () => {
    const behind = synthetic((depth, across) =>
      depth > 0.2 && depth < 0.3 ? BONE : depth > 0.5 && across < 0.4 ? TARGET : 0,
    );
    const shadow = reachMask(behind, BLOCKING);
    expect(behind.labelImage.includes(TARGET)).toBe(true);
    expect(reachedLabelIds(behind, shadow).has(TARGET)).toBe(false);
    expect(reachedLabelIds(frame, mask).has(TARGET)).toBe(true);
  });

  it('lands on nothing outside the image', () => {
    expect(labelUnder(frame, mask, { x: -3, y: 4 })).toBeNull();
    expect(labelUnder(frame, mask, { x: 0, y: 0 })).toBeNull();
    expect(clickHits(frame, mask, TARGET, { x: 0, y: 0 }, 2)).toBe(false);
  });

  it('allows about one percent of the image width, and never less than two pixels', () => {
    expect(clickTolerancePx({ width: 512 })).toBe(5);
    expect(clickTolerancePx({ width: 96 })).toBe(2);
  });
});

const blocking = blockingLabelIds(volume);
const landmarkLabs = EUSB_LAB_IDS.filter((id) => (eusbLab(id).landmarks ?? []).length > 0);
const identifyLabs = EUSB_LAB_IDS.filter((id) => eusbLab(id).kind === 'identify');
/** Least area of a landmark the beam must reach in its lab's view, to be numbered and clicked. */
const LEAST_LANDMARK_MM2 = 20;

describe('the landmarks of every lab, on the shipped case', () => {
  it('has labs with landmarks, and mark-the-landmarks tasks among them', () => {
    expect(landmarkLabs.length).toBeGreaterThan(0);
    expect(identifyLabs.length).toBeGreaterThan(0);
    for (const labId of identifyLabs) {
      const lab = eusbLab(labId);
      expect(lab.landmarks?.length, labId).toBeGreaterThan(0);
      // A still image: nothing to drive.
      expect(lab.controls, labId).toEqual([]);
    }
  });

  it.each(landmarkLabs)('%s: every landmark is in its view, reached and numbered', (labId) => {
    const lab = eusbLab(labId);
    const pose = labReviewPose(manifest, path, lab)!;
    expect(pose).not.toBeNull();
    const landmarks = lab.landmarks!;
    expect(new Set(landmarks).size).toBe(landmarks.length);
    // Measured on the small reference frame and placed on a frame of the size the lab draws.
    const small = labelFrameAt(volume, path, manifest, pose);
    const drawn = frameAt(pose, 384);
    const mask = reachMask(drawn, blocking);
    for (const key of landmarks) {
      const label = volume.metadata.labels.find((entry) => entry.key === key);
      expect(label, `${labId} ${key}`).toBeDefined();
      expect(label!.reportable, `${labId} ${key}`).toBe(true);
      expect(manifest.structures.some((entry) => entry.key === key), `${labId} ${key}`).toBe(true);
      expect(visibleAreaMm2(small, label!.id, blocking), `${labId} ${key}`).toBeGreaterThanOrEqual(
        LEAST_LANDMARK_MM2,
      );
      const point = landmarkPoint(drawn, mask, label!.id);
      expect(point, `${labId} ${key}`).not.toBeNull();
      expect(drawn.labelImage[point!.y * drawn.width + point!.x]).toBe(label!.id);
      expect(labelUnder(drawn, mask, point!)).toBe(label!.id);
      const fraction = pointFraction(drawn, point!);
      for (const value of [fraction.x, fraction.y]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(1);
      }
    }
    // A lab that asks for a target lists it among its landmarks, last.
    if (lab.target) expect(landmarks[landmarks.length - 1]).toBe(lab.target);
  });
});

describe('every mark-the-landmarks task, on the shipped case', () => {
  /** What the lab resolves a click to, as the workbench does. */
  function clickedKey(
    frame: LabelFrame,
    mask: Uint8Array,
    asked: string,
    point: { x: number; y: number },
    together: readonly string[] = [],
  ) {
    return clickedLandmark(
      frame,
      mask,
      { key: asked, labelIds: [asked, ...together].map(labelId) },
      point,
      clickTolerancePx(frame),
      volume.metadata.labels,
    );
  }

  it.each(identifyLabs)('%s asks for the first landmarks of its view, so each keeps its number', (labId) => {
    const lab = eusbLab(labId);
    const view = eusbLab(labId.replace(/-landmarks$/, '-view') as EusbLabId);
    expect(view.kind, labId).toBe('explore');
    expect(view.start).toEqual(lab.start);
    expect(lab.landmarks).toEqual(view.landmarks!.slice(0, lab.landmarks!.length));
    // A structure asked for together with a landmark is one of the view's landmarks too.
    for (const [key, together] of Object.entries(lab.together ?? {})) {
      expect(lab.landmarks).toContain(key);
      for (const other of together.with) expect(view.landmarks).toContain(other);
    }
  });

  it('does not ask for a node drawn at the transducer: stations 8, 9 and 2L', () => {
    expect(eusbLab('station-8-landmarks').landmarks).not.toContain('station_8');
    expect(eusbLab('station-9-landmarks').landmarks).not.toContain('station_9');
    expect(eusbLab('station-2l-landmarks').landmarks).not.toContain('station_2l');
    // The labeled image still numbers the node.
    expect(eusbLab('station-8-view').landmarks).toContain('station_8');
    expect(eusbLab('station-9-view').landmarks).toContain('station_9');
    expect(eusbLab('station-2l-view').landmarks).toContain('station_2l');
  });

  it('counts a click on the inferior vena cava for the right atrium at station 8', () => {
    const lab = eusbLab('station-8-landmarks');
    const together = lab.together!.right_atrium.with;
    expect(together).toEqual(['inferior_vena_cava']);
    const frame = frameAt(labReviewPose(manifest, path, lab)!, 384);
    const mask = reachMask(frame, blocking);
    const cava = landmarkPoint(frame, mask, labelId('inferior_vena_cava'))!;
    expect(clickedKey(frame, mask, 'right_atrium', cava)).toBe('inferior_vena_cava');
    expect(clickedKey(frame, mask, 'right_atrium', cava, together)).toBe('right_atrium');
    const atrium = landmarkPoint(frame, mask, labelId('right_atrium'))!;
    expect(clickedKey(frame, mask, 'right_atrium', atrium, together)).toBe('right_atrium');
    // The left atrium is still a miss.
    const left = landmarkPoint(frame, mask, labelId('left_atrium'))!;
    expect(clickedKey(frame, mask, 'right_atrium', left, together)).not.toBe('right_atrium');
  });

  it.each(identifyLabs)('%s can be finished by clicking each landmark, and reports as the bridge expects', (labId: EusbLabId) => {
    const lab = eusbLab(labId);
    const landmarks = lab.landmarks!;
    const withOf = (key: string) => lab.together?.[key]?.with ?? [];
    const labKey = `session|${labId}`;
    const pose = labReviewPose(manifest, path, lab)!;
    const frame = frameAt(pose, 384);
    const mask = reachMask(frame, blocking);
    const tag: GuidedFrameTag = {
      labKey,
      phase: 'work',
      scope: pose,
      depthMm: manifest.probe.defaultDepthMm,
      gainDb: 0,
    };
    const report = (state: IdentifyState) => {
      const observation = buildObservation({
        labId,
        labKey,
        manifest,
        volume,
        scope: pose,
        depthMm: manifest.probe.defaultDepthMm,
        gainDb: 0,
        frame,
        frameTag: tag,
        usedControls: [],
        actionCount: 0,
        lastAction: '',
        target: null,
        identified: identifyReport(state),
        now: 1000,
      });
      expect(isEusbObservation(observation), labId).toBe(true);
      expect(
        isEusbMessage({
          version: EUSB_BRIDGE_VERSION,
          type: 'observation',
          sessionId: 'session-1',
          observationRequest: 2,
          observation,
        }),
      ).toBe(true);
      expect(observation.panes).toEqual(['ultrasound']);
      expect(observation.target).toBeUndefined();
      return observation;
    };

    // At the start.
    let state = IDENTIFY_START;
    expect(report(state).identified).toEqual({ keys: [], shown: [], wrong: 0 });

    // A miss: a click outside the sector lands on nothing.
    state = identifyReducer(
      state,
      { type: 'click', key: clickedKey(frame, mask, landmarks[0], { x: 0, y: 0 }) },
      landmarks,
    );
    expect(report(state).identified).toEqual({ keys: [], shown: [], wrong: 1 });
    // A click on another landmark of the view is a miss too.
    if (landmarks.length > 1) {
      const other = landmarkPoint(frame, mask, labelId(landmarks[1]))!;
      const key = clickedKey(frame, mask, landmarks[0], other, withOf(landmarks[0]));
      expect(key, labId).not.toBe(landmarks[0]);
      state = identifyReducer(state, { type: 'click', key }, landmarks);
      expect(state.keys).toEqual([]);
      expect(state.wrong).toBe(2);
    }

    // Each landmark's own point marks it.
    const misses = state.wrong;
    for (const key of landmarks) {
      expect(identifyAsked(state, landmarks)).toBe(key);
      const point = landmarkPoint(frame, mask, labelId(key))!;
      state = identifyReducer(
        state,
        {
          type: 'click',
          key: clickedKey(frame, mask, key, point, withOf(key)),
          at: pointFraction(frame, point),
        },
        landmarks,
      );
      expect(state.keys[state.keys.length - 1], `${labId} ${key}`).toBe(key);
      report(state);
    }
    expect(identifyDone(state, landmarks)).toBe(true);
    expect(report(state).identified).toEqual({ keys: [...landmarks], shown: [], wrong: misses });

    // Shown instead: listed as shown, and the task is done all the same.
    let shown = identifyReducer(IDENTIFY_START, { type: 'show' }, landmarks);
    expect(report(shown).identified).toEqual({ keys: [], shown: [landmarks[0]], wrong: 0 });
    for (let index = 1; index < landmarks.length; index += 1)
      shown = identifyReducer(shown, { type: 'show' }, landmarks);
    expect(identifyDone(shown, landmarks)).toBe(true);
    expect(report(shown).identified).toEqual({ keys: [], shown: [...landmarks], wrong: 0 });
  });
});

describe('names on a labeled image', () => {
  it('leave out what lies inside the sector but behind lung: the station 9 still', () => {
    const lab = eusbLab('station-9-view');
    const frame = frameAt(labReviewPose(manifest, path, lab)!, 384);
    const reached = reachedLabelIds(frame, reachMask(frame, blocking));
    const inSector = new Set(frame.structures.map((entry) => entry.id));
    for (const key of ['station_11ri', 'pulmonary_artery']) {
      expect(inSector.has(labelId(key)), key).toBe(true);
      expect(reached.has(labelId(key)), key).toBe(false);
    }
    for (const key of lab.landmarks!) expect(reached.has(labelId(key)), key).toBe(true);
  });
});
