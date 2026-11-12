import { describe, expect, it } from 'vitest';

import {
  FLEX_MAX_DEG,
  FLEX_MIN_DEG,
  normalizeRollDeg,
  ROLL_MAX_DEG,
  ROLL_MIN_DEG,
} from '@/features/eus-b-simulator/eusPose';
import type { EusScopeState } from '@/features/eus-b-simulator/types';
import {
  EUSB_BRIDGE_VERSION,
  isEusbConfig,
  isEusbMessage,
  isEusbObservation,
} from '../../../../../src/lib/eus-b-guided-bridge';
import {
  EUSB_CONTRACT_REVISION,
  EUSB_HOLD_AREA_FRACTION,
  EUSB_HOLD_MS,
  EUSB_LAB_IDS,
  EUSB_POSE_LIMITS,
  eusbLab,
  type EusbLabId,
} from '../../../../../src/lib/eus-b-guided-contract';
import { frameAt, manifest, path, volume } from './caseFixture';
import { buildObservation, heldImage, type GuidedFrameTag } from './guidedObservation';
import { REACH_START, reachReducer } from './guidedTask';
import { labReviewPose, resolveStart, resolveTarget, viewPose } from './guidedViews';
import {
  blockingLabelIds,
  labelFrameAt,
  referenceVisibleAreaMm2,
  targetAreaRatio,
} from './visibleArea';

const blocking = blockingLabelIds(volume);
const reachLabs = EUSB_LAB_IDS.filter((id) => {
  const kind = eusbLab(id).kind;
  return kind === 'reach' || kind === 'rotate';
});

/** Share of the reference area the beam reaches at a scope position. */
const references = new Map<string, number>();
function ratioAt(labId: EusbLabId, scope: EusScopeState, size = 192) {
  const target = resolveTarget(manifest, volume, path, eusbLab(labId).target!)!;
  if (!references.has(target.key))
    references.set(
      target.key,
      referenceVisibleAreaMm2(volume, path, manifest, target.pose, target.labelId, blocking),
    );
  const reference = references.get(target.key)!;
  return targetAreaRatio(
    labelFrameAt(volume, path, manifest, scope, size),
    target.labelId,
    reference,
    blocking,
  );
}
const met = (labId: EusbLabId, scope: EusScopeState, size?: number) =>
  ratioAt(labId, scope, size) >= EUSB_HOLD_AREA_FRACTION;

/** How far the task stays met either side of a position, moving one control in unit steps. */
function band(
  labId: EusbLabId,
  from: EusScopeState,
  step: (scope: EusScopeState, by: number) => EusScopeState | null,
  limit: number,
) {
  const holds = (by: number) => {
    const scope = step(from, by);
    return scope !== null && met(labId, scope);
  };
  let low = 0,
    high = 0;
  while (low > -limit && holds(low - 1)) low--;
  while (high < limit && holds(high + 1)) high++;
  return { low, high, width: high - low };
}

describe('every lab of the course, on the shipped case', () => {
  it('lists at least one lab', () => {
    expect(EUSB_LAB_IDS.length).toBeGreaterThan(0);
  });

  it.each(EUSB_LAB_IDS)('%s starts at a position the scope can be in', (labId) => {
    const lab = eusbLab(labId);
    const start = resolveStart(manifest, path, lab.start);
    expect(start).not.toBeNull();
    expect(start!.sMm).toBeGreaterThanOrEqual(0);
    expect(start!.sMm).toBeLessThanOrEqual(path.totalLengthMm);
    expect(start!.sMm).toBeLessThanOrEqual(EUSB_POSE_LIMITS.sMm[1]);
    expect(start!.rollDeg).toBeGreaterThan(ROLL_MIN_DEG);
    expect(start!.rollDeg).toBeLessThanOrEqual(ROLL_MAX_DEG);
    expect(start!.flexDeg).toBeGreaterThanOrEqual(FLEX_MIN_DEG);
    expect(start!.flexDeg).toBeLessThanOrEqual(FLEX_MAX_DEG);
    if ('view' in lab.start) expect(viewPose(manifest, lab.start.view)).not.toBeNull();
    // What it shows when it is reviewed without an image of the learner's own.
    expect(labReviewPose(manifest, path, lab)).not.toBeNull();
  });

  it.each(reachLabs)('%s names a target the case has a view and a label for', (labId) => {
    const lab = eusbLab(labId);
    expect(lab.target).toBeTruthy();
    const target = resolveTarget(manifest, volume, path, lab.target!);
    expect(target).not.toBeNull();
    expect(volume.metadata.labels[target!.labelId].reportable).toBe(true);
    expect(
      referenceVisibleAreaMm2(volume, path, manifest, target!.pose, target!.labelId, blocking),
    ).toBeGreaterThan(20);
    if (lab.kind === 'rotate') expect(lab.controls).toEqual(['rotate']);
  });

  it.each(reachLabs)('%s is not already done where it starts', (labId) => {
    const start = resolveStart(manifest, path, eusbLab(labId).start)!;
    expect(ratioAt(labId, start)).toBeLessThan(EUSB_HOLD_AREA_FRACTION);
  });

  it.each(reachLabs)('%s is done in the target view', (labId) => {
    const target = resolveTarget(manifest, volume, path, eusbLab(labId).target!)!;
    expect(ratioAt(labId, target.pose)).toBeCloseTo(1, 6);
  });

  it.each(reachLabs)(
    '%s can be done from its start with only the controls it offers',
    (labId) => {
      const lab = eusbLab(labId);
      const start = resolveStart(manifest, path, lab.start)!;
      const target = resolveTarget(manifest, volume, path, lab.target!)!;
      const range = (allowed: boolean, fixed: number, low: number, high: number, step: number) => {
        if (!allowed) return [fixed];
        const values: number[] = [];
        for (let value = low; value <= high; value += step) values.push(value);
        return values;
      };
      const sValues = range(
        lab.controls.includes('advance'),
        start.sMm,
        0,
        Math.floor(path.totalLengthMm),
        3,
      );
      // The rotation slider runs from -180 to 180 and does not wrap.
      const rollValues = range(lab.controls.includes('rotate'), start.rollDeg, -177, 180, 3);
      const flexValues = range(lab.controls.includes('flex'), start.flexDeg, -45, 45, 15);
      const hits: EusScopeState[] = [];
      for (const sMm of sValues)
        for (const rollDeg of rollValues)
          for (const flexDeg of flexValues) {
            const scope = { sMm, rollDeg, flexDeg };
            if (met(labId, scope, 96)) hits.push(scope);
          }
      expect(hits.length).toBeGreaterThan(0);

      // The target view itself is within reach when every control it differs by is offered.
      const differs = {
        advance: target.pose.sMm !== start.sMm,
        rotate: normalizeRollDeg(target.pose.rollDeg - start.rollDeg) !== 0,
        flex: target.pose.flexDeg !== start.flexDeg,
      };
      const viewInReach = (Object.keys(differs) as (keyof typeof differs)[]).every(
        (control) => !differs[control] || lab.controls.includes(control),
      );
      expect(viewInReach).toBe(true);

      // Around the target view the task has to stay done over a usable range of each movement.
      const turn = band(
        labId,
        target.pose,
        (scope, by) => ({ ...scope, rollDeg: normalizeRollDeg(scope.rollDeg + by) }),
        180,
      );
      const travel = band(
        labId,
        target.pose,
        // The band ends where the path does.
        (scope, by) =>
          scope.sMm + by < 0 || scope.sMm + by > path.totalLengthMm
            ? null
            : { ...scope, sMm: scope.sMm + by },
        120,
      );
      const sHits = hits.map((hit) => hit.sMm),
        rollHits = hits.map((hit) => hit.rollDeg);
      console.info(
        `${labId}: start s=${start.sMm} roll=${start.rollDeg} flex=${start.flexDeg}` +
          ` (share at start ${ratioAt(labId, start).toFixed(2)});` +
          ` target view s=${target.pose.sMm} roll=${target.pose.rollDeg};` +
          ` done at the view's travel for rotation ${target.pose.rollDeg + turn.low}..${target.pose.rollDeg + turn.high}°` +
          ` (${turn.width}°), at the view's rotation for travel ${target.pose.sMm + travel.low}..${target.pose.sMm + travel.high} mm` +
          ` (${travel.width} mm); anywhere on the grid: s ${Math.min(...sHits)}..${Math.max(...sHits)} mm,` +
          ` roll ${Math.min(...rollHits)}..${Math.max(...rollHits)}°, ${hits.length} cells`,
      );
      if (lab.controls.includes('rotate')) expect(turn.width).toBeGreaterThanOrEqual(6);
      if (lab.controls.includes('advance')) expect(travel.width).toBeGreaterThanOrEqual(4);
    },
    120000,
  );
});

describe('what the lab tells the lesson page', () => {
  const tagFor = (labKey: string, scope: EusScopeState): GuidedFrameTag => ({
    labKey,
    phase: 'work',
    scope,
    depthMm: manifest.probe.defaultDepthMm,
    gainDb: 0,
  });

  it.each(EUSB_LAB_IDS)('%s reports in the form the bridge accepts', (labId) => {
    const lab = eusbLab(labId);
    const labKey = `session|${labId}`;
    const start = resolveStart(manifest, path, lab.start)!;
    const target = lab.target ? resolveTarget(manifest, volume, path, lab.target) : null;
    const base = {
      labId,
      labKey,
      manifest,
      volume,
      depthMm: manifest.probe.defaultDepthMm,
      gainDb: 0,
      usedControls: [...lab.controls],
      actionCount: 7,
      lastAction: lab.controls[0] ?? ('' as const),
      now: 5000,
    };

    // Before the first image.
    const waiting = buildObservation({
      ...base,
      scope: start,
      frame: null,
      frameTag: null,
      target: target ? { key: target.key, reach: REACH_START } : null,
    });
    expect(isEusbObservation(waiting)).toBe(true);
    expect(waiting.frameReady).toBe(false);
    expect(waiting.frameId).toBe('');

    // At the start, with its image drawn.
    const startTag = tagFor(labKey, start);
    const atStart = buildObservation({
      ...base,
      scope: start,
      frame: frameAt(start),
      frameTag: startTag,
      target: target ? { key: target.key, reach: REACH_START } : null,
    });
    expect(isEusbObservation(atStart)).toBe(true);
    expect(atStart.frameReady).toBe(true);
    expect(atStart.labId).toBe(labId);
    expect(atStart.panes).toEqual(['ultrasound']);
    expect(atStart.inView.length).toBeGreaterThan(0);
    expect(atStart.inView.length).toBeLessThanOrEqual(12);
    expect(atStart.region).toBe(start.sMm >= manifest.path.gejSMm ? 'stomach' : 'esophagus');
    expect(
      isEusbMessage({
        version: EUSB_BRIDGE_VERSION,
        type: 'observation',
        sessionId: 'session-1',
        observationRequest: 3,
        observation: atStart,
      }),
    ).toBe(true);

    // An image drawn for another lab does not count as this lab's image.
    const stale = buildObservation({
      ...base,
      scope: start,
      frame: frameAt(start),
      frameTag: { ...startTag, labKey: 'session|other' },
      target: null,
    });
    expect(stale.frameReady).toBe(false);
    expect(isEusbObservation(stale)).toBe(true);

    if (!target) return;
    // In the target view, held for the whole time.
    const tag = tagFor(labKey, target.pose);
    const frame = frameAt(target.pose);
    const held = heldImage(manifest, tag, 'learner');
    let reach = reachReducer(REACH_START, { type: 'frame', areaRatio: 1, now: 0, image: held });
    const holding = buildObservation({
      ...base,
      scope: target.pose,
      frame,
      frameTag: tag,
      target: { key: target.key, reach },
      now: 400,
    });
    expect(isEusbObservation(holding)).toBe(true);
    expect(holding.target).toMatchObject({ key: target.key, found: false, heldMs: 400 });
    expect(holding.target?.foundAt).toBeUndefined();

    reach = reachReducer(reach, { type: 'tick', now: EUSB_HOLD_MS });
    const done = buildObservation({
      ...base,
      scope: target.pose,
      frame,
      frameTag: tag,
      target: { key: target.key, reach },
      now: EUSB_HOLD_MS,
    });
    expect(isEusbObservation(done)).toBe(true);
    expect(done.target).toMatchObject({ found: true, heldMs: EUSB_HOLD_MS, foundAt: held });
    expect(done.target?.foundAt?.frameId).toBe(done.frameId);
    expect(done.inView[0].key).toBeTruthy();
    // The other views on screen are reported after the ultrasound image.
    const withViews = buildObservation({
      ...base,
      scope: target.pose,
      frame,
      frameTag: tag,
      target: { key: target.key, reach },
      views: ['endoscope', 'anatomy'],
    });
    expect(withViews.panes).toEqual(['ultrasound', 'endoscope', 'anatomy']);
    expect(isEusbObservation(withViews)).toBe(true);

    // Shown at the learner's request: reported as shown with the lab's own image, never as found.
    const reference = heldImage(manifest, tag, 'reference');
    const shownReach = reachReducer(REACH_START, { type: 'shown', image: reference });
    const shown = buildObservation({
      ...base,
      scope: target.pose,
      frame,
      frameTag: tag,
      target: { key: target.key, reach: shownReach },
      views: ['endoscope'],
    });
    expect(isEusbObservation(shown)).toBe(true);
    expect(shown.target).toMatchObject({ found: false, shown: true, shownAt: reference });
    expect(shown.target?.foundAt).toBeUndefined();
    expect(shown.target?.shownAt?.frameId).toBe(shown.frameId);
    expect(
      isEusbConfig({
        sessionId: 'session-1',
        labId,
        phase: 'review',
        names: 'shown',
        panes: ['ultrasound'],
        held: [shown.target!.shownAt],
        observationRequest: 5,
      }),
    ).toBe(true);
    // A task still being searched says nothing about being shown.
    expect(holding.target).not.toHaveProperty('shown');

    // The held image can be handed straight back as the picture to review.
    expect(
      isEusbConfig({
        sessionId: 'session-1',
        labId,
        phase: 'review',
        names: 'shown',
        panes: ['ultrasound'],
        held: [done.target!.foundAt],
        observationRequest: 4,
      }),
    ).toBe(true);
  });

  it('announces itself with the contract it was built against', () => {
    expect(
      isEusbMessage({
        version: EUSB_BRIDGE_VERSION,
        type: 'ready',
        contractRevision: EUSB_CONTRACT_REVISION,
      }),
    ).toBe(true);
  });
});
